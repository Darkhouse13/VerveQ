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

import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  generateBoard,
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
  const cardSet = await loadCardSet(ctx, settings.activeSetVersion);
  const { boardSeed, rerollIndex, board } = computeDailyBoard(dateKey, cardSet, config);

  const boardId = await ctx.db.insert("drawDailyBoards", {
    dateKey,
    boardSeed,
    rerollIndex,
    setVersion: settings.activeSetVersion,
    configVersion: settings.configVersion,
    board,
    generatedAt: Date.now(),
  });
  const inserted = await ctx.db.get(boardId);
  if (!inserted) throw new Error("drawDailyBoards insert vanished");
  return inserted;
}

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
