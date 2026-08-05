import { makeRng, mixSeed } from '../harness/rng.ts';
import type { ModeCandidate, Rng } from '../harness/types.ts';

/**
 * calib-secret — pure deduction on a random secret, zero facts.
 *
 * The third calibration adapter. `calib-trivia` and `calib-skill` validate the
 * two ends of the recall/structure axis; this one validates the **two-layer
 * hidden model** itself (see `harness/types.ts`).
 *
 * A hidden value is drawn uniformly from `RANGE` when the episode is seeded.
 * You get `PROBES` comparison probes: name a value, learn whether the secret is
 * below it, above it, or exactly it. Because every answer is a comparison, the
 * set of values still consistent with what you have been told is always a
 * contiguous interval, carried as `[lo, hi)`. Score is the information you have
 * extracted, `log2(RANGE / (hi - lo))` — zero at the start, maximal once the
 * interval is pinned to a single value.
 *
 * There is no content here whatsoever. The secret is not a fact about the world
 * that a knowledgeable player could know; it is a coin the seed flipped. So the
 * whole of the hidden state is the secret layer, `knowledgeView` resamples all
 * of it, and there are no knowable facts left over for it to preserve.
 *
 * WHY THIS ADAPTER PROVES THE FIX
 *
 * Under the R0.6 semantics the knowledge agents get the secret resampled from
 * the interval they have narrowed it to. The searching knowledge agent is then
 * drawing from exactly the same distribution as the searching blind agent, so
 * `dKnowledge` collapses to zero and **recallShare ≈ 0** — correctly reporting
 * that knowing football facts buys nothing in a deduction mode.
 *
 * Under the old semantics the knowledge agents were handed the true secret.
 * Both of them then probe it directly, collapse the interval on move one, and
 * score the maximum, while the blind agent can only bisect. That drives
 * `dSkill` to zero and `dKnowledge` to the whole gap, giving
 * **recallShare ≈ 1** — the metric calling a pure deduction mode pure recall.
 *
 * That delta between the two readings, on one unchanged adapter, is the
 * evidence that the fix does what it claims. It is asserted directly in
 * `tests/calibration.test.ts`, which runs this adapter with its `knowledgeView`
 * stripped to reproduce the old behaviour.
 */

const RANGE = 32;
const PROBES = 3;
const MAX_BITS = Math.log2(RANGE);

export interface SecretState {
  /** The secret layer, in its entirety. Drawn at init, knowable by nobody. */
  readonly secret: number;
  /** Consistent interval, inclusive lower bound. Revealed. */
  readonly lo: number;
  /** Consistent interval, exclusive upper bound. Revealed. */
  readonly hi: number;
  readonly probesLeft: number;
}

interface SecretPublic {
  readonly lo: number;
  readonly hi: number;
  readonly probesLeft: number;
  readonly range: number;
  readonly [key: string]: number;
}

interface SecretPrivate {
  readonly secret: number;
  readonly [key: string]: number;
}

/** Action = the value probed. */
export type SecretAction = number;

/** Uniform over the consistent interval — the posterior, since the prior is uniform. */
function drawSecret(rng: Rng, lo: number, hi: number): number {
  return lo + Math.min(hi - lo - 1, Math.floor(rng() * (hi - lo)));
}

export const calibSecret: ModeCandidate<SecretState, SecretAction, SecretPublic, SecretPrivate> = {
  id: 'calib-secret',
  description: 'Calibration adapter: pure deduction on a random secret, zero facts.',

  init(seed) {
    return {
      secret: drawSecret(makeRng(mixSeed(seed, 0x53c1)), 0, RANGE),
      lo: 0,
      hi: RANGE,
      probesLeft: PROBES,
    };
  },

  /**
   * Only values still consistent with the feedback so far. `lo` and `hi` are
   * both revealed, so this depends on revealed info alone — and it keeps the
   * branching factor falling as the interval narrows.
   */
  legalActions(state) {
    return Array.from({ length: state.hi - state.lo }, (_, i) => state.lo + i);
  },

  apply(state, action) {
    const next = { secret: state.secret, probesLeft: state.probesLeft - 1 };
    if (action === state.secret) return { ...next, lo: action, hi: action + 1 };
    if (state.secret < action) return { ...next, lo: state.lo, hi: action };
    return { ...next, lo: action + 1, hi: state.hi };
  },

  isTerminal(state) {
    return state.probesLeft <= 0;
  },

  /**
   * Bits extracted so far. Defined off-terminal, and deliberately so: it is
   * what lets the 1-ply agent act on the secret it believes it has, which is
   * the whole mechanism this adapter is built to expose. Given the true secret
   * it probes it and collapses the interval immediately; given a resampled one
   * it probes a uniform draw from the consistent interval, which narrows worse
   * than bisection and leaves room for `dSkill` to be positive.
   *
   * Logarithmic rather than `1 / size` on purpose. Expected information is
   * maximised by an even split, so bisection is strictly the best probe; under
   * a reciprocal score the convexity rewards lucky uneven splits and search
   * stops separating from random.
   */
  score(state) {
    return MAX_BITS - Math.log2(state.hi - state.lo);
  },

  revealed(state) {
    return { lo: state.lo, hi: state.hi, probesLeft: state.probesLeft, range: RANGE };
  },

  hidden(state) {
    return { secret: state.secret };
  },

  /** Resample the secret from the consistent interval; the interval itself is public. */
  determinize(revealed, rng) {
    return {
      secret: drawSecret(rng, revealed.lo, revealed.hi),
      lo: revealed.lo,
      hi: revealed.hi,
      probesLeft: revealed.probesLeft,
    };
  },

  /**
   * Everything hidden here is secret and nothing is a knowable fact, so this is
   * `determinize` applied to the true state's own revealed info. On a real
   * candidate the two would differ: `determinize` would also resample the
   * facts, and the gap between them is precisely what `dKnowledge` measures.
   */
  knowledgeView(state, rng) {
    return { ...state, secret: drawSecret(rng, state.lo, state.hi) };
  },

  terminalLabel(state) {
    const size = state.hi - state.lo;
    return size === 1 ? 'pinned' : `${size} left`;
  },
};
