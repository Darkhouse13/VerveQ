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

  it("makes the challenge result screen feel like a rivalry loop, not a generic replay", () => {
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");

    expect(resultScreen).toContain("Rivalry");
    expect(resultScreen).toContain("getChallengeAgainLabel");
    expect(resultScreen).toContain("Get Revenge");
    expect(resultScreen).toContain("Defend Your Win");
    expect(resultScreen).toContain("Run It Back");
    expect(resultScreen).toContain("Streak");
    expect(resultScreen).toContain("Last 5");
    expect(resultScreen).toContain("Best of 3?");
  });
});
