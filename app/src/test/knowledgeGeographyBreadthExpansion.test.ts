import { describe, expect, it } from "vitest";
import { knowledgeQuestions } from "../../convex/knowledgeQuestions";
import {
  knowledgeGeographyBreadthProvenance,
  knowledgeGeographyBreadthQuestions,
  knowledgeGeographyBreadthReviewRows,
  type KnowledgeGeographyBreadthShape,
} from "../../convex/knowledgeGeographyBreadthExpansion";
import { validateContentBatch } from "../../convex/lib/contentQa";
import { isStandardMcqQuestion } from "../../convex/lib/mcqEligibility";

const expectedShapeCounts: Record<KnowledgeGeographyBreadthShape, number> = {
  standard_recall: 90,
  odd_one_out: 60,
  negative_exception: 40,
  numeric_estimation: 40,
  superlative_comparison: 50,
  connected_clue: 20,
};

const expectedCategories = [
  "currencies",
  "largest_cities",
  "landmarks",
  "physical_geography",
  "country_facts",
];

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1,
    }),
    {} as Record<T, number>,
  );
}

describe("knowledge geography breadth batch", () => {
  it("stays a bounded text-only standard-MCQ geography batch with locked shape variety", () => {
    expect(knowledgeGeographyBreadthQuestions).toHaveLength(300);
    expect(knowledgeGeographyBreadthReviewRows).toHaveLength(300);

    for (const question of knowledgeGeographyBreadthQuestions) {
      expect(question.sport).toBe("knowledge");
      expect(isStandardMcqQuestion(question), question.checksum).toBe(true);
      expect(question.category).not.toBe("capital_cities");
      expect(question.category).not.toBe("which_came_first");
      expect(question.category).not.toBe("enterprise_logos");
      expect("imageId" in question).toBe(false);
      expect("imageUrl" in question).toBe(false);
      expect(question.options).toHaveLength(4);
      expect(question.options).toContain(question.correctAnswer);
    }

    const shapeCounts = countBy(
      knowledgeGeographyBreadthReviewRows.map((row) => row.shape),
    );
    expect(shapeCounts).toEqual(expectedShapeCounts);
    expect(shapeCounts.standard_recall).toBeLessThanOrEqual(
      knowledgeGeographyBreadthQuestions.length / 2,
    );

    const categoryCounts = countBy(
      knowledgeGeographyBreadthQuestions.map((row) => row.category),
    );
    expect(categoryCounts).toEqual(
      Object.fromEntries(expectedCategories.map((category) => [category, 60])),
    );
  });

  it("keeps review metadata aligned to seeded rows and declared provenance", () => {
    const provenanceKeys = Object.keys(knowledgeGeographyBreadthProvenance);

    knowledgeGeographyBreadthReviewRows.forEach((reviewRow, index) => {
      const question = knowledgeGeographyBreadthQuestions[index];
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
      .filter(
        (question) =>
          !question.checksum.startsWith("knowledge_geography_breadth_v1_"),
      )
      .map((question) => question.checksum);

    const report = validateContentBatch(knowledgeGeographyBreadthQuestions, {
      existingChecksums,
    });

    expect(report.rollup.bySeverity.ERROR).toBe(0);
    expect(report.ok).toBe(true);
  }, 20_000);

  it("keeps correct-answer option positions balanced", () => {
    const counts = [0, 0, 0, 0];
    for (const question of knowledgeGeographyBreadthQuestions) {
      counts[question.options.indexOf(question.correctAnswer)] += 1;
    }

    expect(counts).toEqual([75, 75, 75, 75]);
  });
});
