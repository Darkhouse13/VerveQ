import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

const CANDIDATES_PATH = "convex/data/drawCardsReal.candidates.json";
const DOSSIER_PATH = "convex/data/drawCardsReal.dossier.json";

type Card = { cardId: string; name: string; eraIndex: number; eraLabel: string };
type Entry = { cardId: string; era: { eraIndex: number; eraLabel: string; eraYear: number; eraYearSource: string } };
type Bucket = {
  eraIndex: number;
  eraLabel: string;
  peakYearMin: number | null;
  peakYearMax: number | null;
  eraYearMin: number | null;
  eraYearMax: number | null;
  cardCount: number;
  observedEraYearRange: [number, number];
};

const cards: Card[] = read(CANDIDATES_PATH);
const dossier = read(DOSSIER_PATH);
const mapping = dossier.eraMapping;
const buckets: Bucket[] = mapping?.rule?.buckets ?? [];
const entries: Entry[] = dossier.entries ?? [];
const eraYearOf = new Map(entries.map((e) => [e.cardId, e.era?.eraYear]));

/**
 * E0.5 — NO DATE IS A PUBLISHED FACT, so eraIndex no longer has a card-face year to
 * check against: the card carries no debutYear. eraIndex is derived from eraYear (the
 * cited override where one exists, else the sourced sourceStartYear), which lives in
 * the dossier per entry. E2's blind verify stopped on the era rule being absent: with
 * only ranges to go on, the buckets are unfalsifiable, since any mapping read back off
 * the cards confirms them by construction. These contracts keep the stated rule
 * (peakYear := eraYear + 5) and the committed cards from drifting apart in either
 * direction, now sourcing eraYear from the dossier rather than the scrubbed card.
 */

const bucketFor = (eraYear: number): number | null => {
  const peak = eraYear + 5;
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
    expect(mapping.rule.derived).toBe("peakYear := eraYear + 5");
    expect(buckets).toHaveLength(4);
  });

  it("carries no published date on the card face", () => {
    // E0.5 — the fact-model realignment: the card publishes eraIndex/eraLabel, never a year.
    for (const c of cards) expect(c).not.toHaveProperty("debutYear");
    // every card resolves to an eraYear in the dossier so the rule can be checked
    expect(cards.filter((c) => typeof eraYearOf.get(c.cardId) !== "number")).toEqual([]);
  });

  it("partitions peakYear contiguously, exhaustively, and open-ended at both ends", () => {
    const ordered = [...buckets].sort((a, b) => a.eraIndex - b.eraIndex);
    expect(ordered.map((b) => b.eraIndex)).toEqual([0, 1, 2, 3]);
    expect(ordered[0].peakYearMin).toBeNull(); // pre-1960 icons have a home
    expect(ordered[ordered.length - 1].peakYearMax).toBeNull(); // future starts have a home
    for (let i = 1; i < ordered.length; i++) {
      // no gap and no overlap: every peakYear lands in exactly one bucket
      expect(ordered[i].peakYearMin).toBe(ordered[i - 1].peakYearMax! + 1);
    }
  });

  it("assigns every committed card the eraIndex the rule derives from its eraYear", () => {
    const mismatches = cards
      .filter((c) => bucketFor(eraYearOf.get(c.cardId)!) !== c.eraIndex)
      .map((c) => `${c.cardId} ${c.name}: eraYear=${eraYearOf.get(c.cardId)} committed=${c.eraIndex} rule=${bucketFor(eraYearOf.get(c.cardId)!)}`);
    expect(mismatches).toEqual([]);
  });

  it("labels every card with its bucket's label", () => {
    const byIndex = new Map(buckets.map((b) => [b.eraIndex, b.eraLabel]));
    const wrong = cards
      .filter((c) => c.eraLabel !== byIndex.get(c.eraIndex))
      .map((c) => `${c.cardId}: eraIndex=${c.eraIndex} label="${c.eraLabel}" expected="${byIndex.get(c.eraIndex)}"`);
    expect(wrong).toEqual([]);
  });

  it("keeps each bucket's recorded counts and eraYear bounds true of the cards", () => {
    for (const b of buckets) {
      const inBucket = cards.filter((c) => c.eraIndex === b.eraIndex);
      const years = inBucket.map((c) => eraYearOf.get(c.cardId)!);
      expect(inBucket).toHaveLength(b.cardCount);
      expect(b.observedEraYearRange ?? null).toEqual([Math.min(...years), Math.max(...years)]);
      for (const y of years) {
        if (b.eraYearMin !== null) expect(y).toBeGreaterThanOrEqual(b.eraYearMin);
        if (b.eraYearMax !== null) expect(y).toBeLessThanOrEqual(b.eraYearMax);
      }
    }
  });

  it("holds every bucket at or above the >=40 card floor", () => {
    // bucket 0 sits exactly at the floor — it is why the partition bottoms out open-ended
    for (const b of buckets) expect(b.cardCount).toBeGreaterThanOrEqual(40);
  });
});
