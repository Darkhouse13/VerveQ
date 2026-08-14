/**
 * EYE-TEST-CONTEXT — vote-card display rules (src/lib/weekendVoteCard.ts).
 *
 * The pure client half of the card's memory: score orientation, the kickoff
 * day tag, and the factual event line. The server half (the query mapping)
 * is covered beside the crowd rules in fantasyCrowd.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  kickoffDayTag,
  orientedScore,
  voteCardEvents,
} from "../lib/weekendVoteCard";

describe("orientedScore", () => {
  const fixture = { homeGoals: 3, awayGoals: 1 };

  it("reads home-side appearances home-first", () => {
    expect(orientedScore({ isHome: true, fixture })).toEqual({ us: 3, them: 1 });
  });

  it("reads away-side appearances away-first — the same fixture, flipped", () => {
    expect(orientedScore({ isHome: false, fixture })).toEqual({ us: 1, them: 3 });
  });

  it("returns null while the feed carries no goals — absent, never 0", () => {
    expect(orientedScore({ isHome: true, fixture: { homeGoals: null, awayGoals: null } })).toBeNull();
    expect(orientedScore({ isHome: true, fixture: { homeGoals: 2, awayGoals: null } })).toBeNull();
  });

  it("keeps an honest 0–0 as a score, not an absence", () => {
    expect(orientedScore({ isHome: false, fixture: { homeGoals: 0, awayGoals: 0 } })).toEqual({
      us: 0,
      them: 0,
    });
  });
});

describe("kickoffDayTag", () => {
  // 2026-08-16 19:00 UTC is a Sunday; the timeZone injection keeps the test
  // deterministic across machines (the app itself uses the device zone).
  const SUNDAY_EVENING_UTC = Date.UTC(2026, 7, 16, 19, 0);

  it("renders the short weekday, uppercased, in the given locale", () => {
    expect(kickoffDayTag(SUNDAY_EVENING_UTC, "en", "UTC")).toBe("SUN");
    expect(kickoffDayTag(SUNDAY_EVENING_UTC - 24 * 3600 * 1000, "en", "UTC")).toBe("SAT");
  });

  it("follows the timezone — a late kickoff can be the viewer's next day", () => {
    const lateSaturday = Date.UTC(2026, 7, 15, 23, 30);
    expect(kickoffDayTag(lateSaturday, "en", "UTC")).toBe("SAT");
    expect(kickoffDayTag(lateSaturday, "en", "Asia/Tokyo")).toBe("SUN");
  });
});

describe("voteCardEvents", () => {
  it("returns nothing for a quiet line — no icons, no zeros", () => {
    expect(voteCardEvents({ goals: 0, assists: 0, redCard: false })).toEqual([]);
  });

  it("lists only the factual events that happened, with their counts", () => {
    expect(voteCardEvents({ goals: 2, assists: 1, redCard: false })).toEqual([
      { kind: "goal", count: 2 },
      { kind: "assist", count: 1 },
    ]);
  });

  it("carries a red card as a single fact", () => {
    expect(voteCardEvents({ goals: 0, assists: 0, redCard: true })).toEqual([
      { kind: "red", count: 1 },
    ]);
  });
});
