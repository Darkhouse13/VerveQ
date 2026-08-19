/**
 * Weekend Fantasy FW-2 — the gameweek constitution, as pure unit tests.
 *
 * The ruling this file asserts:
 *
 *   weekend window : Friday 00:00 → Monday 23:59   Europe/Paris
 *   midweek window : Tuesday 00:00 → Thursday 23:59 Europe/Paris
 *   finality       : 23:59 Europe/Paris the day AFTER the window closes
 *
 * Three things here are worth more than the rest, because they are the ones a
 * plausible-looking rewrite would silently break:
 *
 *  1. The Monday-23:59 / Tuesday-00:00 seam. A fixture kicking off at
 *     23:59:30 Monday belongs to the WEEKEND. Every "…23:59" boundary in the
 *     ruling is implemented as a half-open interval for exactly this reason.
 *  2. DST. The windows are built from Paris wall-clock arithmetic, not from
 *     adding 4x86 400 000 ms, so the two switchover weekends are an hour
 *     shorter and longer respectively — and still start and end at midnight.
 *  3. The Paris wall clock itself. Finality is 23:59 LOCAL, so the same rule
 *     lands on a different UTC instant in winter (CET) than in summer (CEST).
 *     These assertions moved here from fantasySquadRules.test.ts when the
 *     owner's STOP-E ruling deleted `finalityAtOrAfter`; they are the reason
 *     that suite existed and they still need a home.
 *
 * No database, no clock, no network.
 */

import { describe, expect, it } from "vitest";

import {
  FINALITY_TIME_ZONE,
  zonedWallClockToEpochMs,
} from "../../convex/lib/fantasyConstants";
import {
  absorbingWindowFor,
  constituteGameweeks,
  MIDWEEK_ABSORPTION_MIN_FIXTURES,
  reconcileGameweeks,
  seasonLabel,
  windowFor,
} from "../../convex/lib/fantasyGameweekWindows";

/** Paris wall clock → epoch ms. Every literal in this file goes through it. */
function paris(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return zonedWallClockToEpochMs(year, month, day, hour, minute, FINALITY_TIME_ZONE);
}

// 2026-08-21 is a Friday; the week that follows is the reference week used
// throughout. It is also the real opening weekend of season 2026 — the season
// gate measured league 39's first fixture at 2026-08-21T19:00:00Z.
const FRI = { y: 2026, m: 8, d: 21 };
const SAT = { y: 2026, m: 8, d: 22 };
const SUN = { y: 2026, m: 8, d: 23 };
const MON = { y: 2026, m: 8, d: 24 };
const TUE = { y: 2026, m: 8, d: 25 };
const WED = { y: 2026, m: 8, d: 26 };
const THU = { y: 2026, m: 8, d: 27 };
const NEXT_FRI = { y: 2026, m: 8, d: 28 };

describe("windowFor — weekend windows", () => {
  const weekendStart = paris(FRI.y, FRI.m, FRI.d, 0, 0);
  const weekendEnd = paris(TUE.y, TUE.m, TUE.d, 0, 0);
  const weekendFinality = paris(TUE.y, TUE.m, TUE.d, 23, 59);

  it.each([
    ["Friday 00:00 (first instant)", paris(FRI.y, FRI.m, FRI.d, 0, 0)],
    ["Friday 20:45", paris(FRI.y, FRI.m, FRI.d, 20, 45)],
    ["Saturday 15:00", paris(SAT.y, SAT.m, SAT.d, 15, 0)],
    ["Sunday 17:30", paris(SUN.y, SUN.m, SUN.d, 17, 30)],
    ["Monday 21:00", paris(MON.y, MON.m, MON.d, 21, 0)],
  ])("places %s in the weekend window", (_label, instant) => {
    const window = windowFor(instant);
    expect(window.kind).toBe("weekend");
    expect(window.startsAt).toBe(weekendStart);
    expect(window.endsAt).toBe(weekendEnd);
    expect(window.finalityAt).toBe(weekendFinality);
  });

  it("gives every kickoff in the run the SAME window key", () => {
    const keys = new Set(
      [
        paris(FRI.y, FRI.m, FRI.d, 20, 45),
        paris(SAT.y, SAT.m, SAT.d, 15, 0),
        paris(SUN.y, SUN.m, SUN.d, 17, 30),
        paris(MON.y, MON.m, MON.d, 21, 0),
      ].map((t) => windowFor(t).key),
    );
    expect([...keys]).toEqual(["weekend:2026-08-21"]);
  });
});

describe("windowFor — midweek windows", () => {
  const midweekStart = paris(TUE.y, TUE.m, TUE.d, 0, 0);
  const midweekEnd = paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 0, 0);
  const midweekFinality = paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 23, 59);

  it.each([
    ["Tuesday 00:00 (first instant)", paris(TUE.y, TUE.m, TUE.d, 0, 0)],
    ["Tuesday 21:00", paris(TUE.y, TUE.m, TUE.d, 21, 0)],
    ["Wednesday 20:00", paris(WED.y, WED.m, WED.d, 20, 0)],
    ["Thursday 18:45", paris(THU.y, THU.m, THU.d, 18, 45)],
  ])("places %s in the midweek window", (_label, instant) => {
    const window = windowFor(instant);
    expect(window.kind).toBe("midweek");
    expect(window.startsAt).toBe(midweekStart);
    expect(window.endsAt).toBe(midweekEnd);
    expect(window.finalityAt).toBe(midweekFinality);
  });

  it("settles a midweek gameweek on FRIDAY, not the following Tuesday", () => {
    // The whole reason a window-derived finality exists: FW-1's deleted
    // finalityAtOrAfter only ever answered "Tuesday", which is four days late
    // for every midweek round.
    const wednesday = paris(WED.y, WED.m, WED.d, 20, 0);
    expect(windowFor(wednesday).finalityAt).toBe(
      paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 23, 59),
    );
    const tuesdayAfter = paris(2026, 9, 1, 23, 59); // the answer FW-1 would give
    expect(windowFor(wednesday).finalityAt).not.toBe(tuesdayAfter);
  });
});

describe("windowFor — the boundary the ruling's wording hides", () => {
  it("keeps Monday 23:59:59.999 in the WEEKEND window", () => {
    const lastMondayInstant = paris(MON.y, MON.m, MON.d, 23, 59) + 59_999;
    const window = windowFor(lastMondayInstant);
    expect(window.kind).toBe("weekend");
    expect(window.key).toBe("weekend:2026-08-21");
  });

  it("moves Tuesday 00:00:00.000 into the MIDWEEK window", () => {
    const window = windowFor(paris(TUE.y, TUE.m, TUE.d, 0, 0));
    expect(window.kind).toBe("midweek");
    expect(window.key).toBe("midweek:2026-08-25");
  });

  it("keeps Thursday 23:59:59.999 midweek and Friday 00:00 weekend", () => {
    const lastThursday = paris(THU.y, THU.m, THU.d, 23, 59) + 59_999;
    expect(windowFor(lastThursday).kind).toBe("midweek");
    expect(windowFor(paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 0, 0)).kind).toBe("weekend");
  });

  it("tiles the week with no gap and no overlap", () => {
    // Walk the full week in 30-minute steps: every instant lands in exactly one
    // window, and consecutive windows abut exactly (endsAt === next startsAt).
    const start = paris(FRI.y, FRI.m, FRI.d, 0, 0);
    const seen = new Map<string, { startsAt: number; endsAt: number }>();
    for (let t = start; t < start + 7 * 86_400_000; t += 30 * 60_000) {
      const w = windowFor(t);
      expect(t).toBeGreaterThanOrEqual(w.startsAt);
      expect(t).toBeLessThan(w.endsAt);
      seen.set(w.key, { startsAt: w.startsAt, endsAt: w.endsAt });
    }
    const ordered = [...seen.values()].sort((a, b) => a.startsAt - b.startsAt);
    expect(ordered.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].startsAt).toBe(ordered[i - 1].endsAt);
    }
  });
});

describe("windowFor — DST", () => {
  // Europe/Paris springs forward on the last Sunday of March (2027-03-28) and
  // falls back on the last Sunday of October (2026-10-25). Both land mid-weekend
  // window, which is exactly where a fixed 4x86 400 000 ms span would drift.
  it("keeps the spring-forward weekend anchored to midnight", () => {
    const sunday = paris(2027, 3, 28, 15, 0);
    const window = windowFor(sunday);
    expect(window.kind).toBe("weekend");
    expect(window.startsAt).toBe(paris(2027, 3, 26, 0, 0)); // Friday 00:00
    expect(window.endsAt).toBe(paris(2027, 3, 30, 0, 0)); // Tuesday 00:00
    expect(window.finalityAt).toBe(paris(2027, 3, 30, 23, 59));
    // 4 days minus the hour the clocks stole.
    expect(window.endsAt - window.startsAt).toBe(4 * 86_400_000 - 3_600_000);
  });

  it("keeps the fall-back weekend anchored to midnight", () => {
    const sunday = paris(2026, 10, 25, 15, 0);
    const window = windowFor(sunday);
    expect(window.kind).toBe("weekend");
    expect(window.startsAt).toBe(paris(2026, 10, 23, 0, 0));
    expect(window.endsAt).toBe(paris(2026, 10, 27, 0, 0));
    expect(window.finalityAt).toBe(paris(2026, 10, 27, 23, 59));
    expect(window.endsAt - window.startsAt).toBe(4 * 86_400_000 + 3_600_000);
  });
});

describe("finality lands on 23:59 Paris wall clock", () => {
  /**
   * Built from formatToParts rather than format() so the assertion pins the
   * wall clock and not an ICU version's comma placement.
   */
  const partsInParis = (t: number): string => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: FINALITY_TIME_ZONE,
      hourCycle: "h23",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const at = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
    return `${at("weekday")} ${at("hour")}:${at("minute")}`;
  };

  it("lands on Tuesday 23:59 Paris for a winter weekend (CET, UTC+1)", () => {
    const janSaturday = paris(2027, 1, 9, 15, 0); // Sat 2027-01-09
    const finality = windowFor(janSaturday).finalityAt;
    expect(partsInParis(finality)).toBe("Tue 23:59");
    // 23:59 CET == 22:59Z
    expect(new Date(finality).toISOString()).toBe("2027-01-12T22:59:00.000Z");
  });

  it("lands on Tuesday 23:59 Paris for a summer weekend (CEST, UTC+2)", () => {
    const augSaturday = paris(2026, 8, 15, 15, 0); // Sat 2026-08-15
    const finality = windowFor(augSaturday).finalityAt;
    expect(partsInParis(finality)).toBe("Tue 23:59");
    // 23:59 CEST == 21:59Z — an hour earlier in UTC than the winter cut. A
    // fixed UTC+1 would have put this at 22:59Z, i.e. 00:59 local Wednesday.
    expect(new Date(finality).toISOString()).toBe("2026-08-18T21:59:00.000Z");
  });

  it("lands on Friday 23:59 Paris for a midweek round, in both seasons", () => {
    const janWednesday = paris(2027, 1, 6, 20, 0);
    const augWednesday = paris(2026, 8, 19, 20, 0);
    expect(partsInParis(windowFor(janWednesday).finalityAt)).toBe("Fri 23:59");
    expect(partsInParis(windowFor(augWednesday).finalityAt)).toBe("Fri 23:59");
  });

  it("is the same local wall clock on both sides of the DST switch", () => {
    // Paris springs forward 2027-03-28; these two weekends straddle it.
    const before = windowFor(paris(2027, 3, 20, 15, 0)).finalityAt;
    const after = windowFor(paris(2027, 4, 3, 15, 0)).finalityAt;
    expect(partsInParis(before)).toBe("Tue 23:59");
    expect(partsInParis(after)).toBe("Tue 23:59");
    // …but a different UTC offset, which is exactly what "wall clock" means.
    expect(new Date(before).getUTCHours()).toBe(22);
    expect(new Date(after).getUTCHours()).toBe(21);
  });

  it("gives every gameweek of a season a finality strictly after its last kickoff", () => {
    // The invariant that actually matters downstream: a gameweek can never
    // settle before a fixture in it has finished.
    for (let week = 0; week < 52; week += 1) {
      for (const dayOffset of [0, 1, 2, 3, 4, 5, 6]) {
        const kickoff = paris(2026, 8, 21, 20, 0) + (week * 7 + dayOffset) * 86_400_000;
        const window = windowFor(kickoff);
        expect(window.finalityAt).toBeGreaterThan(kickoff);
        expect(window.finalityAt).toBeGreaterThanOrEqual(window.endsAt);
      }
    }
  });
});

/**
 * A FULL midweek round: enough fixtures to clear the absorption threshold
 * (MIDWEEK_ABSORPTION_MIN_FIXTURES). `kickoffs` counts one entry per fixture,
 * so five Wednesday kickoffs make this window a gameweek in its own right —
 * fewer and it would fold forward into the next weekend, which is what the
 * absorption describe block below asserts on purpose.
 */
const midweekRound = Array.from({ length: MIDWEEK_ABSORPTION_MIN_FIXTURES }, (_, i) =>
  paris(WED.y, WED.m, WED.d, 18, i),
);

describe("constituteGameweeks", () => {
  it("numbers windows chronologically from 1", () => {
    const gameweeks = constituteGameweeks([
      paris(SAT.y, SAT.m, SAT.d, 15, 0),
      ...midweekRound,
      paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 20, 45),
    ]);
    expect(gameweeks.map((g) => g.gwNumber)).toEqual([1, 2, 3]);
    expect(gameweeks.map((g) => g.kind)).toEqual(["weekend", "midweek", "weekend"]);
  });

  it("treats a FULL midweek round as a gameweek in its own right", () => {
    const gameweeks = constituteGameweeks([
      paris(SAT.y, SAT.m, SAT.d, 15, 0),
      ...midweekRound,
    ]);
    expect(gameweeks).toHaveLength(2);
    expect(gameweeks[1].kind).toBe("midweek");
  });

  it("dedupes many fixtures across many leagues into one gameweek", () => {
    const kickoffs = [
      paris(FRI.y, FRI.m, FRI.d, 20, 45),
      paris(SAT.y, SAT.m, SAT.d, 13, 30),
      paris(SAT.y, SAT.m, SAT.d, 16, 0),
      paris(SAT.y, SAT.m, SAT.d, 18, 30),
      paris(SUN.y, SUN.m, SUN.d, 15, 0),
      paris(SUN.y, SUN.m, SUN.d, 17, 30),
      paris(MON.y, MON.m, MON.d, 21, 0),
    ];
    expect(constituteGameweeks(kickoffs)).toHaveLength(1);
  });

  it("is order-independent", () => {
    const kickoffs = [
      ...midweekRound,
      paris(SAT.y, SAT.m, SAT.d, 15, 0),
      paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 20, 45),
    ];
    const forward = constituteGameweeks(kickoffs);
    const reversed = constituteGameweeks([...kickoffs].reverse());
    expect(reversed).toEqual(forward);
  });

  it("skips empty weeks rather than counting them (international breaks)", () => {
    // Two weekends three weeks apart produce gameweeks 1 and 2, not 1 and 4.
    const gameweeks = constituteGameweeks([
      paris(SAT.y, SAT.m, SAT.d, 15, 0),
      paris(SAT.y, SAT.m, SAT.d, 15, 0) + 21 * 86_400_000,
    ]);
    expect(gameweeks.map((g) => g.gwNumber)).toEqual([1, 2]);
  });

  it("returns nothing for no fixtures", () => {
    expect(constituteGameweeks([])).toEqual([]);
  });

  describe("coverage start — historical imports take non-positive ordinals (FW-POLISH-3 O1)", () => {
    const importedKick = paris(SAT.y, SAT.m, SAT.d, 15, 0);
    const openingKick = paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 20, 45);

    it("gives ordinal 1 to the first playable window, -1 to the import before coverage", () => {
      const importedFinality = windowFor(importedKick).finalityAt;
      const coverageStart = importedFinality + 1;
      const gameweeks = constituteGameweeks(
        [importedKick, openingKick],
        undefined,
        coverageStart,
      );
      expect(gameweeks.map((g) => g.gwNumber)).toEqual([-1, 1]);
    });

    it("never assigns ordinal 0 (ingestion's unresolved sentinel)", () => {
      const kicks = [importedKick, ...midweekRound, openingKick];
      const coverageStart = windowFor(openingKick).finalityAt + 1;
      const gameweeks = constituteGameweeks(kicks, undefined, coverageStart);
      expect(gameweeks.map((g) => g.gwNumber)).toEqual([-3, -2, -1]);
      expect(gameweeks.map((g) => g.gwNumber)).not.toContain(0);
    });

    it("counts back chronologically: the import nearest coverage is -1", () => {
      const coverageStart = windowFor(midweekRound[0]).finalityAt + 1;
      const gameweeks = constituteGameweeks(
        [importedKick, ...midweekRound, openingKick],
        undefined,
        coverageStart,
      );
      expect(gameweeks.map((g) => g.gwNumber)).toEqual([-2, -1, 1]);
    });

    it("a window still open at coverage start is playable and numbered from 1", () => {
      // Coverage begins mid-window (the FW-SHIP case): finality has not
      // passed, a board can open, so it keeps ordinal 1.
      const coverageStart = windowFor(importedKick).finalityAt - 1;
      const gameweeks = constituteGameweeks(
        [importedKick, openingKick],
        undefined,
        coverageStart,
      );
      expect(gameweeks.map((g) => g.gwNumber)).toEqual([1, 2]);
    });

    it("without a coverage start the numbering is unchanged", () => {
      const gameweeks = constituteGameweeks([importedKick, openingKick]);
      expect(gameweeks.map((g) => g.gwNumber)).toEqual([1, 2]);
    });

    it("relabeling through reconcile shifts ordinals without touching identity", () => {
      // The FW-POLISH-3 prod shape: stored rows numbered 1..3 chronologically;
      // the first is a pre-coverage import. Reconcile must patch labels on the
      // SAME rows (identity = finalityAt) and insert nothing.
      const kicks = [importedKick, ...midweekRound, openingKick];
      const stored = constituteGameweeks(kicks).map((w, i) => ({
        gwNumber: w.gwNumber,
        leagueIds: [39],
        finalityAt: w.finalityAt,
        id: `doc${i}`,
      }));
      const coverageStart = windowFor(importedKick).finalityAt + 1;
      const windows = constituteGameweeks(kicks, undefined, coverageStart).map(
        (w) => ({ gwNumber: w.gwNumber, leagueIds: [39], finalityAt: w.finalityAt }),
      );
      const plan = reconcileGameweeks(stored, windows);
      expect(plan.inserts).toEqual([]);
      expect(plan.conflicts).toEqual([]);
      expect(
        plan.patches.map((p) => [p.current.id, p.current.gwNumber, p.gwNumber]),
      ).toEqual([
        ["doc0", 1, -1],
        ["doc1", 2, 1],
        ["doc2", 3, 2],
      ]);
    });
  });
});

describe("constituteGameweeks — thin midweek absorption (amendment 2026-08-19)", () => {
  // The prod shape that forced the amendment: LaLiga's staggered opening round
  // left two fixtures on the Tue/Wed after the opening weekend, and those two
  // fixtures constituted a whole gameweek that blocked the next weekend's
  // board for the entire build week.
  const openingWeekend = [
    paris(SAT.y - 0, 8, 15, 15, 0), // Sat 2026-08-15
    paris(2026, 8, 16, 17, 30), // Sun 2026-08-16
  ];
  const stragglers = [
    paris(2026, 8, 19, 21, 0), // Wed 2026-08-19
    paris(2026, 8, 20, 21, 0), // Thu 2026-08-20
  ];
  const nextWeekend = [
    paris(FRI.y, FRI.m, FRI.d, 20, 45), // Fri 2026-08-21
    paris(SAT.y, SAT.m, SAT.d, 15, 0),
    paris(SUN.y, SUN.m, SUN.d, 17, 30),
  ];

  it("folds a thin midweek window forward into the following weekend", () => {
    const gameweeks = constituteGameweeks([
      ...openingWeekend,
      ...stragglers,
      ...nextWeekend,
    ]);
    expect(gameweeks.map((g) => [g.gwNumber, g.kind])).toEqual([
      [1, "weekend"],
      [2, "weekend"],
    ]);
    // The absorbed window's key resolves to the weekend gameweek, which is
    // how ingestion files the straggler fixtures under it.
    expect(gameweeks[1].keys).toEqual([
      "weekend:2026-08-21",
      "midweek:2026-08-18",
    ]);
    // Finality stays the weekend's own Tuesday cut — absorption never delays
    // or advances settlement.
    expect(gameweeks[1].finalityAt).toBe(paris(TUE.y, TUE.m, TUE.d, 23, 59));
  });

  it("keeps a window at exactly the threshold as its own gameweek", () => {
    const atThreshold = Array.from(
      { length: MIDWEEK_ABSORPTION_MIN_FIXTURES },
      (_, i) => paris(2026, 8, 19, 18, i),
    );
    const gameweeks = constituteGameweeks([...atThreshold, ...nextWeekend]);
    expect(gameweeks.map((g) => g.kind)).toEqual(["midweek", "weekend"]);
  });

  it("absorbs at one below the threshold", () => {
    const oneBelow = Array.from(
      { length: MIDWEEK_ABSORPTION_MIN_FIXTURES - 1 },
      (_, i) => paris(2026, 8, 19, 18, i),
    );
    const gameweeks = constituteGameweeks([...oneBelow, ...nextWeekend]);
    expect(gameweeks.map((g) => g.kind)).toEqual(["weekend"]);
  });

  it("counts fixtures, not distinct kickoff instants", () => {
    // Five fixtures sharing one kickoff instant are a full round, not a thin
    // window — `kickoffs` carries one entry per fixture on purpose.
    const simultaneous = Array.from(
      { length: MIDWEEK_ABSORPTION_MIN_FIXTURES },
      () => paris(2026, 8, 19, 21, 0),
    );
    const gameweeks = constituteGameweeks([...simultaneous, ...nextWeekend]);
    expect(gameweeks.map((g) => g.kind)).toEqual(["midweek", "weekend"]);
  });

  it("constitutes the absorbing weekend even when it has no fixtures of its own", () => {
    const gameweeks = constituteGameweeks([...openingWeekend, ...stragglers]);
    expect(gameweeks.map((g) => [g.gwNumber, g.kind])).toEqual([
      [1, "weekend"],
      [2, "weekend"],
    ]);
    expect(gameweeks[1].keys).toContain("midweek:2026-08-18");
  });

  it("never absorbs a weekend window, however thin", () => {
    const gameweeks = constituteGameweeks([
      paris(2026, 8, 15, 15, 0), // a lone weekend fixture
      ...nextWeekend,
    ]);
    expect(gameweeks).toHaveLength(2);
    expect(gameweeks[0].keys).toEqual(["weekend:2026-08-14"]);
  });

  it("absorbingWindowFor maps a midweek window to the weekend that follows it", () => {
    const midweek = windowFor(stragglers[0]);
    const host = absorbingWindowFor(midweek);
    expect(host.kind).toBe("weekend");
    expect(host.key).toBe("weekend:2026-08-21");
  });

  it("stays order-independent and deterministic under absorption", () => {
    const kicks = [...nextWeekend, ...stragglers, ...openingWeekend];
    expect(constituteGameweeks([...kicks].reverse())).toEqual(
      constituteGameweeks(kicks),
    );
  });
});

describe("reconcileGameweeks — window identity survives ordinal shifts (FW-EXPAND)", () => {
  /** Constitute windows and shape them like the ingest's upsert payload. */
  function asUpserts(kickoffs: number[], leagueIds: number[] = [39]) {
    return constituteGameweeks(kickoffs).map((w) => ({
      gwNumber: w.gwNumber,
      leagueIds,
      finalityAt: w.finalityAt,
    }));
  }

  const weekendKick = paris(SAT.y, SAT.m, SAT.d, 15, 0);
  const nextWeekendKick = paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 20, 45);

  it("is a no-op when the window set is unchanged", () => {
    const windows = asUpserts([weekendKick, nextWeekendKick]);
    const existing = windows.map((w, i) => ({ ...w, id: `doc${i}` }));
    const plan = reconcileGameweeks(existing, windows);
    expect(plan.inserts).toEqual([]);
    expect(plan.patches).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("inserts a newly populated window and re-stamps later ordinals in place", () => {
    // Season known so far: two weekend windows numbered 1 and 2. A new
    // league's midweek round then populates the week between them.
    const before = asUpserts([weekendKick, nextWeekendKick]);
    const existing = before.map((w, i) => ({ ...w, id: `doc${i}` }));
    const after = asUpserts([weekendKick, ...midweekRound, nextWeekendKick]);

    const plan = reconcileGameweeks(existing, after);

    // The midweek window is the only insert, at ordinal 2.
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].gwNumber).toBe(2);

    // The second weekend KEEPS ITS DOCUMENT (identity: finalityAt) and only
    // its label moves 2 → 3. Nothing is re-purposed.
    expect(plan.patches).toHaveLength(1);
    expect(plan.patches[0].current.id).toBe("doc1");
    expect(plan.patches[0].gwNumber).toBe(3);
    expect(plan.conflicts).toEqual([]);
  });

  it("patches leagueIds when a window gains a league without moving ordinals", () => {
    const windows = asUpserts([weekendKick, nextWeekendKick], [39, 88]);
    const existing = asUpserts([weekendKick, nextWeekendKick], [39]).map((w, i) => ({
      ...w,
      id: `doc${i}`,
    }));
    const plan = reconcileGameweeks(existing, windows);
    expect(plan.inserts).toEqual([]);
    expect(plan.patches).toHaveLength(2);
    expect(plan.patches.map((p) => p.leagueIds)).toEqual([
      [39, 88],
      [39, 88],
    ]);
  });

  it("flags a conflict when an orphaned row's ordinal is claimed", () => {
    // A stored row whose window no longer exists, holding ordinal 2 — while
    // the fresh numbering also assigns 2. Writing both would make the
    // by_season_gwNumber lookup ambiguous.
    const windows = asUpserts([weekendKick, ...midweekRound, nextWeekendKick]);
    const orphan = {
      gwNumber: 2,
      leagueIds: [39],
      finalityAt: paris(2027, 6, 29, 23, 59), // matches no constituted window
      id: "orphan",
    };
    const existing = [
      { ...windows[0], id: "doc0" },
      orphan,
      { ...windows[2], id: "doc2" },
    ];
    const plan = reconcileGameweeks(existing, windows);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].id).toBe("orphan");
  });

  it("leaves an orphaned row alone when its ordinal is not claimed", () => {
    const windows = asUpserts([weekendKick]);
    const orphan = {
      gwNumber: 40,
      leagueIds: [39],
      finalityAt: paris(2027, 6, 29, 23, 59),
      id: "orphan",
    };
    const plan = reconcileGameweeks([{ ...windows[0], id: "doc0" }, orphan], windows);
    expect(plan.inserts).toEqual([]);
    expect(plan.patches).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });
});

describe("seasonLabel", () => {
  it("renders the provider's opening-year season as a span", () => {
    expect(seasonLabel(2026)).toBe("2026-2027");
    expect(seasonLabel(2024)).toBe("2024-2025");
  });
});
