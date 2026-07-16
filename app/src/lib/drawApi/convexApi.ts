/**
 * ConvexDrawApi (Ticket C, Step 2) — the DrawApi implementation the app runs
 * on. A THIN MAPPING LAYER over convex/draw.ts and nothing else.
 *
 * ── The rule ──
 * This file contains NO game logic. Every number the UI renders is computed
 * server-side and passed through here unchanged; the adapter only renames and
 * reshapes. Two consequences worth stating, because both are load-bearing:
 *
 *  - The SERVER is the only authority. boardNumber, rules, playState, streak
 *    and nextBoardAt are all served (Ticket C, 2b) rather than derived here.
 *    A client-side derivation would be a second implementation of server truth
 *    — the exact way the mock and the server drift apart.
 *  - Sanitization is INHERITED, not re-applied. convex/draw.ts already
 *    guarantees no boardSeed, no un-drafted rows and no pre-resolution form
 *    (B3). This layer must not widen that: it copies named fields only and
 *    never spreads a server payload into a response.
 *
 * ── Rename map (server shape → DrawApi shape) ──
 *
 *   getToday        run.offers            → DrawRunView.currentRow
 *                   run.boardReveal.rows  → DrawRunView.fullBoard
 *                   dateKey               → kept (DrawToday.dateKey); the
 *                                           per-call dateKey the server
 *                                           resolves stays INTERNAL — the
 *                                           adapter never sends one, so the
 *                                           server's UTC clock is the only
 *                                           clock in play.
 *                   boardNumber/rules/playState/streak/nextBoardAt → passthrough
 *                   boardReady:false      → ensureToday(), then re-read
 *   startRun        (run view)            → DrawRunView
 *   submitChoice    {replayRejected, run} → DrawRunView | throw
 *   getLeaderboard  {entries, me}         → DrawLeaderboardEntry[]
 *                   entry.userId          → DROPPED (never reaches the client;
 *                                           `isYou` comes from me.rank instead)
 *                   entry.roundsCleared   → DROPPED (not in the UI contract)
 *   getRarity       sharePct              → DrawRarity.linePercent
 *   getStreak       lastPlayedDateKey     → DROPPED (not in the UI contract)
 *
 * Passthrough (same name, same meaning, no transform): phase, rowIndex,
 * fixtureIndex, cumulative, squad, fixtures, rounds, outcome, finalScore,
 * status, draftLineHash.
 *
 * ── Seed scheme ──
 * The server's board seed scheme `draw|<dateKey>|k<k>` is canonical and is
 * SERVER-ONLY: it never appears in a payload, so it never appears here. The
 * mock's `draw-${dateKey}#${k}` is dev-only and never leaves the mock.
 * drawAdapterContract.test.ts deep-scans adapter output for both formats.
 */

import { api } from "../../../convex/_generated/api";
import type {
  DrawApi,
  DrawLeaderboardEntry,
  DrawRarity,
  DrawRunView,
  DrawStreak,
  DrawToday,
} from "./types";
import type { Choice } from "@/lib/drawEngine";

/**
 * Minimal client surface this adapter needs — structurally satisfied by
 * ConvexReactClient. Narrowed to an interface so tests can drive the adapter
 * against the real convex/draw.ts handlers with no network and no React
 * (see drawAdapterContract.test.ts).
 */
export interface DrawConvexClient {
  query<T = unknown>(reference: unknown, args: Record<string, never>): Promise<T>;
  mutation<T = unknown>(reference: unknown, args: Record<string, unknown>): Promise<T>;
}

// ── server payload shapes (mirrors convex/draw.ts; see rename map above) ──

interface ServerCard {
  id: string;
  name: string;
  rating: number;
  clubs: string[];
  nation: string;
  era: string;
  eraIndex: number;
  position: DrawRunView["squad"][number]["position"];
}

interface ServerRun {
  dateKey: string;
  boardNumber: number;
  status: string;
  phase: DrawRunView["phase"];
  rowIndex: number;
  fixtureIndex: number;
  cumulative: number;
  squad: ServerCard[];
  offers: ServerCard[] | null;
  fixtures: DrawRunView["fixtures"];
  rounds: DrawRunView["rounds"];
  outcome: DrawRunView["outcome"];
  finalScore: number | null;
  draftLineHash: string | null;
  completedAt: number | null;
  boardReveal: { rows: ServerCard[][] } | null;
  choiceLog: unknown;
}

interface ServerToday {
  dateKey: string;
  boardNumber: number;
  nextBoardAt: number;
  streak: number;
  boardReady: boolean;
  fixtures: DrawToday["fixtures"] | null;
  rules: DrawToday["rules"] | null;
  playState: DrawToday["playState"];
  run: ServerRun | null;
}

interface ServerLeaderboard {
  dateKey: string;
  total: number;
  entries: Array<{
    rank: number;
    userId: string;
    name: string;
    score: number;
    outcome: string;
    roundsCleared: number;
  }>;
  me: { rank: number; score: number } | null;
}

interface ServerRarity {
  dateKey: string;
  draftLineHash: string;
  count: number;
  total: number;
  sharePct: number | null;
}

interface ServerStreak {
  current: number;
  best: number;
  lastPlayedDateKey: string | null;
}

interface ServerSubmitResult {
  replayRejected: boolean;
  run: ServerRun;
}

/**
 * Raised when the server's B2 replay gate refuses a completing choice: the
 * regenerated board disagreed with the stored snapshot, so no result was
 * written. Surfaced rather than swallowed — the pre-choice state the server
 * returns would otherwise render as a silent no-op on a tapped button.
 */
export class DrawReplayRejectedError extends Error {
  constructor() {
    super("This run could not be verified and was not scored.");
    this.name = "DrawReplayRejectedError";
  }
}

// ── field-by-field copies (never spread a server payload) ──

function card(c: ServerCard): DrawRunView["squad"][number] {
  return {
    id: c.id,
    name: c.name,
    rating: c.rating,
    clubs: [...c.clubs],
    nation: c.nation,
    era: c.era,
    eraIndex: c.eraIndex,
    position: c.position,
  };
}

function runView(run: ServerRun): DrawRunView {
  return {
    boardNumber: run.boardNumber,
    phase: run.phase,
    rowIndex: run.rowIndex,
    // offers → currentRow
    currentRow: run.offers === null ? null : run.offers.map(card),
    squad: run.squad.map(card),
    fixtures: run.fixtures,
    fixtureIndex: run.fixtureIndex,
    cumulative: run.cumulative,
    rounds: run.rounds,
    outcome: run.outcome,
    finalScore: run.finalScore,
    // boardReveal.rows → fullBoard
    fullBoard: run.boardReveal === null ? null : run.boardReveal.rows.map((r) => r.map(card)),
    status: run.status,
    draftLineHash: run.draftLineHash,
  };
}

export class ConvexDrawApi implements DrawApi {
  constructor(private readonly client: DrawConvexClient) {}

  async getToday(): Promise<DrawToday> {
    let today = await this.client.query<ServerToday>(api.draw.getToday, {});
    if (!today.boardReady) {
      // Queries can't write, so the day's board is generated by the cron or
      // lazily by this mutation on the first request of the day. Idempotent:
      // concurrent callers converge on the same board (drawBoards B1).
      await this.client.mutation(api.draw.ensureToday, {});
      today = await this.client.query<ServerToday>(api.draw.getToday, {});
    }
    if (!today.boardReady || today.fixtures === null || today.rules === null) {
      throw new Error("THE DRAW: today's board is unavailable");
    }
    return {
      boardNumber: today.boardNumber,
      dateKey: today.dateKey,
      fixtures: today.fixtures,
      playState: today.playState,
      streak: today.streak,
      rules: today.rules,
      nextBoardAt: today.nextBoardAt,
    };
  }

  async startRun(): Promise<DrawRunView> {
    return runView(await this.client.mutation<ServerRun>(api.draw.startRun, {}));
  }

  async submitChoice(choice: Choice): Promise<DrawRunView> {
    const result = await this.client.mutation<ServerSubmitResult>(api.draw.submitChoice, {
      choice,
    });
    if (result.replayRejected) throw new DrawReplayRejectedError();
    return runView(result.run);
  }

  async getLeaderboard(): Promise<DrawLeaderboardEntry[]> {
    const board = await this.client.query<ServerLeaderboard>(api.draw.getLeaderboard, {});
    // `isYou` by rank, not by userId: the server's own rows carry userId and
    // the client contract deliberately does not, so it is dropped here.
    const myRank = board.me?.rank ?? null;
    return board.entries.map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      score: entry.score,
      outcome: entry.outcome as DrawLeaderboardEntry["outcome"],
      ...(myRank !== null && entry.rank === myRank ? { isYou: true as const } : {}),
    }));
  }

  async getRarity(): Promise<DrawRarity> {
    const rarity = await this.client.query<ServerRarity | null>(api.draw.getRarity, {});
    // null before the draft completes; sharePct null when nobody has finished.
    if (rarity === null || rarity.sharePct === null) {
      throw new Error("Rarity is only available for a completed draft");
    }
    return { linePercent: rarity.sharePct };
  }

  async getStreak(): Promise<DrawStreak> {
    const streak = await this.client.query<ServerStreak>(api.draw.getStreak, {});
    return { current: streak.current, best: streak.best };
  }
}
