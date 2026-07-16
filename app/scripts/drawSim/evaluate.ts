/**
 * evaluateConfig — run a batch of boards for one EngineConfig and produce the
 * full metric set + P0–P5 criteria. Shared by draw:sim and draw:sweep.
 * Fully seeded: same (config, seedBase, boards) ⇒ identical output.
 */

import {
  deserializeRunState,
  applyChoice,
  generateBoard,
  generateCardSet,
  initRun,
  replay,
  rngFromString,
  serializeRunState,
  toResult,
  type EngineConfig,
  type RunResult,
} from "../../src/lib/drawEngine";
import { buildContext, type BoardContext } from "./boardContext";
import { runOracle } from "./oracle";
import { runChaser, runGreedy, runRandom } from "./bots";
import {
  evalPushAtState,
  evaluateCriteria,
  finalizeBotStats,
  median,
  newBotAccumulator,
  percentile,
  profileDistance,
  recordBotRun,
  TENSE_HI,
  TENSE_LO,
  type BotStats,
  type Criterion,
} from "./metrics";

export interface EvaluateOptions {
  boards: number;
  seedBase: string;
  p3Samples: number;
  /** Run a determinism spot-check every N boards (0 disables). */
  p5Every: number;
}

export interface ConfigEval {
  boards: number;
  seedBase: string;
  oracle: {
    fullClearRate: number;
    deadBoards: number;
    deadFlagged: number;
    medianNodes: number;
    medianMs: number;
    scoreP50: number;
  };
  bots: Record<string, BotStats>;
  /**
   * Ticket 0.1 C2 — all chaser-reached post-clear states at rounds 2 and 3,
   * visitation-weighted. gapDeciles/spreadDeciles = p10/p25/p50/p75/p90;
   * gapHist bins the full EV-gap distribution (fraction of banked).
   */
  p3: {
    states: number;
    tenseCount: number;
    tenseFrac: number;
    tenseMedianSpread: number;
    gapDeciles: number[];
    spreadDeciles: number[];
    gapHist: { lo: number; hi: number; count: number }[];
  };
  p4Rate: number;
  p5: { checked: number; ok: boolean };
  criteria: Criterion[];
  distance: number;
}

/** Deterministic replay + serialization spot-check for one board's bot runs. */
function determinismSpotCheck(ctx: BoardContext, results: RunResult[]): boolean {
  for (const result of results) {
    const replayed = replay(ctx.board, ctx.config, result.choiceLog);
    if (
      replayed.finalScore !== result.finalScore ||
      replayed.outcome !== result.outcome ||
      replayed.roundsCleared !== result.roundsCleared
    ) {
      return false;
    }
    // Serialization round-trip mid-run: replay half the log, round-trip the
    // state through JSON, finish both ways, compare.
    const log = result.choiceLog;
    const half = Math.floor(log.length / 2);
    let a = initRun(ctx.board);
    for (let i = 0; i < half; i++) a = applyChoice(ctx.board, ctx.config, a, log[i]);
    let b = deserializeRunState(serializeRunState(a));
    for (let i = half; i < log.length; i++) {
      a = applyChoice(ctx.board, ctx.config, a, log[i]);
      b = applyChoice(ctx.board, ctx.config, b, log[i]);
    }
    if (toResult(a).finalScore !== toResult(b).finalScore) return false;
  }
  return true;
}

export function evaluateConfig(config: EngineConfig, opts: EvaluateOptions): ConfigEval {
  const cardSet = generateCardSet(`${opts.seedBase}|cards`, config.cardGen);

  const oracleAcc = newBotAccumulator("oracle");
  const greedyAcc = newBotAccumulator("greedy");
  const chaserAcc = newBotAccumulator("chaser");
  const randomAcc = newBotAccumulator("random");

  const oracleNodes: number[] = [];
  const oracleMs: number[] = [];
  let oracleFullClears = 0;
  let deadBoards = 0;
  let deadFlagged = 0;
  let diversityBoards = 0;

  const p3Gaps: number[] = [];
  const p3Spreads: number[] = [];

  let p5Checked = 0;
  let p5Ok = true;

  for (let i = 0; i < opts.boards; i++) {
    const boardSeed = `${opts.seedBase}#${i}`;
    const board = generateBoard(boardSeed, cardSet, config);
    const ctx = buildContext(board, config);

    const oracle = runOracle(ctx);
    oracleNodes.push(oracle.nodes);
    oracleMs.push(oracle.ms);
    recordBotRun(oracleAcc, oracle.result);
    if (oracle.result.outcome === "fullclear") oracleFullClears++;
    if (!oracle.fullClearPossible) {
      deadBoards++;
      deadFlagged++; // detector = exact same enumeration; see DECISIONS.md
    }
    if (oracle.diversityOk) diversityBoards++;

    const greedy = runGreedy(ctx);
    recordBotRun(greedyAcc, greedy);
    const chaser = runChaser(ctx);
    recordBotRun(chaserAcc, chaser);
    const random = runRandom(ctx, rngFromString(`${boardSeed}|randombot`));
    recordBotRun(randomAcc, random);

    // P3 (Ticket 0.1 C2): every chaser-reached post-clear state at rounds 2
    // and 3 is a sample, whether the chaser then banked, pushed, or busted
    // later — one visit per board per round (visitation-weighted).
    if (chaser.roundsCleared >= 2) {
      const squadIdxs = chaser.choiceLog
        .filter((c) => c.type === "pick")
        .map((c, row) => row * ctx.offers + (c.type === "pick" ? c.offerIndex : 0));
      for (const round of [2, 3]) {
        if (chaser.roundsCleared < round) break;
        let banked = 0;
        for (let r = 0; r < round; r++) banked += chaser.rounds[r].score;
        const { evGap, spread } = evalPushAtState(
          ctx,
          squadIdxs,
          round, // next fixture index (0-based) after clearing `round` rounds
          banked,
          rngFromString(`${boardSeed}|p3|r${round}`),
          opts.p3Samples,
        );
        p3Gaps.push(evGap);
        p3Spreads.push(spread);
      }
    }

    if (opts.p5Every > 0 && i % opts.p5Every === 0) {
      p5Checked++;
      if (!determinismSpotCheck(ctx, [greedy, chaser, random, oracle.result])) p5Ok = false;
    }
  }

  const n = opts.boards;
  const maxRounds = config.fixtureCount;
  const bots: Record<string, BotStats> = {
    oracle: finalizeBotStats(oracleAcc, maxRounds),
    greedy: finalizeBotStats(greedyAcc, maxRounds),
    chaser: finalizeBotStats(chaserAcc, maxRounds),
    random: finalizeBotStats(randomAcc, maxRounds),
  };

  const pooledFails = bots.greedy.busts + bots.chaser.busts;
  const pooledNearMisses = bots.greedy.nearMisses + bots.chaser.nearMisses;

  const tenseSpreads: number[] = [];
  for (let s = 0; s < p3Gaps.length; s++) {
    if (p3Gaps[s] >= TENSE_LO && p3Gaps[s] <= TENSE_HI) tenseSpreads.push(p3Spreads[s]);
  }
  const tenseFrac = p3Gaps.length ? tenseSpreads.length / p3Gaps.length : 0;
  const tenseMedianSpread = tenseSpreads.length ? median(tenseSpreads) : NaN;
  const sortedGaps = [...p3Gaps].sort((a, b) => a - b);
  const sortedSpreads = [...p3Spreads].sort((a, b) => a - b);
  const deciles = (sorted: number[]) =>
    [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => percentile(sorted, p));
  // Full EV-gap distribution: 0.1-wide bins over [-1, 2], outliers clamped in.
  const HIST_LO = -1;
  const HIST_HI = 2;
  const HIST_BINS = 30;
  const histCounts = Array.from({ length: HIST_BINS }, () => 0);
  for (const g of p3Gaps) {
    const bin = Math.min(
      HIST_BINS - 1,
      Math.max(0, Math.floor(((g - HIST_LO) / (HIST_HI - HIST_LO)) * HIST_BINS)),
    );
    histCounts[bin]++;
  }
  const gapHist = histCounts.map((count, b) => ({
    lo: Number((HIST_LO + (b * (HIST_HI - HIST_LO)) / HIST_BINS).toFixed(1)),
    hi: Number((HIST_LO + ((b + 1) * (HIST_HI - HIST_LO)) / HIST_BINS).toFixed(1)),
    count,
  }));

  const criteria = evaluateCriteria({
    oracleFullClearRate: oracleFullClears / n,
    deadBoards,
    deadFlagged,
    randomMedianRounds: bots.random.medianRounds,
    greedyMedianRounds: bots.greedy.medianRounds,
    chaserMedianRounds: bots.chaser.medianRounds,
    chaserFullClearRate: bots.chaser.fullClearRate,
    pooledNearMissRate: pooledFails === 0 ? 0 : pooledNearMisses / pooledFails,
    pooledFails,
    p3States: p3Gaps.length,
    p3TenseFrac: tenseFrac,
    p3TenseMedianSpread: tenseMedianSpread,
    p4Rate: diversityBoards / n,
    p5Checked,
    p5Ok,
  });

  return {
    boards: n,
    seedBase: opts.seedBase,
    oracle: {
      fullClearRate: oracleFullClears / n,
      deadBoards,
      deadFlagged,
      medianNodes: median(oracleNodes),
      medianMs: median(oracleMs),
      scoreP50: bots.oracle.scoreP50,
    },
    bots,
    p3: {
      states: p3Gaps.length,
      tenseCount: tenseSpreads.length,
      tenseFrac,
      tenseMedianSpread,
      gapDeciles: deciles(sortedGaps),
      spreadDeciles: deciles(sortedSpreads),
      gapHist,
    },
    p4Rate: diversityBoards / n,
    p5: { checked: p5Checked, ok: p5Ok },
    criteria,
    distance: profileDistance(criteria),
  };
}
