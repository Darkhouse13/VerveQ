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
    const classic = read("src/pages/shell/play/CareerPathClassicGame.tsx");
    const ladder = read("src/pages/shell/play/CareerPathLadderGame.tsx");
    const source = [classic, ladder].join("\n");

    expect(source).toContain('t("careerPath.checking")');
    expect(classic).toContain("submitting");
    expect(ladder).toContain('pendingAction === "guess"');
  });

  it("Survival help action shows immediate loading feedback while the ladder mutation is in flight", () => {
    const source = read("src/pages/SurvivalScreen.tsx");

    expect(source).toContain("helpLoading");
    expect(source).toContain("Getting Help...");
  });
});
