import { makeRng, mixSeed } from './rng.ts';
import { BOOTSTRAP_RESAMPLES } from './budget.ts';

export interface Summary {
  n: number;
  mean: number;
  sd: number;
  se: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  let total = 0;
  for (const x of xs) total += x;
  return total / xs.length;
}

/** Sample standard deviation (n - 1). Zero for n < 2. */
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return Math.sqrt(ss / (xs.length - 1));
}

export function se(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  return sd(xs) / Math.sqrt(xs.length);
}

/** Linear-interpolated quantile on the sorted sample (R type 7). */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function summarize(xs: readonly number[]): Summary {
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    n: xs.length,
    mean: mean(xs),
    sd: sd(xs),
    se: se(xs),
    median: quantile(sorted, 0.5),
    p10: quantile(sorted, 0.1),
    p90: quantile(sorted, 0.9),
    min: sorted[0] ?? NaN,
    max: sorted[sorted.length - 1] ?? NaN,
  };
}

export interface PairedDelta {
  /** mean(a) - mean(b), computed seed-by-seed. */
  mean: number;
  /** SE of the paired difference, not of the two means separately. */
  se: number;
  n: number;
}

/** Seed-paired difference. `a` and `b` must be aligned on the same seed set. */
export function pairedDelta(a: readonly number[], b: readonly number[]): PairedDelta {
  if (a.length !== b.length) {
    throw new Error(`paired arrays must align: got ${a.length} vs ${b.length}`);
  }
  const diffs = a.map((value, i) => value - b[i]);
  return { mean: mean(diffs), se: se(diffs), n: diffs.length };
}

/** Element-wise linear combination, for building composite per-seed statistics. */
export function combine(
  series: readonly (readonly number[])[],
  weights: readonly number[],
): number[] {
  const n = series[0].length;
  const out = new Array<number>(n).fill(0);
  for (let s = 0; s < series.length; s++) {
    if (series[s].length !== n) throw new Error('series lengths must align');
    for (let i = 0; i < n; i++) out[i] += weights[s] * series[s][i];
  }
  return out;
}

export interface BootstrapResult {
  se: number;
  p2_5: number;
  p97_5: number;
  /** Resamples discarded because the denominator collapsed to ~0. */
  discarded: number;
  resamples: number;
}

/**
 * Seeded bootstrap over the seed index, resampling the three agent series
 * together so the pairing survives. Used only for an interval around
 * recallShare, which is a ratio and has no clean closed-form SE.
 */
export function bootstrapRatio(
  numeratorPerSeed: readonly number[],
  denominatorPerSeed: readonly number[],
  seed: number,
): BootstrapResult {
  const n = numeratorPerSeed.length;
  const rng = makeRng(mixSeed(seed, 0xb0075));
  const shares: number[] = [];
  let discarded = 0;

  for (let b = 0; b < BOOTSTRAP_RESAMPLES; b++) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.min(n - 1, Math.floor(rng() * n));
      num += numeratorPerSeed[idx];
      den += denominatorPerSeed[idx];
    }
    if (Math.abs(den) < 1e-12) {
      discarded++;
      continue;
    }
    shares.push(num / den);
  }

  const sorted = shares.sort((a, b) => a - b);
  return {
    se: sd(sorted),
    p2_5: quantile(sorted, 0.025),
    p97_5: quantile(sorted, 0.975),
    discarded,
    resamples: BOOTSTRAP_RESAMPLES,
  };
}
