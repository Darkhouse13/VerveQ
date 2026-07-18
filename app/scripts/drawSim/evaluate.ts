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
import {
  assistedPushGate,
  runAssisted,
  runChaser,
  runCoarseAssisted,
  runCoarseReader,
  runGreedy,
  runRandom,
  runReader,
} from "./bots";
import {
  buildChaserPlan,
  buildCoarsePlan,
  evalPushAtState,
  evaluateCriteria,
  finalizeBotStats,
  median,
  nearMissAttribution,
  newBotAccumulator,
  percentile,
  planBandMids,
  profileDistance,
  recordBotRun,
  TENSE_SPREAD_RATIO,
  type BotStats,
  type Criterion,
  type NearMissAttribution,
} from "./metrics";

export interface EvaluateOptions {
  boards: number;
  seedBase: string;
  p3Samples: number;
  /** Run a determinism spot-check every N boards (0 disables). */
  p5Every: number;
  /** Greedy push-rule face multiplier (Ticket 0.2, sweepable in [0.9, 1.2]). */
  kGreedy?: number;
  /** Assisted/reader band-fraction push tolerance (Ticket G, default 0.5). */
  kAssisted?: number;
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
   * Ticket 0.2 — every chaser-reached post-clear decision state,
   * visitation-weighted; tense := |EV gap| ≤ 0.5 × stdev(push). Run-level
   * tenseRunFrac feeds P3a. gapDeciles/spreadDeciles = p10/p25/p50/p75/p90;
   * gapHist bins the full EV-gap distribution (fraction of banked).
   */
  p3: {
    runs: number;
    tenseRuns: number;
    tenseRunFrac: number;
    states: number;
    tenseCount: number;
    perStateTenseFrac: number;
    tenseMedianSpread: number;
    gapDeciles: number[];
    spreadDeciles: number[];
    gapHist: { lo: number; hi: number; count: number }[];
  };
  /** Ticket 0.3 C2 — report-only: where the pooled (greedy+chaser) near-miss fails happen. */
  p2Attribution: NearMissAttribution;
  p4Rate: number;
  p5: { checked: number; ok: boolean };
  criteria: Criterion[];
  distance: number;
}

/** Deterministic replay + serialization spot-check for one board's bot runs. */
export function determinismSpotCheck(ctx: BoardContext, results: RunResult[]): boolean {
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
  // Ticket G: a config with hints is measured against profile v1.1 (P1d on
  // assisted, P2 pools greedy+assisted, P3 on assisted, P6 added). Configs
  // without hints keep the exact v1.0 measurement for reproducibility.
  // Ticket G2: a config with clearance buckets is measured against profile
  // v1.2 (coarseAssisted/coarseReader as the shipped-player pair).
  const v12 = Boolean(config.clearance);
  const v11 = Boolean(config.hints) && !v12;

  const oracleAcc = newBotAccumulator("oracle");
  const greedyAcc = newBotAccumulator("greedy");
  const chaserAcc = newBotAccumulator("chaser");
  const assistedAcc = newBotAccumulator("assisted");
  const readerAcc = newBotAccumulator("reader");
  const coarseAssistedAcc = newBotAccumulator("coarseAssisted");
  const coarseReaderAcc = newBotAccumulator("coarseReader");
  const randomAcc = newBotAccumulator("random");

  const oracleNodes: number[] = [];
  const oracleMs: number[] = [];
  let oracleFullClears = 0;
  let deadBoards = 0;
  let deadFlagged = 0;
  let diversityBoards = 0;

  const p3Gaps: number[] = [];
  const p3Spreads: number[] = [];
  const p3TenseMask: boolean[] = [];
  /** v1.2: tense-state spreads under the coarseAssisted policy (P3b source). */
  const coarseTenseSpreads: number[] = [];
  let tenseRuns = 0;

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

    const greedy = runGreedy(ctx, opts.kGreedy ?? 1);
    recordBotRun(greedyAcc, greedy);
    const chaser = runChaser(ctx);
    recordBotRun(chaserAcc, chaser);
    const kAssisted = opts.kAssisted ?? 0.5;
    const assisted = runAssisted(ctx, kAssisted);
    recordBotRun(assistedAcc, assisted);
    const reader = runReader(ctx, kAssisted);
    recordBotRun(readerAcc, reader);
    const coarseAssisted = runCoarseAssisted(ctx);
    recordBotRun(coarseAssistedAcc, coarseAssisted);
    const coarseReader = runCoarseReader(ctx);
    recordBotRun(coarseReaderAcc, coarseReader);
    const random = runRandom(ctx, rngFromString(`${boardSeed}|randombot`));
    recordBotRun(randomAcc, random);

    // P3 (Ticket 0.2): every measured-bot-reached post-clear decision state
    // is a sample, whether the bot then banked, pushed, or busted later — one
    // visit per board per cleared non-boss round (visitation-weighted).
    // Run-level: a run is "tense" when any of its states is. Profile v1.0
    // measures the chaser; v1.1 (Ticket G) measures assisted, whose
    // continuation policy is the band-centre push rule.
    // v1.2 (Ticket G2) splits P3: P3a stays on the CHASER (the v1.0
    // manufactured-marginality instrument — the ticket relocates only
    // "P2/P3b" to coarseAssisted), while P3b's tense-state spreads come from
    // the coarseAssisted-policy MC. v1.0/v1.1 keep a single source.
    const p3Bot = v12 ? chaser : v11 ? assisted : chaser;
    let runTense = false;
    if (p3Bot.roundsCleared >= 1) {
      const squadIdxs = p3Bot.choiceLog
        .filter((c) => c.type === "pick")
        .map((c, row) => row * ctx.offers + (c.type === "pick" ? c.offerIndex : 0));
      const plan = buildChaserPlan(ctx, squadIdxs);
      const mids = v11
        ? { mids: planBandMids(ctx, plan), pushGate: assistedPushGate(config.formSpread, kAssisted) }
        : undefined;
      let banked = 0;
      for (let round = 1; round < config.fixtureCount; round++) {
        if (p3Bot.roundsCleared < round) break;
        banked += p3Bot.rounds[round - 1].score;
        const { evGap, spread } = evalPushAtState(
          ctx,
          plan,
          round, // next fixture index (0-based) after clearing `round` rounds
          banked,
          rngFromString(`${boardSeed}|p3|r${round}`),
          opts.p3Samples,
          mids,
        );
        const tense = Math.abs(evGap) <= TENSE_SPREAD_RATIO * spread;
        p3Gaps.push(evGap);
        p3Spreads.push(spread);
        p3TenseMask.push(tense);
        if (tense) runTense = true;
      }
    }
    if (runTense) tenseRuns++;
    // v1.2 second pass: coarseAssisted-policy tense-state spreads (P3b).
    if (v12 && coarseAssisted.roundsCleared >= 1) {
      const squadIdxs = coarseAssisted.choiceLog
        .filter((c) => c.type === "pick")
        .map((c, row) => row * ctx.offers + (c.type === "pick" ? c.offerIndex : 0));
      const plan = buildCoarsePlan(ctx, squadIdxs);
      const mids = {
        mids: planBandMids(ctx, plan),
        pushRatio: (config.clearance as { safeRatio: number }).safeRatio,
      };
      let banked = 0;
      for (let round = 1; round < config.fixtureCount; round++) {
        if (coarseAssisted.roundsCleared < round) break;
        banked += coarseAssisted.rounds[round - 1].score;
        const { evGap, spread } = evalPushAtState(
          ctx,
          plan,
          round,
          banked,
          rngFromString(`${boardSeed}|p3c|r${round}`),
          opts.p3Samples,
          mids,
        );
        if (Math.abs(evGap) <= TENSE_SPREAD_RATIO * spread) coarseTenseSpreads.push(spread);
      }
    }

    if (opts.p5Every > 0 && i % opts.p5Every === 0) {
      p5Checked++;
      if (
        !determinismSpotCheck(ctx, [
          greedy,
          chaser,
          assisted,
          reader,
          coarseAssisted,
          coarseReader,
          random,
          oracle.result,
        ])
      )
        p5Ok = false;
    }
  }

  const n = opts.boards;
  const maxRounds = config.fixtureCount;
  const bots: Record<string, BotStats> = {
    oracle: finalizeBotStats(oracleAcc, maxRounds),
    greedy: finalizeBotStats(greedyAcc, maxRounds),
    chaser: finalizeBotStats(chaserAcc, maxRounds),
    assisted: finalizeBotStats(assistedAcc, maxRounds),
    reader: finalizeBotStats(readerAcc, maxRounds),
    coarseAssisted: finalizeBotStats(coarseAssistedAcc, maxRounds),
    coarseReader: finalizeBotStats(coarseReaderAcc, maxRounds),
    random: finalizeBotStats(randomAcc, maxRounds),
  };

  // P2 pool: greedy + the profile's shipped-player bot (chaser at v1.0,
  // assisted at v1.1, coarseAssisted at v1.2 — Tickets G/G2).
  const p2Partner = v12 ? bots.coarseAssisted : v11 ? bots.assisted : bots.chaser;
  const pooledFails = bots.greedy.busts + p2Partner.busts;
  const pooledNearMisses = bots.greedy.nearMisses + p2Partner.nearMisses;
  const p2Attribution = nearMissAttribution(
    bots.greedy.nearMissByRound.map((c, r) => c + p2Partner.nearMissByRound[r]),
  );

  const tenseSpreads: number[] = [];
  for (let s = 0; s < p3Gaps.length; s++) {
    if (p3TenseMask[s]) tenseSpreads.push(p3Spreads[s]);
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

  const criteria = evaluateCriteria(
    {
      oracleFullClearRate: oracleFullClears / n,
      deadBoards,
      deadFlagged,
      randomMedianRounds: bots.random.medianRounds,
      greedyMedianRounds: bots.greedy.medianRounds,
      chaserMedianRounds: bots.chaser.medianRounds,
      chaserFullClearRate: bots.chaser.fullClearRate,
      assistedFullClearRate: (v12 ? bots.coarseAssisted : bots.assisted).fullClearRate,
      assistedMedianScore: (v12 ? bots.coarseAssisted : bots.assisted).scoreP50,
      readerMedianScore: (v12 ? bots.coarseReader : bots.reader).scoreP50,
      pooledNearMissRate: pooledFails === 0 ? 0 : pooledNearMisses / pooledFails,
      pooledFails,
      p3Runs: n,
      p3TenseRunFrac: tenseRuns / n,
      p3States: p3Gaps.length,
      p3PerStateTenseFrac: tenseFrac,
      p3TenseMedianSpread: v12
        ? coarseTenseSpreads.length
          ? median(coarseTenseSpreads)
          : NaN
        : tenseMedianSpread,
      p4Rate: diversityBoards / n,
      p5Checked,
      p5Ok,
    },
    { profileV11: v11, profileV12: v12 },
  );

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
      runs: n,
      tenseRuns,
      tenseRunFrac: tenseRuns / n,
      states: p3Gaps.length,
      tenseCount: tenseSpreads.length,
      perStateTenseFrac: tenseFrac,
      tenseMedianSpread,
      gapDeciles: deciles(sortedGaps),
      spreadDeciles: deciles(sortedSpreads),
      gapHist,
    },
    p2Attribution,
    p4Rate: diversityBoards / n,
    p5: { checked: p5Checked, ok: p5Ok },
    criteria,
    distance: profileDistance(criteria),
  };
}
