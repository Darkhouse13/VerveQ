import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import players from "../../convex/data/whos_older_players.json";
import {
  GAP_BANDS,
  WHOS_OLDER_DAILY_ROUNDS,
  buildDailyPairs,
  editionNumberForDate,
  endlessBandFor,
  gapDays,
  olderSide,
  pickPair,
  seededRandom,
} from "../../convex/lib/whosOlder";
import { whosOlderShortLinkTarget } from "@/lib/playShortLink";

const appDir = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(appDir, rel), "utf8");

describe("Who's Older pool", () => {
  it("has one row per person with a real day-precision birth date", () => {
    expect(players.length).toBeGreaterThanOrEqual(200);
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length);
    for (const p of players) {
      expect(p.id).toMatch(/^Q\d+$/);
      expect(p.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${p.dob}T00:00:00Z`))).toBe(false);
    }
  });
});

describe("Who's Older daily", () => {
  const days = Array.from({ length: 60 }, (_, i) =>
    new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10),
  );

  it("is identical for everyone on the same date and differs across dates", () => {
    expect(buildDailyPairs(players, "2026-10-01")).toEqual(buildDailyPairs(players, "2026-10-01"));
    expect(buildDailyPairs(players, "2026-10-01")).not.toEqual(buildDailyPairs(players, "2026-10-02"));
  });

  it("deals ten pairs, no player twice, no same-birthday pair, in shrinking bands", () => {
    for (const day of days) {
      const pairs = buildDailyPairs(players, day);
      expect(pairs).toHaveLength(WHOS_OLDER_DAILY_ROUNDS);
      const ids = pairs.flatMap((p) => [p.a.id, p.b.id]);
      expect(new Set(ids).size).toBe(ids.length);
      pairs.forEach((pair, round) => {
        const gap = gapDays(pair.a, pair.b);
        expect(gap).toBeGreaterThan(0);
        const [min, max] = GAP_BANDS[round];
        // The pool is wide enough that no band ever needs to widen.
        expect(gap >= min && gap < max).toBe(true);
      });
    }
  });

  it("does not put the older player on the same side every time", () => {
    const sides = days.flatMap((d) => buildDailyPairs(players, d).map(olderSide));
    const topShare = sides.filter((s) => s === "a").length / sides.length;
    expect(topShare).toBeGreaterThan(0.4);
    expect(topShare).toBeLessThan(0.6);
  });

  it("numbers editions from the launch epoch", () => {
    expect(editionNumberForDate("2026-09-28")).toBe(1);
    expect(editionNumberForDate("2026-10-28")).toBe(31);
  });
});

describe("Who's Older endless", () => {
  it("ramps through the daily bands, then stays in the tightest four", () => {
    const rand = seededRandom("t");
    for (let s = 0; s < GAP_BANDS.length; s++) expect(endlessBandFor(s, rand)).toBe(s);
    for (let s = 10; s < 200; s++) {
      const band = endlessBandFor(s, rand);
      expect(band).toBeGreaterThanOrEqual(GAP_BANDS.length - 4);
      expect(band).toBeLessThan(GAP_BANDS.length);
    }
  });

  it("widens an empty band instead of failing, and stops only when players run out", () => {
    const tiny = [
      { id: "Q1", name: "A", dob: "1980-01-01" },
      { id: "Q2", name: "B", dob: "1990-01-01" },
    ];
    // Only a ten-year gap exists; ask for the tightest band.
    expect(pickPair(tiny, GAP_BANDS.length - 1, new Set(), seededRandom("x"))).not.toBeNull();
    expect(pickPair(tiny, 0, new Set(["Q1"]), seededRandom("x"))).toBeNull();
  });
});

describe("Who's Older wiring", () => {
  it("never sends a birth date for the round still being answered", () => {
    const server = read("convex/whosOlder.ts");
    const view = server.slice(server.indexOf("function publicView"), server.indexOf("async function loadOwned"));
    expect(view).toMatch(/pending: pending \? \{ a: \{ name: pending\.aName \}, b: \{ name: pending\.bName \} \}/);
    expect(view).toContain("session.rounds.slice(0, session.current)");
  });

  it("is reachable from Home, Compete TODAY and the caption short link", () => {
    expect(read("src/App.tsx")).toContain('path="/v2/whos-older"');
    expect(read("src/pages/shell/ShellHomeScreen.tsx")).toContain("SHELL_ROUTES.whosOlderPlay");
    expect(read("src/pages/shell/CompeteModeGridScreen.tsx")).toMatch(/TODAY_KEYS\s*=\s*\[[^\]]*"whosOlder"/);
    expect(read("../deploy/nginx.conf")).toMatch(/\|older\|whos-older\|/);
    expect(whosOlderShortLinkTarget("")).toBe("/v2/whos-older?ref=older");
    expect(whosOlderShortLinkTarget("?ref=ig_bio")).toBe("/v2/whos-older?ref=ig_bio");
  });
});
