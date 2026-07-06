import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Live-match question selection was removed with the dormant challenge
// subsystem; the shared cap helper remains the contract for the modes that
// still select questions (duels, daily, quiz, blitz, arena).
describe("image question cap", () => {
  it("caps every game at two image questions via the shared helper", () => {
    const imageQuestions = readFileSync("convex/lib/imageQuestions.ts", "utf8");
    const duels = readFileSync("convex/duels.ts", "utf8");

    expect(imageQuestions).toContain("export const MAX_IMAGE_QUESTIONS = 2");
    expect(imageQuestions).toContain("selectQuestionsWithImageCap");
    expect(duels).toContain("selectQuestionsWithImageCap(");
  });
});
