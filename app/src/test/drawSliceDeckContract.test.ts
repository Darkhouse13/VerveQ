/**
 * Ticket E4 — Daily Deck slice generator contract.
 *
 * Pins the sliceDeck profile guarantees on the COMMITTED real-v4 card set:
 * determinism, exact position quotas, era floors, nation shaping, club caps,
 * fame mix, anchor coverage, rating floor, and subset/ordering discipline.
 * Uses the default (triple-score) combo scorer — the oracle-backed scorer is
 * an acceptance/serving concern and is exercised by calibrate --eval.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  sliceDeck,
  sliceTripleScore,
  DAILY_SLICE_CONFIG_V1,
  type Card,
  type PositionId,
} from "@/lib/drawEngine";

interface RealRow {
  cardId: string;
  name: string;
  rating: number;
  clubs: { tag: string }[];
  nation: string;
  eraLabel: string;
  eraIndex: number;
  position: PositionId;
}

const rows = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "convex", "data", "drawCardsReal.candidates.json"), "utf8"),
) as RealRow[];
const FULL_SET: Card[] = rows.map((r) => ({
  id: r.cardId,
  name: r.name,
  rating: r.rating,
  clubs: r.clubs.map((c) => c.tag),
  nation: r.nation,
  era: r.eraLabel,
  eraIndex: r.eraIndex,
  position: r.position,
}));

const CFG = DAILY_SLICE_CONFIG_V1;
const SEEDS = ["2026-07-17", "2026-07-18", "2026-08-01"];

describe("drawSliceDeckContract (Ticket E4)", () => {
  // Timeouts: best-of-64 combo search costs ~1s per build (E5 raised
  // comboCandidates for the serving policy), and each case builds several.
  it("is deterministic: same (dateSeed, fullSet, cfg) ⇒ identical slice", { timeout: 30_000 }, () => {
    for (const seed of SEEDS) {
      const a = sliceDeck(seed, FULL_SET, CFG);
      const b = sliceDeck(seed, FULL_SET, CFG);
      expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    }
  });

  it("varies across dateSeeds", { timeout: 30_000 }, () => {
    const ids = SEEDS.map((s) => sliceDeck(s, FULL_SET, CFG).map((c) => c.id).join(","));
    expect(new Set(ids).size).toBeGreaterThan(1);
  });

  it("holds the full profile on every slice", { timeout: 30_000 }, () => {
    const fullById = new Map(FULL_SET.map((c) => [c.id, c]));
    // Exact icon pool: top-K by rating, ties by id — mirrors sliceDeck's rule.
    const iconPool = new Set(
      FULL_SET.slice()
        .sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1))
        .slice(0, CFG.iconPoolSize)
        .map((c) => c.id),
    );
    for (const seed of SEEDS) {
      const slice = sliceDeck(seed, FULL_SET, CFG);
      expect(slice).toHaveLength(CFG.sliceSize);
      // subset, unique, id-sorted (board derivation samples by array position)
      const ids = slice.map((c) => c.id);
      expect(new Set(ids).size).toBe(CFG.sliceSize);
      expect(ids).toEqual([...ids].sort());
      for (const c of slice) expect(fullById.get(c.id)).toEqual(c);
      // exact position quotas (10/30/30/30 of sliceSize)
      const pos: Record<string, number> = {};
      for (const c of slice) pos[c.position] = (pos[c.position] ?? 0) + 1;
      expect(pos.GK).toBe(5);
      expect(pos.DEF).toBe(14);
      expect(pos.MID).toBe(14);
      expect(pos.ATT).toBe(13);
      // era floors
      const eras = [0, 0, 0, 0];
      for (const c of slice) eras[c.eraIndex]++;
      for (const n of eras) expect(n).toBeGreaterThanOrEqual(CFG.minPerEra);
      // nation shaping
      const nations = new Map<string, number>();
      for (const c of slice) nations.set(c.nation, (nations.get(c.nation) ?? 0) + 1);
      expect(nations.size).toBe(CFG.nationCount);
      for (const n of nations.values()) {
        expect(n).toBeGreaterThanOrEqual(CFG.minPerNation);
        expect(n).toBeLessThanOrEqual(CFG.maxPerNation);
      }
      // club cap
      const clubs = new Map<string, number>();
      for (const c of slice) for (const t of c.clubs) clubs.set(t, (clubs.get(t) ?? 0) + 1);
      for (const n of clubs.values()) expect(n).toBeLessThanOrEqual(CFG.maxPerClub);
      // fame mix + rating floor
      expect(slice.filter((c) => iconPool.has(c.id)).length).toBeGreaterThanOrEqual(CFG.minIcons);
      for (const c of slice) expect(c.rating).toBeGreaterThanOrEqual(CFG.minCardRating);
      // triple score is positive (chains exist to be found)
      expect(sliceTripleScore(slice)).toBeGreaterThan(0);
    }
  });

  it("fails closed when the profile is unsatisfiable", () => {
    expect(() =>
      sliceDeck("x", FULL_SET, { ...CFG, minPerEra: 40 }),
    ).toThrow(/no feasible slice/);
  });
});
