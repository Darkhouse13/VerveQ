/**
 * THE WEEKEND — the live ledger (FW-RECEIPT Part 2).
 *
 * A squad's weekend as a reverse-chronological timeline, derived ENTIRELY from
 * rows that already exist: squad creation, slot lock stamps, score versions
 * with their revision chains, crowd-factor applications, court rulings, and
 * the settlement stamp. This module writes nothing — it is a read surface
 * over FW-4's data, and every entry it emits traces to a stored row.
 *
 * Honesty rules inherited from FW-4:
 *  - awaiting is ABSENT, never zero: an unscored player simply has no entry;
 *  - term breakdowns are re-derived through the engine (`explainContext`) from
 *    the exact stat revision a score version names — and only narrated when
 *    the reconstructed line's hash matches the stored row's `statHash`. A
 *    mismatched reconstruction (the fixture score moved since) degrades to a
 *    points-only entry rather than inventing a term story;
 *  - "final" labels derive from the settlement stamp, never the clock (N2).
 *
 * The entry payloads are structured facts; the product's copy ("clean sheet
 * held, +5") is composed client-side where i18n lives.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { gameweekScoringRow } from "./fantasyScores";
import { matchContextFor } from "./lib/fantasyFeedStats";
import type { LedgerEntry, Slot, SlotRole } from "./lib/fantasyScoring";
import {
  explainContext,
  statHashOf,
  totalFor,
  isMismatch,
  type PlayerFixtureLine,
} from "./lib/fantasyScorePipeline";

// ─────────────────────────────────────────────────────────────── the shapes

/** One term of a score, engine-labelled. Only nonzero terms are carried. */
export interface LedgerTerm {
  code: string;
  label: string;
  count?: number;
  points: number;
}

/** One term's movement between two score versions. */
export interface LedgerTermChange {
  code: string;
  label: string;
  fromCount: number | null;
  toCount: number | null;
  pointsDelta: number;
}

interface EventBase {
  /** Epoch ms. Locks carry the fixture's kickoff (the sweep's late-safe stamp). */
  at: number;
}

interface PlayerEventBase extends EventBase {
  playerName: string;
  slotRole: Slot;
  isFinisher: boolean;
}

export type SquadLedgerEvent =
  | ({ kind: "squad_built"; context: "budget" | "crew" } & EventBase)
  | ({ kind: "locked" } & PlayerEventBase)
  | ({
      kind: "scored";
      points: number;
      crowdFactor: number;
      mismatch: boolean;
      verdictPosition: Slot | null;
      /** Nonzero engine terms; null when the line could not be re-derived. */
      terms: LedgerTerm[] | null;
    } & PlayerEventBase)
  | ({
      kind: "revised";
      cause: "stats" | "crowd" | "court";
      points: number;
      prevPoints: number;
      crowdFactor: number;
      prevCrowdFactor: number;
      verdictPosition: Slot | null;
      prevVerdictPosition: Slot | null;
      mismatch: boolean;
      /** Term-level movements; null when either side resists exact re-derivation. */
      changes: LedgerTermChange[] | null;
    } & PlayerEventBase)
  | ({
      kind: "court";
      playerName: string;
      position: Slot;
      positionAtFiling: Slot | null;
    } & EventBase)
  | ({
      kind: "settled";
      total: number;
      scoredSlots: number;
      awaitingSlots: number;
    } & EventBase);

export interface SquadLedger {
  squadId: Id<"fantasySquads">;
  gameweekId: Id<"fantasyGameweeks">;
  season: string;
  gwNumber: number;
  /** From the settlement stamp (N2), never the clock. */
  state: "provisional" | "final";
  settledAt: number | null;
  /** Newest first. */
  entries: SquadLedgerEvent[];
}

// ──────────────────────────────────────────────────────────── reconstruction

/**
 * Rebuild the exact `PlayerFixtureLine` behind a stored score version: the stat
 * revision the row names, the current fixture score, the row's own verdict.
 * Returns null unless the rebuilt line hashes to the row's `statHash` — the
 * gate that keeps a term narration from drifting off the number it explains
 * (the fixture score is part of the hash, so a fixture corrected since the
 * version was written fails closed here).
 */
async function lineBehind(
  ctx: QueryCtx,
  row: Doc<"fantasyPlayerScores">,
  fixtures: Map<string, Doc<"fantasyFixtures"> | null>,
): Promise<PlayerFixtureLine | null> {
  const statRow = await ctx.db
    .query("fantasyFixtureStats")
    .withIndex("by_fixture_player_revision", (q) =>
      q
        .eq("fixtureId", row.fixtureId)
        .eq("providerPlayerId", row.providerPlayerId)
        .eq("revision", row.rawRevision),
    )
    .first();
  if (statRow === null) return null;

  let fixture = fixtures.get(row.fixtureId);
  if (fixture === undefined) {
    fixture = await ctx.db.get(row.fixtureId);
    fixtures.set(row.fixtureId, fixture);
  }
  if (fixture === null || fixture === undefined) return null;

  const isHome = statRow.clubId === fixture.homeClubId;
  const line: PlayerFixtureLine = {
    stats: statRow.stats,
    context: matchContextFor(
      isHome ? (fixture.homeGoals ?? 0) : (fixture.awayGoals ?? 0),
      isHome ? (fixture.awayGoals ?? 0) : (fixture.homeGoals ?? 0),
    ),
    events: statRow.events,
    entryMinute: statRow.entryMinute,
    verdictPosition: row.verdictPosition,
  };
  return statHashOf(line) === row.statHash ? line : null;
}

/** The engine's nonzero terms for one version, in the slot's own context. */
function termsOf(
  line: PlayerFixtureLine,
  slot: Slot,
  role: SlotRole,
  crowdFactor: number,
): LedgerTerm[] {
  return explainContext(line, slot, role, crowdFactor)
    .ledger.filter((entry: LedgerEntry) => entry.points !== 0)
    .map((entry: LedgerEntry) => ({
      code: entry.code,
      label: entry.label,
      ...(entry.count === undefined ? {} : { count: entry.count }),
      points: entry.points,
    }));
}

/**
 * What moved between two versions' term ledgers, by term code. Each side's
 * ledger is taken at its OWN crowd factor, so the deltas sum (within rounding)
 * to the visible points movement — an honest "what changed" rather than a
 * re-litigation of the whole line.
 */
function diffTerms(prev: LedgerTerm[], next: LedgerTerm[]): LedgerTermChange[] {
  const byCode = new Map<string, { prev?: LedgerTerm; next?: LedgerTerm }>();
  for (const term of prev) byCode.set(term.code, { prev: term });
  for (const term of next) {
    const slot = byCode.get(term.code);
    if (slot === undefined) byCode.set(term.code, { next: term });
    else slot.next = term;
  }

  const changes: LedgerTermChange[] = [];
  for (const { prev: from, next: to } of byCode.values()) {
    const fromPoints = from?.points ?? 0;
    const toPoints = to?.points ?? 0;
    const fromCount = from?.count ?? null;
    const toCount = to?.count ?? null;
    if (fromPoints === toPoints && fromCount === toCount) continue;
    changes.push({
      code: (to ?? from)!.code,
      label: (to ?? from)!.label,
      fromCount,
      toCount,
      pointsDelta: Math.round((toPoints - fromPoints) * 1e9) / 1e9,
    });
  }
  return changes;
}

// ──────────────────────────────────────────────────────────────── the query

/**
 * The caller's own squad's weekend, as a timeline. Read-only, auth-scoped the
 * way `getSquadScore` is; null for a visitor or a gameweek without a squad.
 */
export const getSquadLedger = query({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    context: v.union(v.literal("budget"), v.literal("crew")),
    crewRoomId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SquadLedger | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const contextKey = args.context === "budget" ? "budget" : `crew:${args.crewRoomId}`;
    const squad = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q.eq("userId", userId).eq("gameweekId", args.gameweekId).eq("contextKey", contextKey),
      )
      .first();
    if (squad === null) return null;

    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) return null;
    const gwScoring = await gameweekScoringRow(ctx, args.gameweekId);

    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();
    slots.sort((a, b) => a.slotIndex - b.slotIndex);

    const entries: SquadLedgerEvent[] = [
      { kind: "squad_built", at: squad.createdAt, context: squad.context },
    ];

    const fixtures = new Map<string, Doc<"fantasyFixtures"> | null>();
    const squadProviderIds = new Set<string>();

    for (const slot of slots) {
      if (slot.playerId === undefined) continue;
      const player = await ctx.db.get(slot.playerId);
      if (player === null) continue;
      squadProviderIds.add(player.providerPlayerId);

      const playerBase = {
        playerName: player.name,
        slotRole: slot.slotRole,
        isFinisher: slot.isFinisher,
      };
      const role: SlotRole = slot.isFinisher ? "finisher" : "starter";

      if (slot.lockedAt !== undefined) {
        entries.push({ kind: "locked", at: slot.lockedAt, ...playerBase });
      }

      // Every version, oldest first — the revision chain is the story.
      const versions = await ctx.db
        .query("fantasyPlayerScores")
        .withIndex("by_gameweek_player_version", (q) =>
          q.eq("gameweekId", args.gameweekId).eq("providerPlayerId", player.providerPlayerId),
        )
        .collect();
      versions.sort((a, b) => a.version - b.version);

      let prev: {
        row: Doc<"fantasyPlayerScores">;
        points: number;
        terms: LedgerTerm[] | null;
      } | null = null;

      for (const row of versions) {
        const points = totalFor(row.baseScores, slot.slotRole, role, row.crowdFactor);
        const line = await lineBehind(ctx, row, fixtures);
        const terms = line === null ? null : termsOf(line, slot.slotRole, role, row.crowdFactor);

        if (prev === null) {
          entries.push({
            kind: "scored",
            at: row.scoredAt,
            ...playerBase,
            points,
            crowdFactor: row.crowdFactor,
            mismatch: isMismatch(row.verdictPosition, slot.slotRole),
            verdictPosition: row.verdictPosition,
            terms,
          });
        } else {
          const cause: "stats" | "crowd" | "court" =
            row.verdictPosition !== prev.row.verdictPosition
              ? "court"
              : row.statHash === prev.row.statHash && row.crowdFactor !== prev.row.crowdFactor
                ? "crowd"
                : "stats";
          entries.push({
            kind: "revised",
            at: row.scoredAt,
            ...playerBase,
            cause,
            points,
            prevPoints: prev.points,
            crowdFactor: row.crowdFactor,
            prevCrowdFactor: prev.row.crowdFactor,
            verdictPosition: row.verdictPosition,
            prevVerdictPosition: prev.row.verdictPosition,
            mismatch: isMismatch(row.verdictPosition, slot.slotRole),
            changes:
              prev.terms === null || terms === null ? null : diffTerms(prev.terms, terms),
          });
        }
        prev = { row, points, terms };
      }
    }

    // Court rulings that touched this squad's players (passed = affected a
    // score; the resulting re-score is its own "revised" entry above).
    const passed = await ctx.db
      .query("fantasyCourtClaims")
      .withIndex("by_gameweek_status", (q) =>
        q.eq("gameweekId", args.gameweekId).eq("status", "passed"),
      )
      .collect();
    for (const claim of passed) {
      if (!squadProviderIds.has(claim.providerPlayerId) || claim.resolvedAt === undefined) {
        continue;
      }
      const player = claim.playerId === undefined ? null : await ctx.db.get(claim.playerId);
      entries.push({
        kind: "court",
        at: claim.resolvedAt,
        playerName: player?.name ?? claim.providerPlayerId,
        position: claim.claimedPosition,
        positionAtFiling: claim.positionAtFiling,
      });
    }

    // Settlement, from the squad's own stamp — the ledger's closing line.
    if (gwScoring?.state === "final" && squad.finalScore !== undefined) {
      entries.push({
        kind: "settled",
        at: squad.finalScore.at,
        total: squad.finalScore.total,
        scoredSlots: squad.finalScore.scoredSlots,
        awaitingSlots: squad.finalScore.awaitingSlots,
      });
    }

    // Newest first; equal instants (a shared kickoff locks several slots at
    // once) order deterministically by kind then name.
    const kindRank: Record<SquadLedgerEvent["kind"], number> = {
      settled: 0,
      court: 1,
      revised: 2,
      scored: 3,
      locked: 4,
      squad_built: 5,
    };
    entries.sort(
      (a, b) =>
        b.at - a.at ||
        kindRank[a.kind] - kindRank[b.kind] ||
        (("playerName" in a ? a.playerName : "") < ("playerName" in b ? b.playerName : "")
          ? -1
          : 1),
    );

    return {
      squadId: squad._id,
      gameweekId: args.gameweekId,
      season: gameweek.season,
      gwNumber: gameweek.gwNumber,
      state: gwScoring?.state === "final" ? "final" : "provisional",
      settledAt: gwScoring?.finalizedAt ?? null,
      entries,
    };
  },
});
