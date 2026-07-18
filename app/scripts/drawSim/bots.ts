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
 *
 * Ticket G (engine v1.1) adds two bots on the SAME chain-first draft:
 * - assisted: models the current shipped human — benches and pushes by the
 *             exact F3 band arithmetic (projection.ts): bench = argmax of the
 *             band centre (Σ rating × fixtureMult at form 1 × synergy — the
 *             chaser's formless argmax, which IS what the shipped band shows),
 *             push iff the next threshold sits at or below the next round's
 *             band centre (bandFraction ≤ 0.5). Ignores hints.
 * - reader:   assisted + Bayesian hint use — every form-1 weight is replaced
 *             by the posterior mean form given the card's public hint
 *             (hints.ts), for both the bench argmax and the push rule.
 * Intended ladder: random < greedy < chaser < assisted ≤ reader.
 */

import {
  applyChoice,
  bandMidFor,
  clearanceSignal,
  DEFAULT_CLEARANCE,
  fixtureMultFor,
  formHint,
  hintPosteriorForm,
  initRun,
  largestChain,
  rngInt,
  scoreRound,
  squadSynergies,
  toResult,
  SYNERGY_FAMILIES,
  type Card,
  type Choice,
  type EngineConfig,
  type Fixture,
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

/** Chain-first draft (chaser policy; assisted and reader share it). */
const pickChainFirst: PickFn = (c, state, squadSoFar) => {
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

export function runChaser(ctx: BoardContext): RunResult {
  const formless: EngineConfig = { ...ctx.config, formSpread: 0 };
  const bench: BenchFn = (c, state, squad) => chaserBenchFor(c, formless, squad, state.fixtureIndex);
  const decide: DecideFn = (c, state) => {
    const lastRound = state.rounds[state.rounds.length - 1];
    const nextThreshold = c.thresholds[state.fixtureIndex + 1];
    return lastRound.score >= 1.1 * nextThreshold ? "push" : "bank";
  };
  return runScriptedBot(ctx, pickChainFirst, bench, decide);
}

/**
 * Ticket G — the assisted/reader push tolerance, as a band fraction: the bot
 * pushes iff the next threshold sits at or below `kAssisted` of the next
 * round's projected band (bandFraction ≤ kAssisted). 0.5 = threshold at the
 * band centre; lower = more risk-averse. Exact F3 arithmetic — the band is
 * [mid(1-f), mid(1+f)], so the condition is mid × (1 - f + 2f·kAssisted) ≥ t.
 * Like greedy's kGreedy (Ticket 0.2 A3/C1), this is the bot MODEL's one free
 * parameter — the shipped human's realized tolerance is unmeasured pre-launch
 * — and it is resolved by the P1d/P2/P3 profile fit in the Ticket G sweep.
 */
export const DEFAULT_K_ASSISTED = 0.5;

/** The band-arithmetic push gate: push iff mid × pushGate ≥ next threshold. */
export function assistedPushGate(formSpread: number, kAssisted: number): number {
  return 1 - formSpread + 2 * formSpread * kAssisted;
}

/**
 * Ticket G — assisted (models the current shipped human): bench and push by
 * exact F3 band arithmetic. The band centre of a fielded five is
 * Σ(rating × fixtureMult) × synergyMult — the formless round score — so the
 * band-centre bench argmax IS chaserBenchFor(formless). Push at a decision:
 * bench the NEXT fixture by band centre, push iff the next threshold sits at
 * or below `kAssisted` of the projected band. Hints are ignored — this is
 * the pre-hint shipped player.
 */
export function runAssisted(ctx: BoardContext, kAssisted = DEFAULT_K_ASSISTED): RunResult {
  const formless: EngineConfig = { ...ctx.config, formSpread: 0 };
  const gate = assistedPushGate(ctx.config.formSpread, kAssisted);
  const bench: BenchFn = (c, state, squad) => chaserBenchFor(c, formless, squad, state.fixtureIndex);
  const decide: DecideFn = (c, state, squad) => {
    const next = state.fixtureIndex + 1;
    const b = chaserBenchFor(c, formless, squad, next);
    const fielded = squad.filter((_, j) => j !== b);
    const mid = scoreRound(c.board.seed, fielded, c.board.fixtures[next], formless).score;
    return mid * gate >= c.thresholds[next] ? "push" : "bank";
  };
  return runScriptedBot(ctx, pickChainFirst, bench, decide);
}

/**
 * Posterior-mean expected round score for a fielded five: every form-1 weight
 * is replaced by E[form | the card's public hint] (hints.ts). Pure — hints
 * come from (boardSeed, cardId, roundIndex) only.
 */
export function readerExpectedScore(
  boardSeed: string,
  fielded: Card[],
  fixture: Fixture,
  config: EngineConfig,
  hintReliability: number,
): number {
  let sum = 0;
  for (const card of fielded) {
    const hint = formHint(boardSeed, card.id, fixture.index, hintReliability);
    const postForm = hintPosteriorForm(hint, hintReliability, config.formSpread);
    sum += card.rating * fixtureMultFor(card, fixture) * postForm;
  }
  let syn = 1;
  for (const s of squadSynergies(fielded, config)) syn *= s.mult;
  return sum * syn;
}

/** Reader's bench for a fixture: argmax of the posterior-mean expected score. */
export function readerBenchFor(
  ctx: BoardContext,
  squad: Card[],
  fixtureIndex: number,
  hintReliability: number,
): number {
  const fixture = ctx.board.fixtures[fixtureIndex];
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < squad.length; i++) {
    const fielded = squad.filter((_, j) => j !== i);
    const score = readerExpectedScore(ctx.board.seed, fielded, fixture, ctx.config, hintReliability);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * Ticket G — reader: assisted + Bayesian hint use. Same chain-first draft and
 * the same band arithmetic shape, but the band centre is posterior-weighted
 * per card by its hint. With config.hints absent, reliability falls back to
 * 1/3 (uninformative), where the posterior equals the prior and the reader
 * plays exactly like assisted.
 */
/**
 * Ticket G2 — the coarse pair. Both draft chain-first (the shipped human
 * follows the synergy meters) but read the game COARSELY: bench by raw face
 * (rating × fixture modifier — no synergy accounting, no band), and take
 * bank/push from the three-bucket clearance signal (clearance.ts), never the
 * exact band value.
 *
 * - coarseAssisted: benches the lowest face; pushes ONLY on SAFE. The
 *   unassisted player banks tight spots — they cannot tell a 55% push from
 *   an 80% one, so they don't take either.
 * - coarseReader: the same player reading hints — bench by posterior face
 *   (rating × mult × E[form | hint]) and the signal recomputed on the
 *   posterior band centre; pushes on anything NOT posterior-LONGSHOT. Hints
 *   turn a tight spot into a read: cold TIGHTs demote to LONGSHOT (bank),
 *   hot LONGSHOTs promote to TIGHT (push). Both bucket cutoffs are live
 *   knobs: safeRatio governs the unassisted push, longshotRatio the
 *   informed one.
 */
export function coarseBenchFor(ctx: BoardContext, squad: Card[], fixtureIndex: number): number {
  // Identical arithmetic to greedyBenchFor — the coarse player's bench IS the
  // face bench; kept as its own named policy so the two can diverge later.
  return greedyBenchFor(ctx, squad, fixtureIndex);
}

export function runCoarseAssisted(ctx: BoardContext): RunResult {
  const clearance = ctx.config.clearance ?? DEFAULT_CLEARANCE;
  const bench: BenchFn = (c, state, squad) => coarseBenchFor(c, squad, state.fixtureIndex);
  const decide: DecideFn = (c, state, squad) => {
    const next = state.fixtureIndex + 1;
    const b = coarseBenchFor(c, squad, next);
    const fielded = squad.filter((_, j) => j !== b);
    const fixture = c.board.fixtures[next];
    const signal = clearanceSignal(bandMidFor(fielded, fixture, c.config), c.thresholds[next], clearance);
    return signal === "SAFE" ? "push" : "bank";
  };
  return runScriptedBot(ctx, pickChainFirst, bench, decide);
}

/** Coarse reader's bench: lowest posterior face (rating × mult × E[form|hint]). */
export function coarseReaderBenchFor(
  ctx: BoardContext,
  squad: Card[],
  fixtureIndex: number,
  hintReliability: number,
): number {
  const fixture = ctx.board.fixtures[fixtureIndex];
  let worst = 0;
  let worstFace = Infinity;
  for (let i = 0; i < squad.length; i++) {
    const hint = formHint(ctx.board.seed, squad[i].id, fixture.index, hintReliability);
    const postForm = hintPosteriorForm(hint, hintReliability, ctx.config.formSpread);
    const face = squad[i].rating * fixtureMultFor(squad[i], fixture) * postForm;
    if (face < worstFace) {
      worstFace = face;
      worst = i;
    }
  }
  return worst;
}

/** Posterior band centre: Σ(rating × mult × E[form|hint]) × synergyMult. */
export function coarseReaderMidFor(
  boardSeed: string,
  fielded: Card[],
  fixture: Fixture,
  config: EngineConfig,
  hintReliability: number,
): number {
  let sum = 0;
  for (const card of fielded) {
    const hint = formHint(boardSeed, card.id, fixture.index, hintReliability);
    const postForm = hintPosteriorForm(hint, hintReliability, config.formSpread);
    sum += card.rating * fixtureMultFor(card, fixture) * postForm;
  }
  let syn = 1;
  for (const s of squadSynergies(fielded, config)) syn *= s.mult;
  return sum * syn;
}

export function runCoarseReader(ctx: BoardContext): RunResult {
  const clearance = ctx.config.clearance ?? DEFAULT_CLEARANCE;
  const r = ctx.config.hints?.hintReliability ?? 1 / 3;
  const bench: BenchFn = (c, state, squad) =>
    coarseReaderBenchFor(c, squad, state.fixtureIndex, r);
  const decide: DecideFn = (c, state, squad) => {
    const next = state.fixtureIndex + 1;
    const b = coarseReaderBenchFor(c, squad, next, r);
    const fielded = squad.filter((_, j) => j !== b);
    const fixture = c.board.fixtures[next];
    const mid = coarseReaderMidFor(c.board.seed, fielded, fixture, c.config, r);
    const signal = clearanceSignal(mid, c.thresholds[next], clearance);
    return signal === "LONGSHOT" ? "bank" : "push";
  };
  return runScriptedBot(ctx, pickChainFirst, bench, decide);
}

export function runReader(ctx: BoardContext, kAssisted = DEFAULT_K_ASSISTED): RunResult {
  const r = ctx.config.hints?.hintReliability ?? 1 / 3;
  const gate = assistedPushGate(ctx.config.formSpread, kAssisted);
  const bench: BenchFn = (c, state, squad) => readerBenchFor(c, squad, state.fixtureIndex, r);
  const decide: DecideFn = (c, state, squad) => {
    const next = state.fixtureIndex + 1;
    const b = readerBenchFor(c, squad, next, r);
    const fielded = squad.filter((_, j) => j !== b);
    const mid = readerExpectedScore(c.board.seed, fielded, c.board.fixtures[next], c.config, r);
    return mid * gate >= c.thresholds[next] ? "push" : "bank";
  };
  return runScriptedBot(ctx, pickChainFirst, bench, decide);
}

export function runRandom(ctx: BoardContext, rng: () => number): RunResult {
  return runScriptedBot(
    ctx,
    (c) => rngInt(rng, c.offers),
    (_c, state) => rngInt(rng, state.squad.length),
    () => (rng() < 0.5 ? "push" : "bank"),
  );
}
