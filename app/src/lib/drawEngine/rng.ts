/**
 * In-repo seeded RNG. No dependencies, no Math.random, no Date.now.
 *
 * hashString (xmur3) turns an arbitrary seed string into a well-mixed uint32;
 * mulberry32 is a small fast PRNG over that state. Both are deterministic
 * across platforms (only IEEE-754 double and uint32 ops).
 */

/** xmur3 string hash → uint32 with good avalanche behavior. */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded stream from a string seed. */
export function rngFromString(seed: string): () => number {
  return mulberry32(hashString(seed));
}

/** One deterministic draw in [0, 1) for a composite key — used for form. */
export function unitFromString(key: string): number {
  return mulberry32(hashString(key))();
}

/** Integer in [0, n) from a stream. */
export function rngInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Weighted index pick: returns i with probability weights[i] / Σ weights. */
export function rngWeighted(rng: () => number, weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/** Deterministic in-place Fisher-Yates shuffle. */
export function rngShuffle<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
