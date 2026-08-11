/**
 * Weekend Fantasy — transfer ingestion: backfill + standing sweep (FW-T1).
 *
 * Keeps the players table's CLUB truth current through transfer windows. The
 * feed's /transfers endpoint is read per covered club, records are keyed by
 * provider identity (idempotent — a re-seen record is a no-op), and each one
 * classifies as exactly one of the ticket's five classes before anything is
 * written. Decisions live in lib/fantasyTransferRules (pure, unit-tested);
 * this file fetches, resolves and writes.
 *
 * ── What this pipeline will never do (owner rulings, 2026-08-01) ──
 *
 *  R1  Change a price. A transferred player keeps his price; a player CREATED
 *      here enters at PRICE_MIN with pool "flagged", and that is the only
 *      price this file ever writes.
 *  R2  Touch a squad. A transfer that leaves an existing squad over the club
 *      cap leaves the squad alone — the cap binds at mutation time only, and
 *      lib/fantasySquadRules grandfathers the pre-edit counts.
 *  R3  Guess. A record that cannot be resolved unambiguously is logged
 *      "unresolved" with a reason for owner review, and touches nothing.
 *
 * Actions fetch; mutations write (the FW-2 discipline). The call plan is
 * printed BEFORE any request, and a run that projects past SWEEP_CALL_CEILING
 * refuses to spend at all. Every run — backfill or cron — writes one
 * fantasyTransferSweeps row: the budget ledger and the cron's windowing state.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ApiFootballClient,
  credentialsFromEnv,
  fetchSquad,
  fetchTeamTransfers,
  type FeedTransferEntry,
} from "./fantasyApiFootball";
import { mapFeedPosition } from "./fantasyIngest";
import { PRICE_MIN } from "./lib/fantasyConstants";
import {
  classifyTransfer,
  collectCandidates,
  CRON_WINDOW_OVERLAP_DAYS,
  isLoanType,
  laterMoveAlreadyApplied,
  SWEEP_CALL_CEILING,
  TRANSFER_BACKFILL_START_DAY,
  transferKey,
  type TransferCandidate,
} from "./lib/fantasyTransferRules";

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` in UTC — the granularity the feed dates transfers at. */
function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** How many events one applyTransferChunk transaction carries. Each event is
 *  a handful of indexed reads plus at most three writes — 50 sits far inside
 *  the mutation budget (the FW-2 fixture chunk carries 150 heavier rows). */
const EVENT_CHUNK_SIZE = 50;

/** How many provider ids one resolvePlayers query looks up. */
const RESOLVE_CHUNK_SIZE = 150;

// ─────────────────────────────────────────────────────────────── result shapes
//
// Explicit on every action and mutation (FW-2 D10b): an action that spreads a
// same-module ctx.runMutation result into its return value forms a type cycle
// through _generated/api, and TypeScript resolves it by silently widening
// inference in unrelated files.

export interface SweepContext {
  /** clubId → leagueId for every covered club, off the season's fixtures. */
  coveredClubs: { clubId: string; leagueId: number }[];
  lastSuccess: { startedAt: number; windowFromDay: string } | null;
}

export interface ResolvedPlayer {
  providerPlayerId: string;
  known: boolean;
  active: boolean;
}

export interface TransferCounts {
  internal: number;
  incomingKnown: number;
  incomingNew: number;
  outgoing: number;
  unresolved: number;
  alreadySeen: number;
  superseded: number;
}

export interface UnresolvedRecord {
  providerTransferKey: string;
  providerPlayerId: string;
  playerName: string;
  transferDate: string;
  rawFromClubId: string | null;
  rawToClubId: string | null;
  reason: string;
}

export interface CreatedPlayerRecord {
  providerPlayerId: string;
  name: string;
  clubId: string;
  clubName: string | null;
  feedPosition: "GK" | "DEF" | "MID" | "ATT";
  price: number;
}

export interface ApplyTransferChunkResult {
  counts: TransferCounts;
  unresolved: UnresolvedRecord[];
  newPlayers: CreatedPlayerRecord[];
}

export interface TransferSweepReport {
  kind: "backfill" | "cron";
  windowFromDay: string;
  coveredClubs: number;
  callPlan: {
    baseCalls: number;
    squadLookupCalls: number;
    projected: number;
    ceiling: number;
  };
  callsMade: number;
  dailyRemaining: number | null;
  fetched: {
    entries: number;
    candidates: number;
    malformed: number;
    outOfScope: number;
    beforeWindow: number;
  };
  counts: TransferCounts;
  unresolved: UnresolvedRecord[];
  newPlayers: CreatedPlayerRecord[];
  /**
   * STOP-AND-REPORT surface: incoming NEW players whose position the feed did
   * not supply. They are NOT created (never defaulted — the FW-2 rule) and are
   * also present in `unresolved`; this list exists so the condition cannot be
   * missed in a long report.
   */
  positionless: { providerPlayerId: string; name: string; clubId: string }[];
  sweepId: Id<"fantasyTransferSweeps">;
}

// ─────────────────────────────────────────────────────────────────── read layer

/**
 * Everything a sweep decides its plan from, in one query: the covered-club
 * universe (derived from the season's fixture rows — the same 96 clubs FW-2
 * ingested, at zero request cost) and the latest successful sweep, which is
 * what the cron windows itself from.
 */
export const getSweepContext = internalQuery({
  args: {},
  handler: async (ctx): Promise<SweepContext> => {
    const fixtures = await ctx.db.query("fantasyFixtures").collect();
    const leagueByClub = new Map<string, number>();
    for (const fixture of fixtures) {
      leagueByClub.set(fixture.homeClubId, fixture.leagueId);
      leagueByClub.set(fixture.awayClubId, fixture.leagueId);
    }

    const lastSuccess = await ctx.db
      .query("fantasyTransferSweeps")
      .withIndex("by_status", (q) => q.eq("status", "succeeded"))
      .order("desc")
      .first();

    return {
      coveredClubs: [...leagueByClub.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([clubId, leagueId]) => ({ clubId, leagueId })),
      lastSuccess:
        lastSuccess === null
          ? null
          : { startedAt: lastSuccess.startedAt, windowFromDay: lastSuccess.windowFromDay },
    };
  },
});

/** Which of these provider ids exist in fantasyPlayers. Chunked by the caller. */
export const resolvePlayers = internalQuery({
  args: { providerPlayerIds: v.array(v.string()) },
  handler: async (ctx, { providerPlayerIds }): Promise<ResolvedPlayer[]> => {
    const out: ResolvedPlayer[] = [];
    for (const providerPlayerId of providerPlayerIds) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", providerPlayerId),
        )
        .first();
      out.push({
        providerPlayerId,
        known: player !== null,
        active: player?.active ?? false,
      });
    }
    return out;
  },
});

// ────────────────────────────────────────────────────────────────── write layer

export const startSweep = internalMutation({
  args: {
    kind: v.union(v.literal("backfill"), v.literal("cron")),
    windowFromDay: v.string(),
    callsPlanned: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"fantasyTransferSweeps">> => {
    return await ctx.db.insert("fantasyTransferSweeps", {
      kind: args.kind,
      status: "running",
      windowFromDay: args.windowFromDay,
      startedAt: Date.now(),
      callsPlanned: args.callsPlanned,
    });
  },
});

const countsValidator = v.object({
  internal: v.number(),
  incomingKnown: v.number(),
  incomingNew: v.number(),
  outgoing: v.number(),
  unresolved: v.number(),
  alreadySeen: v.number(),
  superseded: v.number(),
});

export const finishSweep = internalMutation({
  args: {
    sweepId: v.id("fantasyTransferSweeps"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    callsMade: v.number(),
    dailyRemaining: v.union(v.number(), v.null()),
    counts: v.optional(countsValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.sweepId, {
      status: args.status,
      finishedAt: Date.now(),
      callsMade: args.callsMade,
      dailyRemaining: args.dailyRemaining,
      ...(args.counts === undefined ? {} : { counts: args.counts }),
      ...(args.error === undefined ? {} : { error: args.error }),
    });
  },
});

const transferEventValidator = v.object({
  providerTransferKey: v.string(),
  providerPlayerId: v.string(),
  playerName: v.string(),
  transferDate: v.string(),
  rawFromClubId: v.union(v.string(), v.null()),
  rawToClubId: v.union(v.string(), v.null()),
  /** Computed by the action against the covered-club set it classified with —
   *  the mutation stores them verbatim rather than re-deriving. */
  fromCovered: v.boolean(),
  toCovered: v.boolean(),
  transferType: v.union(v.string(), v.null()),
  loan: v.boolean(),
  classification: v.union(
    v.literal("internal"),
    v.literal("incoming_known"),
    v.literal("incoming_new"),
    v.literal("outgoing"),
    v.literal("unresolved"),
  ),
  unresolvedReason: v.optional(v.string()),
  /** Destination league, present when the destination is covered. */
  toLeagueId: v.optional(v.number()),
  /** Destination display name off the feed — pool-meta's club label. */
  toClubName: v.union(v.string(), v.null()),
  /** Present exactly when classification is incoming_new. */
  newPlayerPosition: v.optional(
    v.union(v.literal("GK"), v.literal("DEF"), v.literal("MID"), v.literal("ATT")),
  ),
});

/**
 * Apply one chunk of classified transfer events. One transaction; every event
 * is (1) skipped whole if its provider key is already stored — the P1
 * idempotence — then (2) guarded against out-of-order application, then
 * (3) applied per its class, then (4) recorded.
 *
 * Ordering: the caller sends events in (date, key) order and chunks preserve
 * it, so a player's moves apply chronologically within and across chunks
 * (a mutation reads its own writes).
 */
export const applyTransferChunk = internalMutation({
  args: {
    sweepId: v.id("fantasyTransferSweeps"),
    events: v.array(transferEventValidator),
  },
  handler: async (ctx, { sweepId, events }): Promise<ApplyTransferChunkResult> => {
    const counts: TransferCounts = {
      internal: 0,
      incomingKnown: 0,
      incomingNew: 0,
      outgoing: 0,
      unresolved: 0,
      alreadySeen: 0,
      superseded: 0,
    };
    const unresolved: UnresolvedRecord[] = [];
    const newPlayers: CreatedPlayerRecord[] = [];
    const now = Date.now();

    for (const event of events) {
      const seen = await ctx.db
        .query("fantasyTransferEvents")
        .withIndex("by_key", (q) => q.eq("providerTransferKey", event.providerTransferKey))
        .first();
      if (seen !== null) {
        counts.alreadySeen += 1;
        continue;
      }

      const recordUnresolved = async (reason: string): Promise<void> => {
        counts.unresolved += 1;
        unresolved.push({
          providerTransferKey: event.providerTransferKey,
          providerPlayerId: event.providerPlayerId,
          playerName: event.playerName,
          transferDate: event.transferDate,
          rawFromClubId: event.rawFromClubId,
          rawToClubId: event.rawToClubId,
          reason,
        });
        await ctx.db.insert("fantasyTransferEvents", {
          providerTransferKey: event.providerTransferKey,
          providerPlayerId: event.providerPlayerId,
          playerName: event.playerName,
          transferDate: event.transferDate,
          rawFromClubId: event.rawFromClubId,
          rawToClubId: event.rawToClubId,
          fromCovered: event.fromCovered,
          toCovered: event.toCovered,
          transferType: event.transferType,
          loan: event.loan,
          classification: "unresolved",
          unresolvedReason: reason,
          processedAt: now,
          sweepId,
        });
      };

      if (event.classification === "unresolved") {
        await recordUnresolved(event.unresolvedReason ?? "unresolved");
        continue;
      }

      // Out-of-order guard: has a later-dated move for this player already
      // been APPLIED? (Unresolved and superseded rows never moved a club and
      // do not count.)
      const priorEvents = await ctx.db
        .query("fantasyTransferEvents")
        .withIndex("by_player_date", (q) =>
          q.eq("providerPlayerId", event.providerPlayerId),
        )
        .collect();
      const appliedDates = priorEvents
        .filter((e) => e.classification !== "unresolved" && e.superseded !== true)
        .map((e) => e.transferDate);
      const superseded = laterMoveAlreadyApplied(event.transferDate, appliedDates);

      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", event.providerPlayerId),
        )
        .first();

      let classification = event.classification;
      let playerId: Id<"fantasyPlayers"> | undefined = player?._id;

      if (!superseded) {
        switch (event.classification) {
          case "internal":
          case "incoming_known": {
            if (player === null) {
              // Classified against a snapshot that no longer holds. R3: never
              // guess a row into existence outside the incoming_new path,
              // which alone carries a feed-sourced position.
              await recordUnresolved(
                "player row not found at apply time (classified as known)",
              );
              continue;
            }
            if (event.rawToClubId === null || event.toLeagueId === undefined) {
              await recordUnresolved("covered destination lost between classify and apply");
              continue;
            }
            await ctx.db.patch(player._id, {
              clubId: event.rawToClubId,
              leagueId: event.toLeagueId,
              active: true,
              departedAt: undefined,
            });
            await refreshPoolMetaClubName(ctx, player._id, event.toClubName);
            break;
          }
          case "incoming_new": {
            if (event.rawToClubId === null || event.toLeagueId === undefined) {
              await recordUnresolved("covered destination lost between classify and apply");
              continue;
            }
            if (player !== null) {
              // Created by an earlier move in this same window — apply as the
              // known-player update it now is, and record it as such.
              classification = "incoming_known";
              await ctx.db.patch(player._id, {
                clubId: event.rawToClubId,
                leagueId: event.toLeagueId,
                active: true,
                departedAt: undefined,
              });
              await refreshPoolMetaClubName(ctx, player._id, event.toClubName);
              break;
            }
            if (event.newPlayerPosition === undefined) {
              // The caller only omits the position when the feed had none —
              // the STOP-AND-REPORT case. Never defaulted (FW-2 rule: a
              // guessed position mis-drives the mismatch dampener forever).
              await recordUnresolved(
                "position unavailable from feed for new player (STOP-AND-REPORT)",
              );
              continue;
            }
            playerId = await ctx.db.insert("fantasyPlayers", {
              providerPlayerId: event.providerPlayerId,
              name: event.playerName,
              clubId: event.rawToClubId,
              leagueId: event.toLeagueId,
              feedPosition: event.newPlayerPosition,
              price: PRICE_MIN, // the 4.0 floor — the flagged-pool rule (R1)
              active: true,
            });
            await ctx.db.insert("fantasyDraftPoolMeta", {
              playerId,
              pool: "flagged",
              proxy: null,
              ...(event.toClubName === null ? {} : { clubName: event.toClubName }),
            });
            newPlayers.push({
              providerPlayerId: event.providerPlayerId,
              name: event.playerName,
              clubId: event.rawToClubId,
              clubName: event.toClubName,
              feedPosition: event.newPlayerPosition,
              price: PRICE_MIN,
            });
            break;
          }
          case "outgoing": {
            // Keep the row; selection excludes him via active, history keeps
            // him via playerId. A player we never carried has no row to mark —
            // the event alone is the record.
            if (player !== null && player.active) {
              await ctx.db.patch(player._id, { active: false, departedAt: now });
            }
            break;
          }
        }
      }

      counts[
        classification === "internal"
          ? "internal"
          : classification === "incoming_known"
            ? "incomingKnown"
            : classification === "incoming_new"
              ? "incomingNew"
              : "outgoing"
      ] += 1;
      if (superseded) counts.superseded += 1;

      await ctx.db.insert("fantasyTransferEvents", {
        providerTransferKey: event.providerTransferKey,
        providerPlayerId: event.providerPlayerId,
        playerName: event.playerName,
        transferDate: event.transferDate,
        rawFromClubId: event.rawFromClubId,
        rawToClubId: event.rawToClubId,
        fromCovered: event.fromCovered,
        toCovered: event.toCovered,
        ...(playerId === undefined ? {} : { playerId }),
        transferType: event.transferType,
        loan: event.loan,
        classification,
        ...(superseded ? { superseded: true } : {}),
        processedAt: now,
        sweepId,
      });
    }

    return { counts, unresolved, newPlayers };
  },
});

/** An internal/incoming move makes the pool meta's static club label stale —
 *  the one denormalized club fact in the fantasy namespace (FW-3 R1 side
 *  table). Refreshed here, from the same feed record that moved the club. */
async function refreshPoolMetaClubName(
  ctx: MutationCtx,
  playerId: Id<"fantasyPlayers">,
  clubName: string | null,
): Promise<void> {
  if (clubName === null) return;
  const meta = await ctx.db
    .query("fantasyDraftPoolMeta")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .first();
  if (meta !== null && meta.clubName !== clubName) {
    await ctx.db.patch(meta._id, { clubName });
  }
}

// ───────────────────────────────────────────────────────────────── the sweep

async function runSweep(
  ctx: ActionCtx,
  kind: "backfill" | "cron",
  sinceDay: string | undefined,
): Promise<TransferSweepReport> {
  const context: SweepContext = await ctx.runQuery(
    internal.fantasyTransfers.getSweepContext,
    {},
  );
  if (context.coveredClubs.length === 0) {
    throw new Error(
      "No covered clubs found — has bootstrapSeason run on this deployment?",
    );
  }

  const windowFromDay =
    sinceDay ??
    (kind === "backfill"
      ? TRANSFER_BACKFILL_START_DAY
      : context.lastSuccess === null
        ? TRANSFER_BACKFILL_START_DAY
        : isoDay(
            context.lastSuccess.startedAt - CRON_WINDOW_OVERLAP_DAYS * MS_PER_DAY,
          ));

  // ── the call plan, printed before ANY pull ──
  const baseCalls = context.coveredClubs.length;
  console.log(
    `[FW-T1 call plan] ${kind}: ${baseCalls} covered club(s) × 1 /transfers request = ${baseCalls} base call(s), ` +
      `window since ${windowFromDay}; plus 1 /players/squads call per destination club with unknown incoming ` +
      `players (projected after the sweep, same ${SWEEP_CALL_CEILING}-call ceiling)`,
  );
  if (baseCalls > SWEEP_CALL_CEILING) {
    throw new Error(
      `[FW-T1] STOP: base plan of ${baseCalls} calls exceeds the ${SWEEP_CALL_CEILING}-call ceiling. No request was made.`,
    );
  }

  const sweepId: Id<"fantasyTransferSweeps"> = await ctx.runMutation(
    internal.fantasyTransfers.startSweep,
    { kind, windowFromDay, callsPlanned: baseCalls },
  );

  const client = new ApiFootballClient(credentialsFromEnv());
  let callsMade = 0;

  try {
    const coveredClubIds = new Set(context.coveredClubs.map((c) => c.clubId));
    const leagueByClub = new Map(
      context.coveredClubs.map((c) => [c.clubId, c.leagueId]),
    );

    const entries: FeedTransferEntry[] = [];
    for (const club of context.coveredClubs) {
      const clubEntries = await fetchTeamTransfers(client, club.clubId);
      callsMade += 1;
      entries.push(...clubEntries);
    }

    const collected = collectCandidates(entries, { windowFromDay, coveredClubIds });

    // Resolve which players our table already carries.
    const uniqueIds = [
      ...new Set(collected.candidates.map((c) => c.providerPlayerId)),
    ];
    const known = new Set<string>();
    for (let i = 0; i < uniqueIds.length; i += RESOLVE_CHUNK_SIZE) {
      const chunk: ResolvedPlayer[] = await ctx.runQuery(
        internal.fantasyTransfers.resolvePlayers,
        { providerPlayerIds: uniqueIds.slice(i, i + RESOLVE_CHUNK_SIZE) },
      );
      for (const r of chunk) if (r.known) known.add(r.providerPlayerId);
    }

    const classified = collected.candidates.map((candidate) => ({
      candidate,
      ...classifyTransfer({
        candidate,
        playerKnown: known.has(candidate.providerPlayerId),
        coveredClubIds,
      }),
    }));

    // ── phase 2: positions for players new to the universe ──
    //
    // /transfers carries no position, and a created player must have a real
    // one. The destination club's squad list does — one request per DISTINCT
    // destination club, serving every new player landing there. Projected and
    // checked against the ceiling before any of it is spent.
    const newPlayerClubs = [
      ...new Set(
        classified
          .filter((c) => c.classification === "incoming_new")
          .map((c) => c.candidate.rawToClubId)
          .filter((id): id is string => id !== null),
      ),
    ].sort((a, b) => (a < b ? -1 : 1));

    console.log(
      `[FW-T1 call plan] phase 2: ${newPlayerClubs.length} destination club(s) with unknown incoming players — ` +
        `${callsMade} call(s) spent + ${newPlayerClubs.length} projected = ${callsMade + newPlayerClubs.length} ` +
        `(ceiling ${SWEEP_CALL_CEILING})`,
    );
    if (callsMade + newPlayerClubs.length > SWEEP_CALL_CEILING) {
      throw new Error(
        `[FW-T1] STOP: ${callsMade} calls spent + ${newPlayerClubs.length} squad lookups projects past the ` +
          `${SWEEP_CALL_CEILING}-call ceiling. Squad lookups were not made.`,
      );
    }

    const positionByProviderId = new Map<string, "GK" | "DEF" | "MID" | "ATT">();
    for (const clubId of newPlayerClubs) {
      const squads = await fetchSquad(client, Number(clubId));
      callsMade += 1;
      for (const squadPlayer of squads[0]?.players ?? []) {
        const position = mapFeedPosition(squadPlayer.position);
        if (position !== null) {
          positionByProviderId.set(String(squadPlayer.id), position);
        }
      }
    }

    const positionless: TransferSweepReport["positionless"] = [];
    const events = classified.map(({ candidate, classification, unresolvedReason }) => {
      const toCovered =
        candidate.rawToClubId !== null && coveredClubIds.has(candidate.rawToClubId);
      const fromCovered =
        candidate.rawFromClubId !== null && coveredClubIds.has(candidate.rawFromClubId);
      let newPlayerPosition: "GK" | "DEF" | "MID" | "ATT" | undefined;
      if (classification === "incoming_new") {
        newPlayerPosition = positionByProviderId.get(candidate.providerPlayerId);
        if (newPlayerPosition === undefined) {
          positionless.push({
            providerPlayerId: candidate.providerPlayerId,
            name: candidate.playerName,
            clubId: candidate.rawToClubId ?? "?",
          });
        }
      }
      return {
        providerTransferKey: transferKey(candidate),
        providerPlayerId: candidate.providerPlayerId,
        playerName: candidate.playerName,
        transferDate: candidate.transferDate,
        rawFromClubId: candidate.rawFromClubId,
        rawToClubId: candidate.rawToClubId,
        fromCovered,
        toCovered,
        transferType: candidate.transferType,
        loan: isLoanType(candidate.transferType),
        classification,
        ...(unresolvedReason === undefined ? {} : { unresolvedReason }),
        ...(toCovered && candidate.rawToClubId !== null
          ? { toLeagueId: leagueByClub.get(candidate.rawToClubId) }
          : {}),
        toClubName: candidate.toClubName,
        ...(newPlayerPosition === undefined ? {} : { newPlayerPosition }),
      };
    });

    const counts: TransferCounts = {
      internal: 0,
      incomingKnown: 0,
      incomingNew: 0,
      outgoing: 0,
      unresolved: 0,
      alreadySeen: 0,
      superseded: 0,
    };
    const unresolved: UnresolvedRecord[] = [];
    const newPlayers: CreatedPlayerRecord[] = [];

    for (let i = 0; i < events.length; i += EVENT_CHUNK_SIZE) {
      const result: ApplyTransferChunkResult = await ctx.runMutation(
        internal.fantasyTransfers.applyTransferChunk,
        { sweepId, events: events.slice(i, i + EVENT_CHUNK_SIZE) },
      );
      for (const key of Object.keys(counts) as (keyof TransferCounts)[]) {
        counts[key] += result.counts[key];
      }
      unresolved.push(...result.unresolved);
      newPlayers.push(...result.newPlayers);
    }

    await ctx.runMutation(internal.fantasyTransfers.finishSweep, {
      sweepId,
      status: "succeeded",
      callsMade,
      dailyRemaining: client.dailyRemaining,
      counts,
    });

    console.log(
      `[FW-T1] ${kind} done: ${callsMade} call(s), ${collected.candidates.length} record(s) in window — ` +
        `internal ${counts.internal}, incoming-known ${counts.incomingKnown}, incoming-new ${counts.incomingNew}, ` +
        `outgoing ${counts.outgoing}, unresolved ${counts.unresolved}, already-seen ${counts.alreadySeen}, ` +
        `superseded ${counts.superseded}. Daily remaining: ${client.dailyRemaining ?? "?"}.`,
    );
    if (positionless.length > 0) {
      console.log(
        `[FW-T1] STOP-AND-REPORT: ${positionless.length} incoming new player(s) with no feed position were NOT ` +
          `created (logged unresolved): ${positionless.map((p) => `${p.name} → club ${p.clubId}`).join("; ")}`,
      );
    }

    return {
      kind,
      windowFromDay,
      coveredClubs: context.coveredClubs.length,
      callPlan: {
        baseCalls,
        squadLookupCalls: newPlayerClubs.length,
        projected: baseCalls + newPlayerClubs.length,
        ceiling: SWEEP_CALL_CEILING,
      },
      callsMade,
      dailyRemaining: client.dailyRemaining,
      fetched: {
        entries: entries.length,
        candidates: collected.candidates.length,
        malformed: collected.malformed,
        outOfScope: collected.outOfScope,
        beforeWindow: collected.beforeWindow,
      },
      counts,
      unresolved,
      newPlayers,
      positionless,
      sweepId,
    };
  } catch (error) {
    await ctx.runMutation(internal.fantasyTransfers.finishSweep, {
      sweepId,
      status: "failed",
      callsMade,
      dailyRemaining: client.dailyRemaining,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * P3 — the owner-invokable backfill:
 *
 *   npx convex run fantasyTransfers:backfillTransfers
 *
 * Sweeps all covered clubs' transfers since 2026-07-01 (or `sinceDay`),
 * classifies, applies, and returns the summary report. Idempotent: a second
 * run re-sees every stored key and applies nothing.
 */
export const backfillTransfers = internalAction({
  args: { sinceDay: v.optional(v.string()) },
  handler: async (ctx, { sinceDay }): Promise<TransferSweepReport> => {
    return await runSweep(ctx, "backfill", sinceDay);
  },
});

/**
 * P4 — the standing daily sweep, windowed since the last successful run
 * (minus a 3-day overlap; idempotence makes overlap free). First run on a
 * fresh deployment falls back to the backfill window, so activating the cron
 * without having run the backfill loses nothing. Runs year-round — the winter
 * window exists, and a quiet month costs 96 calls/day of no-ops.
 */
export const sweepTransfers = internalAction({
  args: {},
  handler: async (ctx): Promise<TransferSweepReport> => {
    return await runSweep(ctx, "cron", undefined);
  },
});
