/**
 * Weekend Fantasy FW-SCOUT — the player detail sheet's read surface.
 *
 * Runs the REAL convex/fantasyPlayerCard.ts query on top of the REAL squad
 * build path, the REAL scoring ingest and the REAL season-stats import
 * mutation, against the in-memory harness. Every expected number is
 * hand-computed from SCORING_SPEC v0.5.1 in the comment above its assertion
 * (the scoreSaturdayOne lines are lifted from fantasyScoringSquads.test.ts,
 * where each is derived).
 *
 * What FW-SCOUT's product law demands of this surface, asserted here:
 *  - no proxy/rating field is served, under any name;
 *  - a stat we do not hold is null/absent, never 0 (season line null for a
 *    flagged player, ownership hidden below the floor, empty history);
 *  - history derives via the ONE crowd-application rule at the player's
 *    verdict position as starter, provisional marked provisional.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FOUR_FOUR_TWO,
  SATURDAY,
  TWO_ATT_FINISHERS,
  handlerOf,
  seedWorld,
  type World,
} from "./support/fantasyFakeConvex";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({
    auth: {},
    signIn: () => {},
    signOut: () => {},
    store: {},
    isAuthenticated: () => false,
  }),
}));

import * as fantasySquads from "../../convex/fantasySquads";
import * as fantasyScores from "../../convex/fantasyScores";
import * as fantasyIngest from "../../convex/fantasyIngest";
import * as fantasyPlayerCard from "../../convex/fantasyPlayerCard";
import { emptyStats } from "../../convex/lib/fantasyScoring";

const createSquad = handlerOf(fantasySquads.createSquad);
const setSlot = handlerOf(fantasySquads.setSlot);
const applyFixtureStats = handlerOf(fantasyScores.applyFixtureStats);
const applySeasonStats = handlerOf(fantasyIngest.applySeasonStats);
const getPlayerCard = handlerOf(fantasyPlayerCard.getPlayerCard);

const THURSDAY = SATURDAY - 2 * 86_400_000;
const AFTER_SATURDAY = SATURDAY + 3 * 3_600_000;

let world: World;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(THURSDAY);
  world = await seedWorld();
  authMock.getAuthUserId.mockImplementation(async () => world.userId);
});

/** A full 4-4-2 (same sheet as fantasyScoringSquads.test.ts). */
const SHEET = [
  "SAT_A_1", "SAT_A_2", "SAT_A_3", "SAT_B_1", "SAT_B_2", "SAT_B_3",
  "SAT_C_1", "SAT_C_2", "SAT_C_3", "SAT_D_1", "SAT_D_2", "SAT_D_3", "SUN_A_1",
] as const;

async function buildSquad(): Promise<string> {
  const { squadId } = (await createSquad(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
    formation: FOUR_FOUR_TWO,
    finisherRoles: [...TWO_ATT_FINISHERS],
  })) as { squadId: string };
  for (const [slotIndex, handle] of SHEET.entries()) {
    await setSlot(world.ctx, { squadId, slotIndex, playerId: world.players[handle] });
  }
  return squadId;
}

/** SAT_A beats SAT_B 2-0; lines and hand-computed scores as in
 *  fantasyScoringSquads.test.ts scoreSaturdayOne. */
async function scoreSaturdayOne(): Promise<void> {
  const fixture = world.db.rows("fantasyFixtures").find((f) => f.providerFixtureId === "f-sat-1");
  await world.db.patch(fixture!._id as string, { status: "finished", homeGoals: 2, awayGoals: 0 });
  await applyFixtureStats(world.ctx, {
    providerFixtureId: "f-sat-1",
    hasPlayerStats: true,
    hasEvents: true,
    now: AFTER_SATURDAY,
    rows: [
      // GK, 90', 3 saves, 2-0 home win: 1 app + 1 win + 1.5 saves + 5 CS = 8.5
      {
        providerPlayerId: "SAT_A_1", clubId: "SAT_A", feedPosition: "GK",
        stats: emptyStats({ minutes: 90, saves: 3 }), events: [], entryMinute: null,
      },
      // DEF, did not appear: an honest stored 0
      {
        providerPlayerId: "SAT_A_3", clubId: "SAT_A", feedPosition: "DEF",
        stats: emptyStats({ minutes: 0 }), events: [], entryMinute: null,
      },
    ],
  });
}

const CARD_SEASON_ROW = {
  providerPlayerId: "SAT_A_1",
  season: "2025-26",
  source: "pricing-seed" as const,
  pulledAt: 1_700_000_000_000,
  leagueIds: [39],
  leagueLabel: "Premier League",
  line: {
    minutes: 2_700, apps: 30, goals: 0, assists: 1, keyPasses: 2,
    tackles: 5, interceptions: 3, shotsOn: 0, saves: 111,
    csRate: 0.4, gaPerMatch: 0.9,
  },
};

describe("FW-SCOUT — getPlayerCard", () => {
  it("serves identity + weekend matchup, and never a rating", async () => {
    const card = (await getPlayerCard(world.ctx, {
      playerId: world.players.SAT_A_1,
    })) as Record<string, unknown> & { weekend: Record<string, unknown> };

    expect(card.name).toBe("SAT_A_1");
    expect(card.position).toBe("GK");
    expect(card.price).toBe(5);
    // seedWorld writes no pool meta: pool honestly null, clubName degraded
    // to null (loudly absent, not invented).
    expect(card.pool).toBeNull();
    expect(card.clubName).toBeNull();
    expect(card.weekend).toMatchObject({
      gwNumber: 3,
      kickoffAt: SATURDAY,
      isHome: true,
      fixtureStatus: "scheduled",
      opponentName: null,
    });
    // Product law: no rating, rank or composite under any name.
    for (const key of Object.keys(card)) {
      expect(key).not.toMatch(/proxy|rank|rating|score(?!s)/i);
    }
  });

  it("serves the seeded season line and an honest null for a flagged player", async () => {
    await applySeasonStats(world.ctx, {
      rows: [
        CARD_SEASON_ROW,
        {
          providerPlayerId: "SAT_A_2",
          season: "2025-26",
          source: "pricing-seed" as const,
          pulledAt: 1_700_000_000_000,
          leagueIds: [],
          leagueLabel: "",
          line: null,
          partial: { minutes: 84, apps: 3 },
        },
      ],
    });

    const gk = (await getPlayerCard(world.ctx, { playerId: world.players.SAT_A_1 })) as {
      seasons: { season: string; leagueLabel: string; line: { saves: number } | null }[];
    };
    expect(gk.seasons).toHaveLength(1);
    expect(gk.seasons[0].leagueLabel).toBe("Premier League");
    expect(gk.seasons[0].line?.saves).toBe(111);

    const flagged = (await getPlayerCard(world.ctx, { playerId: world.players.SAT_A_2 })) as {
      seasons: { line: null; partial: { minutes: number; apps: number } | null }[];
    };
    expect(flagged.seasons).toHaveLength(1);
    expect(flagged.seasons[0].line).toBeNull();
    expect(flagged.seasons[0].partial).toEqual({ minutes: 84, apps: 3 });

    // No season row at all (a transfer arrival the seed never covered).
    const uncovered = (await getPlayerCard(world.ctx, { playerId: world.players.SUN_B_1 })) as {
      seasons: unknown[];
    };
    expect(uncovered.seasons).toEqual([]);
  });

  it("applySeasonStats is idempotent and reports unknown players, never creates them", async () => {
    const first = (await applySeasonStats(world.ctx, { rows: [CARD_SEASON_ROW] })) as Record<string, unknown>;
    expect(first).toMatchObject({ created: 1, updated: 0, unchanged: 0, missing: [] });
    const second = (await applySeasonStats(world.ctx, { rows: [CARD_SEASON_ROW] })) as Record<string, unknown>;
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 1, missing: [] });
    const ghost = (await applySeasonStats(world.ctx, {
      rows: [{ ...CARD_SEASON_ROW, providerPlayerId: "NOBODY_99" }],
    })) as { missing: string[] };
    expect(ghost.missing).toEqual(["NOBODY_99"]);
    expect(world.db.rows("fantasyPlayers").some((p) => p.providerPlayerId === "NOBODY_99")).toBe(false);
  });

  it("derives history at the verdict position, provisional marked, absence empty", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    // GK's 8.5 (hand-computed above) at crowdFactor 0, provisional until the
    // gameweek settles.
    const gk = (await getPlayerCard(world.ctx, { playerId: world.players.SAT_A_1 })) as {
      history: { gwNumber: number; points: number; state: string; crowdFactor: number | null; appearances: number }[];
    };
    expect(gk.history).toEqual([
      { gameweekId: world.gameweekId, season: "2026-2027", gwNumber: 3, points: 8.5, state: "provisional", crowdFactor: 0, appearances: 1 },
    ]);

    // Did-not-appear: a stored honest 0, not absence.
    const benched = (await getPlayerCard(world.ctx, { playerId: world.players.SAT_A_3 })) as {
      history: { points: number }[];
    };
    expect(benched.history).toHaveLength(1);
    expect(benched.history[0].points).toBe(0);

    // Unscored fixture: NO row — absence, never zero.
    const sunday = (await getPlayerCard(world.ctx, { playerId: world.players.SUN_A_1 })) as {
      history: unknown[];
    };
    expect(sunday.history).toEqual([]);
  });

  it("hides ownership below the floor and counts it above", async () => {
    await buildSquad();

    // One squad gameweek-wide: below the 10-squad floor — hidden, not 100%.
    const below = (await getPlayerCard(world.ctx, { playerId: world.players.SAT_A_1 })) as {
      ownership: { totalSquads: number; inSquads: number | null };
    };
    expect(below.ownership).toEqual({ totalSquads: 1, inSquads: null });

    // Nine stub squads (other users, no slots) lift the gameweek to the
    // floor; the player is in exactly the one real squad.
    for (let i = 0; i < 9; i += 1) {
      const userId = await world.db.insert("users", { username: `crowd_${i}` });
      await world.db.insert("fantasySquads", {
        userId,
        gameweekId: world.gameweekId,
        context: "budget",
        contextKey: "budget",
        favoriteClubAtBuild: null,
        createdAt: THURSDAY,
      });
    }
    const at = (await getPlayerCard(world.ctx, { playerId: world.players.SAT_A_1 })) as {
      ownership: { totalSquads: number; inSquads: number | null };
    };
    expect(at.ownership).toEqual({ totalSquads: 10, inSquads: 1 });

    const out = (await getPlayerCard(world.ctx, { playerId: world.players.SUN_B_1 })) as {
      ownership: { totalSquads: number; inSquads: number | null };
    };
    expect(out.ownership).toEqual({ totalSquads: 10, inSquads: 0 });
  });
});
