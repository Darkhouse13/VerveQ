/**
 * THE DRAW — server-authoritative play surface (Ticket A).
 *
 * The engine (CONTRACT v1.0) is imported, never modified. The client submits
 * ONE Choice at a time and never a score: the server replays the stored
 * choiceLog through the engine, validates + advances via applyChoice, and on
 * completion replays the full (boardSeed, choiceLog) against a freshly
 * REGENERATED board, asserting identity with the stored snapshot before any
 * result is written (B2 — catches set/config drift and tampering alike;
 * discrepancy ⇒ run rejected + draw_replay_reject funnel event).
 *
 * Sanitization (B3, Arena getRoom precedent): no public payload ever carries
 * boardSeed, undrafted future rows, or unresolved form multipliers. Draft
 * phase exposes the current row's 3 offers plus the full fixture/threshold
 * strip (design-public from board start); form appears only inside
 * post-resolution round breakdowns; the full offer grid is revealed only
 * after the run is done (the seed never).
 *
 * Access (flag gate): every public function requires drawSettings.enabled or
 * tester membership. Guests (anonymous auth users) play like anyone else.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  applyChoice,
  generateBoard,
  initRun,
  replay,
  toResult,
  type BoardSpec,
  type Card,
  type Choice,
  type ChoiceLog,
  type EngineConfig,
  type RunResult,
  type RunState,
} from "../src/lib/drawEngine";
import { ensureDailyBoard, loadCardSet } from "./drawBoards";
import { resolveDrawConfig } from "./drawSeed";
import { getTodayUTC, midnightUTCTimestamp } from "./lib/daily";
import {
  DRAW_LAUNCH_EPOCH_DATE_KEY,
  boardNumberForDate,
  nextBoardAtForDate,
} from "./lib/drawDaily";
import { DRAW_DISABLED_MESSAGE, DRAW_SIGN_IN_REQUIRED } from "./lib/drawMessages";
import { MS_PER_DAY } from "./lib/streaks";
import { userActorKey } from "./funnel";

/**
 * The UTC day BOARD #1 goes live on — OWNER-SETTABLE, must be fixed before the
 * flag opens to non-testers (moving it later renumbers every board). Defined
 * in lib/drawDaily so the client-side mock can share the exact arithmetic
 * without importing this server module; re-exported here because draw.ts is
 * where the owner looks for the mode's knobs.
 */
export { DRAW_LAUNCH_EPOCH_DATE_KEY };

// Defined in lib/drawMessages so the client can recognise these exact
// sentences without importing this module (which pulls in _generated/server).
export { DRAW_DISABLED_MESSAGE };
const SIGN_IN_REQUIRED = DRAW_SIGN_IN_REQUIRED;
const LEADERBOARD_SCAN_CAP = 5000;

// ── access gate ──

async function requireDrawUser(
  ctx: Pick<QueryCtx, "db" | "auth">,
): Promise<{ userId: Id<"users">; settings: Doc<"drawSettings"> }> {
  const userId = await getAuthUserId(ctx as QueryCtx);
  if (!userId) throw new Error(SIGN_IN_REQUIRED);
  const settings = await ctx.db.query("drawSettings").first();
  // No settings row ⇒ the mode was never provisioned ⇒ closed for everyone.
  if (!settings) throw new Error(DRAW_DISABLED_MESSAGE);
  if (!settings.enabled && !settings.testerUserIds.includes(userId)) {
    throw new Error(DRAW_DISABLED_MESSAGE);
  }
  return { userId, settings };
}

// ── engine plumbing ──

type StoredBoard = Doc<"drawDailyBoards">;

function replayState(board: BoardSpec, config: EngineConfig, log: ChoiceLog): RunState {
  let state = initRun(board);
  for (const choice of log) state = applyChoice(board, config, state, choice);
  return state;
}

function draftLineOf(log: ChoiceLog): string {
  return log
    .filter((c): c is Extract<Choice, { type: "pick" }> => c.type === "pick")
    .map((c) => String(c.offerIndex))
    .join("");
}

// ── sanitized payloads (B3) ──

// Structurally the engine's Card. Kept as its own name because it is the
// PUBLIC projection: the engine's Card may grow additive fields under the
// contract, and those must not reach a payload without a deliberate edit here.
type DrawCardView = Card;

// Explicit allowlist copies (never spread the source object) so a future
// server-only field on a snapshot can't leak by default. `position` keeps its
// PositionId union (the schema validates it as one) so the client's API
// adapter maps the payload without a widening cast.
function cardView(card: Card): DrawCardView {
  return {
    id: card.id,
    name: card.name,
    rating: card.rating,
    clubs: [...card.clubs],
    nation: card.nation,
    era: card.era,
    eraIndex: card.eraIndex,
    position: card.position,
  };
}

function fixturesView(board: StoredBoard["board"]) {
  return board.fixtures.map((fixture) => ({
    index: fixture.index,
    archetypeId: fixture.archetypeId,
    modifiers: fixture.modifiers.map((m) => ({ ...m })),
    threshold: fixture.threshold,
    isBoss: fixture.isBoss,
  }));
}

/**
 * The display-relevant knobs of the serving config. A strict subset: nothing
 * here (thresholds, archetype table, cardGen) reveals board content or form.
 * Served rather than imported client-side so the UI always describes the
 * config the board was actually generated under.
 *
 * E5 (Ticket F follow-up, scoped exception granted): formSpread and
 * maxSynergyFamilies are served for the F3 projected band. Neither is a
 * leak — formSpread is the WIDTH of the form distribution (a published rule
 * of the game), never a draw from it; per-card form stays derived from the
 * boardSeed and appears only in played-round breakdowns.
 */
function rulesView(config: EngineConfig) {
  return {
    rows: config.rows,
    offersPerRow: config.offersPerRow,
    fixtureCount: config.fixtureCount,
    synergyTable: [...config.synergyTable],
    bustKeep: config.bustKeep,
    fullClearBonus: config.fullClearBonus,
    formSpread: config.formSpread,
    maxSynergyFamilies: config.maxSynergyFamilies,
  };
}

function runView(boardDoc: StoredBoard, state: RunState, run: Doc<"drawRuns">) {
  const board = boardDoc.board;
  const byId = new Map<string, DrawCardView>();
  for (const row of board.rows) for (const card of row) byId.set(card.id, cardView(card));
  const done = state.phase === "done";
  return {
    dateKey: run.dateKey,
    // Server-derived so the client never does epoch math (Ticket C, 2b).
    boardNumber: boardNumberForDate(run.dateKey),
    status: run.status,
    phase: state.phase,
    rowIndex: state.rowIndex,
    fixtureIndex: state.fixtureIndex,
    cumulative: state.cumulative,
    squad: state.squad.map((id) => byId.get(id)!),
    // Draft phase: the current row's 3 offers ONLY — future rows stay hidden.
    offers:
      state.phase === "draft" ? board.rows[state.rowIndex].map(cardView) : null,
    // The whole gauntlet (archetypes, modifiers, thresholds) is design-public.
    fixtures: fixturesView(board),
    // Resolved rounds only — form exists nowhere else in any payload.
    rounds: state.rounds,
    outcome: state.outcome,
    finalScore: state.finalScore,
    draftLineHash: run.draftLineHash ?? null,
    completedAt: run.completedAt ?? null,
    // Post-completion full board reveal (rows only — never the seed).
    boardReveal: done ? { rows: board.rows.map((row) => row.map(cardView)) } : null,
    choiceLog: state.choiceLog,
  };
}

// ── streaks (own table; profile.ts untouched) ──

export function dayNumberFromDateKey(dateKey: string): number {
  return Math.floor(midnightUTCTimestamp(dateKey) / MS_PER_DAY);
}

export interface DrawStreakFields {
  current: number;
  best: number;
  lastPlayedDateKey: string;
}

/**
 * Streak advance for a completed run on dateKey. Consecutive UTC dateKeys
 * extend, a gap resets to 1, same-day (or a stored future day — skew guard)
 * is a no-op (null).
 */
export function nextDrawStreak(
  prev: DrawStreakFields | null,
  dateKey: string,
): DrawStreakFields | null {
  const day = dayNumberFromDateKey(dateKey);
  const lastDay = prev ? dayNumberFromDateKey(prev.lastPlayedDateKey) : undefined;
  if (lastDay !== undefined && lastDay >= day) return null;
  const current = lastDay === day - 1 ? prev!.current + 1 : 1;
  const best = Math.max(prev?.best ?? 0, current);
  return { current, best, lastPlayedDateKey: dateKey };
}

/**
 * The caller's streak as the client should read it: a streak whose last
 * completion is older than yesterday has lapsed and reads as 0 (`best` and
 * the stored row survive — only the live count lapses). Shared by getStreak
 * and getToday so the entry screen's chip and the result screen's streak can
 * never disagree.
 */
async function readDrawStreak(
  ctx: Pick<QueryCtx, "db">,
  userId: Id<"users">,
): Promise<{ current: number; best: number; lastPlayedDateKey: string | null }> {
  const doc = await ctx.db
    .query("drawStreaks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!doc) return { current: 0, best: 0, lastPlayedDateKey: null };
  const today = dayNumberFromDateKey(getTodayUTC());
  const last = dayNumberFromDateKey(doc.lastPlayedDateKey);
  return {
    current: last >= today - 1 ? doc.current : 0,
    best: doc.best,
    lastPlayedDateKey: doc.lastPlayedDateKey,
  };
}

async function advanceDrawStreak(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  dateKey: string,
): Promise<void> {
  const existing = await ctx.db
    .query("drawStreaks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const next = nextDrawStreak(existing, dateKey);
  if (!next) return;
  if (existing) {
    await ctx.db.patch(existing._id, next);
  } else {
    await ctx.db.insert("drawStreaks", { userId, ...next });
  }
}

// ── funnel events (B5) ──

type DrawFunnelType =
  | "draw_start"
  | "draw_pick"
  | "draw_bench"
  | "draw_bank"
  | "draw_bust"
  | "draw_fullclear"
  | "draw_replay_reject";

async function emitDrawEvent(
  ctx: Pick<MutationCtx, "db">,
  type: DrawFunnelType,
  userId: Id<"users">,
  meta: Record<string, unknown>,
): Promise<void> {
  await ctx.db.insert("funnelEvents", {
    type,
    actor: userActorKey(userId),
    ts: Date.now(),
    meta,
  });
}

// ── B2 replay gate ──

function sameResult(a: RunResult, b: RunResult): boolean {
  // Engine outputs are fully deterministic, so identical runs are
  // byte-identical JSON (same construction order, IEEE-754 doubles).
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Regenerate the board from (boardSeed, live card set, pinned config) and
 * replay the full choiceLog; the result must be identical to the snapshot
 * replay. On discrepancy the reject is LOGGED and returned (not thrown) —
 * a throw would roll the funnel event back with the rest of the transaction.
 */
async function verifyReplayIdentity(
  ctx: Pick<MutationCtx, "db">,
  boardDoc: StoredBoard,
  config: EngineConfig,
  finished: RunState,
  userId: Id<"users">,
): Promise<{ ok: true; result: RunResult } | { ok: false }> {
  const fromSnapshot = toResult(finished);
  const fullSet = await loadCardSet(ctx, boardDoc.setVersion);
  // E5 — a Daily Deck board pins its slice: regenerate from EXACTLY the
  // pinned card ids (in the stored, id-sorted order), never by re-running
  // slice selection — a generator change must not invalidate old boards.
  // A pinned id missing from the live set is a genuine identity break and
  // falls through to the reject path via the failed replay.
  let cardSet = fullSet;
  if (boardDoc.sliceCardIds) {
    const byId = new Map(fullSet.map((c) => [c.id, c]));
    cardSet = boardDoc.sliceCardIds.flatMap((id) => {
      const card = byId.get(id);
      return card ? [card] : [];
    });
  }
  const regenerated = generateBoard(boardDoc.boardSeed, cardSet, config);
  let fromRegenerated: RunResult | null = null;
  let replayError: string | null = null;
  try {
    fromRegenerated = replay(regenerated, config, finished.choiceLog);
  } catch (error) {
    replayError = error instanceof Error ? error.message : String(error);
  }
  if (!fromRegenerated || !sameResult(fromSnapshot, fromRegenerated)) {
    await emitDrawEvent(ctx, "draw_replay_reject", userId, {
      dateKey: boardDoc.dateKey,
      setVersion: boardDoc.setVersion,
      configVersion: boardDoc.configVersion,
      snapshotScore: fromSnapshot.finalScore,
      regeneratedScore: fromRegenerated?.finalScore ?? null,
      replayError,
    });
    return { ok: false };
  }
  return { ok: true, result: fromSnapshot };
}

// ── public mutations ──

/**
 * Idempotently make sure today's board exists (lazy half of B1 — the daily
 * cron is the other). Returns board meta + the design-public gauntlet only.
 */
export const ensureToday = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDrawUser(ctx);
    const dateKey = getTodayUTC();
    const boardDoc = await ensureDailyBoard(ctx, dateKey);
    return {
      dateKey,
      setVersion: boardDoc.setVersion,
      configVersion: boardDoc.configVersion,
      fixtures: fixturesView(boardDoc.board),
    };
  },
});

/**
 * Start (or resume) the caller's run for today. One run per user per dateKey:
 * if a run already exists — in any state — it is returned instead of a new
 * one being created.
 */
export const startRun = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const { userId, settings } = await requireDrawUser(ctx);
    const dateKey = getTodayUTC();
    const boardDoc = await ensureDailyBoard(ctx, dateKey);
    const config = resolveDrawConfig(boardDoc.configVersion);

    const existing = await ctx.db
      .query("drawRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
      .first();
    if (existing) {
      const state = replayState(boardDoc.board, config, existing.choiceLog);
      return runView(boardDoc, state, existing);
    }

    const runId = await ctx.db.insert("drawRuns", {
      userId,
      dateKey,
      boardId: boardDoc._id,
      choiceLog: [],
      status: "drafting",
      startedAt: Date.now(),
    });
    await emitDrawEvent(ctx, "draw_start", userId, {
      dateKey,
      setVersion: settings.activeSetVersion,
      configVersion: settings.configVersion,
    });
    const run = (await ctx.db.get(runId))!;
    return runView(boardDoc, replayState(boardDoc.board, config, []), run);
  },
});

const choiceArg = v.union(
  v.object({ type: v.literal("pick"), offerIndex: v.number() }),
  v.object({ type: v.literal("bench"), squadIndex: v.number() }),
  v.object({ type: v.literal("bank") }),
  v.object({ type: v.literal("push") }),
);

/**
 * Apply ONE choice to the caller's run for today (B2). The engine is the
 * validator: an illegal choice (wrong phase, index out of range) throws and
 * persists nothing. Completion runs the replay gate before any result write;
 * a gate failure persists ONLY the draw_replay_reject funnel event — the
 * completing choice and any result are discarded and `replayRejected: true`
 * is returned with the pre-choice state.
 */
export const submitChoice = mutation({
  args: { choice: choiceArg },
  handler: async (ctx, { choice }) => {
    const { userId } = await requireDrawUser(ctx);
    const dateKey = getTodayUTC();
    const run = await ctx.db
      .query("drawRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
      .first();
    if (!run) throw new Error("No run for today — call startRun first");
    if (run.status !== "drafting" && run.status !== "running") {
      throw new Error("Run is finished");
    }
    const boardDoc = await ctx.db.get(run.boardId);
    if (!boardDoc) throw new Error("Board missing for run");
    const config = resolveDrawConfig(boardDoc.configVersion);

    const state = replayState(boardDoc.board, config, run.choiceLog);
    const next = applyChoice(boardDoc.board, config, state, choice);

    // Draft line fingerprint the moment the draft completes.
    const draftLineHash =
      run.draftLineHash ??
      (next.phase !== "draft" ? draftLineOf(next.choiceLog) : undefined);

    if (next.phase === "done") {
      // Replay gate BEFORE any write of the result.
      const gate = await verifyReplayIdentity(ctx, boardDoc, config, next, userId);
      if (!gate.ok) {
        return {
          replayRejected: true as const,
          run: runView(boardDoc, state, run),
        };
      }
      const result = gate.result;
      const status = result.outcome; // banked | busted | fullclear
      await ctx.db.patch(run._id, {
        choiceLog: next.choiceLog,
        status,
        draftLineHash,
        score: result.finalScore,
        result: {
          finalScore: result.finalScore,
          roundsCleared: result.roundsCleared,
          outcome: result.outcome,
          rounds: result.rounds,
        },
        completedAt: Date.now(),
      });
      await advanceDrawStreak(ctx, userId, dateKey);
      if (choice.type === "pick" || choice.type === "bench") {
        await emitChoiceEvent(ctx, userId, dateKey, state, choice);
      }
      const outcomeEvent =
        result.outcome === "banked"
          ? "draw_bank"
          : result.outcome === "busted"
            ? "draw_bust"
            : "draw_fullclear";
      await emitDrawEvent(ctx, outcomeEvent, userId, {
        dateKey,
        score: result.finalScore,
        roundsCleared: result.roundsCleared,
        draftLineHash,
      });
    } else {
      await ctx.db.patch(run._id, {
        choiceLog: next.choiceLog,
        status: next.phase === "draft" ? "drafting" : "running",
        ...(draftLineHash !== undefined ? { draftLineHash } : {}),
      });
      if (choice.type === "pick" || choice.type === "bench") {
        await emitChoiceEvent(ctx, userId, dateKey, state, choice);
      }
    }

    const updated = (await ctx.db.get(run._id))!;
    return { replayRejected: false as const, run: runView(boardDoc, next, updated) };
  },
});

async function emitChoiceEvent(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  dateKey: string,
  before: RunState,
  choice: Extract<Choice, { type: "pick" } | { type: "bench" }>,
): Promise<void> {
  if (choice.type === "pick") {
    await emitDrawEvent(ctx, "draw_pick", userId, {
      dateKey,
      rowIndex: before.rowIndex,
      offerIndex: choice.offerIndex,
    });
  } else {
    await emitDrawEvent(ctx, "draw_bench", userId, {
      dateKey,
      fixtureIndex: before.fixtureIndex,
      squadIndex: choice.squadIndex,
    });
  }
}

// ── public queries (B4) ──

/**
 * Today's board meta + the caller's run state (sanitized).
 *
 * Carries everything the entry screen renders — boardNumber, playState,
 * streak, rules, nextBoardAt — so the client is a pure renderer and its API
 * adapter needs no derivation of its own. Deriving any of these client-side
 * would mean a second implementation of server truth, which is exactly how
 * the mock and the server drift apart.
 */
export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireDrawUser(ctx);
    const dateKey = getTodayUTC();
    const streak = await readDrawStreak(ctx, userId);
    const meta = {
      dateKey,
      boardNumber: boardNumberForDate(dateKey),
      nextBoardAt: nextBoardAtForDate(dateKey),
      streak: streak.current,
    };
    const boardDoc = await ctx.db
      .query("drawDailyBoards")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .first();
    if (!boardDoc) {
      // Cron hasn't run yet — the client calls ensureToday (mutation) to
      // generate lazily; queries can't write.
      return {
        ...meta,
        boardReady: false as const,
        fixtures: null,
        rules: null,
        playState: "unplayed" as const,
        run: null,
      };
    }
    const run = await ctx.db
      .query("drawRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
      .first();
    const config = resolveDrawConfig(boardDoc.configVersion);
    const state = run ? replayState(boardDoc.board, config, run.choiceLog) : null;
    return {
      ...meta,
      boardReady: true as const,
      fixtures: fixturesView(boardDoc.board),
      rules: rulesView(config),
      playState:
        state === null
          ? ("unplayed" as const)
          : state.phase === "done"
            ? ("done" as const)
            : ("in_progress" as const),
      run: run && state ? runView(boardDoc, state, run) : null,
    };
  },
});

async function completedRunsForDate(
  ctx: Pick<QueryCtx, "db">,
  dateKey: string,
): Promise<Doc<"drawRuns">[]> {
  // by_date_score descending puts scored (completed) runs first and the
  // in-progress (score undefined) tail last.
  const rows = await ctx.db
    .query("drawRuns")
    .withIndex("by_date_score", (q) => q.eq("dateKey", dateKey))
    .order("desc")
    .take(LEADERBOARD_SCAN_CAP);
  return rows
    .filter((run) => run.score !== undefined && run.completedAt !== undefined)
    .sort(
      (a, b) =>
        b.score! - a.score! ||
        a.completedAt! - b.completedAt! ||
        a._creationTime - b._creationTime,
    );
}

/** Top N + caller rank for a dateKey (default today). Ties: earlier finish. */
export const getLeaderboard = query({
  args: { dateKey: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await requireDrawUser(ctx);
    const dateKey = args.dateKey ?? getTodayUTC();
    const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
    const completed = await completedRunsForDate(ctx, dateKey);

    const top = await Promise.all(
      completed.slice(0, limit).map(async (run, i) => {
        const user = await ctx.db.get(run.userId);
        return {
          rank: i + 1,
          userId: run.userId,
          name: user?.displayName ?? user?.username ?? "Player",
          score: run.score!,
          outcome: run.result?.outcome ?? run.status,
          roundsCleared: run.result?.roundsCleared ?? 0,
        };
      }),
    );

    const myIndex = completed.findIndex((run) => run.userId === userId);
    return {
      dateKey,
      total: completed.length,
      entries: top,
      me:
        myIndex >= 0
          ? { rank: myIndex + 1, score: completed[myIndex].score! }
          : null,
    };
  },
});

/** Share of completed runs that drafted the caller's exact line. */
export const getRarity = query({
  args: { dateKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId } = await requireDrawUser(ctx);
    const dateKey = args.dateKey ?? getTodayUTC();
    const myRun = await ctx.db
      .query("drawRuns")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
      .first();
    if (!myRun?.draftLineHash) return null;
    const completed = await completedRunsForDate(ctx, dateKey);
    const total = completed.length;
    const count = completed.filter(
      (run) => run.draftLineHash === myRun.draftLineHash,
    ).length;
    return {
      dateKey,
      draftLineHash: myRun.draftLineHash,
      count,
      total,
      sharePct: total > 0 ? (100 * count) / total : null,
    };
  },
});

/** Caller's daily-draw streak. A streak older than yesterday reads as 0. */
export const getStreak = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireDrawUser(ctx);
    return await readDrawStreak(ctx, userId);
  },
});
