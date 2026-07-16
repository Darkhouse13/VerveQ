/**
 * D4 heuristic bots (Ticket 0.2 A3 bench policies). Every bot plays through
 * the real engine (initRun/applyChoice), so bot results exercise exactly the
 * shipped rules — including the per-round bench pick.
 *
 * - greedy:        drafts the highest rating; benches the lowest face
 *                  (rating × fixture modifier) for the upcoming fixture;
 *                  pushes while the next round's fielded face value
 *                  (Σ ratings of the 5 it would field — no form, no
 *                  modifiers, no synergy) ≥ kGreedy × next threshold
 *                  (C1 rule, kGreedy knob, default 1.0).
 * - synergyChaser: drafts to maximize the largest chain; benches to maximize
 *                  the synergy-adjusted expected round score at form = 1;
 *                  pushes while last roundScore ≥ 1.1 × next threshold.
 * - random:        uniform picks, uniform bench, 50/50 bank/push (seeded).
 */

import {
  applyChoice,
  fixtureMultFor,
  initRun,
  largestChain,
  rngInt,
  scoreRound,
  toResult,
  SYNERGY_FAMILIES,
  type Card,
  type Choice,
  type EngineConfig,
  type RunResult,
  type RunState,
} from "../../src/lib/drawEngine";
import type { BoardContext } from "./boardContext";

type PickFn = (ctx: BoardContext, state: RunState, squadSoFar: Card[]) => number;
type BenchFn = (ctx: BoardContext, state: RunState, squad: Card[]) => number;
type DecideFn = (ctx: BoardContext, state: RunState, squad: Card[]) => "bank" | "push";

function runScriptedBot(
  ctx: BoardContext,
  pick: PickFn,
  bench: BenchFn,
  decide: DecideFn,
): RunResult {
  const { board, config } = ctx;
  let state = initRun(board);
  const squadSoFar: Card[] = [];
  while (state.phase !== "done") {
    let choice: Choice;
    if (state.phase === "draft") {
      const offerIndex = pick(ctx, state, squadSoFar);
      squadSoFar.push(board.rows[state.rowIndex][offerIndex]);
      choice = { type: "pick", offerIndex };
    } else if (state.phase === "bench") {
      choice = { type: "bench", squadIndex: bench(ctx, state, squadSoFar) };
    } else {
      choice = { type: decide(ctx, state, squadSoFar) };
    }
    state = applyChoice(board, config, state, choice);
  }
  return toResult(state);
}

const pickHighestRating: PickFn = (ctx, state) => {
  const row = ctx.board.rows[state.rowIndex];
  let best = 0;
  for (let o = 1; o < row.length; o++) if (row[o].rating > row[best].rating) best = o;
  return best;
};

/** Greedy's bench for a fixture: the squad card with the lowest rating × fixtureMult. */
export function greedyBenchFor(ctx: BoardContext, squad: Card[], fixtureIndex: number): number {
  const fixture = ctx.board.fixtures[fixtureIndex];
  let worst = 0;
  let worstFace = Infinity;
  for (let i = 0; i < squad.length; i++) {
    const face = squad[i].rating * fixtureMultFor(squad[i], fixture);
    if (face < worstFace) {
      worstFace = face;
      worst = i;
    }
  }
  return worst;
}

export function runGreedy(ctx: BoardContext, kGreedy = 1): RunResult {
  const bench: BenchFn = (c, state, squad) => greedyBenchFor(c, squad, state.fixtureIndex);
  const decide: DecideFn = (c, state, squad) => {
    // Project the next round: bench the lowest face, sum the fielded RATINGS
    // (face value per C1 — no form, no modifiers, no synergy in the sum).
    const nextFixture = state.fixtureIndex + 1;
    const b = greedyBenchFor(c, squad, nextFixture);
    let face = 0;
    for (let i = 0; i < squad.length; i++) if (i !== b) face += squad[i].rating;
    return face >= kGreedy * c.thresholds[nextFixture] ? "push" : "bank";
  };
  return runScriptedBot(ctx, pickHighestRating, bench, decide);
}

/** Chaser's bench for a fixture: maximize the synergy-adjusted expected score at form = 1. */
export function chaserBenchFor(
  ctx: BoardContext,
  formless: EngineConfig,
  squad: Card[],
  fixtureIndex: number,
): number {
  const fixture = ctx.board.fixtures[fixtureIndex];
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < squad.length; i++) {
    const fielded = squad.filter((_, j) => j !== i);
    const score = scoreRound(ctx.board.seed, fielded, fixture, formless).score;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function runChaser(ctx: BoardContext): RunResult {
  const formless: EngineConfig = { ...ctx.config, formSpread: 0 };
  const pick: PickFn = (c, state, squadSoFar) => {
    const row = c.board.rows[state.rowIndex];
    let bestOffer = 0;
    let bestChain = -1;
    let bestRating = -1;
    for (let o = 0; o < row.length; o++) {
      const candidate = [...squadSoFar, row[o]];
      let chain = 0;
      for (const family of SYNERGY_FAMILIES) {
        const len = largestChain(candidate, family).chain;
        if (len > chain) chain = len;
      }
      if (chain > bestChain || (chain === bestChain && row[o].rating > bestRating)) {
        bestOffer = o;
        bestChain = chain;
        bestRating = row[o].rating;
      }
    }
    return bestOffer;
  };
  const bench: BenchFn = (c, state, squad) => chaserBenchFor(c, formless, squad, state.fixtureIndex);
  const decide: DecideFn = (c, state) => {
    const lastRound = state.rounds[state.rounds.length - 1];
    const nextThreshold = c.thresholds[state.fixtureIndex + 1];
    return lastRound.score >= 1.1 * nextThreshold ? "push" : "bank";
  };
  return runScriptedBot(ctx, pick, bench, decide);
}

export function runRandom(ctx: BoardContext, rng: () => number): RunResult {
  return runScriptedBot(
    ctx,
    (c) => rngInt(rng, c.offers),
    (_c, state) => rngInt(rng, state.squad.length),
    () => (rng() < 0.5 ? "push" : "bank"),
  );
}
