/**
 * Ticket E5-F — real-v5 editorial-rating card set contract.
 *
 * real-v5 is the editorial ratingV5 pass (docs/RATING_ANCHORS.md) shipped as a
 * NEW setVersion, additive alongside real-v4. This pins the invariants the
 * serving path depends on, and the PARITY invariant that guarantees v5 is v4
 * with ONLY ratings + the 12 position moves changed — every other CIE fact
 * (clubs, nation, era, fameRank, name, cardId) byte-identical.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface RealCard {
  cardId: string;
  name: string;
  rating: number;
  position: "GK" | "DEF" | "MID" | "ATT";
  clubs: { tag: string; displayCode: string; fullName: string }[];
  nation: string;
  eraLabel: string;
  eraIndex: number;
  fameRank: number;
}

const dataDir = path.join(__dirname, "..", "..", "convex", "data");
const read = (f: string): RealCard[] =>
  JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8")) as RealCard[];

const v4 = read("drawCardsReal.candidates.json");
const v5 = read("drawCardsReal.candidates.v5.json");

// The 12 owner-ruled position moves (data/ratings-v5/position-moves.json).
const MOVES: Record<string, string> = {
  real_0025: "ATT", real_0327: "DEF", real_0190: "ATT", real_0168: "ATT",
  real_0047: "ATT", real_0125: "MID", real_0336: "MID", real_0319: "ATT",
  real_0339: "ATT", real_0353: "ATT", real_0285: "MID", real_0038: "ATT",
};

describe("real-v5 card set (Ticket E5-F)", () => {
  it("has 430 cards, unique ids, all fully rated in [61,95]", () => {
    expect(v5).toHaveLength(430);
    expect(new Set(v5.map((c) => c.cardId)).size).toBe(430);
    for (const c of v5) {
      expect(Number.isInteger(c.rating)).toBe(true);
      expect(c.rating).toBeGreaterThanOrEqual(61);
      expect(c.rating).toBeLessThanOrEqual(95);
    }
  });

  it("carries the post-move position counts GK43 / DEF127 / MID123 / ATT137", () => {
    const by = (p: string) => v5.filter((c) => c.position === p).length;
    expect(by("GK")).toBe(43);
    expect(by("DEF")).toBe(127);
    expect(by("MID")).toBe(123);
    expect(by("ATT")).toBe(137);
  });

  it("has exactly the four per-position 95 GOATs and no other 95", () => {
    const at95 = v5.filter((c) => c.rating >= 95).map((c) => c.name).sort();
    expect(at95).toEqual(
      ["Franz Beckenbauer", "Lionel Messi", "Manuel Neuer", "Zinedine Zidane"],
    );
  });

  it("is v4 with ONLY rating + the 12 moves changed — every other fact byte-identical", () => {
    expect(v5).toHaveLength(v4.length);
    const v4by = new Map(v4.map((c) => [c.cardId, c]));
    for (const c of v5) {
      const o = v4by.get(c.cardId);
      expect(o).toBeDefined();
      // position: moved iff in MOVES, else identical to v4.
      expect(c.position).toBe(MOVES[c.cardId] ?? o!.position);
      // every non-(rating/position) field byte-identical.
      expect({ ...c, rating: 0, position: "X" }).toEqual({ ...o!, rating: 0, position: "X" });
    }
  });

  it("matches the drawSeed import shape (clubs objects with a tag)", () => {
    for (const c of v5) {
      expect(Array.isArray(c.clubs)).toBe(true);
      for (const club of c.clubs) expect(typeof club.tag).toBe("string");
    }
  });
});
