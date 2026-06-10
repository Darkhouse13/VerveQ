/**
 * Ranked-capability honesty gate.
 *
 * Backend ranking (RANKING_V2) is parked: there are no divisions, rank points,
 * promotion series, global rank numbers, per-mode rating cards, season
 * archives, or tier-population stats to show. The Ranks/Profile screens keep
 * that UI structure behind RANKED_CAPABILITIES and render placeholders
 * instead of fabricated depth. Every capability must stay OFF until the
 * backend actually ships it — flipping one here is a deliberate launch
 * decision, not a side effect.
 */
import { describe, expect, it } from "vitest";
import { RANKED_CAPABILITIES } from "@/lib/rankedLadder";

describe("RANKED_CAPABILITIES (honest while RANKING_V2 is parked)", () => {
  it("keeps every capability off", () => {
    for (const [capability, enabled] of Object.entries(RANKED_CAPABILITIES)) {
      expect(enabled, `capability "${capability}" must stay false until the ranking backend ships`).toBe(false);
    }
  });

  it("covers the full advertised capability surface", () => {
    expect(Object.keys(RANKED_CAPABILITIES).sort()).toEqual(
      [
        "divisions",
        "globalRank",
        "perModeRatings",
        "promotionSeries",
        "rankPoints",
        "seasonArchive",
        "tierPopulation",
      ].sort(),
    );
  });
});
