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
  evalPushAtBankPoint,
  evaluateCriteria,
  finalizeBotStats,
  median,
  newBotAccumulator,
  profileDistance,
  recordBotRun,
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
  p3: { points: number; medianGap: number; medianSpread: number; fracInRange: number };
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

    if (chaser.outcome === "banked") {
      const squadIdxs = chaser.choiceLog
        .filter((c) => c.type === "pick")
        .map((c, row) => row * ctx.offers + (c.type === "pick" ? c.offerIndex : 0));
      const { evGap, spread } = evalPushAtBankPoint(
        ctx,
        squadIdxs,
        chaser.roundsCleared,
        chaser.finalScore,
        rngFromString(`${boardSeed}|p3`),
        opts.p3Samples,
      );
      p3Gaps.push(evGap);
      p3Spreads.push(spread);
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
  const p3InRange = p3Gaps.filter((g) => g >= -0.15 && g <= 0).length;

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
    p3MedianGap: p3Gaps.length ? median(p3Gaps) : NaN,
    p3MedianSpread: p3Spreads.length ? median(p3Spreads) : NaN,
    p3Points: p3Gaps.length,
    p3FracInRange: p3Gaps.length ? p3InRange / p3Gaps.length : 0,
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
      points: p3Gaps.length,
      medianGap: p3Gaps.length ? median(p3Gaps) : NaN,
      medianSpread: p3Spreads.length ? median(p3Spreads) : NaN,
      fracInRange: p3Gaps.length ? p3InRange / p3Gaps.length : 0,
    },
    p4Rate: diversityBoards / n,
    p5: { checked: p5Checked, ok: p5Ok },
    criteria,
    distance: profileDistance(criteria),
  };
}
