/**
 * LocalMockApi (Ticket B, X2) — DEV-ONLY implementation of DrawApi that runs
 * the frozen v1.0 engine in-browser against the pinned synthetic card set.
 *
 * Every screen runs fully against this mock; the Convex implementation is a
 * later ticket. Two production behaviors are reproduced here so the UI is
 * built against honest semantics:
 *
 *  - P0-RUNTIME reroll chain (CONTRACT INVARIANT, Ticket 0.4): the served
 *    board is the first non-dead k in `${dateSeed}#k` for k = 0, 1, 2, … —
 *    a pure function of the date, so every user gets the same board. Dead
 *    boards are detected with the exact enumeration (per draft line, a round
 *    is clearable iff SOME bench choice clears it; rounds are independent
 *    given the squad, so per-round max-over-bench is exact).
 *
 *  - Sanitization at the mock boundary: responses are built (and deep-cloned)
 *    per drawApi/types.ts — current draft row only, no form before a round
 *    resolves, and the board seed never leaves this module.
 *
 * Run state and streak persist in localStorage so play-state survives a
 * reload (resume, "done" entry state), keyed by UTC day.
 */

import {
  applyChoice,
  deserializeRunState,
  generateBoard,
  generateCardSet,
  initRun,
  rngFromString,
  rngInt,
  serializeRunState,
  tagSuffix,
} from "@/lib/drawEngine";
import type {
  BoardSpec,
  Card,
  Choice,
  EngineConfig,
  RunState,
} from "@/lib/drawEngine";
import { scoreRound } from "@/lib/drawEngine";
import type {
  DrawApi,
  DrawLeaderboardEntry,
  DrawRarity,
  DrawRunView,
  DrawStreak,
  DrawToday,
} from "./types";
import {
  MOCK_CARD_SET_SEED,
  MOCK_ENGINE_CONFIG,
  MOCK_EPOCH_DATE_KEY,
} from "./mockConfig";

const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = "verveq-draw-mock";
/** Reroll-chain backstop; dead-board rate is ~2% per k, so 50 is astronomical. */
const MAX_REROLLS = 50;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalMockApiOptions {
  /** Clock override (epoch ms) — tests pin the day. Defaults to Date.now. */
  now?: () => number;
  /** Storage override; null disables persistence. Defaults to localStorage. */
  storage?: StorageLike | null;
}

interface StreakRecord {
  current: number;
  best: number;
  lastDoneKey: string | null;
}

function utcDateKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function dateKeyToUtcMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

/**
 * EXACT full-clearability check (the mock's stand-in for detectDeadBoard —
 * the standalone detector lives in the sim harness, outside the app build).
 * A board is alive iff some draft line clears every fixture; per line and
 * fixture, "clearable" = max round score over the 6 bench choices ≥ threshold
 * (rounds are additive and independent given the squad, so this is exact).
 */
export function boardFullClearable(board: BoardSpec, config: EngineConfig): boolean {
  const lines = Math.pow(config.offersPerRow, config.rows);
  for (let line = 0; line < lines; line++) {
    const squad: Card[] = [];
    let x = line;
    for (let r = 0; r < config.rows; r++) {
      squad.push(board.rows[r][x % config.offersPerRow]);
      x = Math.floor(x / config.offersPerRow);
    }
    let clearsAll = true;
    for (const fixture of board.fixtures) {
      let best = 0;
      for (let b = 0; b < squad.length; b++) {
        const fielded = squad.filter((_, i) => i !== b);
        const round = scoreRound(board.seed, fielded, fixture, config, squad[b].id);
        if (round.score > best) best = round.score;
        if (best >= fixture.threshold) break;
      }
      if (best < fixture.threshold) {
        clearsAll = false;
        break;
      }
    }
    if (clearsAll) return true;
  }
  return false;
}

/**
 * P0-runtime reroll chain: first non-dead k for the day. Pure function of
 * (dateKey, cardSet, config) — every user resolves the same board.
 */
export function resolveBoardForDate(
  dateKey: string,
  cardSet: Card[],
  config: EngineConfig,
): { board: BoardSpec; rerolls: number } {
  for (let k = 0; k < MAX_REROLLS; k++) {
    const board = generateBoard(`draw-${dateKey}#${k}`, cardSet, config);
    if (boardFullClearable(board, config)) return { board, rerolls: k };
  }
  throw new Error(`No live board found for ${dateKey} within ${MAX_REROLLS} rerolls`);
}

/** Deep clone so internal state never leaks by reference across the boundary. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class LocalMockApi implements DrawApi {
  private readonly config: EngineConfig;
  private readonly cardSet: Card[];
  private readonly now: () => number;
  private readonly storage: StorageLike | null;
  /** Memoized per-day board resolution (the clearability sweep runs once). */
  private boardCache: { dateKey: string; board: BoardSpec } | null = null;
  /** In-memory run fallback when storage is unavailable. */
  private memoryRun: { dateKey: string; json: string } | null = null;
  private memoryStreak: StreakRecord = { current: 0, best: 0, lastDoneKey: null };

  constructor(options: LocalMockApiOptions = {}) {
    this.config = MOCK_ENGINE_CONFIG;
    this.cardSet = generateCardSet(MOCK_CARD_SET_SEED, this.config.cardGen);
    this.now = options.now ?? (() => Date.now());
    this.storage =
      options.storage !== undefined
        ? options.storage
        : typeof window !== "undefined" && window.localStorage
          ? window.localStorage
          : null;
  }

  // ---- DrawApi ------------------------------------------------------------

  async getToday(): Promise<DrawToday> {
    const dateKey = this.dateKey();
    const board = this.board(dateKey);
    const state = this.loadRun(dateKey);
    return clone({
      boardNumber: this.boardNumber(dateKey),
      dateKey,
      fixtures: board.fixtures,
      playState: state === null ? "unplayed" : state.phase === "done" ? "done" : "in_progress",
      streak: this.streakRecord().current,
      rules: {
        rows: this.config.rows,
        offersPerRow: this.config.offersPerRow,
        fixtureCount: this.config.fixtureCount,
        synergyTable: this.config.synergyTable,
        bustKeep: this.config.bustKeep,
        fullClearBonus: this.config.fullClearBonus,
      },
      nextBoardAt: dateKeyToUtcMs(dateKey) + DAY_MS,
    });
  }

  async startRun(): Promise<DrawRunView> {
    const dateKey = this.dateKey();
    const board = this.board(dateKey);
    let state = this.loadRun(dateKey);
    if (state === null) {
      state = initRun(board);
      this.saveRun(dateKey, state);
    }
    return this.sanitize(dateKey, board, state);
  }

  async submitChoice(choice: Choice): Promise<DrawRunView> {
    const dateKey = this.dateKey();
    const board = this.board(dateKey);
    const state = this.loadRun(dateKey);
    if (state === null) throw new Error("No run in progress — call startRun first");
    const next = applyChoice(board, this.config, state, choice);
    this.saveRun(dateKey, next);
    if (next.phase === "done") this.markDone(dateKey);
    return this.sanitize(dateKey, board, next);
  }

  async getLeaderboard(): Promise<DrawLeaderboardEntry[]> {
    const dateKey = this.dateKey();
    const board = this.board(dateKey);
    const rng = rngFromString(`${board.seed}|mock-leaderboard`);
    const entries: DrawLeaderboardEntry[] = [];
    for (let i = 0; i < 7; i++) {
      const busted = rng() < 0.35;
      const fullclear = !busted && rng() < 0.2;
      const score = Math.round(
        busted ? 60 + rng() * 400 : 500 + rng() * (fullclear ? 4200 : 2400),
      );
      entries.push({
        rank: 0,
        name: `DRAFTER_${tagSuffix(rngInt(rng, 200))}${rngInt(rng, 90) + 10}`,
        score,
        outcome: busted ? "busted" : fullclear ? "fullclear" : "banked",
      });
    }
    const state = this.loadRun(dateKey);
    if (state !== null && state.phase === "done" && state.outcome !== null) {
      entries.push({
        rank: 0,
        name: "YOU",
        score: Math.round(state.finalScore ?? 0),
        outcome: state.outcome,
        isYou: true,
      });
    }
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, i) => {
      entry.rank = i + 1;
    });
    return clone(entries);
  }

  async getRarity(): Promise<DrawRarity> {
    const dateKey = this.dateKey();
    const state = this.loadRun(dateKey);
    if (state === null || state.squad.length < this.config.rows) {
      throw new Error("Rarity is only available for a completed draft");
    }
    // Deterministic pseudo-rarity from the drafted line: same line, same %.
    const u = rngFromString(`${dateKey}|mock-rarity|${state.squad.join(",")}`)();
    return { linePercent: Math.round((0.4 + u * 23.6) * 10) / 10 };
  }

  async getStreak(): Promise<DrawStreak> {
    const record = this.streakRecord();
    return { current: record.current, best: record.best };
  }

  // ---- internals ------------------------------------------------------------

  private dateKey(): string {
    return utcDateKey(this.now());
  }

  private boardNumber(dateKey: string): number {
    return (
      Math.round((dateKeyToUtcMs(dateKey) - dateKeyToUtcMs(MOCK_EPOCH_DATE_KEY)) / DAY_MS) + 1
    );
  }

  private board(dateKey: string): BoardSpec {
    if (this.boardCache?.dateKey !== dateKey) {
      const { board } = resolveBoardForDate(dateKey, this.cardSet, this.config);
      this.boardCache = { dateKey, board };
    }
    return this.boardCache.board;
  }

  /** The sanitization boundary — see drawApi/types.ts for the rules. */
  private sanitize(dateKey: string, board: BoardSpec, state: RunState): DrawRunView {
    const byId = new Map<string, Card>();
    for (const row of board.rows) for (const card of row) byId.set(card.id, card);
    return clone({
      boardNumber: this.boardNumber(dateKey),
      phase: state.phase,
      rowIndex: state.rowIndex,
      currentRow: state.phase === "draft" ? board.rows[state.rowIndex] : null,
      squad: state.squad.map((id) => byId.get(id)!),
      fixtures: board.fixtures,
      fixtureIndex: state.fixtureIndex,
      cumulative: state.cumulative,
      rounds: state.rounds,
      outcome: state.outcome,
      finalScore: state.finalScore,
      fullBoard: state.phase === "done" ? board.rows : null,
    });
  }

  private runKey(dateKey: string): string {
    return `${STORAGE_PREFIX}:run:${dateKey}`;
  }

  private loadRun(dateKey: string): RunState | null {
    if (this.storage === null) {
      return this.memoryRun?.dateKey === dateKey
        ? deserializeRunState(this.memoryRun.json)
        : null;
    }
    try {
      const json = this.storage.getItem(this.runKey(dateKey));
      return json ? deserializeRunState(json) : null;
    } catch {
      return null;
    }
  }

  private saveRun(dateKey: string, state: RunState): void {
    const json = serializeRunState(state);
    if (this.storage === null) {
      this.memoryRun = { dateKey, json };
      return;
    }
    try {
      this.storage.setItem(this.runKey(dateKey), json);
    } catch {
      this.memoryRun = { dateKey, json };
    }
  }

  private streakKey(): string {
    return `${STORAGE_PREFIX}:streak`;
  }

  private streakRecord(): StreakRecord {
    if (this.storage === null) return this.memoryStreak;
    try {
      const json = this.storage.getItem(this.streakKey());
      if (!json) return { current: 0, best: 0, lastDoneKey: null };
      const parsed = JSON.parse(json) as StreakRecord;
      return {
        current: parsed.current ?? 0,
        best: parsed.best ?? 0,
        lastDoneKey: parsed.lastDoneKey ?? null,
      };
    } catch {
      return { current: 0, best: 0, lastDoneKey: null };
    }
  }

  private markDone(dateKey: string): void {
    const record = this.streakRecord();
    if (record.lastDoneKey === dateKey) return;
    const yesterdayKey = utcDateKey(dateKeyToUtcMs(dateKey) - DAY_MS);
    const current = record.lastDoneKey === yesterdayKey ? record.current + 1 : 1;
    const next: StreakRecord = {
      current,
      best: Math.max(record.best, current),
      lastDoneKey: dateKey,
    };
    if (this.storage === null) {
      this.memoryStreak = next;
      return;
    }
    try {
      this.storage.setItem(this.streakKey(), JSON.stringify(next));
    } catch {
      this.memoryStreak = next;
    }
  }
}
