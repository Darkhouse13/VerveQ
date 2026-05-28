export const SPACING_DELAY_MS = 24 * 60 * 60 * 1000;
export const LEARN_MASTERY_THRESHOLD = 0.7;

export const learnMasteryStates = [
  "untouched",
  "learning",
  "proficient",
  "mastered",
] as const;

export type LearnMasteryState = (typeof learnMasteryStates)[number];

export type LearnMasterySnapshot = {
  state: LearnMasteryState;
  proficientAt?: number;
  reviewDueAt?: number;
  masteredAt?: number;
};

export type LearnCompletionStats = {
  firstTryCorrect: number;
  total: number;
};

export type LearnMasteryTransition = {
  next: LearnMasterySnapshot;
  justChanged: boolean;
  passed: boolean;
};

export const LEARN_STATE_WEIGHTS: Record<LearnMasteryState, number> = {
  untouched: 0,
  learning: 0.33,
  proficient: 0.66,
  mastered: 1,
};

function effectiveState(
  mastery: LearnMasterySnapshot | null | undefined,
): LearnMasteryState {
  return mastery?.state ?? "untouched";
}

export function isLearnReviewDue(
  mastery: LearnMasterySnapshot | null | undefined,
  now: number,
): boolean {
  return typeof mastery?.reviewDueAt === "number" && now >= mastery.reviewDueAt;
}

export function learnFirstTryAccuracy({
  firstTryCorrect,
  total,
}: LearnCompletionStats): number {
  if (total <= 0) return 0;
  return firstTryCorrect / total;
}

export function meetsLearnMasteryThreshold(
  stats: LearnCompletionStats,
  threshold = LEARN_MASTERY_THRESHOLD,
): boolean {
  return learnFirstTryAccuracy(stats) >= threshold;
}

export function markLearnAttemptStarted(
  mastery: LearnMasterySnapshot | null | undefined,
): LearnMasteryTransition {
  const previousState = effectiveState(mastery);
  if (previousState !== "untouched") {
    return {
      next: { ...mastery, state: previousState },
      justChanged: false,
      passed: false,
    };
  }

  return {
    next: {
      ...mastery,
      state: "learning",
    },
    justChanged: true,
    passed: false,
  };
}

export function applyLearnLadderCompletion(
  mastery: LearnMasterySnapshot | null | undefined,
  stats: LearnCompletionStats,
  now: number,
  options?: {
    threshold?: number;
    spacingDelayMs?: number;
  },
): LearnMasteryTransition {
  const threshold = options?.threshold ?? LEARN_MASTERY_THRESHOLD;
  const spacingDelayMs = options?.spacingDelayMs ?? SPACING_DELAY_MS;
  const previousState = effectiveState(mastery);
  const startedState: LearnMasteryState =
    previousState === "untouched" ? "learning" : previousState;
  const passed = meetsLearnMasteryThreshold(stats, threshold);
  const reviewDue = isLearnReviewDue(mastery, now);
  const next: LearnMasterySnapshot = {
    ...mastery,
    state: startedState,
  };

  if (passed) {
    if (startedState === "learning") {
      next.state = "proficient";
      next.proficientAt = now;
      next.reviewDueAt = now + spacingDelayMs;
      next.masteredAt = undefined;
    } else if (startedState === "proficient" && reviewDue) {
      next.state = "mastered";
      next.masteredAt = now;
      next.reviewDueAt = now + spacingDelayMs;
    } else if (startedState === "mastered" && reviewDue) {
      next.reviewDueAt = now + spacingDelayMs;
    }
  } else if (reviewDue) {
    if (startedState === "mastered") {
      next.state = "proficient";
      next.proficientAt = next.proficientAt ?? now;
      next.masteredAt = undefined;
      next.reviewDueAt = now + spacingDelayMs;
    } else if (startedState === "proficient") {
      next.state = "learning";
      next.proficientAt = undefined;
      next.masteredAt = undefined;
      next.reviewDueAt = now + spacingDelayMs;
    }
  }

  return {
    next,
    justChanged: next.state !== previousState,
    passed,
  };
}

export function calculateLearnProgressPct(states: LearnMasteryState[]): number {
  if (states.length === 0) return 0;
  const totalWeight = states.reduce(
    (sum, state) => sum + LEARN_STATE_WEIGHTS[state],
    0,
  );
  return Math.round((totalWeight / states.length) * 100);
}
