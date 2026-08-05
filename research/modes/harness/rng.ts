import type { Rng } from './types.ts';

/**
 * mulberry32 — small, fast, adequate for Monte-Carlo rollouts and fully
 * reproducible from an integer seed.
 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Order-sensitive integer mix, for deriving sub-streams from a base seed. */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    let x = part | 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      x >>>= 8;
    }
  }
  return h >>> 0;
}

/** Uniform pick. Returns the index so callers can keep positional alignment. */
export function pickIndex(rng: Rng, length: number): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}
