/**
 * Coarse clearance signal (Ticket G2 — owner-sanctioned ADDITIVE module,
 * engine v1.1 contract).
 *
 * A three-bucket read of "can the five I'd field clear the next threshold":
 *
 *   SAFE      band centre ≥ safeRatio × threshold
 *   TIGHT     in between
 *   LONGSHOT  band centre < longshotRatio × threshold
 *
 * It is computed from the SAME design-public inputs as the F3 band
 * (projection.ts): ratings, fixture modifiers, fielded synergy — everything
 * already revealed pre-round; never the realized forms. The bucket cutoffs
 * are EngineConfig knobs (`clearance`), so UI and bots share ONE definition —
 * this module is that definition.
 *
 * WHY COARSE (STOP-G ruling context): the exact band centre made the modeled
 * player near-optimally informed — its pushes were almost never marginal,
 * which collapsed P1d/P3a/P6 onto one unreachable dial. Bucketing throws
 * away exactly the precision that killed the tension: within a bucket the
 * player cannot tell a 55% push from an 80% one, so tight decisions stay
 * genuinely tense and hints have something to resolve.
 *
 * Pure; no I/O, no seeds, no Math.random.
 */

import { fixtureMultFor, squadSynergies } from "./scoring";
import type { Card, ClearanceConfig, EngineConfig, Fixture } from "./types";
import type { ClearanceSignal } from "./types";

/** v1.2 defaults — the sweep-tuned values live in the served config's knob. */
export const DEFAULT_CLEARANCE: ClearanceConfig = { safeRatio: 1.25, longshotRatio: 0.9 };

/**
 * The F3 band centre of a fielded five against a fixture:
 * Σ(rating × fixtureMult) × synergyMult — the formless round score, the same
 * arithmetic projection.ts draws (no board seed needed; forms excluded).
 */
export function bandMidFor(fielded: Card[], fixture: Fixture, config: EngineConfig): number {
  let sum = 0;
  for (const card of fielded) {
    sum += card.rating * fixtureMultFor(card, fixture);
  }
  let syn = 1;
  for (const s of squadSynergies(fielded, config)) syn *= s.mult;
  return sum * syn;
}

/** The coarse bucket for a band centre against a threshold. */
export function clearanceSignal(
  bandMid: number,
  threshold: number,
  cfg: ClearanceConfig,
): ClearanceSignal {
  if (bandMid >= cfg.safeRatio * threshold) return "SAFE";
  if (bandMid < cfg.longshotRatio * threshold) return "LONGSHOT";
  return "TIGHT";
}

/** Convenience: the signal for a fielded five against a fixture. */
export function clearanceFor(
  fielded: Card[],
  fixture: Fixture,
  config: EngineConfig,
): ClearanceSignal {
  return clearanceSignal(
    bandMidFor(fielded, fixture, config),
    fixture.threshold,
    config.clearance ?? DEFAULT_CLEARANCE,
  );
}
