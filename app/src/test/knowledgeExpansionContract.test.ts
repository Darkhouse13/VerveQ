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
    const createDuel = readFileSync("src/pages/challenge/CreateDuelModal.tsx", "utf8");

    expect(home).toContain("Knowledge Mode");
    expect(home).toContain("/difficulty?sport=knowledge&mode=quiz");
    expect(sportSelect).toContain("knowledge:");
    expect(sportSelect).toContain("Pick a Topic");
    expect(sportSelect).toContain("const availableTopics = isFootballOnlyMode");
    expect(sportSelect).toContain("isSurvivalMode");
    expect(sportSelect).toContain('["football", "tennis", "basketball"]');
    expect(challenge).toContain("api.duels.listMine");
    expect(challenge).toContain("New Duel");
    expect(createDuel).toContain('type DuelKind = "knowledge" | "came_first" | "sports"');
    expect(createDuel).toContain('handleSelectKind("knowledge")');
    expect(createDuel).toContain('mode: kind === "came_first" ? "came_first" : "quiz"');
    expect(createDuel).toContain('type: "knowledge" as const');
    expect(createDuel).toContain("category: category ?? undefined");
  });

  it("uses Topic language on broad quiz surfaces while preserving sport as the internal key", () => {
    const sportSelect = readFileSync("src/pages/SportSelectScreen.tsx", "utf8");
    const challenge = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const createDuel = readFileSync("src/pages/challenge/CreateDuelModal.tsx", "utf8");
    const result = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const dailyResult = readFileSync("src/pages/DailyResultScreen.tsx", "utf8");
    const blitzResult = readFileSync("src/pages/BlitzResultScreen.tsx", "utf8");
    const profile = readFileSync("src/pages/ProfileScreen.tsx", "utf8");

    expect(sportSelect).toContain("topicMeta");
    expect(sportSelect).toContain("availableTopics");
    expect(sportSelect).toContain("Pick a Topic");
    expect(createDuel).toContain("KNOWLEDGE_CATEGORIES");
    expect(createDuel).toContain("Pick a category");
    expect(createDuel).toContain("formatCategoryLabel(c)");
    // The duel headline helpers moved to the shared lib so the Duels page and
    // the history page render categories identically.
    const duelLib = readFileSync("src/lib/duel.ts", "utf8");
    expect(challenge).toContain("duelSummaryHeadline(d)");
    expect(duelLib).toContain("formatCategoryLabel(s.category)");
    expect(challenge).toContain("formatModeLabel(d.mode)");
    expect(result).toContain('{ label: "Topic", value: state.sport');
    expect(dailyResult).toContain('{ label: "Topic", value: state.sport');
    expect(blitzResult).toContain('{ label: "Topic", value: state.sport');
    expect(profile).toContain('{ label: "Fav Topic"');

    // Keep existing Convex/API compatibility for now; this is a user-facing rename, not a schema migration.
    expect(sportSelect).toContain('navigate(`/difficulty?sport=${selected}&mode=${mode}`)');
    expect(createDuel).toContain("sport: sport ?? undefined");
  });
});
