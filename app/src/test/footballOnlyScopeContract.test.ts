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

  it("still offers the ten live modes", () => {
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
      // Daily Survival shipped 2026-07: the shared one-attempt run.
      "dailySurvival",
    ]);
  });

  /**
   * The ranked set is the honesty contract behind the grid's sections: a mode
   * is `ranked` iff its finalizer writes ELO, and the screen derives RANKED vs
   * JUST-FOR-FUN from that flag alone.
   *
   * CR-1 added Survival. `convex/games.ts completeSurvival` asserts ranked
   * eligibility and writes `userRatings` with mode "survival", so filing it
   * under a "these don't affect your rank" sub-line was a false claim. Pinning
   * the exact set here means adding or removing a ranked mode is a deliberate
   * edit, not a silent side effect of touching the tile config.
   */
  it("marks exactly the ELO-writing modes as ranked", () => {
    expect(COMPETE_MODE_TILES.filter((t) => t.ranked).map((t) => t.key)).toEqual([
      "quiz",
      "survival",
    ]);
  });

  it("keeps Daily Survival casual — the server refuses to rank it", () => {
    // convex/games.ts rejects ranked completion for `dailyDate` runs, so the
    // shared daily run must never carry the ranked flag.
    const daily = COMPETE_MODE_TILES.find((t) => t.key === "dailySurvival");
    expect(daily?.ranked).toBeUndefined();
  });
});

describe("profile stat continuity", () => {
  it("the games tile reads lifetime plays in both account states", () => {
    const screen = read("../pages/shell/ShellProfileScreen.tsx");
    expect(screen).toContain("profile?.totalPlays");
    expect(screen).not.toMatch(/value: guest\s*\?\s*String\(user\?\.totalGames/);
  });
});
