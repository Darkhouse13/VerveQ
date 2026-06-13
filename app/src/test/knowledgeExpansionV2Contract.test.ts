import { describe, expect, it } from "vitest";
import { knowledgeQuestions } from "../../convex/knowledgeQuestions";
import {
  knowledgeExpansionV2Provenance,
  knowledgeExpansionV2Questions,
  knowledgeExpansionV2ReviewRows,
  type KnowledgeExpansionV2Shape,
} from "../../convex/knowledgeExpansionV2";
import { validateContentBatch } from "../../convex/lib/contentQa";
import { isStandardMcqQuestion } from "../../convex/lib/mcqEligibility";

// 9 standard_recall rows were tombstoned as exact duplicates of rows already
// shipped in knowledge_v1 / challenge_arena_capitals_v1, so the batch is 291
// rows; tombstones keep the surviving positional checksums stable.
const expectedShapeCounts: Record<KnowledgeExpansionV2Shape, number> = {
  standard_recall: 81,
  odd_one_out: 60,
  negative_exception: 40,
  numeric_estimation: 40,
  superlative_comparison: 50,
  connected_clue: 20,
};

const expectedCategoryCounts: Record<string, number> = {
  chemistry: 30,
  astronomy: 29,
  biology: 28,
  earth_science: 30,
  geography: 29,
  history: 28,
  inventions: 28,
  language: 30,
  literature_arts: 29,
  fun_facts: 30,
};

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1,
    }),
    {} as Record<T, number>,
  );
}

describe("knowledge expansion v2 varied MCQ batch", () => {
  it("stays a bounded additive standard-MCQ batch with locked shape variety", () => {
    expect(knowledgeExpansionV2Questions).toHaveLength(291);
    expect(knowledgeExpansionV2ReviewRows).toHaveLength(291);

    for (const question of knowledgeExpansionV2Questions) {
      expect(question.sport).toBe("knowledge");
      expect(isStandardMcqQuestion(question), question.checksum).toBe(true);
      expect(question.category).not.toBe("which_came_first");
      expect(question.category).not.toBe("enterprise_logos");
      expect(question.options).toHaveLength(4);
      expect(question.options).toContain(question.correctAnswer);
    }

    const shapeCounts = countBy(knowledgeExpansionV2ReviewRows.map((row) => row.shape));
    expect(shapeCounts).toEqual(expectedShapeCounts);
    expect(shapeCounts.standard_recall).toBeLessThanOrEqual(
      knowledgeExpansionV2Questions.length / 2,
    );

    const categoryCounts = countBy(knowledgeExpansionV2Questions.map((row) => row.category));
    expect(categoryCounts).toEqual(expectedCategoryCounts);
  });

  it("keeps review metadata aligned to seeded rows and declared provenance", () => {
    const provenanceKeys = Object.keys(knowledgeExpansionV2Provenance);

    knowledgeExpansionV2ReviewRows.forEach((reviewRow, index) => {
      const question = knowledgeExpansionV2Questions[index];
      expect(reviewRow.ref).toBe(question.checksum);
      expect(reviewRow.category).toBe(question.category);
      expect(reviewRow.difficulty).toBe(question.difficulty);
      expect(reviewRow.answer).toBe(question.correctAnswer);
      expect(reviewRow.question).toBe(question.question);
      expect(provenanceKeys).toContain(reviewRow.sourceKey);
    });
  });

  it("passes content QA against existing bundled checksums without errors", () => {
    const existingChecksums = knowledgeQuestions
      .filter((question) => !question.checksum.startsWith("knowledge_expansion_v2_"))
      .map((question) => question.checksum);

    const report = validateContentBatch(knowledgeExpansionV2Questions, {
      existingChecksums,
    });

    expect(report.rollup.bySeverity.ERROR).toBe(0);
    expect(report.ok).toBe(true);
  }, 20_000);

  it("keeps correct-answer option positions balanced", () => {
    const counts = [0, 0, 0, 0];
    for (const question of knowledgeExpansionV2Questions) {
      counts[question.options.indexOf(question.correctAnswer)] += 1;
    }

    expect(counts).toEqual([71, 73, 74, 73]);
  });
});
