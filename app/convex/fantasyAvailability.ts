/**
 * Weekend Fantasy — availability refresh (FW-AVAIL).
 *
 * Reads API-Football's `/injuries` for the leagues playing in the OPEN
 * gameweek and records, per player, whether the feed expects him to miss the
 * weekend or merely doubts him. One request per playing league per sweep —
 * at most eight, hourly, ~192/day against the Pro key's 7,500.
 *
 * ── What it writes, and what it refuses to write ──
 *
 * `fantasyPlayerAvailability` rows, scoped to the open gameweek, plus one
 * `fantasyAvailabilityCoverage` row per league saying whether that league
 * reported at all. Nothing else. No price moves, no squad edits, no player
 * creation: a feed row naming somebody our universe does not carry is COUNTED
 * and dropped, the same fail-closed rule `applyPrices` follows, because a
 * player invented from an injury report would arrive with no club, no price
 * and no position.
 *
 * ── Why a failed league keeps its old rows ──
 *
 * Each league is swept independently and a thrown request is caught per
 * league. On failure the league's coverage row records the error and its
 * availability rows are left exactly as they were. The alternative — treating
 * a refused request as an empty response — would silently clear every flag in
 * that league and tell managers their injured players had recovered. A stale
 * flag is recoverable; a fabricated all-clear is not.
 *
 * ── Why the whole thing is inert ──
 *
 * No validator, lock or scoring path reads either table. See the schema
 * comment on `fantasyPlayerAvailability`: this is a report the surfaces
 * render, and the manager decides what to do about it.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { DatabaseWriter } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  ApiFootballClient,
  credentialsFromEnv,
  fetchLeagueInjuries,
} from "./fantasyApiFootball";
import { CURRENT_API_SEASON } from "./fantasyIngest";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { collapseForGameweek } from "./lib/fantasyAvailabilityRules";

/**
 * The wire shape between `refreshAvailability` (action) and
 * `applyLeagueAvailability` (mutation).
 *
 * Exported so a test can pin it against `AvailabilityRecord`. Convex rejects an
 * argument object carrying a field the validator does not declare, and the two
 * shapes drifting apart is a failure that TypeScript cannot see — the action
 * passes its records through `ctx.runMutation`, whose args are validated at
 * RUNTIME. The first prod sweep failed exactly this way.
 */
export const availabilityRecordValidator = v.object({
  providerPlayerId: v.string(),
  providerFixtureId: v.string(),
  status: v.union(v.literal("out"), v.literal("doubtful")),
  category: v.union(v.literal("injury"), v.literal("suspension"), v.literal("other")),
  reason: v.union(v.string(), v.null()),
  rawType: v.string(),
});

export interface AvailabilityScope {
  gameweekId: Id<"fantasyGameweeks">;
  gwNumber: number;
  /** Leagues with at least one playable fixture in the window. */
  leagueIds: number[];
  /** Provider fixture ids for the window, in kickoff order. */
  fixtureIds: string[];
}

/**
 * What this sweep is allowed to touch: the open gameweek, the leagues that
 * actually play in it, and that window's fixture ids.
 *
 * Postponed and cancelled fixtures are excluded — `getWeekendLeagues` draws
 * the same line, and an availability row bound to a match that will not be
 * played is noise on a card the manager cannot act on.
 */
export const availabilityScope = internalQuery({
  args: {},
  handler: async (ctx): Promise<AvailabilityScope | null> => {
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;

    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();

    const playable = fixtures.filter(
      (fixture) => fixture.status !== "postponed" && fixture.status !== "cancelled",
    );

    return {
      gameweekId: gameweek._id,
      gwNumber: gameweek.gwNumber,
      leagueIds: [...new Set(playable.map((fixture) => fixture.leagueId))].sort(
        (a, b) => a - b,
      ),
      fixtureIds: playable.map((fixture) => fixture.providerFixtureId),
    };
  },
});

export interface ApplyAvailabilityResult {
  created: number;
  updated: number;
  cleared: number;
  unresolved: number;
}

/**
 * Replace one league's availability rows for one gameweek.
 *
 * A full reconcile rather than an upsert-only pass: a player the feed has
 * stopped flagging is a player who is expected to play again, and the row has
 * to GO. That is why the caller must never hand this mutation an empty list
 * it did not actually receive from the provider — see the module header.
 *
 * Idempotent. Re-running with the same records writes nothing beyond
 * `updatedAt` on rows whose content genuinely changed.
 */
export const applyLeagueAvailability = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    leagueId: v.number(),
    records: v.array(availabilityRecordValidator),
    rowsInFeed: v.number(),
    unusable: v.number(),
  },
  handler: async (ctx, args): Promise<ApplyAvailabilityResult> => {
    const existing = await ctx.db
      .query("fantasyPlayerAvailability")
      .withIndex("by_gameweek_league", (q) =>
        q.eq("gameweekId", args.gameweekId).eq("leagueId", args.leagueId),
      )
      .collect();
    const byProviderId = new Map(existing.map((row) => [row.providerPlayerId, row]));

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let unresolved = 0;
    const seen = new Set<string>();

    for (const record of args.records) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", record.providerPlayerId),
        )
        .first();

      // Reported, never created. A player the universe does not carry cannot be
      // picked, so a flag on him would be a warning about nobody.
      if (player === null) {
        unresolved += 1;
        continue;
      }
      // The feed's league scoping and ours can disagree during a transfer
      // window. Ours wins: this mutation owns exactly one league's rows, and
      // writing a row under the wrong leagueId would leave it unreconciled
      // forever (the sweep for his real league would never see it).
      if (player.leagueId !== args.leagueId) {
        unresolved += 1;
        continue;
      }

      seen.add(record.providerPlayerId);
      const current = byProviderId.get(record.providerPlayerId);

      if (current === undefined) {
        await ctx.db.insert("fantasyPlayerAvailability", {
          gameweekId: args.gameweekId,
          playerId: player._id,
          providerPlayerId: record.providerPlayerId,
          clubId: player.clubId,
          leagueId: args.leagueId,
          providerFixtureId: record.providerFixtureId,
          status: record.status,
          category: record.category,
          reason: record.reason,
          rawType: record.rawType,
          updatedAt: now,
        });
        created += 1;
        continue;
      }

      const changed =
        current.playerId !== player._id ||
        current.clubId !== player.clubId ||
        current.providerFixtureId !== record.providerFixtureId ||
        current.status !== record.status ||
        current.category !== record.category ||
        current.reason !== record.reason ||
        current.rawType !== record.rawType;

      if (changed) {
        await ctx.db.patch(current._id, {
          playerId: player._id,
          clubId: player.clubId,
          providerFixtureId: record.providerFixtureId,
          status: record.status,
          category: record.category,
          reason: record.reason,
          rawType: record.rawType,
          updatedAt: now,
        });
        updated += 1;
      }
    }

    let cleared = 0;
    for (const row of existing) {
      if (seen.has(row.providerPlayerId)) continue;
      await ctx.db.delete(row._id);
      cleared += 1;
    }

    await writeCoverage(ctx.db, {
      gameweekId: args.gameweekId,
      leagueId: args.leagueId,
      rowsInFeed: args.rowsInFeed,
      rowsInGameweek: args.records.length,
      unresolved: unresolved + args.unusable,
      error: null,
      sweptAt: now,
    });

    return { created, updated, cleared, unresolved };
  },
});

/**
 * Record that a league's read FAILED.
 *
 * Separate from the apply path on purpose: it writes the coverage row and
 * nothing else, so the league's existing availability rows survive untouched.
 */
export const recordAvailabilityFailure = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    leagueId: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const previous = await ctx.db
      .query("fantasyPlayerAvailability")
      .withIndex("by_gameweek_league", (q) =>
        q.eq("gameweekId", args.gameweekId).eq("leagueId", args.leagueId),
      )
      .collect();

    await writeCoverage(ctx.db, {
      gameweekId: args.gameweekId,
      leagueId: args.leagueId,
      // The last known good counts are not knowable here; report what still
      // stands so the coverage row never claims a league went quiet.
      rowsInFeed: previous.length,
      rowsInGameweek: previous.length,
      unresolved: 0,
      error: args.error,
      sweptAt: Date.now(),
    });
    return null;
  },
});

interface CoverageFields {
  gameweekId: Id<"fantasyGameweeks">;
  leagueId: number;
  rowsInFeed: number;
  rowsInGameweek: number;
  unresolved: number;
  error: string | null;
  sweptAt: number;
}

/** Upsert one league's coverage row. Both write paths above end here. */
async function writeCoverage(db: DatabaseWriter, fields: CoverageFields): Promise<void> {
  const existing = await db
    .query("fantasyAvailabilityCoverage")
    .withIndex("by_gameweek_league", (q) =>
      q.eq("gameweekId", fields.gameweekId).eq("leagueId", fields.leagueId),
    )
    .first();
  if (existing === null) {
    await db.insert("fantasyAvailabilityCoverage", fields);
  } else {
    await db.patch(existing._id, fields);
  }
}

export interface RefreshAvailabilityResult {
  gwNumber: number | null;
  leaguesSwept: number;
  callsMade: number;
  created: number;
  updated: number;
  cleared: number;
  unresolved: number;
  noReport: number[];
  failed: { leagueId: number; error: string }[];
  dailyRemaining: number | null;
}

/**
 * The cron entry point. One request per playing league; failures are per
 * league and never abort the sweep.
 */
export const refreshAvailability = internalAction({
  args: {},
  handler: async (ctx): Promise<RefreshAvailabilityResult> => {
    const scope: AvailabilityScope | null = await ctx.runQuery(
      internal.fantasyAvailability.availabilityScope,
      {},
    );

    const empty: RefreshAvailabilityResult = {
      gwNumber: null,
      leaguesSwept: 0,
      callsMade: 0,
      created: 0,
      updated: 0,
      cleared: 0,
      unresolved: 0,
      noReport: [],
      failed: [],
      dailyRemaining: null,
    };
    if (scope === null || scope.leagueIds.length === 0) return empty;

    const client = new ApiFootballClient(credentialsFromEnv());
    const fixtureIds = new Set(scope.fixtureIds);

    let callsMade = 0;
    let created = 0;
    let updated = 0;
    let cleared = 0;
    let unresolved = 0;
    const noReport: number[] = [];
    const failed: { leagueId: number; error: string }[] = [];

    for (const leagueId of scope.leagueIds) {
      try {
        // Counted before the attempt, once. Counting it again in the catch
        // double-billed every failed league in the first prod run (13 calls
        // reported for 7 leagues).
        callsMade += 1;
        const rows = await fetchLeagueInjuries(client, leagueId, CURRENT_API_SEASON);

        const collapsed = collapseForGameweek(rows, fixtureIds);
        if (collapsed.inFeed === 0) noReport.push(leagueId);

        const result: ApplyAvailabilityResult = await ctx.runMutation(
          internal.fantasyAvailability.applyLeagueAvailability,
          {
            gameweekId: scope.gameweekId,
            leagueId,
            records: collapsed.records,
            rowsInFeed: collapsed.inFeed,
            unusable: collapsed.unusable,
          },
        );
        created += result.created;
        updated += result.updated;
        cleared += result.cleared;
        unresolved += result.unresolved;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ leagueId, error: message });
        await ctx.runMutation(internal.fantasyAvailability.recordAvailabilityFailure, {
          gameweekId: scope.gameweekId,
          leagueId,
          error: message,
        });
      }
    }

    return {
      gwNumber: scope.gwNumber,
      leaguesSwept: scope.leagueIds.length,
      callsMade,
      created,
      updated,
      cleared,
      unresolved,
      noReport,
      failed,
      dailyRemaining: client.dailyRemaining,
    };
  },
});
