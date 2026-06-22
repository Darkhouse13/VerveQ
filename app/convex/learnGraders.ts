import { levenshteinDistance } from "./lib/fuzzy";

export type LearnQuestionType = "mcq" | "text" | "numeric" | "order";

export type LearnDistractorReveal = {
  text: string;
  /** Optional teaching detour for this specific wrong pick (curated ladders
   * only); recall-drill distractors carry none. */
  reveal?: string;
};

export type LearnGradableQuestion = {
  type?: LearnQuestionType;
  options?: string[];
  correctAnswer?: string;
  /** Optional teaching "why". Absent on pure recall-drill rungs. */
  correctReveal?: string;
  distractors?: LearnDistractorReveal[];
  acceptedAnswers?: string[];
  textEditDistance?: number;
  numericAnswer?: number;
  numericTolerance?: number;
  numericUnit?: string;
  acceptedUnits?: string[];
  correctOrder?: string[];
};

export type LearnSubmitVerdict = {
  correct: boolean;
  branchId?: string;
  /** Teaching payload (the "why"). Absent on drill rungs with no reveal. */
  teach?: string;
  /** Surfaced only when a wrong drill answer has no teach, so the drill still
   * reveals the right answer. Curated reveal rungs never set this. */
  correctAnswer?: string;
  masteryDelta?: number;
  nextReview?: number;
};

/** Build the verdict for the non-MCQ graders: attach the rung's teach when it
 * has one, otherwise (on a wrong answer) surface the correct answer so a
 * reveal-less drill is still learnable. */
function revealVerdict(
  correct: boolean,
  question: LearnGradableQuestion,
): LearnSubmitVerdict {
  const teach = nonBlank(question.correctReveal);
  return {
    correct,
    ...(teach ? { teach } : {}),
    ...(!correct && !teach && nonBlank(question.correctAnswer)
      ? { correctAnswer: question.correctAnswer }
      : {}),
  };
}

type ParsedNumber = {
  value: number;
  unit?: string;
};

const MAX_TEXT_EDIT_DISTANCE = 3;
const COMBINING_MARKS = /\p{M}+/gu;
const PUNCTUATION_OR_SYMBOLS = /[\p{P}\p{S}]+/gu;

function boundedEditDistance(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_TEXT_EDIT_DISTANCE, Math.floor(value)));
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeLearnText(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLocaleLowerCase()
    .replace(PUNCTUATION_OR_SYMBOLS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUnit(value: string): string {
  return normalizeLearnText(value).replace(/\s+/g, "");
}

function acceptedTextForms(question: LearnGradableQuestion): string[] {
  return [
    ...(question.acceptedAnswers ?? []),
    ...(question.correctAnswer ? [question.correctAnswer] : []),
  ].filter((value, index, values) => {
    const normalized = normalizeLearnText(value);
    return (
      normalized.length > 0 &&
      values.findIndex((v) => normalizeLearnText(v) === normalized) === index
    );
  });
}

export function gradeTextAnswer(
  question: LearnGradableQuestion,
  answer: unknown,
): LearnSubmitVerdict {
  if (typeof answer !== "string") {
    return revealVerdict(false, question);
  }

  const normalizedAnswer = normalizeLearnText(answer);
  const targets = acceptedTextForms(question);
  const tolerance = boundedEditDistance(question.textEditDistance);
  let best: { form: string; distance: number } | null = null;

  for (const form of targets) {
    const normalizedForm = normalizeLearnText(form);
    const distance =
      normalizedAnswer === normalizedForm
        ? 0
        : levenshteinDistance(normalizedAnswer, normalizedForm);
    if (!best || distance < best.distance) {
      best = { form, distance };
    }
    if (distance === 0) break;
  }

  if (best && best.distance <= tolerance) {
    return revealVerdict(true, question);
  }

  return revealVerdict(false, question);
}

function normalizeNumericLiteral(raw: string): string {
  let value = raw.trim().replace(/\s+/g, "");
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  if (hasComma && hasDot) {
    return value.replace(/,/g, "");
  }

  if (hasComma) {
    const commaGroups = value.split(",");
    const commaLooksLikeThousands =
      commaGroups.length > 1 &&
      commaGroups.slice(1).every((group) => /^\d{3}$/.test(group));
    value = commaLooksLikeThousands
      ? commaGroups.join("")
      : value.replace(",", ".");
  }

  return value;
}

export function parseNumericSubmission(answer: unknown): ParsedNumber | null {
  if (typeof answer === "number") {
    return Number.isFinite(answer) ? { value: answer } : null;
  }

  if (typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
    const record = answer as Record<string, unknown>;
    const parsed = parseNumericSubmission(record.value);
    if (!parsed) return null;
    const explicitUnit =
      typeof record.unit === "string" ? nonBlank(record.unit) : undefined;
    return explicitUnit ? { ...parsed, unit: explicitUnit } : parsed;
  }

  if (typeof answer !== "string") return null;

  const trimmed = answer.trim();
  const match = trimmed.match(
    /^([+-]?(?:\d+(?:[\s,]\d{3})+|\d+)(?:[.,]\d+)?|[+-]?\d*[.,]\d+)(?:\s*(.*))?$/,
  );
  if (!match) return null;

  const value = Number(normalizeNumericLiteral(match[1]));
  if (!Number.isFinite(value)) return null;

  return {
    value,
    ...(nonBlank(match[2]) ? { unit: match[2].trim() } : {}),
  };
}

function expectedNumericAnswer(
  question: LearnGradableQuestion,
): ParsedNumber | null {
  if (typeof question.numericAnswer === "number") {
    return {
      value: question.numericAnswer,
      ...(question.numericUnit ? { unit: question.numericUnit } : {}),
    };
  }
  return parseNumericSubmission(question.correctAnswer);
}

function acceptedNumericUnits(
  question: LearnGradableQuestion,
  expected: ParsedNumber,
) {
  return [
    ...(question.acceptedUnits ?? []),
    ...(question.numericUnit ? [question.numericUnit] : []),
    ...(expected.unit ? [expected.unit] : []),
  ]
    .map(normalizeUnit)
    .filter(
      (unit, index, units) => unit.length > 0 && units.indexOf(unit) === index,
    );
}

export function gradeNumericAnswer(
  question: LearnGradableQuestion,
  answer: unknown,
): LearnSubmitVerdict {
  const expected = expectedNumericAnswer(question);
  if (!expected) {
    throw new Error("Numeric Learn question is missing a numeric answer");
  }

  const submitted = parseNumericSubmission(answer);
  const tolerance = Math.max(0, question.numericTolerance ?? 0);
  const units = acceptedNumericUnits(question, expected);
  const unitCorrect =
    units.length === 0 ||
    (submitted?.unit !== undefined &&
      units.includes(normalizeUnit(submitted.unit)));
  const valueCorrect =
    submitted !== null &&
    Math.abs(submitted.value - expected.value) <= tolerance + Number.EPSILON;

  return revealVerdict(valueCorrect && unitCorrect, question);
}

export function gradeOrderAnswer(
  question: LearnGradableQuestion,
  answer: unknown,
): LearnSubmitVerdict {
  const expected = question.correctOrder;
  if (!expected || expected.length === 0) {
    throw new Error("Order Learn question is missing a correct ordering");
  }
  const submitted = Array.isArray(answer) ? answer : [];
  const correct =
    submitted.length === expected.length &&
    submitted.every((value, index) => value === expected[index]);

  return revealVerdict(correct, question);
}

export function gradeMcqAnswer(
  question: LearnGradableQuestion,
  answer: unknown,
): LearnSubmitVerdict {
  if (typeof answer !== "string") {
    throw new Error("Answer is not valid for this question");
  }
  if (!question.options?.includes(answer)) {
    throw new Error("Answer is not valid for this question");
  }

  const correct = answer === question.correctAnswer;
  if (correct) {
    const teach = nonBlank(question.correctReveal);
    return { correct: true, ...(teach ? { teach } : {}) };
  }

  // Wrong pick. Prefer a distractor-specific teaching detour (the curated-ladder
  // "known trap" branch), then the rung's general "why", and finally — for a
  // pure recall drill with no reveal at all — surface the correct answer so the
  // drill is still learnable instead of throwing.
  const distractorTeach = nonBlank(
    question.distractors?.find((distractor) => distractor.text === answer)?.reveal,
  );
  if (distractorTeach) {
    return { correct: false, branchId: answer, teach: distractorTeach };
  }
  const generalTeach = nonBlank(question.correctReveal);
  if (generalTeach) {
    return { correct: false, teach: generalTeach };
  }
  return {
    correct: false,
    ...(nonBlank(question.correctAnswer)
      ? { correctAnswer: question.correctAnswer }
      : {}),
  };
}

export function gradeLearnAnswer(
  question: LearnGradableQuestion,
  answer: unknown,
): LearnSubmitVerdict {
  switch (question.type ?? "mcq") {
    case "mcq":
      return gradeMcqAnswer(question, answer);
    case "text":
      return gradeTextAnswer(question, answer);
    case "numeric":
      return gradeNumericAnswer(question, answer);
    case "order":
      return gradeOrderAnswer(question, answer);
  }
}
