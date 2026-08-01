/**
 * Weekend Fantasy FW-LAUNCH O2 — crowd voting rules, as pure unit tests.
 *
 * The property that matters most (STANDING RULE 6): the derivation produces
 * factors within ±15% BY CONSTRUCTION. The pipeline's rejection of an
 * out-of-band factor is the safety net; these tests are about never needing
 * it.
 */

import { describe, expect, it } from "vitest";

import {
  CROWD_ELO_K,
  CROWD_ELO_START,
  CROWD_FACTOR_MAX,
  CROWD_LIQUIDITY_THRESHOLD,
  consensusOf,
  deriveCrowdFactors,
  eloExpectation,
  eloUpdate,
  pairKeyOf,
  raterWeightOf,
  type CrowdFactorResult,
  type CrowdRatingEntry,
} from "../../convex/lib/fantasyCrowd";

function entry(over: Partial<CrowdRatingEntry> & { playerId: string }): CrowdRatingEntry {
  return {
    verdictPosition: "MID",
    rating: CROWD_ELO_START,
    voteCount: CROWD_LIQUIDITY_THRESHOLD,
    ...over,
  };
}

const factorOf = (results: readonly CrowdFactorResult[], id: string) =>
  results.find((r) => r.playerId === id);

// ── Elo ──

describe("per-gameweek Elo (spec §Rating math)", () => {
  it("expects 0.5 between equals and sums to 1 either way round", () => {
    expect(eloExpectation(1500, 1500)).toBe(0.5);
    expect(eloExpectation(1600, 1400) + eloExpectation(1400, 1600)).toBeCloseTo(1, 12);
  });

  it("moves winner up and loser down by the same K-bounded amount", () => {
    const { a, b } = eloUpdate(1500, 1500, true);
    expect(a).toBeCloseTo(1500 + CROWD_ELO_K / 2, 9);
    expect(b).toBeCloseTo(1500 - CROWD_ELO_K / 2, 9);
    // Zero-sum: the pool of rating is conserved by every vote.
    expect(a + b).toBeCloseTo(3000, 9);
  });

  it("pays an upset more than a formality", () => {
    const upset = eloUpdate(1400, 1600, true).a - 1400;
    const formality = eloUpdate(1600, 1400, true).a - 1600;
    expect(upset).toBeGreaterThan(formality);
    expect(upset).toBeLessThanOrEqual(CROWD_ELO_K);
  });
});

// ── pair identity ──

describe("pair keys", () => {
  it("is order-independent — A:B and B:A are one single-use pair", () => {
    expect(pairKeyOf("x1", "x2")).toBe(pairKeyOf("x2", "x1"));
    expect(pairKeyOf("x1", "x2")).toBe("x1:x2");
  });
});

// ── factor derivation ──

describe("crowd factor derivation (spec §Rating math)", () => {
  it("stays within ±15% by construction, whatever the ratings", () => {
    const entries = Array.from({ length: 200 }, (_, i) =>
      entry({
        playerId: `p${i}`,
        verdictPosition: (["GK", "DEF", "MID", "ATT"] as const)[i % 4],
        // Wild, adversarial spread — far beyond anything Elo could produce.
        rating: (i % 7) * 100000 - 300000,
        voteCount: CROWD_LIQUIDITY_THRESHOLD + (i % 50),
      }),
    );
    for (const result of deriveCrowdFactors(entries)) {
      expect(Math.abs(result.factor)).toBeLessThanOrEqual(CROWD_FACTOR_MAX);
    }
  });

  it("maps the group extremes onto exactly ±15% and the median onto 0", () => {
    const results = deriveCrowdFactors([
      entry({ playerId: "low", rating: 1400 }),
      entry({ playerId: "mid", rating: 1500 }),
      entry({ playerId: "high", rating: 1600 }),
    ]);
    expect(factorOf(results, "low")?.factor).toBeCloseTo(-CROWD_FACTOR_MAX, 12);
    expect(factorOf(results, "mid")?.factor).toBeCloseTo(0, 12);
    expect(factorOf(results, "high")?.factor).toBeCloseTo(CROWD_FACTOR_MAX, 12);
  });

  it("percentiles within the verdict-position group, not across the board", () => {
    // The worst MID still beats no other MID; a lone ATT sits at his group's
    // median. Cross-group comparison must not happen.
    const results = deriveCrowdFactors([
      entry({ playerId: "m1", verdictPosition: "MID", rating: 1700 }),
      entry({ playerId: "m2", verdictPosition: "MID", rating: 1300 }),
      entry({ playerId: "a1", verdictPosition: "ATT", rating: 1000 }),
    ]);
    expect(factorOf(results, "m1")?.factor).toBeCloseTo(CROWD_FACTOR_MAX, 12);
    expect(factorOf(results, "m2")?.factor).toBeCloseTo(-CROWD_FACTOR_MAX, 12);
    // Lone in his group: median, not bottom — despite the lowest rating.
    expect(factorOf(results, "a1")?.factor).toBe(0);
  });

  it("gives below-threshold players factor 0, flagged, and excludes them from the population", () => {
    const results = deriveCrowdFactors([
      entry({ playerId: "thin", rating: 2000, voteCount: CROWD_LIQUIDITY_THRESHOLD - 1 }),
      entry({ playerId: "a", rating: 1450 }),
      entry({ playerId: "b", rating: 1550 }),
    ]);
    const thin = factorOf(results, "thin");
    expect(thin?.factor).toBe(0);
    expect(thin?.insufficientVotes).toBe(true);
    // With "thin" excluded, a and b are a two-player group at the extremes —
    // his 2000 rating dragged nobody's percentile.
    expect(factorOf(results, "a")?.factor).toBeCloseTo(-CROWD_FACTOR_MAX, 12);
    expect(factorOf(results, "b")?.factor).toBeCloseTo(CROWD_FACTOR_MAX, 12);
    expect(factorOf(results, "a")?.insufficientVotes).toBe(false);
  });

  it("treats a non-finite vote count as below-threshold (O2-F1)", () => {
    // NaN slips past `< threshold` (NaN comparisons are false) and Infinity
    // is no count a ballot box can produce: both are liquidity NOBODY
    // demonstrated, so both are flagged and kept out of the population.
    const results = deriveCrowdFactors([
      entry({ playerId: "nan", rating: 2000, voteCount: Number.NaN }),
      entry({ playerId: "inf", rating: 2000, voteCount: Number.POSITIVE_INFINITY }),
      entry({ playerId: "a", rating: 1450 }),
      entry({ playerId: "b", rating: 1550 }),
    ]);
    for (const id of ["nan", "inf"]) {
      expect(factorOf(results, id)?.factor).toBe(0);
      expect(factorOf(results, id)?.insufficientVotes).toBe(true);
    }
    // Excluded from the percentile population: a and b still sit at the
    // two-player extremes, undragged by the malformed 2000 ratings.
    expect(factorOf(results, "a")?.factor).toBeCloseTo(-CROWD_FACTOR_MAX, 12);
    expect(factorOf(results, "b")?.factor).toBeCloseTo(CROWD_FACTOR_MAX, 12);
  });

  it("gives rating ties identical factors", () => {
    const results = deriveCrowdFactors([
      entry({ playerId: "t1", rating: 1500 }),
      entry({ playerId: "t2", rating: 1500 }),
      entry({ playerId: "top", rating: 1600 }),
    ]);
    expect(factorOf(results, "t1")?.factor).toBe(factorOf(results, "t2")?.factor);
    expect(factorOf(results, "top")?.factor).toBeCloseTo(CROWD_FACTOR_MAX, 12);
  });

  it("returns an empty derivation for an empty gameweek", () => {
    expect(deriveCrowdFactors([])).toEqual([]);
  });
});

describe("court-ruled regrouping at the freeze (FW-CR1 item 2)", () => {
  // A court verdict moves a player's verdictPosition BEFORE finality; the
  // freeze then reads each row's CURRENT verdict. So the ruled player is
  // percentiled among the group he was RULED into, and the group he left
  // re-percentiles over whoever remains. Both sides of that are asserted
  // against the same population, ruled and un-ruled.
  const RULED = [
    entry({ playerId: "d1", verdictPosition: "DEF", rating: 1700 }),
    entry({ playerId: "d2", verdictPosition: "DEF", rating: 1600 }),
    entry({ playerId: "moved", verdictPosition: "DEF", rating: 1500 }), // ruled MID→DEF
    entry({ playerId: "m1", verdictPosition: "MID", rating: 1400 }),
  ];
  const UNRULED = [
    entry({ playerId: "d1", verdictPosition: "DEF", rating: 1700 }),
    entry({ playerId: "d2", verdictPosition: "DEF", rating: 1600 }),
    entry({ playerId: "moved", verdictPosition: "MID", rating: 1500 }),
    entry({ playerId: "m1", verdictPosition: "MID", rating: 1400 }),
  ];

  it("derives the moved player's factor from the RULED group's population", () => {
    const ruled = deriveCrowdFactors(RULED);
    // Bottom of a three-man DEF group — not the top of the two-man MID group
    // he would have led had the ruling been ignored.
    expect(factorOf(ruled, "moved")?.factor).toBeCloseTo(-CROWD_FACTOR_MAX, 12);
    expect(factorOf(deriveCrowdFactors(UNRULED), "moved")?.factor).toBeCloseTo(
      CROWD_FACTOR_MAX,
      12,
    );
  });

  it("re-percentiles the group he joined over the ruled population", () => {
    const ruled = deriveCrowdFactors(RULED);
    // d2 was the floor of a two-man DEF group; the arrival makes him its median.
    expect(factorOf(ruled, "d2")?.factor).toBeCloseTo(0, 12);
    expect(factorOf(ruled, "d1")?.factor).toBeCloseTo(CROWD_FACTOR_MAX, 12);
    expect(factorOf(deriveCrowdFactors(UNRULED), "d2")?.factor).toBeCloseTo(
      -CROWD_FACTOR_MAX,
      12,
    );
  });

  it("leaves the vacated group consistent — the remainder re-percentiles", () => {
    const ruled = deriveCrowdFactors(RULED);
    // m1 is alone in MID once the ruling lands: his group's median, factor 0
    // and NOT flagged (he has the votes; his population shrank).
    expect(factorOf(ruled, "m1")?.factor).toBe(0);
    expect(factorOf(ruled, "m1")?.insufficientVotes).toBe(false);
    expect(factorOf(deriveCrowdFactors(UNRULED), "m1")?.factor).toBeCloseTo(
      -CROWD_FACTOR_MAX,
      12,
    );
  });

  it("keeps every derived factor in band on both sides of a ruling", () => {
    for (const set of [RULED, UNRULED]) {
      for (const result of deriveCrowdFactors(set)) {
        expect(Math.abs(result.factor)).toBeLessThanOrEqual(CROWD_FACTOR_MAX);
      }
    }
  });
});

// ── rater accuracy ──

describe("rater accuracy (the sealed second game)", () => {
  it("finds the majority direction and refuses to invent one on a tie", () => {
    expect(consensusOf(3, 1)).toBe("a");
    expect(consensusOf(1, 3)).toBe("b");
    expect(consensusOf(2, 2)).toBeNull();
    expect(consensusOf(0, 0)).toBeNull();
  });

  it("weights court votes at 0.5 + accuracy, 1.0 for the historyless", () => {
    expect(raterWeightOf(0, 0)).toBe(1.0);
    expect(raterWeightOf(5, 10)).toBe(1.0);
    expect(raterWeightOf(10, 10)).toBe(1.5);
    expect(raterWeightOf(0, 10)).toBe(0.5);
  });
});
