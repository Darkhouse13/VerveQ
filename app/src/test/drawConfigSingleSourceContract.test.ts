/**
 * THE DRAW — config single-source contract (Ticket C, Step 1).
 *
 * The c13-1 accepted config used to exist in three places: the gitignored sim
 * artifact, the Convex serving pin, and a verbatim copy inside the mock. Three
 * copies of 40 tuned numbers means a retune can land in one and leave the mock
 * and the server silently playing different games.
 *
 * These tests make that class of bug unrepresentable: both consumers resolve
 * to the SAME object via the shared drawEngine/configs/c13v1 module, so there
 * is no second copy left to drift. A future retune that forgets a consumer
 * fails here rather than in production.
 */

import { describe, expect, it } from "vitest";
import { C13V1_CONFIG, C13V1_CONFIG_VERSION } from "@/lib/drawEngine/configs/c13v1";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";
import {
  DRAW_ACTIVE_CONFIG,
  DRAW_CONFIG_VERSION,
  resolveDrawConfig,
} from "../../convex/drawSeed";

describe("draw config single-source", () => {
  it("the Convex-pinned config and the mock config are deep-equal", () => {
    // The headline invariant: whatever the server serves, the mock plays.
    expect(MOCK_ENGINE_CONFIG).toEqual(DRAW_ACTIVE_CONFIG);
  });

  it("both sides are the SAME object — not two copies that happen to match", () => {
    // Deep-equality alone would still pass if someone re-pasted the literal.
    // Identity is what makes a divergent copy impossible to introduce without
    // deleting the shared import.
    expect(MOCK_ENGINE_CONFIG).toBe(C13V1_CONFIG);
    expect(DRAW_ACTIVE_CONFIG).toBe(C13V1_CONFIG);
  });

  it("the registered configVersion resolves to the shared config", () => {
    expect(DRAW_CONFIG_VERSION).toBe(C13V1_CONFIG_VERSION);
    expect(resolveDrawConfig(C13V1_CONFIG_VERSION)).toBe(C13V1_CONFIG);
  });

  it("an unknown configVersion throws rather than silently defaulting", () => {
    expect(() => resolveDrawConfig("c99-nonexistent")).toThrow(/Unknown draw configVersion/);
  });

  it("pins the accepted c13-1 knobs (a retune must be a NEW version module)", () => {
    // Spot-pins on the acceptance-winning values. Historical drawDailyBoards
    // rows are pinned by configVersion, so mutating c13-1 in place would
    // silently rewrite the past; this fails if anyone tries.
    expect(C13V1_CONFIG_VERSION).toBe("c13-1");
    expect(C13V1_CONFIG.rows).toBe(6);
    expect(C13V1_CONFIG.offersPerRow).toBe(3);
    expect(C13V1_CONFIG.fixtureCount).toBe(5);
    expect(C13V1_CONFIG.bustKeep).toBe(0.1501);
    expect(C13V1_CONFIG.fullClearBonus).toBe(1.4664);
    expect(C13V1_CONFIG.formSpread).toBeCloseTo(0.39361498365411535, 15);
    expect(C13V1_CONFIG.synergyTable).toEqual([1, 1, 1, 1.335, 1.4818, 1.6285]);
    expect(C13V1_CONFIG.thresholds).toEqual({
      base: 350,
      growth: 1.265,
      bossMult: 1,
      thresholdShape: [1, 1, 1, 1, 1.2],
    });
    expect(C13V1_CONFIG.archetypes).toHaveLength(6);
    expect(C13V1_CONFIG.cardGen.setSize).toBe(50);
  });

  it("carries no bot knobs — kGreedy is a sim concern, not a serving one", () => {
    expect(C13V1_CONFIG as unknown as Record<string, unknown>).not.toHaveProperty("kGreedy");
  });
});
