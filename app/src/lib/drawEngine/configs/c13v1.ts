/**
 * THE DRAW — the c13-1 accepted EngineConfig (Ticket 0.4, PASS 10/10).
 *
 * ADDITIVE DATA MODULE (Ticket C, Step 1). The engine is frozen at CONTRACT
 * v1.0 and this file adds no behavior: it is the single durable copy of the
 * accepted knobs, imported by every consumer that needs them.
 *
 * Why it exists: the accepted config previously lived in THREE places — the
 * sim artifact (scripts/drawSim/artifacts/c13-1.json, gitignored), the Convex
 * serving pin (convex/drawSeed.ts) and the LocalMockApi's verbatim copy
 * (lib/drawApi/mockConfig.ts). Three copies of a tuned 40-number config is a
 * silent-drift bug waiting to happen: a retune lands in one and the mock and
 * the server disagree about the game with nothing failing. Both now import
 * THIS module, and drawConfigSingleSourceContract.test.ts asserts they are
 * the same object — the duplication class of bug is unrepresentable.
 *
 * Provenance: sim artifact c13-1.json, acceptance seed accept-0.3 (see
 * drawEngine/DECISIONS.md). `kGreedy` from that artifact is a BOT knob, not a
 * serving knob, and is deliberately absent here.
 *
 * DO NOT hand-edit. A retune is a NEW config module + a new configVersion
 * registered in convex/drawSeed.ts — never a mutation of this one, which is
 * pinned by dateKey on every historical drawDailyBoards row.
 */

// Relative, not the "@/" alias: convex/ imports this module too and the
// Convex bundler does not resolve the app's path alias (every convex→src
// import in the tree is relative for the same reason).
import type { EngineConfig } from "../types";

/** The configVersion string this config is registered under, server-side. */
export const C13V1_CONFIG_VERSION = "c13-1";

export const C13V1_CONFIG: EngineConfig = {
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
