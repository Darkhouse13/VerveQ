/**
 * Pinned EngineConfig + card-set seed for the LocalMockApi (dev-only).
 *
 * The config is a verbatim copy of the Ticket 0.4 accepted config
 * `app/scripts/drawSim/artifacts/c13-1.json` (10/10 acceptance PASS, see
 * drawEngine/DECISIONS.md). It is embedded here rather than imported because
 * `app/scripts` sits outside the `src` build root; if the artifact is ever
 * re-tuned, this copy must be updated with it.
 *
 * The card set is synthetic (frozen cardGen, pinned seed) — the real card
 * set arrives with the CIE card-set ticket and its own Tier-2 acceptance.
 */

import type { EngineConfig } from "@/lib/drawEngine";

/** Seed for the synthetic dev card set. Pinned so every dev sees one world. */
export const MOCK_CARD_SET_SEED = "draw-mock-cardset-v1";

/** Board #1 goes live on this UTC day; numbers count up from it. */
export const MOCK_EPOCH_DATE_KEY = "2026-07-01";

export const MOCK_ENGINE_CONFIG: EngineConfig = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  formSpread: 0.39361498365411535,
  bustKeep: 0.1501,
  fullClearBonus: 1.4664,
  synergyTable: [1, 1, 1, 1.335, 1.4818, 1.6285],
  maxSynergyFamilies: 3,
  thresholds: {
    base: 350,
    growth: 1.265,
    bossMult: 1,
    thresholdShape: [1, 1, 1, 1, 1.2],
  },
  archetypes: [
    {
      id: "ARCH_WALL",
      modifiers: [
        { kind: "position", value: "DEF", mult: 2.685546925617906 },
        { kind: "position", value: "ATT", mult: 0.3723636293452271 },
      ],
    },
    {
      id: "ARCH_BLITZ",
      modifiers: [
        { kind: "position", value: "ATT", mult: 2.3110984212462755 },
        { kind: "position", value: "DEF", mult: 0.5412041716326944 },
      ],
    },
    {
      id: "ARCH_ENGINE",
      modifiers: [
        { kind: "position", value: "MID", mult: 2.1302936553555485 },
        { kind: "position", value: "GK", mult: 0.7275826019959132 },
      ],
    },
    {
      id: "ARCH_THROWBACK",
      modifiers: [{ kind: "eraBefore", value: 3, mult: 1.7822477192894424 }],
    },
    {
      id: "ARCH_NEWWAVE",
      modifiers: [{ kind: "eraAtLeast", value: 3, mult: 1.6153402115576472 }],
    },
    {
      id: "ARCH_FORTRESS_KEEPER",
      modifiers: [
        { kind: "position", value: "GK", mult: 3.076282816937738 },
        { kind: "position", value: "MID", mult: 0.7275826019959132 },
      ],
    },
  ],
  cardGen: {
    setSize: 50,
    ratingMin: 60,
    ratingMax: 95,
    ratingSkew: 0.7448261749697849,
    clubCount: 11,
    nationCount: 6,
    eraCount: 4,
    clubsPerCardWeights: [2, 4, 4],
    positionWeights: { GK: 1, DEF: 3, MID: 3, ATT: 3 },
  },
};
