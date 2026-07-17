/**
 * THE DRAW — daily board generation (P0-runtime CONTRACT INVARIANT).
 *
 * boardSeed is a pure function of the UTC dateKey: the served board is the
 * FIRST k in dailyBoardSeed(dateKey, k), k = 0, 1, 2, …, whose board passes
 * detectDeadBoard (the exact oracle detector — no draft line can full-clear
 * ⇒ dead ⇒ reroll). Every user therefore gets the same board and the
 * player-facing dead-board rate is 0% by construction (drawEngine/types.ts).
 *
 * Generation is idempotent (upsert by dateKey) and runs from two triggers:
 * the daily cron below and lazily from draw.ts on the first request of the
 * day. The resolved BoardSpec is snapshotted on the row as an audit pin
 * against card-set/config drift; draw.ts replays completions against a fresh
 * regeneration to enforce the pin (B2).
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  DAILY_SLICE_CONFIG_V1,
  DAILY_SLICE_CONFIG_VERSION,
  generateBoard,
  sliceDeck,
  type BoardSpec,
  type Card,
  type EngineConfig,
} from "../src/lib/drawEngine";
import { buildContext } from "../scripts/drawSim/boardContext";
import { detectDeadBoard } from "../scripts/drawSim/oracle";
import { resolveDrawConfig } from "./drawSeed";
import { getTodayUTC } from "./lib/daily";

// The oracle stamps a diagnostics timing via performance.now(); the Convex
// default runtime may not expose `performance`, so shim it (timing quality
// is irrelevant here — only detectDeadBoard's boolean is used).
const globalWithPerformance = globalThis as { performance?: { now: () => number } };
if (typeof globalWithPerformance.performance === "undefined") {
  globalWithPerformance.performance = { now: () => Date.now() };
}

// The worst acceptance-rotation set was 91.4% full-clearable, so P(100
// consecutive dead boards) is beyond astronomical; hitting this cap means the
// card set or config is broken, not bad luck.
const MAX_REROLLS = 100;

export function dailyBoardSeed(dateKey: string, rerollIndex: number): string {
  return `draw|${dateKey}|k${rerollIndex}`;
}

/**
 * Ticket E5 — DAILY DECK. Sets at or above this size are served as a daily
 * SLICE (sliceDeck on the dateKey; same slice for every user and every
 * reroll k — only the BOARD seed varies within the slice). Small sets (the
 * 50-card synthetic set) are served whole: they already ARE the density
 * profile the slice restores, and sliceDeck's nation-eligibility floors are
 * unsatisfiable on them by construction.
 *
 * Production computes the slice with sliceDeck's DEFAULT tie-break scorer —
 * an in-session owner ruling (see drawEngine/DECISIONS.md, Ticket E4/E5):
 * the screened acceptance scorer costs minutes and cannot run in Convex.
 */
export const DAILY_SLICE_MIN_SET = 100;

/** The day's card pool: a Daily Deck slice for large sets, the set itself
 * otherwise. Pure in (dateKey, fullSet) — regeneration is byte-identical. */
export function dailyCardPool(
  dateKey: string,
  fullSet: Card[],
): { cards: Card[]; sliced: boolean } {
  if (fullSet.length < DAILY_SLICE_MIN_SET) return { cards: fullSet, sliced: false };
  return { cards: sliceDeck(dateKey, fullSet, DAILY_SLICE_CONFIG_V1), sliced: true };
}

export interface DailyBoardResult {
  boardSeed: string;
  rerollIndex: number;
  board: BoardSpec;
}

/**
 * Pure: walk the reroll chain to the first non-dead board. Deterministic in
 * (dateKey, cardSet order, config) — regenerating for the same date MUST
 * yield an identical board (tested).
 */
export function computeDailyBoard(
  dateKey: string,
  cardSet: Card[],
  config: EngineConfig,
): DailyBoardResult {
  for (let k = 0; k < MAX_REROLLS; k++) {
    const boardSeed = dailyBoardSeed(dateKey, k);
    const board = generateBoard(boardSeed, cardSet, config);
    if (!detectDeadBoard(buildContext(board, config))) {
      return { boardSeed, rerollIndex: k, board };
    }
  }
  throw new Error(
    `No live board within ${MAX_REROLLS} rerolls for ${dateKey} — card set or config is broken`,
  );
}

/**
 * Load a card set from the DB in a deterministic order (sorted by cardId —
 * generateBoard samples by array position, so ordering is part of the board
 * derivation).
 */
export async function loadCardSet(
  ctx: Pick<QueryCtx, "db">,
  setVersion: string,
): Promise<Card[]> {
  const rows = await ctx.db
    .query("drawCards")
    .withIndex("by_setVersion", (q) => q.eq("setVersion", setVersion))
    .collect();
  if (rows.length === 0) {
    throw new Error(`No drawCards for setVersion "${setVersion}" — seed first`);
  }
  return rows
    .sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0))
    .map((row) => ({
      id: row.cardId,
      name: row.name,
      rating: row.rating,
      clubs: row.clubs,
      nation: row.nation,
      era: row.era,
      eraIndex: row.eraIndex,
      position: row.position,
    }));
}

/** Idempotent upsert: return the existing board for dateKey or generate it. */
export async function ensureDailyBoard(
  ctx: Pick<MutationCtx, "db">,
  dateKey: string,
): Promise<Doc<"drawDailyBoards">> {
  const existing = await ctx.db
    .query("drawDailyBoards")
    .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
    .first();
  if (existing) return existing;

  const settings = await ctx.db.query("drawSettings").first();
  if (!settings) {
    throw new Error("drawSettings missing — run drawSeed:seedSyntheticCards first");
  }
  const config = resolveDrawConfig(settings.configVersion);
  const fullSet = await loadCardSet(ctx, settings.activeSetVersion);
  // E5 — Daily Deck: large sets serve a per-dateKey slice; the reroll chain
  // varies only the board seed WITHIN the slice. The row pins the realized
  // slice (card ids + profile version) so replay identity and audits never
  // depend on re-running selection.
  const pool = dailyCardPool(dateKey, fullSet);
  const { boardSeed, rerollIndex, board } = computeDailyBoard(dateKey, pool.cards, config);

  const boardId = await ctx.db.insert("drawDailyBoards", {
    dateKey,
    boardSeed,
    rerollIndex,
    setVersion: settings.activeSetVersion,
    configVersion: settings.configVersion,
    ...(pool.sliced
      ? {
          sliceCardIds: pool.cards.map((c) => c.id),
          sliceConfigVersion: DAILY_SLICE_CONFIG_VERSION,
        }
      : {}),
    board,
    generatedAt: Date.now(),
  });
  const inserted = await ctx.db.get(boardId);
  if (!inserted) throw new Error("drawDailyBoards insert vanished");
  return inserted;
}

/**
 * Ticket E5 — ops regeneration for a set/config switch. Deletes and
 * recreates the board for a date so it reflects the CURRENT settings.
 *
 * FAIL-CLOSED GUARDS: throws unless drawSettings.enabled === false (a live
 * mode must never have its board swapped underneath players), and throws if
 * any run exists for the date (a regenerated board would orphan the run's
 * choiceLog against the B2 replay gate).
 *
 * Idempotent: generation is pure in (dateKey, settings, card set), so when
 * the existing row already matches a fresh computation nothing is written
 * and { unchanged: true } is returned; a second call after a regeneration
 * always lands here.
 *
 * Run: npx convex run drawBoards:regenerateBoardForDate '{"dateKey":"YYYY-MM-DD"}'
 */
export const regenerateBoardForDate = internalMutation({
  args: { dateKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const dateKey = args.dateKey ?? getTodayUTC();
    const settings = await ctx.db.query("drawSettings").first();
    if (!settings) throw new Error("drawSettings missing — seed first");
    if (settings.enabled !== false) {
      throw new Error(
        "regenerateBoardForDate refused: drawSettings.enabled must be false (regenerating a live board would swap it underneath players)",
      );
    }
    const anyRun = await ctx.db
      .query("drawRuns")
      .withIndex("by_date_score", (q) => q.eq("dateKey", dateKey))
      .first();
    if (anyRun) {
      throw new Error(
        `regenerateBoardForDate refused: drawRuns exist for ${dateKey} — a regenerated board would orphan their choiceLogs`,
      );
    }

    const config = resolveDrawConfig(settings.configVersion);
    const fullSet = await loadCardSet(ctx, settings.activeSetVersion);
    const pool = dailyCardPool(dateKey, fullSet);
    const fresh = computeDailyBoard(dateKey, pool.cards, config);

    const existing = await ctx.db
      .query("drawDailyBoards")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .first();
    const summary = {
      dateKey,
      setVersion: settings.activeSetVersion,
      configVersion: settings.configVersion,
      boardSeed: fresh.boardSeed,
      rerollIndex: fresh.rerollIndex,
      sliced: pool.sliced,
      sliceCardCount: pool.sliced ? pool.cards.length : null,
    };
    if (
      existing &&
      existing.boardSeed === fresh.boardSeed &&
      existing.setVersion === settings.activeSetVersion &&
      existing.configVersion === settings.configVersion &&
      JSON.stringify(existing.board) === JSON.stringify(fresh.board) &&
      JSON.stringify(existing.sliceCardIds ?? null) ===
        JSON.stringify(pool.sliced ? pool.cards.map((c) => c.id) : null)
    ) {
      return { ...summary, unchanged: true as const };
    }
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("drawDailyBoards", {
      dateKey,
      boardSeed: fresh.boardSeed,
      rerollIndex: fresh.rerollIndex,
      setVersion: settings.activeSetVersion,
      configVersion: settings.configVersion,
      ...(pool.sliced
        ? {
            sliceCardIds: pool.cards.map((c) => c.id),
            sliceConfigVersion: DAILY_SLICE_CONFIG_VERSION,
          }
        : {}),
      board: fresh.board,
      generatedAt: Date.now(),
    });
    return { ...summary, unchanged: false as const, replacedExisting: Boolean(existing) };
  },
});

/** Daily cron target (see convex/crons.ts). Safe to run repeatedly. */
export const generateTodaysBoard = internalMutation({
  args: {},
  handler: async (ctx) => {
    const dateKey = getTodayUTC();
    const before = await ctx.db
      .query("drawDailyBoards")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .first();
    const board = before ?? (await ensureDailyBoard(ctx, dateKey));
    return {
      dateKey,
      created: !before,
      boardSeed: board.boardSeed,
      rerollIndex: board.rerollIndex,
      setVersion: board.setVersion,
      configVersion: board.configVersion,
    };
  },
});
