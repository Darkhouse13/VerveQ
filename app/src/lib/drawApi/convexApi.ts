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
 *                   boardNumber/playState/streak/nextBoardAt → passthrough
 *                   rules                 → rulesView(): copied field-by-field,
 *                                           PLUS the one documented gap-fill in
 *                                           this file (formSpread,
 *                                           maxSynergyFamilies) — see rulesView
 *                   boardReady:false      → ensureToday(), then re-read
 *   startRun        (run view)            → DrawRunView
 *   submitChoice    {replayRejected, run} → DrawRunView | throw
 *   getLeaderboard  {entries, me}         → DrawLeaderboardEntry[]
 *                   entry.userId          → DROPPED (never reaches the client;
 *                                           `isYou` comes from me.rank instead)
 *                   entry.roundsCleared   → DROPPED (not in the UI contract)
 *   getRarity       sharePct              → DrawRarity.linePercent
 *                   total                 → DrawRarity.population (F6)
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
  DrawRules,
  DrawRunView,
  DrawStreak,
  DrawToday,
} from "./types";
import type { Choice } from "@/lib/drawEngine";
import { C13V1_CONFIG } from "@/lib/drawEngine/configs/c13v1";

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

/**
 * What convex/draw.ts `rulesView` ACTUALLY sends today. Deliberately typed as
 * its own shape rather than `DrawToday["rules"]`: the client contract gained
 * formSpread + maxSynergyFamilies in Ticket F (F3's projected band needs
 * both), and the serving layer does not send them yet — see `rulesView` below.
 */
type ServerRules = Omit<DrawRules, "formSpread" | "maxSynergyFamilies"> &
  Partial<Pick<DrawRules, "formSpread" | "maxSynergyFamilies">>;

interface ServerToday {
  dateKey: string;
  boardNumber: number;
  nextBoardAt: number;
  streak: number;
  boardReady: boolean;
  fixtures: DrawToday["fixtures"] | null;
  rules: ServerRules | null;
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

/**
 * KNOWN GAP (Ticket F, F3) — the one place this adapter fills a value the
 * server did not send, and it is a deliberate, bounded compromise.
 *
 * convex/draw.ts `rulesView` publishes a strict subset of the config that
 * omits formSpread and maxSynergyFamilies. The projected score band (F3) is
 * arithmetically impossible without both: form is uniform in
 * [1-formSpread, 1+formSpread], and squadSynergies applies maxSynergyFamilies
 * when it grants multipliers. Ticket F's scope fences convex/ off (its only
 * backend exception was getRarity, which turned out not to need one), so the
 * knobs cannot be added to rulesView here.
 *
 * Filling them from the pinned config is CORRECT TODAY and not indefinitely:
 * convex/drawSeed.ts registers exactly one configVersion (c13-1) and every
 * board is generated under it, so the pinned module and the serving config are
 * the same numbers — drawConfigSingleSourceContract.test.ts already asserts
 * the mock and the server share the object. It stops being correct the moment
 * a SECOND config is registered and a board is served under it, because this
 * would then describe the wrong config.
 *
 * FOLLOW-UP: a serving ticket should add both knobs to `rulesView` (neither
 * reveals board content or form — formSpread is the width of the form
 * distribution, not a draw from it). Once served, the `??` below stops firing
 * and this fallback is dead code; drawLegibilityRulesContract.test.ts pins the
 * filled values against C13V1_CONFIG so the two cannot drift meanwhile.
 */
function rulesView(rules: ServerRules): DrawRules {
  return {
    rows: rules.rows,
    offersPerRow: rules.offersPerRow,
    fixtureCount: rules.fixtureCount,
    synergyTable: [...rules.synergyTable],
    bustKeep: rules.bustKeep,
    fullClearBonus: rules.fullClearBonus,
    formSpread: rules.formSpread ?? C13V1_CONFIG.formSpread,
    maxSynergyFamilies: rules.maxSynergyFamilies ?? C13V1_CONFIG.maxSynergyFamilies,
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
      rules: rulesView(today.rules),
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
    // total → population (Ticket F, F6). The count of completed runs for the
    // dateKey — the denominator sharePct is a share OF — was already computed
    // and returned by getRarity; it was simply dropped here. So F6 needs no
    // backend change: the suppression threshold is a display decision and
    // lives entirely client-side (see MIN_RARITY_POPULATION).
    return { linePercent: rarity.sharePct, population: rarity.total };
  }

  async getStreak(): Promise<DrawStreak> {
    const streak = await this.client.query<ServerStreak>(api.draw.getStreak, {});
    return { current: streak.current, best: streak.best };
  }
}
