/**
 * Projected score band (Ticket F, F3).
 *
 * Benching and BANK/PUSH were decisions taken blind: nothing on screen said
 * what the five on the pitch were worth against the fixture in front of them,
 * so "sit the keeper or the winger" and "bank 400 or risk it" were coin flips.
 * This computes the range a round can land in, which is what turns both into
 * decisions.
 *
 * ── Why a band and not a number ──
 * The engine scores a round as
 *
 *   score = Σ(rating_i × form_i × fixtureMult_i) × synergyMult
 *
 * and form_i is the ONLY unknown before the round resolves: it is drawn
 * uniformly from [1-formSpread, 1+formSpread] and, by the sanitization
 * contract, never crosses the API boundary until the round has played. So the
 * exact score is unknowable here — but its bounds are not. Every other factor
 * is already revealed:
 *
 *   rating_i      — on the card face
 *   fixtureMult_i — from the fixture's modifiers, visible from board start
 *   synergyMult   — from the fielded chains, which the meters already draw
 *   formSpread    — a published rule of the game (DrawRules)
 *
 * Because each form_i is independently bounded by [1-f, 1+f], the sum is
 * bounded by (1∓f) × Σ(rating_i × fixtureMult_i) — so the band below CONTAINS
 * every realizable score, tightly (both bounds are attained in the limit). It
 * is arithmetic over already-revealed values, not a leak and not a guess:
 * drawProjectionBandContract.test.ts proves containment over mock runs.
 *
 * The band is WIDE — c13-1's formSpread is ±39%, so the high edge is ~2.3× the
 * low. That width is honest: it is exactly how much of the round the player
 * does not control, and shrinking it for looks would be a lie about the game.
 */

import { squadSynergies } from "@/lib/drawEngine";
import type { Card, EngineConfig, Fixture } from "@/lib/drawEngine";
import type { DrawRules } from "@/lib/drawApi/types";
import { cardEffect } from "./fixtureEffects";

export interface ScoreBand {
  /** Lowest realizable round score (every card draws worst-case form). */
  low: number;
  /** Highest realizable round score (every card draws best-case form). */
  high: number;
  /** Band centre — the score at neutral form (×1) across the five. */
  mid: number;
  /** Product of the granted chain multipliers on the fielded cards. */
  synergyMult: number;
}

/**
 * squadSynergies reads exactly two knobs. Narrowing to them (rather than
 * threading a whole EngineConfig into the UI, which the client is never sent)
 * keeps the ENGINE as the single implementation of chain → multiplier: the
 * grant rules, the ×1 filter, the family cap and the tie-break all stay there.
 */
function synergyConfig(rules: DrawRules): EngineConfig {
  return {
    synergyTable: rules.synergyTable,
    maxSynergyFamilies: rules.maxSynergyFamilies,
  } as EngineConfig;
}

/** Product of the multipliers the fielded cards' chains grant. */
export function fieldedSynergyMult(fielded: Card[], rules: DrawRules): number {
  let mult = 1;
  for (const s of squadSynergies(fielded, synergyConfig(rules))) mult *= s.mult;
  return mult;
}

/**
 * The band a round of `fielded` against `fixture` can land in.
 * Pure; derived only from revealed values (see the header).
 */
export function projectRound(
  fielded: Card[],
  fixture: Fixture,
  rules: DrawRules,
): ScoreBand {
  // Σ(rating × fixtureMult) — everything except form.
  let deterministic = 0;
  for (const card of fielded) {
    deterministic += card.rating * cardEffect(card, fixture).mult;
  }
  const synergyMult = fieldedSynergyMult(fielded, rules);
  const centre = deterministic * synergyMult;
  return {
    low: centre * (1 - rules.formSpread),
    high: centre * (1 + rules.formSpread),
    mid: centre,
    synergyMult,
  };
}

/** Where `value` sits across the band, 0..1 (for the threshold marker). */
export function bandFraction(band: ScoreBand, value: number): number {
  const span = band.high - band.low;
  if (span <= 0) return value >= band.high ? 1 : 0;
  return Math.min(Math.max((value - band.low) / span, 0), 1);
}

/**
 * What a bust would leave: the engine pays out cumulative × bustKeep on a
 * failed round. Floored — the result screen shows whole points, and rounding a
 * consolation payout UP would overstate what a bust actually keeps.
 */
export function bustKeepValue(cumulative: number, rules: DrawRules): number {
  return Math.floor(cumulative * rules.bustKeep);
}
