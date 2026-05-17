import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge sender waiting room contract", () => {
  it("subscribes to the current user active match so the challenge sender follows accepted invites into the waiting room", () => {
    const source = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");

    expect(source).toContain("api.liveMatches.getActiveMatch");
    expect(source).toContain("activeMatchId");
    expect(source).toContain("/waiting-room?matchId=${activeMatchId}");
  });
});
