import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { knowledgeQuestions } from "../../convex/knowledgeQuestions";

describe("answer option ordering contract", () => {
  it("keeps seeded Knowledge MCQs and Which Came First answers balanced", () => {
    const mcqCounts = [0, 0, 0, 0];
    const binaryCounts = [0, 0];
    for (const question of knowledgeQuestions) {
      const correctIndex = question.options.indexOf(question.correctAnswer);
      expect(correctIndex, question.checksum).toBeGreaterThanOrEqual(0);
      if (question.category === "which_came_first") {
        binaryCounts[correctIndex] += 1;
      } else {
        mcqCounts[correctIndex] += 1;
      }
    }

    // 11 exact-duplicate MCQ rows were removed from the bundled pool
    // (slot removals: 4/2/1/4), shifting the previously even 290-per-slot split.
    expect(mcqCounts).toEqual([286, 288, 289, 286]);
    expect(binaryCounts).toEqual([275, 275]);
  });

  it("orders answer options server-side before every quiz mode returns them", () => {
    const helper = readFileSync("convex/lib/answerOptions.ts", "utf8");
    const quizSessions = readFileSync("convex/quizSessions.ts", "utf8");
    const dailyChallenge = readFileSync("convex/dailyChallenge.ts", "utf8");
    const blitz = readFileSync("convex/blitz.ts", "utf8");
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(helper).toContain("orderAnswerOptions");
    expect(quizSessions).toContain("orderAnswerOptions(picked.options, picked.correctAnswer, picked.checksum)");
    expect(dailyChallenge).toContain("orderAnswerOptions(");
    expect(blitz).toContain("orderAnswerOptions(pick.options, pick.correctAnswer, pick.checksum)");
    expect(liveMatches).toContain("orderAnswerOptions(q.options, q.correctAnswer, q.checksum)");
    expect(liveMatches).toContain("question.correctAnswer");
  });
});
