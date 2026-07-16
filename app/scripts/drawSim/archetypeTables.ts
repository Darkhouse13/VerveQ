/**
 * Alternative archetype knob tables searched by the calibrator and the sweep
 * (the default boost+penalty table lives in drawEngine/defaults.ts).
 * `strength` rescales multipliers as m^s — ×1 stays fixed, symmetric in log
 * space. All ids synthetic.
 */

import type { EngineConfig } from "../../src/lib/drawEngine";

/** Boost-only niche table: no penalties, one neutral fixture. */
export function buildBoostOnlyArchetypes(strength: number): EngineConfig["archetypes"] {
  const pow = (m: number) => Math.pow(m, strength);
  return [
    { id: "ARCH_WALL_B", modifiers: [{ kind: "position", value: "DEF", mult: pow(1.9) }] },
    { id: "ARCH_KEEPER_B", modifiers: [{ kind: "position", value: "GK", mult: pow(3.2) }] },
    { id: "ARCH_SPEAR_B", modifiers: [{ kind: "position", value: "ATT", mult: pow(1.9) }] },
    { id: "ARCH_THROWBACK_B", modifiers: [{ kind: "eraBefore", value: 3, mult: pow(1.7) }] },
    { id: "ARCH_NEWWAVE_B", modifiers: [{ kind: "eraAtLeast", value: 3, mult: pow(1.55) }] },
    { id: "ARCH_NEUTRAL", modifiers: [] },
  ];
}

/**
 * Mixed-dip table (Ticket 0.1 P3 exploration): mostly mild boosts, so the
 * round after a boosted one reads as a gentle score dip (the tense zone for
 * push/bank EV), plus one deep niche boost as a catastrophic-miss source (P2).
 */
export function buildMixedDipArchetypes(strength: number): EngineConfig["archetypes"] {
  const pow = (m: number) => Math.pow(m, strength);
  return [
    { id: "ARCH_MILD_DEF", modifiers: [{ kind: "position", value: "DEF", mult: pow(1.3) }] },
    { id: "ARCH_MILD_ATT", modifiers: [{ kind: "position", value: "ATT", mult: pow(1.3) }] },
    { id: "ARCH_MILD_MID", modifiers: [{ kind: "position", value: "MID", mult: pow(1.35) }] },
    { id: "ARCH_KEEPER_B", modifiers: [{ kind: "position", value: "GK", mult: pow(3.0) }] },
    { id: "ARCH_THROWBACK_B", modifiers: [{ kind: "eraBefore", value: 3, mult: pow(1.5) }] },
    { id: "ARCH_NEUTRAL", modifiers: [] },
  ];
}
