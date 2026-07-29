/**
 * Weekend Fantasy — the scoring pipeline's DEV harness (FW-4).
 *
 * Exists for one job: the ticket's REGRESSION GATE. "Score a synthetic gameweek
 * through the live Convex path and assert the per-player totals equal the sim
 * harness's outputs for the same inputs. Same engine, two callers, identical
 * numbers." That needs real fixtures and real player rows for the real
 * `fantasyScores.applyFixtureStats` to write against, and the 2026-2027 season
 * on DEV does not kick off until 2026-08-15 — so the fixtures have to be made.
 *
 * Same posture as `fantasyDraftSim.ts`: internal-only, unreachable from any
 * client, and it drives the SHIPPED mutation rather than a copy of it. The
 * scoring itself is not simulated here at all — this module only seeds inputs and
 * reads rows back.
 *
 * ── Why this cannot touch real data ──
 *
 * Every identifier it writes is prefixed, and every prefix is CHECKED rather than
 * conventional:
 *
 *   season           "SYNTH-…"   (FW-2 produces "2026-2027"; it cannot collide)
 *   fixture id       "synth-…"   (the provider's are numeric strings)
 *   club id          "SYNTH-…"   (the provider's are numeric strings)
 *   player id        "synth-…"   (ditto)
 *
 * `assertSynthetic` refuses anything else, and `purgeSynthetic` will only ever
 * delete rows reachable from a season whose label starts with the prefix. A
 * synthetic player is written `active: false` with `price: null` on top of that,
 * so even if one leaked into a query it could not enter a draft pool or a budget
 * squad (FW-1 STOP-4 fails closed on a null price).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { fantasySlot } from "./schema";

export const SYNTHETIC_SEASON_PREFIX = "SYNTH-";
export const SYNTHETIC_ID_PREFIX = "synth-";
export const SYNTHETIC_CLUB_PREFIX = "SYNTH-";

/** A league id no provider uses, so a synthetic row can never join a real one. */
const SYNTHETIC_LEAGUE_ID = 0;

function assertSynthetic(label: string, value: string, prefix: string): void {
  if (!value.startsWith(prefix)) {
    throw new Error(
      `fantasyScoringDev refuses ${label} "${value}": it must start with "${prefix}" so this module can only ever touch data it created.`,
    );
  }
}

export interface SeedSyntheticFixtureResult {
  gameweekId: Id<"fantasyGameweeks">;
  fixtureId: Id<"fantasyFixtures">;
  gwNumber: number;
  playersCreated: number;
  playersReused: number;
}

/**
 * Create (or refresh) one synthetic FT fixture and its player universe.
 *
 * The fixture is written `status: "finished"` with a score, because that is the
 * only state the scoring pipeline reads (R2/R7) and this harness has no business
 * pretending to be a live match.
 */
export const seedSyntheticFixture = internalMutation({
  args: {
    season: v.string(),
    gwNumber: v.number(),
    /** The gameweek's finality instant. FW-2 derives real ones; a synthetic
     *  gameweek states its own so a test can put the cut before or after now. */
    finalityAt: v.number(),
    providerFixtureId: v.string(),
    kickoffAt: v.number(),
    homeClubId: v.string(),
    awayClubId: v.string(),
    homeGoals: v.number(),
    awayGoals: v.number(),
    players: v.array(
      v.object({
        providerPlayerId: v.string(),
        name: v.string(),
        clubId: v.string(),
        feedPosition: fantasySlot,
      }),
    ),
  },
  handler: async (ctx, args): Promise<SeedSyntheticFixtureResult> => {
    assertSynthetic("season", args.season, SYNTHETIC_SEASON_PREFIX);
    assertSynthetic("fixture id", args.providerFixtureId, SYNTHETIC_ID_PREFIX);
    assertSynthetic("home club", args.homeClubId, SYNTHETIC_CLUB_PREFIX);
    assertSynthetic("away club", args.awayClubId, SYNTHETIC_CLUB_PREFIX);
    for (const player of args.players) {
      assertSynthetic("player id", player.providerPlayerId, SYNTHETIC_ID_PREFIX);
      assertSynthetic("player club", player.clubId, SYNTHETIC_CLUB_PREFIX);
    }

    let gameweek = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) =>
        q.eq("season", args.season).eq("gwNumber", args.gwNumber),
      )
      .first();
    if (gameweek === null) {
      const gameweekId = await ctx.db.insert("fantasyGameweeks", {
        season: args.season,
        gwNumber: args.gwNumber,
        leagueIds: [SYNTHETIC_LEAGUE_ID],
        status: "upcoming",
        finalityAt: args.finalityAt,
      });
      gameweek = await ctx.db.get(gameweekId);
    } else if (gameweek.finalityAt !== args.finalityAt) {
      await ctx.db.patch(gameweek._id, { finalityAt: args.finalityAt });
      gameweek = await ctx.db.get(gameweek._id);
    }
    if (gameweek === null) throw new Error("synthetic gameweek vanished mid-transaction");

    const existingFixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) =>
        q.eq("providerFixtureId", args.providerFixtureId),
      )
      .first();

    const fixtureFields = {
      gameweekId: gameweek._id,
      leagueId: SYNTHETIC_LEAGUE_ID,
      kickoffAt: args.kickoffAt,
      status: "finished" as const,
      homeClubId: args.homeClubId,
      awayClubId: args.awayClubId,
      homeGoals: args.homeGoals,
      awayGoals: args.awayGoals,
    };

    let fixtureId: Id<"fantasyFixtures">;
    if (existingFixture === null) {
      fixtureId = await ctx.db.insert("fantasyFixtures", {
        providerFixtureId: args.providerFixtureId,
        ...fixtureFields,
      });
    } else {
      fixtureId = existingFixture._id;
      await ctx.db.patch(fixtureId, fixtureFields);
    }

    let playersCreated = 0;
    let playersReused = 0;
    for (const player of args.players) {
      const existing = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", player.providerPlayerId),
        )
        .first();
      if (existing !== null) {
        playersReused += 1;
        continue;
      }
      await ctx.db.insert("fantasyPlayers", {
        providerPlayerId: player.providerPlayerId,
        name: player.name,
        clubId: player.clubId,
        leagueId: SYNTHETIC_LEAGUE_ID,
        feedPosition: player.feedPosition,
        // Unpriced and inactive: a synthetic row must not be selectable anywhere.
        price: null,
        active: false,
      });
      playersCreated += 1;
    }

    return {
      gameweekId: gameweek._id,
      fixtureId,
      gwNumber: gameweek.gwNumber,
      playersCreated,
      playersReused,
    };
  },
});

/** Move a synthetic gameweek's finality instant — the finalization gate's clock. */
export const setSyntheticFinality = internalMutation({
  args: { season: v.string(), gwNumber: v.number(), finalityAt: v.number() },
  handler: async (ctx, args) => {
    assertSynthetic("season", args.season, SYNTHETIC_SEASON_PREFIX);
    const gameweek = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) =>
        q.eq("season", args.season).eq("gwNumber", args.gwNumber),
      )
      .first();
    if (gameweek === null) throw new Error(`No synthetic gameweek ${args.season}/${args.gwNumber}.`);
    await ctx.db.patch(gameweek._id, { finalityAt: args.finalityAt });
    return { gameweekId: gameweek._id, finalityAt: args.finalityAt };
  },
});

export interface SyntheticScoreRow {
  providerPlayerId: string;
  version: number;
  state: string;
  crowdFactor: number;
  verdictPosition: string | null;
  statHash: string;
  rawRevision: number;
  revisedFrom: number | null;
  supersededByVersion: number | null;
  specVersion: string;
  baseScores: Doc<"fantasyPlayerScores">["baseScores"];
}

/**
 * Every score row of a synthetic gameweek, newest version first per player.
 *
 * Returns ALL versions, not just the current one: the revision demonstration has
 * to show that the prior number is still readable (R4), and a reader that could
 * only see the current version could not prove it.
 */
export const syntheticScoreRows = internalQuery({
  args: { season: v.string(), gwNumber: v.number() },
  handler: async (ctx, args): Promise<SyntheticScoreRow[]> => {
    assertSynthetic("season", args.season, SYNTHETIC_SEASON_PREFIX);
    const gameweek = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) =>
        q.eq("season", args.season).eq("gwNumber", args.gwNumber),
      )
      .first();
    if (gameweek === null) return [];

    const rows = await ctx.db
      .query("fantasyPlayerScores")
      .withIndex("by_gameweek_state", (q) => q.eq("gameweekId", gameweek._id))
      .collect();

    return rows
      .sort(
        (a, b) =>
          (a.providerPlayerId < b.providerPlayerId
            ? -1
            : a.providerPlayerId > b.providerPlayerId
              ? 1
              : 0) || b.version - a.version,
      )
      .map((row) => ({
        providerPlayerId: row.providerPlayerId,
        version: row.version,
        state: row.state,
        crowdFactor: row.crowdFactor,
        verdictPosition: row.verdictPosition,
        statHash: row.statHash,
        rawRevision: row.rawRevision,
        revisedFrom: row.revisedFrom ?? null,
        supersededByVersion: row.supersededByVersion ?? null,
        specVersion: row.specVersion,
        baseScores: row.baseScores,
      }));
  },
});

/** The pipeline's own status rows for a synthetic gameweek. */
export const syntheticStatus = internalQuery({
  args: { season: v.string(), gwNumber: v.number() },
  handler: async (ctx, args) => {
    assertSynthetic("season", args.season, SYNTHETIC_SEASON_PREFIX);
    const gameweek = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) =>
        q.eq("season", args.season).eq("gwNumber", args.gwNumber),
      )
      .first();
    if (gameweek === null) return null;

    const gwScoring = await ctx.db
      .query("fantasyGameweekScoring")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
      .first();
    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    const fixtureScoring = [];
    for (const fixture of fixtures) {
      const row = await ctx.db
        .query("fantasyFixtureScoring")
        .withIndex("by_fixture", (q) => q.eq("fixtureId", fixture._id))
        .first();
      fixtureScoring.push({
        providerFixtureId: fixture.providerFixtureId,
        fixtureStatus: fixture.status,
        state: row?.state ?? null,
        fixtureInputHash: row?.fixtureInputHash ?? null,
        playerRows: row?.playerRows ?? 0,
        revisions: row?.revisions ?? 0,
        revisionChecks: row?.revisionChecks ?? 0,
        postFinalityRevisions: row?.postFinalityRevisions ?? 0,
        notScoredReason: row?.notScoredReason ?? null,
      });
    }

    const rawRows = await ctx.db
      .query("fantasyFixtureStats")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
      .collect();

    return {
      gameweek: {
        gameweekId: gameweek._id,
        season: gameweek.season,
        gwNumber: gameweek.gwNumber,
        status: gameweek.status,
        finalityAt: gameweek.finalityAt,
      },
      gameweekScoring:
        gwScoring === null
          ? null
          : {
              state: gwScoring.state,
              fixturesTotal: gwScoring.fixturesTotal,
              fixturesScored: gwScoring.fixturesScored,
              finalizedAt: gwScoring.finalizedAt ?? null,
              scoreRowsFinalized: gwScoring.scoreRowsFinalized ?? null,
              unscoredAlertAt: gwScoring.unscoredAlertAt ?? null,
              unscoredAlertCount: gwScoring.unscoredAlertCount ?? null,
              unscoredAlertFixtures: gwScoring.unscoredAlertFixtures ?? null,
            },
      fixtures: fixtureScoring,
      rawRows: rawRows.length,
      rawRevisionsByPlayer: Object.fromEntries(
        [...new Set(rawRows.map((r) => r.providerPlayerId))].sort().map((id) => [
          id,
          rawRows.filter((r) => r.providerPlayerId === id).length,
        ]),
      ),
    };
  },
});

export interface PurgeSyntheticResult {
  seasons: string[];
  gameweeks: number;
  fixtures: number;
  rawRows: number;
  scoreRows: number;
  fixtureScoringRows: number;
  gameweekScoringRows: number;
  players: number;
}

/**
 * Delete everything a synthetic season created. Ordered child-first so nothing
 * is ever left pointing at a deleted row.
 */
export const purgeSynthetic = internalMutation({
  args: { season: v.string() },
  handler: async (ctx, args): Promise<PurgeSyntheticResult> => {
    assertSynthetic("season", args.season, SYNTHETIC_SEASON_PREFIX);

    const gameweeks = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) => q.eq("season", args.season))
      .collect();

    const result: PurgeSyntheticResult = {
      seasons: [args.season],
      gameweeks: 0,
      fixtures: 0,
      rawRows: 0,
      scoreRows: 0,
      fixtureScoringRows: 0,
      gameweekScoringRows: 0,
      players: 0,
    };

    for (const gameweek of gameweeks) {
      const raw = await ctx.db
        .query("fantasyFixtureStats")
        .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
        .collect();
      for (const row of raw) {
        await ctx.db.delete(row._id);
        result.rawRows += 1;
      }

      const scores = await ctx.db
        .query("fantasyPlayerScores")
        .withIndex("by_gameweek_state", (q) => q.eq("gameweekId", gameweek._id))
        .collect();
      for (const row of scores) {
        await ctx.db.delete(row._id);
        result.scoreRows += 1;
      }

      const fixtures = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
        .collect();
      for (const fixture of fixtures) {
        const scoring = await ctx.db
          .query("fantasyFixtureScoring")
          .withIndex("by_fixture", (q) => q.eq("fixtureId", fixture._id))
          .first();
        if (scoring !== null) {
          await ctx.db.delete(scoring._id);
          result.fixtureScoringRows += 1;
        }
        await ctx.db.delete(fixture._id);
        result.fixtures += 1;
      }

      const gwScoring = await ctx.db
        .query("fantasyGameweekScoring")
        .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
        .first();
      if (gwScoring !== null) {
        await ctx.db.delete(gwScoring._id);
        result.gameweekScoringRows += 1;
      }

      await ctx.db.delete(gameweek._id);
      result.gameweeks += 1;
    }

    // Synthetic players are identified by their club prefix, which is checked on
    // the way in — so this can only ever match rows this module inserted.
    const players = await ctx.db.query("fantasyPlayers").collect();
    for (const player of players) {
      if (!player.providerPlayerId.startsWith(SYNTHETIC_ID_PREFIX)) continue;
      if (!player.clubId.startsWith(SYNTHETIC_CLUB_PREFIX)) continue;
      await ctx.db.delete(player._id);
      result.players += 1;
    }

    return result;
  },
});
