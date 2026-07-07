import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge rivalries v1 contract", () => {
  // The head-to-head/rivalry queries were removed with the dormant challenge
  // subsystem; getMatch keeps the versusSummary shape as an empty state so
  // legacy match views still render.
  // The liveMatches backend was purged 2026-07; the rivalry summary types
  // survive on the ResultScreen's historic challenge results.
  it("keeps the rivalry summary types the result surfaces still read", () => {
    const types = readFileSync("src/types/api.ts", "utf8");

    expect(types).toContain("currentStreak?:");
    expect(types).toContain("recentMatches?:");
  });

  it("keeps historical rivalry context on challenge results without re-surfacing live rematches", () => {
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    // i18n: the rivalry card labels moved to locale keys; verify both the key
    // wiring in source and that the English copy is intact.
    expect(resultScreen).toContain("result.rivalry");
    expect(screens.result.rivalry).toBe("Rivalry");
    expect(resultScreen).toContain("result.streakCardLabel");
    expect(screens.result.streakCardLabel).toBe("Streak");
    expect(resultScreen).toContain("result.lastFive");
    expect(screens.result.lastFive).toBe("Last 5");
    expect(resultScreen).not.toContain("getChallengeAgainLabel");
    expect(resultScreen).not.toContain("Get Revenge");
    expect(resultScreen).not.toContain("Defend Your Win");
    expect(resultScreen).not.toContain("Run It Back");
    expect(resultScreen).not.toContain("Best of 3?");
  });
});
