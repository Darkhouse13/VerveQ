/**
 * FW-IMMERSE A3 — fixtures display rules contract.
 *
 * The rules that keep the fixtures surfaces honest: a scoreline only when
 * the feed carries one AND the fixture is in a scoreline state (never a
 * fabricated 0–0), the clock only greys (started) and never invents a
 * status, void fixtures excluded from the pulse and countdown, and local-day
 * grouping ordered like a fixture list.
 */
import { describe, expect, it } from "vitest";
import {
  countdownParts,
  fixtureDisplayKind,
  fixtureLocked,
  fixtureScoreline,
  groupFixturesByDay,
  nextKickoffAt,
  weekendPulse,
} from "@/lib/weekendFixtures";

const NOW = Date.UTC(2026, 7, 15, 14, 0, 0); // Sat 2026-08-15 14:00 UTC

function fx(overrides: {
  status?: "scheduled" | "live" | "finished" | "postponed" | "cancelled" | "abandoned";
  kickoffAt?: number;
  homeGoals?: number | null;
  awayGoals?: number | null;
  scored?: boolean;
}) {
  return {
    status: overrides.status ?? ("scheduled" as const),
    kickoffAt: overrides.kickoffAt ?? NOW + 3_600_000,
    homeGoals: overrides.homeGoals ?? null,
    awayGoals: overrides.awayGoals ?? null,
    scored: overrides.scored ?? false,
  };
}

describe("fixtureDisplayKind", () => {
  it("classifies by feed status first, clock second", () => {
    expect(fixtureDisplayKind(fx({ status: "finished" }), NOW)).toBe("played");
    expect(fixtureDisplayKind(fx({ status: "live" }), NOW)).toBe("live");
    expect(fixtureDisplayKind(fx({ status: "postponed" }), NOW)).toBe("void");
    expect(fixtureDisplayKind(fx({ status: "cancelled" }), NOW)).toBe("void");
    expect(fixtureDisplayKind(fx({ status: "abandoned" }), NOW)).toBe("void");
  });

  it("scheduled fixtures split on the clock: upcoming before kickoff, started after", () => {
    expect(fixtureDisplayKind(fx({ kickoffAt: NOW + 1 }), NOW)).toBe("upcoming");
    expect(fixtureDisplayKind(fx({ kickoffAt: NOW }), NOW)).toBe("started");
    expect(fixtureDisplayKind(fx({ kickoffAt: NOW - 1 }), NOW)).toBe("started");
  });
});

describe("fixtureLocked", () => {
  it("locks once a ball is kicked — started, live and played", () => {
    expect(fixtureLocked(fx({ kickoffAt: NOW - 1 }), NOW)).toBe(true);
    expect(fixtureLocked(fx({ status: "live" }), NOW)).toBe(true);
    expect(fixtureLocked(fx({ status: "finished" }), NOW)).toBe(true);
  });

  it("never locks upcoming or void fixtures", () => {
    expect(fixtureLocked(fx({ kickoffAt: NOW + 1 }), NOW)).toBe(false);
    expect(fixtureLocked(fx({ status: "postponed", kickoffAt: NOW - 1 }), NOW)).toBe(false);
  });
});

describe("fixtureScoreline", () => {
  it("shows the feed's scoreline for live and played fixtures", () => {
    expect(
      fixtureScoreline(fx({ status: "live", homeGoals: 1, awayGoals: 0 }), NOW),
    ).toEqual({ home: 1, away: 0 });
    expect(
      fixtureScoreline(fx({ status: "finished", homeGoals: 2, awayGoals: 2 }), NOW),
    ).toEqual({ home: 2, away: 2 });
  });

  it("an honest feed 0–0 at full time IS a scoreline", () => {
    expect(
      fixtureScoreline(fx({ status: "finished", homeGoals: 0, awayGoals: 0 }), NOW),
    ).toEqual({ home: 0, away: 0 });
  });

  it("never fabricates: no goals in the feed → no scoreline, whatever the state", () => {
    expect(fixtureScoreline(fx({ status: "live" }), NOW)).toBeNull();
    expect(fixtureScoreline(fx({ status: "finished", homeGoals: 1 }), NOW)).toBeNull();
  });

  it("never shows a scoreline for upcoming, started or void fixtures", () => {
    expect(
      fixtureScoreline(fx({ kickoffAt: NOW + 1, homeGoals: 0, awayGoals: 0 }), NOW),
    ).toBeNull();
    expect(
      fixtureScoreline(fx({ kickoffAt: NOW - 1, homeGoals: 0, awayGoals: 0 }), NOW),
    ).toBeNull();
    expect(
      fixtureScoreline(
        fx({ status: "abandoned", homeGoals: 1, awayGoals: 0, kickoffAt: NOW - 1 }),
        NOW,
      ),
    ).toBeNull();
  });
});

describe("groupFixturesByDay", () => {
  it("groups by local calendar day, days ascending, kickoffs ascending within", () => {
    const dayOne = new Date(2026, 7, 14, 21, 0).getTime(); // local Fri 21:00
    const dayTwoEarly = new Date(2026, 7, 15, 13, 30).getTime();
    const dayTwoLate = new Date(2026, 7, 15, 18, 0).getTime();
    const groups = groupFixturesByDay([
      { kickoffAt: dayTwoLate },
      { kickoffAt: dayOne },
      { kickoffAt: dayTwoEarly },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].fixtures.map((f) => f.kickoffAt)).toEqual([dayOne]);
    expect(groups[1].fixtures.map((f) => f.kickoffAt)).toEqual([dayTwoEarly, dayTwoLate]);
    expect(new Date(groups[0].dayStart).getHours()).toBe(0);
    expect(groups[0].dayStart).toBeLessThan(groups[1].dayStart);
  });

  it("splits across local midnight, not fixed 24h buckets", () => {
    const beforeMidnight = new Date(2026, 7, 14, 23, 30).getTime();
    const afterMidnight = new Date(2026, 7, 15, 0, 30).getTime();
    const groups = groupFixturesByDay([
      { kickoffAt: beforeMidnight },
      { kickoffAt: afterMidnight },
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("nextKickoffAt", () => {
  it("returns the earliest future scheduled kickoff", () => {
    expect(
      nextKickoffAt(
        [
          fx({ kickoffAt: NOW + 7_200_000 }),
          fx({ kickoffAt: NOW + 3_600_000 }),
          fx({ status: "live", kickoffAt: NOW - 3_600_000 }),
        ],
        NOW,
      ),
    ).toBe(NOW + 3_600_000);
  });

  it("skips kicked-off and void fixtures; null once the weekend is under way with nothing ahead", () => {
    expect(
      nextKickoffAt(
        [
          fx({ kickoffAt: NOW - 1 }),
          fx({ status: "postponed", kickoffAt: NOW + 3_600_000 }),
          fx({ status: "finished", kickoffAt: NOW - 7_200_000 }),
        ],
        NOW,
      ),
    ).toBeNull();
  });
});

describe("weekendPulse", () => {
  it("counts upcoming / in-play / played and landed points, excluding void", () => {
    const pulse = weekendPulse(
      [
        fx({ kickoffAt: NOW + 3_600_000 }),
        fx({ kickoffAt: NOW - 60_000 }), // started (in play)
        fx({ status: "live", kickoffAt: NOW - 3_600_000 }),
        fx({ status: "finished", kickoffAt: NOW - 10_800_000, scored: true }),
        fx({ status: "postponed" }),
      ],
      NOW,
    );
    expect(pulse).toEqual({ total: 4, upcoming: 1, inPlay: 2, played: 1, scored: 1 });
  });
});

describe("countdownParts", () => {
  it("splits hours/minutes/seconds and folds days into hours", () => {
    const parts = countdownParts(NOW + 26 * 3_600_000 + 5 * 60_000 + 9_000, NOW);
    expect(parts).toEqual({ hours: 26, minutes: 5, seconds: 9 });
  });

  it("clamps at zero once the moment passes", () => {
    expect(countdownParts(NOW - 1, NOW)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});
