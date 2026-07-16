/**
 * Default EngineConfig — the hand-tuned starting point. The sweep
 * (app/scripts/drawSim/sweep.ts) searches knob ranges around these values;
 * winning configs are exported as JSON and passed to the sim via --config.
 */

import type { CardGenConfig, EngineConfig, FixtureArchetype, ThresholdConfig } from "./types";

/**
 * Synthetic archetype knob table. Boards deal fixtures by shuffling this
 * table; ids are invented, never real-world tactical brands.
 * `strength` rescales every multiplier's distance from 1 (m ⇒ 1 + (m-1)*s for
 * boosts is wrong for penalties, so we use m^s which keeps ×1 fixed and is
 * symmetric in log space).
 */
export function buildArchetypes(strength = 1): FixtureArchetype[] {
  const pow = (m: number) => Math.pow(m, strength);
  return [
    {
      id: "ARCH_WALL",
      modifiers: [
        { kind: "position", value: "DEF", mult: pow(2.0) },
        { kind: "position", value: "ATT", mult: pow(0.5) },
      ],
    },
    {
      id: "ARCH_BLITZ",
      modifiers: [
        { kind: "position", value: "ATT", mult: pow(1.8) },
        { kind: "position", value: "DEF", mult: pow(0.65) },
      ],
    },
    {
      id: "ARCH_ENGINE",
      modifiers: [
        { kind: "position", value: "MID", mult: pow(1.7) },
        { kind: "position", value: "GK", mult: pow(0.8) },
      ],
    },
    {
      id: "ARCH_THROWBACK",
      // Boosts cards from era buckets strictly before index 3 (pre-ERA_1990s
      // with the default 1960-based buckets).
      modifiers: [{ kind: "eraBefore", value: 3, mult: pow(1.5) }],
    },
    {
      id: "ARCH_NEWWAVE",
      modifiers: [{ kind: "eraAtLeast", value: 3, mult: pow(1.4) }],
    },
    {
      id: "ARCH_FORTRESS_KEEPER",
      modifiers: [
        { kind: "position", value: "GK", mult: pow(2.2) },
        { kind: "position", value: "MID", mult: pow(0.8) },
      ],
    },
  ];
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  formSpread: 0.15,
  bustKeep: 0.25,
  fullClearBonus: 1.25,
  // index = chain length; entries below 3 are ×1.
  synergyTable: [1, 1, 1, 1.5, 2.0, 2.5, 3.0],
  maxSynergyFamilies: 3,
  thresholds: { base: 420, growth: 1.35, bossMult: 1.15, thresholdShape: [1, 1, 1, 1, 1] },
  archetypes: buildArchetypes(1),
  cardGen: {
    setSize: 60,
    ratingMin: 60,
    ratingMax: 95,
    ratingSkew: 1.2,
    clubCount: 8,
    nationCount: 6,
    eraCount: 5,
    clubsPerCardWeights: [4, 4, 2], // 1 club : 2 clubs : 3 clubs
    positionWeights: { GK: 1, DEF: 3, MID: 3, ATT: 3 },
  },
};

/** Partial config with nested partials for the two nested knob groups. */
export type EngineConfigOverrides = Partial<Omit<EngineConfig, "thresholds" | "cardGen">> & {
  thresholds?: Partial<ThresholdConfig>;
  cardGen?: Partial<CardGenConfig>;
};

/** Deep-merge a partial override (e.g. parsed from a --config JSON) onto the defaults. */
export function mergeConfig(overrides: EngineConfigOverrides | undefined): EngineConfig {
  if (!overrides) return DEFAULT_ENGINE_CONFIG;
  const base = DEFAULT_ENGINE_CONFIG;
  return {
    ...base,
    ...overrides,
    thresholds: { ...base.thresholds, ...(overrides.thresholds ?? {}) },
    cardGen: { ...base.cardGen, ...(overrides.cardGen ?? {}) },
    synergyTable: overrides.synergyTable ?? base.synergyTable,
    archetypes: overrides.archetypes ?? base.archetypes,
  };
}
