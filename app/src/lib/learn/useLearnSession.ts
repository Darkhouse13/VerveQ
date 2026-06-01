/**
 * Learn v2 — session source.
 *
 * Default: the render-only fixture mixed set (all four question types), so the
 * runner is fully reviewable offline and exercises every UI + the stub seam.
 *
 * Live ladder (`nodeId` provided): starts a real, server-authoritative
 * mixed-type session via `api.learn.getLearnLadder` and renders its rungs.
 * Those answers grade through `api.learn.submitLearnRung` (see `useLearnGrading`).
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type {
  LearnOrderItem,
  LearnQuestion,
  LearnQuestionType,
} from "./contract";
import type { LearnSessionRef } from "./useLearnGrading";
import {
  LEARN_FIXTURE_QUESTIONS,
  LEARN_FIXTURE_SESSION_ID,
} from "./fixtures";

export type LearnSessionStatus = "loading" | "ready" | "error";

export interface LearnSessionState {
  status: LearnSessionStatus;
  questions: LearnQuestion[];
  ref: LearnSessionRef;
  /** True when falling back to fixtures (offline / no node / start failed). */
  isFixture: boolean;
}

const FIXTURE_STATE: LearnSessionState = {
  status: "ready",
  questions: LEARN_FIXTURE_QUESTIONS,
  ref: { id: LEARN_FIXTURE_SESSION_ID, live: false },
  isFixture: true,
};

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

export function useLearnSession(opts?: { nodeId?: string }): LearnSessionState {
  const nodeId = opts?.nodeId;
  const getLadder = useMutation(api.learn.getLearnLadder);
  const [state, setState] = useState<LearnSessionState>(
    nodeId ? { ...FIXTURE_STATE, status: "loading" } : FIXTURE_STATE,
  );
  const started = useRef(false);

  useEffect(() => {
    if (!nodeId || started.current) return;
    started.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const ladder = await getLadder({ nodeId });
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
        // Offline / unauthenticated / node not playable → showcase fixtures.
        if (!cancelled) setState(FIXTURE_STATE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nodeId, getLadder]);

  return state;
}
