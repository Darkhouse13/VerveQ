/**
 * Ticket D5 — draft-phase BOOK-VALUE projection math (STOP-G amendment).
 *
 * Named bookValue.ts, NOT draftProjection.ts, on purpose: a case-only twin of
 * the DraftProjection.tsx component would collide on case-insensitive
 * filesystems (Windows/macOS) and resolve imports to the wrong file.
 *
 * STOP-G banned exact pre-decision numbers on the ROUND-phase surfaces (the
 * clearance meter, the push/bank decision) because a precise band centre made
 * the modeled player near-optimally informed and collapsed the tension. The
 * D5 owner amendment scopes that ban to the round phase only: during the DRAFT
 * the player may see the exact, form-agnostic book value of the squad they are
 * assembling — they learn what picks are worth while drafting, then gamble
 * under the coarse meter as STOP-G intended.
 *
 * NO UI MATH: the value is the engine's own `bandMidFor` (clearance.ts) — the
 * same formless projection the clearance meter buckets — never re-implemented
 * here. Synergy is included exactly as the round will see it: bandMidFor calls
 * squadSynergies over ONLY the cards passed to it (scoring.ts), so the
 * leave-one-out best-five correctly drops the benched card's chain
 * contribution.
 */

import { bandMidFor } from "@/lib/drawEngine";
import type { Card, EngineConfig, Fixture } from "@/lib/drawEngine";
import type { DrawRules } from "@/lib/drawApi/types";

/**
 * Narrow DrawRules to just what bandMidFor reads. Ratings and fixture
 * modifiers need no config; synergy chains need the table + the family cap
 * (squadSynergies). This is the same narrowing pattern ClearanceMeter uses so
 * the ENGINE stays the single implementation of the projection.
 */
export function projectionConfig(rules: DrawRules): EngineConfig {
  return {
    synergyTable: rules.synergyTable,
    maxSynergyFamilies: rules.maxSynergyFamilies,
  } as EngineConfig;
}

/**
 * BEST-FIVE book value of the drafted squad against one fixture (D5).
 *
 * The player fields five of the six drafted cards, so the honest projection is
 * the value of the best five available:
 *   - k ≤ 5 drafted cards: bandMidFor over all of them (nothing benched yet);
 *   - k = 6: the max over the six leave-one-out fives (owner-ruled bench
 *     assumption — you keep whichever five score highest against THIS fixture).
 *
 * Returns null for an empty squad (nothing to project — the panel dashes it).
 */
export function projectBestFive(
  squad: Card[],
  fixture: Fixture,
  config: EngineConfig,
): number | null {
  if (squad.length === 0) return null;
  if (squad.length <= 5) return bandMidFor(squad, fixture, config);
  // k = 6 — best five is the highest-scoring leave-one-out (six trivial calls).
  let best = -Infinity;
  for (let i = 0; i < squad.length; i++) {
    const five = squad.filter((_, j) => j !== i);
    best = Math.max(best, bandMidFor(five, fixture, config));
  }
  return best;
}
