import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge recent opponents contract", () => {
  it("exposes previous challenge opponents for both sides so users do not retype usernames", () => {
    const schema = readFileSync("convex/schema.ts", "utf8");
    const challenges = readFileSync("convex/challenges.ts", "utf8");

    expect(schema).toContain('index("by_challenger"');
    expect(schema).toContain('index("by_challenged"');
    expect(challenges).toContain("getRecentOpponents");
    expect(challenges).toContain('query("challengeHeadToHeads")');
    expect(challenges).toContain('query("challenges")');
    expect(challenges).toContain("lastSport");
    expect(challenges).toContain("versusSummary");
  });

  it("renders recent opponent buttons on the challenge screen that prefill the username", () => {
    const challengeScreen = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");

    expect(challengeScreen).toContain("api.challenges.getRecentOpponents");
    expect(challengeScreen).toContain("recentOpponents");
    expect(challengeScreen).toContain("Recent Opponents");
    expect(challengeScreen).toContain("setUsername(opponent.username)");
    expect(challengeScreen).toContain("setSelectedSport(opponent.lastSport)");
    expect(challengeScreen).toContain("setSelectedMode(opponent.lastMode)");
  });
});
