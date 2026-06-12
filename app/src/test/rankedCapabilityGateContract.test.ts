/**
 * Ranked-capability honesty gate.
 *
 * RANKED_CAPABILITIES tracks what the ranking backend actually serves. The
 * Ranks/Profile screens keep the full designed UI structure behind these
 * flags and render placeholders instead of fabricated depth. A flag may flip
 * to true ONLY alongside the backend that serves the number — a deliberate
 * launch decision, locked here:
 *
 *  - globalRank: LIVE since 2026-06-12, served by leaderboards.getGlobalRank
 *    (same ordering + eligibility rules as the leaderboard itself).
 *  - everything else (divisions, rank points, promotion series, per-mode
 *    rating cards, season archive, tier population): still parked.
 */
import { describe, expect, it } from "vitest";
import { RANKED_CAPABILITIES } from "@/lib/rankedLadder";

const PARKED = [
  "divisions",
  "rankPoints",
  "promotionSeries",
  "perModeRatings",
  "seasonArchive",
  "tierPopulation",
] as const;

describe("RANKED_CAPABILITIES (honesty gate)", () => {
  it("keeps every parked capability off", () => {
    for (const capability of PARKED) {
      expect(
        RANKED_CAPABILITIES[capability],
        `capability "${capability}" must stay false until the ranking backend ships it`,
      ).toBe(false);
    }
  });

  it("serves globalRank — backed by leaderboards.getGlobalRank", () => {
    expect(RANKED_CAPABILITIES.globalRank).toBe(true);
  });

  it("covers the full advertised capability surface", () => {
    expect(Object.keys(RANKED_CAPABILITIES).sort()).toEqual(
      [...PARKED, "globalRank"].sort(),
    );
  });
});
