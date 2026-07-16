/**
 * Threshold-curve calibrator + content-genome search.
 *
 *   npx tsx scripts/drawSim/calibrate.ts --config <path>       # plane for one content config
 *   npx tsx scripts/drawSim/calibrate.ts --search 150          # sample content genomes too
 *
 * Key structural fact: every bot's draft picks (and therefore its per-round
 * scores) are THRESHOLD-INDEPENDENT — greedy picks by rating, chaser by chain,
 * random by seeded coin; only bank/push/bust depend on the curve. So for a
 * fixed content config we precompute, per board:
 *   - each heuristic bot's 5 round scores (+ the random bot's bank coins),
 *   - the chaser's form=1 round scores (resample mean for the P3 proxy),
 *   - the full 729-line × 5-round score matrix (for oracle full-clearability),
 * then sweep the ENTIRE threshold plane (base × growth × bossAxis, where
 * bossAxis = bossMult × thresholdShape[last] — the two knobs are analytically
 * one axis, decomposed only on config emission) scoring P0 / P1a-P1d / P2, then:
 *   - P3a/P3b (Ticket 0.1): the SAME push-EV Monte-Carlo the sim runs
 *     (chaser continuation policy, forms resampled uniform via the precomputed
 *     chaserW weights), evaluated on a stratified shortlist of stage-1 curves.
 *   - P4 line diversity (computed for finalists only — needs the line matrix).
 * Winners are verified with the real sim (draw:sim) afterwards.
 *
 * Greedy bank rule = Ticket 0.1 C1: push iff Σ squad ratings (face value)
 * ≥ 1.0 × next threshold, else bank.
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
import { buildContext, synergyMultFromMaxima, type BoardContext } from "./boardContext";
import { buildBoostOnlyArchetypes, buildMixedDipArchetypes } from "./archetypeTables";
import { loadConfig, parseFlags } from "./sim";
import { median } from "./metrics";

interface BoardData {
  greedy: number[];
  /** Σ ratings of the greedy squad — the C1 face-value push/bank projection. */
  greedyFace: number;
  chaser: number[];
  /** Chaser round scores with form = 1 (the resample mean for the P3 MC). */
  chaserFormless: number[];
  /**
   * chaserW[r*rows+i] = rating × fixtureMult × synergyMult for chaser card i in
   * round r — so a resampled round score is Σ chaserW·U(1-f,1+f), the exact
   * distribution evalPushAtState draws from in the real sim.
   */
  chaserW: Float64Array;
  random: number[];
  /** Random bot's pre-drawn push coins (true = push). */
  coins: boolean[];
  /** lineScores[line * R + r]. */
  lineScores: Float64Array;
}

function botRoundScores(ctx: BoardContext, squad: Card[], config: EngineConfig): number[] {
  return ctx.board.fixtures.map((f) => scoreRound(ctx.board.seed, squad, f, config).score);
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

function computeLineScores(ctx: BoardContext): Float64Array {
  const { rows, offers, R, N, eff, config } = ctx;
  const lineCount = Math.pow(offers, rows);
  const out = new Float64Array(lineCount * R);
  const roundSums = new Float64Array(R);
  const clubCounts = new Int32Array(ctx.numClubs);
  const nationCounts = new Int32Array(ctx.numNations);
  const eraCounts = new Int32Array(ctx.numEras);
  const visit = (row: number, leafBase: number): void => {
    if (row === rows) {
      let maxClub = 0;
      for (let i = 0; i < clubCounts.length; i++) if (clubCounts[i] > maxClub) maxClub = clubCounts[i];
      let maxNation = 0;
      for (let i = 0; i < nationCounts.length; i++) if (nationCounts[i] > maxNation) maxNation = nationCounts[i];
      let maxEra = 0;
      for (let i = 0; i < eraCounts.length; i++) if (eraCounts[i] > maxEra) maxEra = eraCounts[i];
      const synMult = synergyMultFromMaxima(config, maxClub, maxNation, maxEra);
      for (let r = 0; r < R; r++) out[leafBase * R + r] = roundSums[r] * synMult;
      return;
    }
    for (let o = 0; o < offers; o++) {
      const c = row * offers + o;
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
  const cardSet = generateCardSet(`${seedBase}|cards`, config.cardGen);
  const formless: EngineConfig = { ...config, formSpread: 0 };
  const data: BoardData[] = [];
  for (let i = 0; i < boards; i++) {
    const board = generateBoard(`${seedBase}#${i}`, cardSet, config);
    const ctx = buildContext(board, config);
    const rng = rngFromString(`${seedBase}#${i}|randombot`);
    const randomSquad = board.rows.map((row) => row[rngInt(rng, row.length)]);
    const coins = Array.from({ length: config.fixtureCount - 1 }, () => rng() < 0.5);
    const chaserSquad = draftChaser(ctx);
    const greedySquad = draftGreedy(ctx);
    const chaserW = new Float64Array(config.fixtureCount * config.rows);
    const chaserFormless: number[] = [];
    board.fixtures.forEach((fixture, r) => {
      const breakdown = scoreRound(board.seed, chaserSquad, fixture, formless);
      chaserFormless.push(breakdown.score);
      breakdown.cards.forEach((cb, i) => {
        chaserW[r * config.rows + i] = cb.contribution * breakdown.synergyMult;
      });
    });
    data.push({
      greedy: botRoundScores(ctx, greedySquad, config),
      greedyFace: greedySquad.reduce((sum, c) => sum + c.rating, 0),
      chaser: botRoundScores(ctx, chaserSquad, config),
      chaserFormless,
      chaserW,
      random: botRoundScores(ctx, randomSquad, config),
      coins,
      lineScores: computeLineScores(ctx),
    });
  }
  return data;
}

function greedyRounds(
  scores: number[],
  face: number,
  t: number[],
): { rounds: number; failMargin: number } {
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return { rounds: r, failMargin: scores[r] / t[r] };
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN };
    if (face < 1.0 * t[r + 1]) return { rounds: r + 1, failMargin: NaN };
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
 * P3a/P3b for one curve — the same Monte-Carlo evalPushAtState runs in the
 * real sim (chaser continuation policy, forms resampled uniform), fed by the
 * precomputed chaserW weight vectors. Run on stage-1 shortlist curves only.
 */
function mcP3(
  data: BoardData[],
  config: EngineConfig,
  t: number[],
  rng: () => number,
  samples: number,
): { p3a: number; p3b: number } {
  const R = config.fixtureCount;
  const rows = config.rows;
  const f = config.formSpread;
  let states = 0;
  let tense = 0;
  const tenseSpreads: number[] = [];
  for (const bd of data) {
    const c = chaserRounds(bd.chaser, t);
    let banked = 0;
    for (let k = 2; k <= 3; k++) {
      if (c.rounds < k) break;
      banked = k === 2 ? bd.chaser[0] + bd.chaser[1] : banked + bd.chaser[2];
      let sum = 0;
      let sumSq = 0;
      for (let s = 0; s < samples; s++) {
        let cum = banked;
        let final = 0;
        for (let j = k; j < R; j++) {
          let score = 0;
          for (let i = 0; i < rows; i++) score += bd.chaserW[j * rows + i] * (1 - f + 2 * f * rng());
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
      const gap = (ev - banked) / banked;
      states++;
      if (gap >= -0.2 && gap <= 0.1) {
        tense++;
        const variance = Math.max(0, sumSq / samples - ev * ev);
        tenseSpreads.push(Math.sqrt(variance) / banked);
      }
    }
  }
  return {
    p3a: states === 0 ? 0 : tense / states,
    p3b: tenseSpreads.length ? median(tenseSpreads) : NaN,
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
  detail: string;
}

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
  const bases: number[] = [];
  for (let b = 400; b <= 3200; b += 50) bases.push(b);

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
        const gRounds: number[] = [];
        const cRounds: number[] = [];
        const rRounds: number[] = [];
        let chaserFC = 0;
        let fails = 0;
        let nearMisses = 0;
        for (let i = 0; i < boards; i++) {
          if (M[i] >= base) fullClearable++;
          const g = greedyRounds(data[i].greedy, data[i].greedyFace, t);
          gRounds.push(g.rounds);
          if (!Number.isNaN(g.failMargin)) {
            fails++;
            if (g.failMargin >= 0.88) nearMisses++;
          }
          const c = chaserRounds(data[i].chaser, t);
          cRounds.push(c.rounds);
          if (c.fullClear) chaserFC++;
          if (!Number.isNaN(c.failMargin)) {
            fails++;
            if (c.failMargin >= 0.88) nearMisses++;
          }
          rRounds.push(randomRounds(data[i].random, data[i].coins, t));
        }
        const p0 = fullClearable / boards;
        const p1a = median(rRounds);
        const p1b = median(gRounds);
        const p1c = median(cRounds);
        const p1d = chaserFC / boards;
        const p2 = fails === 0 ? 0 : nearMisses / fails;
        const dParts = [
          Math.max(0, (0.995 - p0) / 0.005),
          Math.max(0, p1a - 1),
          out(p1b, 1.5, 2.5, 0.5),
          out(p1c, 3, 4, 0.5),
          out(p1d, 0.1, 0.25, 0.05),
          out(p2, 0.25, 0.4, 0.05),
        ];
        const distance = dParts.reduce((a, b) => a + b, 0);
        stage1.push({
          curve: { base, growth, bossAxis },
          distance,
          passes: dParts.filter((d) => d === 0).length,
          p0,
          p1a,
          p1b,
          p1c,
          p1d,
          p2,
          p3a: NaN,
          p3b: NaN,
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
    const { p3a, p3b } = mcP3(data, config, t, rng, 96);
    cand.p3a = p3a;
    cand.p3b = p3b;
    const p3Parts =
      Math.max(0, (0.4 - p3a) / 0.1) +
      (Number.isNaN(p3b) ? 5 : Math.max(0, (0.35 - p3b) / 0.1));
    cand.distance += p3Parts;
    cand.passes += (Math.max(0, (0.4 - p3a) / 0.1) === 0 ? 1 : 0) +
      (!Number.isNaN(p3b) && (0.35 - p3b) / 0.1 <= 0 ? 1 : 0);
    cand.detail =
      `P0=${(cand.p0 * 100).toFixed(1)}% P1a=${cand.p1a} P1b=${cand.p1b} P1c=${cand.p1c} ` +
      `P1d=${(cand.p1d * 100).toFixed(1)}% P2=${(cand.p2 * 100).toFixed(1)}% ` +
      `P3a=${(p3a * 100).toFixed(1)}% P3b=${Number.isNaN(p3b) ? "n/a" : (p3b * 100).toFixed(1) + "%"}`;
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
    synergyTable: [1, 1, 1, s(0), s(1), s(2), s(3)],
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

  if (!flags.has("search")) {
    // --genome <path>: a ContentGenome JSON (as printed by --search) instead of
    // a config file — runs the same single-content plane on contentToConfig(it).
    const genomePath = flags.get("genome");
    const config = genomePath
      ? contentToConfig(JSON.parse(fs.readFileSync(genomePath, "utf8")) as ContentGenome)
      : loadConfig(flags.get("config"));
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
    console.log(JSON.stringify({ config: bestConfig }));
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
  console.log(JSON.stringify({ config: winnerConfig }));
  console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}

main();
