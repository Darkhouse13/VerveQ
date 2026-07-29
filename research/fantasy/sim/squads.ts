/**
 * FS-1 Phase 3 — squad generators.
 *
 * PURE and DETERMINISTIC: every generator takes an explicit seed, so a run is
 * reproducible and two runs of the same sweep are comparable. No clock, no
 * `Math.random`, no I/O.
 *
 * ── Why three, and what each one is for ──
 *
 * The calibration question is "are the constants the right size?", and a single
 * strategy cannot answer it: a formula can look perfectly balanced to a strong
 * squad and be badly skewed at the bottom. The three bracket the space.
 *
 *   random  the FLOOR. Uniform picks, slotted without regard to nominal
 *           position — a careless user. Exercises the mismatch dampener hard,
 *           which nothing else does.
 *   form    the REALISTIC middle. Weighted by each player's scoring rate in the
 *           OTHER sampled rounds of his league — leave-one-out, so it never
 *           sees the gameweek it is picking for. This is the only generator
 *           that models a user with information rather than a user with
 *           hindsight, and it is the one whose distribution the constants
 *           should really be judged against.
 *   chalk   the UPPER BAND. Samples from the top quartile of the gameweek's
 *           actual scorers, position-matched. It is explicitly NOT a user model
 *           — it has hindsight — and exists to show where the ceiling sits and
 *           which terms get you there.
 *
 * The leave-one-out construction in `form` is the load-bearing honesty here.
 * Ranking players by their points in the very gameweek being scored would make
 * every distribution look decisive and every cap look well-sized, because the
 * generator would be reading the answer sheet.
 *
 * ── Rules enforced ──
 *
 * Squad shape and the club cap come from BUDGET_MODE/DRAFT_ROOM as landed in
 * FW-1: 13 = XI + 2 finishers, formation bounds GK 1 / DEF 3-5 / MID 2-5 /
 * ATT 1-3, max 3 players per club. There is no budget constraint: prices are
 * null until the pricing pass (BUDGET_MODE open item 1), so these are crew-mode
 * squads, which carry no budget at all.
 */

import type { Slot } from '../scoring/types.ts';
import type { Gameweek, PlayerFixtureRow } from './dataset.ts';

export const SQUAD_SIZE = 13;
export const XI_SIZE = 11;
export const FINISHER_COUNT = 2;
export const PER_CLUB_CAP = 3;

export type GeneratorName = 'random' | 'form' | 'chalk';
export const GENERATOR_NAMES: readonly GeneratorName[] = ['random', 'form', 'chalk'];

export interface SquadPick {
  readonly row: PlayerFixtureRow;
  /** The slot the user FIELDED him in — what the template scores through. */
  readonly slot: Slot;
  readonly role: 'starter' | 'finisher';
}

export type Squad = readonly SquadPick[];

/**
 * Every formation the structural rule admits: GK 1, DEF 3-5, MID 2-5, ATT 1-3,
 * summing to 11. Enumerated once rather than sampled-and-rejected, so each is
 * drawn with equal probability instead of with whatever bias rejection leaves.
 */
export const FORMATIONS: readonly { DEF: number; MID: number; ATT: number }[] = (() => {
  const out: { DEF: number; MID: number; ATT: number }[] = [];
  for (let d = 3; d <= 5; d += 1) {
    for (let m = 2; m <= 5; m += 1) {
      for (let a = 1; a <= 3; a += 1) {
        if (1 + d + m + a === XI_SIZE) out.push({ DEF: d, MID: m, ATT: a });
      }
    }
  }
  return out;
})();

// ------------------------------------------------------------------------ rng

/** mulberry32 — small, fast, and good enough for sampling; seeded for replay. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndexWeighted(weights: readonly number[], random: () => number): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return Math.floor(random() * weights.length);
  let target = random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    target -= weights[i];
    if (target <= 0) return i;
  }
  return weights.length - 1;
}

// -------------------------------------------------------------------- picking

interface PickState {
  readonly used: Set<number>;
  readonly perClub: Map<string, number>;
}

function eligible(row: PlayerFixtureRow, state: PickState): boolean {
  if (state.used.has(row.playerId)) return false;
  return (state.perClub.get(String(row.clubId)) ?? 0) < PER_CLUB_CAP;
}

function commit(row: PlayerFixtureRow, state: PickState): void {
  state.used.add(row.playerId);
  const key = String(row.clubId);
  state.perClub.set(key, (state.perClub.get(key) ?? 0) + 1);
}

/**
 * Draw one eligible row from `pool`, weighted by `weightOf`.
 *
 * Returns null when the club cap has starved the pool. The caller treats that
 * as an UNFILLED slot rather than relaxing the cap — BUDGET_MODE §Deadlines
 * says an unfilled slot scores zero, and quietly breaking the cap to avoid an
 * empty slot would put an illegal squad into the distribution.
 */
function draw(
  pool: readonly PlayerFixtureRow[],
  state: PickState,
  random: () => number,
  weightOf: (row: PlayerFixtureRow) => number,
): PlayerFixtureRow | null {
  const candidates: PlayerFixtureRow[] = [];
  const weights: number[] = [];
  for (const row of pool) {
    if (!eligible(row, state)) continue;
    candidates.push(row);
    weights.push(Math.max(weightOf(row), 1e-9));
  }
  if (candidates.length === 0) return null;
  const chosen = candidates[pickIndexWeighted(weights, random)];
  commit(chosen, state);
  return chosen;
}

// --------------------------------------------------------------------- inputs

export interface GeneratorContext {
  readonly gameweek: Gameweek;
  /** Leave-one-out scoring rate per player id, from OTHER rounds. `form` only. */
  readonly formRate: ReadonlyMap<number, number>;
  /** This gameweek's realised base score per row key. `chalk` only. */
  readonly realised: ReadonlyMap<string, number>;
}

export function rowKey(row: PlayerFixtureRow): string {
  return `${row.fixtureId}:${row.playerId}`;
}

/** The 13 slots a formation implies: 11 XI slots plus 2 finisher slots. */
function slotPlan(
  formation: { DEF: number; MID: number; ATT: number },
  random: () => number,
): { slot: Slot; role: 'starter' | 'finisher' }[] {
  const plan: { slot: Slot; role: 'starter' | 'finisher' }[] = [
    { slot: 'GK', role: 'starter' },
  ];
  for (let i = 0; i < formation.DEF; i += 1) plan.push({ slot: 'DEF', role: 'starter' });
  for (let i = 0; i < formation.MID; i += 1) plan.push({ slot: 'MID', role: 'starter' });
  for (let i = 0; i < formation.ATT; i += 1) plan.push({ slot: 'ATT', role: 'starter' });

  // Finisher slotRoles are unconstrained by the XI's shape (FW-1 STOP-3), so
  // they are drawn freely from the four roles.
  const roles: Slot[] = ['GK', 'DEF', 'MID', 'ATT'];
  for (let i = 0; i < FINISHER_COUNT; i += 1) {
    plan.push({ slot: roles[Math.floor(random() * roles.length)], role: 'finisher' });
  }
  return plan;
}

// ---------------------------------------------------------------- generators

/**
 * Build one squad.
 *
 * `random` slots players without regard to nominal position; `form` and `chalk`
 * prefer a position match and only fall back to any position when the club cap
 * leaves nothing natural. That difference is deliberate — it is what makes the
 * mismatch dampener visible in the results at all.
 */
export function generateSquad(
  name: GeneratorName,
  ctx: GeneratorContext,
  seed: number,
): Squad {
  const random = rng(seed);
  const pool = ctx.gameweek.rows;
  const formation = FORMATIONS[Math.floor(random() * FORMATIONS.length)];
  const plan = slotPlan(formation, random);

  const state: PickState = { used: new Set(), perClub: new Map() };
  const picks: SquadPick[] = [];

  for (const { slot, role } of plan) {
    let chosen: PlayerFixtureRow | null = null;

    if (name === 'random') {
      chosen = draw(pool, state, random, () => 1);
    } else {
      const natural = pool.filter((r) => r.feedPosition === slot);
      const weightOf =
        name === 'form'
          ? (r: PlayerFixtureRow) => Math.max(ctx.formRate.get(r.playerId) ?? 0, 0) + 0.25
          : (r: PlayerFixtureRow) => Math.max(ctx.realised.get(rowKey(r)) ?? 0, 0) ** 2 + 0.05;

      chosen = draw(natural, state, random, weightOf);
      // Club cap starved the natural pool — widen rather than field nothing.
      if (chosen === null) chosen = draw(pool, state, random, weightOf);
    }

    if (chosen === null) continue; // unfilled slot: scores zero, never auto-filled
    picks.push({ row: chosen, slot, role });
  }

  return picks;
}

/**
 * `chalk` restricted to the gameweek's top quartile by realised score.
 *
 * Exposed separately so the report can state plainly what the generator is: a
 * hindsight probe for the ceiling, not a model of any user.
 */
export function topQuartileThreshold(
  gameweek: Gameweek,
  realised: ReadonlyMap<string, number>,
): number {
  const scores = gameweek.rows
    .map((r) => realised.get(rowKey(r)) ?? 0)
    .sort((a, b) => a - b);
  if (scores.length === 0) return 0;
  return scores[Math.floor(scores.length * 0.75)];
}
