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

    // knowledge_v1_005 and knowledge_v1_240 (both position-3 answers) were
    // removed as exact duplicates of challenge_arena_capitals_v1 rows.
    expect(questions).toHaveLength(298);
    expect(positionCounts).toEqual([75, 75, 75, 73]);
  });

  it("exposes knowledge as a first-class quiz topic without routing survival into non-sport data", () => {
    const tiles = readFileSync("src/pages/shell/competeModeTiles.ts", "utf8");
    const challenge = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const createDuel = readFileSync("src/pages/challenge/CreateDuelModal.tsx", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    expect(tiles).toContain("/difficulty?sport=knowledge&mode=quiz");
    expect(challenge).toContain("api.duels.listMine");
    // i18n: the "New Duel" CTA moved to a locale key; verify both the key
    // wiring in source and that the English copy is intact.
    expect(challenge).toContain("challenge.newDuel");
    expect(screens.challenge.newDuel).toBe("New duel");
    expect(createDuel).toContain('type DuelKind = "knowledge" | "came_first" | "sports"');
    expect(createDuel).toContain('handleSelectKind("knowledge")');
    expect(createDuel).toContain('mode: kind === "came_first" ? "came_first" : "quiz"');
    expect(createDuel).toContain('type: "knowledge" as const');
    expect(createDuel).toContain("category: category ?? undefined");
  });

  it("uses Topic language on broad quiz surfaces while preserving sport as the internal key", () => {
    const challenge = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const createDuel = readFileSync("src/pages/challenge/CreateDuelModal.tsx", "utf8");
    const results = readFileSync("src/components/shell/play/result/ModeResults.tsx", "utf8");
    const play = JSON.parse(readFileSync("src/i18n/locales/en/play.json", "utf8"));
    const profile = readFileSync("src/pages/shell/ShellProfileScreen.tsx", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    expect(createDuel).toContain("KNOWLEDGE_CATEGORIES");
    expect(createDuel).toContain("createDuel.headerPickCategory");
    expect(screens.createDuel.headerPickCategory).toBe("Pick a category");
    expect(createDuel).toContain("formatCategoryLabel(c)");
    // The duel headline helpers moved to the shared lib so the Duels page and
    // the history page render categories identically.
    const duelLib = readFileSync("src/lib/duel.ts", "utf8");
    expect(challenge).toContain("duelSummaryHeadline(d, t)");
    expect(duelLib).toContain("formatCategoryLabel(s.category)");
    expect(challenge).toContain("formatModeLabel(d.mode, t)");
    // i18n: the "Topic" stat labels on the result surfaces moved to locale keys.
    // The "Topic" wording IS the contract here, so assert the en-locale VALUE
    // says "Topic" (not Sport) and that the internal sport key is still the value.
    // Since VerveQ ONE P3.1 every solo result shows it in its details rows,
    // from the internal sport key.
    expect(results.match(/\[t\("result\.stat\.topic"\), topicLabel\(result\.sport\)\]/g)?.length).toBe(4);
    expect(play.result.stat.topic).toBe("Topic");
    expect(profile).toContain('t("profile.stats.favTopic")');

    // Keep existing Convex/API compatibility for now; this is a user-facing rename, not a schema migration.
    expect(createDuel).toContain("sport: sport ?? undefined");
  });
});
