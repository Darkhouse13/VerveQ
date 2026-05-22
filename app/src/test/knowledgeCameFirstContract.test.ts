import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function readKnowledgeSeeds() {
  const source = readFileSync("convex/knowledgeQuestions.ts", "utf8");
  const declarationStart = source.indexOf("export const knowledgeQuestions");
  const arrayStart = source.indexOf("[", source.indexOf("=", declarationStart));
  const arrayEnd = source.lastIndexOf("];", source.length) + 1;
  return JSON.parse(source.slice(arrayStart, arrayEnd)) as Array<{
    sport: string;
    category: string;
    question: string;
    options: string[];
    correctAnswer: string;
    difficulty: string;
    bucket: string;
    checksum: string;
  }>;
}

describe("Knowledge Which Came First mode", () => {
  it("ships a dedicated verified Which Came First question pool", () => {
    const cameFirst = readKnowledgeSeeds().filter(
      (q) => q.category === "which_came_first",
    );

    expect(cameFirst).toHaveLength(250);
    for (const q of cameFirst) {
      expect(q.sport).toBe("knowledge");
      expect(q.bucket).toContain("knowledge_came_first");
      expect(q.checksum).toMatch(/^knowledge_came_first_v1_/);
      expect(q.question).toMatch(/Which came first\?/);
      expect(q.options).toHaveLength(2);
      expect(q.options).toContain(q.correctAnswer);
    }
  });

  it("routes solo Knowledge Which Came First through quiz sessions with a distinct mode", () => {
    const home = readFileSync("src/pages/HomeScreen.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");
    const difficulty = readFileSync("src/pages/DifficultyScreen.tsx", "utf8");
    const quizScreen = readFileSync("src/pages/QuizScreen.tsx", "utf8");
    const quizSessions = readFileSync("convex/quizSessions.ts", "utf8");
    const games = readFileSync("convex/games.ts", "utf8");

    expect(home).toContain("Which Came First?");
    expect(app).toContain('path="/quiz"');
    expect(difficulty).toContain("mode=came_first");
    expect(quizScreen).toContain('const mode = params.get("mode") || "quiz"');
    expect(quizScreen).toContain("mode: mode === \"came_first\" ? \"came_first\" : \"quiz\"");
    expect(quizSessions).toContain("mode: v.optional(v.string())");
    expect(quizSessions).toContain('session.mode === "came_first"');
    expect(games).toContain("const mode = session.mode ?? \"quiz\"");
  });

  it("lets Knowledge challenges use Which Came First without enabling sport survival", () => {
    const challenge = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(challenge).toContain('selectedSport === "knowledge" ? ["quiz", "came_first"] : modePills');
    expect(challenge).toContain("formatModeLabel");
    expect(liveMatches).toContain('challenge.mode === "came_first"');
    expect(liveMatches).toContain('q.category === "which_came_first"');
    expect(liveMatches).toContain("recordChallengeHistory");
  });
});
