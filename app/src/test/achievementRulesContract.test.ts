import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { hasPerfectQuiz, isPerfectQuiz } from "../../convex/lib/achievementRules";

// docs/OPEN_BUGS.md #1 + #5 + #6 (2026-11-04).
describe("achievement rules", () => {
  it("unlocks Quiz Master only for a full 10-question quiz with every answer right", () => {
    expect(isPerfectQuiz({ mode: "quiz", totalQuestions: 10, correctAnswers: 10, accuracy: 1 })).toBe(true);
    expect(isPerfectQuiz({ mode: "quiz", totalQuestions: 10, correctAnswers: 9, accuracy: 0.9 })).toBe(false);
    expect(isPerfectQuiz({ mode: "quiz", totalQuestions: 3, correctAnswers: 3, accuracy: 1 })).toBe(false);
    expect(isPerfectQuiz({ mode: "survival", totalQuestions: 10, correctAnswers: 10, accuracy: 1 })).toBe(false);
    // Legacy rows without correctAnswers fall back to accuracy.
    expect(isPerfectQuiz({ mode: "quiz", totalQuestions: 10, correctAnswers: undefined, accuracy: 1 })).toBe(true);
    expect(
      hasPerfectQuiz([
        { mode: "quiz", totalQuestions: 10, correctAnswers: 7, accuracy: 0.7 },
        { mode: "quiz", totalQuestions: 10, correctAnswers: 10, accuracy: 1 },
      ]),
    ).toBe(true);
  });

  it("checkAndUnlock now checks quiz_master", () => {
    const src = readFileSync("convex/achievements.ts", "utf8");
    expect(src).toContain('["quiz_master", perfectQuiz]');
  });

  it("seed is idempotent, adds missing rows and refreshes reworded copy", () => {
    const src = readFileSync("convex/seedAchievements.ts", "utf8");
    expect(src).toContain('achievementId: "the_architect"');
    expect(src).toContain("Play 50 ranked games");
    expect(src).toContain("ctx.db.patch(existing._id, { name: ach.name, description: ach.description })");
  });

  it("names the badge honestly in every locale", () => {
    for (const [loc, text] of [
      ["en", "Play 50 ranked games"],
      ["fr", "Joue 50 parties classées"],
      ["es", "Juega 50 partidas clasificatorias"],
    ]) {
      const json = JSON.parse(readFileSync(`src/i18n/locales/${loc}/shell.json`, "utf8"));
      const found = JSON.stringify(json).includes(text);
      expect(found, loc).toBe(true);
    }
  });
});
