export const learnRatings = ["again", "hard", "good", "easy"] as const;
export type LearnRating = (typeof learnRatings)[number];

export const learnFeltSignals = ["learn", "test"] as const;
export type LearnFelt = (typeof learnFeltSignals)[number];

export const learnReviewStates = ["learning", "locked_in"] as const;
export type LearnReviewState = (typeof learnReviewStates)[number];

export type LearnRungReviewSnapshot = {
  reviewState?: LearnReviewState;
  intervalMs?: number;
  easeFactor?: number;
  repetitions?: number;
  lapses?: number;
};

export type LearnRungSchedule = {
  reviewState: LearnReviewState;
  dueAt: number;
  intervalMs: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  masteryDelta: number;
  nextReview: number;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_LEARN_EASE_FACTOR = 2.5;
export const MIN_LEARN_EASE_FACTOR = 1.3;

function previousEase(snapshot: LearnRungReviewSnapshot | null | undefined) {
  const ease = snapshot?.easeFactor;
  return typeof ease === "number" && Number.isFinite(ease)
    ? Math.max(MIN_LEARN_EASE_FACTOR, ease)
    : DEFAULT_LEARN_EASE_FACTOR;
}

function previousRepetitions(
  snapshot: LearnRungReviewSnapshot | null | undefined,
) {
  const repetitions = snapshot?.repetitions;
  return typeof repetitions === "number" && Number.isFinite(repetitions)
    ? Math.max(0, Math.floor(repetitions))
    : 0;
}

function previousLapses(snapshot: LearnRungReviewSnapshot | null | undefined) {
  const lapses = snapshot?.lapses;
  return typeof lapses === "number" && Number.isFinite(lapses)
    ? Math.max(0, Math.floor(lapses))
    : 0;
}

function previousInterval(snapshot: LearnRungReviewSnapshot | null | undefined) {
  const intervalMs = snapshot?.intervalMs;
  return typeof intervalMs === "number" && Number.isFinite(intervalMs)
    ? Math.max(0, intervalMs)
    : 0;
}

function roundedInterval(ms: number) {
  return Math.max(MINUTE_MS, Math.round(ms));
}

export function applyLearnRungRating(
  snapshot: LearnRungReviewSnapshot | null | undefined,
  rating: LearnRating,
  lastAnswerCorrect: boolean,
  now: number,
): LearnRungSchedule {
  const previousState = snapshot?.reviewState ?? "learning";
  const previousWasLocked = previousState === "locked_in";
  const previousIntervalMs = previousInterval(snapshot);
  const previousReps = previousRepetitions(snapshot);
  const previousLapsesCount = previousLapses(snapshot);
  let easeFactor = previousEase(snapshot);
  let repetitions = previousReps;
  let lapses = previousLapsesCount;
  let intervalMs: number;
  let reviewState: LearnReviewState;
  let masteryDelta: number;

  if (!lastAnswerCorrect || rating === "again") {
    easeFactor = Math.max(MIN_LEARN_EASE_FACTOR, easeFactor - 0.2);
    repetitions = 0;
    lapses += 1;
    intervalMs = 10 * MINUTE_MS;
    reviewState = "learning";
    masteryDelta = previousWasLocked ? -0.2 : -0.05;
  } else if (rating === "hard") {
    easeFactor = Math.max(MIN_LEARN_EASE_FACTOR, easeFactor - 0.15);
    repetitions += 1;
    intervalMs =
      previousIntervalMs > 0
        ? Math.min(3 * DAY_MS, Math.max(12 * HOUR_MS, previousIntervalMs * 1.2))
        : 12 * HOUR_MS;
    reviewState = "learning";
    masteryDelta = 0.05;
  } else if (rating === "good") {
    repetitions += 1;
    if (repetitions === 1) {
      intervalMs = DAY_MS;
    } else if (repetitions === 2) {
      intervalMs = 3 * DAY_MS;
    } else {
      intervalMs = previousIntervalMs * easeFactor;
    }
    reviewState = "locked_in";
    masteryDelta = previousWasLocked ? 0.05 : 0.15;
  } else {
    easeFactor += 0.15;
    repetitions += 1;
    if (repetitions === 1) {
      intervalMs = 3 * DAY_MS;
    } else if (repetitions === 2) {
      intervalMs = 6 * DAY_MS;
    } else {
      intervalMs = previousIntervalMs * easeFactor * 1.3;
    }
    reviewState = "locked_in";
    masteryDelta = previousWasLocked ? 0.08 : 0.2;
  }

  const normalizedIntervalMs = roundedInterval(intervalMs);
  const nextReview = now + normalizedIntervalMs;

  return {
    reviewState,
    dueAt: nextReview,
    intervalMs: normalizedIntervalMs,
    easeFactor,
    repetitions,
    lapses,
    masteryDelta,
    nextReview,
  };
}
