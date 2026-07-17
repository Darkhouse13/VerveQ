/**
 * Distributions, the P3 push-EV Monte-Carlo estimator, and the target-profile
 * criteria (P0–P5) with a normalized distance per criterion (0 = pass) used
 * by the sweep ranking.
 */

import { scoreRound, type EngineConfig } from "../../src/lib/drawEngine";
import type { BoardContext } from "./boardContext";

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

export interface BotStats {
  name: string;
  n: number;
  medianRounds: number;
  roundsDist: number[]; // index = rounds cleared
  scoreP10: number;
  scoreP50: number;
  scoreP90: number;
  bustRate: number;
  bankRate: number;
  fullClearRate: number;
  /** Of this bot's busted rounds, the fraction failing within 12% of threshold. */
  nearMissRate: number;
  busts: number;
  nearMisses: number;
  /** Near-miss count by fail-round index (0-based; index 0 = the forced round 1). */
  nearMissByRound: number[];
}

export interface BotAccumulator {
  name: string;
  rounds: number[];
  scores: number[];
  busts: number;
  banks: number;
  fullClears: number;
  nearMisses: number;
  /** Fail-round index (0-based) of each near-miss bust (Ticket 0.3 C2). */
  nearMissRounds: number[];
}

export function newBotAccumulator(name: string): BotAccumulator {
  return {
    name,
    rounds: [],
    scores: [],
    busts: 0,
    banks: 0,
    fullClears: 0,
    nearMisses: 0,
    nearMissRounds: [],
  };
}

export const NEAR_MISS_WINDOW = 0.12;

export function recordBotRun(
  acc: BotAccumulator,
  result: { roundsCleared: number; finalScore: number; outcome: string; rounds: { score: number; threshold: number; cleared: boolean }[] },
): void {
  acc.rounds.push(result.roundsCleared);
  acc.scores.push(result.finalScore);
  if (result.outcome === "busted") {
    acc.busts++;
    const failed = result.rounds[result.rounds.length - 1];
    if (!failed.cleared && failed.score >= failed.threshold * (1 - NEAR_MISS_WINDOW)) {
      acc.nearMisses++;
      acc.nearMissRounds.push(result.roundsCleared);
    }
  } else if (result.outcome === "banked") {
    acc.banks++;
  } else {
    acc.fullClears++;
  }
}

export function finalizeBotStats(acc: BotAccumulator, maxRounds: number): BotStats {
  const n = acc.rounds.length;
  const sortedScores = [...acc.scores].sort((a, b) => a - b);
  const roundsDist = Array.from({ length: maxRounds + 1 }, () => 0);
  for (const r of acc.rounds) roundsDist[r]++;
  const nearMissByRound = Array.from({ length: maxRounds }, () => 0);
  for (const r of acc.nearMissRounds) nearMissByRound[r]++;
  return {
    name: acc.name,
    n,
    medianRounds: median(acc.rounds),
    roundsDist,
    scoreP10: percentile(sortedScores, 0.1),
    scoreP50: percentile(sortedScores, 0.5),
    scoreP90: percentile(sortedScores, 0.9),
    bustRate: acc.busts / n,
    bankRate: acc.banks / n,
    fullClearRate: acc.fullClears / n,
    nearMissRate: acc.busts === 0 ? 0 : acc.nearMisses / acc.busts,
    busts: acc.busts,
    nearMisses: acc.nearMisses,
    nearMissByRound,
  };
}

/**
 * Ticket 0.3 C2 — report-only near-miss attribution (no gate): where the
 * pooled near-miss fails happen. Round 1 (index 0) is the only round a run
 * cannot avoid ("forced"); a fail at round ≥ 2 was entered by a chosen push.
 */
export interface NearMissAttribution {
  nearMisses: number;
  /** Count by fail-round index (0-based). */
  byRound: number[];
  forced: number;
  chosen: number;
  forcedShare: number;
  chosenShare: number;
}

export function nearMissAttribution(byRound: number[]): NearMissAttribution {
  const nearMisses = byRound.reduce((a, b) => a + b, 0);
  const forced = byRound[0] ?? 0;
  const chosen = nearMisses - forced;
  return {
    nearMisses,
    byRound,
    forced,
    chosen,
    forcedShare: nearMisses === 0 ? 0 : forced / nearMisses,
    chosenShare: nearMisses === 0 ? 0 : chosen / nearMisses,
  };
}

/** Ticket 0.2 — a state is "tense" when |EV(push) − EV(bank)| ≤ TENSE_SPREAD_RATIO × stdev(push). */
export const TENSE_SPREAD_RATIO = 0.5;

/** Chaser's fixed matchday plan for one round: fielded card indices + their synergy multiplier. */
export interface ChaserRoundPlan {
  /** ctx.cards indices fielded this round (squad minus the chaser's form=1 bench). */
  fieldedIdxs: number[];
  /** Synergy multiplier of the fielded cards (tag-only — form-independent). */
  synMult: number;
}

/**
 * The chaser's bench per round is form-independent (argmax of the form=1
 * expected score, mirroring bots.ts chaserBenchFor exactly), so the fielded
 * set and its synergy multiplier can be fixed per round before any resampling.
 */
export function buildChaserPlan(ctx: BoardContext, squadCardIdxs: number[]): ChaserRoundPlan[] {
  const formless: EngineConfig = { ...ctx.config, formSpread: 0 };
  const squad = squadCardIdxs.map((i) => ctx.cards[i]);
  return ctx.board.fixtures.map((fixture) => {
    let bestI = 0;
    let bestScore = -1;
    let bestSyn = 1;
    for (let i = 0; i < squad.length; i++) {
      const fielded = squad.filter((_, j) => j !== i);
      const round = scoreRound(ctx.board.seed, fielded, fixture, formless);
      if (round.score > bestScore) {
        bestScore = round.score;
        bestI = i;
        bestSyn = round.synergyMult;
      }
    }
    return {
      fieldedIdxs: squadCardIdxs.filter((_, j) => j !== bestI),
      synMult: bestSyn,
    };
  });
}

/**
 * Band centre per round for a plan's fielded five: Σ(rating × fixtureMult) ×
 * synergyMult — the F3 band centre the assisted policy pushes on (Ticket G).
 */
export function planBandMids(ctx: BoardContext, plan: ChaserRoundPlan[]): number[] {
  return plan.map((p, r) => {
    let sum = 0;
    for (const ci of p.fieldedIdxs) sum += ctx.ratingMod[r * ctx.N + ci];
    return sum * p.synMult;
  });
}

/**
 * P3 (Ticket 0.2) — EV/stdev of PUSH at a bot-reached post-clear state,
 * from the player's information set: squad, bench plan, synergy, modifiers,
 * and thresholds are known; future forms are unknown and resampled uniform in
 * [1-f, 1+f]. After the forced push the simulated player continues with the
 * measured bot's own policy — the chaser's (form=1 bench each round, push
 * while score ≥ 1.1 × next threshold) by default, or, when `assistedMids` is
 * given (Ticket G, profile v1.1), the assisted bot's (same bench plan, push
 * while the NEXT round's band centre ≥ its threshold — a deterministic stop
 * given the squad). EV(bank) at the state is simply `banked`.
 */
export function evalPushAtState(
  ctx: BoardContext,
  plan: ChaserRoundPlan[],
  nextFixture: number,
  banked: number,
  rng: () => number,
  samples: number,
  /** Band centres + push gate for the assisted policy (Ticket G). */
  assisted?: { mids: number[]; pushGate: number },
): { evGap: number; spread: number } {
  const { config, ratingMod, thresholds, N, R } = ctx;
  const f = config.formSpread;

  let sum = 0;
  let sumSq = 0;
  for (let s = 0; s < samples; s++) {
    let cum = banked;
    let final = 0;
    for (let j = nextFixture; j < R; j++) {
      let base = 0;
      for (const ci of plan[j].fieldedIdxs) base += ratingMod[j * N + ci] * (1 - f + 2 * f * rng());
      const score = base * plan[j].synMult;
      if (score < thresholds[j]) {
        final = cum * config.bustKeep;
        break;
      }
      cum += score;
      if (j === R - 1) {
        final = cum * config.fullClearBonus;
      } else if (
        assisted
          ? assisted.mids[j + 1] * assisted.pushGate < thresholds[j + 1]
          : score < 1.1 * thresholds[j + 1]
      ) {
        final = cum;
        break;
      }
    }
    sum += final;
    sumSq += final * final;
  }
  const ev = sum / samples;
  const variance = Math.max(0, sumSq / samples - ev * ev);
  return { evGap: (ev - banked) / banked, spread: Math.sqrt(variance) / banked };
}

export interface Criterion {
  id: string;
  label: string;
  pass: boolean;
  value: string;
  distance: number;
}

export interface ProfileInputs {
  oracleFullClearRate: number;
  deadBoards: number;
  deadFlagged: number;
  randomMedianRounds: number;
  greedyMedianRounds: number;
  chaserMedianRounds: number;
  chaserFullClearRate: number;
  /**
   * Ticket G (profile v1.1): P1d gates the ASSISTED bot's full-clear rate;
   * chaser FC becomes a report-only diagnostic. Required when profileV11.
   */
  assistedFullClearRate?: number;
  /** Ticket G P6: reader's median final score must exceed assisted's by ≥8%. */
  assistedMedianScore?: number;
  readerMedianScore?: number;
  /**
   * P2 pooled inputs. Profile v1.0 pools greedy+chaser; v1.1 pools
   * greedy+assisted (the chaser's spot in the pool follows the bot the
   * profile measures the shipped player with — see DECISIONS.md Ticket G).
   */
  pooledNearMissRate: number;
  pooledFails: number;
  /** Chaser runs simulated (= boards). */
  p3Runs: number;
  /** Fraction of chaser runs encountering ≥1 tense state (Ticket 0.2 P3a). */
  p3TenseRunFrac: number;
  /** All chaser-reached post-clear decision states (visitation-weighted). */
  p3States: number;
  /** Per-state tense fraction (reported alongside the run-level P3a). */
  p3PerStateTenseFrac: number;
  /** Median stdev(push)/banked among tense states. */
  p3TenseMedianSpread: number;
  p4Rate: number;
  p5Checked: number;
  p5Ok: boolean;
}

function outside(value: number, lo: number, hi: number, unit: number): number {
  if (value < lo) return (lo - value) / unit;
  if (value > hi) return (value - hi) / unit;
  return 0;
}

export interface CriteriaOptions {
  p0SetGate?: boolean;
  /**
   * P0-set bar (natural full-clear). Default 0.995 (Ticket 0.4 Tier-2);
   * Ticket G's slice-rotation acceptance runs the owner-amended 0.994.
   */
  p0SetBar?: number;
  /**
   * Ticket G — profile v1.1 (engine v1.1 with hints): P1d gates the assisted
   * bot, P3 is measured on assisted, P2 pools greedy+assisted, and P6
   * (reader ≥ assisted + 8% median score) is added. The v1.1 inputs on
   * ProfileInputs are required.
   */
  profileV11?: boolean;
  /**
   * Ticket G slice-rotation bars (amended acceptance): per-slice P0 floor and
   * the would-be-reroll alarm. Emitted as extra criteria when provided.
   */
  sliceBars?: { minSliceP0: number; perSliceBar: number; rerollRate: number; rerollAlarm: number };
}

export function evaluateCriteria(m: ProfileInputs, opts?: CriteriaOptions): Criterion[] {
  const criteria: Criterion[] = [];
  const push = (id: string, label: string, distance: number, value: string) =>
    criteria.push({ id, label, pass: distance === 0, value, distance });

  // Ticket 0.4 C1 (owner ruling on STOP-4): P0 restructured into tiers — no
  // criterion loosened, each guarantee relocated to the tier where it lives.
  // THIS criterion is P0-config: pooled full-clear >=97% across the card-set
  // rotation — the honest cross-set robustness statement a content-free
  // config can make (dead-board rate is a card-set property; per-set P0 is a
  // report-only diagnostic). The player-facing dead-board rate is 0% by
  // construction via P0-runtime, a CONTRACT INVARIANT (production serving
  // must pass detectDeadBoard; dead seed => deterministic reroll chain — see
  // types.ts + DECISIONS.md). The pinned production card set additionally
  // needs >=99.5% natural clear over >=2000 boards in its own Tier-2 run
  // (P0-set, CIE card-set ticket) — that stricter tier is what `p0SetGate`
  // selects (Ticket E3 step 1: single-set --eval acceptance of a pinned set).
  // NATURAL means the P0-runtime reroll chain is NOT credited: the rate below
  // is raw k=0 full-clearability; the would-be reroll rate is reported
  // separately by the caller.
  if (opts?.p0SetGate) {
    const bar = opts?.p0SetBar ?? 0.995;
    push(
      "P0-set",
      `P0-set: pinned set natural full-clear >=${(bar * 100).toFixed(1)}% (no reroll assist; Ticket 0.4 Tier-2` +
        (opts?.p0SetBar !== undefined && opts.p0SetBar !== 0.995 ? ", Ticket G amended bar" : "") +
        ")",
      Math.max(0, (bar - m.oracleFullClearRate) / 0.001) + (m.deadFlagged === m.deadBoards ? 0 : 10),
      `${(m.oracleFullClearRate * 100).toFixed(2)}% natural full-clear, ${m.deadBoards} dead / ${m.deadFlagged} flagged`,
    );
  } else {
  push(
    "P0",
    "P0-config: pooled full-clear >=97% (runtime dead-board gate = contract invariant; per-set = diagnostic)",
    Math.max(0, (0.97 - m.oracleFullClearRate) / 0.005) + (m.deadFlagged === m.deadBoards ? 0 : 10),
    `${(m.oracleFullClearRate * 100).toFixed(2)}% full-clear, ${m.deadBoards} dead / ${m.deadFlagged} flagged`,
  );
  }
  push(
    "P1a",
    "random median rounds <=1",
    Math.max(0, m.randomMedianRounds - 1),
    `median ${m.randomMedianRounds}`,
  );
  push(
    "P1b",
    "greedy median rounds ~2 (within [1.5,2.5])",
    outside(m.greedyMedianRounds, 1.5, 2.5, 0.5),
    `median ${m.greedyMedianRounds}`,
  );
  push(
    "P1c",
    "chaser median rounds in [3,4]",
    outside(m.chaserMedianRounds, 3, 4, 0.5),
    `median ${m.chaserMedianRounds}`,
  );
  // Ticket G (profile v1.1): P1d gates the ASSISTED bot (the shipped-human
  // model); chaser FC stays visible as a diagnostic. Band unchanged.
  if (opts?.profileV11) {
    const fc = m.assistedFullClearRate ?? NaN;
    push(
      "P1d",
      "assisted full-clear rate in [10%,25%] (Ticket G; chaser FC = diagnostic)",
      Number.isNaN(fc) ? 10 : outside(fc, 0.1, 0.25, 0.05),
      `${(fc * 100).toFixed(1)}% (chaser ${(m.chaserFullClearRate * 100).toFixed(1)}%)`,
    );
  } else {
  push(
    "P1d",
    "chaser full-clear rate in [10%,25%]",
    outside(m.chaserFullClearRate, 0.1, 0.25, 0.05),
    `${(m.chaserFullClearRate * 100).toFixed(1)}%`,
  );
  }
  // Ticket 0.3 C1 (owner amendment): ceiling 40% → 60%. The 60% line is a
  // degeneracy alarm, not a tuning target — near-miss clustering under
  // rational play is accepted as a genre property (see DECISIONS.md STOP-3).
  push(
    "P2",
    `near-miss 25-60% of failed rounds (greedy+${opts?.profileV11 ? "assisted" : "chaser"}; 60% = degeneracy alarm)`,
    outside(m.pooledNearMissRate, 0.25, 0.6, 0.05),
    `${(m.pooledNearMissRate * 100).toFixed(1)}% of ${m.pooledFails} fails`,
  );
  push(
    "P3a",
    `>=40% of ${opts?.profileV11 ? "assisted" : "chaser"} runs hit >=1 tense state (|EV gap| <= 0.5 x stdev(push))`,
    Math.max(0, (0.4 - m.p3TenseRunFrac) / 0.1),
    `${(m.p3TenseRunFrac * 100).toFixed(1)}% of ${m.p3Runs} runs ` +
      `(per-state ${(m.p3PerStateTenseFrac * 100).toFixed(1)}% of ${m.p3States})`,
  );
  push(
    "P3b",
    "among tense states, stdev(push) >= 30% of banked (median)",
    Number.isNaN(m.p3TenseMedianSpread) ? 5 : Math.max(0, (0.3 - m.p3TenseMedianSpread) / 0.1),
    Number.isNaN(m.p3TenseMedianSpread)
      ? "no tense states"
      : `median spread ${(m.p3TenseMedianSpread * 100).toFixed(1)}%`,
  );
  push(
    "P4",
    ">=70% of boards have 2 lines >=3 slots apart within 15% of oracle",
    Math.max(0, (0.7 - m.p4Rate) / 0.1),
    `${(m.p4Rate * 100).toFixed(1)}%`,
  );
  push("P5", "determinism spot-checks (full property tests in vitest)", m.p5Ok ? 0 : 10, `${m.p5Checked} boards re-replayed, ${m.p5Ok ? "all identical" : "MISMATCH"}`);
  // Ticket G P6: hints must be worth reading — reader's median final score
  // exceeds assisted's by >=8%.
  if (opts?.profileV11) {
    const a = m.assistedMedianScore ?? NaN;
    const r = m.readerMedianScore ?? NaN;
    const ratio = r / a;
    push(
      "P6",
      "reader median final score >= 1.08 x assisted median (hints worth reading; Ticket G)",
      !Number.isFinite(ratio) ? 10 : Math.max(0, (1.08 - ratio) / 0.02),
      Number.isFinite(ratio)
        ? `reader ${r.toFixed(0)} vs assisted ${a.toFixed(0)} (${((ratio - 1) * 100).toFixed(1)}% gap)`
        : "missing median scores",
    );
  }
  // Ticket G amended slice-rotation bars: per-slice P0 floor + reroll alarm.
  if (opts?.sliceBars) {
    const sb = opts.sliceBars;
    push(
      "P0-slice",
      `per-slice natural full-clear >=${(sb.perSliceBar * 100).toFixed(1)}% (worst slice; Ticket G amended bars)`,
      Math.max(0, (sb.perSliceBar - sb.minSliceP0) / 0.001),
      `worst slice ${(sb.minSliceP0 * 100).toFixed(2)}%`,
    );
    push(
      "P0-reroll",
      `would-be reroll rate <=${(sb.rerollAlarm * 100).toFixed(1)}% (P0-runtime chain depth alarm; Ticket G)`,
      Math.max(0, (sb.rerollRate - sb.rerollAlarm) / 0.001),
      `${(sb.rerollRate * 100).toFixed(2)}% of seeds would reroll`,
    );
  }
  return criteria;
}

export function profileDistance(criteria: Criterion[]): number {
  let d = 0;
  for (const c of criteria) d += c.distance;
  return d;
}

export function formatCriteriaTable(criteria: Criterion[]): string {
  const rows = criteria.map((c) => [c.id, c.pass ? "PASS" : "FAIL", c.value, c.label]);
  const widths = [4, 5, 58, 0];
  return rows
    .map((r) => r.map((cell, i) => (widths[i] ? cell.padEnd(widths[i]) : cell)).join(" "))
    .join("\n");
}
