/**
 * Weekend Fantasy — crowd voting rules (CROWD_VOTING_SPEC v1.0.1). PURE.
 *
 * The eye-test instrument: pairwise "who had the better game?" votes become a
 * per-gameweek Elo per player, whose position-group percentile maps onto the
 * crowd factor. Everything rule-shaped lives here, testable without a
 * database; the Convex modules are thin authorized wrappers.
 *
 * Two properties this module is responsible for BY CONSTRUCTION:
 *
 *   1. Every derived factor lies in [−CROWD_FACTOR_MAX, +CROWD_FACTOR_MAX].
 *      The pipeline's ±15% validator is the safety net, never the mechanism
 *      (STANDING RULE 6): nothing this module emits can be out of band,
 *      because the percentile is a bounded quantity mapped linearly onto the
 *      band's exact endpoints.
 *   2. Below the liquidity threshold the factor is exactly 0 and the player
 *      is FLAGGED (insufficient votes) — visible, not silent.
 *
 * Constants marked [placeholder] are the spec's own placeholders, LOCKED as
 * principles with numbers pending live data; they change by owner ticket.
 */

import type { SlotRole } from "./fantasyConstants";

/** Per-gameweek Elo start for every appeared player. */
export const CROWD_ELO_START = 1500;

/** Elo K-factor, one update per vote. */
export const CROWD_ELO_K = 32;

/** Fewer votes than this ⇒ factor 0, "insufficient votes". [placeholder 25] */
export const CROWD_LIQUIDITY_THRESHOLD = 25;

/** Pairs served per user per gameweek. [placeholder 300] */
export const CROWD_SERVE_CAP_PER_GAMEWEEK = 300;

/** The clamp half-width the factor maps onto. SCORING_SPEC v0.5.1 (P7). */
export const CROWD_FACTOR_MAX = 0.15;

// ── Elo ──

/** Standard Elo expectation of A beating B. */
export function eloExpectation(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** One vote's update: `aWon` is the tap. "Didn't watch" never reaches here —
 *  a costless skip produces no update and no penalty (LOCKED). */
export function eloUpdate(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
): { a: number; b: number } {
  const expectedA = eloExpectation(ratingA, ratingB);
  const scoreA = aWon ? 1 : 0;
  const delta = CROWD_ELO_K * (scoreA - expectedA);
  return { a: ratingA + delta, b: ratingB - delta };
}

// ── pair identity ──

/** Canonical pair key: order-independent, so "A vs B" and "B vs A" are the
 *  same single-use pair and the same consensus bucket. */
export function pairKeyOf(playerIdA: string, playerIdB: string): string {
  return playerIdA < playerIdB
    ? `${playerIdA}:${playerIdB}`
    : `${playerIdB}:${playerIdA}`;
}

// ── factor derivation ──

export interface CrowdRatingEntry {
  readonly playerId: string;
  /** The player's verdict position for the gameweek — the group he is
   *  percentiled WITHIN (the spec's "how good was he for his role"). */
  readonly verdictPosition: SlotRole;
  readonly rating: number;
  readonly voteCount: number;
}

export interface CrowdFactorResult {
  readonly playerId: string;
  readonly factor: number;
  /** True when voteCount < CROWD_LIQUIDITY_THRESHOLD or is not a finite
   *  number: factor is 0 and the surface says "insufficient votes" rather
   *  than nothing. */
  readonly insufficientVotes: boolean;
}

/**
 * crowd_factor = linear map of the player's final rating percentile within
 * his verdict-position group onto [−0.15, +0.15], median = 0.
 *
 * Percentile of a group of n: ranks are averaged across rating ties (two
 * equal ratings get equal factors), then rank/(n−1) ∈ [0,1]. A group of one
 * sits at the median (factor 0) rather than at an arbitrary extreme.
 *
 * Only players AT or ABOVE the liquidity threshold enter the percentile
 * population: a below-threshold player neither receives a factor nor drags
 * his neighbours' percentiles — his rating is unconsulted noise by
 * definition of the threshold.
 */
export function deriveCrowdFactors(
  entries: readonly CrowdRatingEntry[],
): CrowdFactorResult[] {
  const results: CrowdFactorResult[] = [];
  const liquid = new Map<SlotRole, CrowdRatingEntry[]>();

  for (const entry of entries) {
    // A non-finite count is not evidence of any votes at all: NaN would slip
    // past `< threshold` (NaN comparisons are false) and Infinity is no count
    // a ballot box can produce — both are below-threshold by definition.
    if (!Number.isFinite(entry.voteCount) || entry.voteCount < CROWD_LIQUIDITY_THRESHOLD) {
      results.push({ playerId: entry.playerId, factor: 0, insufficientVotes: true });
      continue;
    }
    const group = liquid.get(entry.verdictPosition) ?? [];
    group.push(entry);
    liquid.set(entry.verdictPosition, group);
  }

  for (const group of liquid.values()) {
    if (group.length === 1) {
      results.push({ playerId: group[0].playerId, factor: 0, insufficientVotes: false });
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => a.rating - b.rating || (a.playerId < b.playerId ? -1 : 1),
    );
    // Average rank across rating ties: equal performances, equal factors.
    const rankByPlayer = new Map<string, number>();
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].rating === sorted[i].rating) j += 1;
      const avgRank = (i + j) / 2;
      for (let k = i; k <= j; k += 1) rankByPlayer.set(sorted[k].playerId, avgRank);
      i = j + 1;
    }
    const span = sorted.length - 1;
    for (const entry of group) {
      const percentile = (rankByPlayer.get(entry.playerId) ?? 0) / span;
      // [0,1] → [−MAX,+MAX], exactly; nothing beyond the band is expressible.
      const factor = (percentile - 0.5) * 2 * CROWD_FACTOR_MAX;
      results.push({ playerId: entry.playerId, factor, insufficientVotes: false });
    }
  }

  return results;
}

// ── rater accuracy (the sealed second game) ──

/**
 * The majority direction of one pair's votes, or null on a tie / no votes.
 * Scored only after finality, against these frozen tallies.
 */
export function consensusOf(aVotes: number, bVotes: number): "a" | "b" | null {
  if (aVotes === bVotes) return null;
  return aVotes > bVotes ? "a" : "b";
}

/** The court's vote weight: 0.5 + rolling accuracy, so a coin-flip rater
 *  ≈ 1.0 and the best raters ≈ 1.5. A rater with no scored votes yet weighs
 *  exactly 1.0 — no history is neither trust nor distrust. */
export function raterWeightOf(accurateVotes: number, scoredVotes: number): number {
  if (scoredVotes === 0) return 1.0;
  return 0.5 + accurateVotes / scoredVotes;
}
