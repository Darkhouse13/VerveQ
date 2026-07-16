/**
 * D4 heuristic bots. Every bot plays through the real engine
 * (initRun/applyChoice), so bot results exercise exactly the shipped rules.
 *
 * - greedy:        always the highest rating; pushes while the squad's
 *                  face-value score (Σ ratings — no form, no fixture
 *                  modifiers, no synergy) ≥ 1.0 × the next threshold
 *                  (Ticket 0.1 C1), else banks.
 * - synergyChaser: maximizes the largest chain; pushes while last roundScore
 *                  ≥ 1.1 × next threshold (assumes form = 1.0).
 * - random:        uniform picks, 50/50 bank/push (seeded).
 */

import {
  applyChoice,
  initRun,
  largestChain,
  rngInt,
  toResult,
  SYNERGY_FAMILIES,
  type Card,
  type Choice,
  type RunResult,
  type RunState,
} from "../../src/lib/drawEngine";
import type { BoardContext } from "./boardContext";

type PickFn = (ctx: BoardContext, state: RunState, squadSoFar: Card[]) => number;
type DecideFn = (ctx: BoardContext, state: RunState) => "bank" | "push";

function runScriptedBot(ctx: BoardContext, pick: PickFn, decide: DecideFn): RunResult {
  const { board, config } = ctx;
  let state = initRun(board);
  const squadSoFar: Card[] = [];
  while (state.phase !== "done") {
    let choice: Choice;
    if (state.phase === "draft") {
      const offerIndex = pick(ctx, state, squadSoFar);
      squadSoFar.push(board.rows[state.rowIndex][offerIndex]);
      choice = { type: "pick", offerIndex };
    } else {
      choice = { type: decide(ctx, state) };
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

export function runGreedy(ctx: BoardContext): RunResult {
  const ratingById = new Map<string, number>();
  for (const row of ctx.board.rows) for (const card of row) ratingById.set(card.id, card.rating);
  return runScriptedBot(ctx, pickHighestRating, (c, state) => {
    let face = 0;
    for (const id of state.squad) face += ratingById.get(id) ?? 0;
    return face >= 1.0 * c.thresholds[state.fixtureIndex + 1] ? "push" : "bank";
  });
}

export function runChaser(ctx: BoardContext): RunResult {
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
  const decide: DecideFn = (c, state) => {
    const lastRound = state.rounds[state.rounds.length - 1];
    const nextThreshold = c.thresholds[state.fixtureIndex + 1];
    return lastRound.score >= 1.1 * nextThreshold ? "push" : "bank";
  };
  return runScriptedBot(ctx, pick, decide);
}

export function runRandom(ctx: BoardContext, rng: () => number): RunResult {
  return runScriptedBot(
    ctx,
    (c) => rngInt(rng, c.offers),
    () => (rng() < 0.5 ? "push" : "bank"),
  );
}
