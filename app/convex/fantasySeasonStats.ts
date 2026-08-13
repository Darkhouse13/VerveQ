/**
 * Weekend Fantasy — current-season aggregate refresh (FW-SCOUT L3).
 *
 * The ONLY new write path FW-SCOUT adds: a weekly sweep of the eight covered
 * leagues' player-season aggregates (/players, the one paged endpoint) into
 * fantasyPlayerSeasonStats rows with source "api-refresh" — the player
 * detail sheet's "This season" block. It touches its own cache rows and the
 * fantasySeasonStatSweeps ledger, nothing else. Scoring, eligibility, locks
 * and pricing never read this table.
 *
 * Budget discipline (the FW-T1 shape):
 *  - a call plan prints BEFORE any request: phase 1 is exactly one page-1
 *    probe per league (8 calls), and the phase-2 continuation is planned
 *    from the probes' real paging totals, printed, and STOPPED above the
 *    ceiling before a single phase-2 request is made — pagination is never
 *    guessed at.
 *  - every run writes a fantasySeasonStatSweeps row: callsPlanned before
 *    spending, callsMade + counts + the provider's own dailyRemaining after.
 *
 * Honesty rules, mirrored from the L1 seed:
 *  - only players with in-scope minutes > 0 get a season line — a squad
 *    member who hasn't played yet stays ABSENT for the current season (the
 *    sheet keeps last season primary; below 180' it shows apps/minutes
 *    only — display policy, not storage policy);
 *  - feed players with no fantasyPlayers row are COUNTED (unknownPlayers)
 *    and skipped, never created — roster truth belongs to FW-T1;
 *  - csRate/gaPerMatch are null: this pull carries no club figures, and
 *    absence beats a fabricated zero.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ApiFootballClient,
  credentialsFromEnv,
  fetchLeaguePlayersPage,
  type FeedSeasonPlayerRow,
} from "./fantasyApiFootball";
import { LEAGUE_IDS } from "./lib/fantasyConstants";

/** API-Football season year for 2026-27 (the label the sheet renders). */
const API_SEASON = 2026;
const SEASON_LABEL = "2026-27";
/** Hard per-run ceiling — mission FW-SCOUT projected ~200-400; the sweep
 *  STOPS (spending nothing further) if the probes project past this. */
const SWEEP_CALL_CEILING = 500;
const UPSERT_CHUNK = 250;

/** Display names for the covered leagues (the L1 emitter's map, covered
 *  slice). A league outside it renders its id — degraded loudly. */
const LEAGUE_NAMES: Record<number, string> = {
  39: "Premier League",
  140: "La Liga",
  135: "Serie A",
  78: "Bundesliga",
  61: "Ligue 1",
  88: "Eredivisie",
  94: "Primeira Liga",
  40: "Championship",
};

function n(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export const listProviderIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const players = await ctx.db.query("fantasyPlayers").collect();
    return players.map((p) => p.providerPlayerId);
  },
});

export const startSweep = internalMutation({
  args: { kind: v.union(v.literal("manual"), v.literal("cron")), callsPlanned: v.number() },
  handler: async (ctx, args): Promise<Id<"fantasySeasonStatSweeps">> => {
    return await ctx.db.insert("fantasySeasonStatSweeps", {
      kind: args.kind,
      status: "running",
      season: SEASON_LABEL,
      startedAt: Date.now(),
      callsPlanned: args.callsPlanned,
    });
  },
});

/** Phase 1's probes turn the estimate into the real plan — recorded before
 *  phase 2 spends anything. */
export const updateSweepPlan = internalMutation({
  args: { sweepId: v.id("fantasySeasonStatSweeps"), callsPlanned: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sweepId, { callsPlanned: args.callsPlanned });
  },
});

const sweepCountsValidator = v.object({
  leaguesSwept: v.number(),
  pagesFetched: v.number(),
  playersSeen: v.number(),
  rowsUpserted: v.number(),
  rowsUnchanged: v.number(),
  unknownPlayers: v.number(),
});

export const finishSweep = internalMutation({
  args: {
    sweepId: v.id("fantasySeasonStatSweeps"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    callsMade: v.number(),
    dailyRemaining: v.union(v.number(), v.null()),
    counts: v.optional(sweepCountsValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sweepId, {
      status: args.status,
      finishedAt: Date.now(),
      callsMade: args.callsMade,
      dailyRemaining: args.dailyRemaining,
      ...(args.counts !== undefined ? { counts: args.counts } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
    });
  },
});

interface SeasonSum {
  minutes: number;
  apps: number;
  goals: number;
  assists: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  shotsOn: number;
  saves: number;
  leagueIds: Set<number>;
}

function addRow(sums: Map<number, SeasonSum>, row: FeedSeasonPlayerRow): void {
  const playerId = row.player?.id;
  if (typeof playerId !== "number") return;
  for (const s of row.statistics ?? []) {
    const leagueId = s.league?.id;
    if (typeof leagueId !== "number") continue;
    if (!(LEAGUE_IDS as readonly number[]).includes(leagueId)) continue;
    if (s.league?.season !== API_SEASON) continue;
    const sum = sums.get(playerId) ?? {
      minutes: 0, apps: 0, goals: 0, assists: 0, keyPasses: 0,
      tackles: 0, interceptions: 0, shotsOn: 0, saves: 0,
      leagueIds: new Set<number>(),
    };
    sum.minutes += n(s.games?.minutes);
    sum.apps += n(s.games?.appearences);
    sum.goals += n(s.goals?.total);
    sum.assists += n(s.goals?.assists);
    sum.saves += n(s.goals?.saves);
    sum.shotsOn += n(s.shots?.on);
    sum.keyPasses += n(s.passes?.key);
    sum.tackles += n(s.tackles?.total);
    sum.interceptions += n(s.tackles?.interceptions);
    sum.leagueIds.add(leagueId);
    sums.set(playerId, sum);
  }
}

/**
 * The sweep. Idempotent: applySeasonStats upserts by (player, season) and
 * counts content-identical rows unchanged, so a re-run after a mid-sweep
 * failure re-spends requests but re-writes nothing.
 */
export const refreshSeasonStats = internalAction({
  args: { kind: v.optional(v.union(v.literal("manual"), v.literal("cron"))) },
  handler: async (ctx, args) => {
    const kind = args.kind ?? "cron";
    const leagues = [...LEAGUE_IDS];

    // ── the call plan, printed before ANY pull ──
    console.log(
      `[FW-SCOUT call plan] ${kind}: phase 1 = ${leagues.length} league(s) × 1 page-1 probe of ` +
        `/players?season=${API_SEASON}; phase 2 = the probes' remaining pages, planned from real ` +
        `paging totals and stopped above the ${SWEEP_CALL_CEILING}-call ceiling before any phase-2 request.`,
    );

    const sweepId: Id<"fantasySeasonStatSweeps"> = await ctx.runMutation(
      internal.fantasySeasonStats.startSweep,
      { kind, callsPlanned: leagues.length },
    );

    const client = new ApiFootballClient(credentialsFromEnv());
    let callsMade = 0;

    try {
      // ── phase 1: one probe per league; real pagination, no guessing ──
      const sums = new Map<number, SeasonSum>();
      let playersSeen = 0;
      const remainingPages: { leagueId: number; page: number }[] = [];
      for (const leagueId of leagues) {
        const { rows, paging } = await fetchLeaguePlayersPage(client, leagueId, API_SEASON, 1);
        callsMade += 1;
        playersSeen += rows.length;
        for (const row of rows) addRow(sums, row);
        const totalPages = paging?.total ?? 1;
        for (let page = 2; page <= totalPages; page += 1) remainingPages.push({ leagueId, page });
        console.log(
          `[FW-SCOUT] league ${leagueId}: page 1/${totalPages}, ${rows.length} row(s)`,
        );
      }

      const fullPlan = leagues.length + remainingPages.length;
      console.log(
        `[FW-SCOUT call plan] exact: ${leagues.length} probe(s) + ${remainingPages.length} ` +
          `remaining page(s) = ${fullPlan} call(s) (ceiling ${SWEEP_CALL_CEILING})`,
      );
      await ctx.runMutation(internal.fantasySeasonStats.updateSweepPlan, {
        sweepId,
        callsPlanned: fullPlan,
      });
      if (fullPlan > SWEEP_CALL_CEILING) {
        throw new Error(
          `STOP: exact plan of ${fullPlan} calls exceeds the ${SWEEP_CALL_CEILING}-call ceiling. ` +
            `No phase-2 request was made.`,
        );
      }

      // ── phase 2: the rest of every league's pages ──
      for (const { leagueId, page } of remainingPages) {
        const { rows } = await fetchLeaguePlayersPage(client, leagueId, API_SEASON, page);
        callsMade += 1;
        playersSeen += rows.length;
        for (const row of rows) addRow(sums, row);
      }

      // ── fold into upserts: known players with in-scope minutes only ──
      const known = new Set<string>(
        await ctx.runQuery(internal.fantasySeasonStats.listProviderIds, {}),
      );
      const pulledAt = Date.now();
      let unknownPlayers = 0;
      const upserts = [];
      for (const [playerId, sum] of sums) {
        if (!known.has(String(playerId))) {
          unknownPlayers += 1;
          continue;
        }
        if (sum.minutes <= 0) continue; // absent, not zero — no line yet
        const leagueIds = [...sum.leagueIds].sort((a, b) => a - b);
        upserts.push({
          providerPlayerId: String(playerId),
          season: SEASON_LABEL,
          source: "api-refresh" as const,
          pulledAt,
          leagueIds,
          leagueLabel: leagueIds.map((id) => LEAGUE_NAMES[id] ?? `league ${id}`).join(" + "),
          line: {
            minutes: sum.minutes,
            apps: sum.apps,
            goals: sum.goals,
            assists: sum.assists,
            keyPasses: sum.keyPasses,
            tackles: sum.tackles,
            interceptions: sum.interceptions,
            shotsOn: sum.shotsOn,
            saves: sum.saves,
            csRate: null,
            gaPerMatch: null,
          },
        });
      }

      let rowsUpserted = 0;
      let rowsUnchanged = 0;
      for (let i = 0; i < upserts.length; i += UPSERT_CHUNK) {
        const result: { created: number; updated: number; unchanged: number; missing: string[] } =
          await ctx.runMutation(internal.fantasyIngest.applySeasonStats, {
            rows: upserts.slice(i, i + UPSERT_CHUNK),
          });
        rowsUpserted += result.created + result.updated;
        rowsUnchanged += result.unchanged;
      }

      const counts = {
        leaguesSwept: leagues.length,
        pagesFetched: callsMade,
        playersSeen,
        rowsUpserted,
        rowsUnchanged,
        unknownPlayers,
      };
      console.log(
        `[FW-SCOUT] sweep done: ${callsMade} call(s) (planned ${fullPlan}), ` +
          `${playersSeen} feed row(s), ${upserts.length} with minutes, ` +
          `${rowsUpserted} upserted + ${rowsUnchanged} unchanged, ` +
          `${unknownPlayers} unknown feed player(s) skipped, ` +
          `provider daily remaining ${client.dailyRemaining ?? "unknown"}`,
      );
      await ctx.runMutation(internal.fantasySeasonStats.finishSweep, {
        sweepId,
        status: "succeeded",
        callsMade,
        dailyRemaining: client.dailyRemaining,
        counts,
      });
      return counts;
    } catch (error) {
      await ctx.runMutation(internal.fantasySeasonStats.finishSweep, {
        sweepId,
        status: "failed",
        callsMade,
        dailyRemaining: client.dailyRemaining,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});
