/**
 * Learn v2 — subject source. The server's subjects registry
 * (`api.learn.getLearnSubjects`) is the only authority on what Learn can
 * serve; this hook surfaces that list and resolves which subject a screen
 * shows. Selection lives in the `?subject=` search param so deep links and
 * back/forward keep it; an absent or unknown param resolves to the first
 * servable subject. No subject id is hardcoded on the client.
 */
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export const LEARN_SUBJECT_PARAM = "subject";

export interface LearnSubjectSummary {
  subject: string;
  name: string;
  description: string;
  totalNodes: number;
  playableNodes: number;
  servable: boolean;
  progressPct: number;
  dueCount: number;
  learningCount: number;
  lockedCount: number;
}

export interface LearnSubjectState {
  /** Resolved subject id, or undefined while nothing is resolvable yet. */
  subject: string | undefined;
  /** Every subject the server can serve; undefined while loading. */
  subjects: LearnSubjectSummary[] | undefined;
  setSubject: (subject: string) => void;
}

/**
 * Pure resolution so the precedence is contract-testable: a requested subject
 * wins only if the server lists it; otherwise the first servable subject, then
 * the server default. While the list is loading the request is trusted as-is —
 * the plan query resolves unknown subjects server-side, so no error flash.
 */
export function resolveSelectedLearnSubject(opts: {
  requested: string | null;
  subjects: readonly { subject: string; servable: boolean }[] | undefined;
  defaultSubject: string | undefined;
}): string | undefined {
  const { requested, subjects, defaultSubject } = opts;
  if (subjects === undefined) return requested ?? undefined;
  if (requested && subjects.some((s) => s.subject === requested)) {
    return requested;
  }
  const firstServable = subjects.find((s) => s.servable);
  return firstServable?.subject ?? defaultSubject ?? subjects[0]?.subject;
}

/** Appends `?subject=` to a Learn route (plus any extra params, e.g. `node`). */
export function learnPath(
  path: string,
  subject: string | undefined,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams(extra);
  if (subject) params.set(LEARN_SUBJECT_PARAM, subject);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function useLearnSubject(): LearnSubjectState {
  const [params, setParams] = useSearchParams();
  const data = useQuery(api.learn.getLearnSubjects, {});
  const requested = params.get(LEARN_SUBJECT_PARAM);
  const subject = resolveSelectedLearnSubject({
    requested,
    subjects: data?.subjects,
    defaultSubject: data?.defaultSubject,
  });
  const setSubject = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const merged = new URLSearchParams(prev);
          merged.set(LEARN_SUBJECT_PARAM, next);
          return merged;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { subject, subjects: data?.subjects, setSubject };
}
