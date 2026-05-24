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

    expect(resultScreen).toContain("Rivalry");
    expect(resultScreen).toContain("Streak");
    expect(resultScreen).toContain("Last 5");
    expect(resultScreen).not.toContain("getChallengeAgainLabel");
    expect(resultScreen).not.toContain("Get Revenge");
    expect(resultScreen).not.toContain("Defend Your Win");
    expect(resultScreen).not.toContain("Run It Back");
    expect(resultScreen).not.toContain("Best of 3?");
  });
});
