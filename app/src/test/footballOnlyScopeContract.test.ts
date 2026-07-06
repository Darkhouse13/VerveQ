import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COMPETE_MODE_TILES } from "@/pages/shell/competeModeTiles";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

/**
 * The live product is football-only, and the compete grid only advertises
 * modes a player can actually start. These contracts pin the scope decisions
 * from the launch QA loop.
 */
describe("football-only scope", () => {
  it("duel creation offers football only", () => {
    const modal = read("../pages/challenge/CreateDuelModal.tsx");
    expect(modal).not.toContain('key: "basketball"');
    expect(modal).not.toContain('key: "tennis"');
    expect(modal).not.toContain("Football · Basketball · Tennis");
  });

  it("the leaderboard sport filter has no dead sports", () => {
    const screen = read("../pages/LeaderboardScreen.tsx");
    expect(screen).toContain('sport: ["All", "Football"]');
    expect(screen).not.toContain("Tennis");
  });

  it("the shell profile hides the multi-sport achievement", () => {
    const screen = read("../pages/shell/ShellProfileScreen.tsx");
    expect(screen).toContain("multi_sport_athlete");
    expect(screen).toMatch(/filter\(\(a\) => a\.achievementId !== "multi_sport_athlete"\)/);
  });
});

describe("compete grid advertises only startable modes", () => {
  it("has no Live Match tile while matchmaking is parked", () => {
    expect(COMPETE_MODE_TILES.some((t) => t.key === "liveMatch")).toBe(false);
  });

  it("still offers the nine live modes", () => {
    expect(COMPETE_MODE_TILES.map((t) => t.key)).toEqual([
      "quiz",
      "arena",
      "duel",
      "survival",
      "blitz",
      "higherLower",
      "verveGrid",
      "careerPath",
      "daily",
    ]);
  });
});

describe("profile stat continuity", () => {
  it("the games tile reads lifetime plays in both account states", () => {
    const screen = read("../pages/shell/ShellProfileScreen.tsx");
    expect(screen).toContain("profile?.totalPlays");
    expect(screen).not.toMatch(/value: guest\s*\?\s*String\(user\?\.totalGames/);
  });
});
