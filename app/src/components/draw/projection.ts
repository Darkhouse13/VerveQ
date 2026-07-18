/**
 * Round-stake arithmetic shared by the round view (Ticket F; slimmed in G3).
 *
 * The projected score BAND that used to live here (F3) is GONE from every
 * pre-decision surface: the exact numbers made the modeled player
 * near-optimally informed, which the STOP-G/G2 rulings replaced with the
 * coarse clearance signal (engine clearance.ts, rendered by ClearanceMeter).
 * Exact values appear post-resolution only. What remains here is the one
 * piece of pre-decision arithmetic that is a STAKE, not a projection.
 */

import type { DrawRules } from "@/lib/drawApi/types";

/**
 * What a bust would leave: the engine pays out cumulative × bustKeep on a
 * failed round. Floored — the result screen shows whole points, and rounding a
 * consolation payout UP would overstate what a bust actually keeps.
 */
export function bustKeepValue(cumulative: number, rules: DrawRules): number {
  return Math.floor(cumulative * rules.bustKeep);
}
