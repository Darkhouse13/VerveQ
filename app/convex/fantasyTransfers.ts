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
  reactivationCandidate,
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
  /** FW-T1b: the retry pass over rows parked unresolved by earlier sweeps.
   *  `attempted` is the whole standing set; `resolved` rows flipped class in
   *  place (players in `newPlayers` were created off a fresh squad lookup). */
  retry: {
    attempted: number;
    calls: number;
    resolved: number;
    remaining: number;
    newPlayers: CreatedPlayerRecord[];
  };
  /** The standing unresolved set AFTER this run — retry leftovers plus any
   *  new ambiguity this sweep parked. What the owner reviews. */
  unresolvedAfter: UnresolvedRecord[];
  sweepId: Id<"fantasyTransferSweeps">;
}

// ─────────────────────────────────────────────────────────────────── read layer

/**
 * Everything a sweep decides its plan from, in one query: the covered-club
 * universe (derived from the season's fixture rows — every club FW-2/FW-EXPAND
 * ingested, ~156 across eight leagues, at zero request cost) and the latest
 * successful sweep, which is what the cron windows itself from.
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

export interface UnresolvedRow {
  eventId: Id<"fantasyTransferEvents">;
  providerPlayerId: string;
  playerName: string;
  transferDate: string;
  rawFromClubId: string | null;
  rawToClubId: string | null;
  transferType: string | null;
  unresolvedReason: string | null;
}

/**
 * The standing unresolved set — what the FW-T1b retry pass re-attempts at the
 * top of every sweep. Bounded by construction: rows leave this set the moment
 * a retry resolves them, and new ones only enter via genuinely ambiguous feed
 * records.
 */
export const listUnresolved = internalQuery({
  args: {},
  handler: async (ctx): Promise<UnresolvedRow[]> => {
    const rows = await ctx.db
      .query("fantasyTransferEvents")
      .withIndex("by_classification", (q) => q.eq("classification", "unresolved"))
      .collect();
    return rows.map((row) => ({
      eventId: row._id,
      providerPlayerId: row.providerPlayerId,
      playerName: row.playerName,
      transferDate: row.transferDate,
      rawFromClubId: row.rawFromClubId,
      rawToClubId: row.rawToClubId,
      transferType: row.transferType,
      unresolvedReason: row.unresolvedReason ?? null,
    }));
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

const retriesValidator = v.object({
  attempted: v.number(),
  calls: v.number(),
  resolved: v.number(),
  remaining: v.number(),
});

export const finishSweep = internalMutation({
  args: {
    sweepId: v.id("fantasyTransferSweeps"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    callsMade: v.number(),
    dailyRemaining: v.union(v.number(), v.null()),
    counts: v.optional(countsValidator),
    retries: v.optional(retriesValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.sweepId, {
      status: args.status,
      finishedAt: Date.now(),
      callsMade: args.callsMade,
      dailyRemaining: args.dailyRemaining,
      ...(args.counts === undefined ? {} : { counts: args.counts }),
      ...(args.retries === undefined ? {} : { retries: args.retries }),
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

/** A move's classification once it is applied — never "unresolved". */
type AppliedClassification = "internal" | "incoming_known" | "incoming_new" | "outgoing";

interface MoveArgs {
  classification: AppliedClassification;
  providerPlayerId: string;
  playerName: string;
  rawToClubId: string | null;
  toLeagueId: number | undefined;
  toClubName: string | null;
  newPlayerPosition: "GK" | "DEF" | "MID" | "ATT" | undefined;
}

type MoveOutcome =
  | {
      ok: true;
      /** What actually happened — an incoming_new whose player meanwhile
       *  exists applies (and records) as incoming_known. */
      classification: AppliedClassification;
      playerId?: Id<"fantasyPlayers">;
      created?: CreatedPlayerRecord;
    }
  | { ok: false; reason: string };

/**
 * The one place a classified move touches a player row — used by the first
 * sighting (applyTransferChunk) and by the FW-T1b retry pass
 * (applyRetryResolutions), which must not drift apart about what a class does.
 */
async function applyMoveToPlayer(
  ctx: MutationCtx,
  move: MoveArgs,
  now: number,
): Promise<MoveOutcome> {
  const player = await ctx.db
    .query("fantasyPlayers")
    .withIndex("by_providerPlayerId", (q) =>
      q.eq("providerPlayerId", move.providerPlayerId),
    )
    .first();

  switch (move.classification) {
    case "internal":
    case "incoming_known": {
      if (player === null) {
        // Classified against a snapshot that no longer holds. R3: never guess
        // a row into existence outside the incoming_new path, which alone
        // carries a feed-sourced position.
        return { ok: false, reason: "player row not found at apply time (classified as known)" };
      }
      if (move.rawToClubId === null || move.toLeagueId === undefined) {
        return { ok: false, reason: "covered destination lost between classify and apply" };
      }
      await ctx.db.patch(player._id, {
        clubId: move.rawToClubId,
        leagueId: move.toLeagueId,
        active: true,
        departedAt: undefined,
      });
      await refreshPoolMetaClubName(ctx, player._id, move.toClubName);
      return { ok: true, classification: move.classification, playerId: player._id };
    }
    case "incoming_new": {
      if (move.rawToClubId === null || move.toLeagueId === undefined) {
        return { ok: false, reason: "covered destination lost between classify and apply" };
      }
      if (player !== null) {
        // Created by an earlier move in this same window — apply as the
        // known-player update it now is, and record it as such.
        await ctx.db.patch(player._id, {
          clubId: move.rawToClubId,
          leagueId: move.toLeagueId,
          active: true,
          departedAt: undefined,
        });
        await refreshPoolMetaClubName(ctx, player._id, move.toClubName);
        return { ok: true, classification: "incoming_known", playerId: player._id };
      }
      if (move.newPlayerPosition === undefined) {
        // The caller only omits the position when the feed had none — the
        // STOP-AND-REPORT case. Never defaulted (FW-2 rule: a guessed position
        // mis-drives the mismatch dampener forever).
        return {
          ok: false,
          reason: "position unavailable from feed for new player (STOP-AND-REPORT)",
        };
      }
      const playerId = await ctx.db.insert("fantasyPlayers", {
        providerPlayerId: move.providerPlayerId,
        name: move.playerName,
        clubId: move.rawToClubId,
        leagueId: move.toLeagueId,
        feedPosition: move.newPlayerPosition,
        price: PRICE_MIN, // the 4.0 floor — the flagged-pool rule (R1)
        active: true,
      });
      await ctx.db.insert("fantasyDraftPoolMeta", {
        playerId,
        pool: "flagged",
        proxy: null,
        ...(move.toClubName === null ? {} : { clubName: move.toClubName }),
      });
      return {
        ok: true,
        classification: "incoming_new",
        playerId,
        created: {
          providerPlayerId: move.providerPlayerId,
          name: move.playerName,
          clubId: move.rawToClubId,
          clubName: move.toClubName,
          feedPosition: move.newPlayerPosition,
          price: PRICE_MIN,
        },
      };
    }
    case "outgoing": {
      // Keep the row; selection excludes him via active, history keeps him
      // via playerId. A player we never carried has no row to mark — the
      // event alone is the record.
      if (player !== null && player.active) {
        await ctx.db.patch(player._id, { active: false, departedAt: now });
      }
      return {
        ok: true,
        classification: "outgoing",
        ...(player === null ? {} : { playerId: player._id }),
      };
    }
  }
}

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

      let classification = event.classification;
      let playerId: Id<"fantasyPlayers"> | undefined;

      if (superseded) {
        // The record is stored (it is part of the ledger) but moves nothing —
        // still resolve the player reference for the row when one exists.
        const player = await ctx.db
          .query("fantasyPlayers")
          .withIndex("by_providerPlayerId", (q) =>
            q.eq("providerPlayerId", event.providerPlayerId),
          )
          .first();
        playerId = player?._id;
      } else {
        const outcome = await applyMoveToPlayer(
          ctx,
          {
            classification: event.classification,
            providerPlayerId: event.providerPlayerId,
            playerName: event.playerName,
            rawToClubId: event.rawToClubId,
            toLeagueId: event.toLeagueId,
            toClubName: event.toClubName,
            newPlayerPosition: event.newPlayerPosition,
          },
          now,
        );
        if (outcome.ok === false) {
          await recordUnresolved(outcome.reason);
          continue;
        }
        classification = outcome.classification;
        playerId = outcome.playerId;
        if (outcome.created !== undefined) newPlayers.push(outcome.created);
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

export interface RetryResolutionResult {
  attempted: number;
  resolved: number;
  remaining: number;
  newPlayers: CreatedPlayerRecord[];
}

/**
 * FW-T1b: resolve previously-unresolved rows IN PLACE. Idempotence keys new
 * records out of re-processing, so a parked row can only leave "unresolved"
 * through here: the row's classification flips to what actually happened and
 * `resolvedAt` is stamped; the original `unresolvedReason` stays as the trace
 * of why it took more than one pass. A row that still cannot be resolved is
 * left untouched and stays queryable by classification.
 *
 * The same out-of-order guard as first sighting applies: a retry resolving a
 * July half-record after an August move landed records the resolution as
 * superseded and moves no club.
 */
export const applyRetryResolutions = internalMutation({
  args: {
    sweepId: v.id("fantasyTransferSweeps"),
    retries: v.array(
      v.object({
        eventId: v.id("fantasyTransferEvents"),
        classification: v.union(
          v.literal("internal"),
          v.literal("incoming_known"),
          v.literal("incoming_new"),
          v.literal("outgoing"),
        ),
        toLeagueId: v.optional(v.number()),
        toClubName: v.union(v.string(), v.null()),
        newPlayerPosition: v.optional(
          v.union(v.literal("GK"), v.literal("DEF"), v.literal("MID"), v.literal("ATT")),
        ),
      }),
    ),
  },
  handler: async (ctx, { retries }): Promise<RetryResolutionResult> => {
    let attempted = 0;
    let resolved = 0;
    const newPlayers: CreatedPlayerRecord[] = [];
    const now = Date.now();

    for (const retry of retries) {
      const row = await ctx.db.get(retry.eventId);
      // Gone, or already resolved by a concurrent run: nothing to attempt.
      if (row === null || row.classification !== "unresolved") continue;
      attempted += 1;

      const priorEvents = await ctx.db
        .query("fantasyTransferEvents")
        .withIndex("by_player_date", (q) =>
          q.eq("providerPlayerId", row.providerPlayerId),
        )
        .collect();
      const appliedDates = priorEvents
        .filter(
          (e) =>
            e._id !== row._id &&
            e.classification !== "unresolved" &&
            e.superseded !== true,
        )
        .map((e) => e.transferDate);

      if (laterMoveAlreadyApplied(row.transferDate, appliedDates)) {
        await ctx.db.patch(row._id, {
          classification: retry.classification,
          superseded: true,
          resolvedAt: now,
        });
        resolved += 1;
        continue;
      }

      const outcome = await applyMoveToPlayer(
        ctx,
        {
          classification: retry.classification,
          providerPlayerId: row.providerPlayerId,
          playerName: row.playerName,
          rawToClubId: row.rawToClubId,
          toLeagueId: retry.toLeagueId,
          toClubName: retry.toClubName,
          newPlayerPosition: retry.newPlayerPosition,
        },
        now,
      );
      if (outcome.ok === false) {
        // Still unresolved — refresh the reason (it may have changed shape)
        // and leave the row in the retryable set.
        if (row.unresolvedReason !== outcome.reason) {
          await ctx.db.patch(row._id, { unresolvedReason: outcome.reason });
        }
        continue;
      }

      await ctx.db.patch(row._id, {
        classification: outcome.classification,
        resolvedAt: now,
        ...(outcome.playerId === undefined ? {} : { playerId: outcome.playerId }),
      });
      resolved += 1;
      if (outcome.created !== undefined) newPlayers.push(outcome.created);
    }

    return {
      attempted,
      resolved,
      remaining: attempted - resolved,
      newPlayers,
    };
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

  const coveredClubIds = new Set(context.coveredClubs.map((c) => c.clubId));
  const leagueByClub = new Map(
    context.coveredClubs.map((c) => [c.clubId, c.leagueId]),
  );

  // ── FW-T1b retry planning: the unresolved set, before any new record ──
  //
  // Idempotence must not settle failure: every sweep re-attempts the standing
  // unresolved rows first. Re-classification is pure and free; the only spend
  // is a fresh squad lookup per destination club whose parked players still
  // need a position, and it is budgeted in the printed plan below.
  const unresolvedRows: UnresolvedRow[] = await ctx.runQuery(
    internal.fantasyTransfers.listUnresolved,
    {},
  );
  const unresolvedIds = [...new Set(unresolvedRows.map((r) => r.providerPlayerId))];
  const retryKnown = new Set<string>();
  for (let i = 0; i < unresolvedIds.length; i += RESOLVE_CHUNK_SIZE) {
    const chunk: ResolvedPlayer[] = await ctx.runQuery(
      internal.fantasyTransfers.resolvePlayers,
      { providerPlayerIds: unresolvedIds.slice(i, i + RESOLVE_CHUNK_SIZE) },
    );
    for (const r of chunk) if (r.known) retryKnown.add(r.providerPlayerId);
  }

  const retryClassified = unresolvedRows.map((row) => ({
    row,
    ...classifyTransfer({
      candidate: {
        providerPlayerId: row.providerPlayerId,
        playerName: row.playerName,
        transferDate: row.transferDate,
        rawFromClubId: row.rawFromClubId,
        rawToClubId: row.rawToClubId,
        fromClubName: null,
        toClubName: null,
        transferType: row.transferType,
      },
      playerKnown: retryKnown.has(row.providerPlayerId),
      coveredClubIds,
    }),
  }));

  const retryLookupClubs = [
    ...new Set(
      retryClassified
        .filter((r) => r.classification === "incoming_new")
        .map((r) => r.row.rawToClubId)
        .filter((id): id is string => id !== null),
    ),
  ].sort((a, b) => (a < b ? -1 : 1));

  // ── the call plan, printed before ANY pull ──
  const baseCalls = context.coveredClubs.length;
  const retryCalls = retryLookupClubs.length;
  console.log(
    `[FW-T1 call plan] ${kind}: ${baseCalls} covered club(s) × 1 /transfers request = ${baseCalls} base call(s), ` +
      `window since ${windowFromDay}; retry pass over ${unresolvedRows.length} unresolved row(s) needs ` +
      `${retryCalls} squad lookup(s); plus 1 /players/squads call per destination club with unknown incoming ` +
      `players (projected after the sweep, same ${SWEEP_CALL_CEILING}-call ceiling)`,
  );
  if (baseCalls + retryCalls > SWEEP_CALL_CEILING) {
    throw new Error(
      `[FW-T1] STOP: base plan of ${baseCalls} + ${retryCalls} retry call(s) exceeds the ` +
        `${SWEEP_CALL_CEILING}-call ceiling. No request was made.`,
    );
  }

  const sweepId: Id<"fantasyTransferSweeps"> = await ctx.runMutation(
    internal.fantasyTransfers.startSweep,
    { kind, windowFromDay, callsPlanned: baseCalls + retryCalls },
  );

  const client = new ApiFootballClient(credentialsFromEnv());
  let callsMade = 0;

  try {
    // ── retry pass (FW-T1b): squad lookups shared with phase 2 below ──
    const positionByProviderId = new Map<string, "GK" | "DEF" | "MID" | "ATT">();
    const squadClubName = new Map<string, string | null>();
    const fetchSquadPositions = async (clubId: string): Promise<void> => {
      if (squadClubName.has(clubId)) return;
      const squads = await fetchSquad(client, Number(clubId));
      callsMade += 1;
      squadClubName.set(clubId, squads[0]?.team.name ?? null);
      for (const squadPlayer of squads[0]?.players ?? []) {
        const position = mapFeedPosition(squadPlayer.position);
        if (position !== null) {
          positionByProviderId.set(String(squadPlayer.id), position);
        }
      }
    };

    for (const clubId of retryLookupClubs) await fetchSquadPositions(clubId);

    const retryInstructions = retryClassified.flatMap(({ row, classification }) => {
      if (classification === "unresolved") return [];
      const position =
        classification === "incoming_new"
          ? positionByProviderId.get(row.providerPlayerId)
          : undefined;
      // STOP gate: a retry may never create a player without a feed-supplied
      // position — an incoming_new whose position is STILL missing is not
      // sent, and the row simply stays in the unresolved set.
      if (classification === "incoming_new" && position === undefined) return [];
      const toClubName =
        row.rawToClubId === null ? null : (squadClubName.get(row.rawToClubId) ?? null);
      return [
        {
          eventId: row.eventId,
          classification,
          ...(row.rawToClubId !== null && coveredClubIds.has(row.rawToClubId)
            ? { toLeagueId: leagueByClub.get(row.rawToClubId) }
            : {}),
          toClubName,
          ...(position === undefined ? {} : { newPlayerPosition: position }),
        },
      ];
    });

    let retryResult: RetryResolutionResult = {
      attempted: 0,
      resolved: 0,
      remaining: 0,
      newPlayers: [],
    };
    if (retryInstructions.length > 0) {
      retryResult = await ctx.runMutation(
        internal.fantasyTransfers.applyRetryResolutions,
        { sweepId, retries: retryInstructions },
      );
    }
    console.log(
      `[FW-T1 retry] ${unresolvedRows.length} unresolved row(s): ${retryInstructions.length} retriable, ` +
        `${retryResult.resolved} resolved (${retryResult.newPlayers.length} player(s) created), ` +
        `${unresolvedRows.length - retryResult.resolved} still unresolved`,
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

    // Clubs the retry pass already fetched are served from the shared cache.
    const phase2Clubs = newPlayerClubs.filter((clubId) => !squadClubName.has(clubId));
    console.log(
      `[FW-T1 call plan] phase 2: ${newPlayerClubs.length} destination club(s) with unknown incoming players ` +
        `(${newPlayerClubs.length - phase2Clubs.length} cached from the retry pass) — ` +
        `${callsMade} call(s) spent + ${phase2Clubs.length} projected = ${callsMade + phase2Clubs.length} ` +
        `(ceiling ${SWEEP_CALL_CEILING})`,
    );
    if (callsMade + phase2Clubs.length > SWEEP_CALL_CEILING) {
      throw new Error(
        `[FW-T1] STOP: ${callsMade} calls spent + ${phase2Clubs.length} squad lookups projects past the ` +
          `${SWEEP_CALL_CEILING}-call ceiling. Squad lookups were not made.`,
      );
    }

    for (const clubId of phase2Clubs) await fetchSquadPositions(clubId);

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

    const retrySection = {
      attempted: unresolvedRows.length,
      calls: retryCalls,
      resolved: retryResult.resolved,
      remaining: unresolvedRows.length - retryResult.resolved,
      newPlayers: retryResult.newPlayers,
    };

    await ctx.runMutation(internal.fantasyTransfers.finishSweep, {
      sweepId,
      status: "succeeded",
      callsMade,
      dailyRemaining: client.dailyRemaining,
      counts,
      retries: {
        attempted: retrySection.attempted,
        calls: retrySection.calls,
        resolved: retrySection.resolved,
        remaining: retrySection.remaining,
      },
    });

    // The standing set after everything this run did — the owner's review list.
    const unresolvedAfter: UnresolvedRecord[] = (
      (await ctx.runQuery(internal.fantasyTransfers.listUnresolved, {})) as UnresolvedRow[]
    ).map((row) => ({
      providerTransferKey: transferKey({
        providerPlayerId: row.providerPlayerId,
        transferDate: row.transferDate,
        rawFromClubId: row.rawFromClubId,
        rawToClubId: row.rawToClubId,
      }),
      providerPlayerId: row.providerPlayerId,
      playerName: row.playerName,
      transferDate: row.transferDate,
      rawFromClubId: row.rawFromClubId,
      rawToClubId: row.rawToClubId,
      reason: row.unresolvedReason ?? "unresolved",
    }));

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
      retry: retrySection,
      unresolvedAfter,
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
 * window exists, and a quiet month costs ~156 calls/day of no-ops.
 */
export const sweepTransfers = internalAction({
  args: {},
  handler: async (ctx): Promise<TransferSweepReport> => {
    return await runSweep(ctx, "cron", undefined);
  },
});

// ────────────────────────────────────────── FW-EXPAND R2: reactivation pass

/** The stored fields the reactivation pass needs from an outgoing row. */
export const listOutgoingEvents = internalQuery({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    {
      eventId: Id<"fantasyTransferEvents">;
      classification: string;
      providerPlayerId: string;
      playerName: string;
      transferDate: string;
      rawToClubId: string | null;
      superseded: boolean;
    }[]
  > => {
    const rows = await ctx.db
      .query("fantasyTransferEvents")
      .withIndex("by_classification", (q) => q.eq("classification", "outgoing"))
      .collect();
    return rows.map((row) => ({
      eventId: row._id,
      classification: row.classification,
      providerPlayerId: row.providerPlayerId,
      playerName: row.playerName,
      transferDate: row.transferDate,
      rawToClubId: row.rawToClubId,
      superseded: row.superseded === true,
    }));
  },
});

export interface ReactivationChunkResult {
  reactivated: number;
  superseded: number;
  skippedAlreadyDone: number;
  notCorroborated: {
    providerPlayerId: string;
    playerName: string;
    rawToClubId: string;
    reason: string;
  }[];
}

/**
 * FW-EXPAND R2 — reclassify stored "outgoing" rows whose destination club has
 * since joined the covered universe, and reactivate their players.
 *
 * The rules, in order, per row:
 *  1. Idempotence: a row no longer classified "outgoing" was handled by an
 *     earlier chunk/run — skipped.
 *  2. Out-of-order guard, same as retry: a later-dated APPLIED move wins; the
 *     row reclassifies with `superseded: true` and moves nobody.
 *  3. Corroboration: the player's CURRENT club row must equal the event's
 *     destination. The player bootstrap read every expansion club's squad
 *     AFTER these transfers happened, so a player the destination's squad
 *     does not carry has moved on (or the feed omitted him) — reactivating
 *     him would contradict fresher data. Fail closed, report, leave the row.
 *  4. Apply via applyMoveToPlayer (the single shared apply path): active,
 *     departedAt cleared, club/league confirmed. The row keeps its history in
 *     `reclassifiedFrom` and stamps `resolvedAt`, mirroring the retry trace.
 */
export const applyReactivations = internalMutation({
  args: {
    events: v.array(
      v.object({
        eventId: v.id("fantasyTransferEvents"),
        toLeagueId: v.number(),
      }),
    ),
  },
  handler: async (ctx, { events }): Promise<ReactivationChunkResult> => {
    const result: ReactivationChunkResult = {
      reactivated: 0,
      superseded: 0,
      skippedAlreadyDone: 0,
      notCorroborated: [],
    };
    const now = Date.now();

    for (const { eventId, toLeagueId } of events) {
      const row = await ctx.db.get(eventId);
      if (row === null || row.classification !== "outgoing" || row.superseded === true) {
        result.skippedAlreadyDone += 1;
        continue;
      }
      if (row.rawToClubId === null) {
        result.skippedAlreadyDone += 1;
        continue;
      }

      const reclass = classifyTransfer({
        candidate: {
          providerPlayerId: row.providerPlayerId,
          playerName: row.playerName,
          transferDate: row.transferDate,
          rawFromClubId: row.rawFromClubId,
          rawToClubId: row.rawToClubId,
          // Club display names are not stored on event rows and play no part
          // in classification.
          fromClubName: null,
          toClubName: null,
          transferType: row.transferType,
        },
        playerKnown: true,
        coveredClubIds: new Set([row.rawToClubId, ...(row.fromCovered && row.rawFromClubId !== null ? [row.rawFromClubId] : [])]),
      });
      if (reclass.classification !== "internal" && reclass.classification !== "incoming_known") {
        // Cannot happen with toCovered true + playerKnown true; fail closed.
        result.notCorroborated.push({
          providerPlayerId: row.providerPlayerId,
          playerName: row.playerName,
          rawToClubId: row.rawToClubId,
          reason: `reclassification produced ${reclass.classification}`,
        });
        continue;
      }

      const priorEvents = await ctx.db
        .query("fantasyTransferEvents")
        .withIndex("by_player_date", (q) =>
          q.eq("providerPlayerId", row.providerPlayerId),
        )
        .collect();
      // Same applied-set as the retry pass: everything but unresolved and
      // superseded counts — INCLUDING later "outgoing" rows, which position
      // the player (gone) just as firmly as an incoming move does. A player
      // whose post-expansion backfill shows him leaving the destination again
      // must supersede, not reactivate.
      const appliedDates = priorEvents
        .filter(
          (e) =>
            e._id !== row._id &&
            e.classification !== "unresolved" &&
            e.superseded !== true,
        )
        .map((e) => e.transferDate);
      if (laterMoveAlreadyApplied(row.transferDate, appliedDates)) {
        await ctx.db.patch(row._id, {
          classification: reclass.classification,
          reclassifiedFrom: "outgoing",
          superseded: true,
          toCovered: true,
          resolvedAt: now,
        });
        result.superseded += 1;
        continue;
      }

      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", row.providerPlayerId),
        )
        .first();
      if (player === null || player.clubId !== row.rawToClubId) {
        result.notCorroborated.push({
          providerPlayerId: row.providerPlayerId,
          playerName: row.playerName,
          rawToClubId: row.rawToClubId,
          reason:
            player === null
              ? "no player row (never carried, destination squad does not list him)"
              : `current club ${player.clubId} != event destination (moved on since)`,
        });
        continue;
      }

      const outcome = await applyMoveToPlayer(
        ctx,
        {
          classification: reclass.classification,
          providerPlayerId: row.providerPlayerId,
          playerName: row.playerName,
          rawToClubId: row.rawToClubId,
          toLeagueId,
          toClubName: null, // pool meta club names were seeded by O2; nothing fresher here
          newPlayerPosition: undefined,
        },
        now,
      );
      if (outcome.ok === false) {
        result.notCorroborated.push({
          providerPlayerId: row.providerPlayerId,
          playerName: row.playerName,
          rawToClubId: row.rawToClubId,
          reason: outcome.reason,
        });
        continue;
      }

      await ctx.db.patch(row._id, {
        classification: outcome.classification,
        reclassifiedFrom: "outgoing",
        toCovered: true,
        resolvedAt: now,
        ...(outcome.playerId === undefined ? {} : { playerId: outcome.playerId }),
      });
      result.reactivated += 1;
    }

    return result;
  },
});

/**
 * Repair the `active && departedAt` inconsistency the pre-FW-EXPAND
 * `applyClubPlayers` could leave behind (it reactivated a returning player
 * without clearing the departure stamp; fixed at the source in the same
 * mission). The schema's contract is explicit: departedAt is "cleared (with
 * active: true) if a later transfer brings him back".
 */
export const repairActiveDepartedAt = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ repaired: string[] }> => {
    const rows = await ctx.db
      .query("fantasyPlayers")
      .filter((q) =>
        q.and(q.eq(q.field("active"), true), q.neq(q.field("departedAt"), undefined)),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.patch(row._id, { departedAt: undefined });
    }
    return { repaired: rows.map((r) => `${r.name} (${r.providerPlayerId})`) };
  },
});

export interface ReactivationReport {
  outgoingRows: number;
  candidates: number;
  reactivated: number;
  superseded: number;
  skippedAlreadyDone: number;
  notCorroborated: ReactivationChunkResult["notCorroborated"];
  repairedDepartedAt: string[];
}

const REACTIVATION_CHUNK = 50;

/**
 * FW-EXPAND R2 — the owner-invokable reactivation pass:
 *
 *   npx convex run fantasyTransfers:reactivationPass
 *
 * Zero API calls: everything it needs is already stored. Selects stored
 * "outgoing" rows whose destination is now covered (the pure
 * reactivationCandidate rule), reclassifies and reactivates in chunks, then
 * repairs any lingering active-with-departedAt rows. Idempotent — a second
 * run finds no candidates (reclassified rows are no longer "outgoing") and
 * repairs nothing.
 */
export const reactivationPass = internalAction({
  args: {},
  handler: async (ctx): Promise<ReactivationReport> => {
    const context: SweepContext = await ctx.runQuery(
      internal.fantasyTransfers.getSweepContext,
      {},
    );
    const leagueByClub = new Map(
      context.coveredClubs.map((c) => [c.clubId, c.leagueId]),
    );
    const coveredClubIds = new Set(leagueByClub.keys());

    const outgoing = await ctx.runQuery(internal.fantasyTransfers.listOutgoingEvents, {});
    const candidates = outgoing.filter((row) => reactivationCandidate(row, coveredClubIds));
    console.log(
      `[FW-EXPAND R2] ${outgoing.length} outgoing rows, ${candidates.length} with a now-covered destination`,
    );

    const report: ReactivationReport = {
      outgoingRows: outgoing.length,
      candidates: candidates.length,
      reactivated: 0,
      superseded: 0,
      skippedAlreadyDone: 0,
      notCorroborated: [],
      repairedDepartedAt: [],
    };

    for (let i = 0; i < candidates.length; i += REACTIVATION_CHUNK) {
      const chunk = candidates.slice(i, i + REACTIVATION_CHUNK).map((row) => ({
        eventId: row.eventId,
        // The candidate rule guarantees rawToClubId is covered and non-null.
        toLeagueId: leagueByClub.get(row.rawToClubId as string) as number,
      }));
      const result: ReactivationChunkResult = await ctx.runMutation(
        internal.fantasyTransfers.applyReactivations,
        { events: chunk },
      );
      report.reactivated += result.reactivated;
      report.superseded += result.superseded;
      report.skippedAlreadyDone += result.skippedAlreadyDone;
      report.notCorroborated.push(...result.notCorroborated);
    }

    const repair = await ctx.runMutation(
      internal.fantasyTransfers.repairActiveDepartedAt,
      {},
    );
    report.repairedDepartedAt = repair.repaired;

    for (const miss of report.notCorroborated) {
      console.log(
        `[FW-EXPAND R2] NOT reactivated: ${miss.playerName} (${miss.providerPlayerId}) -> club ${miss.rawToClubId}: ${miss.reason}`,
      );
    }
    return report;
  },
});
