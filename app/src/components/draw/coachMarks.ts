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

export type CoachId = "draft" | "bench" | "hints" | "decision" | "introduced";

/**
 * Order is the order they can fire in; used by "skip all".
 *
 * "introduced" (D2) is deliberately NOT here: its persistence is the separate
 * `drawIntroducedV1` sentinel (useDrawIntro), written only at the trigger point
 * (fixture 1 resolved) — never mid-draft. Folding it into skip-all's set would
 * let a SKIP ALL on the draft mark un-hide the first-run UI before the trigger.
 */
export const COACH_IDS: readonly CoachId[] = ["draft", "bench", "hints", "decision"];

export const COACH_COPY: Record<CoachId, string> = {
  draft: "Pick 1 of 3. Chain 3+ of the same CLUB, NATION, or ERA for multipliers.",
  bench: "Sit one. Only the five on the pitch score — chains count fielded players only.",
  // Ticket G3 — the one hint mark, first run only.
  hints: "Hints are rumors. Mostly true.",
  decision:
    "BANK keeps your points. PUSH risks them against the next fixture. Bust and you keep scraps.",
  // Ticket D2 — the ONE first-run introduction, fired after fixture 1 resolves.
  introduced:
    "🔥/❄ show a player's form once rounds resolve. F1–F5 show how each card fits the five fixtures. Both are live from now on.",
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

// ── Ticket D2 — first-run de-noising sentinel ──────────────────────────────

/**
 * Client-only "this player has been introduced to form + fixture-fit" flag.
 *
 * Kept SEPARATE from the coach seen-set on purpose (Ruling 2 / Option 1):
 * SKIP ALL writes the seen-set the instant it is pressed, but the intro
 * sentinel must be written ONLY at the trigger point (fixture 1 resolved), so
 * the fit strip and the bench form icons stay hidden through the whole first
 * draft and round 1 and un-hide exactly once — never mid-draft.
 *
 * "First-run" for the gate is simply: this key is absent. It is NOT inferred
 * from the seen-set being empty (that set is populated the moment the first
 * draft offer is selected — DraftStage), which would mis-fire mid-first-draft.
 */
export const DRAW_INTRO_KEY = "drawIntroducedV1";

function readIntroduced(): boolean {
  try {
    return window.localStorage.getItem(DRAW_INTRO_KEY) === "1";
  } catch {
    // Storage unavailable (private mode): treat as ALREADY introduced — show
    // everything. The convention from the coach marks (never a state we can't
    // persist the exit from): a first-run player we can't remember introducing
    // must not be trapped in a hidden-UI mode forever.
    return true;
  }
}

function writeIntroduced(): void {
  try {
    window.localStorage.setItem(DRAW_INTRO_KEY, "1");
  } catch {
    /* private mode / quota — un-hidden this session, may re-hide next run. */
  }
}

/**
 * `introduced` is reactive: false for a first-run player until `markIntroduced`
 * fires (at the intro mark's dismissal, or when SKIP-ALL suppresses it at the
 * trigger). Because nothing writes the sentinel during the draft or round-1
 * selection, `introduced` is stable there — the un-hide happens only at the
 * trigger point, as specified.
 */
export function useDrawIntro() {
  const [introduced, setIntroduced] = useState<boolean>(() => readIntroduced());
  const markIntroduced = useCallback(() => {
    setIntroduced((prev) => {
      if (prev) return prev;
      writeIntroduced();
      return true;
    });
  }, []);
  return { introduced, markIntroduced };
}
