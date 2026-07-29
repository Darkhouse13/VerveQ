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
 *  3. Agreement with FW-1. `finalityAtOrAfter` and the new window finality
 *     must give the SAME answer for every weekend kickoff, or FW-1's landed
 *     lock engine and FW-2's ingestion disagree about when a gameweek settles.
 *
 * No database, no clock, no network.
 */

import { describe, expect, it } from "vitest";

import {
  FINALITY_TIME_ZONE,
  finalityAtOrAfter,
  zonedWallClockToEpochMs,
} from "../../convex/lib/fantasyConstants";
import {
  constituteGameweeks,
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
    // The whole reason finalityForWindow exists rather than reusing FW-1's
    // finalityAtOrAfter, which only ever answers "Tuesday".
    const wednesday = paris(WED.y, WED.m, WED.d, 20, 0);
    expect(windowFor(wednesday).finalityAt).toBe(
      paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 23, 59),
    );
    expect(windowFor(wednesday).finalityAt).not.toBe(finalityAtOrAfter(wednesday));
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

describe("agreement with the landed FW-1 finality rule", () => {
  it("matches finalityAtOrAfter for every weekend kickoff across a season", () => {
    // FW-1's STOP-5 ruling and FW-2's constitution must not disagree about when
    // a weekend settles. Walk a year of Friday-to-Monday kickoffs, DST included.
    let checked = 0;
    for (let week = 0; week < 52; week += 1) {
      const friday = paris(2026, 8, 21, 12, 0) + week * 7 * 86_400_000;
      for (let dayOffset = 0; dayOffset < 4; dayOffset += 1) {
        const kickoff = friday + dayOffset * 86_400_000;
        const window = windowFor(kickoff);
        if (window.kind !== "weekend") continue; // DST can shift the 12:00 anchor
        expect(window.finalityAt).toBe(finalityAtOrAfter(kickoff));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(180);
  });
});

describe("constituteGameweeks", () => {
  it("numbers windows chronologically from 1", () => {
    const gameweeks = constituteGameweeks([
      paris(SAT.y, SAT.m, SAT.d, 15, 0),
      paris(WED.y, WED.m, WED.d, 20, 0),
      paris(NEXT_FRI.y, NEXT_FRI.m, NEXT_FRI.d, 20, 45),
    ]);
    expect(gameweeks.map((g) => g.gwNumber)).toEqual([1, 2, 3]);
    expect(gameweeks.map((g) => g.kind)).toEqual(["weekend", "midweek", "weekend"]);
  });

  it("treats a midweek round as a gameweek in its own right", () => {
    const gameweeks = constituteGameweeks([
      paris(SAT.y, SAT.m, SAT.d, 15, 0),
      paris(WED.y, WED.m, WED.d, 20, 0),
    ]);
    expect(gameweeks).toHaveLength(2);
    expect(gameweeks[1].kind).toBe("midweek");
  });

  it("dedupes many fixtures across five leagues into one gameweek", () => {
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
      paris(WED.y, WED.m, WED.d, 20, 0),
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
});

describe("seasonLabel", () => {
  it("renders the provider's opening-year season as a span", () => {
    expect(seasonLabel(2026)).toBe("2026-2027");
    expect(seasonLabel(2024)).toBe("2024-2025");
  });
});
