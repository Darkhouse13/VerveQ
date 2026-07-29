/**
 * FS-1 Phase 3 — the simulation runs.
 *
 *   npx tsx sim/run.ts              # full sweep, N=2000/generator/gameweek
 *   npx tsx sim/run.ts --n 200      # quick pass while iterating
 *   npx tsx sim/run.ts --dump-rows rows.json   # + per-row scored dump (FW-S2b)
 *
 * PURE: reads `data/` through `sim/dataset.ts`, scores through the shipped
 * engine (`app/convex/lib/fantasyScoring.ts` — FW-4 R1 moved it there; this
 * harness and the live pipeline now call the same file), and writes a JSON
 * result to stdout or `--out`. No
 * network, no clock in the computation (only in the "generated at" stamp),
 * seeded RNG throughout, so two runs of the same sweep are identical.
 *
 * It measures. It proposes nothing and decides nothing — Phase 4's report is
 * where numbers become proposals, and setting a constant is the owner's call.
 *
 * ── What is measured, and why each one ──
 *
 *  A. Per-position score distributions. SCORING_SPEC design principle 1 says
 *     every position must be able to score well from what fans actually praise.
 *     That is a claim about distributions, and it is checkable.
 *  B. Term attribution — where points actually come from, by ledger code. The
 *     spec's §Known tensions item 3 worries win/draw points reward players on
 *     good teams regardless of performance; attribution is how you see it.
 *  C. Cap bind rates and the 0.5x/2x sensitivity sweep. A cap that never binds
 *     is decoration; one that binds on nearly every row has flattened the stat.
 *  D. Ramp deltas. v0.5.0 (P4) replaced the duel and pass-completion step
 *     bonuses with linear ramps; this measures how many rows the ramps move
 *     relative to the old v0.4.1 cliffs, and by how much. The FW-S2 acceptance
 *     gate requires that no row move by more than 1.0 pt.
 *  E. The MID destroyer case — §Known tensions item 2.
 *  F. Crowd clamp stability at +/-10/15/25%: does the multiplier reorder squads,
 *     and by how much?
 *  G. Squad-level distributions from the three generators.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scorePlayer,
  DEFAULT_CAPS,
  scaledCaps,
  type CapConfig,
  type LedgerEntry,
  type Slot,
} from '../../../app/convex/lib/fantasyScoring.ts';
import { eventsFromEntry, loadDataset, type Gameweek, type PlayerFixtureRow } from './dataset.ts';
import {
  GENERATOR_NAMES,
  generateSquad,
  rng,
  rowKey,
  type GeneratorName,
  type Squad,
} from './squads.ts';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------- plumbing

const argv = process.argv.slice(2);
function flag(name: string, fallback: number): number {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const parsed = Number.parseInt(argv[i + 1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
const N_PER_GENERATOR = flag('n', 2000);
const OUT_INDEX = argv.indexOf('--out');
const OUT_PATH = OUT_INDEX === -1 ? null : argv[OUT_INDEX + 1];
const DUMP_INDEX = argv.indexOf('--dump-rows');
const DUMP_PATH = DUMP_INDEX === -1 ? null : argv[DUMP_INDEX + 1];
const BASE_SEED = flag('seed', 20260729);

function log(line: string): void {
  process.stderr.write(`${line}\n`);
}

// ------------------------------------------------------------------ statistics

interface Stats {
  n: number;
  mean: number;
  sd: number;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  p99: number;
  max: number;
}

function describe(values: readonly number[]): Stats {
  if (values.length === 0) {
    return { n: 0, mean: 0, sd: 0, min: 0, p10: 0, p25: 0, median: 0, p75: 0, p90: 0, p99: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / sorted.length;
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    n: sorted.length,
    mean: round(mean),
    sd: round(Math.sqrt(variance)),
    min: round(sorted[0]),
    p10: round(q(0.1)),
    p25: round(q(0.25)),
    median: round(q(0.5)),
    p75: round(q(0.75)),
    p90: round(q(0.9)),
    p99: round(q(0.99)),
    max: round(sorted[sorted.length - 1]),
  };
}

function round(x: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** Spearman rank correlation. Ties get average ranks. */
function spearman(a: readonly number[], b: readonly number[]): number {
  const rank = (xs: readonly number[]): number[] => {
    const idx = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
    const out = new Array<number>(xs.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j += 1;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) out[idx[k].i] = avg;
      i = j + 1;
    }
    return out;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = ra.length;
  if (n < 2) return 1;
  const ma = ra.reduce((x, y) => x + y, 0) / n;
  const mb = rb.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 1 : num / Math.sqrt(da * db);
}

/** Share of pairs whose relative order changed between two rankings. */
function pairInversionRate(a: readonly number[], b: readonly number[], sampleSeed: number): number {
  const n = a.length;
  if (n < 2) return 0;
  const random = rng(sampleSeed);
  const draws = Math.min(200_000, (n * (n - 1)) / 2);
  let inverted = 0;
  for (let k = 0; k < draws; k += 1) {
    const i = Math.floor(random() * n);
    let j = Math.floor(random() * n);
    if (i === j) j = (j + 1) % n;
    if (a[i] === a[j]) continue;
    const orderA = a[i] < a[j];
    const orderB = b[i] < b[j];
    if (orderA !== orderB) inverted += 1;
  }
  return round(inverted / draws, 5);
}

// ------------------------------------------------------------------ scoring

/** Score a row as a STARTER in its own nominal position. The reference line. */
function baseScoreOf(
  row: PlayerFixtureRow,
  caps: CapConfig,
): { points: number; ledger: readonly LedgerEntry[] } {
  const slot = row.feedPosition ?? 'MID';
  const result = scorePlayer(
    { stats: row.stats, context: row.context, events: row.events },
    { position: slot, role: 'starter' },
    slot,
    null,
    0,
    caps,
  );
  return { points: result.points, ledger: result.ledger };
}

function scorePick(
  pick: { row: PlayerFixtureRow; slot: Slot; role: 'starter' | 'finisher' },
  crowdFactor: number,
  caps: CapConfig,
): number {
  const { row } = pick;
  const events = pick.role === 'finisher' ? eventsFromEntry(row) : row.events;
  return scorePlayer(
    { stats: row.stats, context: row.context, events },
    { position: pick.slot, role: pick.role },
    row.feedPosition ?? pick.slot,
    pick.role === 'finisher' ? row.entryMinute : null,
    crowdFactor,
    caps,
  ).points;
}

function squadTotal(squad: Squad, crowdOf: (row: PlayerFixtureRow) => number, caps: CapConfig): number {
  let total = 0;
  for (const pick of squad) total += scorePick(pick, crowdOf(pick.row), caps);
  return round(total);
}

// ---------------------------------------------------------------- crowd model

/**
 * The crowd factor the sims assume, stated plainly because it is an ASSUMPTION
 * and not a measurement.
 *
 * There is no vote data — CROWD_VOTING has not shipped — so a stability sweep
 * needs a model of what the crowd would say. The one used here: the crowd
 * broadly agrees with the scoreline but not exactly, so the factor is driven by
 * the player's percentile within his gameweek, re-centred to [-1, +1] and
 * blended with noise:
 *
 *     signal = 2 x percentile(base score within gameweek) - 1
 *     factor = clamp x ((1 - NOISE) x signal + NOISE x uniform(-1, +1))
 *
 * NOISE = 0.4 — the crowd is assumed substantially, not perfectly, correlated
 * with the base score. This choice matters: at NOISE = 0 the crowd only
 * amplifies the existing order and reordering is near-impossible by
 * construction, which would make the clamp look safe for a reason that has
 * nothing to do with the clamp. The sweep is reported at three clamps against
 * this one model; a different NOISE would move the absolute numbers, and the
 * report says so rather than presenting them as measured.
 *
 * Players below the vote-liquidity threshold get 0 (base stands, per spec). The
 * threshold itself is un-simulatable without vote volumes and is left alone.
 */
const CROWD_NOISE = 0.4;

function crowdFactors(
  gameweek: Gameweek,
  baseByKey: ReadonlyMap<string, number>,
  clamp: number,
  seed: number,
): Map<string, number> {
  const random = rng(seed);
  const rows = gameweek.rows;
  const sorted = rows
    .map((r) => ({ key: rowKey(r), score: baseByKey.get(rowKey(r)) ?? 0 }))
    .sort((a, b) => a.score - b.score);

  const out = new Map<string, number>();
  sorted.forEach((entry, index) => {
    const percentile = sorted.length <= 1 ? 0.5 : index / (sorted.length - 1);
    const signal = 2 * percentile - 1;
    const noise = 2 * random() - 1;
    out.set(entry.key, clamp * ((1 - CROWD_NOISE) * signal + CROWD_NOISE * noise));
  });
  return out;
}

// ---------------------------------------------------------------------- main

const dataset = loadDataset();
log(`loaded ${dataset.rows.length} player-fixture rows across ${dataset.gameweeks.length} gameweeks`);

// ---- baseline scores (default caps), used everywhere downstream
const baseByKey = new Map<string, number>();
const ledgerByKey = new Map<string, readonly LedgerEntry[]>();
for (const row of dataset.rows) {
  const { points, ledger } = baseScoreOf(row, DEFAULT_CAPS);
  baseByKey.set(rowKey(row), points);
  ledgerByKey.set(rowKey(row), ledger);
}

// ---- opt-in per-row dump (`--dump-rows <path>`), FW-S2b -------------------
// Every row's baseline score with its full term breakdown, so a verifier can
// recompute any score by hand from the spec without re-deriving the dataset.
// Rows are scored exactly as the baseline above: starter in the nominal
// position, default caps, crowd 0. Writing the dump is strictly additive —
// without the flag, the run and its report output are byte-identical.
if (DUMP_PATH !== null && DUMP_PATH !== undefined) {
  const rowsDump = dataset.rows.map((row) => ({
    key: rowKey(row),
    fixtureId: row.fixtureId,
    playerId: row.playerId,
    playerName: row.playerName,
    feedPosition: row.feedPosition,
    minutes: row.stats.minutes,
    total: baseByKey.get(rowKey(row)) ?? 0,
    terms: (ledgerByKey.get(rowKey(row)) ?? []).map((entry) => ({
      code: entry.code,
      points: entry.points,
      ...(entry.note === undefined ? {} : { note: entry.note }),
    })),
  }));
  const target = path.isAbsolute(DUMP_PATH) ? DUMP_PATH : path.join(PACKAGE_ROOT, DUMP_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(rowsDump, null, 2)}\n`);
  log(`wrote per-row dump ${target} (${rowsDump.length} rows)`);
}

// ---- A. per-position distributions -----------------------------------------
const positions: Slot[] = ['GK', 'DEF', 'MID', 'ATT'];
const byPosition: Record<string, Stats> = {};
const byPositionPlayed: Record<string, Stats> = {};
for (const position of positions) {
  const rows = dataset.rows.filter((r) => r.feedPosition === position);
  byPosition[position] = describe(rows.map((r) => baseByKey.get(rowKey(r)) ?? 0));
  byPositionPlayed[position] = describe(
    rows.filter((r) => r.stats.minutes > 0).map((r) => baseByKey.get(rowKey(r)) ?? 0),
  );
}

// ---- B. term attribution ----------------------------------------------------
interface TermAgg {
  code: string;
  rowsWithTerm: number;
  totalPoints: number;
  meanWhenPresent: number;
  shareOfPositivePoints: number;
}
const termTotals = new Map<string, { rows: number; points: number }>();
let positiveMass = 0;
for (const row of dataset.rows) {
  if (row.stats.minutes <= 0) continue;
  for (const entry of ledgerByKey.get(rowKey(row)) ?? []) {
    const agg = termTotals.get(entry.code) ?? { rows: 0, points: 0 };
    agg.rows += 1;
    agg.points += entry.points;
    termTotals.set(entry.code, agg);
    if (entry.points > 0) positiveMass += entry.points;
  }
}
const attribution: TermAgg[] = [...termTotals.entries()]
  .map(([code, agg]) => ({
    code,
    rowsWithTerm: agg.rows,
    totalPoints: round(agg.points, 1),
    meanWhenPresent: round(agg.points / agg.rows),
    shareOfPositivePoints: round(agg.points > 0 ? agg.points / positiveMass : 0, 4),
  }))
  .sort((a, b) => b.totalPoints - a.totalPoints);

// ---- C. cap bind rates + sensitivity ---------------------------------------
const CAPPED_CODES = [
  'gk.saves',
  'def.tackles',
  'def.interceptions',
  'def.blocks',
  'mid.defensive',
  'mid.keyPasses',
  'mid.dribbles',
  'att.shotsOn',
  'att.keyPasses',
  'att.dribbles',
];
const capBind: Record<string, { rowsWithTerm: number; bound: number; bindRate: number; meanRaw: number; meanLostToCap: number }> = {};
for (const code of CAPPED_CODES) {
  let rows = 0;
  let bound = 0;
  let rawSum = 0;
  let lost = 0;
  for (const row of dataset.rows) {
    for (const entry of ledgerByKey.get(rowKey(row)) ?? []) {
      if (entry.code !== code || entry.raw === undefined || entry.cap === undefined) continue;
      rows += 1;
      rawSum += entry.raw;
      if (entry.raw > entry.cap) {
        bound += 1;
        lost += entry.raw - entry.cap;
      }
    }
  }
  capBind[code] = {
    rowsWithTerm: rows,
    bound,
    bindRate: rows === 0 ? 0 : round(bound / rows, 4),
    meanRaw: rows === 0 ? 0 : round(rawSum / rows),
    meanLostToCap: rows === 0 ? 0 : round(lost / rows),
  };
}

const capSweep: Record<string, { overall: Stats; byPosition: Record<string, Stats>; meanDeltaVsSpec: number }> = {};
for (const k of [0.5, 1, 2]) {
  const caps = k === 1 ? DEFAULT_CAPS : scaledCaps(k);
  const all: number[] = [];
  const perPos: Record<string, number[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  let delta = 0;
  for (const row of dataset.rows) {
    if (row.stats.minutes <= 0) continue;
    const points = baseScoreOf(row, caps).points;
    all.push(points);
    if (row.feedPosition !== null) perPos[row.feedPosition].push(points);
    delta += points - (baseByKey.get(rowKey(row)) ?? 0);
  }
  capSweep[`x${k}`] = {
    overall: describe(all),
    byPosition: Object.fromEntries(positions.map((p) => [p, describe(perPos[p])])),
    meanDeltaVsSpec: round(delta / Math.max(all.length, 1)),
  };
}

// ---- D. ramp deltas vs the old cliffs (v0.5.0 P4) ---------------------------
function rampAnalysis() {
  // Mirrors scoring.ts `ramp2`: max x clamp((rate - floor) / width, 0, 1), 2 dp.
  const ramp2 = (rate: number, floor: number, width: number, max: number): number =>
    Math.round(max * Math.min(1, Math.max(0, (rate - floor) / width)) * 100) / 100;

  interface RampDelta {
    eligibleRows: number;
    rowsWithTermNow: number;
    changedRows: number;
    gainedRows: number;
    lostRows: number;
    meanDeltaOnChanged: number;
    maxGain: number;
    maxLoss: number;
    maxAbsMove: number;
  }

  const measure = (
    eligible: readonly { rate: number }[],
    oldThreshold: number,
    floor: number,
    width: number,
  ): RampDelta => {
    let changed = 0;
    let gained = 0;
    let lost = 0;
    let deltaSum = 0;
    let maxGain = 0;
    let maxLoss = 0;
    let withTerm = 0;
    for (const { rate } of eligible) {
      const oldBonus = rate >= oldThreshold ? 2 : 0;
      const newBonus = ramp2(rate, floor, width, 2);
      if (newBonus > 0) withTerm += 1;
      const delta = round(newBonus - oldBonus, 4);
      if (delta === 0) continue;
      changed += 1;
      deltaSum += delta;
      if (delta > 0) gained += 1;
      else lost += 1;
      if (delta > maxGain) maxGain = delta;
      if (delta < maxLoss) maxLoss = delta;
    }
    return {
      eligibleRows: eligible.length,
      rowsWithTermNow: withTerm,
      changedRows: changed,
      gainedRows: gained,
      lostRows: lost,
      meanDeltaOnChanged: changed === 0 ? 0 : round(deltaSum / changed),
      maxGain: round(maxGain),
      maxLoss: round(maxLoss),
      maxAbsMove: round(Math.max(maxGain, -maxLoss)),
    };
  };

  const played = dataset.rows.filter((r) => r.stats.minutes > 0);
  const duelEligible = played
    .filter((r) => r.feedPosition === 'DEF' && r.stats.duelsTotal >= 6)
    .map((r) => ({ rate: r.stats.duelsWon / r.stats.duelsTotal }));
  const passEligible = played
    .filter((r) => r.feedPosition === 'MID' && r.stats.passesTotal >= 40)
    .map((r) => ({ rate: r.stats.passesAccurate / r.stats.passesTotal }));

  return {
    duelRamp: measure(duelEligible, 0.6, 0.5, 0.2),
    passRamp: measure(passEligible, 0.88, 0.84, 0.08),
  };
}
const ramps = rampAnalysis();

// ---- E. the MID destroyer ---------------------------------------------------
const midRows = dataset.rows.filter((r) => r.feedPosition === 'MID' && r.stats.minutes >= 60);
const destroyers = midRows.filter((r) => r.stats.keyPasses === 0 && r.stats.tackles + r.stats.interceptions >= 4);
const creators = midRows.filter((r) => r.stats.keyPasses >= 2);
const midDestroyer = {
  midRows60Plus: midRows.length,
  destroyerRows: destroyers.length,
  creatorRows: creators.length,
  destroyerScore: describe(destroyers.map((r) => baseByKey.get(rowKey(r)) ?? 0)),
  creatorScore: describe(creators.map((r) => baseByKey.get(rowKey(r)) ?? 0)),
  allMidScore: describe(midRows.map((r) => baseByKey.get(rowKey(r)) ?? 0)),
  // 0.7 = the v0.5.0 MID defensive rate (P5); scoring.ts does not export it.
  defensiveCapBoundOnDestroyers: destroyers.filter((r) =>
    (r.stats.tackles + r.stats.interceptions) * 0.7 > DEFAULT_CAPS.midDefensive,
  ).length,
};

// ---- F + G. squads, generators, crowd clamps --------------------------------
const CLAMPS = [0, 0.1, 0.15, 0.25];

interface GeneratorResult {
  generator: GeneratorName;
  squads: number;
  totalsBySpec: Stats;
  unfilledSlotRate: number;
  mismatchedSlotRate: number;
  clamp: Record<string, { totals: Stats; spearmanVsUnclamped: number; pairInversionRate: number; meanAbsShift: number }>;
}

const generatorResults: GeneratorResult[] = [];

for (const generator of GENERATOR_NAMES) {
  log(`  generator ${generator}: ${N_PER_GENERATOR} squads x ${dataset.gameweeks.length} gameweeks`);

  const allTotals: number[] = [];
  let slotsExpected = 0;
  let slotsFilled = 0;
  let mismatched = 0;
  const perClamp = new Map<number, { totals: number[]; unclamped: number[] }>();
  for (const clamp of CLAMPS) perClamp.set(clamp, { totals: [], unclamped: [] });

  for (const [gwIndex, gameweek] of dataset.gameweeks.entries()) {
    // Leave-one-out form: this player's mean base score in the OTHER sampled
    // rounds of his league. Never includes the gameweek being picked for.
    const formRate = new Map<number, number>();
    {
      const sums = new Map<number, { total: number; n: number }>();
      for (const other of dataset.gameweeks) {
        if (other.key === gameweek.key) continue;
        if (other.leagueId !== gameweek.leagueId) continue;
        for (const row of other.rows) {
          if (row.stats.minutes <= 0) continue;
          const agg = sums.get(row.playerId) ?? { total: 0, n: 0 };
          agg.total += baseByKey.get(rowKey(row)) ?? 0;
          agg.n += 1;
          sums.set(row.playerId, agg);
        }
      }
      for (const [playerId, agg] of sums) formRate.set(playerId, agg.total / agg.n);
    }

    const realised = new Map<string, number>();
    for (const row of gameweek.rows) realised.set(rowKey(row), baseByKey.get(rowKey(row)) ?? 0);

    const clampFactors = new Map<number, Map<string, number>>();
    for (const clamp of CLAMPS) {
      clampFactors.set(
        clamp,
        clamp === 0
          ? new Map<string, number>()
          : crowdFactors(gameweek, baseByKey, clamp, BASE_SEED + gwIndex * 977 + Math.round(clamp * 1000)),
      );
    }

    for (let i = 0; i < N_PER_GENERATOR; i += 1) {
      const seed = BASE_SEED + gwIndex * 1_000_003 + i * 31 + generator.length * 7919;
      const squad = generateSquad(generator, { gameweek, formRate, realised }, seed);

      slotsExpected += 13;
      slotsFilled += squad.length;
      for (const pick of squad) if (pick.row.feedPosition !== pick.slot) mismatched += 1;

      const specTotal = squadTotal(squad, () => 0, DEFAULT_CAPS);
      allTotals.push(specTotal);

      for (const clamp of CLAMPS) {
        const factors = clampFactors.get(clamp)!;
        const total =
          clamp === 0 ? specTotal : squadTotal(squad, (row) => factors.get(rowKey(row)) ?? 0, DEFAULT_CAPS);
        const bucket = perClamp.get(clamp)!;
        bucket.totals.push(total);
        bucket.unclamped.push(specTotal);
      }
    }
  }

  const clampReport: GeneratorResult['clamp'] = {};
  for (const clamp of CLAMPS) {
    const bucket = perClamp.get(clamp)!;
    const shifts = bucket.totals.map((t, i) => Math.abs(t - bucket.unclamped[i]));
    clampReport[`${Math.round(clamp * 100)}%`] = {
      totals: describe(bucket.totals),
      spearmanVsUnclamped: round(spearman(bucket.unclamped, bucket.totals), 5),
      pairInversionRate: pairInversionRate(bucket.unclamped, bucket.totals, BASE_SEED + 13),
      meanAbsShift: round(shifts.reduce((a, b) => a + b, 0) / Math.max(shifts.length, 1)),
    };
  }

  generatorResults.push({
    generator,
    squads: N_PER_GENERATOR * dataset.gameweeks.length,
    totalsBySpec: describe(allTotals),
    unfilledSlotRate: round(1 - slotsFilled / slotsExpected, 5),
    mismatchedSlotRate: round(mismatched / slotsFilled, 4),
    clamp: clampReport,
  });
}

// ---- finisher reachability (a feed limit worth quantifying) -----------------
const finisherRows = dataset.rows.filter((r) => r.entryMinute !== null);
const finisherAnalysis = {
  substitutionsInSample: finisherRows.length,
  enteredBefore75: finisherRows.filter((r) => (r.entryMinute ?? 0) < 75).length,
  withAnyPost75TimedEvent: finisherRows.filter((r) =>
    r.events.some((e) => e.minute > 75 && ['goal', 'assist', 'penaltyWon', 'penaltySaved'].includes(e.kind)),
  ).length,
  byNominalPosition: Object.fromEntries(
    positions.map((p) => [
      p,
      {
        substitutions: finisherRows.filter((r) => r.feedPosition === p).length,
        withPost75TimedEvent: finisherRows.filter(
          (r) =>
            r.feedPosition === p &&
            r.events.some((e) => e.minute > 75 && ['goal', 'assist', 'penaltyWon', 'penaltySaved'].includes(e.kind)),
        ).length,
      },
    ]),
  ),
};

// ---- result -----------------------------------------------------------------
const result = {
  meta: {
    spec: 'SCORING_SPEC.md v0.5.0',
    generatedAt: new Date().toISOString(),
    seed: BASE_SEED,
    squadsPerGeneratorPerGameweek: N_PER_GENERATOR,
    gameweeks: dataset.gameweeks.length,
    playerFixtureRows: dataset.rows.length,
    season: dataset.season,
    crowdNoise: CROWD_NOISE,
  },
  perPositionAllRows: byPosition,
  perPositionPlayedOnly: byPositionPlayed,
  termAttribution: attribution,
  capBindRates: capBind,
  capSensitivity: capSweep,
  rampAnalysis: ramps,
  midDestroyer,
  finisherReachability: finisherAnalysis,
  generators: generatorResults,
};

const json = `${JSON.stringify(result, null, 2)}\n`;
if (OUT_PATH === null || OUT_PATH === undefined) {
  process.stdout.write(json);
} else {
  const target = path.isAbsolute(OUT_PATH) ? OUT_PATH : path.join(PACKAGE_ROOT, OUT_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, json);
  log(`wrote ${target}`);
}
