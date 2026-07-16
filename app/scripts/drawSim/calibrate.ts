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
import {
  buildArchetypes,
  DEFAULT_ENGINE_CONFIG,
  generateBoard,
  generateCardSet,
  rngFromString,
  rngInt,
  scoreRound,
  type Card,
  type EngineConfig,
} from "../../src/lib/drawEngine";
import { benchOptimalScores, buildContext, type BoardContext } from "./boardContext";
import { buildBoostOnlyArchetypes, buildMixedDipArchetypes } from "./archetypeTables";
import { chaserBenchFor, greedyBenchFor } from "./bots";
import { loadConfig, parseFlags } from "./sim";
import { median } from "./metrics";

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

function precompute(config: EngineConfig, seedBase: string, boards: number): BoardData[] {
  // Rotate over several card sets: the sim generates its set from its own
  // seed, so a curve tuned against a single set overfits the set lottery —
  // averaging over sets is what makes winners transfer across sim seeds.
  const CARD_SETS = 10;
  const cardSets = Array.from({ length: CARD_SETS }, (_, s) =>
    generateCardSet(`${seedBase}|cards${s}`, config.cardGen),
  );
  const formless: EngineConfig = { ...config, formSpread: 0 };
  const R = config.fixtureCount;
  const fielded = config.rows - 1;
  const data: BoardData[] = [];
  for (let i = 0; i < boards; i++) {
    const board = generateBoard(`${seedBase}#${i}`, cardSets[i % CARD_SETS], config);
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

    data.push({
      greedy,
      greedyFaces,
      chaser,
      chaserW,
      random,
      coins,
      lineScores: computeLineScores(ctx),
    });
  }
  return data;
}

function greedyRounds(
  scores: number[],
  faces: number[],
  kGreedy: number,
  t: number[],
): { rounds: number; failMargin: number } {
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return { rounds: r, failMargin: scores[r] / t[r] };
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN };
    if (faces[r + 1] < kGreedy * t[r + 1]) return { rounds: r + 1, failMargin: NaN };
  }
  return { rounds: t.length, failMargin: NaN };
}

interface ChaserOutcome {
  rounds: number;
  failMargin: number;
  fullClear: boolean;
}

function chaserRounds(scores: number[], t: number[]): ChaserOutcome {
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return { rounds: r, failMargin: scores[r] / t[r], fullClear: false };
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN, fullClear: true };
    if (scores[r] < 1.1 * t[r + 1]) return { rounds: r + 1, failMargin: NaN, fullClear: false };
  }
  return { rounds: t.length, failMargin: NaN, fullClear: true };
}

function randomRounds(scores: number[], coins: boolean[], t: number[]): number {
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return r;
    if (r === t.length - 1) return t.length;
    if (!coins[r]) return r + 1;
  }
  return t.length;
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
): { p3a: number; p3b: number; perState: number } {
  const R = config.fixtureCount;
  const fielded = config.rows - 1;
  const f = config.formSpread;
  let states = 0;
  let tense = 0;
  let tenseRuns = 0;
  const tenseSpreads: number[] = [];
  for (const bd of data) {
    const c = chaserRounds(bd.chaser, t);
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
          } else if (score < 1.1 * t[j + 1]) {
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
  return {
    p3a: data.length === 0 ? 0 : tenseRuns / data.length,
    p3b: tenseSpreads.length ? median(tenseSpreads) : NaN,
    perState: states === 0 ? 0 : tense / states,
  };
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
            const g = greedyRounds(data[i].greedy, data[i].greedyFaces, KGREEDY_GRID[ki], t);
            gRoundsK[ki].push(g.rounds);
            if (!Number.isNaN(g.failMargin)) {
              gFailsK[ki]++;
              if (g.failMargin >= 0.88) gNearK[ki]++;
            }
          }
          const c = chaserRounds(data[i].chaser, t);
          cRounds.push(c.rounds);
          if (c.fullClear) chaserFC++;
          if (!Number.isNaN(c.failMargin)) {
            cFails++;
            if (c.failMargin >= 0.88) cNearMisses++;
          }
          rRounds.push(randomRounds(data[i].random, data[i].coins, t));
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
    const { p3a, p3b, perState } = mcP3(data, config, t, rng, 96);
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

/** P4 line-diversity rate for a specific curve (needs the line matrices). */
function diversityRate(data: BoardData[], config: EngineConfig, curve: Curve, bonus: number): number {
  const R = config.fixtureCount;
  const rows = config.rows;
  const offers = config.offersPerRow;
  const lineCount = Math.pow(offers, rows);
  const t = thresholdsFor(curve, R);
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

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const boards = Number(flags.get("boards") ?? 500);
  const seedBase = flags.get("seed") ?? "calibrate-v0";
  const t0 = performance.now();

  // --eval: no plane scan, no selection — measure the loaded config's OWN
  // thresholds (+ kGreedy) on freshly rotated card sets. This is the honest,
  // selection-free estimate of a specific candidate (winner's-curse control).
  if (flags.has("eval")) {
    const { config, kGreedy } = loadConfig(flags.get("config"));
    const data = precompute(config, seedBase, boards);
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
    let fullClearable = 0;
    const gRounds: number[] = [];
    const cRounds: number[] = [];
    const rRounds: number[] = [];
    let chaserFC = 0;
    let fails = 0;
    let nearMisses = 0;
    const lineCount = Math.pow(config.offersPerRow, config.rows);
    for (const bd of data) {
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
      const g = greedyRounds(bd.greedy, bd.greedyFaces, kGreedy, t);
      gRounds.push(g.rounds);
      if (!Number.isNaN(g.failMargin)) {
        fails++;
        if (g.failMargin >= 0.88) nearMisses++;
      }
      const c = chaserRounds(bd.chaser, t);
      cRounds.push(c.rounds);
      if (c.fullClear) chaserFC++;
      if (!Number.isNaN(c.failMargin)) {
        fails++;
        if (c.failMargin >= 0.88) nearMisses++;
      }
      rRounds.push(randomRounds(bd.random, bd.coins, t));
    }
    const { p3a, p3b, perState } = mcP3(data, config, t, rngFromString(`${seedBase}|eval`), 192);
    console.log(
      `eval (${boards} boards, rotated sets, seed ${seedBase}, kGreedy ${kGreedy}): ` +
        `P0=${((fullClearable / data.length) * 100).toFixed(2)}% P1a=${median(rRounds)} ` +
        `P1b=${median(gRounds)} P1c=${median(cRounds)} P1d=${((chaserFC / data.length) * 100).toFixed(1)}% ` +
        `P2=${(fails ? (nearMisses / fails) * 100 : 0).toFixed(1)}% ` +
        `P3a=${(p3a * 100).toFixed(1)}%runs(${(perState * 100).toFixed(1)}%st) P3b=${(p3b * 100).toFixed(1)}%`,
    );
    console.log(`total ${((performance.now() - t0) / 1000).toFixed(0)}s`);
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
      const p4 = diversityRate(data, config, c.curve, config.fullClearBonus);
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
    hit.p4 = diversityRate(data, config, hit.plane.curve, config.fullClearBonus);
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

main();
