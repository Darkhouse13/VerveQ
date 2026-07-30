/**
 * Weekend Fantasy FW-LAUNCH O3 — reclamation court rules, as pure unit tests.
 */

import { describe, expect, it } from "vitest";

import {
  COURT_ARGUMENT_MAX_CHARS,
  COURT_ENDORSEMENT_FLOOR,
  COURT_PASS_SHARE,
  COURT_QUORUM_FLOOR,
  endorsementThresholdOf,
  filingClosesAt,
  quorumOf,
  trialPasses,
  validArgument,
  votingClosesAt,
} from "../../convex/lib/fantasyCourtRules";

// Tuesday 23:59 Europe/Paris, some week — the exact value is irrelevant to
// the offsets under test.
const FINALITY = 1_790_000_000_000;

describe("court timeline (spec §Timeline)", () => {
  it("closes filing 24h before finality (Monday 23:59)", () => {
    expect(filingClosesAt(FINALITY)).toBe(FINALITY - 24 * 60 * 60 * 1000);
  });

  it("closes voting 2h59m before finality (Tuesday 21:00)", () => {
    expect(votingClosesAt(FINALITY)).toBe(FINALITY - (2 * 60 + 59) * 60 * 1000);
  });

  it("orders the windows: filing < voting < finality", () => {
    expect(filingClosesAt(FINALITY)).toBeLessThan(votingClosesAt(FINALITY));
    expect(votingClosesAt(FINALITY)).toBeLessThan(FINALITY);
  });
});

describe("thresholds (spec §Endorsement threshold, §Trial)", () => {
  it("floors dominate at launch scale (~1,400 actives)", () => {
    expect(endorsementThresholdOf(1400)).toBe(COURT_ENDORSEMENT_FLOOR);
    expect(quorumOf(1400)).toBe(COURT_QUORUM_FLOOR);
    expect(endorsementThresholdOf(0)).toBe(COURT_ENDORSEMENT_FLOOR);
  });

  it("the percentages take over as the base grows", () => {
    expect(endorsementThresholdOf(10_000)).toBe(50); // 0.5%
    expect(quorumOf(10_000)).toBe(100); // 1%
  });
});

describe("trial pass test (quorum AND ≥ 60% weighted yes)", () => {
  it("fails short of quorum however lopsided the vote", () => {
    expect(
      trialPasses({ rawVotes: COURT_QUORUM_FLOOR - 1, weightedYes: 100, weightedNo: 0, quorum: COURT_QUORUM_FLOOR }),
    ).toBe(false);
  });

  it("passes at exactly quorum and exactly the share", () => {
    // 18 yes / 12 no at weight 1.0 = 60.0% exactly, 30 raw.
    expect(
      trialPasses({ rawVotes: 30, weightedYes: 18, weightedNo: 12, quorum: 30 }),
    ).toBe(true);
    expect(COURT_PASS_SHARE).toBe(0.6);
  });

  it("fails a hair under the share", () => {
    expect(
      trialPasses({ rawVotes: 30, weightedYes: 17.9, weightedNo: 12.1, quorum: 30 }),
    ).toBe(false);
  });

  it("lets accuracy weight tip a raw tie — the sealed game's teeth", () => {
    // 15 raw yes vs 15 raw no, but the yes side averages 1.5 weight
    // (proven eyes) against 0.9: 22.5 vs 13.5 = 62.5% weighted.
    expect(
      trialPasses({ rawVotes: 30, weightedYes: 22.5, weightedNo: 13.5, quorum: 30 }),
    ).toBe(true);
  });

  it("fails an empty ballot even at quorum zero", () => {
    expect(trialPasses({ rawVotes: 0, weightedYes: 0, weightedNo: 0, quorum: 0 })).toBe(false);
  });
});

describe("arguments", () => {
  it("bounds the one-liner at 280 chars, trimmed and non-empty", () => {
    expect(validArgument("He played the whole game at left back.")).toBe(true);
    expect(validArgument("   ")).toBe(false);
    expect(validArgument("x".repeat(COURT_ARGUMENT_MAX_CHARS))).toBe(true);
    expect(validArgument("x".repeat(COURT_ARGUMENT_MAX_CHARS + 1))).toBe(false);
  });
});
