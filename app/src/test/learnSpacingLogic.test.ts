import { describe, expect, it } from "vitest";

import { applyLearnRungRating } from "../../convex/learnSpacingLogic";

const NOW = new Date("2026-06-01T12:00:00.000Z").getTime();
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

describe("Learn spacing logic", () => {
  it("schedules a new correct Good rating as locked in for tomorrow", () => {
    expect(applyLearnRungRating(null, "good", true, NOW)).toEqual({
      reviewState: "locked_in",
      dueAt: NOW + DAY_MS,
      nextReview: NOW + DAY_MS,
      intervalMs: DAY_MS,
      easeFactor: 2.5,
      repetitions: 1,
      lapses: 0,
      masteryDelta: 0.15,
    });
  });

  it("keeps Hard in learning with a short interval", () => {
    expect(applyLearnRungRating(null, "hard", true, NOW)).toEqual({
      reviewState: "learning",
      dueAt: NOW + 12 * HOUR_MS,
      nextReview: NOW + 12 * HOUR_MS,
      intervalMs: 12 * HOUR_MS,
      easeFactor: 2.35,
      repetitions: 1,
      lapses: 0,
      masteryDelta: 0.05,
    });
  });

  it("uses the stored server outcome to reset incorrect answers regardless of rating", () => {
    expect(
      applyLearnRungRating(
        {
          reviewState: "locked_in",
          intervalMs: 3 * DAY_MS,
          easeFactor: 2.5,
          repetitions: 2,
          lapses: 0,
        },
        "easy",
        false,
        NOW,
      ),
    ).toEqual({
      reviewState: "learning",
      dueAt: NOW + 10 * MINUTE_MS,
      nextReview: NOW + 10 * MINUTE_MS,
      intervalMs: 10 * MINUTE_MS,
      easeFactor: 2.3,
      repetitions: 0,
      lapses: 1,
      masteryDelta: -0.2,
    });
  });
});
