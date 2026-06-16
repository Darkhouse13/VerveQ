import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("async duel image question cap", () => {
  it("caps every duel at two image questions regardless of difficulty", () => {
    const imageQuestions = readFileSync("convex/lib/imageQuestions.ts", "utf8");
    const duels = readFileSync("convex/duels.ts", "utf8");

    expect(imageQuestions).toContain("export const MAX_IMAGE_QUESTIONS = 2");
    expect(imageQuestions).toContain("selectQuestionsWithImageCap");

    // Duel question selection must route through the shared cap rather than a
    // raw .slice(), otherwise a difficulty's pool could serve up to 10 images.
    expect(duels).toContain(
      'import { selectQuestionsWithImageCap } from "./lib/imageQuestions"',
    );
    expect(duels).toContain("selectQuestionsWithImageCap(");
    expect(duels).not.toContain(
      "seededShuffle(stable, args.seed).slice(0, TOTAL_DUEL_QUESTIONS)",
    );
  });
});
