import { describe, expect, it } from "vitest";

import { gradeLearnAnswer, parseNumericSubmission } from "../../convex/learnGraders";

describe("Learn graders", () => {
  it("grades free-text with punctuation stripping and FR/ES diacritic folding", () => {
    const question = {
      type: "text" as const,
      correctReveal: "Verified teaching reveal.",
      acceptedAnswers: ["São Paulo", "Bogotá", "Côte d'Ivoire"],
    };

    expect(gradeLearnAnswer(question, "sao paulo")).toMatchObject({
      correct: true,
      branchId: "São Paulo",
      teach: "Verified teaching reveal.",
    });
    expect(gradeLearnAnswer(question, "Bogota!")).toMatchObject({
      correct: true,
      branchId: "Bogotá",
    });
    expect(gradeLearnAnswer(question, "cote-d ivoire")).toMatchObject({
      correct: true,
      branchId: "Côte d'Ivoire",
    });
    expect(gradeLearnAnswer(question, "Medellin")).toMatchObject({
      correct: false,
      teach: "Verified teaching reveal.",
    });
  });

  it("honors bounded text edit-distance tolerance only when configured", () => {
    const strictQuestion = {
      type: "text" as const,
      correctReveal: "Verified teaching reveal.",
      acceptedAnswers: ["Naypyidaw"],
    };
    const tolerantQuestion = {
      ...strictQuestion,
      textEditDistance: 1,
    };

    expect(gradeLearnAnswer(strictQuestion, "Naypyida")).toMatchObject({
      correct: false,
    });
    expect(gradeLearnAnswer(tolerantQuestion, "Naypyida")).toMatchObject({
      correct: true,
      branchId: "Naypyidaw",
    });
    expect(gradeLearnAnswer(tolerantQuestion, "Nayida")).toMatchObject({
      correct: false,
    });
  });

  it("parses numeric submissions and validates tolerance plus units", () => {
    const question = {
      type: "numeric" as const,
      correctReveal: "Verified numeric reveal.",
      numericAnswer: 42,
      numericTolerance: 0.5,
      numericUnit: "km",
      acceptedUnits: ["kilometer", "kilometers"],
    };

    expect(parseNumericSubmission("1,234.5 km")).toEqual({
      value: 1234.5,
      unit: "km",
    });
    expect(gradeLearnAnswer(question, "42.4 km")).toMatchObject({
      correct: true,
      teach: "Verified numeric reveal.",
    });
    expect(gradeLearnAnswer(question, { value: "42,4", unit: "kilometers" })).toMatchObject({
      correct: true,
    });
    expect(gradeLearnAnswer(question, "42.6 km")).toMatchObject({
      correct: false,
    });
    expect(gradeLearnAnswer(question, "42.4 mi")).toMatchObject({
      correct: false,
    });
    expect(gradeLearnAnswer(question, 42)).toMatchObject({
      correct: false,
    });
  });

  it("grades ordering by exact sequence equality", () => {
    const question = {
      type: "order" as const,
      correctReveal: "Verified order reveal.",
      correctOrder: ["Portugal", "Spain", "France"],
    };

    expect(gradeLearnAnswer(question, ["Portugal", "Spain", "France"])).toEqual({
      correct: true,
      teach: "Verified order reveal.",
    });
    expect(gradeLearnAnswer(question, ["Spain", "Portugal", "France"])).toEqual({
      correct: false,
      teach: "Verified order reveal.",
    });
    expect(gradeLearnAnswer(question, ["Portugal", "Spain"])).toEqual({
      correct: false,
      teach: "Verified order reveal.",
    });
  });
});
