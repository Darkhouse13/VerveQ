import { describe, expect, it } from "vitest";
import {
  contentQaSummary,
  validateContentBatch,
  type ContentQaFindingCode,
  type ContentQaOptions,
  type ContentQuestionSeed,
} from "../../convex/lib/contentQa";

function question(
  checksum: string,
  overrides: Partial<ContentQuestionSeed> = {},
): ContentQuestionSeed {
  return {
    sport: "football",
    category: "football_quiz",
    question: "Which club won the 2012 Champions League final?",
    options: ["Chelsea", "Bayern Munich", "Barcelona", "Real Madrid"],
    correctAnswer: "Chelsea",
    explanation: "Chelsea beat Bayern Munich on penalties in the 2012 final.",
    difficulty: "easy",
    bucket: "football_easy_football_quiz",
    checksum,
    ...overrides,
  };
}

function expectSingleCode(
  batch: unknown,
  code: ContentQaFindingCode,
  options?: ContentQaOptions,
) {
  const report = validateContentBatch(batch, options);
  expect(report.ok).toBe(!report.findings.some((finding) => finding.severity === "ERROR"));
  expect(report.findings).toHaveLength(1);
  expect(report.findings[0].code).toBe(code);
  return report;
}

describe("content QA validator", () => {
  it("passes a clean batch", () => {
    const report = validateContentBatch([
      question("clean_001"),
      question("clean_002", {
        question: "Which nation hosted the 2014 FIFA World Cup?",
        options: ["Brazil", "Germany", "South Africa", "Russia"],
        correctAnswer: "Brazil",
        checksum: "clean_002",
      }),
      question("clean_003", {
        sport: "knowledge",
        category: "which_came_first",
        question: "Which came first?",
        options: ["The first FIFA World Cup", "The Premier League was founded"],
        correctAnswer: "The first FIFA World Cup",
        bucket: "knowledge_came_first_easy",
        checksum: "clean_003",
        questionKind: "which_came_first",
      }),
      question("clean_004", {
        sport: "knowledge",
        category: "enterprise_logos",
        question: "Name this company logo.",
        options: [],
        correctAnswer: "Apple",
        acceptedAliases: ["iPhone", "Mac"],
        bucket: "knowledge_easy_enterprise_logos",
        checksum: "clean_004",
        imageUrl: "/arena-logos/opaque/4d3321bc5b5137a4001b.svg",
        questionKind: "logo_text",
      }),
    ]);

    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
    expect(contentQaSummary(report)).toBe(
      "Content QA passed: 0 findings (0 ERROR, 0 WARN).",
    );
  });

  it("flags STRUCTURAL_INVALID for malformed required fields", () => {
    const { bucket: _bucket, ...malformed } = question("structural_001");
    const report = expectSingleCode([malformed], "STRUCTURAL_INVALID");

    expect(report.ok).toBe(false);
    expect(report.findings[0]).toMatchObject({
      severity: "ERROR",
      field: "bucket",
    });
  });

  it("flags STRUCTURAL_INVALID for broken local image refs", () => {
    const report = expectSingleCode(
      [
        question("structural_image_001", {
          sport: "knowledge",
          category: "enterprise_logos",
          question: "Name this company logo.",
          options: [],
          correctAnswer: "ExampleCo",
          bucket: "knowledge_easy_enterprise_logos",
          imageUrl: "/missing-logo.svg",
          questionKind: "logo_text",
        }),
      ],
      "STRUCTURAL_INVALID",
      { imageReferenceExists: () => false },
    );

    expect(report.ok).toBe(false);
    expect(report.findings[0]).toMatchObject({
      severity: "ERROR",
      field: "imageUrl",
    });
  });

  it("flags DISTRACTOR_MATCHES_CORRECT for MCQ identical-variant collisions", () => {
    const report = validateContentBatch([
      question("distractor_001", {
        question: "Which spelling is accepted?",
        options: ["Color", "color.", "Blue", "Green"],
        correctAnswer: "Color",
      }),
    ]);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: "DISTRACTOR_MATCHES_CORRECT",
      severity: "ERROR",
      field: "options[1]",
    }));
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: "STRUCTURAL_INVALID",
      severity: "ERROR",
      field: "options",
    }));
  });

  it("allows legitimate MCQ near-miss numeric distractors", () => {
    const report = validateContentBatch([
      question("near_miss_number_001", {
        question: "Which year did this sample event happen?",
        options: ["1990", "1989", "1991", "1992"],
        correctAnswer: "1990",
      }),
      question("near_miss_number_002", {
        question: "What is the sample count?",
        options: ["12", "11", "13", "21"],
        correctAnswer: "12",
      }),
    ]);

    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it("keeps logo_text fuzzy distractor collisions as errors", () => {
    const report = validateContentBatch([
      question("logo_collision_001", {
        sport: "knowledge",
        category: "enterprise_logos",
        question: "Name this company logo.",
        options: ["Gooogle"],
        correctAnswer: "Google",
        acceptedAliases: ["Alphabet"],
        bucket: "knowledge_easy_enterprise_logos",
        imageUrl: "/arena-logos/opaque/6c0113ec444d8c6e6137.svg",
        questionKind: "logo_text",
      }),
    ]);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: "DISTRACTOR_MATCHES_CORRECT",
      severity: "ERROR",
      field: "options[0]",
    }));
  });

  it("flags EXACT_DUPLICATE for repeated checksums", () => {
    const report = expectSingleCode(
      [
        question("duplicate_001"),
        question("duplicate_001", {
          question: "Which country won the 2010 FIFA World Cup?",
          options: ["Spain", "Netherlands", "Germany", "Uruguay"],
          correctAnswer: "Spain",
        }),
      ],
      "EXACT_DUPLICATE",
    );

    expect(report.ok).toBe(false);
    expect(report.findings[0].detail).toContain("duplicates duplicate_001");
  });

  it("flags EXACT_DUPLICATE for provided existing checksums", () => {
    const report = expectSingleCode(
      [question("already_seeded_001")],
      "EXACT_DUPLICATE",
      { existingChecksums: ["already_seeded_001"] },
    );

    expect(report.ok).toBe(false);
    expect(report.findings[0].detail).toContain("already exists");
  });

  it("flags NEAR_DUPLICATE for highly similar prompts", () => {
    const report = expectSingleCode(
      [
        question("near_001", {
          question: "Which club won the Champions League in 2012?",
        }),
        question("near_002", {
          question: "Which club won the Champions League in 2013?",
          options: ["Bayern Munich", "Borussia Dortmund", "Chelsea", "Barcelona"],
          correctAnswer: "Bayern Munich",
        }),
      ],
      "NEAR_DUPLICATE",
    );

    expect(report.ok).toBe(true);
    expect(report.findings[0]).toMatchObject({ severity: "WARN" });
  });

  it("flags ANSWER_OVERUSE above the category limit", () => {
    const report = expectSingleCode(
      [
        question("overuse_001", {
          question: "Which country hosted the 2014 FIFA World Cup?",
          options: ["Brazil", "Germany", "South Africa", "Russia"],
          correctAnswer: "Brazil",
        }),
        question("overuse_002", {
          question: "Which country is home to the Maracana stadium?",
          options: ["Brazil", "Argentina", "Spain", "Portugal"],
          correctAnswer: "Brazil",
        }),
      ],
      "ANSWER_OVERUSE",
      { answerOveruseLimit: 1 },
    );

    expect(report.ok).toBe(true);
    expect(report.findings[0]).toMatchObject({ severity: "WARN" });
  });

  it("flags DISTRACTOR_QUALITY for review-only heuristic tells", () => {
    const report = expectSingleCode(
      [
        question("quality_001", {
          question: "Which phrase states the conservation principle?",
          options: [
            "Energy cannot be created or destroyed",
            "Mass",
            "Force",
            "Heat",
          ],
          correctAnswer: "Energy cannot be created or destroyed",
        }),
      ],
      "DISTRACTOR_QUALITY",
    );

    expect(report.ok).toBe(true);
    expect(report.findings[0].detail).toContain("does not certify semantic correctness");
  });
});
