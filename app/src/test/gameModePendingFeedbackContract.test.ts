import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("game mode pending feedback contract", () => {
  it("Higher or Lower shows immediate checking feedback after a guess click", () => {
    const source = read("src/pages/HigherLowerScreen.tsx");

    expect(source).toContain("Checking...");
    expect(source).toContain("pendingGuess");
  });

  it("Career Path shows immediate checking feedback while the guess mutation is in flight", () => {
    const source = read("src/pages/shell/play/CareerPathPlayScreen.tsx");

    expect(source).toContain('t("careerPath.checking")');
    expect(source).toContain("submitting");
  });

  it("Survival hint action shows immediate loading feedback while fetching a hint", () => {
    const source = read("src/pages/SurvivalScreen.tsx");

    expect(source).toContain("hintLoading");
    expect(source).toContain("Fetching Hint...");
  });
});
