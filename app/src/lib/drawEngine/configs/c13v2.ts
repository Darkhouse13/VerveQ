/**
 * THE DRAW — the c13-2 accepted EngineConfig (Ticket G2, profile v1.2,
 * PASS 13/13 selection-free — twice).
 *
 * ADDITIVE DATA MODULE. Engine contract v1.1 (+ Ticket G2 clearance knob);
 * this file adds no behavior: it is the single durable copy of the accepted
 * knobs for the coarse-signal retune, mirroring configs/c13v1.ts.
 *
 * NOT ACTIVATED. Serving stays pinned on c13-1 (convex/drawSeed.ts) until
 * the owner replays under this config on dev and rules on the two flagged
 * interpretations recorded in DECISIONS.md (Ticket G2): the v1.2 P3 split
 * (P3a on the chaser instrument, P3b on coarseAssisted) and the ladder's
 * two-chain reading (chaser vs coarseAssisted unordered). Activation is a
 * separate owner ticket: register this version in convex/drawSeed.ts —
 * never edit c13v1.
 *
 * Provenance: sweep artifact sweepg-sweep-g2f.json (search seed sweep-g2f),
 * selection-free acceptance runs accept-g2 and accept-g2-confirm (20
 * default-scorer slices × 500 boards each, both 13/13 PASS — see
 * DECISIONS.md Ticket G2 for the tables). Content knobs (synergy table,
 * archetypes, cardGen) are pinned unchanged from c13-1. `kGreedy 0.9` from
 * the artifact is a BOT knob, not a serving knob, and is deliberately
 * absent here (c13v1 precedent).
 *
 * DO NOT hand-edit. A retune is a NEW config module + a new configVersion —
 * never a mutation of this one.
 */

import type { EngineConfig } from "../types";
import { C13V1_CONFIG } from "./c13v1";

/** The configVersion string this config registers under when activated. */
export const C13V2_CONFIG_VERSION = "c13-2";

export const C13V2_CONFIG: EngineConfig = {
  ...C13V1_CONFIG,
  // Ticket G2 retune: wider form spread (deeper fail tails — P2/P3 tension)
  // and a slightly taller, steeper curve without the c13-1 boss shape.
  formSpread: 0.48,
  thresholds: {
    base: 375,
    growth: 1.29,
    bossMult: 1,
    thresholdShape: [1, 1, 1, 1, 1],
  },
  // Engine v1.1 hints (Ticket G): reliability 0.6 — the weakest hint that
  // still clears P6 (+6.4%/+7.6% measured vs the +3% bar).
  hints: { hintReliability: 0.6 },
  // Ticket G2 coarse clearance buckets: SAFE at ≥1.15× threshold (the
  // coarseAssisted push gate), LONGSHOT below 1.05× (the coarseReader gate).
  clearance: { safeRatio: 1.15, longshotRatio: 1.05 },
};
