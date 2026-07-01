import { describe, expect, it } from "vitest";
import { learnHistoryEventDatesLadderV1 } from "../../convex/learnHistoryEventDatesLadderV1";
import { learnHistoryFoundingYearsLadderV1 } from "../../convex/learnHistoryFoundingYearsLadderV1";
import { learnHistoryChronologyLadderV1 } from "../../convex/learnHistoryChronologyLadderV1";
import { learnScienceElementSymbolsLadderV1 } from "../../convex/learnScienceElementSymbolsLadderV1";
import { learnScienceAtomicNumbersLadderV1 } from "../../convex/learnScienceAtomicNumbersLadderV1";
import { learnScienceSiUnitsLadderV1 } from "../../convex/learnScienceSiUnitsLadderV1";
import { learnAstronomySolarSystemLadderV1 } from "../../convex/learnAstronomySolarSystemLadderV1";
import { learnAstronomyMoonsLadderV1 } from "../../convex/learnAstronomyMoonsLadderV1";
import { learnAstronomyStarsScaleLadderV1 } from "../../convex/learnAstronomyStarsScaleLadderV1";
import { learnBiologyTaxonomyLadderV1 } from "../../convex/learnBiologyTaxonomyLadderV1";
import { learnBiologyAnatomyLadderV1 } from "../../convex/learnBiologyAnatomyLadderV1";
import { learnBiologyCellsLadderV1 } from "../../convex/learnBiologyCellsLadderV1";
import { learnMathSequencesLadderV1 } from "../../convex/learnMathSequencesLadderV1";
import { learnMathConstantsLadderV1 } from "../../convex/learnMathConstantsLadderV1";
import { learnMathGeometryLadderV1 } from "../../convex/learnMathGeometryLadderV1";
import { learnLanguageRootsLadderV1 } from "../../convex/learnLanguageRootsLadderV1";
import { learnLanguageAffixesLadderV1 } from "../../convex/learnLanguageAffixesLadderV1";
import { learnLanguageEtymologyLadderV1 } from "../../convex/learnLanguageEtymologyLadderV1";
import type { LearnLadderModule } from "../../convex/learnLadderKit";

// Every hand-authored teaching ladder built on learnLadderKit, across all
// subjects, sharing one fail-closed gate.
const MODULES: LearnLadderModule[] = [
  learnHistoryEventDatesLadderV1,
  learnHistoryFoundingYearsLadderV1,
  learnHistoryChronologyLadderV1,
  learnScienceElementSymbolsLadderV1,
  learnScienceAtomicNumbersLadderV1,
  learnScienceSiUnitsLadderV1,
  learnAstronomySolarSystemLadderV1,
  learnAstronomyMoonsLadderV1,
  learnAstronomyStarsScaleLadderV1,
  learnBiologyTaxonomyLadderV1,
  learnBiologyAnatomyLadderV1,
  learnBiologyCellsLadderV1,
  learnMathSequencesLadderV1,
  learnMathConstantsLadderV1,
  learnMathGeometryLadderV1,
  learnLanguageRootsLadderV1,
  learnLanguageAffixesLadderV1,
  learnLanguageEtymologyLadderV1,
];

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

describe("authored teaching ladders", () => {
  it("each module passes its own fail-closed validator", () => {
    for (const module of MODULES) {
      const result = module.validate();
      expect(result.errors, module.metadata.batchId).toEqual([]);
      expect(result.ok, module.metadata.batchId).toBe(true);
      expect(result.questionCount, module.metadata.batchId).toBeGreaterThanOrEqual(4);
    }
  });

  it("every rung is a well-formed 4-option MCQ with 3 distinct distractors", () => {
    for (const module of MODULES) {
      for (const question of module.questions) {
        expect(question.options, question.checksum).toHaveLength(4);
        expect(question.options, question.checksum).toContain(question.correctAnswer);
        expect(question.distractors, question.checksum).toHaveLength(3);
        const distractorTexts = question.distractors.map((d) => d.text);
        expect(distractorTexts, question.checksum).not.toContain(question.correctAnswer);
        expect(new Set(question.options).size, question.checksum).toBe(4);
      }
    }
  });

  it("checksums are globally unique across every authored ladder", () => {
    const checksums = MODULES.flatMap((m) => m.questions.map((q) => q.checksum));
    expect(duplicates(checksums)).toEqual([]);
  });

  it("every explanation is unique (hand-authored, never templated)", () => {
    const reveals = MODULES.flatMap((m) =>
      m.questions.flatMap((q) => [
        q.correctReveal.trim(),
        ...q.distractors.map((d) => (d.reveal ?? "").trim()),
      ]),
    );
    expect(reveals.every((r) => r.length > 0)).toBe(true);
    expect(duplicates(reveals)).toEqual([]);
  });
});
