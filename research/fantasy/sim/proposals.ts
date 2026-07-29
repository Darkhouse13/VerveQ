/**
 * FS-1 Phase 4 — measured effect of each proposal.
 *
 * The report must not carry an effect size that was estimated by eye. Every
 * "if you changed X, Y becomes Z" figure in it is computed here, from the same
 * sample and the same engine, by re-deriving the affected ledger terms.
 *
 * PURE and offline, like the rest of sim/.
 *
 *   npx tsx sim/proposals.ts
 */

import { scorePlayer, DEFAULT_CAPS, type CapConfig } from '../scoring/scoring.ts';
import type { LedgerEntry } from '../scoring/types.ts';
import { loadDataset, type PlayerFixtureRow } from './dataset.ts';
import { rowKey } from './squads.ts';

function log(line = ''): void {
  process.stdout.write(`${line}\n`);
}
function pct(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}
function r3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

const dataset = loadDataset();
const played = dataset.rows.filter((r) => r.stats.minutes > 0);

const ledgers = new Map<string, readonly LedgerEntry[]>();
const bases = new Map<string, number>();
for (const row of dataset.rows) {
  const slot = row.feedPosition ?? 'MID';
  const res = scorePlayer(
    { stats: row.stats, context: row.context, events: row.events },
    { position: slot, role: 'starter' },
    slot,
    null,
    0,
    DEFAULT_CAPS,
  );
  ledgers.set(rowKey(row), res.ledger);
  bases.set(rowKey(row), res.points);
}

function termTotal(code: string): { rows: number; points: number } {
  let rows = 0;
  let points = 0;
  for (const row of played) {
    for (const e of ledgers.get(rowKey(row)) ?? []) {
      if (e.code === code) {
        rows += 1;
        points += e.points;
      }
    }
  }
  return { rows, points };
}

let positiveMass = 0;
for (const row of played) {
  for (const e of ledgers.get(rowKey(row)) ?? []) if (e.points > 0) positiveMass += e.points;
}

log('# Measured effect of each Phase 4 proposal');
log('');
log(`Sample: ${played.length} played rows. Positive point mass at spec v0.4.1: ${r3(positiveMass)}`);
log('');

// ---------------------------------------------------------------- P1 / P2

/** Share of positive mass after replacing some terms' totals with new ones. */
function reshare(changes: { code: string; newTotal: number }[], groupCodes: string[]): { newMass: number; newShare: number } {
  let newMass = positiveMass;
  for (const c of changes) {
    newMass += c.newTotal - termTotal(c.code).points;
  }
  let group = 0;
  for (const code of groupCodes) {
    const changed = changes.find((c) => c.code === code);
    group += changed ? changed.newTotal : termTotal(code).points;
  }
  return { newMass, newShare: group / newMass };
}

const min60 = termTotal('minutes.60plus');
const minU60 = termTotal('minutes.under60');
const partCodes = ['minutes.60plus', 'minutes.under60', 'minutes.subAppearance'];
let partNow = 0;
for (const c of partCodes) partNow += termTotal(c).points;

log('## P1 — 60+ minute appearance point 2 -> 1');
log('');
log(`  now : ${min60.rows} rows x 2 = ${min60.points}; 1-59 min ${minU60.rows} x 1 = ${minU60.points}`);
log(`  participation share now  : ${pct(partNow / positiveMass)}`);
const p1 = reshare([{ code: 'minutes.60plus', newTotal: min60.rows * 1 }], partCodes);
log(`  after: 60+ becomes ${min60.rows} x 1 = ${min60.rows}`);
log(`  participation share after: ${pct(p1.newShare)}   (positive mass ${r3(p1.newMass)})`);
log('');

const win = termTotal('result.win');
const draw = termTotal('result.draw');
const resCodes = ['result.win', 'result.draw'];
log('## P2 — win/draw 2/1 -> 1/0.5');
log('');
log(`  now : win ${win.rows} x 2 = ${win.points}, draw ${draw.rows} x 1 = ${draw.points}`);
log(`  team-result share now  : ${pct((win.points + draw.points) / positiveMass)}`);
const p2 = reshare(
  [
    { code: 'result.win', newTotal: win.rows * 1 },
    { code: 'result.draw', newTotal: draw.rows * 0.5 },
  ],
  resCodes,
);
log(`  team-result share after: ${pct(p2.newShare)}   (positive mass ${r3(p2.newMass)})`);
log('');

// ------------------------------------------------------------------- P3

log('## P3 — cap values that would produce a 10-20% bind rate');
log('');
log('  Percentiles of the RAW (pre-cap) value for each capped term, over rows that');
log('  carry it. A cap set at the Nth percentile binds on (100-N)% of those rows.');
log('');
const cappedCodes = [
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
] as const;
const capKeyOf: Record<string, keyof CapConfig> = {
  'gk.saves': 'gkSave',
  'def.tackles': 'defTackle',
  'def.interceptions': 'defInterception',
  'def.blocks': 'defBlock',
  'mid.defensive': 'midDefensive',
  'mid.keyPasses': 'midKeyPass',
  'mid.dribbles': 'midDribble',
  'att.shotsOn': 'attShotOn',
  'att.keyPasses': 'attKeyPass',
  'att.dribbles': 'attDribble',
};
log('  term                spec cap   p80    p85    p90    p95    max');
for (const code of cappedCodes) {
  const raws: number[] = [];
  for (const row of dataset.rows) {
    for (const e of ledgers.get(rowKey(row)) ?? []) {
      if (e.code === code && e.raw !== undefined) raws.push(e.raw);
    }
  }
  raws.sort((a, b) => a - b);
  const q = (p: number): number => (raws.length === 0 ? 0 : raws[Math.min(raws.length - 1, Math.floor(raws.length * p))]);
  const specCap = DEFAULT_CAPS[capKeyOf[code]];
  log(
    `  ${code.padEnd(18)} ${String(specCap).padStart(6)}  ${String(q(0.8)).padStart(5)}  ${String(q(0.85)).padStart(5)}  ${String(q(0.9)).padStart(5)}  ${String(q(0.95)).padStart(5)}  ${String(raws[raws.length - 1] ?? 0).padStart(5)}`,
  );
}
log('');

// ------------------------------------------------------------------- P5

log('## P5 — MID_DEFENSIVE rate 0.5 -> 0.7 (cap unchanged at 4)');
log('');
const midRows = played.filter((r) => r.feedPosition === 'MID' && r.stats.minutes >= 60);
const destroyers = midRows.filter((r) => r.stats.keyPasses === 0 && r.stats.tackles + r.stats.interceptions >= 4);
const creators = midRows.filter((r) => r.stats.keyPasses >= 2);

function midDefenceDelta(row: PlayerFixtureRow, newRate: number, cap: number): number {
  const actions = row.stats.tackles + row.stats.interceptions;
  if (actions <= 0) return 0;
  const now = Math.min(actions * 0.5, DEFAULT_CAPS.midDefensive);
  const next = Math.min(actions * newRate, cap);
  return next - now;
}

function meanOf(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function medianOf(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

for (const [label, rate, cap] of [
  ['spec (0.5, cap 4)', 0.5, 4],
  ['proposed (0.7, cap 4)', 0.7, 4],
  ['alt (0.7, cap 3)', 0.7, 3],
] as const) {
  const dScores = destroyers.map((r) => (bases.get(rowKey(r)) ?? 0) + midDefenceDelta(r, rate, cap));
  const cScores = creators.map((r) => (bases.get(rowKey(r)) ?? 0) + midDefenceDelta(r, rate, cap));
  const allMid = midRows.map((r) => (bases.get(rowKey(r)) ?? 0) + midDefenceDelta(r, rate, cap));
  const bound = midRows.filter((r) => {
    const a = r.stats.tackles + r.stats.interceptions;
    return a > 0 && a * rate > cap;
  }).length;
  const withTerm = midRows.filter((r) => r.stats.tackles + r.stats.interceptions > 0).length;
  log(
    `  ${label.padEnd(22)} destroyer mean ${r3(meanOf(dScores)).toFixed(3)} median ${r3(medianOf(dScores))} | ` +
      `creator mean ${r3(meanOf(cScores)).toFixed(3)} | gap ${r3(meanOf(cScores) - meanOf(dScores)).toFixed(3)} ` +
      `(${pct(1 - meanOf(dScores) / meanOf(cScores))} below) | all-MID mean ${r3(meanOf(allMid)).toFixed(3)} | ` +
      `cap binds ${bound}/${withTerm} = ${pct(bound / withTerm)}`,
  );
}
log('');

// ------------------------------------------------------------------- P8

log('## P8 — ATT_SHOT_ON 0.5 -> 0.7 (cap 2 -> 2.8)');
log('');
const attRows = played.filter((r) => r.feedPosition === 'ATT');
for (const [label, rate, cap] of [
  ['spec (0.5, cap 2)', 0.5, 2],
  ['proposed (0.7, cap 2.8)', 0.7, 2.8],
] as const) {
  const scores = attRows.map((r) => {
    const now = Math.min(r.stats.shotsOn * 0.5, DEFAULT_CAPS.attShotOn);
    const next = Math.min(r.stats.shotsOn * rate, cap);
    return (bases.get(rowKey(r)) ?? 0) + (next - now);
  });
  log(`  ${label.padEnd(24)} ATT mean ${r3(meanOf(scores)).toFixed(3)} median ${r3(medianOf(scores))}`);
}
log('');

// -------------------------------------------------------------------- P4

log('## P4 — replacing the two cliffs with ramps');
log('');
for (const [label, fn] of [
  [
    'DEF duels: +2 x clamp((rate-0.50)/0.20)',
    (row: PlayerFixtureRow): number => {
      if (row.feedPosition !== 'DEF' || row.stats.duelsTotal < 6) return 0;
      const rate = row.stats.duelsWon / row.stats.duelsTotal;
      const now = rate >= 0.6 ? 2 : 0;
      const ramp = 2 * Math.max(0, Math.min(1, (rate - 0.5) / 0.2));
      return ramp - now;
    },
  ],
  [
    'MID passes: +2 x clamp((comp-0.84)/0.08)',
    (row: PlayerFixtureRow): number => {
      if (row.feedPosition !== 'MID' || row.stats.passesTotal < 40) return 0;
      const comp = row.stats.passesAccurate / row.stats.passesTotal;
      const now = comp >= 0.88 ? 2 : 0;
      const ramp = 2 * Math.max(0, Math.min(1, (comp - 0.84) / 0.08));
      return ramp - now;
    },
  ],
] as const) {
  const deltas = played.map(fn).filter((d) => d !== 0);
  const gained = deltas.filter((d) => d > 0).length;
  const lost = deltas.filter((d) => d < 0).length;
  log(
    `  ${label.padEnd(42)} rows changed ${deltas.length} (gain ${gained}, lose ${lost}), ` +
      `mean change ${r3(meanOf(deltas)).toFixed(3)}, max gain ${r3(Math.max(...deltas, 0))}, max loss ${r3(Math.min(...deltas, 0))}`,
  );
}
log('');
log('  A ramp moves points to players just below the old line and away from those');
log('  just above it. The counts above are how many rows each way.');
