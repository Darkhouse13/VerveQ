import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge rivalries v1 contract", () => {
  it("returns streak and recent match history with the head-to-head summary", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");
    const types = readFileSync("src/types/api.ts", "utf8");
    const liveMatchScreen = readFileSync("src/pages/LiveMatchScreen.tsx", "utf8");

    expect(liveMatches).toContain("getRivalryDetails");
    expect(liveMatches).toContain("currentStreak");
    expect(liveMatches).toContain("recentMatches");
    expect(liveMatches).toContain("streakOwner");
    expect(liveMatches).toContain("challengeMatchHistory");

    expect(types).toContain("currentStreak?:");
    expect(types).toContain("recentMatches?:");
    expect(liveMatchScreen).toContain("currentStreak: match.versusSummary.currentStreak");
    expect(liveMatchScreen).toContain("recentMatches: match.versusSummary.recentMatches");
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
