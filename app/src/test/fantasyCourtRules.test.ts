/**
 * Weekend Fantasy FW-LAUNCH O3 — reclamation court rules, as pure unit tests.
 */

import { describe, expect, it } from "vitest";

import {
  COURT_ARGUMENT_MAX_CHARS,
  COURT_ENDORSEMENT_FLOOR,
  COURT_PASS_SHARE,
  COURT_QUORUM_FLOOR,
  COURT_RESOLVE_MINUTES,
  cadenceCoversVerdictWindow,
  endorsementThresholdOf,
  filingClosesAt,
  inVerdictWindow,
  maxGapOfHourlyMinutes,
  quorumOf,
  trialPasses,
  validArgument,
  votingClosesAt,
} from "../../convex/lib/fantasyCourtRules";

// Tuesday 23:59 Europe/Paris, some week — the exact value is irrelevant to
// the offsets under test.
const FINALITY = 1_790_000_000_000;
const MINUTE = 60 * 1000;

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

describe("the verdict window (FW-CR1 item 1: resolution ≠ expiry)", () => {
  it("opens when voting closes and SHUTS at finality, exclusive", () => {
    expect(inVerdictWindow(FINALITY, votingClosesAt(FINALITY))).toBe(true);
    expect(inVerdictWindow(FINALITY, FINALITY - 1)).toBe(true);
    // The critical boundary: at finality no verdict is applicable at all.
    expect(inVerdictWindow(FINALITY, FINALITY)).toBe(false);
    expect(inVerdictWindow(FINALITY, FINALITY + 1)).toBe(false);
  });

  it("is shut before voting closes — a trial in progress is not judged", () => {
    expect(inVerdictWindow(FINALITY, votingClosesAt(FINALITY) - 1)).toBe(false);
    expect(inVerdictWindow(FINALITY, filingClosesAt(FINALITY))).toBe(false);
  });

  it("stays shut through the settlement lag — the bug it exists to kill", () => {
    // The settlement cron is quarter-hourly, so a gameweek can sit past its
    // cut and un-stamped for minutes. Every instant in there refuses a verdict.
    for (const lag of [1, 5, 15, 60, 6 * 60]) {
      expect(inVerdictWindow(FINALITY, FINALITY + lag * MINUTE)).toBe(false);
    }
  });
});

describe("resolver cadence (the window must never be missed)", () => {
  it("measures the widest silence of an hourly schedule, wrap included", () => {
    expect(maxGapOfHourlyMinutes([0, 30])).toBe(30 * 60 * 1000);
    expect(maxGapOfHourlyMinutes([0, 15, 30, 45])).toBe(15 * 60 * 1000);
    expect(maxGapOfHourlyMinutes([0, 1])).toBe(59 * 60 * 1000); // the wrap dominates
    expect(maxGapOfHourlyMinutes([7])).toBe(60 * 60 * 1000);
  });

  it("the shipped cadence lands a resolution pass inside every window", () => {
    expect(maxGapOfHourlyMinutes(COURT_RESOLVE_MINUTES)).toBe(15 * 60 * 1000);
    expect(cadenceCoversVerdictWindow(COURT_RESOLVE_MINUTES)).toBe(true);

    // Exhaustive rather than argued: every minute-aligned finality instant in
    // a day has a tick in [votingClosesAt, finalityAt).
    const dayStart = FINALITY - (FINALITY % (24 * 60 * MINUTE));
    for (let m = 0; m < 24 * 60; m += 1) {
      const finalityAt = dayStart + m * MINUTE;
      const hits = [];
      for (let tick = finalityAt - 4 * 60 * MINUTE; tick < finalityAt; tick += MINUTE) {
        const minute = Math.floor(tick / MINUTE) % 60;
        if (!COURT_RESOLVE_MINUTES.includes(minute as (typeof COURT_RESOLVE_MINUTES)[number])) {
          continue;
        }
        if (inVerdictWindow(finalityAt, tick)) hits.push(tick);
      }
      expect(hits.length).toBeGreaterThan(0);
    }
  });

  it("breaks if either side of the coupling moves the wrong way", () => {
    // Thin the cron to hourly against a 30-minute window: uncovered.
    expect(cadenceCoversVerdictWindow([7], 30 * 60 * 1000)).toBe(false);
    // Keep the cron and shrink the voting lead below its widest silence: also
    // uncovered — the guarantee is a property of the pair, not of the cron.
    expect(cadenceCoversVerdictWindow(COURT_RESOLVE_MINUTES, 10 * 60 * 1000)).toBe(false);
    expect(cadenceCoversVerdictWindow(COURT_RESOLVE_MINUTES, 15 * 60 * 1000)).toBe(true);
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
