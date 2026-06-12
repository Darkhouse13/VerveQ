/**
 * Learn v2 — session source.
 *
 * Live ladder only: starts a real, server-authoritative mixed-type session via
 * `api.learn.getLearnLadder` and renders its rungs. With an explicit `?node=`
 * the session starts on that node; without one, today's node is resolved from
 * the server review plan (`pickTodaysSessionNode`). Answers grade through
 * `api.learn.submitLearnRung` (see `useLearnGrading`).
 *
 * There is NO implicit fixture fallback. An unresolvable node surfaces as
 * `empty` (the runner returns the player to the Learn entry) and a ladder
 * failure surfaces as `error` with a retry. The render-only fixture deck is
 * reachable only in dev builds with `VITE_LEARN_FIXTURES=1`, for offline UI
 * review — never in production.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type {
  LearnOrderItem,
  LearnQuestion,
  LearnQuestionType,
} from "./contract";
import type { LearnSessionRef } from "./useLearnGrading";
import { pickTodaysSessionNode, type TodaysSessionNode } from "./todaysSession";
import {
  LEARN_FIXTURE_QUESTIONS,
  LEARN_FIXTURE_SESSION_ID,
} from "./fixtures";

export type LearnSessionStatus = "loading" | "ready" | "empty" | "error";

interface LearnSessionData {
  status: LearnSessionStatus;
  questions: LearnQuestion[];
  ref: LearnSessionRef;
  /** True only for the dev-flagged offline fixture deck. */
  isFixture: boolean;
}

export interface LearnSessionState extends LearnSessionData {
  /** Re-attempts the live session start after an `error`. */
  retry: () => void;
}

/** Offline fixture deck gate: dev builds only, and only when explicitly asked. */
const LEARN_FIXTURES_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_LEARN_FIXTURES === "1";

const NO_SESSION_REF: LearnSessionRef = { id: "", live: false };

const LOADING_STATE: LearnSessionData = {
  status: "loading",
  questions: [],
  ref: NO_SESSION_REF,
  isFixture: false,
};

const EMPTY_STATE: LearnSessionData = {
  status: "empty",
  questions: [],
  ref: NO_SESSION_REF,
  isFixture: false,
};

const ERROR_STATE: LearnSessionData = {
  status: "error",
  questions: [],
  ref: NO_SESSION_REF,
  isFixture: false,
};

// Null outside the dev flag so the deck tree-shakes out of production bundles.
const FIXTURE_STATE: LearnSessionData | null = LEARN_FIXTURES_ENABLED
  ? {
      status: "ready",
      questions: LEARN_FIXTURE_QUESTIONS,
      ref: { id: LEARN_FIXTURE_SESSION_ID, live: false },
      isFixture: true,
    }
  : null;

export type LearnSessionSource =
  | { kind: "loading" }
  | { kind: "fixture" }
  | { kind: "empty" }
  | { kind: "start"; nodeId: string };

/**
 * Decides what the runner should serve. Pure so the no-node and dev-flag
 * paths are contract-testable: outside the dev flag the only outcomes are a
 * real node, an honest empty state, or waiting on the plan — never fixtures.
 */
export function resolveLearnSessionSource(opts: {
  requestedNodeId: string | undefined;
  planNodes: readonly TodaysSessionNode[] | undefined;
  fixturesEnabled: boolean;
}): LearnSessionSource {
  const { requestedNodeId, planNodes, fixturesEnabled } = opts;
  if (requestedNodeId) return { kind: "start", nodeId: requestedNodeId };
  if (fixturesEnabled) return { kind: "fixture" };
  if (planNodes === undefined) return { kind: "loading" };
  const nodeId = pickTodaysSessionNode(planNodes);
  return nodeId ? { kind: "start", nodeId } : { kind: "empty" };
}

export type LiveLearnRung = {
  questionId: string;
  type: LearnQuestionType;
  stem: string;
  options: string[];
  unit?: string;
  tolerance?: number;
  items?: LearnOrderItem[];
};

export function mapLiveRungToQuestion(
  rung: LiveLearnRung,
  subject: string,
): LearnQuestion {
  const base = {
    id: rung.questionId,
    subject,
    prompt: rung.stem,
  };

  switch (rung.type) {
    case "mcq":
      return {
        ...base,
        type: "mcq",
        options: rung.options.map((opt) => ({ key: opt, text: opt })),
      };
    case "text":
      return {
        ...base,
        type: "text",
      };
    case "numeric":
      return {
        ...base,
        type: "numeric",
        ...(rung.unit ? { unit: rung.unit } : {}),
        ...(rung.tolerance !== undefined ? { tolerance: rung.tolerance } : {}),
      };
    case "order":
      return {
        ...base,
        type: "order",
        items:
          rung.items ??
          rung.options.map((text) => ({
            id: text,
            text,
          })),
      };
  }
}

export function useLearnSession(opts?: {
  nodeId?: string;
  subject?: string;
}): LearnSessionState {
  const requestedNodeId = opts?.nodeId;
  const subject = opts?.subject;
  const getLadder = useMutation(api.learn.getLearnLadder);
  // Only consulted when no explicit node is requested (and fixtures are off).
  // Without a subject the server resolves its default — never hardcoded here.
  const plan = useQuery(
    api.learn.getLearnReviewPlan,
    requestedNodeId || LEARN_FIXTURES_ENABLED
      ? "skip"
      : subject
        ? { subject }
        : {},
  );
  const source = resolveLearnSessionSource({
    requestedNodeId,
    planNodes: plan?.nodes,
    fixturesEnabled: LEARN_FIXTURES_ENABLED,
  });

  const [state, setState] = useState<LearnSessionData>(
    source.kind === "fixture" && FIXTURE_STATE ? FIXTURE_STATE : LOADING_STATE,
  );
  const [attempt, setAttempt] = useState(0);
  const startedKey = useRef<string | null>(null);

  const sourceKind = source.kind;
  const sourceNodeId = source.kind === "start" ? source.nodeId : null;

  useEffect(() => {
    // Fixture deck is served from the initial state; nothing to start.
    if (sourceKind === "fixture" || sourceKind === "loading") return;
    if (sourceKind === "empty") {
      setState(EMPTY_STATE);
      return;
    }
    const key = `${sourceNodeId}#${attempt}`;
    if (startedKey.current === key) return;
    startedKey.current = key;
    let cancelled = false;
    setState(LOADING_STATE);

    void (async () => {
      try {
        const ladder = await getLadder({ nodeId: sourceNodeId! });
        if (cancelled) return;
        const questions: LearnQuestion[] = ladder.rungs.map((rung) =>
          mapLiveRungToQuestion(rung as LiveLearnRung, ladder.conceptLine || "Learn"),
        );
        setState({
          status: "ready",
          questions,
          ref: { id: ladder.sessionId, live: true },
          isFixture: false,
        });
      } catch {
        // Offline / unauthenticated / node not playable → visible error + retry.
        if (!cancelled) setState(ERROR_STATE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceKind, sourceNodeId, attempt, getLadder]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
