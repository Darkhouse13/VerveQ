import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("live challenge image question cap", () => {
  it("caps every game at two image questions and applies the cap to live challenge selection", () => {
    const imageQuestions = readFileSync("convex/lib/imageQuestions.ts", "utf8");
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(imageQuestions).toContain("export const MAX_IMAGE_QUESTIONS = 2");
    expect(imageQuestions).toContain("selectQuestionsWithImageCap");
    expect(liveMatches).toContain("selectQuestionsWithImageCap");
    expect(liveMatches).toContain("selectQuestionsWithImageCap(");
  });
});
