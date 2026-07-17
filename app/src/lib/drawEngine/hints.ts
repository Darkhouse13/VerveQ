/**
 * Form hints (Ticket G — engine v1.1, owner-sanctioned ADDITIVE module).
 *
 * A hint is a pre-round, design-PUBLIC signal about a card's upcoming form:
 * HOT / NEUTRAL / COLD. It is derived from the SAME seeded form draw the
 * round will realize (the u behind formFor) plus independent seeded noise,
 * so it is informative but not authoritative:
 *
 *   - trueBand(u): the tercile of the form draw — COLD (u < 1/3),
 *     NEUTRAL (1/3 ≤ u < 2/3), HOT (u ≥ 2/3).
 *   - with probability hintReliability the hint IS the true band; otherwise
 *     it is drawn uniformly from the other two bands. So hintReliability is
 *     EXACTLY P(hint band == realized form band), and the marginal hint
 *     distribution stays uniform (each band shows 1/3 of the time — a HOT
 *     tag carries no population tell).
 *
 * SANITIZATION CONTRACT. Hints are design-public BEFORE the round: they are
 * a pure function of (boardSeed, cardId, roundIndex, hintReliability) — never
 * user identity or choices — and every user sees the same hints on the same
 * board (locked decision 3, leaderboard fairness). The realized form value
 * itself remains post-resolution only: a hint narrows the posterior over
 * form bands (Bayes, below) but never reveals the draw. The noise stream is
 * seeded separately from the form stream (`|hint|` vs `|form|`), so the hint
 * adds no invertible channel beyond the designed band information.
 *
 * Everything here is pure — no I/O, no Date, no Math.random.
 */

import { rngFromString, unitFromString } from "./rng";

export type FormHint = "COLD" | "NEUTRAL" | "HOT";

/** Band order is COLD < NEUTRAL < HOT; index into this array = band index. */
export const FORM_HINT_BANDS: readonly FormHint[] = ["COLD", "NEUTRAL", "HOT"];

/** Tercile band of a form draw u ∈ [0, 1). */
export function formBandOf(u: number): FormHint {
  return u < 1 / 3 ? "COLD" : u < 2 / 3 ? "NEUTRAL" : "HOT";
}

/**
 * The pre-round hint for (card, round) on a board. Same-seed ⇒ same hint for
 * every user. `hintReliability` ∈ [0, 1]: 1 = the hint always names the true
 * band, 1/3 = fully uninformative (posterior equals the prior).
 */
export function formHint(
  boardSeed: string,
  cardId: string,
  roundIndex: number,
  hintReliability: number,
): FormHint {
  // The SAME u that formFor turns into the realized form multiplier.
  const u = unitFromString(`${boardSeed}|form|${cardId}|${roundIndex}`);
  const trueBand = formBandOf(u);
  // Independent noise stream: first draw decides truth vs lie, second picks
  // which of the other two bands a lie shows.
  const noise = rngFromString(`${boardSeed}|hint|${cardId}|${roundIndex}`);
  if (noise() < hintReliability) return trueBand;
  const trueIdx = FORM_HINT_BANDS.indexOf(trueBand);
  const offset = noise() < 0.5 ? 1 : 2;
  return FORM_HINT_BANDS[(trueIdx + offset) % 3];
}

/** E[u | band]: tercile conditional means of the uniform form draw. */
const BAND_MEAN_U: Record<FormHint, number> = {
  COLD: 1 / 6,
  NEUTRAL: 1 / 2,
  HOT: 5 / 6,
};

/**
 * Posterior mean of the form draw u given a hint (uniform prior 1/3 each;
 * P(hint | true band) = r on the diagonal, (1-r)/2 off it — Bayes gives
 * posterior r on the hinted band and (1-r)/2 on each other band).
 */
export function hintPosteriorMeanU(hint: FormHint, hintReliability: number): number {
  const m = BAND_MEAN_U[hint];
  // Σ over all three band means = 3/2, so the two off-bands contribute
  // (1-r)/2 × (3/2 − m) between them.
  return hintReliability * m + ((1 - hintReliability) * (1.5 - m)) / 2;
}

/** Posterior mean FORM multiplier given a hint, for a given formSpread. */
export function hintPosteriorForm(
  hint: FormHint,
  hintReliability: number,
  formSpread: number,
): number {
  return 1 - formSpread + 2 * formSpread * hintPosteriorMeanU(hint, hintReliability);
}
