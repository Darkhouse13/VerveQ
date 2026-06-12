/**
 * Daily-streak contract (convex/lib/streaks.ts).
 *
 * The streak is consecutive UTC days with ≥1 completed run. Locked here:
 *  - one play per day counts; repeat plays the same day are no-ops
 *  - a next-day play extends, anything later resets to 1
 *  - bestStreak is monotone (a reset never lowers it)
 *  - clock skew (stored day in the future) never shrinks a streak
 *  - a streak is only "alive" (reportable as current) while lastPlayedDay is
 *    today or yesterday — profile.get must show 0 otherwise
 */
import { describe, expect, it } from "vitest";
import {
  advanceStreak,
  isStreakAlive,
  utcDayNumber,
  MS_PER_DAY,
} from "../../convex/lib/streaks";

describe("advanceStreak", () => {
  it("starts a streak on the first ever play", () => {
    expect(advanceStreak({}, 100)).toEqual({
      lastPlayedDay: 100,
      currentStreak: 1,
      bestStreak: 1,
    });
  });

  it("is a no-op for repeat plays on the same day", () => {
    expect(
      advanceStreak({ lastPlayedDay: 100, currentStreak: 3, bestStreak: 5 }, 100),
    ).toBeNull();
  });

  it("extends on the next consecutive day, preserving a higher best", () => {
    expect(
      advanceStreak({ lastPlayedDay: 99, currentStreak: 3, bestStreak: 5 }, 100),
    ).toEqual({ lastPlayedDay: 100, currentStreak: 4, bestStreak: 5 });
  });

  it("raises bestStreak when the current streak passes it", () => {
    expect(
      advanceStreak({ lastPlayedDay: 99, currentStreak: 5, bestStreak: 5 }, 100),
    ).toEqual({ lastPlayedDay: 100, currentStreak: 6, bestStreak: 6 });
  });

  it("resets to 1 after a missed day without lowering bestStreak", () => {
    expect(
      advanceStreak({ lastPlayedDay: 97, currentStreak: 9, bestStreak: 9 }, 100),
    ).toEqual({ lastPlayedDay: 100, currentStreak: 1, bestStreak: 9 });
  });

  it("never shrinks a streak on clock skew (stored day in the future)", () => {
    expect(
      advanceStreak({ lastPlayedDay: 101, currentStreak: 2, bestStreak: 2 }, 100),
    ).toBeNull();
  });
});

describe("isStreakAlive", () => {
  it("is alive when last played today or yesterday", () => {
    expect(isStreakAlive(100, 100)).toBe(true);
    expect(isStreakAlive(99, 100)).toBe(true);
  });

  it("is broken after a full missed day, and for users who never played", () => {
    expect(isStreakAlive(98, 100)).toBe(false);
    expect(isStreakAlive(undefined, 100)).toBe(false);
  });
});

describe("utcDayNumber", () => {
  it("flips exactly at UTC midnight — matching the daily challenge reset", () => {
    const beforeMidnight = Date.UTC(2026, 5, 12, 23, 59, 59);
    const atMidnight = Date.UTC(2026, 5, 13, 0, 0, 0);
    expect(utcDayNumber(atMidnight) - utcDayNumber(beforeMidnight)).toBe(1);
    expect(utcDayNumber(atMidnight) % 1).toBe(0);
    expect(atMidnight / MS_PER_DAY).toBe(utcDayNumber(atMidnight));
  });
});
