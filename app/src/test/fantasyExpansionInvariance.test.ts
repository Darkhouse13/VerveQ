/**
 * FW-EXPAND R4 — the invariance assertion (owner ruling 2026-08-02).
 *
 * The universe expansion (5 → 8 leagues) changes SCOPE and nothing else.
 * This suite pins, with literal values, every constant the ruling names as
 * untouchable — budget, club cap + favorite exemption, squad shape, price
 * scale, scoring engine behaviour (probed, not copied), caps, crowd clamp,
 * court parameters, finality — so any drive-by "adjustment" riding an
 * expansion-era diff fails a test that names the ruling.
 *
 * The ONE deliberate change is pinned too: LEAGUE_IDS is exactly the eight.
 */

import { describe, expect, it } from "vitest";

import {
  CREW_MAX_DRAFTERS,
  CREW_MIN_DRAFTERS,
  FAVORITE_CLUB_COOLDOWN_DAYS,
  FINALITY_HOUR,
  FINALITY_MINUTE,
  FINALITY_TIME_ZONE,
  FINISHER_COUNT,
  FORMATION_BOUNDS,
  LEAGUE_IDS,
  PER_CLUB_CAP,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  SQUAD_BUDGET,
  SQUAD_SIZE,
  XI_SIZE,
} from "../../convex/lib/fantasyConstants";
import {
  CROWD_FACTOR_LIMIT,
  DEFAULT_CAPS,
  emptyStats,
  scorePlayer,
  type MatchContext,
  type Slot,
} from "../../convex/lib/fantasyScoring";
import {
  COURT_ENDORSEMENT_FLOOR,
  COURT_ENDORSEMENT_FRACTION,
  COURT_FILINGS_PER_GAMEWEEK,
  COURT_PASS_SHARE,
  COURT_QUORUM_FLOOR,
  COURT_QUORUM_FRACTION,
} from "../../convex/lib/fantasyCourtRules";

describe("FW-EXPAND R4 — the expansion changed no constant", () => {
  it("budget mode: 91.0 budget, 4.0-13.0 half-step scale", () => {
    expect(SQUAD_BUDGET).toBe(91.0);
    expect(PRICE_MIN).toBe(4.0);
    expect(PRICE_MAX).toBe(13.0);
    expect(PRICE_STEP).toBe(0.5);
  });

  it("club cap 3 with the favorite exemption's cooldown untouched", () => {
    expect(PER_CLUB_CAP).toBe(3);
    expect(FAVORITE_CLUB_COOLDOWN_DAYS).toBe(28);
  });

  it("squad shape: 13 = XI + 2 finishers, formation bounds", () => {
    expect(SQUAD_SIZE).toBe(13);
    expect(XI_SIZE).toBe(11);
    expect(FINISHER_COUNT).toBe(2);
    expect(FORMATION_BOUNDS).toEqual({
      GK: { min: 1, max: 1 },
      DEF: { min: 3, max: 5 },
      MID: { min: 2, max: 5 },
      ATT: { min: 1, max: 3 },
    });
    expect(CREW_MIN_DRAFTERS).toBe(2);
    expect(CREW_MAX_DRAFTERS).toBe(8);
  });

  it("finality: 23:59 Europe/Paris", () => {
    expect(FINALITY_TIME_ZONE).toBe("Europe/Paris");
    expect(FINALITY_HOUR).toBe(23);
    expect(FINALITY_MINUTE).toBe(59);
  });

  it("scoring caps and the crowd clamp", () => {
    expect(DEFAULT_CAPS).toEqual({
      gkSave: 4,
      defTackle: 3,
      defInterception: 3,
      defBlock: 2,
      midDefensive: 4,
      midKeyPass: 4,
      midDribble: 2,
      attShotOn: 2,
      attKeyPass: 4,
      attDribble: 3,
    });
    expect(CROWD_FACTOR_LIMIT).toBe(0.15);
  });

  it("court: filings, endorsement, quorum, pass share", () => {
    expect(COURT_FILINGS_PER_GAMEWEEK).toBe(2);
    expect(COURT_ENDORSEMENT_FLOOR).toBe(15);
    expect(COURT_ENDORSEMENT_FRACTION).toBe(0.005);
    expect(COURT_QUORUM_FLOOR).toBe(30);
    expect(COURT_QUORUM_FRACTION).toBe(0.01);
    expect(COURT_PASS_SHARE).toBe(0.6);
  });

  it("engine context values, probed per position (the proxy method's probes)", () => {
    const probe = (position: Slot) => {
      const bare = emptyStats({ minutes: 90 });
      const at = (context: MatchContext): number =>
        scorePlayer(
          { stats: bare, context, events: [] },
          { position, role: "starter" },
          position,
          null,
          0,
        ).points;
      const base = at({ teamGoalsFor: 0, teamGoalsAgainst: 1, result: "loss" });
      return {
        cleanSheet: at({ teamGoalsFor: 0, teamGoalsAgainst: 0, result: "loss" }) - base,
        win: at({ teamGoalsFor: 0, teamGoalsAgainst: 1, result: "win" }) - base,
        draw: at({ teamGoalsFor: 0, teamGoalsAgainst: 1, result: "draw" }) - base,
        concessionPer2: at({ teamGoalsFor: 0, teamGoalsAgainst: 2, result: "loss" }) - base,
      };
    };
    // The same measured values proxy.ts recovered on 2026-07-29 and
    // proxy-expansion.ts re-recovered on 2026-08-12 — the engine is league-
    // blind, so these hold for an Eredivisie fixture exactly as for La Liga.
    expect(probe("GK")).toEqual({ cleanSheet: 5, win: 1, draw: 0.5, concessionPer2: -1 });
    expect(probe("DEF")).toEqual({ cleanSheet: 4, win: 1, draw: 0.5, concessionPer2: -1 });
    expect(probe("MID")).toEqual({ cleanSheet: 1, win: 1, draw: 0.5, concessionPer2: 0 });
    expect(probe("ATT")).toEqual({ cleanSheet: 0, win: 1, draw: 0.5, concessionPer2: 0 });
  });

  it("the ONE deliberate change: the universe is exactly these eight leagues", () => {
    expect([...LEAGUE_IDS]).toEqual([39, 140, 135, 78, 61, 88, 94, 40]);
  });
});
