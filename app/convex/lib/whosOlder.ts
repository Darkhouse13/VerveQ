/**
 * WHO'S OLDER? — pure round generation (no server import, no ambient clock).
 *
 * The mode is the app twin of the Who's Older reels, the format that drives
 * most of the account's reach: two footballers, tap the older one, and the gap
 * between their birth dates SHRINKS every round — years at the start, days at
 * the end. Every birth date comes from convex/data/whos_older_players.json,
 * which admits a player only when Wikidata and Wikipedia agree to the day
 * (scripts/buildWhosOlderPool.mjs).
 *
 * The daily is deterministic per UTC date — everyone gets the same ten pairs —
 * and is FROZEN into the session row when a player starts it, so regenerating
 * the pool mid-day never moves the pairs under anyone's feet. Endless play draws
 * fresh pairs with Math.random, ramping through the same bands.
 */

import { midnightUTCTimestamp } from "./daily";

export type WhosOlderPlayer = { id: string; name: string; dob: string };
export type WhosOlderPair = { a: WhosOlderPlayer; b: WhosOlderPlayer };

export const WHOS_OLDER_DAILY_ROUNDS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const YEAR = 365;

/**
 * Gap bands in days, widest first: round n draws a pair whose birth dates sit
 * inside band n. The last band is under a month — the reel's "nine days" end.
 * A zero-day gap (same birthday) is never dealt: there would be no answer.
 */
export const GAP_BANDS: ReadonlyArray<readonly [number, number]> = [
  [10 * YEAR, Infinity],
  [6 * YEAR, 10 * YEAR],
  [4 * YEAR, 6 * YEAR],
  [3 * YEAR, 4 * YEAR],
  [2 * YEAR, 3 * YEAR],
  [YEAR, 2 * YEAR],
  [180, YEAR],
  [90, 180],
  [30, 90],
  [1, 30],
];

/**
 * The UTC day edition #1 goes live on. Editions count up by one per UTC day,
 * and the number is in every share ("Who's Older? #12"), so moving this after
 * launch renumbers every result already posted.
 */
export const WHOS_OLDER_EPOCH_DATE_KEY = "2026-09-28";

export function editionNumberForDate(dateKey: string): number {
  return (
    Math.round(
      (midnightUTCTimestamp(dateKey) - midnightUTCTimestamp(WHOS_OLDER_EPOCH_DATE_KEY)) /
        MS_PER_DAY,
    ) + 1
  );
}

// Day number per birth date, memoised: pair search compares tens of thousands
// of pairs, and re-parsing ISO dates inside that loop dominated its cost.
const dayNumberCache = new Map<string, number>();
function dayNumber(dob: string): number {
  let n = dayNumberCache.get(dob);
  if (n === undefined) {
    n = Math.round(midnightUTCTimestamp(dob) / MS_PER_DAY);
    dayNumberCache.set(dob, n);
  }
  return n;
}

export function gapDays(a: { dob: string }, b: { dob: string }): number {
  return Math.abs(dayNumber(a.dob) - dayNumber(b.dob));
}

/** "a" when a was born first. Ties never reach this (no zero-gap pairs). */
export function olderSide(pair: { a: { dob: string }; b: { dob: string } }): "a" | "b" {
  return pair.a.dob < pair.b.dob ? "a" : "b";
}

/** Deterministic PRNG in [0, 1) from a string seed (FNV-1a → mulberry32). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One pair from `pool` whose gap sits in band `bandIndex`, both players unused.
 * An empty band widens outward (one band tighter, one wider, and so on) rather
 * than failing, so a thin pool still deals a full game. Null only when fewer
 * than two unused players with distinct birthdays remain.
 */
export function pickPair(
  pool: ReadonlyArray<WhosOlderPlayer>,
  bandIndex: number,
  used: ReadonlySet<string>,
  rand: () => number,
): WhosOlderPair | null {
  const free = pool.filter((p) => !used.has(p.id));
  if (free.length < 2) return null;
  const days = free.map((p) => dayNumber(p.dob));

  for (let spread = 0; spread < GAP_BANDS.length; spread++) {
    const bands = [
      ...new Set([
        Math.max(0, bandIndex - spread),
        Math.min(GAP_BANDS.length - 1, bandIndex + spread),
      ]),
    ].map((band) => GAP_BANDS[band]);
    const candidates: Array<[number, number]> = [];
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const gap = Math.abs(days[i] - days[j]);
        if (gap === 0) continue;
        if (bands.some(([min, max]) => gap >= min && gap < max)) candidates.push([i, j]);
      }
    }
    if (candidates.length === 0) continue;
    const [i, j] = candidates[Math.floor(rand() * candidates.length)];
    const x = free[i];
    const y = free[j];
    // Which card sits on top is a coin flip, so "the top one is older" never
    // becomes a pattern.
    return rand() < 0.5 ? { a: x, b: y } : { a: y, b: x };
  }
  return null;
}

/** Today's ten pairs — identical for every player on the same UTC date. */
export function buildDailyPairs(
  pool: ReadonlyArray<WhosOlderPlayer>,
  dateKey: string,
): WhosOlderPair[] {
  const rand = seededRandom(`whos-older:${dateKey}`);
  const used = new Set<string>();
  const pairs: WhosOlderPair[] = [];
  for (let round = 0; round < WHOS_OLDER_DAILY_ROUNDS; round++) {
    const pair = pickPair(pool, round, used, rand);
    if (!pair) break;
    used.add(pair.a.id);
    used.add(pair.b.id);
    pairs.push(pair);
  }
  return pairs;
}

/**
 * Band for endless round `streak` (0-based): the daily's ramp for the first
 * ten, then it stays in the last four bands (six months down to days) — hard,
 * but still a mix, so a long run is not a string of coin flips.
 */
export function endlessBandFor(streak: number, rand: () => number): number {
  if (streak < GAP_BANDS.length) return streak;
  return GAP_BANDS.length - 4 + Math.floor(rand() * 4);
}
