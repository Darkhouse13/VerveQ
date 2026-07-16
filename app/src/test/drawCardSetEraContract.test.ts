import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const CANDIDATES_PATH = "convex/data/drawCardsReal.candidates.json";
const DOSSIER_PATH = "convex/data/drawCardsReal.dossier.json";

type Card = { cardId: string; name: string; debutYear: number; eraIndex: number; eraLabel: string };
type Bucket = {
  eraIndex: number;
  eraLabel: string;
  peakYearMin: number | null;
  peakYearMax: number | null;
  debutYearMin: number | null;
  debutYearMax: number | null;
  cardCount: number;
  observedDebutYearRange: [number, number];
};

const cards: Card[] = read(CANDIDATES_PATH);
const dossier = read(DOSSIER_PATH);
const mapping = dossier.eraMapping;
const buckets: Bucket[] = mapping?.rule?.buckets ?? [];

/**
 * eraIndex is the one card field with no source behind it — an editorial
 * partition the dossier states as a rule (peakYear := debutYear + 5) rather
 * than as ranges. E2's blind verify stopped on the rule being absent: with
 * only ranges to go on, the buckets are unfalsifiable, since any mapping read
 * back off the cards confirms them by construction. These contracts keep the
 * stated rule and the committed cards from drifting apart in either direction.
 */

const bucketFor = (debutYear: number): number | null => {
  const peak = debutYear + 5;
  for (const b of buckets) {
    if ((b.peakYearMin === null || peak >= b.peakYearMin) && (b.peakYearMax === null || peak <= b.peakYearMax)) {
      return b.eraIndex;
    }
  }
  return null;
};

describe("draw real card set — era mapping", () => {
  it("is stated in the dossier as an editorial rule, not just ranges", () => {
    expect(mapping).toBeDefined();
    expect(mapping.provenance).toBe("editorial"); // a partition, never a truth claim
    expect(mapping.rule.derived).toBe("peakYear := debutYear + 5");
    expect(buckets).toHaveLength(4);
  });

  it("partitions peakYear contiguously, exhaustively, and open-ended at both ends", () => {
    const ordered = [...buckets].sort((a, b) => a.eraIndex - b.eraIndex);
    expect(ordered.map((b) => b.eraIndex)).toEqual([0, 1, 2, 3]);
    expect(ordered[0].peakYearMin).toBeNull(); // pre-1960 icons have a home
    expect(ordered[ordered.length - 1].peakYearMax).toBeNull(); // future debuts have a home
    for (let i = 1; i < ordered.length; i++) {
      // no gap and no overlap: every peakYear lands in exactly one bucket
      expect(ordered[i].peakYearMin).toBe(ordered[i - 1].peakYearMax! + 1);
    }
  });

  it("assigns every committed card the eraIndex the rule derives", () => {
    const mismatches = cards
      .filter((c) => bucketFor(c.debutYear) !== c.eraIndex)
      .map((c) => `${c.cardId} ${c.name}: debut=${c.debutYear} committed=${c.eraIndex} rule=${bucketFor(c.debutYear)}`);
    expect(mismatches).toEqual([]);
  });

  it("labels every card with its bucket's label", () => {
    const byIndex = new Map(buckets.map((b) => [b.eraIndex, b.eraLabel]));
    const wrong = cards
      .filter((c) => c.eraLabel !== byIndex.get(c.eraIndex))
      .map((c) => `${c.cardId}: eraIndex=${c.eraIndex} label="${c.eraLabel}" expected="${byIndex.get(c.eraIndex)}"`);
    expect(wrong).toEqual([]);
  });

  it("keeps each bucket's recorded counts and debutYear bounds true of the cards", () => {
    for (const b of buckets) {
      const inBucket = cards.filter((c) => c.eraIndex === b.eraIndex);
      expect(inBucket).toHaveLength(b.cardCount);
      expect(b.observedDebutYearRange ?? null).toEqual([
        Math.min(...inBucket.map((c) => c.debutYear)),
        Math.max(...inBucket.map((c) => c.debutYear)),
      ]);
      for (const c of inBucket) {
        if (b.debutYearMin !== null) expect(c.debutYear).toBeGreaterThanOrEqual(b.debutYearMin);
        if (b.debutYearMax !== null) expect(c.debutYear).toBeLessThanOrEqual(b.debutYearMax);
      }
    }
  });

  it("holds every bucket at or above the >=40 card floor", () => {
    // bucket 0 sits exactly at the floor — it is why the partition bottoms out open-ended
    for (const b of buckets) expect(b.cardCount).toBeGreaterThanOrEqual(40);
  });
});
