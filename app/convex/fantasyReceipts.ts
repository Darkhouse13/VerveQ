/**
 * THE WEEKEND — the settlement receipt (FW-RECEIPT Part 3).
 *
 * Two pieces, both additive to FW-4's settlement:
 *
 *  - `stampGameweekPercentiles` — the settlement-time rollup. Once a gameweek's
 *    settlement stamp is final, every budget squad that HAS a number gets one
 *    immutable row: its total, how many of the gameweek's budget squads it
 *    beat, and the population. Written once, chunked, idempotent, and guarded
 *    on the settlement stamp itself — never on "the cron reached me"
 *    (`scoreRaterAccuracy`'s pattern), because stamping and the settled mark
 *    can land on different ticks. This mutation writes ONLY its own table.
 *
 *  - `getReceipt` — the read surface. Null until the gameweek settles (an
 *    unsettled weekend has a ledger, not a receipt). Per-player finals reuse
 *    `squadScore` — the same derivation every other surface reads — plus the
 *    factual superlatives (best/worst contributor), the crowd's movements,
 *    and the stamped percentile (budget) or the room's rank (crew).
 *
 * Percentile semantics (BUDGET_MODE_SPEC §Competition surfaces item 3):
 * population = this gameweek's budget squads whose settled weekend produced a
 * number (`finalScore.scoredSlots > 0` — a squad with nothing scored has NO
 * number and is excluded, never counted as 0, mirroring the crew table and
 * the crowd's liquidity rule). `beatCount` = squads with a strictly lower
 * total. "beat N%" renders as beatCount / population.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  gameweekScoringRow,
  squadScore,
  type SlotScore,
} from "./fantasyScores";

// ─────────────────────────────────────────────────────── the settlement stamp

const STAMP_CHUNK = 100;

export interface StampPercentilesResult {
  /** False when the gameweek's settlement stamp is not final yet. */
  eligible: boolean;
  done: boolean;
  stamped: number;
  population: number;
}

/**
 * Squads that count: budget context, settled with at least one scored slot.
 * Sorted for determinism across chunked calls (totals are stamped and the
 * gameweek is final, so the list cannot move between calls).
 */
async function percentilePopulation(
  ctx: QueryCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Doc<"fantasySquads">[]> {
  const squads = await ctx.db
    .query("fantasySquads")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
    .collect();
  return squads
    .filter(
      (s) =>
        s.context === "budget" &&
        s.finalScore !== undefined &&
        s.finalScore.scoredSlots > 0,
    )
    .sort(
      (a, b) =>
        a.finalScore!.total - b.finalScore!.total || (a._id < b._id ? -1 : 1),
    );
}

export const stampGameweekPercentiles = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<StampPercentilesResult> => {
    const now = args.now ?? Date.now();

    // The guard is the settlement stamp, nothing else (N2's discipline): a
    // percentile computed over a population that could still move would be a
    // number the next tick contradicts.
    const gwScoring = await gameweekScoringRow(ctx, args.gameweekId);
    if (gwScoring?.state !== "final") {
      return { eligible: false, done: false, stamped: 0, population: 0 };
    }

    const population = await percentilePopulation(ctx, args.gameweekId);

    // beatCount by rank in the sorted-ascending list: everything below the
    // first squad with my total is strictly worse. Two passes, O(n).
    const firstIndexOfTotal = new Map<number, number>();
    population.forEach((squad, index) => {
      const total = squad.finalScore!.total;
      if (!firstIndexOfTotal.has(total)) firstIndexOfTotal.set(total, index);
    });

    let stamped = 0;
    for (const squad of population) {
      if (stamped >= STAMP_CHUNK) {
        return { eligible: true, done: false, stamped, population: population.length };
      }
      const existing = await ctx.db
        .query("fantasyGameweekPercentiles")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
        .first();
      if (existing !== null) continue; // stamped on an earlier tick — immutable

      await ctx.db.insert("fantasyGameweekPercentiles", {
        gameweekId: args.gameweekId,
        squadId: squad._id,
        userId: squad.userId,
        total: squad.finalScore!.total,
        beatCount: firstIndexOfTotal.get(squad.finalScore!.total)!,
        population: population.length,
        computedAt: now,
      });
      stamped += 1;
    }

    return { eligible: true, done: true, stamped, population: population.length };
  },
});

// ──────────────────────────────────────────────────────────── the read surface

export interface ReceiptSuperlative {
  playerName: string;
  slotRole: "GK" | "DEF" | "MID" | "ATT";
  isFinisher: boolean;
  points: number;
}

export interface SquadReceipt {
  squadId: Id<"fantasySquads">;
  context: "budget" | "crew";
  gameweekId: Id<"fantasyGameweeks">;
  season: string;
  gwNumber: number;
  /** The squad's own settlement instant (`finalScore.at`). */
  settledAt: number;
  total: number;
  scoredSlots: number;
  awaitingSlots: number;
  emptySlots: number;
  /** The 13, with per-player finals — `squadScore`'s own derivation. */
  slots: SlotScore[];
  /** Factual superlatives — highest and lowest contributors, never advice.
   *  Both null until two slots have numbers (one player is not a comparison). */
  best: ReceiptSuperlative | null;
  worst: ReceiptSuperlative | null;
  /** Players whose settled score the crowd moved (factor ≠ 0). */
  crowdMoved: { playerName: string; crowdFactor: number }[];
  /** Budget squads: the settlement-stamped rollup. Null for crew squads,
   *  and for a budget squad whose weekend produced no number. */
  percentile: { beatCount: number; population: number } | null;
  /** Crew squads: rank among the room's settled sheets. Null for budget. */
  crewRank: { rank: number; of: number; tied: boolean } | null;
}

export const getReceipt = query({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    context: v.union(v.literal("budget"), v.literal("crew")),
    crewRoomId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SquadReceipt | null> => {
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

    // No receipt before settlement: an unsettled weekend is a ledger.
    const gwScoring = await gameweekScoringRow(ctx, args.gameweekId);
    if (gwScoring?.state !== "final" || squad.finalScore === undefined) return null;

    const score = await squadScore(ctx, squad, gameweek, Date.now(), true);

    const scored = score.slots.filter(
      (slot) => slot.state === "scored" && slot.points !== null,
    );
    const superlative = (slot: SlotScore): ReceiptSuperlative => ({
      playerName: slot.playerName ?? "—",
      slotRole: slot.slotRole,
      isFinisher: slot.isFinisher,
      points: slot.points!,
    });
    let best: ReceiptSuperlative | null = null;
    let worst: ReceiptSuperlative | null = null;
    if (scored.length >= 2) {
      const ranked = [...scored].sort(
        (a, b) => b.points! - a.points! || a.slotIndex - b.slotIndex,
      );
      best = superlative(ranked[0]);
      worst = superlative(ranked[ranked.length - 1]);
    }

    const crowdMoved = score.slots
      .filter((slot) => slot.state === "scored" && (slot.crowdFactor ?? 0) !== 0)
      .map((slot) => ({
        playerName: slot.playerName ?? "—",
        crowdFactor: slot.crowdFactor!,
      }));

    let percentile: SquadReceipt["percentile"] = null;
    let crewRank: SquadReceipt["crewRank"] = null;

    if (squad.context === "budget") {
      const stamp = await ctx.db
        .query("fantasyGameweekPercentiles")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
        .first();
      if (stamp !== null) {
        percentile = { beatCount: stamp.beatCount, population: stamp.population };
      }
    } else if (squad.crewRoomId !== undefined) {
      const roomId = ctx.db.normalizeId("fantasyDraftRooms", squad.crewRoomId);
      const room = roomId === null ? null : await ctx.db.get(roomId);
      if (room !== null && room !== undefined) {
        // The room's settled sheets, by stamped total. ≤8 seats by spec.
        const totals: { userId: Id<"users">; total: number }[] = [];
        for (const seat of room.seats) {
          const seatSquad = await ctx.db
            .query("fantasySquads")
            .withIndex("by_user_gameweek_contextKey", (q) =>
              q
                .eq("userId", seat.userId)
                .eq("gameweekId", args.gameweekId)
                .eq("contextKey", `crew:${room._id}`),
            )
            .first();
          if (
            seatSquad !== null &&
            seatSquad.finalScore !== undefined &&
            seatSquad.finalScore.scoredSlots > 0
          ) {
            totals.push({ userId: seat.userId, total: seatSquad.finalScore.total });
          }
        }
        const mine = totals.find((t) => t.userId === userId);
        if (mine !== undefined) {
          const higher = totals.filter((t) => t.total > mine.total).length;
          const equal = totals.filter((t) => t.total === mine.total).length;
          crewRank = { rank: higher + 1, of: totals.length, tied: equal > 1 };
        }
      }
    }

    return {
      squadId: squad._id,
      context: squad.context,
      gameweekId: args.gameweekId,
      season: gameweek.season,
      gwNumber: gameweek.gwNumber,
      settledAt: squad.finalScore.at,
      total: squad.finalScore.total,
      scoredSlots: squad.finalScore.scoredSlots,
      awaitingSlots: squad.finalScore.awaitingSlots,
      emptySlots: squad.finalScore.emptySlots,
      slots: score.slots,
      best,
      worst,
      crowdMoved,
      percentile,
      crewRank,
    };
  },
});
