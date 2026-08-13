/**
 * TICKET FW-PR2 Step 4 — what the price list costs to build against.
 *
 * Generates pricing/BUDGET_ANALYSIS.md from price-final.json. It reports what
 * a squad costs; it never proposes a budget. The number is an owner decision
 * and BUDGET_MODE open item 1 stays open until they make it.
 *
 * ── Legality, and the one place this is stricter than FW-1 ──
 *
 * A squad here is 13 players: an XI shaped GK 1 / DEF 3-5 / MID 2-5 / ATT 1-3
 * plus 2 finishers of any position, with at most 3 players from one club
 * (lib/fantasyConstants FORMATION_BOUNDS, PER_CLUB_CAP; the favorite club is
 * exempt from the cap — quantified in the report).
 *
 * FW-1 itself is LOOSER: `feedPosition` is "an editorial/UI hint, never a
 * build-time constraint" (schema.ts) and both modes lock all-positions-eligible,
 * so a keeper may legally fill a MID slot and the formation bounds constrain
 * slot roles rather than players. Every squad below therefore satisfies FW-1 by
 * construction — position-matched squads are a strict subset of FW-1-legal ones.
 * Matching them is what makes the bounds mean anything for a cost analysis, and
 * it is the reading the scoring spec's position-mismatch dampener rewards. The
 * report states where the two readings give different numbers.
 *
 * ── Method for the archetypes ──
 *
 * Each archetype is "the most expensive legal squad drawn from <pool>", solved
 * EXACTLY, not greedily. A greedy fill is wrong here in a way that would not be
 * visible: taking the best player available at each step can strand the club
 * cap on a club whose second and third picks were worth more than the first
 * elsewhere. The solver is a DP over clubs — the club cap is the only coupling
 * between players, so processing one club at a time with the running squad
 * composition as state is exact, and within a club taking the top-k by price
 * per (position, class) is optimal because the price is all that is being
 * summed.
 *
 * Run: npx tsx pricing/budget-analysis.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const FINAL_PATH = path.join(PRICING_DIR, 'price-final.json');
const OUT_PATH = path.join(PRICING_DIR, 'BUDGET_ANALYSIS.md');

// ── rules (mirrors app/convex/lib/fantasyConstants.ts) ──
const SQUAD_SIZE = 13;
const XI_SIZE = 11;
const FINISHERS = 2;
const PER_CLUB_CAP = 3;
const BOUNDS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 2, max: 5 },
  ATT: { min: 1, max: 3 },
} as const;

const POSITIONS = ['GK', 'DEF', 'MID', 'ATT'] as const;
type Position = (typeof POSITIONS)[number];

// state bounds: XI maximum plus the 2 finishers, which may all land on one position
const MAX_COUNT: Record<Position, number> = { GK: 3, DEF: 7, MID: 7, ATT: 5 };

const SAMPLE_SIZE = 10_000;
const SAMPLE_SEED = 20260729;

const ELITE_FLOOR = 10.0; // "elite" tier
const VALUE_BAND = { min: 5.0, max: 6.5 }; // "value" tier
const FLOOR_PRICE = 4.0;
const BALANCED_CEILING = 9.0; // archetype (d)

interface Player {
  apiFootballId: number;
  name: string;
  club: string;
  position: Position;
  pool: string;
  proxy: number | null;
  price: number;
}

/** Tie-break order between equally priced players: a top-five regular reads as
 *  a more plausible pick than a second-division promoted-cohort name or an
 *  unproxied flagged one at the same price. Cost is identical either way. */
const POOL_RANK: Record<string, number> = { topfive: 0, promoted: 1, flagged: 2 };
/** Weight of that preference in the objective. 13 players × 2 × this is 2.6e-5,
 *  far below the 0.5 price step, so it separates ties and nothing else. */
const TIE_EPSILON = 1e-6;
/** Cost equality for comparing whole compositions: loose enough to see through
 *  the tie term, tight enough that half a price step is never "equal". */
const COST_TIE_TOL = 1e-3;

const finalFile = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf-8')) as {
  manifest: { draftCommit: string; overrideCount: number; generatedAt: string };
  players: Player[];
};
const PLAYERS = finalFile.players;
// FW-REPRICE-2 re-cut (2026-08-14): 2,895 before.
if (PLAYERS.length !== 2_953) throw new Error(`STOP: ${PLAYERS.length} players, expected 2953`);

const CLUBS = [...new Set(PLAYERS.map((p) => p.club))].sort();
const clubIndex = new Map(CLUBS.map((c, i) => [c, i]));

// ── feasible squad compositions ────────────────────────────────────────────

/** Every XI shape the bounds admit: GK is pinned at 1, the rest sum to 10. */
function xiShapes(): Record<Position, number>[] {
  const shapes: Record<Position, number>[] = [];
  for (let d = BOUNDS.DEF.min; d <= BOUNDS.DEF.max; d += 1) {
    for (let m = BOUNDS.MID.min; m <= BOUNDS.MID.max; m += 1) {
      for (let a = BOUNDS.ATT.min; a <= BOUNDS.ATT.max; a += 1) {
        if (1 + d + m + a === XI_SIZE) shapes.push({ GK: 1, DEF: d, MID: m, ATT: a });
      }
    }
  }
  return shapes;
}
const XI_SHAPES = xiShapes();

/**
 * The squad-level position counts that some legal XI + 2 free finishers can
 * produce. The finishers are unconstrained by the XI's shape (FW-1 STOP-3), so
 * this is every XI shape plus every way of distributing 2 more players.
 */
function feasibleSquadCounts(): Record<Position, number>[] {
  const seen = new Set<string>();
  const out: Record<Position, number>[] = [];
  for (const xi of XI_SHAPES) {
    for (const f1 of POSITIONS) {
      for (const f2 of POSITIONS) {
        const counts = { ...xi };
        counts[f1] += 1;
        counts[f2] += 1;
        const key = POSITIONS.map((p) => counts[p]).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(counts);
      }
    }
  }
  return out;
}
const SQUAD_COUNTS = feasibleSquadCounts();

/**
 * How far a squad composition sits from the shape a person would build: one
 * keeper, and the outfield spread the way a 13 normally is. Used ONLY to break
 * ties between compositions of identical cost — it never changes a total.
 */
const CONVENTIONAL: Record<Position, number> = { GK: 1, DEF: 4.5, MID: 4.5, ATT: 3 };
function shapeDistance(counts: Record<Position, number>): number {
  // A second keeper is the single most implausible thing a tie can produce, so
  // it is weighted well above the outfield spread.
  return POSITIONS.reduce(
    (sum, p) => sum + (p === 'GK' ? 100 : 1) * (counts[p] - CONVENTIONAL[p]) ** 2,
    0,
  );
}
const compositionKey = (counts: Record<Position, number>): string =>
  POSITIONS.map((p) => counts[p]).join('-');

/** The XI shape a squad of these counts can field (for reporting the formation). */
function xiShapeFor(counts: Record<Position, number>): Record<Position, number> | null {
  for (const xi of XI_SHAPES) {
    if (POSITIONS.every((p) => xi[p] <= counts[p])) return xi;
  }
  return null;
}

// ── exact solver ───────────────────────────────────────────────────────────
//
// DP over clubs. State = (players taken from class A, GK, DEF, MID, ATT taken).
// Class A exists so an archetype can demand "exactly N from this pool and the
// rest from that one" (the elite-core builds); single-pool archetypes leave it
// empty. Within one club the best k picks of a (position, class) are simply its
// k highest prices, so a club's contribution is a lookup, not a search.

const CLASS_COUNT = 2;
const A_MAX = 3; // no archetype needs more than 3 from the restricted pool
const STATE_STRIDE = {
  A: (MAX_COUNT.GK + 1) * (MAX_COUNT.DEF + 1) * (MAX_COUNT.MID + 1) * (MAX_COUNT.ATT + 1),
  GK: (MAX_COUNT.DEF + 1) * (MAX_COUNT.MID + 1) * (MAX_COUNT.ATT + 1),
  DEF: (MAX_COUNT.MID + 1) * (MAX_COUNT.ATT + 1),
  MID: MAX_COUNT.ATT + 1,
  ATT: 1,
};
const STATE_SIZE = (A_MAX + 1) * STATE_STRIDE.A;

const stateIndex = (a: number, g: number, d: number, m: number, t: number): number =>
  a * STATE_STRIDE.A + g * STATE_STRIDE.GK + d * STATE_STRIDE.DEF + m * STATE_STRIDE.MID + t;

/** All (per position × class) pick counts a single club can contribute. */
interface Transition {
  /** counts[class][positionIndex] */
  counts: number[][];
  total: number;
  aTotal: number;
  delta: Record<Position, number>;
}
function enumerateTransitions(cap: number): Transition[] {
  const out: Transition[] = [];
  const slots = CLASS_COUNT * POSITIONS.length; // 8 categories
  const pick: number[] = new Array(slots).fill(0);
  const recurse = (i: number, remaining: number): void => {
    if (i === slots) {
      const counts = [
        pick.slice(0, POSITIONS.length),
        pick.slice(POSITIONS.length, 2 * POSITIONS.length),
      ];
      const delta = { GK: 0, DEF: 0, MID: 0, ATT: 0 } as Record<Position, number>;
      let legal = true;
      POSITIONS.forEach((p, pi) => {
        delta[p] = counts[0][pi] + counts[1][pi];
        if (delta[p] > MAX_COUNT[p]) legal = false;
      });
      if (!legal) return; // more from one club at a position than a squad can hold
      out.push({ counts, total: cap - remaining, aTotal: counts[0].reduce((s, n) => s + n, 0), delta });
      return;
    }
    for (let n = 0; n <= remaining; n += 1) {
      pick[i] = n;
      recurse(i + 1, remaining - n);
    }
    pick[i] = 0;
  };
  recurse(0, cap);
  return out;
}

/**
 * How many players the sweep lets the FAVORITE club supply. The exemption is
 * unbounded in the rules, but a table enumerating all 13 is enormous and no
 * plausible squad wants 7 from one club; 6 is the bound, and the solver
 * asserts the optimum does not sit on it (if it ever did, the bound would be
 * shaping the answer and would have to be raised).
 */
const EXEMPT_MAX = 6;

const transitionCache = new Map<number, Transition[]>();
function transitionsForCap(cap: number): Transition[] {
  const cached = transitionCache.get(cap);
  if (cached !== undefined) return cached;
  const table = enumerateTransitions(cap);
  transitionCache.set(cap, table);
  return table;
}
const TRANSITIONS = transitionsForCap(PER_CLUB_CAP);

interface SolveArgs {
  /** Pool A ("restricted") and pool B ("fill"). A player in neither is unusable. */
  classOf: (p: Player) => 0 | 1 | null;
  /** Exact number of players that must come from class A. */
  aRequired: number;
  /** Squad composition filter — every feasible composition unless narrowed. */
  countsAllowed?: (counts: Record<Position, number>) => boolean;
  /** Which club, if any, is exempt from the cap (favorite-club exemption). */
  exemptClub?: string | null;
  minimise?: boolean;
}
interface Solution {
  total: number;
  players: Player[];
  counts: Record<Position, number>;
}

function solve(args: SolveArgs): Solution | null {
  const { classOf, aRequired, countsAllowed, exemptClub = null, minimise = false } = args;
  const sign = minimise ? -1 : 1;
  const NEG = -Infinity;

  // club -> class -> position -> prices, best first
  const byClub: Player[][][][] = CLUBS.map(() =>
    Array.from({ length: CLASS_COUNT }, () => POSITIONS.map(() => [] as Player[])),
  );
  for (const p of PLAYERS) {
    const cls = classOf(p);
    if (cls === null) continue;
    byClub[clubIndex.get(p.club) as number][cls][POSITIONS.indexOf(p.position)].push(p);
  }
  for (const club of byClub) {
    for (const cls of club) {
      // Price decides; everything after it only makes the tie deterministic and
      // readable. Prices are half-steps, so ties are everywhere — 1,279 players
      // share the 4.0 floor — and an arbitrary winner would make the printed
      // squads look like solver output rather than squads.
      for (const list of cls) {
        list.sort(
          (x, y) =>
            sign * (y.price - x.price) ||
            POOL_RANK[x.pool] - POOL_RANK[y.pool] ||
            (y.proxy ?? -1) - (x.proxy ?? -1) ||
            x.name.localeCompare(y.name),
        );
      }
    }
  }

  let current = new Float64Array(STATE_SIZE).fill(NEG);
  current[stateIndex(0, 0, 0, 0, 0)] = 0;
  const parents: Int32Array[] = [];
  const choices: Int32Array[] = [];

  CLUBS.forEach((clubName, ci) => {
    const next = new Float64Array(STATE_SIZE).fill(NEG);
    const parent = new Int32Array(STATE_SIZE).fill(-1);
    const choice = new Int32Array(STATE_SIZE).fill(-1);
    const cap = clubName === exemptClub ? EXEMPT_MAX : PER_CLUB_CAP;
    const transitions = transitionsForCap(cap);

    // Precompute this club's gain for every transition, or null when it asks
    // for more players than the club actually has.
    const gains: (number | null)[] = transitions.map((t) => {
      let gain = 0;
      for (let cls = 0; cls < CLASS_COUNT; cls += 1) {
        for (let pi = 0; pi < POSITIONS.length; pi += 1) {
          const want = t.counts[cls][pi];
          if (want === 0) continue;
          const list = byClub[ci][cls][pi];
          if (list.length < want) return null;
          for (let k = 0; k < want; k += 1) {
            // Cost, plus a tie-break the cost can never notice. Prices are
            // half-steps and a squad is 13 players, so the whole tie term is
            // bounded by 2.6e-5 — it can only ever separate exact ties, which
            // is why an equally-priced top-five regular beats a promoted-cohort
            // name across clubs as well as within one.
            gain += sign * list[k].price + TIE_EPSILON * (2 - POOL_RANK[list[k].pool]);
          }
        }
      }
      return gain;
    });

    for (let s = 0; s < STATE_SIZE; s += 1) {
      const base = current[s];
      if (base === NEG) continue;
      const a = Math.floor(s / STATE_STRIDE.A);
      const rest = s % STATE_STRIDE.A;
      const g = Math.floor(rest / STATE_STRIDE.GK);
      const d = Math.floor((rest % STATE_STRIDE.GK) / STATE_STRIDE.DEF);
      const m = Math.floor((rest % STATE_STRIDE.DEF) / STATE_STRIDE.MID);
      const t = rest % STATE_STRIDE.MID;

      for (let ti = 0; ti < transitions.length; ti += 1) {
        const gain = gains[ti];
        if (gain === null) continue;
        const tr = transitions[ti];
        const na = a + tr.aTotal;
        if (na > A_MAX || na > aRequired) continue;
        const ng = g + tr.delta.GK;
        const nd = d + tr.delta.DEF;
        const nm = m + tr.delta.MID;
        const nt = t + tr.delta.ATT;
        if (ng > MAX_COUNT.GK || nd > MAX_COUNT.DEF || nm > MAX_COUNT.MID || nt > MAX_COUNT.ATT) continue;
        if (ng + nd + nm + nt > SQUAD_SIZE) continue;
        const value = base + gain;
        const ns = stateIndex(na, ng, nd, nm, nt);
        if (value > next[ns]) {
          next[ns] = value;
          parent[ns] = s;
          choice[ns] = ti;
        }
      }
    }

    parents.push(parent);
    choices.push(choice);
    current = next;
  });

  // Best terminal state over the allowed compositions. Cost decides; among
  // compositions that tie on cost the most conventional shape wins, so a
  // floor-fill squad does not come back carrying three goalkeepers because
  // every 4.0 player was worth the same to the objective.
  let bestValue = NEG;
  for (const counts of SQUAD_COUNTS) {
    if (countsAllowed && !countsAllowed(counts)) continue;
    const s = stateIndex(aRequired, counts.GK, counts.DEF, counts.MID, counts.ATT);
    if (current[s] !== NEG && current[s] > bestValue) bestValue = current[s];
  }
  if (bestValue === NEG) return null;

  const tied = SQUAD_COUNTS.filter((counts) => {
    if (countsAllowed && !countsAllowed(counts)) return false;
    const s = stateIndex(aRequired, counts.GK, counts.DEF, counts.MID, counts.ATT);
    return current[s] !== NEG && Math.abs(current[s] - bestValue) < COST_TIE_TOL;
  }).sort((x, y) => shapeDistance(x) - shapeDistance(y) || compositionKey(x).localeCompare(compositionKey(y)));

  const bestCounts = tied[0];
  const bestState = stateIndex(aRequired, bestCounts.GK, bestCounts.DEF, bestCounts.MID, bestCounts.ATT);

  // walk the choices back out
  const picked: Player[] = [];
  let s = bestState;
  for (let ci = CLUBS.length - 1; ci >= 0; ci -= 1) {
    const ti = choices[ci][s];
    if (ti >= 0) {
      const tr = transitionsForCap(CLUBS[ci] === exemptClub ? EXEMPT_MAX : PER_CLUB_CAP)[ti];
      for (let cls = 0; cls < CLASS_COUNT; cls += 1) {
        for (let pi = 0; pi < POSITIONS.length; pi += 1) {
          const want = tr.counts[cls][pi];
          for (let k = 0; k < want; k += 1) {
            picked.push(byClub[ci][cls][pi][k]);
          }
        }
      }
    }
    s = parents[ci][s];
  }

  const total = picked.reduce((sum, p) => sum + p.price, 0);
  // The DP value carries the tie term; stripping it is a round to the 0.5 grid,
  // which is exact because the term is orders of magnitude below one step.
  const optimum = Math.round(sign * bestValue * 2) / 2;
  if (Math.abs(total - optimum) > 1e-6) {
    throw new Error(`STOP: reconstruction ${total} != DP optimum ${optimum}`);
  }
  return { total, players: picked, counts: bestCounts };
}

// ── legality gate (every reported squad passes this) ───────────────────────

function assertLegal(label: string, squad: Player[], exemptClub: string | null = null): void {
  const fail = (why: string): never => {
    throw new Error(`STOP: ${label} is not legal — ${why}`);
  };
  if (squad.length !== SQUAD_SIZE) fail(`${squad.length} players`);
  if (new Set(squad.map((p) => p.apiFootballId)).size !== SQUAD_SIZE) fail('duplicate player');

  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of squad) counts[p.position] += 1;
  const xi = xiShapeFor(counts);
  if (xi === null) fail(`no legal XI fits ${JSON.stringify(counts)}`);
  const finishers = POSITIONS.reduce((s, p) => s + (counts[p] - (xi as Record<Position, number>)[p]), 0);
  if (finishers !== FINISHERS) fail(`${finishers} finishers`);

  const perClub = new Map<string, number>();
  for (const p of squad) perClub.set(p.club, (perClub.get(p.club) ?? 0) + 1);
  for (const [club, n] of perClub) {
    if (n > PER_CLUB_CAP && club !== exemptClub) fail(`${n} players from ${club}`);
  }
}

// ── random legal squads ────────────────────────────────────────────────────

/** mulberry32 — a small, seedable PRNG, so the percentiles below are exactly
 *  reproducible from the seed printed in the report. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SampleResult {
  costs: number[];
  attempts: number;
  accepted: number;
}

function sampleSquads(n: number, seed: number): SampleResult {
  const rand = mulberry32(seed);
  const pools: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of PLAYERS) pools[p.position].push(p);

  const costs: number[] = [];
  let attempts = 0;
  while (costs.length < n) {
    attempts += 1;
    const xi = XI_SHAPES[Math.floor(rand() * XI_SHAPES.length)];
    const want = { ...xi };
    for (let f = 0; f < FINISHERS; f += 1) {
      want[POSITIONS[Math.floor(rand() * POSITIONS.length)]] += 1;
    }

    const squad: Player[] = [];
    const perClub = new Map<string, number>();
    let ok = true;
    for (const position of POSITIONS) {
      const pool = pools[position];
      const chosen = new Set<number>();
      for (let k = 0; k < want[position]; k += 1) {
        let idx = Math.floor(rand() * pool.length);
        let guard = 0;
        while (chosen.has(idx)) {
          idx = Math.floor(rand() * pool.length);
          if ((guard += 1) > 1000) break;
        }
        chosen.add(idx);
        const player = pool[idx];
        const used = (perClub.get(player.club) ?? 0) + 1;
        if (used > PER_CLUB_CAP) {
          ok = false;
          break;
        }
        perClub.set(player.club, used);
        squad.push(player);
      }
      if (!ok) break;
    }
    if (!ok || squad.length !== SQUAD_SIZE) continue;
    costs.push(squad.reduce((s, p) => s + p.price, 0));
  }
  return { costs, attempts, accepted: costs.length };
}

/** Nearest-rank percentile — no interpolation, so every figure quoted is a
 *  cost some sampled squad actually had. */
function percentile(sorted: number[], q: number): number {
  const rank = Math.max(1, Math.ceil(q * sorted.length));
  return sorted[rank - 1];
}

// ── build the archetypes ───────────────────────────────────────────────────

const isElite = (p: Player): boolean => p.price >= ELITE_FLOOR;
const isValue = (p: Player): boolean => p.price >= VALUE_BAND.min && p.price <= VALUE_BAND.max;
const isFloor = (p: Player): boolean => p.price === FLOOR_PRICE;

const cheapest = solve({ classOf: () => 1, aRequired: 0, minimise: true });
const maxStars = solve({ classOf: () => 1, aRequired: 0 });
const twoElite = solve({
  classOf: (p) => (isElite(p) ? 0 : isValue(p) ? 1 : null),
  aRequired: 2,
});
const threeElite = solve({
  classOf: (p) => (isElite(p) ? 0 : isFloor(p) ? 1 : null),
  aRequired: 3,
});
const balanced = solve({
  classOf: (p) => (p.price <= BALANCED_CEILING ? 1 : null),
  aRequired: 0,
});

const builds: { key: string; label: string; definition: string; solution: Solution }[] = [];
const push = (key: string, label: string, definition: string, s: Solution | null): void => {
  if (s === null) throw new Error(`STOP: ${label} has no legal squad`);
  assertLegal(label, s.players);
  builds.push({ key, label, definition, solution: s });
};

push('cheapest', 'Cheapest legal squad', 'the minimum-cost legal 13.', cheapest);
push('a', '(a) max-stars', 'the most expensive legal squad — no restriction.', maxStars);
push(
  'b',
  '(b) two-elite core + value fill',
  `exactly 2 players priced ≥ ${ELITE_FLOOR.toFixed(1)}, the other 11 from the value band ${VALUE_BAND.min.toFixed(1)}–${VALUE_BAND.max.toFixed(1)}; maximised.`,
  twoElite,
);
push(
  'c',
  '(c) three-elite core + floor fill',
  `exactly 3 players priced ≥ ${ELITE_FLOOR.toFixed(1)}, the other 10 at the ${FLOOR_PRICE.toFixed(1)} floor; maximised.`,
  threeElite,
);
push(
  'd',
  '(d) balanced, nobody above 9.0',
  `the most expensive legal squad in which no player is priced above ${BALANCED_CEILING.toFixed(1)}.`,
  balanced,
);

// favorite-club exemption: the cap is the binding constraint on max-stars, so
// quantify how far one uncapped club moves it.
let bestExempt: { club: string; solution: Solution; fromClub: number } | null = null;
let deepestExemptUse = 0;
for (const club of CLUBS) {
  const s = solve({ classOf: () => 1, aRequired: 0, exemptClub: club });
  if (s === null) continue;
  const fromClub = s.players.filter((p) => p.club === club).length;
  deepestExemptUse = Math.max(deepestExemptUse, fromClub);
  if (fromClub === EXEMPT_MAX) {
    throw new Error(
      `STOP: the exemption sweep hit its ${EXEMPT_MAX}-from-one-club bound at ${club}; raise EXEMPT_MAX before trusting the figure`,
    );
  }
  if (bestExempt === null || s.total > bestExempt.solution.total) bestExempt = { club, solution: s, fromClub };
}
if (bestExempt === null) throw new Error('STOP: no exempt-club solution');
assertLegal('max-stars with favorite-club exemption', bestExempt.solution.players, bestExempt.club);

const exemptionGain = bestExempt.solution.total - (maxStars as Solution).total;
/** Clubs already supplying the full 3 in the capped max-stars squad — the only
 *  clubs where an exemption could bite at all. */
const cappedClubs = (() => {
  const perClub = new Map<string, number>();
  for (const p of (maxStars as Solution).players) perClub.set(p.club, (perClub.get(p.club) ?? 0) + 1);
  return [...perClub.entries()].filter(([, n]) => n >= PER_CLUB_CAP).map(([club]) => club);
})();

/**
 * Max-stars under FW-1's own reading, where position never constrains a pick
 * and only the club cap does. Greedy by price is exact here: "at most 3 per
 * club" is a partition matroid, and greedy is optimal on a matroid.
 */
function unmatchedMaxStars(): Player[] {
  const perClub = new Map<string, number>();
  const squad: Player[] = [];
  const ordered = [...PLAYERS].sort(
    (a, b) =>
      b.price - a.price ||
      POOL_RANK[a.pool] - POOL_RANK[b.pool] ||
      (b.proxy ?? -1) - (a.proxy ?? -1) ||
      a.name.localeCompare(b.name),
  );
  for (const p of ordered) {
    if (squad.length === SQUAD_SIZE) break;
    const used = perClub.get(p.club) ?? 0;
    if (used >= PER_CLUB_CAP) continue;
    perClub.set(p.club, used + 1);
    squad.push(p);
  }
  return squad;
}
const unmatched = unmatchedMaxStars();
const unmatchedTotal = unmatched.reduce((s, p) => s + p.price, 0);
const unmatchedShape = POSITIONS.map((p) => `${unmatched.filter((x) => x.position === p).length} ${p}`).join(' / ');

const sample = sampleSquads(SAMPLE_SIZE, SAMPLE_SEED);
const sorted = [...sample.costs].sort((a, b) => a - b);
const p25 = percentile(sorted, 0.25);
const p50 = percentile(sorted, 0.5);
const p75 = percentile(sorted, 0.75);
const mean = sorted.reduce((s, c) => s + c, 0) / sorted.length;

// ── the cap table ──────────────────────────────────────────────────────────

const archetypeBuilds = builds.filter((b) => b.key !== 'cheapest');
const lowest = Math.min(...archetypeBuilds.map((b) => b.solution.total));
const highest = Math.max(...archetypeBuilds.map((b) => b.solution.total));
const capFrom = Math.floor(lowest / 2.5) * 2.5;
const capTo = Math.ceil(highest / 2.5) * 2.5;
const caps: number[] = [];
for (let c = capFrom; c <= capTo + 1e-9; c += 2.5) caps.push(Number(c.toFixed(1)));

// ── report ─────────────────────────────────────────────────────────────────

const fmt = (n: number): string => n.toFixed(1);
const squadTable = (s: Solution): string => {
  const rows = [...s.players].sort(
    (a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) || b.price - a.price || a.name.localeCompare(b.name),
  );
  const xi = xiShapeFor(s.counts) as Record<Position, number>;
  const used: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const lines = rows.map((p) => {
    used[p.position] += 1;
    const role = used[p.position] <= xi[p.position] ? 'XI' : 'finisher';
    return `| ${p.position} | ${p.name} | ${p.club} | ${fmt(p.price)} | ${role} |`;
  });
  return ['| Pos | Player | Club | Price | Slot |', '| --- | --- | --- | --- | --- |', ...lines].join('\n');
};
const formationOf = (s: Solution): string => {
  const xi = xiShapeFor(s.counts) as Record<Position, number>;
  return `${xi.DEF}-${xi.MID}-${xi.ATT}`;
};
const clubSpread = (s: Solution): string => {
  const perClub = new Map<string, number>();
  for (const p of s.players) perClub.set(p.club, (perClub.get(p.club) ?? 0) + 1);
  return [...perClub.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([club, n]) => `${club} ${n}`)
    .join(', ');
};

const histogram = (): string => {
  const counts = new Map<number, number>();
  for (const p of PLAYERS) counts.set(p.price, (counts.get(p.price) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([price, n]) => `| ${fmt(price)} | ${n} |`)
    .join('\n');
};

const capRow = (cap: number): string => {
  const permits = archetypeBuilds.filter((b) => b.solution.total <= cap + 1e-9).map((b) => b.key);
  const note =
    permits.length === 0
      ? 'none at full strength'
      : permits.map((k) => `(${k})`).join(', ');
  return `| ${fmt(cap)} | ${note} | ${permits.length} of ${archetypeBuilds.length} |`;
};

const md = `# FW-PR2 — Budget analysis (owner decision artifact)

_Generated ${new Date().toISOString()} from \`price-final.json\` (draft commit \`${finalFile.manifest.draftCommit.slice(0, 7)}\`, ${finalFile.manifest.overrideCount} owner overrides applied). Method: \`pricing/budget-analysis.ts\`._

**This document does not recommend a budget.** It reports what squads cost at
the prices now seeded, so the number can be chosen against evidence. Setting it
means replacing \`PLACEHOLDER_PENDING_PRICING_PASS\` in
\`app/convex/lib/fantasyConstants.ts\`; BUDGET_MODE open item 1 stays open until
that happens.

## What counts as legal here

A squad is ${SQUAD_SIZE} players: an XI shaped **GK 1 / DEF 3–5 / MID 2–5 / ATT 1–3**
plus **2 finishers of any position**, with at most **${PER_CLUB_CAP} players from one club**
(\`FORMATION_BOUNDS\`, \`PER_CLUB_CAP\`). Every squad below was checked against
that definition before it was printed.

One deliberate difference from FW-1, stated because it moves numbers. FW-1 does
**not** constrain which position a player may fill: \`feedPosition\` is "an
editorial/UI hint, never a build-time constraint" (schema.ts) and both modes
lock all-positions-eligible, so the formation bounds govern **slot roles**, not
players. This analysis matches each player to a slot of his own position, which
is **stricter** — so every squad here is FW-1-legal by construction, while some
FW-1-legal squads cost more than anything below.

It bites at exactly one end. Under FW-1's own reading the dearest legal ${SQUAD_SIZE} is
simply the ${SQUAD_SIZE} most expensive players the club cap allows — **${fmt(unmatchedTotal)}**, shaped
${unmatchedShape}, because no keeper and no back three are required. That is **${fmt(unmatchedTotal - (maxStars as Solution).total)} above**
the position-matched max-stars below, and it is the true ceiling a budget has to
survive if the build screen enforces nothing about position. It does not move
the floor: the cheapest legal squad is ${fmt((cheapest as Solution).total)} either way, since the floor is
crowded in every position. The position-matched figures are the ones the rest of
this document uses, because the scoring spec's position-mismatch dampener is
what makes a keeper-less XI a bad squad rather than an illegal one — but if the
budget is meant to be the only thing standing between a user and that ${fmt(unmatchedTotal)}
squad, it is the number to price against.

**Favorite-club exemption.** The cap is uncapped for the user's favorite club
(DRAFT_ROOM §Favorite-club exemption, ledger item 8, extended to budget mode).
That relaxation can only bind where a squad wants a 4th player from one club,
which is rarer than it sounds — it is measured against max-stars below.

## Cheapest legal squad

**${fmt((cheapest as Solution).total)}** — ${SQUAD_SIZE} players at the ${fmt(FLOOR_PRICE)} floor. The floor is
crowded (${PLAYERS.filter(isFloor).length} players, ${((PLAYERS.filter(isFloor).length / PLAYERS.length) * 100).toFixed(1)}% of the universe), so no club-cap or
position pressure applies at the bottom: a legal ${SQUAD_SIZE} at the floor exists in every
formation. Any budget at or above ${fmt((cheapest as Solution).total)} is buildable; below it, nothing is.

## Random legal squads (${SAMPLE_SIZE.toLocaleString('en-US')}, seeded)

| Statistic | Cost |
| --- | --- |
| minimum sampled | ${fmt(sorted[0])} |
| 25th percentile | **${fmt(p25)}** |
| 50th percentile (median) | **${fmt(p50)}** |
| 75th percentile | **${fmt(p75)}** |
| mean | ${fmt(mean)} |
| maximum sampled | ${fmt(sorted[sorted.length - 1])} |

**Method, exactly.** PRNG mulberry32 seeded \`${SAMPLE_SEED}\`; re-running
\`budget-analysis.ts\` reproduces these figures to the digit. Each draw: pick one
of the ${XI_SHAPES.length} legal XI shapes uniformly; give each of the 2 finishers a position
drawn uniformly from the four; then draw that many distinct players uniformly
from each position's pool. A draw that would put a 4th player at one club is
discarded whole and redrawn — ${sample.attempts.toLocaleString('en-US')} draws produced ${sample.accepted.toLocaleString('en-US')} squads
(${((sample.accepted / sample.attempts) * 100).toFixed(1)}% accepted). Percentiles are nearest-rank, so each is a cost some
sampled squad actually had.

**Read this as a floor-weighted null model, not as user behaviour.** Uniform
sampling over players is not uniform over squads a person would build: ${((PLAYERS.filter(isFloor).length / PLAYERS.length) * 100).toFixed(0)}% of the
universe sits at ${fmt(FLOOR_PRICE)}, so a random squad is mostly floor players and the
percentiles land far below every archetype. A budget set at the median here
would price out every shape in the next section.

## Archetype builds

${archetypeBuilds
  .map(
    (b) => `### ${b.label} — **${fmt(b.solution.total)}**

_Definition: ${b.definition}_ Formation ${formationOf(b.solution)} (+2 finishers). Clubs: ${clubSpread(b.solution)}.

${squadTable(b.solution)}
`,
  )
  .join('\n')}
### Max-stars under the favorite-club exemption

${
  exemptionGain > 1e-9
    ? `With **${bestExempt.club}** as the favorite club (the exemption worth most at these
prices), max-stars rises from **${fmt((maxStars as Solution).total)}** to **${fmt(bestExempt.solution.total)}** — a ${fmt(exemptionGain)} swing from being
allowed a 4th player there. A cap chosen against the capped figure alone is a
cap a favorite-club user can outbuild by that margin.

${squadTable(bestExempt.solution)}`
    : `**The exemption does not raise max-stars at all.** Every one of the ${CLUBS.length} clubs was
re-solved with its cap lifted (up to ${EXEMPT_MAX} players from it); the best result any of
them produced is ${fmt(bestExempt.solution.total)}, identical to the capped figure. ${cappedClubs.length === 0 ? 'No club even reaches 3 players in the max-stars squad' : `${cappedClubs.join(', ')} ${cappedClubs.length === 1 ? 'is the only club' : 'are the only clubs'} at the cap in that squad`}, and a 4th player from there cannot be added without dropping
one of the squad's position minima — the GK and the 3 DEF are what bind at the
top of the market, not the club cap.

That is a statement about **max-stars only**. The exemption still matters to a
user who wants four players from one club at any other price level, and it still
has to be honoured by the rules engine; it just does not move the ceiling a
budget has to be set against.`
}

## Candidate budget caps

Each cap is annotated with the archetypes it permits **at full strength** — that
is, caps at or above the archetype's own cost above. A cap below an archetype's
cost still admits weaker squads of the same shape (a two-elite core with cheaper
elites, say); what it forbids is the strongest version of it.

| Cap | Permits at full strength | Count |
| --- | --- | --- |
${caps.map(capRow).join('\n')}

Archetype costs for reference: ${archetypeBuilds.map((b) => `${b.key} ${fmt(b.solution.total)}`).join(' · ')}. The cheapest legal squad is ${fmt((cheapest as Solution).total)}, and the current
placeholder in code is 100.0.

## Price distribution (all ${PLAYERS.length.toLocaleString('en-US')} players)

| Price | Players |
| --- | --- |
${histogram()}
`;

fs.writeFileSync(OUT_PATH, md);

console.log(`XI shapes ${XI_SHAPES.length}, feasible squad compositions ${SQUAD_COUNTS.length}, transitions ${TRANSITIONS.length}`);
for (const b of builds) console.log(`${b.key.padEnd(9)} ${fmt(b.solution.total).padStart(6)}  ${b.label}`);
console.log(
  `exemption  ${fmt(bestExempt.solution.total).padStart(6)}  best of ${CLUBS.length} uncapped clubs (${bestExempt.club}), gain ${fmt(exemptionGain)}; deepest use of an exemption anywhere in the sweep ${deepestExemptUse} players (bound ${EXEMPT_MAX}); clubs at the cap in max-stars: ${cappedClubs.join(', ') || 'none'}`,
);
console.log(`sample p25 ${fmt(p25)} / p50 ${fmt(p50)} / p75 ${fmt(p75)} (${sample.accepted}/${sample.attempts} accepted)`);
console.log(`wrote ${path.basename(OUT_PATH)}`);
