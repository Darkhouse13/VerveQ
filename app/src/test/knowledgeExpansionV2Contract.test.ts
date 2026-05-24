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

const expectedShapeCounts: Record<KnowledgeExpansionV2Shape, number> = {
  standard_recall: 90,
  odd_one_out: 60,
  negative_exception: 40,
  numeric_estimation: 40,
  superlative_comparison: 50,
  connected_clue: 20,
};

const expectedCategories = [
  "chemistry",
  "astronomy",
  "biology",
  "earth_science",
  "geography",
  "history",
  "inventions",
  "language",
  "literature_arts",
  "fun_facts",
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

describe("knowledge expansion v2 varied MCQ batch", () => {
  it("stays a bounded additive standard-MCQ batch with locked shape variety", () => {
    expect(knowledgeExpansionV2Questions).toHaveLength(300);
    expect(knowledgeExpansionV2ReviewRows).toHaveLength(300);

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
    expect(categoryCounts).toEqual(
      Object.fromEntries(expectedCategories.map((category) => [category, 30])),
    );
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
  });

  it("keeps correct-answer option positions balanced", () => {
    const counts = [0, 0, 0, 0];
    for (const question of knowledgeExpansionV2Questions) {
      counts[question.options.indexOf(question.correctAnswer)] += 1;
    }

    expect(counts).toEqual([75, 75, 75, 75]);
  });
});
