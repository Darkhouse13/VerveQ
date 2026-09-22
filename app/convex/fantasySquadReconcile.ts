/**
 * FW-T2 — squad-diff reconciler (2026-09-22).
 *
 * The transfer feed is the ledger of moves, but the provider's per-team
 * /transfers publishes late and incompletely: two weeks after the summer
 * window closed it still carried barely half the departures that ESPN and
 * Transfermarkt confirmed on 2026-09-05. /players/squads is the provider's
 * statement of who is AT each club today, so this pass reads it once per
 * covered club and turns the difference against our rows into transfer
 * events, applied through the same mutations the sweep uses (keyed
 * `squad:<day>:...`, so a day's pass is idempotent and every change is on
 * the ledger):
 *
 *  - ours active at A, feed lists him at covered club B  → internal move
 *  - ours active at A, feed lists him at no covered club  → outgoing
 *  - ours inactive / elsewhere, feed lists him at B       → internal (reactivates)
 *  - feed lists an id we never carried                    → incoming_new
 *    (position off the squad feed, so it never lands in the positionless lane)
 *
 * The squad feed is incomplete: measured 2026-09-22, it omitted players with
 * Serie A minutes for the club that season. So a departure the squad feed
 * implies is CHECKED against /players?id&season (one call per candidate)
 * before it is written: a season entry at his own club keeps him active; one
 * at a different covered club becomes the move; none at any covered club is
 * the departure. Keeping a player who did leave is the cheaper error — the
 * transfer feed still deactivates him when it catches up.
 *
 * Guards: a club whose squad read comes back empty is skipped whole — an
 * empty read is never treated as "everyone left" — and the run refuses to
 * apply when it would deactivate more than MAX_OUTGOING_FRACTION of the
 * active pool, which is the shape of a broken feed, not a transfer window.
 * Runs on the cron ONLY on the weekday before the weekend (see crons.ts).
 */
import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  ApiFootballClient,
  credentialsFromEnv,
  fetchPlayerSeason,
  fetchSquad,
} from "./fantasyApiFootball";
import { CURRENT_API_SEASON, mapFeedPosition } from "./fantasyIngest";
import { normalizePlayerName } from "./lib/fantasyPlayerName";

const CHUNK = 50;
const MAX_OUTGOING_FRACTION = 0.15;

type Position = "GK" | "DEF" | "MID" | "ATT";

interface OwnPlayer {
  providerPlayerId: string;
  name: string;
  clubId: string;
  active: boolean;
}

export const listPlayersForReconcile = internalQuery({
  args: {},
  handler: async (ctx): Promise<OwnPlayer[]> => {
    const rows = await ctx.db.query("fantasyPlayers").collect();
    return rows.map((p) => ({
      providerPlayerId: p.providerPlayerId,
      name: p.name,
      clubId: p.clubId,
      active: p.active,
    }));
  },
});

interface ReconcileEvent {
  providerTransferKey: string;
  providerPlayerId: string;
  playerName: string;
  transferDate: string;
  rawFromClubId: string | null;
  rawToClubId: string | null;
  fromCovered: boolean;
  toCovered: boolean;
  transferType: string | null;
  loan: boolean;
  classification: "internal" | "incoming_new" | "outgoing";
  toLeagueId?: number;
  toClubName: string | null;
  newPlayerPosition?: Position;
}

export interface ReconcileReport {
  day: string;
  dryRun: boolean;
  clubsRead: number;
  clubsSkippedEmpty: string[];
  callsMade: number;
  planned: {
    moves: number;
    outgoing: number;
    incomingNew: number;
    positionless: number;
    /** Squad-feed departures the season record contradicted — left active. */
    keptBySeason: number;
    /** Squad-feed departures the season record turned into covered moves. */
    movedBySeason: number;
  };
  applied: Record<string, number> | null;
  refused: string | null;
  sample: { moves: string[]; outgoing: string[]; incomingNew: string[] };
}

export const reconcileSquads = internalAction({
  args: { dryRun: v.optional(v.boolean()), clubLimit: v.optional(v.number()) },
  handler: async (ctx, { dryRun, clubLimit }): Promise<ReconcileReport> => {
    const day = new Date().toISOString().slice(0, 10);
    const context = await ctx.runQuery(internal.fantasyTransfers.getSweepContext, {});
    const clubs = clubLimit === undefined ? context.coveredClubs : context.coveredClubs.slice(0, clubLimit);
    const leagueByClub = new Map(context.coveredClubs.map((c) => [c.clubId, c.leagueId]));
    const ours: OwnPlayer[] = await ctx.runQuery(internal.fantasySquadReconcile.listPlayersForReconcile, {});
    const oursById = new Map(ours.map((p) => [p.providerPlayerId, p]));

    const client = new ApiFootballClient(credentialsFromEnv());
    const feedClubOf = new Map<string, { clubId: string; clubName: string; name: string; position: Position | null }>();
    const readClubs = new Set<string>();
    const skippedEmpty: string[] = [];
    let callsMade = 0;

    for (const club of clubs) {
      const squads = await fetchSquad(client, Number(club.clubId));
      callsMade += 1;
      const players = squads[0]?.players ?? [];
      if (players.length === 0) {
        skippedEmpty.push(club.clubId);
        continue;
      }
      readClubs.add(club.clubId);
      const clubName = squads[0]?.team.name ?? club.clubId;
      for (const sp of players) {
        feedClubOf.set(String(sp.id), {
          clubId: club.clubId,
          clubName,
          name: normalizePlayerName(sp.name),
          position: mapFeedPosition(sp.position),
        });
      }
    }

    const events: ReconcileEvent[] = [];
    let positionless = 0;
    const sample = { moves: [] as string[], outgoing: [] as string[], incomingNew: [] as string[] };

    // Feed side: everyone listed at a club we read.
    for (const [pid, at] of feedClubOf) {
      const own = oursById.get(pid);
      const toLeagueId = leagueByClub.get(at.clubId);
      if (own === undefined) {
        if (at.position === null) {
          positionless += 1;
          continue;
        }
        events.push({
          providerTransferKey: `squad:${day}:${pid}:new:${at.clubId}`,
          providerPlayerId: pid,
          playerName: at.name,
          transferDate: day,
          rawFromClubId: null,
          rawToClubId: at.clubId,
          fromCovered: false,
          toCovered: true,
          transferType: "squad reconcile: listed in club squad, not carried",
          loan: false,
          classification: "incoming_new",
          toLeagueId,
          toClubName: at.clubName,
          newPlayerPosition: at.position,
        });
        if (sample.incomingNew.length < 12) sample.incomingNew.push(`${at.name} @ ${at.clubName}`);
        continue;
      }
      if (own.active && own.clubId === at.clubId) continue;
      events.push({
        providerTransferKey: `squad:${day}:${pid}:${own.clubId}:${at.clubId}`,
        providerPlayerId: pid,
        playerName: own.name,
        transferDate: day,
        rawFromClubId: own.clubId,
        rawToClubId: at.clubId,
        fromCovered: leagueByClub.has(own.clubId),
        toCovered: true,
        transferType: own.active
          ? "squad reconcile: listed in another covered club's squad"
          : "squad reconcile: inactive row listed in a covered club's squad",
        loan: false,
        classification: "internal",
        toLeagueId,
        toClubName: at.clubName,
      });
      if (sample.moves.length < 12) sample.moves.push(`${own.name} ${own.clubId} -> ${at.clubName}`);
    }

    // Our side: active at a club we read, listed nowhere we read — verified
    // against his season record before anything is written.
    let keptBySeason = 0;
    let movedBySeason = 0;
    for (const own of ours) {
      if (!own.active || !readClubs.has(own.clubId)) continue;
      if (feedClubOf.has(own.providerPlayerId)) continue;

      const seasonRows = await fetchPlayerSeason(client, own.providerPlayerId, CURRENT_API_SEASON);
      callsMade += 1;
      const coveredTeams = new Set<string>();
      for (const row of seasonRows) {
        for (const stat of row.statistics ?? []) {
          const teamId = stat.team?.id;
          if (teamId !== null && teamId !== undefined && leagueByClub.has(String(teamId))) {
            coveredTeams.add(String(teamId));
          }
        }
      }
      if (coveredTeams.has(own.clubId)) {
        keptBySeason += 1;
        continue;
      }
      const [elsewhere] = [...coveredTeams];
      if (elsewhere !== undefined) {
        movedBySeason += 1;
        events.push({
          providerTransferKey: `squad:${day}:${own.providerPlayerId}:${own.clubId}:${elsewhere}`,
          providerPlayerId: own.providerPlayerId,
          playerName: own.name,
          transferDate: day,
          rawFromClubId: own.clubId,
          rawToClubId: elsewhere,
          fromCovered: true,
          toCovered: true,
          transferType: "squad reconcile: season record at another covered club",
          loan: false,
          classification: "internal",
          toLeagueId: leagueByClub.get(elsewhere),
          toClubName: null,
        });
        if (sample.moves.length < 12) sample.moves.push(`${own.name} ${own.clubId} -> ${elsewhere} (season record)`);
        continue;
      }
      events.push({
        providerTransferKey: `squad:${day}:${own.providerPlayerId}:${own.clubId}:out`,
        providerPlayerId: own.providerPlayerId,
        playerName: own.name,
        transferDate: day,
        rawFromClubId: own.clubId,
        rawToClubId: null,
        fromCovered: true,
        toCovered: false,
        transferType: "squad reconcile: no longer listed in any covered club's squad",
        loan: false,
        classification: "outgoing",
        toClubName: null,
      });
      if (sample.outgoing.length < 12) sample.outgoing.push(`${own.name} @ ${own.clubId}`);
    }

    const planned = {
      moves: events.filter((e) => e.classification === "internal").length,
      outgoing: events.filter((e) => e.classification === "outgoing").length,
      incomingNew: events.filter((e) => e.classification === "incoming_new").length,
      positionless,
      keptBySeason,
      movedBySeason,
    };
    const activeCount = ours.filter((p) => p.active).length;
    const refused =
      planned.outgoing > activeCount * MAX_OUTGOING_FRACTION
        ? `refused: ${planned.outgoing} deactivations exceed ${MAX_OUTGOING_FRACTION * 100}% of ${activeCount} active rows`
        : null;

    console.log(
      `[FW-T2] squad reconcile ${day}: ${readClubs.size} clubs read (${skippedEmpty.length} empty), ` +
        `${planned.moves} moves, ${planned.outgoing} outgoing, ${planned.incomingNew} new, ${positionless} positionless skipped` +
        (refused === null ? "" : ` — ${refused}`),
    );

    let applied: Record<string, number> | null = null;
    if (dryRun !== true && refused === null && events.length > 0) {
      const sweepId = await ctx.runMutation(internal.fantasyTransfers.startSweep, {
        kind: "cron",
        windowFromDay: day,
        callsPlanned: callsMade,
      });
      const counts: Record<string, number> = {};
      try {
        for (let i = 0; i < events.length; i += CHUNK) {
          const result = await ctx.runMutation(internal.fantasyTransfers.applyTransferChunk, {
            sweepId,
            events: events.slice(i, i + CHUNK),
          });
          for (const [k, n] of Object.entries(result.counts)) counts[k] = (counts[k] ?? 0) + n;
        }
        await ctx.runMutation(internal.fantasyTransfers.finishSweep, {
          sweepId,
          status: "succeeded",
          callsMade,
          dailyRemaining: client.dailyRemaining,
          counts: {
            internal: counts.internal ?? 0,
            incomingKnown: counts.incomingKnown ?? 0,
            incomingNew: counts.incomingNew ?? 0,
            outgoing: counts.outgoing ?? 0,
            unresolved: counts.unresolved ?? 0,
            alreadySeen: counts.alreadySeen ?? 0,
            superseded: counts.superseded ?? 0,
          },
        });
      } catch (cause) {
        await ctx.runMutation(internal.fantasyTransfers.finishSweep, {
          sweepId,
          status: "failed",
          callsMade,
          dailyRemaining: client.dailyRemaining,
          error: `squad reconcile: ${cause instanceof Error ? cause.message : String(cause)}`,
        });
        throw cause;
      }
      applied = counts;
    }

    return {
      day,
      dryRun: dryRun === true,
      clubsRead: readClubs.size,
      clubsSkippedEmpty: skippedEmpty,
      callsMade,
      planned,
      applied,
      refused,
      sample,
    };
  },
});
