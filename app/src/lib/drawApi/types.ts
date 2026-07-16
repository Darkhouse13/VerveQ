/**
 * THE DRAW — client API contract (Ticket B, X1).
 *
 * This interface is the integration seam between the UI and the serving
 * layer. The Convex implementation lands in a LATER ticket; this file only
 * defines the request/response shapes, mirroring the serving ticket's
 * sanitization rules exactly:
 *
 *  - CURRENT ROW ONLY: during the draft, a response carries the offers of the
 *    active row and nothing from rows not yet reached. The full 6×3 grid is
 *    only revealed once the run is done (result-screen board reveal).
 *  - NO FORM PRE-RESOLUTION: per-card form multipliers appear exclusively in
 *    `RoundBreakdown`s of rounds that have already been played. Nothing in
 *    any response lets a client compute form for an unplayed round.
 *  - NO SEED: the board seed never crosses this boundary (with the seed, form
 *    and the whole grid are derivable client-side — see drawEngine/types.ts
 *    locked decision 3).
 *
 * Everything else — the visible gauntlet with thresholds (design contract:
 * shown from board start), picked cards, resolved round breakdowns — is
 * public by design and passes through unmodified from the frozen v1.0 engine
 * shapes.
 */

import type {
  Card,
  Choice,
  Fixture,
  RoundBreakdown,
  RunOutcome,
  RunPhase,
} from "@/lib/drawEngine";

export type DrawPlayState = "unplayed" | "in_progress" | "done";

/**
 * Display-relevant knobs of the serving config. A strict subset of
 * EngineConfig: nothing here (synergy table, bust/full-clear multipliers,
 * grid dimensions) reveals board content or form.
 */
export interface DrawRules {
  rows: number;
  offersPerRow: number;
  fixtureCount: number;
  /** synergyTable[chainLength] = multiplier (see EngineConfig.synergyTable). */
  synergyTable: number[];
  bustKeep: number;
  fullClearBonus: number;
}

/** Today's board as seen BEFORE (and outside) a run. */
export interface DrawToday {
  /** Human board number ("BOARD #37"), shared by all users. */
  boardNumber: number;
  /** UTC day key, YYYY-MM-DD. */
  dateKey: string;
  /**
   * The full gauntlet — archetypes, modifiers AND thresholds — visible from
   * board start (design contract; drawEngine locked decision 1).
   */
  fixtures: Fixture[];
  playState: DrawPlayState;
  /** Current daily streak for the streak chip. */
  streak: number;
  rules: DrawRules;
  /** Epoch ms when the next board goes live (countdown on the result screen). */
  nextBoardAt: number;
}

/**
 * The sanitized view of a run, returned by startRun and after every
 * submitted choice. This is the ONLY shape game state reaches the client in.
 */
export interface DrawRunView {
  boardNumber: number;
  phase: RunPhase;
  /** Next draft row index (draft phase only). */
  rowIndex: number;
  /**
   * Offers of the ACTIVE draft row only; null outside the draft phase.
   * Rows beyond `rowIndex` are never present in any response.
   */
  currentRow: Card[] | null;
  /** Cards picked so far, in row order (public once offered and picked). */
  squad: Card[];
  /** The visible gauntlet (same as DrawToday.fixtures). */
  fixtures: Fixture[];
  /** Next fixture to play (bench phase) / fixture just played (decision). */
  fixtureIndex: number;
  /** Banked-so-far cumulative score. */
  cumulative: number;
  /**
   * Breakdowns of PLAYED rounds only. This is where form is revealed, per
   * card, after each round resolves — never earlier.
   */
  rounds: RoundBreakdown[];
  outcome: RunOutcome | null;
  finalScore: number | null;
  /**
   * The full 6×3 offer grid, revealed ONLY once the run is done (result
   * screen board reveal). Null while the run is live.
   */
  fullBoard: Card[][] | null;
  /**
   * Server run status (drafting | running | banked | busted | fullclear).
   * Passthrough from the serving layer; `phase` is what the UI switches on,
   * this is the persisted row's own view of the same run. Absent on the mock.
   */
  status?: string;
  /**
   * Draft-line fingerprint ("021102"), set once the draft completes — the key
   * getRarity aggregates on. Passthrough; absent on the mock.
   */
  draftLineHash?: string | null;
}

export interface DrawLeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  outcome: RunOutcome;
  /** True on the caller's own row. */
  isYou?: boolean;
}

export interface DrawRarity {
  /** Share of today's players who drafted this exact line, percent (0..100). */
  linePercent: number;
}

export interface DrawStreak {
  current: number;
  best: number;
}

export interface DrawApi {
  getToday(): Promise<DrawToday>;
  /** Start (or resume) today's run. One run per user per board. */
  startRun(): Promise<DrawRunView>;
  /** Apply one engine Choice. Rejects out-of-phase/out-of-range choices. */
  submitChoice(choice: Choice): Promise<DrawRunView>;
  getLeaderboard(): Promise<DrawLeaderboardEntry[]>;
  /** Rarity of the finished run's drafted line. */
  getRarity(): Promise<DrawRarity>;
  getStreak(): Promise<DrawStreak>;
}
