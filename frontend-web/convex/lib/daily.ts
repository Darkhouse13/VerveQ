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
