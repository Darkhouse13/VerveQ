/**
 * Distributions, the P3 push-EV Monte-Carlo estimator, and the target-profile
 * criteria (P0–P5) with a normalized distance per criterion (0 = pass) used
 * by the sweep ranking.
 */

import { squadSynergies } from "../../src/lib/drawEngine";
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
}

export interface BotAccumulator {
  name: string;
  rounds: number[];
  scores: number[];
  busts: number;
  banks: number;
  fullClears: number;
  nearMisses: number;
}

export function newBotAccumulator(name: string): BotAccumulator {
  return { name, rounds: [], scores: [], busts: 0, banks: 0, fullClears: 0, nearMisses: 0 };
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
    if (!failed.cleared && failed.score >= failed.threshold * (1 - NEAR_MISS_WINDOW)) acc.nearMisses++;
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
  };
}

/** Ticket 0.1 C2 — a state is "tense" when EV(push)−EV(bank) ∈ [TENSE_LO, TENSE_HI] × banked. */
export const TENSE_LO = -0.2;
export const TENSE_HI = 0.1;

/**
 * P3 (Ticket 0.1 C2) — EV/stdev of PUSH at a chaser-reached post-clear state,
 * from the player's information set: squad, synergy, modifiers, and thresholds
 * are known; future forms are unknown and resampled uniform in [1-f, 1+f].
 * After the forced push the simulated player continues with the chaser's own
 * policy. EV(bank) at the state is simply `banked`.
 */
export function evalPushAtState(
  ctx: BoardContext,
  squadCardIdxs: number[],
  nextFixture: number,
  banked: number,
  rng: () => number,
  samples: number,
): { evGap: number; spread: number } {
  const { config, ratingMod, thresholds, N, R } = ctx;
  const squadCards = squadCardIdxs.map((i) => ctx.cards[i]);
  let synMult = 1;
  for (const s of squadSynergies(squadCards, config)) synMult *= s.mult;
  const f = config.formSpread;

  let sum = 0;
  let sumSq = 0;
  for (let s = 0; s < samples; s++) {
    let cum = banked;
    let final = 0;
    for (let j = nextFixture; j < R; j++) {
      let base = 0;
      for (const ci of squadCardIdxs) base += ratingMod[j * N + ci] * (1 - f + 2 * f * rng());
      const score = base * synMult;
      if (score < thresholds[j]) {
        final = cum * config.bustKeep;
        break;
      }
      cum += score;
      if (j === R - 1) {
        final = cum * config.fullClearBonus;
      } else if (score < 1.1 * thresholds[j + 1]) {
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
  pooledNearMissRate: number;
  pooledFails: number;
  /** Chaser-reached post-clear states sampled at rounds 2 and 3 (visitation-weighted). */
  p3States: number;
  /** Fraction of sampled states with EV(push)−EV(bank) ∈ [TENSE_LO, TENSE_HI] × banked. */
  p3TenseFrac: number;
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

export function evaluateCriteria(m: ProfileInputs): Criterion[] {
  const criteria: Criterion[] = [];
  const push = (id: string, label: string, distance: number, value: string) =>
    criteria.push({ id, label, pass: distance === 0, value, distance });

  push(
    "P0",
    "oracle full-clears >=99.5%, remainder flagged dead",
    Math.max(0, (0.995 - m.oracleFullClearRate) / 0.005) + (m.deadFlagged === m.deadBoards ? 0 : 10),
    `${(m.oracleFullClearRate * 100).toFixed(2)}% full-clear, ${m.deadBoards} dead / ${m.deadFlagged} flagged`,
  );
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
  push(
    "P1d",
    "chaser full-clear rate in [10%,25%]",
    outside(m.chaserFullClearRate, 0.1, 0.25, 0.05),
    `${(m.chaserFullClearRate * 100).toFixed(1)}%`,
  );
  push(
    "P2",
    "near-miss 25-40% of failed rounds (greedy+chaser)",
    outside(m.pooledNearMissRate, 0.25, 0.4, 0.05),
    `${(m.pooledNearMissRate * 100).toFixed(1)}% of ${m.pooledFails} fails`,
  );
  push(
    "P3a",
    "tense states (EV gap in [-20%,+10%] of banked) >= 40% of round-2/3 states",
    Math.max(0, (0.4 - m.p3TenseFrac) / 0.1),
    `${(m.p3TenseFrac * 100).toFixed(1)}% of ${m.p3States} states tense`,
  );
  push(
    "P3b",
    "among tense states, stdev(push) >= 35% of banked (median)",
    Number.isNaN(m.p3TenseMedianSpread) ? 5 : Math.max(0, (0.35 - m.p3TenseMedianSpread) / 0.1),
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
