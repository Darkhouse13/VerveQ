// Solo quiz stamps questionStartedAt server-side the moment getQuestion runs,
// so the response's network leg, the client render, and the image decode all
// elapse before the player can read a word. Written off before the speed decay
// starts (same rationale as DUEL_GRACE_SEC below; smaller because only one
// network leg precedes display — duels also carry the reveal pause).
export const QUIZ_SERVE_GRACE_SEC = 1.5;
// Daily stamps a question as served when the PREVIOUS answer is submitted, so
// like duels it swallows the reveal pause plus two network legs.
export const DAILY_SERVE_GRACE_SEC = 2.5;

export function calculateTimeScore(
  basePoints: number,
  timeTaken: number,
  maxTime = 10.0,
): number {
  if (timeTaken > maxTime) return 0;
  if (timeTaken <= 1.0) return basePoints;
  return Math.max(
    0,
    Math.floor(basePoints * ((maxTime - timeTaken) / (maxTime - 1.0))),
  );
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
