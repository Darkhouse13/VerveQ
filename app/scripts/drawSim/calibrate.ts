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
 * then sweep the ENTIRE geometric threshold plane (base × growth × bossMult)
 * analytically, scoring P0 / P1a-P1d / P2 plus:
 *   - p3p: median clear-probability of the next round at chaser bank points
 *     (target corridor ~[0.35, 0.75]; bustKeep / fullClearBonus are free knobs
 *     solved afterwards to put EV(push)-EV(bank) in [-15%, 0%]),
 *   - P4 line diversity (computed for finalists only — needs the line matrix).
 * Winners are verified with the real sim (draw:sim) afterwards.
 */

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
import { loadConfig, parseFlags } from "./sim";
import { median } from "./metrics";

interface BoardData {
  greedy: number[];
  chaser: number[];
  /** Chaser round scores with form = 1 (the resample mean for the P3 proxy). */
  chaserFormless: number[];
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
    data.push({
      greedy: botRoundScores(ctx, draftGreedy(ctx), config),
      chaser: botRoundScores(ctx, chaserSquad, config),
      chaserFormless: botRoundScores(ctx, chaserSquad, formless),
      random: botRoundScores(ctx, randomSquad, config),
      coins,
      lineScores: computeLineScores(ctx),
    });
  }
  return data;
}

function greedyRounds(scores: number[], t: number[]): { rounds: number; failMargin: number } {
  let cum = 0;
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return { rounds: r, failMargin: scores[r] / t[r] };
    cum += scores[r];
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN };
    if (cum > 1.5 * t[0]) return { rounds: r + 1, failMargin: NaN };
  }
  return { rounds: t.length, failMargin: NaN };
}

interface ChaserOutcome {
  rounds: number;
  failMargin: number;
  fullClear: boolean;
  /** Fixture index the forced push would play if the chaser banked here. */
  bankNext: number;
}

function chaserRounds(scores: number[], t: number[]): ChaserOutcome {
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return { rounds: r, failMargin: scores[r] / t[r], fullClear: false, bankNext: -1 };
    if (r === t.length - 1) return { rounds: t.length, failMargin: NaN, fullClear: true, bankNext: -1 };
    if (scores[r] < 1.1 * t[r + 1]) return { rounds: r + 1, failMargin: NaN, fullClear: false, bankNext: r + 1 };
  }
  return { rounds: t.length, failMargin: NaN, fullClear: true, bankNext: -1 };
}

function randomRounds(scores: number[], coins: boolean[], t: number[]): number {
  for (let r = 0; r < t.length; r++) {
    if (scores[r] < t[r]) return r;
    if (r === t.length - 1) return t.length;
    if (!coins[r]) return r + 1;
  }
  return t.length;
}

/** P(clear) for a resampled round: mean `formless`, relative sd ≈ f/(√3·√6). */
function clearProb(formless: number, threshold: number, formSpread: number): number {
  const sigma = Math.max(1e-9, formSpread / 4.24);
  const z = (formless / threshold - 1) / sigma;
  return 1 / (1 + Math.exp(-1.7 * z));
}

export interface Curve {
  base: number;
  growth: number;
  bossMult: number;
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
  p3p: number;
  detail: string;
}

function thresholdsFor(curve: Curve, R: number): number[] {
  return Array.from({ length: R }, (_, r) =>
    Math.round(curve.base * Math.pow(curve.growth, r) * (r === R - 1 ? curve.bossMult : 1)),
  );
}

function evalPlane(data: BoardData[], config: EngineConfig, keep: number): PlaneResult[] {
  const R = config.fixtureCount;
  const boards = data.length;
  const lineCount = Math.pow(config.offersPerRow, config.rows);
  const growths: number[] = [];
  for (let g = 1.04; g <= 1.421; g += 0.025) growths.push(Number(g.toFixed(3)));
  const bossMults: number[] = [];
  for (let m = 0.7; m <= 1.151; m += 0.05) bossMults.push(Number(m.toFixed(3)));
  const bases: number[] = [];
  for (let b = 400; b <= 3200; b += 50) bases.push(b);

  const top: PlaneResult[] = [];
  for (const growth of growths) {
    for (const bossMult of bossMults) {
      const weights = Array.from({ length: R }, (_, r) => Math.pow(growth, r) * (r === R - 1 ? bossMult : 1));
      const M = new Float64Array(boards);
      for (let i = 0; i < boards; i++) {
        const ls = data[i].lineScores;
        let best = 0;
        for (let l = 0; l < lineCount; l++) {
          let worst = Infinity;
          for (let r = 0; r < R; r++) {
            const u = ls[l * R + r] / weights[r];
            if (u < worst) worst = u;
          }
          if (worst > best) best = worst;
        }
        M[i] = best;
      }

      for (const base of bases) {
        const t = weights.map((w) => base * w);
        let fullClearable = 0;
        const gRounds: number[] = [];
        const cRounds: number[] = [];
        const rRounds: number[] = [];
        const pushPs: number[] = [];
        let chaserFC = 0;
        let fails = 0;
        let nearMisses = 0;
        for (let i = 0; i < boards; i++) {
          if (M[i] >= base) fullClearable++;
          const g = greedyRounds(data[i].greedy, t);
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
          if (c.bankNext >= 0) {
            pushPs.push(clearProb(data[i].chaserFormless[c.bankNext], t[c.bankNext], config.formSpread));
          }
          rRounds.push(randomRounds(data[i].random, data[i].coins, t));
        }
        const p0 = fullClearable / boards;
        const p1a = median(rRounds);
        const p1b = median(gRounds);
        const p1c = median(cRounds);
        const p1d = chaserFC / boards;
        const p2 = fails === 0 ? 0 : nearMisses / fails;
        const p3p = pushPs.length ? median(pushPs) : 0;
        const out = (v: number, lo: number, hi: number, u: number) =>
          v < lo ? (lo - v) / u : v > hi ? (v - hi) / u : 0;
        const dParts = [
          Math.max(0, (0.995 - p0) / 0.005),
          Math.max(0, p1a - 1),
          out(p1b, 1.5, 2.5, 0.5),
          out(p1c, 3, 4, 0.5),
          out(p1d, 0.1, 0.25, 0.05),
          out(p2, 0.25, 0.4, 0.05),
          out(p3p, 0.35, 0.75, 0.15),
        ];
        const distance = dParts.reduce((a, b) => a + b, 0);
        const passes = dParts.filter((d) => d === 0).length;
        top.push({
          curve: { base, growth, bossMult },
          distance,
          passes,
          p0,
          p1a,
          p1b,
          p1c,
          p1d,
          p2,
          p3p,
          detail:
            `P0=${(p0 * 100).toFixed(1)}% P1a=${p1a} P1b=${p1b} P1c=${p1c} ` +
            `P1d=${(p1d * 100).toFixed(1)}% P2=${(p2 * 100).toFixed(1)}% p3p=${p3p.toFixed(2)}`,
        });
        top.sort((a, b) => a.distance - b.distance);
        if (top.length > keep) top.pop();
      }
    }
  }
  return top;
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
  modifierStrength: number;
  /**
   * 0 = default boost+penalty archetypes; 1 = boost-only niche archetypes
   * (GK/era boosts greedy rarely holds — decouples greedy variance from
   * oracle/chaser separation).
   */
  archStyle: number;
}

/** Boost-only archetype table: niche boosts, no penalties, one neutral wall. */
function buildBoostOnlyArchetypes(strength: number): EngineConfig["archetypes"] {
  const pow = (m: number) => Math.pow(m, strength);
  return [
    { id: "ARCH_WALL_B", modifiers: [{ kind: "position", value: "DEF", mult: pow(1.9) }] },
    { id: "ARCH_KEEPER_B", modifiers: [{ kind: "position", value: "GK", mult: pow(3.2) }] },
    { id: "ARCH_SPEAR_B", modifiers: [{ kind: "position", value: "ATT", mult: pow(1.9) }] },
    { id: "ARCH_THROWBACK_B", modifiers: [{ kind: "eraBefore", value: 3, mult: pow(1.7) }] },
    { id: "ARCH_NEWWAVE_B", modifiers: [{ kind: "eraAtLeast", value: 3, mult: pow(1.55) }] },
    { id: "ARCH_NEUTRAL", modifiers: [] },
  ];
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
  return {
    synergyBase: uniform(1.12, 1.45),
    synergyStep: uniform(0.12, 0.4),
    clubCount: int(8, 13),
    nationCount: int(5, 8),
    eraCount: int(4, 6),
    presetIdx: rngInt(rng, PRESETS.length),
    ratingSkew: uniform(0.7, 1.2),
    formSpread: uniform(0.18, 0.32),
    modifierStrength: uniform(0.8, 1.6),
    archStyle: rng() < 0.65 ? 1 : 0,
  };
}

function contentToConfig(g: ContentGenome): EngineConfig {
  const s = (k: number) => Number((g.synergyBase + k * g.synergyStep).toFixed(4));
  return {
    ...DEFAULT_ENGINE_CONFIG,
    formSpread: g.formSpread,
    synergyTable: [1, 1, 1, s(0), s(1), s(2), s(3)],
    archetypes:
      g.archStyle === 1
        ? buildBoostOnlyArchetypes(g.modifierStrength)
        : buildArchetypes(g.modifierStrength),
    cardGen: {
      ...DEFAULT_ENGINE_CONFIG.cardGen,
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
    const config = loadConfig(flags.get("config"));
    console.log(`calibrate: precomputing ${boards} boards...`);
    const data = precompute(config, seedBase, boards);
    console.log(`  precompute done in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    const top = evalPlane(data, config, 15);
    console.log(`\ntop threshold curves for this content config:`);
    for (const c of top) {
      console.log(
        `  base=${c.curve.base} growth=${c.curve.growth} bossMult=${c.curve.bossMult} ` +
          `distance=${c.distance.toFixed(3)} passes=${c.passes}/7 | ${c.detail}`,
      );
    }
    for (const c of top.slice(0, 3)) {
      const p4 = diversityRate(data, config, c.curve, 1.5);
      console.log(
        `  P4 check: base=${c.curve.base} g=${c.curve.growth} bm=${c.curve.bossMult} -> ${(p4 * 100).toFixed(1)}%`,
      );
    }
    console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
    return;
  }

  const nGenomes = Number(flags.get("search"));
  const rng = rngFromString(`${seedBase}|content-search`);
  interface SearchHit {
    genome: ContentGenome;
    plane: PlaneResult;
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
    const best = evalPlane(data, config, 1)[0];
    hits.push({ genome, plane: best });
    if (hits.length <= 3 || best.distance < Math.min(...hits.slice(0, -1).map((h) => h.plane.distance))) {
      dataCache.set(i, data);
    }
    if ((i + 1) % 10 === 0) {
      const bestSoFar = Math.min(...hits.map((h) => h.plane.distance));
      console.log(
        `  ${i + 1}/${nGenomes} genomes (best ${bestSoFar.toFixed(3)}, ${((performance.now() - t0) / 1000).toFixed(0)}s)`,
      );
    }
  }

  hits.sort((a, b) => a.plane.distance - b.plane.distance);
  console.log("\ntop content genomes (P4 evaluated for the best 8):");
  for (const [rank, hit] of hits.slice(0, 8).entries()) {
    const idx = genomes.indexOf(hit.genome);
    const config = contentToConfig(hit.genome);
    const data = dataCache.get(idx) ?? precompute(config, seedBase, boards);
    hit.p4 = diversityRate(data, config, hit.plane.curve, 1.5);
    hit.total = hit.plane.distance + Math.max(0, (0.7 - hit.p4) / 0.1);
    console.log(
      `#${rank + 1} dist=${hit.plane.distance.toFixed(3)} P4=${(hit.p4 * 100).toFixed(1)}% ` +
        `total=${hit.total.toFixed(3)}\n    curve base=${hit.plane.curve.base} growth=${hit.plane.curve.growth} ` +
        `bossMult=${hit.plane.curve.bossMult} | ${hit.plane.detail}\n    genome=${JSON.stringify(hit.genome)}`,
    );
  }
  const winner = [...hits.slice(0, 8)].sort((a, b) => (a.total ?? 99) - (b.total ?? 99))[0];
  const winnerConfig = contentToConfig(winner.genome);
  winnerConfig.thresholds = {
    base: winner.plane.curve.base,
    growth: winner.plane.curve.growth,
    bossMult: winner.plane.curve.bossMult,
  };
  console.log("\nwinner config (verify with draw:sim --config):");
  console.log(JSON.stringify({ config: winnerConfig }));
  console.log(`\ntotal ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}

main();
