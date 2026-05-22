import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readKnowledgeSeed = () => {
  const source = readFileSync("convex/knowledgeQuestions.ts", "utf8");
  const declarationStart = source.indexOf("export const knowledgeQuestions");
  const arrayStart = source.indexOf("[", source.indexOf("=", declarationStart));
  const arrayEnd = source.lastIndexOf("];", source.length) + 1;
  return JSON.parse(source.slice(arrayStart, arrayEnd)) as Array<{
    options: string[];
    correctAnswer: string;
    checksum: string;
  }>;
};

describe("knowledge expansion contract", () => {
  it("ships a seeded knowledge question pool across all quiz difficulties", () => {
    const seedQuestions = readFileSync("convex/seedQuestions.ts", "utf8");
    const knowledgeQuestions = readFileSync("convex/knowledgeQuestions.ts", "utf8");

    expect(seedQuestions).toContain("seedKnowledgeQuestions");
    expect(seedQuestions).toContain("knowledgeQuestions");
    expect(knowledgeQuestions).toContain('"sport": "knowledge"');
    expect(knowledgeQuestions).toContain('"difficulty": "easy"');
    expect(knowledgeQuestions).toContain('"difficulty": "intermediate"');
    expect(knowledgeQuestions).toContain('"difficulty": "hard"');
    expect(knowledgeQuestions.match(/knowledge_v1_/g)?.length).toBeGreaterThanOrEqual(60);
  });

  it("does not put every knowledge correct answer in the first option slot", () => {
    const questions = readKnowledgeSeed().filter((q) => !q.checksum.startsWith("knowledge_came_first_v1_"));
    const positionCounts = [0, 0, 0, 0];

    for (const question of questions) {
      const correctIndex = question.options.indexOf(question.correctAnswer);
      expect(correctIndex, question.checksum).toBeGreaterThanOrEqual(0);
      positionCounts[correctIndex] += 1;
    }

    expect(questions).toHaveLength(300);
    expect(positionCounts).toEqual([75, 75, 75, 75]);
  });

  it("exposes knowledge as a first-class quiz topic without routing survival into non-sport data", () => {
    const home = readFileSync("src/pages/HomeScreen.tsx", "utf8");
    const sportSelect = readFileSync("src/pages/SportSelectScreen.tsx", "utf8");
    const challenge = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");

    expect(home).toContain("Knowledge Mode");
    expect(home).toContain("/difficulty?sport=knowledge&mode=quiz");
    expect(sportSelect).toContain("knowledge:");
    expect(sportSelect).toContain("Pick a Topic");
    expect(sportSelect).toContain('isSurvivalMode\n      ? ["football", "tennis", "basketball"]');
    expect(challenge).toContain('"knowledge"');
    expect(challenge).toContain('selectedSport === "knowledge" ? ["quiz", "came_first"] : modePills');
  });

  it("uses Topic language on broad quiz surfaces while preserving sport as the internal key", () => {
    const sportSelect = readFileSync("src/pages/SportSelectScreen.tsx", "utf8");
    const challenge = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const result = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const dailyResult = readFileSync("src/pages/DailyResultScreen.tsx", "utf8");
    const blitzResult = readFileSync("src/pages/BlitzResultScreen.tsx", "utf8");
    const profile = readFileSync("src/pages/ProfileScreen.tsx", "utf8");

    expect(sportSelect).toContain("topicMeta");
    expect(sportSelect).toContain("availableTopics");
    expect(sportSelect).toContain("Pick a Topic");
    expect(challenge).toContain("topicPills");
    expect(challenge).toContain("Topic");
    expect(result).toContain('{ label: "Topic", value: state.sport');
    expect(dailyResult).toContain('{ label: "Topic", value: state.sport');
    expect(blitzResult).toContain('{ label: "Topic", value: state.sport');
    expect(profile).toContain('{ label: "Fav Topic"');

    // Keep existing Convex/API compatibility for now; this is a user-facing rename, not a schema migration.
    expect(sportSelect).toContain('navigate(`/difficulty?sport=${selected}&mode=${mode}`)');
    expect(challenge).toContain("sport: selectedSport");
  });
});
