import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("answer option ordering contract", () => {
  it("keeps seeded Knowledge MCQs and Which Came First answers balanced", () => {
    const source = readFileSync("convex/knowledgeQuestions.ts", "utf8");
    const declarationStart = source.indexOf("export const knowledgeQuestions");
    const arrayStart = source.indexOf("[", source.indexOf("=", declarationStart));
    const arrayEnd = source.lastIndexOf("];", source.length) + 1;
    const questions = JSON.parse(source.slice(arrayStart, arrayEnd)) as Array<{
      category: string;
      options: string[];
      correctAnswer: string;
      checksum: string;
    }>;

    const mcqCounts = [0, 0, 0, 0];
    const binaryCounts = [0, 0];
    for (const question of questions) {
      const correctIndex = question.options.indexOf(question.correctAnswer);
      expect(correctIndex, question.checksum).toBeGreaterThanOrEqual(0);
      if (question.category === "which_came_first") {
        binaryCounts[correctIndex] += 1;
      } else {
        mcqCounts[correctIndex] += 1;
      }
    }

    expect(mcqCounts).toEqual([75, 75, 75, 75]);
    expect(binaryCounts).toEqual([125, 125]);
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
