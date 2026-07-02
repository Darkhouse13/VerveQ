/**
 * Helpers for daily challenge date handling and deterministic shuffling.
 */

/** Returns today's date as "YYYY-MM-DD" in UTC. */
export function getTodayUTC(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Milliseconds remaining until next UTC midnight. */
export function msUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow.getTime() - now.getTime();
}

/** Returns the UTC midnight timestamp for a given date string. */
export function midnightUTCTimestamp(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getTime();
}

// ── World Cup edition ──
// While the 2026 tournament runs (final: 2026-07-19), the football Daily
// Challenge draws from World Cup-themed questions across all difficulty tiers
// instead of the general intermediate pool. Shared with the frontend (tile
// labels + share text) so both sides agree on the window.

/** Last UTC date (inclusive) the World Cup edition is served. */
export const WORLD_CUP_EDITION_LAST_DATE = "2026-07-19";

export function isWorldCupEditionActive(sport: string, date: string): boolean {
  return sport === "football" && date <= WORLD_CUP_EDITION_LAST_DATE;
}

const WORLD_CUP_RE = /world[\s_]cup/i;
const CLUB_WORLD_CUP_RE = /club[\s_]world[\s_]cup/i;
// Mid-tournament, anything asserting 2026 results ("as of June 2026…",
// "reigning champion…") can go stale overnight — keep those out of the pool.
const STALE_RISK_RE =
  /2026|most recent|current(?:ly)? (?:holder|champion|winner)|reigning/i;

/**
 * Whether a question belongs in the World Cup edition pool: mentions the
 * (national-team) World Cup in its text or category, and carries no
 * stale-during-the-tournament risk. ~147 live football questions qualify.
 */
export function isWorldCupThemedQuestion(q: {
  question: string;
  category?: string;
}): boolean {
  const category = q.category ?? "";
  if (CLUB_WORLD_CUP_RE.test(q.question) || CLUB_WORLD_CUP_RE.test(category)) {
    return false;
  }
  if (!WORLD_CUP_RE.test(q.question) && !WORLD_CUP_RE.test(category)) {
    return false;
  }
  return !STALE_RISK_RE.test(q.question);
}

/**
 * Simple seeded PRNG based on a string seed.
 * Uses a basic hash → xorshift32 approach.
 */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function xorshift32(state: number): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

/**
 * Deterministic Fisher-Yates shuffle using a string seed.
 * Returns a new shuffled array (does not mutate input).
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let state = hashSeed(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    state = xorshift32(state);
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
