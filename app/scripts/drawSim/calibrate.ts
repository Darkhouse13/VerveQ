/**
 * Threshold-curve calibrator + content-genome search.
 *
 *   npx tsx scripts/drawSim/calibrate.ts --config <path>       # plane for one content config
 *   npx tsx scripts/drawSim/calibrate.ts --search 150          # sample content genomes too
 *
 * Key structural fact: every bot's draft picks AND bench picks (and therefore
 * its per-round scores) are THRESHOLD-INDEPENDENT — greedy drafts by rating
 * and benches by rating×modifier, chaser by chain / form=1 score, random by
 * seeded rng; only bank/push/bust depend on the curve. So for a fixed content
 * config we precompute, per board (all bench-aware, Ticket 0.2):
 *   - each heuristic bot's 5 fielded round scores (+ greedy's per-round
 *     fielded face values and the random bot's bench/coin stream),
 *   - the chaser's form=1 fielded weights (for the P3 Monte-Carlo),
 *   - the full 729-line × 5-round BENCH-OPTIMAL score matrix (oracle),
 * then sweep the ENTIRE threshold plane (base × growth × bossAxis, where
 * bossAxis = bossMult × thresholdShape[last] — the two knobs are analytically
 * one axis, decomposed only on config emission) scoring P0 / P1a-P1d / P2 —
 * with greedy's kGreedy push knob resolved per curve over a small grid — then:
 *   - P3a/P3b (Ticket 0.2, run-level): the SAME push-EV Monte-Carlo the sim
 *     runs (chaser continuation policy, forms resampled uniform), tense :=
 *     |EV gap| ≤ 0.5 × stdev(push), on a stratified shortlist of stage-1
 *     curves; P3a = fraction of chaser runs with ≥1 tense state.
 *   - P4 line diversity (computed for finalists only — needs the line matrix).
 * Winners are verified with the real sim (draw:sim) afterwards.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildArchetypes,
  DAILY_SLICE_CONFIG_V1,
  DEFAULT_ENGINE_CONFIG,
  FORM_HINT_BANDS,
  formFor,
  fixtureMultFor,
  generateBoard,
  generateCardSet,
  hintPosteriorForm,
  rngFromString,
  rngInt,
  scoreRound,
  sliceDeck,
  sliceTripleScore,
  squadSynergies,
  unitFromString,
  type Card,
  type EngineConfig,
} from "../../src/lib/drawEngine";
import { C13V1_CONFIG } from "../../src/lib/drawEngine/configs/c13v1";
import { benchOptimalScores, buildContext, type BoardContext } from "./boardContext";
import { buildBoostOnlyArchetypes, buildMixedDipArchetypes } from "./archetypeTables";
import {
  assistedPushGate,
  chaserBenchFor,
  greedyBenchFor,
  runAssisted,
  runChaser,
  runGreedy,
  runRandom,
  runReader,
} from "./bots";
import { runOracle } from "./oracle";
import { makeSliceAcceptanceScorer, SLICE_SCORE_TARGET } from "./sliceScorer";
import { determinismSpotCheck } from "./evaluate";
import { loadConfig, parseFlags } from "./sim";
import {
  evaluateCriteria,
  formatCriteriaTable,
  median,
  nearMissAttribution,
  NEAR_MISS_WINDOW,
} from "./metrics";

interface BoardData {
  /** Greedy's realized fielded score per round (bench = lowest rating×mult). */
  greedy: number[];
  /** Per round: Σ ratings of the 5 cards greedy would field — the C1/kGreedy projection. */
  greedyFaces: number[];
  /** Chaser's realized fielded score per round (bench = form=1 argmax). */
  chaser: number[];
  /**
   * chaserW[r*5+i] = rating × fixtureMult × synergyMult for the chaser's i-th
   * FIELDED card in round r — a resampled round score is Σ chaserW·U(1-f,1+f),
   * the exact distribution evalPushAtState draws from in the real sim.
   */
  chaserW: Float64Array;
  /** Random bot's realized fielded score per round (seeded uniform bench). */
  random: number[];
  /** Random bot's pre-drawn push coins (true = push), interleaved after each bench draw. */
  coins: boolean[];
  /** Bench-optimal lineScores[line * R + r] (max over the 6 removals, oracle policy). */
  lineScores: Float64Array;
  /**
   * Ticket G — F3 band centres per round for the chain-first squad's
   * band-optimal bench (= the chaser's formless argmax value): the assisted
   * bot's push rule compares mids[r] against t[r].
   */
  mids: number[];
  /** Chain-first squad per-round weights w[r*rows+i] = rating × fixtureMult. */
  squadW: Float64Array;
  /** Synergy multiplier of the fielded five after removing squad card i. */
  squadSyn: Float64Array;
  /** Realized forms squadForm[r*rows+i] for the chain-first squad. */
  squadForm: Float64Array;
  /**
   * Realized contributions squadC[r*rows+i] = rating × form × fixtureMult,
   * multiplied in scoreRound's exact op order so analytic realized scores are
   * float-identical to the engine's.
   */
  squadC: Float64Array;
  /** Hint raw draws per (round, squad card): true band idx + the two noise draws. */
  hintTrue: Int8Array;
  hintV1: Float64Array;
  hintV2: Float64Array;
}

/** Reader analytic per-board data for one hintReliability: realized fielded
 * score + posterior band centre per round (bench = posterior argmax). */
export interface ReaderData {
  scores: number[];
  mids: number[];
}

/**
 * Derive the reader's per-round realized scores and posterior mids from the
 * precomputed squad arrays, mirroring bots.ts readerBenchFor/readerExpectedScore
 * float-for-float (same summation order, same hintPosteriorForm calls).
 */
export function readerDataFor(
  bd: BoardData,
  config: EngineConfig,
  hintReliability: number,
): ReaderData {
  const R = config.fixtureCount;
  const rows = config.rows;
  const s = config.formSpread;
  const scores: number[] = [];
  const mids: number[] = [];
  for (let r = 0; r < R; r++) {
    // Posterior mean form per squad card for this round.
    const post: number[] = [];
    for (let i = 0; i < rows; i++) {
      const k = r * rows + i;
      const hintIdx =
        bd.hintV1[k] < hintReliability
          ? bd.hintTrue[k]
          : (bd.hintTrue[k] + (bd.hintV2[k] < 0.5 ? 1 : 2)) % 3;
      post.push(hintPosteriorForm(FORM_HINT_BANDS[hintIdx], hintReliability, s));
    }
    let bench = 0;
    let bestMid = -1;
    for (let i = 0; i < rows; i++) {
      let sum = 0;
      for (let j = 0; j < rows; j++) if (j !== i) sum += bd.squadW[r * rows + j] * post[j];
      const mid = sum * bd.squadSyn[i];
      if (mid > bestMid) {
        bestMid = mid;
        bench = i;
      }
    }
    let realized = 0;
    for (let j = 0; j < rows; j++) if (j !== bench) realized += bd.squadC[r * rows + j];
    scores.push(realized * bd.squadSyn[bench]);
    mids.push(bestMid);
  }
  return { scores, mids };
}

function draftGreedy(ctx: BoardContext): Card[] {
  return ctx.board.rows.map((row) =>
    row.reduce((best, c) => (c.rating > best.rating ? c : best), row[0]),
  );
}

function draftChaser(ctx: BoardContext): Card[] {
  const squad: Card[] = [];
  for (const row of ctx.board.rows) {
    let best = row[0];
    let bestChain = -1;
    let bestRating = -1;
    for (const card of row) {
      const candidate = [...squad, card];
      const count = (tags: (c: Card) => string[]) => {
        const m = new Map<string, number>();
        for (const c of candidate) for (const t of tags(c)) m.set(t, (m.get(t) ?? 0) + 1);
        return Math.max(...m.values());
      };
      const chain = Math.max(count((c) => c.clubs), count((c) => [c.nation]), count((c) => [c.era]));
      if (chain > bestChain || (chain === bestChain && card.rating > bestRating)) {
        best = card;
        bestChain = chain;
        bestRating = card.rating;
      }
    }
    squad.push(best);
  }
  return squad;
}

/** Bench-optimal line scores (oracle policy) — leaves delegate to benchOptimalScores. */
function computeLineScores(ctx: BoardContext): Float64Array {
  const { rows, offers, R, N, eff } = ctx;
  const lineCount = Math.pow(offers, rows);
  const out = new Float64Array(lineCount * R);
  const roundSums = new Float64Array(R);
  const clubCounts = new Int32Array(ctx.numClubs);
  const nationCounts = new Int32Array(ctx.numNations);
  const eraCounts = new Int32Array(ctx.numEras);
  const squadIdxs = new Int32Array(rows);
  const benchScores = new Float64Array(R);
  const visit = (row: number, leafBase: number): void => {
    if (row === rows) {
      benchOptimalScores(ctx, squadIdxs, clubCounts, nationCounts, eraCounts, roundSums, benchScores);
      for (let r = 0; r < R; r++) out[leafBase * R + r] = benchScores[r];
      return;
    }
    for (let o = 0; o < offers; o++) {
      const c = row * offers + o;
      squadIdxs[row] = c;
      for (let r = 0; r < R; r++) roundSums[r] += eff[r * N + c];
      for (const id of ctx.clubIds[c]) clubCounts[id]++;
      nationCounts[ctx.nationIds[c]]++;
      eraCounts[ctx.eraIds[c]]++;
      visit(row + 1, leafBase * offers + o);
      for (let r = 0; r < R; r++) roundSums[r] -= eff[r * N + c];
      for (const id of ctx.clubIds[c]) clubCounts[id]--;
      nationCounts[ctx.nationIds[c]]--;
      eraCounts[ctx.eraIds[c]]--;
    }
  };
  visit(0, 0);
  return out;
}

// Rotate over several card sets: the sim generates its set from its own
// seed, so a curve tuned against a single set overfits the set lottery —
// averaging over sets is what makes winners transfer across sim seeds.
const CARD_SETS = 10;

function rotatedCardSets(config: EngineConfig, seedBase: string): Card[][] {
  return Array.from({ length: CARD_SETS }, (_, s) =>
    generateCardSet(`${seedBase}|cards${s}`, config.cardGen),
  );
}

/**
 * Ticket E3 step 1 — load a COMMITTED card set (drawCardsReal.candidates.json
 * shape) as engine cards, using the same field mapping the serving layer uses
 * (convex/drawBoards.ts loadCardSet: tag list = clubs, era = label). This is
 * what --eval's single-set mode (P0-set gate, Ticket 0.4 Tier-2) runs on.
 */
function loadCardSetFile(p: string): Card[] {
  interface RealCardRow {
    cardId: string;
    name: string;
    rating: number;
    clubs: { tag: string }[];
    nation: string;
    eraLabel: string;
    eraIndex: number;
    position: Card["position"];
  }
  const rows = JSON.parse(fs.readFileSync(p, "utf8")) as RealCardRow[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`empty/invalid card set file: ${p}`);
  return rows.map((r) => ({
    id: r.cardId,
    name: r.name,
    rating: r.rating,
    clubs: r.clubs.map((c) => c.tag),
    nation: r.nation,
    era: r.eraLabel,
    eraIndex: r.eraIndex,
    position: r.position,
  }));
}

export function precomputeBoard(
  config: EngineConfig,
  formless: EngineConfig,
  cardSet: Card[],
  seedBase: string,
  i: number,
): { data: BoardData; ctx: BoardContext } {
  const R = config.fixtureCount;
  const fielded = config.rows - 1;
  const board = generateBoard(`${seedBase}#${i}`, cardSet, config);
  const ctx = buildContext(board, config);

  // Random bot: replicate runScriptedBot's exact rng consumption order —
  // 6 picks, then per round a bench draw, then (if it reaches the decision)
  // a push coin. Later draws are simply unused when a run stops early.
  const rng = rngFromString(`${seedBase}#${i}|randombot`);
  const randomSquad = board.rows.map((row) => row[rngInt(rng, row.length)]);
  const randomBench: number[] = [];
  const coins: boolean[] = [];
  for (let r = 0; r < R; r++) {
    randomBench.push(rngInt(rng, config.rows));
    if (r < R - 1) coins.push(rng() < 0.5);
  }

  const chaserSquad = draftChaser(ctx);
  const greedySquad = draftGreedy(ctx);

  const greedy: number[] = [];
  const greedyFaces: number[] = [];
  const chaser: number[] = [];
  const random: number[] = [];
  const chaserW = new Float64Array(R * fielded);
  board.fixtures.forEach((fixture, r) => {
    const gb = greedyBenchFor(ctx, greedySquad, r);
    const gFielded = greedySquad.filter((_, j) => j !== gb);
    greedy.push(scoreRound(board.seed, gFielded, fixture, config).score);
    greedyFaces.push(gFielded.reduce((sum, c) => sum + c.rating, 0));

    const cb = chaserBenchFor(ctx, formless, chaserSquad, r);
    const cFielded = chaserSquad.filter((_, j) => j !== cb);
    chaser.push(scoreRound(board.seed, cFielded, fixture, config).score);
    const breakdown = scoreRound(board.seed, cFielded, fixture, formless);
    breakdown.cards.forEach((card, j) => {
      chaserW[r * fielded + j] = card.contribution * breakdown.synergyMult;
    });

    const rFielded = randomSquad.filter((_, j) => j !== randomBench[r]);
    random.push(scoreRound(board.seed, rFielded, fixture, config).score);
  });

  // Ticket G — chain-first squad raw arrays for the assisted/reader analytic
  // path (band centres, posterior benches, hint draws).
  const rows = config.rows;
  const squadW = new Float64Array(R * rows);
  const squadForm = new Float64Array(R * rows);
  const squadC = new Float64Array(R * rows);
  const hintTrue = new Int8Array(R * rows);
  const hintV1 = new Float64Array(R * rows);
  const hintV2 = new Float64Array(R * rows);
  board.fixtures.forEach((fixture, r) => {
    chaserSquad.forEach((card, i) => {
      const k = r * rows + i;
      const mult = fixtureMultFor(card, fixture);
      const form = formFor(board.seed, card.id, r, config.formSpread);
      squadW[k] = card.rating * mult;
      squadForm[k] = form;
      squadC[k] = card.rating * form * mult;
      const u = unitFromString(`${board.seed}|form|${card.id}|${r}`);
      hintTrue[k] = u < 1 / 3 ? 0 : u < 2 / 3 ? 1 : 2;
      const noise = rngFromString(`${board.seed}|hint|${card.id}|${r}`);
      hintV1[k] = noise();
      hintV2[k] = noise();
    });
  });
  const squadSyn = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    const fieldedSquad = chaserSquad.filter((_, j) => j !== i);
    let syn = 1;
    for (const s of squadSynergies(fieldedSquad, config)) syn *= s.mult;
    squadSyn[i] = syn;
  }
  // Band centre per round = the band-optimal bench's formless score (the same
  // argmax chaserBenchFor resolves, same summation order, strict >).
  const mids: number[] = [];
  for (let r = 0; r < R; r++) {
    let best = -1;
    for (let i = 0; i < rows; i++) {
      let sum = 0;
      for (let j = 0; j < rows; j++) if (j !== i) sum += squadW[r * rows + j];
      const mid = sum * squadSyn[i];
      if (mid > best) best = mid;
    }
    mids.push(best);
  }

  return {
    data: {
      greedy,
      greedyFaces,
      chaser,
      chaserW,
      random,
      coins,
      lineScores: computeLineScores(ctx),
      mids,
      squadW,
      squadSyn,
      squadForm,
      squadC,
      hintTrue,
      hintV1,
      hintV2,
    },
    ctx,
  };
}

function precompute(config: EngineConfig, seedBase: string, boards: number): BoardData[] {
  const cardSets = rotatedCardSets(config, seedBase);
  const formless: EngineConfig = { ...config, formSpread: 0 };
  const data: BoardData[] = [];
  for (let i = 0; i < boards; i++) {
    data.push(precomputeBoard(config, formless, cardSets[i % CARD_SETS], seedBase, i).data);
  }
  return data;
}

/** Analytic run outcome: rounds cleared, fail margin (NaN if no bust), final
 * score under the engine's settlement (bank = cum, bust = cum × bustKeep,
 * full clear = cum × fullClearBonus). */
export interface BotOutcome {
  rounds: number;
  failMargin: number;
  fullClear: boolean;
  final: number;
}

export function greedyRounds(
  scores: number[],
  faces: number[],
  kGreedy: number,
  t: number[],
  bustKeep: number,
  bonus: number,
): BotOutcome {
  let cum = 0;
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r])
      return { rounds: r, failMargin: scores[r] / t[r], fullClear: false, final: cum * bustKeep };
    cum += scores[r];
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
    if (faces[r + 1] < kGreedy * t[r + 1])
      return { rounds: r + 1, failMargin: NaN, fullClear: false, final: cum };
  }
  return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
}

export function chaserRounds(
  scores: number[],
  t: number[],
  bustKeep: number,
  bonus: number,
): BotOutcome {
  let cum = 0;
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r])
      return { rounds: r, failMargin: scores[r] / t[r], fullClear: false, final: cum * bustKeep };
    cum += scores[r];
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
    if (scores[r] < 1.1 * t[r + 1])
      return { rounds: r + 1, failMargin: NaN, fullClear: false, final: cum };
  }
  return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
}

/**
 * Ticket G — the F3 band policy (assisted with realized chaser scores + band
 * mids; reader with ReaderData): bust on a failed round, bank when the NEXT
 * round's band centre sits below its threshold, else push.
 */
export function bandRounds(
  scores: number[],
  mids: number[],
  t: number[],
  bustKeep: number,
  bonus: number,
  /** assistedPushGate(formSpread, kAssisted); 1 = kAssisted 0.5 (band centre). */
  pushGate = 1,
): BotOutcome {
  let cum = 0;
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r])
      return { rounds: r, failMargin: scores[r] / t[r], fullClear: false, final: cum * bustKeep };
    cum += scores[r];
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
    if (mids[r + 1] * pushGate < t[r + 1])
      return { rounds: r + 1, failMargin: NaN, fullClear: false, final: cum };
  }
  return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
}

export function randomRounds(
  scores: number[],
  coins: boolean[],
  t: number[],
  bustKeep: number,
  bonus: number,
): BotOutcome {
  let cum = 0;
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r])
      return { rounds: r, failMargin: scores[r] / t[r], fullClear: false, final: cum * bustKeep };
    cum += scores[r];
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
    if (!coins[r]) return { rounds: r + 1, failMargin: NaN, fullClear: false, final: cum };
  }
  return { rounds: t.length, failMargin: NaN, fullClear: true, final: cum * bonus };
}

/** Raw P3 accumulators — poolable across card-set chunks (counts add, spreads concat). */
interface McP3Raw {
  runs: number;
  tenseRuns: number;
  states: number;
  tense: number;
  tenseSpreads: number[];
}

function mcP3Derive(raw: McP3Raw): { p3a: number; p3b: number; perState: number } {
  return {
    p3a: raw.runs === 0 ? 0 : raw.tenseRuns / raw.runs,
    p3b: raw.tenseSpreads.length ? median(raw.tenseSpreads) : NaN,
    perState: raw.states === 0 ? 0 : raw.tense / raw.states,
  };
}

/**
 * P3a/P3b for one curve (Ticket 0.2, run-level) — the same Monte-Carlo
 * evalPushAtState runs in the real sim (chaser continuation policy, forms
 * resampled uniform), fed by the precomputed fielded chaserW weight vectors.
 * tense := |EV gap| ≤ 0.5 × stdev(push); P3a = fraction of chaser runs with
 * ≥1 tense state. Run on stage-1 shortlist curves only.
 */
function mcP3(
  data: BoardData[],
  config: EngineConfig,
  t: number[],
  rng: () => number,
  samples: number,
  /** Ticket G: assistedPushGate value — measure assisted-reached states with
   * the band-policy continuation. Undefined = v1.0 chaser policy. */
  assistedGate?: number,
): McP3Raw {
  const R = config.fixtureCount;
  const fielded = config.rows - 1;
  const f = config.formSpread;
  let states = 0;
  let tense = 0;
  let tenseRuns = 0;
  const tenseSpreads: number[] = [];
  for (const bd of data) {
    const c =
      assistedGate !== undefined
        ? bandRounds(bd.chaser, bd.mids, t, config.bustKeep, config.fullClearBonus, assistedGate)
        : chaserRounds(bd.chaser, t, config.bustKeep, config.fullClearBonus);
    let banked = 0;
    let runTense = false;
    for (let k = 1; k < R; k++) {
      if (c.rounds < k) break;
      banked += bd.chaser[k - 1];
      let sum = 0;
      let sumSq = 0;
      for (let s = 0; s < samples; s++) {
        let cum = banked;
        let final = 0;
        for (let j = k; j < R; j++) {
          let score = 0;
          for (let i = 0; i < fielded; i++) score += bd.chaserW[j * fielded + i] * (1 - f + 2 * f * rng());
          if (score < t[j]) {
            final = cum * config.bustKeep;
            break;
          }
          cum += score;
          if (j === R - 1) {
            final = cum * config.fullClearBonus;
          } else if (
            assistedGate !== undefined
              ? bd.mids[j + 1] * assistedGate < t[j + 1]
              : score < 1.1 * t[j + 1]
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
      const spread = Math.sqrt(variance);
      states++;
      if (Math.abs(ev - banked) <= 0.5 * spread) {
        tense++;
        runTense = true;
        tenseSpreads.push(spread / banked);
      }
    }
    if (runTense) tenseRuns++;
  }
  return { runs: data.length, tenseRuns, states, tense, tenseSpreads };
}

/** bossAxis = bossMult × thresholdShape[last]; one analytic axis, split on emission. */
export interface Curve {
  base: number;
  growth: number;
  bossAxis: number;
}

interface PlaneResult {
  curve: Curve;
  /** Greedy push knob picked per curve from KGREEDY_GRID (best P1b+P2 fit). */
  kGreedy: number;
  distance: number;
  passes: number;
  p0: number;
  p1a: number;
  p1b: number;
  p1c: number;
  p1d: number;
  p2: number;
  p3a: number;
  p3b: number;
  p3PerState: number;
  detail: string;
}

const KGREEDY_GRID = [0.9, 1.0, 1.1, 1.2];

/** A fail counts as a near-miss when score/threshold ≥ this (12% window, metrics.ts). */
const NEAR_MISS_FLOOR = 1 - NEAR_MISS_WINDOW;

function thresholdsFor(curve: Curve, R: number): number[] {
  return Array.from({ length: R }, (_, r) =>
    Math.round(curve.base * Math.pow(curve.growth, r) * (r === R - 1 ? curve.bossAxis : 1)),
  );
}

/** Decompose bossAxis into D1 knobs: bossMult stays ≤ its v0 range, the boss wall goes to thresholdShape (1.0–1.6). */
function curveToThresholds(curve: Curve): {
  base: number;
  growth: number;
  bossMult: number;
  thresholdShape: number[];
} {
  const a = curve.bossAxis;
  const shape5 = a <= 1 ? 1 : Math.min(1.6, Number(a.toFixed(4)));
  const bossMult = Number((a / shape5).toFixed(4));
  return {
    base: curve.base,
    growth: curve.growth,
    bossMult,
    thresholdShape: [1, 1, 1, 1, shape5],
  };
}

function evalPlane(data: BoardData[], config: EngineConfig, keep: number): PlaneResult[] {
  const R = config.fixtureCount;
  const boards = data.length;
  const lineCount = Math.pow(config.offersPerRow, config.rows);
  const growths: number[] = [];
  for (let g = 1.04; g <= 1.421; g += 0.025) growths.push(Number(g.toFixed(3)));
  // Effective final multiplier bossMult × shape[last]: [0.7, 1.15]×[1, 1.6].
  const bossAxes: number[] = [];
  for (let m = 0.7; m <= 1.851; m += 0.05) bossAxes.push(Number(m.toFixed(3)));
  // Floor 250: the greedy face corridor (P1b) sits at base ≈ face/(k·growth),
  // which drops near ~300 at high growth — a 400 floor hides it entirely.
  const bases: number[] = [];
  for (let b = 250; b <= 2400; b += 25) bases.push(b);

  // Stage 1 ranks the whole plane on P0–P2 (cheap, analytic); stage 2 runs the
  // real P3 Monte-Carlo on a shortlist. Ties at distance 0 are common in good
  // genomes, so the shortlist is stratified over the best 1200 (every 4th in
  // (growth, bossAxis, base) scan order) instead of first-300 — P3 varies along
  // exactly these axes and a corner-biased shortlist would miss its optimum.
  const stage1: PlaneResult[] = [];
  const out = (v: number, lo: number, hi: number, u: number) =>
    v < lo ? (lo - v) / u : v > hi ? (v - hi) / u : 0;
  // Per growth: uMin = min over non-boss rounds of ls/g^r, uLast = ls[R-1]/g^(R-1);
  // per axis a the full-clear margin is max_l min(uMin, uLast/a) — this keeps the
  // 729×R pass out of the boss-axis loop.
  const uMin = new Float64Array(boards * lineCount);
  const uLast = new Float64Array(boards * lineCount);
  for (const growth of growths) {
    const gw = Array.from({ length: R }, (_, r) => Math.pow(growth, r));
    for (let i = 0; i < boards; i++) {
      const ls = data[i].lineScores;
      for (let l = 0; l < lineCount; l++) {
        let worst = Infinity;
        for (let r = 0; r < R - 1; r++) {
          const u = ls[l * R + r] / gw[r];
          if (u < worst) worst = u;
        }
        uMin[i * lineCount + l] = worst;
        uLast[i * lineCount + l] = ls[l * R + R - 1] / gw[R - 1];
      }
    }
    for (const bossAxis of bossAxes) {
      const weights = gw.map((w, r) => (r === R - 1 ? w * bossAxis : w));
      const M = new Float64Array(boards);
      for (let i = 0; i < boards; i++) {
        let best = 0;
        const off = i * lineCount;
        for (let l = 0; l < lineCount; l++) {
          const u = Math.min(uMin[off + l], uLast[off + l] / bossAxis);
          if (u > best) best = u;
        }
        M[i] = best;
      }

      for (const base of bases) {
        const t = weights.map((w) => base * w);
        let fullClearable = 0;
        const cRounds: number[] = [];
        const rRounds: number[] = [];
        let chaserFC = 0;
        let cFails = 0;
        let cNearMisses = 0;
        const gRoundsK = KGREEDY_GRID.map(() => [] as number[]);
        const gFailsK = KGREEDY_GRID.map(() => 0);
        const gNearK = KGREEDY_GRID.map(() => 0);
        for (let i = 0; i < boards; i++) {
          if (M[i] >= base) fullClearable++;
          for (let ki = 0; ki < KGREEDY_GRID.length; ki++) {
            const g = greedyRounds(
              data[i].greedy,
              data[i].greedyFaces,
              KGREEDY_GRID[ki],
              t,
              config.bustKeep,
              config.fullClearBonus,
            );
            gRoundsK[ki].push(g.rounds);
            if (!Number.isNaN(g.failMargin)) {
              gFailsK[ki]++;
              if (g.failMargin >= NEAR_MISS_FLOOR) gNearK[ki]++;
            }
          }
          const c = chaserRounds(data[i].chaser, t, config.bustKeep, config.fullClearBonus);
          cRounds.push(c.rounds);
          if (c.fullClear) chaserFC++;
          if (!Number.isNaN(c.failMargin)) {
            cFails++;
            if (c.failMargin >= NEAR_MISS_FLOOR) cNearMisses++;
          }
          rRounds.push(randomRounds(data[i].random, data[i].coins, t, config.bustKeep, config.fullClearBonus).rounds);
        }
        const p0 = fullClearable / boards;
        const p1a = median(rRounds);
        const p1c = median(cRounds);
        const p1d = chaserFC / boards;
        // SEARCH targets are shrunk inside the profile bands by ~the winner's-
        // curse magnitude (selection over ~10^6 curves on few-hundred-board
        // stats inflates each criterion ~2σ ≈ 4-8 points), so that honest
        // re-measures land mid-band. Reported pass/fail always uses the true
        // profile bands (evaluate.ts) — these numbers only steer the search.
        const shared = [
          Math.max(0, (0.997 - p0) / 0.005),
          Math.max(0, p1a - 1),
          out(p1c, 3, 4, 0.5),
          out(p1d, 0.12, 0.2, 0.05),
        ];
        // kGreedy affects only greedy: pick the grid value with the best
        // P1b + P2 fit for this curve.
        let bestKi = 0;
        let bestKDist = Infinity;
        let bestP1b = 0;
        let bestP2 = 0;
        for (let ki = 0; ki < KGREEDY_GRID.length; ki++) {
          const fails = gFailsK[ki] + cFails;
          const p2k = fails === 0 ? 0 : (gNearK[ki] + cNearMisses) / fails;
          const p1bk = median(gRoundsK[ki]);
          const kDist = out(p1bk, 2, 2, 0.5) + out(p2k, 0.27, 0.34, 0.05);
          if (kDist < bestKDist) {
            bestKDist = kDist;
            bestKi = ki;
            bestP1b = p1bk;
            bestP2 = p2k;
          }
        }
        const dParts = [
          ...shared,
          out(bestP1b, 2, 2, 0.5),
          out(bestP2, 0.27, 0.34, 0.05),
        ];
        const distance = dParts.reduce((a, b) => a + b, 0);
        stage1.push({
          curve: { base, growth, bossAxis },
          kGreedy: KGREEDY_GRID[bestKi],
          distance,
          passes: dParts.filter((d) => d === 0).length,
          p0,
          p1a,
          p1b: bestP1b,
          p1c,
          p1d,
          p2: bestP2,
          p3a: NaN,
          p3b: NaN,
          p3PerState: NaN,
          detail: "",
        });
      }
    }
  }

  stage1.sort((a, b) => a.distance - b.distance);
  const pool = stage1.slice(0, 1200);
  const head = pool.slice(0, 40);
  const tail = pool.slice(40);
  const stride = Math.max(1, Math.ceil(tail.length / 260));
  const shortlist = [...head, ...tail.filter((_, i) => i % stride === 0)];

  // Stage 2: real-MC P3a/P3b on the shortlist, then final ranking.
  const R2 = config.fixtureCount;
  for (const cand of shortlist) {
    const t = thresholdsFor(cand.curve, R2);
    const rng = rngFromString(
      `p3|${cand.curve.base}|${cand.curve.growth}|${cand.curve.bossAxis}`,
    );
    const { p3a, p3b, perState } = mcP3Derive(mcP3(data, config, t, rng, 96));
    cand.p3a = p3a;
    cand.p3b = p3b;
    cand.p3PerState = perState;
    // Shrunk search target (see stage-1 note): P3a aims ≥45% so the honest
    // value clears the profile's 40% bar after the curse regression.
    const p3aDist = Math.max(0, (0.45 - p3a) / 0.1);
    const p3bDist = Number.isNaN(p3b) ? 5 : Math.max(0, (0.3 - p3b) / 0.1);
    cand.distance += p3aDist + p3bDist;
    cand.passes += (p3aDist === 0 ? 1 : 0) + (p3bDist === 0 ? 1 : 0);
    cand.detail =
      `P0=${(cand.p0 * 100).toFixed(1)}% P1a=${cand.p1a} P1b=${cand.p1b} P1c=${cand.p1c} ` +
      `P1d=${(cand.p1d * 100).toFixed(1)}% P2=${(cand.p2 * 100).toFixed(1)}% ` +
      `P3a=${(p3a * 100).toFixed(1)}%runs(${(perState * 100).toFixed(1)}%st) ` +
      `P3b=${Number.isNaN(p3b) ? "n/a" : (p3b * 100).toFixed(1) + "%"} k=${cand.kGreedy}`;
  }
  shortlist.sort((a, b) => a.distance - b.distance);
  return shortlist.slice(0, keep);
}

/** P4 line-diversity rate for specific thresholds (needs the line matrices). */
function diversityRate(data: BoardData[], config: EngineConfig, t: number[], bonus: number): number {
  const R = config.fixtureCount;
  const rows = config.rows;
  const offers = config.offersPerRow;
  const lineCount = Math.pow(offers, rows);
  let ok = 0;
  const finals = new Float64Array(lineCount);
  for (const bd of data) {
    let best = 0;
    for (let l = 0; l < lineCount; l++) {
      let cum = 0;
      let final = 0;
      let failed = false;
      for (let r = 0; r < R; r++) {
        const s = bd.lineScores[l * R + r];
        if (s < t[r]) {
          final = cum;
          failed = true;
          break;
        }
        cum += s;
      }
      if (!failed) final = cum * bonus;
      finals[l] = final;
      if (final > best) best = final;
    }
    const cutoff = best * 0.85;
    const qualifying: number[] = [];
    for (let l = 0; l < lineCount; l++) if (finals[l] >= cutoff) qualifying.push(l);
    let found = false;
    for (let a = 0; a < qualifying.length && !found; a++) {
      for (let b = a + 1; b < qualifying.length; b++) {
        let x = qualifying[a];
        let y = qualifying[b];
        let diff = 0;
        for (let r = 0; r < rows; r++) {
          if (x % offers !== y % offers) diff++;
          x = Math.floor(x / offers);
          y = Math.floor(y / offers);
        }
        if (diff >= 3) {
          found = true;
          break;
        }
      }
    }
    if (found) ok++;
  }
  return ok / data.length;
}

/** Content genome searched in --search mode (curve knobs handled analytically). */
interface ContentGenome {
  synergyBase: number;
  synergyStep: number;
  clubCount: number;
  nationCount: number;
  eraCount: number;
  presetIdx: number;
  ratingSkew: number;
  formSpread: number;
  /** P3-only knobs: they enter the push-EV lottery but not board/score precompute. */
  bustKeep: number;
  fullClearBonus: number;
  modifierStrength: number;
  /**
   * 0 = default boost+penalty archetypes; 1 = boost-only niche archetypes;
   * 2 = mixed mild/deep dips (P3 tense-zone shaping — see archetypeTables.ts).
   */
  archStyle: number;
  /** Card-set size boards sample 18 from — small sets concentrate cross-board margins. */
  setSize: number;
}


const PRESETS = [
  [4, 4, 2],
  [3, 4, 3],
  [2, 5, 3],
  [2, 4, 4],
] as const;

/**
 * Search ranges: the corridor between the "content D" (dispersed, strong
 * modifiers) and "content F" (tight, flat synergy) hand probes — the region
 * where P1b=2 and P2∈[25,40] were separately observed.
 */
function sampleContent(rng: () => number): ContentGenome {
  const uniform = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const int = (lo: number, hi: number) => lo + rngInt(rng, hi - lo + 1);
  const style = rng();
  return {
    synergyBase: uniform(1.12, 1.45),
    synergyStep: uniform(0.05, 0.4),
    clubCount: int(6, 13),
    nationCount: int(5, 8),
    eraCount: int(4, 6),
    presetIdx: rngInt(rng, PRESETS.length),
    ratingSkew: uniform(0.7, 1.2),
    formSpread: uniform(0.18, 0.45),
    bustKeep: uniform(0.15, 0.4),
    fullClearBonus: uniform(1.1, 1.6),
    modifierStrength: uniform(0.8, 1.6),
    archStyle: style < 0.4 ? 2 : style < 0.75 ? 1 : 0,
    setSize: int(22, 60),
  };
}

function contentToConfig(g: ContentGenome): EngineConfig {
  const s = (k: number) => Number((g.synergyBase + k * g.synergyStep).toFixed(4));
  return {
    ...DEFAULT_ENGINE_CONFIG,
    formSpread: g.formSpread,
    bustKeep: Number(g.bustKeep.toFixed(4)),
    fullClearBonus: Number(g.fullClearBonus.toFixed(4)),
    synergyTable: [1, 1, 1, s(0), s(1), s(2)],
    archetypes:
      g.archStyle === 2
        ? buildMixedDipArchetypes(g.modifierStrength)
        : g.archStyle === 1
          ? buildBoostOnlyArchetypes(g.modifierStrength)
          : buildArchetypes(g.modifierStrength),
    cardGen: {
      ...DEFAULT_ENGINE_CONFIG.cardGen,
      setSize: g.setSize,
      ratingSkew: g.ratingSkew,
      clubCount: g.clubCount,
      nationCount: g.nationCount,
      eraCount: g.eraCount,
      clubsPerCardWeights: [...PRESETS[g.presetIdx]],
    },
  };
}

/**
 * Ticket G — the c13-2 retune sweep: formSpread × hintReliability × threshold
 * knobs (base × growth × bossAxis, kGreedy resolved per curve), evaluated on
 * DEFAULT-SCORER Daily Deck slices of the committed real set (the serving
 * policy the amended bars are defined on). Content knobs (synergy table,
 * archetypes, cardGen) stay pinned to c13-1 — this is a v1.1 retune, not a
 * content search.
 *
 *   npx tsx scripts/drawSim/calibrate.ts --sweepg \
 *     --slicerotation ../convex/data/drawCardsReal.candidates.json \
 *     --slices 20 --boards 4000 --seed sweep-g
 *
 * Search targets are shrunk inside the profile bands (winner's-curse control,
 * same discipline as the main calibrator); the honest gate is a separate
 * `--eval --slicerotation --defaultscorer` acceptance run on the winner.
 */
function sweepGMode(flags: Map<string, string>): void {
  const t0 = performance.now();
  const boards = Number(flags.get("boards") ?? 4000);
  const seedBase = flags.get("seed") ?? "sweep-g";
  const sliceRotationPath = flags.get("slicerotation");
  if (!sliceRotationPath) throw new Error("--sweepg requires --slicerotation <committed card set>");
  const sliceCount = Number(flags.get("slices") ?? 20);
  const parseGrid = (flag: string, dflt: number[]) =>
    flags.has(flag) ? (flags.get(flag) as string).split(",").map(Number) : dflt;
  // The retune starts from the ACCEPTED serving config (c13-1) — content
  // knobs (synergy table, archetypes, cardGen) are pinned; only formSpread,
  // hints and the threshold curve are searched.
  const baseCfg = flags.has("config") ? loadConfig(flags.get("config")).config : C13V1_CONFIG;
  const R = baseCfg.fixtureCount;

  const fsGrid = parseGrid("fsgrid", [0.34, 0.36, 0.38, baseCfg.formSpread, 0.42]);
  const hrGrid = parseGrid("hrgrid", [0.5, 0.6, 0.7, 0.8, 0.9]);
  const bases = parseGrid("bases", [275, 300, 325, 350, 375, 400, 425]);
  const growths = parseGrid("growths", [1.215, 1.24, 1.265, 1.29, 1.315]);
  const bossAxes = parseGrid("axes", [1.0, 1.1, 1.2, 1.3, 1.4]);
  const kaGrid = parseGrid("kagrid", [0.3, 0.35, 0.4, 0.45, 0.5]);

  const fullSet = loadCardSetFile(sliceRotationPath);
  // Served slice policy (E5 ruling): generator + DEFAULT tie-break scorer.
  const slices = Array.from({ length: sliceCount }, (_, s) =>
    sliceDeck(`${seedBase}|slice${s}`, fullSet, DAILY_SLICE_CONFIG_V1, sliceTripleScore),
  );
  console.log(
    `sweepg: ${sliceCount} default-scorer slices of ${fullSet.length} cards, ` +
      `${boards} boards, |fs|=${fsGrid.length} |hr|=${hrGrid.length} ` +
      `curves=${bases.length * growths.length * bossAxes.length}`,
  );

  interface GCand {
    fs: number;
    hr: number;
    curve: Curve;
    kGreedy: number;
    kAssisted: number;
    distance: number;
    p0: number;
    p0MinSlice: number;
    p1a: number;
    p1b: number;
    p1c: number;
    p1d: number;
    p2: number;
    p6: number;
    p3a: number;
    p3b: number;
    p4: number;
    ladderOk: boolean;
    medians: Record<string, number>;
  }
  const out = (v: number, lo: number, hi: number, u: number) =>
    v < lo ? (lo - v) / u : v > hi ? (v - hi) / u : 0;
  const all: GCand[] = [];
  // Stage-2 P3/P4 need the per-fs board data; kept only for the current fs,
  // so stage 2 runs inside the fs loop on that fs's shortlist.
  const lineCount = Math.pow(baseCfg.offersPerRow, baseCfg.rows);

  for (const fsv of fsGrid) {
    const config: EngineConfig = { ...baseCfg, formSpread: fsv };
    const formless: EngineConfig = { ...config, formSpread: 0 };
    const data: BoardData[] = [];
    const sliceOf: number[] = [];
    for (let s = 0; s < sliceCount; s++) {
      for (let i = s; i < boards; i += sliceCount) {
        data.push(precomputeBoard(config, formless, slices[s], seedBase, i).data);
        sliceOf.push(s);
      }
    }
    const n = data.length;
    console.log(
      `  fs=${fsv.toFixed(4)}: precomputed ${n} boards (${((performance.now() - t0) / 1000).toFixed(0)}s)`,
    );
    // Reader data per hintReliability (threshold-independent).
    const readerByHr = hrGrid.map((hr) => data.map((bd) => readerDataFor(bd, config, hr)));

    for (const growth of growths) {
      // Per-growth normalized line margins (see evalPlane).
      const gw = Array.from({ length: R }, (_, r) => Math.pow(growth, r));
      const uMin = new Float64Array(n * lineCount);
      const uLast = new Float64Array(n * lineCount);
      for (let i = 0; i < n; i++) {
        const ls = data[i].lineScores;
        for (let l = 0; l < lineCount; l++) {
          let worst = Infinity;
          for (let r = 0; r < R - 1; r++) {
            const u = ls[l * R + r] / gw[r];
            if (u < worst) worst = u;
          }
          uMin[i * lineCount + l] = worst;
          uLast[i * lineCount + l] = ls[l * R + R - 1] / gw[R - 1];
        }
      }
      for (const bossAxis of bossAxes) {
        const M = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          let best = 0;
          const off = i * lineCount;
          for (let l = 0; l < lineCount; l++) {
            const u = Math.min(uMin[off + l], uLast[off + l] / bossAxis);
            if (u > best) best = u;
          }
          M[i] = best;
        }
        for (const base of bases) {
          const t = thresholdsFor({ base, growth, bossAxis }, R);
          let fullClearable = 0;
          const sliceClear = Array.from({ length: sliceCount }, () => 0);
          const sliceN = Array.from({ length: sliceCount }, () => 0);
          for (let i = 0; i < n; i++) {
            sliceN[sliceOf[i]]++;
            if (M[i] >= base) {
              fullClearable++;
              sliceClear[sliceOf[i]]++;
            }
          }
          const p0 = fullClearable / n;
          const p0MinSlice = Math.min(
            ...sliceClear.map((c, s) => (sliceN[s] === 0 ? 1 : c / sliceN[s])),
          );
          // Threshold-dependent bot outcomes. Greedy per kGreedy; assisted
          // per kAssisted (its band-fraction push tolerance — the Ticket G
          // bot-model knob, kGreedy precedent); reader deferred to per-hr.
          const gK = KGREEDY_GRID.map(() => ({ rounds: [] as number[], fails: 0, near: 0, finals: [] as number[] }));
          const aK = kaGrid.map((ka) => ({
            gate: assistedPushGate(fsv, ka),
            fc: 0,
            fails: 0,
            near: 0,
            finals: [] as number[],
          }));
          const cRounds: number[] = [];
          const rRounds: number[] = [];
          const cFinals: number[] = [];
          const rnFinals: number[] = [];
          let chaserFC = 0;
          for (let i = 0; i < n; i++) {
            const bd = data[i];
            for (let ki = 0; ki < KGREEDY_GRID.length; ki++) {
              const g = greedyRounds(bd.greedy, bd.greedyFaces, KGREEDY_GRID[ki], t, config.bustKeep, config.fullClearBonus);
              gK[ki].rounds.push(g.rounds);
              gK[ki].finals.push(g.final);
              if (!Number.isNaN(g.failMargin)) {
                gK[ki].fails++;
                if (g.failMargin >= NEAR_MISS_FLOOR) gK[ki].near++;
              }
            }
            const c = chaserRounds(bd.chaser, t, config.bustKeep, config.fullClearBonus);
            cRounds.push(c.rounds);
            cFinals.push(c.final);
            if (c.fullClear) chaserFC++;
            for (const ak of aK) {
              const a = bandRounds(bd.chaser, bd.mids, t, config.bustKeep, config.fullClearBonus, ak.gate);
              ak.finals.push(a.final);
              if (a.fullClear) ak.fc++;
              if (!Number.isNaN(a.failMargin)) {
                ak.fails++;
                if (a.failMargin >= NEAR_MISS_FLOOR) ak.near++;
              }
            }
            const rn = randomRounds(bd.random, bd.coins, t, config.bustKeep, config.fullClearBonus);
            rRounds.push(rn.rounds);
            rnFinals.push(rn.final);
          }
          const p1a = median(rRounds);
          const p1c = median(cRounds);
          // Shrunk search targets (honest bands: pooled P0-set >=99.4,
          // per-slice >=99.0, P1d [10,25], P2 [25,60]).
          const shared = [
            Math.max(0, (0.995 - p0) / 0.001),
            Math.max(0, (0.992 - p0MinSlice) / 0.001),
            Math.max(0, p1a - 1),
            out(p1c, 3, 4, 0.5),
          ];
          // Joint (kAssisted × kGreedy × hintReliability) resolution on the
          // TOTAL of P1d + P1b + P2 + P6 — resolving ka on P1d alone and
          // measuring P6 afterwards misses the middle of the P1d↔P6 trade
          // (both ride the assisted bot's push marginality).
          let bestKi = 0;
          let bestAi = 0;
          let bestJoint = Infinity;
          let bestP1b = 0;
          let bestP2 = 0;
          let chosenHr = NaN;
          let chosenP6 = -Infinity;
          let chosenReaderMed = NaN;
          for (let ai = 0; ai < kaGrid.length; ai++) {
            const p1dDist = out(aK[ai].fc / n, 0.12, 0.23, 0.05);
            const aMedAi = median(aK[ai].finals);
            // Best kGreedy for this ka (P1b + pooled P2).
            let kiBest = 0;
            let kiDist = Infinity;
            let kiP1b = 0;
            let kiP2 = 0;
            for (let ki = 0; ki < KGREEDY_GRID.length; ki++) {
              const fails = gK[ki].fails + aK[ai].fails;
              const p2k = fails === 0 ? 0 : (gK[ki].near + aK[ai].near) / fails;
              const p1bk = median(gK[ki].rounds);
              const kd = out(p1bk, 2, 2, 0.5) + out(p2k, 0.27, 0.55, 0.05);
              if (kd < kiDist) {
                kiDist = kd;
                kiBest = ki;
                kiP1b = p1bk;
                kiP2 = p2k;
              }
            }
            // Best hintReliability for this ka: the LOWEST clearing the
            // shrunk P6 target (weakest hint still worth reading), else the
            // best ratio available.
            let hiHr = NaN;
            let hiP6 = -Infinity;
            let hiMed = NaN;
            for (let hi = 0; hi < hrGrid.length; hi++) {
              const rdData = readerByHr[hi];
              const rdFinals: number[] = [];
              for (let i = 0; i < n; i++) {
                rdFinals.push(
                  bandRounds(rdData[i].scores, rdData[i].mids, t, config.bustKeep, config.fullClearBonus, aK[ai].gate).final,
                );
              }
              const med = median(rdFinals);
              const ratio = med / aMedAi;
              if (ratio >= 1.1) {
                hiHr = hrGrid[hi];
                hiP6 = ratio;
                hiMed = med;
                break;
              }
              if (ratio > hiP6) {
                hiHr = hrGrid[hi];
                hiP6 = ratio;
                hiMed = med;
              }
            }
            const p6DistAi = Math.max(0, (1.1 - hiP6) / 0.02);
            const jd = p1dDist + kiDist + p6DistAi;
            if (jd < bestJoint) {
              bestJoint = jd;
              bestAi = ai;
              bestKi = kiBest;
              bestP1b = kiP1b;
              bestP2 = kiP2;
              chosenHr = hiHr;
              chosenP6 = hiP6;
              chosenReaderMed = hiMed;
            }
          }
          const p1d = aK[bestAi].fc / n;
          const aMed = median(aK[bestAi].finals);
          const p6Dist = Math.max(0, (1.1 - chosenP6) / 0.02);
          const dParts = [
            ...shared,
            out(p1d, 0.12, 0.23, 0.05),
            out(bestP1b, 2, 2, 0.5),
            out(bestP2, 0.27, 0.55, 0.05),
            p6Dist,
          ];
          all.push({
            fs: fsv,
            hr: chosenHr,
            curve: { base, growth, bossAxis },
            kGreedy: KGREEDY_GRID[bestKi],
            kAssisted: kaGrid[bestAi],
            distance: dParts.reduce((x, y) => x + y, 0),
            p0,
            p0MinSlice,
            p1a,
            p1b: bestP1b,
            p1c,
            p1d,
            p2: bestP2,
            p6: chosenP6,
            p3a: NaN,
            p3b: NaN,
            p4: NaN,
            ladderOk:
              median(rnFinals) <= median(gK[bestKi].finals) &&
              median(gK[bestKi].finals) <= median(cFinals) &&
              median(cFinals) <= aMed &&
              aMed <= chosenReaderMed,
            medians: {
              random: median(rnFinals),
              greedy: median(gK[bestKi].finals),
              chaser: median(cFinals),
              assisted: aMed,
              reader: chosenReaderMed,
            },
          });
        }
      }
    }

    // Stage 2 for this fs: real-MC P3 (assisted policy) + P4 on the fs's
    // shortlist (needs `data`, which is discarded when the fs loop advances).
    const fsCands = all.filter((c) => c.fs === fsv).sort((a, b) => a.distance - b.distance);
    const shortlist = fsCands.slice(0, Number(flags.get("shortlist") ?? 12));
    for (const cand of shortlist) {
      const t = thresholdsFor(cand.curve, R);
      const raw = mcP3(
        data,
        config,
        t,
        rngFromString(`p3g|${cand.curve.base}|${cand.curve.growth}|${cand.curve.bossAxis}|${fsv}`),
        96,
        assistedPushGate(fsv, cand.kAssisted),
      );
      const { p3a, p3b } = mcP3Derive(raw);
      cand.p3a = p3a;
      cand.p3b = p3b;
      cand.p4 = diversityRate(data, config, t, config.fullClearBonus);
      const p3aDist = Math.max(0, (0.45 - p3a) / 0.1);
      const p3bDist = Number.isNaN(p3b) ? 5 : Math.max(0, (0.3 - p3b) / 0.1);
      const p4Dist = Math.max(0, (0.72 - cand.p4) / 0.1);
      cand.distance += p3aDist + p3bDist + p4Dist;
    }
    console.log(
      `  fs=${fsv.toFixed(4)}: stage2 done, best distance ${shortlist[0]?.distance.toFixed(3)} ` +
        `(${((performance.now() - t0) / 1000).toFixed(0)}s)`,
    );
  }

  const ranked = all
    .filter((c) => !Number.isNaN(c.p3a))
    .sort((a, b) => a.distance - b.distance);
  console.log(`\ntop Ticket G candidates (stage-2-scored):`);
  for (const c of ranked.slice(0, 12)) {
    console.log(
      `  fs=${c.fs.toFixed(4)} hr=${c.hr} base=${c.curve.base} growth=${c.curve.growth} ` +
        `axis=${c.curve.bossAxis} k=${c.kGreedy} ka=${c.kAssisted} dist=${c.distance.toFixed(3)} | ` +
        `P0=${(c.p0 * 100).toFixed(2)}%(min ${(c.p0MinSlice * 100).toFixed(2)}%) P1a=${c.p1a} ` +
        `P1b=${c.p1b} P1c=${c.p1c} P1d=${(c.p1d * 100).toFixed(1)}% P2=${(c.p2 * 100).toFixed(1)}% ` +
        `P3a=${(c.p3a * 100).toFixed(1)}% P3b=${Number.isNaN(c.p3b) ? "n/a" : (c.p3b * 100).toFixed(1) + "%"} ` +
        `P4=${(c.p4 * 100).toFixed(1)}% P6=+${((c.p6 - 1) * 100).toFixed(1)}% ladder=${c.ladderOk ? "ok" : "BROKEN"}`,
    );
  }
  // Frontier views for the STOP report (if nothing passes honestly).
  const byP0 = [...all].sort((a, b) => b.p0 - a.p0)[0];
  const byP6 = [...all].sort((a, b) => b.p6 - a.p6)[0];
  console.log(
    `\nfrontiers: max pooled P0 ${(byP0.p0 * 100).toFixed(2)}% ` +
      `(fs=${byP0.fs.toFixed(4)} base=${byP0.curve.base} g=${byP0.curve.growth} a=${byP0.curve.bossAxis}); ` +
      `max P6 gap +${((byP6.p6 - 1) * 100).toFixed(1)}% (hr=${byP6.hr})`,
  );
  const winner = ranked[0];
  if (winner) {
    const winnerConfig: EngineConfig = {
      ...baseCfg,
      formSpread: winner.fs,
      thresholds: curveToThresholds(winner.curve),
      hints: { hintReliability: winner.hr },
    };
    console.log(`\nwinner ladder medians: ${JSON.stringify(winner.medians)}`);
    console.log(`\nwinner config (verify with --eval --slicerotation --defaultscorer):`);
    console.log(JSON.stringify({ config: winnerConfig, kGreedy: winner.kGreedy }));
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const outPath = path.join(HERE, "artifacts", `sweepg-${seedBase}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        { config: winnerConfig, kGreedy: winner.kGreedy, kAssisted: winner.kAssisted, top: ranked.slice(0, 12) },
        null,
        2,
      ),
    );
    console.log(`artifact: ${outPath}`);
  }
  console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const boards = Number(flags.get("boards") ?? 500);
  const seedBase = flags.get("seed") ?? "calibrate-v0";
  const t0 = performance.now();

  if (flags.has("sweepg")) {
    sweepGMode(flags);
    return;
  }

  // --eval: no plane scan, no selection — measure the loaded config's OWN
  // thresholds (+ kGreedy) on freshly rotated card sets. This is the honest,
  // selection-free estimate of a specific candidate (winner's-curse control).
  // Ticket 0.3: processes the rotation set-by-set (boards/10 per set), gates
  // the POOLED result against the true profile bands (metrics.ts, incl. P4
  // from the line matrices and real-engine P5 spot-checks), and reports the
  // per-set table plus the C2 near-miss attribution alongside.
  // Ticket 0.4: the pooled P0 gate is P0-config (>=97%); per-set P0 in the
  // table below is a report-only diagnostic (see metrics.ts + DECISIONS.md
  // for the two-tier P0 architecture).
  if (flags.has("eval")) {
    const { config, kGreedy, kAssisted } = loadConfig(flags.get("config"));
    const R = config.fixtureCount;
    const t = config.thresholds.thresholdShape
      ? Array.from({ length: R }, (_, r) =>
          Math.round(
            config.thresholds.base *
              Math.pow(config.thresholds.growth, r) *
              (r === R - 1 ? config.thresholds.bossMult : 1) *
              (config.thresholds.thresholdShape?.[r] ?? 1),
          ),
        )
      : thresholdsFor({ base: config.thresholds.base, growth: config.thresholds.growth, bossAxis: config.thresholds.bossMult }, R);
    const formless: EngineConfig = { ...config, formSpread: 0 };
    // Ticket E3 step 1 — single-set mode: `--cardset <path>` evaluates ONE
    // committed card set (all boards on it) instead of the 10-set synthetic
    // rotation, and gates P0 at the stricter P0-set tier (>=99.5% natural
    // full-clear, no reroll assist). Everything else (P1a–P4 bands, P5
    // spot-checks) is unchanged.
    //
    // Ticket E4 — slice-rotation mode: `--slicerotation <path>` builds
    // `--slices` (default 20) Daily Deck slices from the committed full set
    // via sliceDeck (distinct dateSeeds `${seedBase}|slice<s>`) and pools all
    // of them under the SAME strict P0-set gate. c13-1 is untouched; the
    // slice profile (DAILY_SLICE_CONFIG_V1) is the only tunable surface.
    const cardSetPath = flags.get("cardset");
    const sliceRotationPath = flags.get("slicerotation");
    const sliceCount = Number(flags.get("slices") ?? 20);
    if (cardSetPath && sliceRotationPath)
      throw new Error("--cardset and --slicerotation are mutually exclusive");
    const sliceFullSet = sliceRotationPath ? loadCardSetFile(sliceRotationPath) : null;
    // Ticket G: `--defaultscorer` measures the SERVED slice policy (sliceDeck's
    // default triple-count tie-break — the E5 serving-scorer ruling) instead of
    // the screened acceptance instrument. The Ticket G amended bars are defined
    // on exactly this policy.
    const useDefaultScorer = flags.has("defaultscorer");
    // The oracle-backed scorer is part of the screened generator policy: the
    // serving layer must build the identical scorer (same config, same probe
    // count) so acceptance and production pick the same slice per dateSeed.
    const sliceScorer = useDefaultScorer ? sliceTripleScore : makeSliceAcceptanceScorer(config);
    const cardSets = sliceFullSet
      ? Array.from({ length: sliceCount }, (_, s) =>
          sliceDeck(
            `${seedBase}|slice${s}`,
            sliceFullSet,
            DAILY_SLICE_CONFIG_V1,
            sliceScorer,
            useDefaultScorer ? undefined : SLICE_SCORE_TARGET,
          ),
        )
      : cardSetPath
        ? [loadCardSetFile(cardSetPath)]
        : rotatedCardSets(config, seedBase);
    const numSets = cardSets.length;
    const p0SetGate = Boolean(cardSetPath || sliceRotationPath);
    const lineCount = Math.pow(config.offersPerRow, config.rows);
    const P5_EVERY = 97;
    // Ticket G — a config with hints is measured on profile v1.1: P1d gates
    // assisted, P2 pools greedy+assisted, P3 runs on assisted, P6 added.
    const v11 = Boolean(config.hints);
    const hintRel = config.hints?.hintReliability ?? 1 / 3;
    const aGate = assistedPushGate(config.formSpread, kAssisted);

    interface SetStats {
      set: number;
      n: number;
      p0: number;
      p1a: number;
      p1b: number;
      p1c: number;
      p1d: number;
      fails: number;
      nearMisses: number;
      p3a: number;
      p3b: number;
      p4: number;
    }
    const perSet: SetStats[] = [];

    let fullClearableAll = 0;
    const gAll: number[] = [];
    const cAll: number[] = [];
    const rAll: number[] = [];
    let chaserFCAll = 0;
    let assistedFCAll = 0;
    let failsAll = 0;
    let nearAll = 0;
    // Ladder + P6: pooled final scores per bot.
    const finalsAll: Record<string, number[]> = {
      random: [],
      greedy: [],
      chaser: [],
      assisted: [],
      reader: [],
    };
    const byRoundAll = Array.from({ length: R }, () => 0);
    const p3All: McP3Raw = { runs: 0, tenseRuns: 0, states: 0, tense: 0, tenseSpreads: [] };
    let p4Weighted = 0;
    let p5Checked = 0;
    let p5Ok = true;

    for (let s = 0; s < numSets; s++) {
      const data: BoardData[] = [];
      let fullClearable = 0;
      let chaserFC = 0;
      let assistedFC = 0;
      let fails = 0;
      let nearMisses = 0;
      const gRounds: number[] = [];
      const cRounds: number[] = [];
      const rRounds: number[] = [];
      for (let i = s; i < boards; i += numSets) {
        const { data: bd, ctx } = precomputeBoard(config, formless, cardSets[s], seedBase, i);
        data.push(bd);
        // P5: replay + serialization spot-check through the real engine, on
        // the same cadence the sim uses (Ticket G adds assisted + reader).
        if (i % P5_EVERY === 0) {
          p5Checked++;
          const runs = [
            runGreedy(ctx, kGreedy),
            runChaser(ctx),
            runAssisted(ctx, kAssisted),
            runReader(ctx, kAssisted),
            runRandom(ctx, rngFromString(`${seedBase}#${i}|randombot`)),
            runOracle(ctx).result,
          ];
          if (!determinismSpotCheck(ctx, runs)) p5Ok = false;
        }
        let best = 0;
        for (let l = 0; l < lineCount; l++) {
          let worst = Infinity;
          for (let r = 0; r < R; r++) {
            const u = bd.lineScores[l * R + r] / t[r];
            if (u < worst) worst = u;
          }
          if (worst > best) best = worst;
        }
        if (best >= 1) fullClearable++;
        const g = greedyRounds(bd.greedy, bd.greedyFaces, kGreedy, t, config.bustKeep, config.fullClearBonus);
        gRounds.push(g.rounds);
        finalsAll.greedy.push(g.final);
        if (!Number.isNaN(g.failMargin)) {
          fails++;
          if (g.failMargin >= NEAR_MISS_FLOOR) {
            nearMisses++;
            byRoundAll[g.rounds]++;
          }
        }
        const c = chaserRounds(bd.chaser, t, config.bustKeep, config.fullClearBonus);
        cRounds.push(c.rounds);
        finalsAll.chaser.push(c.final);
        if (c.fullClear) chaserFC++;
        // Ticket G: assisted (band policy on the same squad/bench) and reader
        // (posterior-weighted band policy) — the v1.1 shipped-player models.
        const a = bandRounds(bd.chaser, bd.mids, t, config.bustKeep, config.fullClearBonus, aGate);
        finalsAll.assisted.push(a.final);
        if (a.fullClear) assistedFC++;
        const rd = readerDataFor(bd, config, hintRel);
        const rdOut = bandRounds(rd.scores, rd.mids, t, config.bustKeep, config.fullClearBonus, aGate);
        finalsAll.reader.push(rdOut.final);
        // P2 pools greedy + the profile's shipped-player bot (v1.0 chaser,
        // v1.1 assisted).
        const partner = v11 ? a : c;
        if (v11) {
          if (!Number.isNaN(partner.failMargin)) {
            fails++;
            if (partner.failMargin >= NEAR_MISS_FLOOR) {
              nearMisses++;
              byRoundAll[partner.rounds]++;
            }
          }
        } else if (!Number.isNaN(c.failMargin)) {
          fails++;
          if (c.failMargin >= NEAR_MISS_FLOOR) {
            nearMisses++;
            byRoundAll[c.rounds]++;
          }
        }
        const rn = randomRounds(bd.random, bd.coins, t, config.bustKeep, config.fullClearBonus);
        rRounds.push(rn.rounds);
        finalsAll.random.push(rn.final);
      }
      if (data.length === 0) continue;
      const n = data.length;
      const p3 = mcP3(data, config, t, rngFromString(`${seedBase}|eval|set${s}`), 192, v11 ? aGate : undefined);
      const { p3a, p3b } = mcP3Derive(p3);
      const p4 = diversityRate(data, config, t, config.fullClearBonus);
      perSet.push({
        set: s,
        n,
        p0: fullClearable / n,
        p1a: median(rRounds),
        p1b: median(gRounds),
        p1c: median(cRounds),
        p1d: (v11 ? assistedFC : chaserFC) / n,
        fails,
        nearMisses,
        p3a,
        p3b,
        p4,
      });
      fullClearableAll += fullClearable;
      gAll.push(...gRounds);
      cAll.push(...cRounds);
      rAll.push(...rRounds);
      chaserFCAll += chaserFC;
      assistedFCAll += assistedFC;
      failsAll += fails;
      nearAll += nearMisses;
      p3All.runs += p3.runs;
      p3All.tenseRuns += p3.tenseRuns;
      p3All.states += p3.states;
      p3All.tense += p3.tense;
      p3All.tenseSpreads.push(...p3.tenseSpreads);
      p4Weighted += p4 * n;
      console.log(
        `  set ${s}: ${n} boards done (${((performance.now() - t0) / 1000).toFixed(0)}s elapsed)`,
      );
    }

    const total = gAll.length;
    const pooledP3 = mcP3Derive(p3All);
    // Ticket G amended slice-rotation bars (profile v1.1 only): pooled P0-set
    // >= 99.4%, per-slice >= 99.0%, would-be reroll alarm at 1%.
    const amendedBars = Boolean(v11 && sliceRotationPath);
    const criteria = evaluateCriteria({
      oracleFullClearRate: fullClearableAll / total,
      // The analytic detector IS the full-clear enumeration, so every dead
      // board is flagged by construction.
      deadBoards: total - fullClearableAll,
      deadFlagged: total - fullClearableAll,
      randomMedianRounds: median(rAll),
      greedyMedianRounds: median(gAll),
      chaserMedianRounds: median(cAll),
      chaserFullClearRate: chaserFCAll / total,
      assistedFullClearRate: assistedFCAll / total,
      assistedMedianScore: median(finalsAll.assisted),
      readerMedianScore: median(finalsAll.reader),
      pooledNearMissRate: failsAll === 0 ? 0 : nearAll / failsAll,
      pooledFails: failsAll,
      p3Runs: p3All.runs,
      p3TenseRunFrac: pooledP3.p3a,
      p3States: p3All.states,
      p3PerStateTenseFrac: pooledP3.perState,
      p3TenseMedianSpread: pooledP3.p3b,
      p4Rate: p4Weighted / total,
      p5Checked,
      p5Ok,
    }, {
      p0SetGate,
      profileV11: v11,
      p0SetBar: amendedBars ? 0.994 : undefined,
      sliceBars: amendedBars
        ? {
            minSliceP0: Math.min(...perSet.map((st) => st.p0)),
            perSliceBar: 0.99,
            rerollRate: (total - fullClearableAll) / total,
            rerollAlarm: 0.01,
          }
        : undefined,
    });
    if (p0SetGate) {
      // P0-runtime would-be reroll rate: the fraction of seeds whose k=0 board
      // is dead — production would serve the first non-dead k instead. Reported
      // separately, NEVER credited toward P0-set (the gate above is natural).
      const dead = total - fullClearableAll;
      console.log(
        `\n${sliceRotationPath ? `slice-rotation mode: ${sliceRotationPath} × ${numSets} slices of ${cardSets[0].length}` : `single-set mode: ${cardSetPath} (${cardSets[0].length} cards)`}\n` +
          `would-be reroll rate (k=0 dead, P0-runtime chain would reroll; not counted toward P0-set): ` +
          `${((dead / total) * 100).toFixed(2)}% (${dead}/${total})`,
      );
    }
    console.log(
      `\neval (${total} boards = ${perSet.length} sets x ~${Math.round(total / perSet.length)}, ` +
        `seed ${seedBase}, kGreedy ${kGreedy}) — POOLED, selection-free:\n`,
    );
    console.log(formatCriteriaTable(criteria));
    const passed = criteria.filter((c) => c.pass).length;
    console.log(`\ncriteria: ${passed}/${criteria.length} PASS`);

    if (v11) {
      // Ticket G ladder (report-only): random < greedy < chaser < assisted <= reader.
      const ladder = (["random", "greedy", "chaser", "assisted", "reader"] as const)
        .map((n) => `${n}=${median(finalsAll[n]).toFixed(0)}`)
        .join(" < ");
      console.log(`\nladder (median final score, want nondecreasing): ${ladder}`);
    }

    const att = nearMissAttribution(byRoundAll);
    console.log(
      `\nnear-miss attribution (report-only, Ticket 0.3 C2): by fail round ` +
        att.byRound.map((count, r) => `r${r + 1}=${count}`).join(" ") +
        ` — forced r1 ${(att.forcedShare * 100).toFixed(1)}%, ` +
        `chosen push r>=2 ${(att.chosenShare * 100).toFixed(1)}% of ${att.nearMisses} near-misses`,
    );

    const pad = (v: string | number, w: number) => String(v).padEnd(w);
    console.log(`\nper-set table (report-only diagnostic — the gate is pooled, Ticket 0.4):`);
    console.log(
      `  ${pad("set", 4)} ${pad("boards", 7)} ${pad("P0%", 7)} ${pad("P1a", 4)} ${pad("P1b", 4)} ` +
        `${pad("P1c", 4)} ${pad("P1d%", 6)} ${pad("P2% (nm/fails)", 17)} ${pad("P3a%", 6)} ` +
        `${pad("P3b%", 6)} P4%`,
    );
    for (const st of perSet) {
      const p2 = st.fails === 0 ? 0 : st.nearMisses / st.fails;
      console.log(
        `  ${pad(st.set, 4)} ${pad(st.n, 7)} ${pad((st.p0 * 100).toFixed(2), 7)} ${pad(st.p1a, 4)} ` +
          `${pad(st.p1b, 4)} ${pad(st.p1c, 4)} ${pad((st.p1d * 100).toFixed(1), 6)} ` +
          `${pad(`${(p2 * 100).toFixed(1)} (${st.nearMisses}/${st.fails})`, 17)} ` +
          `${pad((st.p3a * 100).toFixed(1), 6)} ` +
          `${pad(Number.isNaN(st.p3b) ? "n/a" : (st.p3b * 100).toFixed(1), 6)} ` +
          `${(st.p4 * 100).toFixed(1)}`,
      );
    }
    console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    return;
  }

  if (!flags.has("search")) {
    // --genome <path>: a ContentGenome JSON (as printed by --search) instead of
    // a config file — runs the same single-content plane on contentToConfig(it).
    const genomePath = flags.get("genome");
    const config = genomePath
      ? contentToConfig(JSON.parse(fs.readFileSync(genomePath, "utf8")) as ContentGenome)
      : loadConfig(flags.get("config")).config;
    console.log(`calibrate: precomputing ${boards} boards...`);
    const data = precompute(config, seedBase, boards);
    console.log(`  precompute done in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    const all = evalPlane(data, config, 300);
    const top = all.slice(0, 15);
    console.log(`\ntop threshold curves for this content config:`);
    for (const c of top) {
      console.log(
        `  base=${c.curve.base} growth=${c.curve.growth} bossAxis=${c.curve.bossAxis} ` +
          `distance=${c.distance.toFixed(3)} passes=${c.passes}/8 | ${c.detail}`,
      );
    }
    console.log(`\nP3a frontier (same shortlist, sorted by tense-state fraction):`);
    for (const c of [...all].sort((a, b) => b.p3a - a.p3a).slice(0, 8)) {
      console.log(
        `  base=${c.curve.base} growth=${c.curve.growth} bossAxis=${c.curve.bossAxis} ` +
          `distance=${c.distance.toFixed(3)} | ${c.detail}`,
      );
    }
    for (const c of top.slice(0, 3)) {
      const p4 = diversityRate(data, config, thresholdsFor(c.curve, config.fixtureCount), config.fullClearBonus);
      console.log(
        `  P4 check: base=${c.curve.base} g=${c.curve.growth} axis=${c.curve.bossAxis} -> ${(p4 * 100).toFixed(1)}%`,
      );
    }
    const bestConfig: EngineConfig = { ...config, thresholds: curveToThresholds(top[0].curve) };
    console.log("\nbest curve as config (verify with draw:sim --config):");
    console.log(JSON.stringify({ config: bestConfig, kGreedy: top[0].kGreedy }));
    console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    return;
  }

  const nGenomes = Number(flags.get("search"));
  const rng = rngFromString(`${seedBase}|content-search`);
  interface SearchHit {
    genome: ContentGenome;
    plane: PlaneResult;
    /** Best tense-state fraction anywhere on this content's plane shortlist. */
    maxP3a: number;
    p4?: number;
    total?: number;
  }
  const hits: SearchHit[] = [];
  const dataCache = new Map<number, BoardData[]>();
  const genomes: ContentGenome[] = [];
  console.log(`content search: ${nGenomes} genomes x ${boards} boards, full plane each`);
  for (let i = 0; i < nGenomes; i++) {
    const genome = sampleContent(rng);
    genomes.push(genome);
    const config = contentToConfig(genome);
    const data = precompute(config, seedBase, boards);
    const plane = evalPlane(data, config, 300);
    const best = plane[0];
    const maxP3a = plane.reduce((m, c) => Math.max(m, c.p3a), 0);
    hits.push({ genome, plane: best, maxP3a });
    if (hits.length <= 3 || best.distance < Math.min(...hits.slice(0, -1).map((h) => h.plane.distance))) {
      dataCache.set(i, data);
    }
    if ((i + 1) % 10 === 0) {
      const bestSoFar = Math.min(...hits.map((h) => h.plane.distance));
      const p3aFrontier = Math.max(...hits.map((h) => h.maxP3a));
      console.log(
        `  ${i + 1}/${nGenomes} genomes (best ${bestSoFar.toFixed(3)}, ` +
          `max P3a anywhere ${(p3aFrontier * 100).toFixed(1)}%, ${((performance.now() - t0) / 1000).toFixed(0)}s)`,
      );
    }
  }

  hits.sort((a, b) => a.plane.distance - b.plane.distance);
  const frontier = [...hits].sort((a, b) => b.maxP3a - a.maxP3a)[0];
  console.log(
    `\nP3a frontier across all genomes: ${(frontier.maxP3a * 100).toFixed(1)}% ` +
      `(genome=${JSON.stringify(frontier.genome)})`,
  );
  console.log("\ntop content genomes (P4 evaluated for the best 8):");
  for (const [rank, hit] of hits.slice(0, 8).entries()) {
    const idx = genomes.indexOf(hit.genome);
    const config = contentToConfig(hit.genome);
    const data = dataCache.get(idx) ?? precompute(config, seedBase, boards);
    hit.p4 = diversityRate(data, config, thresholdsFor(hit.plane.curve, config.fixtureCount), config.fullClearBonus);
    hit.total = hit.plane.distance + Math.max(0, (0.7 - hit.p4) / 0.1);
    console.log(
      `#${rank + 1} dist=${hit.plane.distance.toFixed(3)} P4=${(hit.p4 * 100).toFixed(1)}% ` +
        `total=${hit.total.toFixed(3)}\n    curve base=${hit.plane.curve.base} growth=${hit.plane.curve.growth} ` +
        `bossAxis=${hit.plane.curve.bossAxis} | ${hit.plane.detail}\n    genome=${JSON.stringify(hit.genome)}`,
    );
  }
  const winner = [...hits.slice(0, 8)].sort((a, b) => (a.total ?? 99) - (b.total ?? 99))[0];
  const winnerConfig = contentToConfig(winner.genome);
  winnerConfig.thresholds = curveToThresholds(winner.plane.curve);
  console.log("\nwinner config (verify with draw:sim --config):");
  console.log(JSON.stringify({ config: winnerConfig, kGreedy: winner.plane.kGreedy }));
  console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
