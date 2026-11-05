// Solo quiz stamps questionStartedAt server-side the moment getQuestion runs,
// so the response's network leg, the client render, and the image decode all
// elapse before the player can read a word. Written off before the speed decay
// starts (same rationale as DUEL_GRACE_SEC below; smaller because only one
// network leg precedes display — duels also carry the reveal pause).
export const QUIZ_SERVE_GRACE_SEC = 1.5;
// Daily stamps a question as served when the PREVIOUS answer is submitted, so
// like duels it swallows the reveal pause plus two network legs.
export const DAILY_SERVE_GRACE_SEC = 2.5;

// Ranked quiz (owner ruling 2026-11-05): every question has a 15 s answer
// window on the server clock, counted after the serve grace. No answer inside
// it = wrong; points fall LINEARLY from full at 0 s to 0 at the limit.
export const RANKED_ANSWER_LIMIT_SEC = 15;

/** True while a ranked answer (seconds after the serve grace) is in time. */
export function rankedAnswerInTime(timeTakenSec: number): boolean {
  return timeTakenSec <= RANKED_ANSWER_LIMIT_SEC;
}

/** Linear ranked time score: full at 0 s, 0 at RANKED_ANSWER_LIMIT_SEC. */
export function calculateTimeScore(
  basePoints: number,
  timeTaken: number,
  maxTime = RANKED_ANSWER_LIMIT_SEC,
): number {
  if (timeTaken >= maxTime) return 0;
  if (timeTaken <= 0) return basePoints;
  // (maxTime - t) * base / maxTime keeps whole seconds exact (12 s → 20, not
  // 19.999…); the epsilon guards the remaining float noise before flooring.
  return Math.max(0, Math.floor(((maxTime - timeTaken) * basePoints) / maxTime + 1e-9));
}

// Async duels stamp a question as served the moment the previous answer is
// submitted (or the view loads), so the answer-reveal pause and two network
// round-trips elapse before the player can read a word. The grace window
// writes that dead time off before the speed decay starts — without it the
// nominal max score is unreachable even with instant taps.
export const DUEL_GRACE_SEC = 2.5;
// Full points while (timeTaken - grace) is within this window.
export const DUEL_FULL_SCORE_WINDOW_SEC = 3.0;
// Decay ends here; beyond it a correct answer earns the floor, never zero.
export const DUEL_MAX_TIME_SEC = 15.0;
export const DUEL_MIN_SCORE_RATIO = 0.4;

export function calculateDuelTimeScore(
  basePoints: number,
  timeTaken: number,
): number {
  const effective = Math.max(0, timeTaken - DUEL_GRACE_SEC);
  if (effective <= DUEL_FULL_SCORE_WINDOW_SEC) return basePoints;
  const floor = Math.round(basePoints * DUEL_MIN_SCORE_RATIO);
  if (effective >= DUEL_MAX_TIME_SEC) return floor;
  const span = DUEL_MAX_TIME_SEC - DUEL_FULL_SCORE_WINDOW_SEC;
  const remaining = (DUEL_MAX_TIME_SEC - effective) / span;
  return Math.max(
    floor,
    Math.floor(floor + (basePoints - floor) * remaining),
  );
}

export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "");
}
