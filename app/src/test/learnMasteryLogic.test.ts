import { describe, expect, it } from "vitest";
import {
  SPACING_DELAY_MS,
  applyLearnLadderCompletion,
  calculateLearnProgressPct,
  isLearnReviewDue,
  markLearnAttemptStarted,
  meetsLearnMasteryThreshold,
  type LearnMasterySnapshot,
} from "../../convex/learnMasteryLogic";

describe("learn mastery logic", () => {
  it("moves an untouched node to learning when an attempt starts", () => {
    const transition = markLearnAttemptStarted(null);

    expect(transition.next.state).toBe("learning");
    expect(transition.justChanged).toBe(true);
  });

  it("promotes a completed learning ladder to proficient at the threshold", () => {
    const now = 1_000;
    const transition = applyLearnLadderCompletion(
      { state: "learning" },
      { firstTryCorrect: 5, total: 7 },
      now,
    );

    expect(meetsLearnMasteryThreshold({ firstTryCorrect: 5, total: 7 })).toBe(true);
    expect(transition.next).toMatchObject({
      state: "proficient",
      proficientAt: now,
      reviewDueAt: now + SPACING_DELAY_MS,
    });
    expect(transition.justChanged).toBe(true);
  });

  it("does not allow mastery before the review due date", () => {
    const now = 10_000;
    const mastery: LearnMasterySnapshot = {
      state: "proficient",
      proficientAt: 1_000,
      reviewDueAt: now + 1,
    };

    const transition = applyLearnLadderCompletion(
      mastery,
      { firstTryCorrect: 7, total: 7 },
      now,
    );

    expect(transition.next.state).toBe("proficient");
    expect(transition.next.masteredAt).toBeUndefined();
    expect(transition.justChanged).toBe(false);
  });

  it("promotes a due proficient node to mastered on a second strong pass", () => {
    const now = 100_000;
    const mastery: LearnMasterySnapshot = {
      state: "proficient",
      proficientAt: 1_000,
      reviewDueAt: now,
    };

    const transition = applyLearnLadderCompletion(
      mastery,
      { firstTryCorrect: 6, total: 8 },
      now,
    );

    expect(isLearnReviewDue(mastery, now)).toBe(true);
    expect(transition.next).toMatchObject({
      state: "mastered",
      masteredAt: now,
      reviewDueAt: now + SPACING_DELAY_MS,
    });
    expect(transition.justChanged).toBe(true);
  });

  it("decays one level on a due low-score completion", () => {
    const now = 200_000;

    const proficientDecay = applyLearnLadderCompletion(
      { state: "proficient", proficientAt: 1_000, reviewDueAt: now },
      { firstTryCorrect: 4, total: 8 },
      now,
    );
    expect(proficientDecay.next).toMatchObject({
      state: "learning",
      reviewDueAt: now + SPACING_DELAY_MS,
    });
    expect(proficientDecay.next.proficientAt).toBeUndefined();
    expect(proficientDecay.justChanged).toBe(true);

    const masteredDecay = applyLearnLadderCompletion(
      {
        state: "mastered",
        proficientAt: 1_000,
        masteredAt: 2_000,
        reviewDueAt: now,
      },
      { firstTryCorrect: 4, total: 8 },
      now,
    );
    expect(masteredDecay.next).toMatchObject({
      state: "proficient",
      reviewDueAt: now + SPACING_DELAY_MS,
    });
    expect(masteredDecay.next.masteredAt).toBeUndefined();
  });

  it("keeps a not-yet-due proficient node stable after a low score", () => {
    const now = 300_000;
    const mastery: LearnMasterySnapshot = {
      state: "proficient",
      proficientAt: 1_000,
      reviewDueAt: now + SPACING_DELAY_MS,
    };

    const transition = applyLearnLadderCompletion(
      mastery,
      { firstTryCorrect: 0, total: 8 },
      now,
    );

    expect(transition.next).toEqual(mastery);
    expect(transition.justChanged).toBe(false);
  });

  it("aggregates subject progress by mastery weight", () => {
    expect(
      calculateLearnProgressPct([
        "untouched",
        "learning",
        "proficient",
        "mastered",
      ]),
    ).toBe(50);
    expect(calculateLearnProgressPct([])).toBe(0);
  });
});
