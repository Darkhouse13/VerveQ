import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
    expect(challenge).toContain('selectedSport === "knowledge" ? ["quiz"] : modePills');
  });
});
