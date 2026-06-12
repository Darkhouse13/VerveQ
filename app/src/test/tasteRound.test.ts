/**
 * Taste-round logic (the cold-entry sample game): sampling freshness, option
 * shuffling that preserves the correct answer, and client scoring bounds.
 */
import { describe, it, expect } from "vitest";
import {
  sampleTasteRound,
  scoreTasteAnswer,
  TASTE_QUESTION_POOL,
  TASTE_ROUND_SIZE,
} from "@/lib/tasteRound";

const poolById = new Map(TASTE_QUESTION_POOL.map((q) => [q.id, q]));

describe("sampleTasteRound", () => {
  it("deals a full round of unique pool questions", () => {
    const round = sampleTasteRound();
    expect(round).toHaveLength(TASTE_ROUND_SIZE);
    const ids = round.map((q) => q.id);
    expect(new Set(ids).size).toBe(TASTE_ROUND_SIZE);
    for (const id of ids) expect(poolById.has(id)).toBe(true);
  });

  it("prefers unseen questions while enough remain", () => {
    const seen = new Set(
      TASTE_QUESTION_POOL.slice(0, 5).map((q) => q.id),
    );
    const round = sampleTasteRound(seen);
    for (const q of round) expect(seen.has(q.id)).toBe(false);
  });

  it("tops up from seen questions once the pool runs dry, without duplicates", () => {
    const seen = new Set(
      TASTE_QUESTION_POOL.slice(0, TASTE_QUESTION_POOL.length - 2).map(
        (q) => q.id,
      ),
    );
    const round = sampleTasteRound(seen);
    expect(round).toHaveLength(TASTE_ROUND_SIZE);
    expect(new Set(round.map((q) => q.id)).size).toBe(TASTE_ROUND_SIZE);
    // The two unseen ones must both be in the round.
    const unseenIds = TASTE_QUESTION_POOL.slice(-2).map((q) => q.id);
    for (const id of unseenIds)
      expect(round.some((q) => q.id === id)).toBe(true);
  });

  it("shuffles option order but keeps correctIndex pointing at the right answer", () => {
    // A fixed rng exercises a non-identity permutation deterministically.
    let n = 0;
    const rng = () => {
      n = (n * 9301 + 49297) % 233280;
      return n / 233280;
    };
    const round = sampleTasteRound(new Set(), TASTE_QUESTION_POOL.length, rng);
    for (const q of round) {
      const original = poolById.get(q.id)!;
      expect(q.options[q.correctIndex]).toBe(
        original.options[original.correctIndex],
      );
      expect([...q.options].sort()).toEqual([...original.options].sort());
    }
  });
});

describe("scoreTasteAnswer", () => {
  it("wrong answers score nothing", () => {
    expect(scoreTasteAnswer(false, 0)).toBe(0);
    expect(scoreTasteAnswer(false, 5000)).toBe(0);
  });

  it("correct answers score 100 plus a speed bonus capped at 50", () => {
    expect(scoreTasteAnswer(true, 0)).toBe(150);
    expect(scoreTasteAnswer(true, 2500)).toBe(150); // full bonus under 2.5s
    expect(scoreTasteAnswer(true, 6250)).toBe(125); // halfway through the fade
    expect(scoreTasteAnswer(true, 10_000)).toBe(100); // bonus gone by 10s
    expect(scoreTasteAnswer(true, 60_000)).toBe(100); // clamped, never below base
  });
});
