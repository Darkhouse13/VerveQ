/**
 * F4 — coach mark copy and dismissal state. Split from CoachMark.tsx so that
 * file exports only its component (the house lint rule; it also keeps fast
 * refresh working on the component).
 *
 * State is one localStorage key: a Set of the marks already dismissed, so a
 * mark added later doesn't re-teach the ones a player has already dismissed.
 * "Skip all" writes every id at once.
 *
 * Storage is treated as untrusted and optional (private mode throws on write, a
 * stale value may be any shape). A storage failure degrades to SHOWING the
 * marks, never to a crash: an unwanted tip is a smaller bug than a dead mode.
 */

import { useCallback, useState } from "react";

export const DRAW_COACH_KEY = "drawCoachV1";

export type CoachId = "draft" | "bench" | "hints" | "decision";

/** Order is the order they can fire in; used by "skip all". */
export const COACH_IDS: readonly CoachId[] = ["draft", "bench", "hints", "decision"];

export const COACH_COPY: Record<CoachId, string> = {
  draft: "Pick 1 of 3. Chain 3+ of the same CLUB, NATION, or ERA for multipliers.",
  bench: "Sit one. Only the five on the pitch score — chains count fielded players only.",
  // Ticket G3 — the one hint mark, first run only.
  hints: "Hints are rumors. Mostly true.",
  decision:
    "BANK keeps your points. PUSH risks them against the next fixture. Bust and you keep scraps.",
};

function readSeen(): Set<CoachId> {
  try {
    const raw = window.localStorage.getItem(DRAW_COACH_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    // Tolerate anything: a hand-edited or older value must not throw here.
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is CoachId => COACH_IDS.includes(id as CoachId)));
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<CoachId>): void {
  try {
    window.localStorage.setItem(DRAW_COACH_KEY, JSON.stringify([...seen]));
  } catch {
    /* private mode / quota — the mark just shows again next run. */
  }
}

/**
 * Marks already dismissed, plus the two ways to dismiss. Read once on mount:
 * the value only changes through this hook, so re-reading storage per render
 * would buy nothing.
 */
export function useCoachMarks() {
  const [seen, setSeen] = useState<Set<CoachId>>(() => readSeen());

  const dismiss = useCallback((id: CoachId) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      writeSeen(next);
      return next;
    });
  }, []);

  const skipAll = useCallback(() => {
    const next = new Set(COACH_IDS);
    writeSeen(next);
    setSeen(next);
  }, []);

  return { seen, dismiss, skipAll };
}
