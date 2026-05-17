import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("game mode pending feedback contract", () => {
  it("Higher or Lower shows immediate checking feedback after a guess click", () => {
    const source = read("src/pages/HigherLowerScreen.tsx");

    expect(source).toContain("Checking...");
    expect(source).toContain("pendingGuess");
  });

  it("Who Am I shows immediate checking/revealing feedback while mutations are in flight", () => {
    const source = read("src/pages/WhoAmIScreen.tsx");

    expect(source).toContain("Checking...");
    expect(source).toContain("Revealing...");
  });

  it("Survival hint action shows immediate loading feedback while fetching a hint", () => {
    const source = read("src/pages/SurvivalScreen.tsx");

    expect(source).toContain("hintLoading");
    expect(source).toContain("Fetching Hint...");
  });
});
