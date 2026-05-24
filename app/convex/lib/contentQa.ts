import { levenshteinDistance } from "./fuzzy";
import {
  logoAnswerTargets,
  matchLogoGuess,
  type LogoTextAnswerQuestion,
} from "./logoTextAnswers";
import { normalizeAnswer } from "./scoring";

export type ContentQuestionKind = "mcq" | "which_came_first" | "logo_text";
export type ContentDifficulty = "easy" | "intermediate" | "hard";
export type ContentQaSeverity = "ERROR" | "WARN";

export type ContentQuestionSeed = {
  sport: string;
  category: string;
  question: string;
  options: string[];
  correctAnswer: string;
  acceptedAliases?: string[];
  explanation?: string;
  difficulty: ContentDifficulty;
  bucket: string;
  checksum: string;
  imageId?: string;
  imageUrl?: string;
  questionKind?: ContentQuestionKind;
};

export type ContentQaFindingCode =
  | "STRUCTURAL_INVALID"
  | "DISTRACTOR_MATCHES_CORRECT"
  | "EXACT_DUPLICATE"
  | "NEAR_DUPLICATE"
  | "ANSWER_OVERUSE"
  | "DISTRACTOR_QUALITY";

export type ContentQaFinding = {
  code: ContentQaFindingCode;
  severity: ContentQaSeverity;
  questionRef: string;
  field?: string;
  detail: string;
};

export type ImageReference = {
  field: "imageId" | "imageUrl";
  value: string;
};

export type ContentQaOptions = {
  existingChecksums?: Iterable<string>;
  nearDuplicateThreshold?: number;
  answerOveruseLimit?: number;
  imageReferenceExists?: (
    ref: ImageReference,
    question: ContentQuestionSeed,
  ) => boolean;
};

export type ContentQaRollup = {
  total: number;
  bySeverity: Record<ContentQaSeverity, number>;
  byCode: Record<ContentQaFindingCode, number>;
};

export type ContentQaReport = {
  ok: boolean;
  findings: ContentQaFinding[];
  rollup: ContentQaRollup;
};

const DIFFICULTIES = new Set<ContentDifficulty>([
  "easy",
  "intermediate",
  "hard",
]);
const QUESTION_KINDS = new Set<ContentQuestionKind>([
  "mcq",
  "which_came_first",
  "logo_text",
]);
const DEFAULT_NEAR_DUPLICATE_THRESHOLD = 0.92;
const DEFAULT_ANSWER_OVERUSE_LIMIT = 3;
const FINDING_SEVERITY: Record<ContentQaFindingCode, ContentQaSeverity> = {
  STRUCTURAL_INVALID: "ERROR",
  DISTRACTOR_MATCHES_CORRECT: "ERROR",
  EXACT_DUPLICATE: "ERROR",
  NEAR_DUPLICATE: "WARN",
  ANSWER_OVERUSE: "WARN",
  DISTRACTOR_QUALITY: "WARN",
};
const FILLER_PATTERNS = [
  /\b(all|none) of the above\b/i,
  /\b(no idea|not sure|unknown|placeholder|lorem ipsum)\b/i,
  /\b(fake answer|made up|random answer)\b/i,
  /\b(asdf|qwerty|lol|joke|obviously)\b/i,
  /^\?+$/,
  /^n\/a$/i,
  /^tbd$/i,
];

function addFinding(
  findings: ContentQaFinding[],
  code: ContentQaFindingCode,
  questionRef: string,
  field: string | undefined,
  detail: string,
) {
  findings.push({
    code,
    severity: FINDING_SEVERITY[code],
    questionRef,
    ...(field ? { field } : {}),
    detail,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asQuestionKind(question: Pick<ContentQuestionSeed, "category" | "questionKind">) {
  if (
    question.questionKind === "logo_text" ||
    question.category === "enterprise_logos"
  ) {
    return "logo_text" as const;
  }
  if (
    question.questionKind === "which_came_first" ||
    question.category === "which_came_first"
  ) {
    return "which_came_first" as const;
  }
  return "mcq" as const;
}

function questionRef(question: Partial<ContentQuestionSeed>, index: number) {
  return isNonBlankString(question.checksum)
    ? question.checksum
    : `batch[${index}]`;
}

function normalizeText(value: string) {
  return normalizeAnswer(value).replace(/\s+/g, " ").trim();
}

function normalizedOptionKey(value: string) {
  return normalizeText(value);
}

function distinctNormalized(values: string[]) {
  return [...new Set(values.map(normalizedOptionKey).filter(Boolean))];
}

function expectedOptionCount(kind: ContentQuestionKind) {
  switch (kind) {
    case "mcq":
      return 4;
    case "which_came_first":
      return 2;
    case "logo_text":
      return 0;
  }
}

function firstImageRef(question: ContentQuestionSeed): ImageReference | null {
  if (isNonBlankString(question.imageId)) {
    return { field: "imageId", value: question.imageId };
  }
  if (isNonBlankString(question.imageUrl)) {
    return { field: "imageUrl", value: question.imageUrl };
  }
  return null;
}

function isImageQuestion(question: ContentQuestionSeed, kind: ContentQuestionKind) {
  return (
    kind === "logo_text" ||
    question.category === "badge_identification" ||
    isNonBlankString(question.imageId) ||
    isNonBlankString(question.imageUrl)
  );
}

function acceptedTargets(question: LogoTextAnswerQuestion) {
  return logoAnswerTargets(question).map(normalizeText).filter(Boolean);
}

function optionMatchesAnswer(
  option: string,
  question: ContentQuestionSeed,
  kind: ContentQuestionKind,
) {
  if (kind === "logo_text") {
    return matchLogoGuess(option, question).correct;
  }

  return normalizeText(option) === normalizeText(question.correctAnswer);
}

function effectivePrompt(question: ContentQuestionSeed, kind: ContentQuestionKind) {
  const parts = [question.question];
  if (kind === "which_came_first") {
    parts.push(...question.options);
  }
  if (kind === "logo_text" || isImageQuestion(question, kind)) {
    const ref = firstImageRef(question);
    if (ref) parts.push(ref.value);
  }
  return normalizeText(parts.join(" "));
}

function duplicateQuestionAnswerKey(
  question: ContentQuestionSeed,
  kind: ContentQuestionKind,
) {
  return `${effectivePrompt(question, kind)}|${normalizeText(question.correctAnswer)}`;
}

function levenshteinSimilarity(a: string, b: string) {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshteinDistance(a, b) / longest;
}

function tokenJaccard(a: string, b: string) {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const union = new Set([...aTokens, ...bTokens]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function promptSimilarity(a: string, b: string) {
  return Math.max(levenshteinSimilarity(a, b), tokenJaccard(a, b));
}

function optionClass(option: string) {
  const value = option.trim();
  if (/^(?:c\.\s*)?\d{3,4}\s*(?:bce|bc|ce|ad)?$/i.test(value)) {
    return "year";
  }
  if (/^\d+(?:[.,]\d+)?(?:\s*[%$])?$/.test(value)) {
    return "number";
  }
  if (/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(value)) {
    return "date";
  }
  return "text";
}

function hasTypeHomogeneityTell(options: string[]) {
  const classes = new Set(options.map(optionClass));
  const hasText = classes.has("text");
  const hasNumericLike =
    classes.has("year") || classes.has("number") || classes.has("date");
  return hasText && hasNumericLike;
}

function fillerOptions(options: string[]) {
  return options.filter((option) =>
    FILLER_PATTERNS.some((pattern) => pattern.test(option.trim())),
  );
}

function longestCorrectTell(question: ContentQuestionSeed) {
  const normalizedCorrect = normalizeText(question.correctAnswer);
  const correctOption =
    question.options.find(
      (option) => normalizeText(option) === normalizedCorrect,
    ) ?? question.correctAnswer;
  const distractorLengths = question.options
    .filter((option) => normalizeText(option) !== normalizedCorrect)
    .map((option) => option.trim().length);
  if (distractorLengths.length === 0) return false;

  const correctLength = correctOption.trim().length;
  const longestDistractor = Math.max(...distractorLengths);
  return (
    correctLength >= longestDistractor + 12 &&
    correctLength >= Math.ceil(longestDistractor * 1.6)
  );
}

function validateStructure(
  question: ContentQuestionSeed,
  index: number,
  findings: ContentQaFinding[],
  options: Required<Pick<ContentQaOptions, "imageReferenceExists">>,
) {
  const ref = questionRef(question, index);
  const requiredStringFields = [
    "sport",
    "category",
    "question",
    "correctAnswer",
    "bucket",
    "checksum",
  ] as const;

  for (const field of requiredStringFields) {
    if (!isNonBlankString(question[field])) {
      addFinding(
        findings,
        "STRUCTURAL_INVALID",
        ref,
        field,
        `${field} is required and must be a non-blank string.`,
      );
    }
  }

  if (!DIFFICULTIES.has(question.difficulty)) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "difficulty",
      "difficulty must be one of easy, intermediate, or hard.",
    );
  }
  if (
    question.questionKind !== undefined &&
    !QUESTION_KINDS.has(question.questionKind)
  ) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "questionKind",
      "questionKind must be mcq, which_came_first, or logo_text when provided.",
    );
  }

  const kind = asQuestionKind(question);
  if (!Array.isArray(question.options)) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "options",
      "options must be an array.",
    );
    return;
  }

  const expected = expectedOptionCount(kind);
  if (question.options.length !== expected) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "options",
      `${kind} questions must have exactly ${expected} options.`,
    );
  }

  question.options.forEach((option, optionIndex) => {
    if (!isNonBlankString(option)) {
      addFinding(
        findings,
        "STRUCTURAL_INVALID",
        ref,
        `options[${optionIndex}]`,
        "options must contain only non-blank strings.",
      );
    }
  });

  const stringOptions = question.options.filter(
    (option): option is string => typeof option === "string",
  );
  const normalizedOptions = stringOptions.map(normalizedOptionKey);
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "options",
      "options must not repeat within a question after normalization.",
    );
  }

  if (
    kind !== "logo_text" &&
    !stringOptions.some(
      (option) => normalizeText(option) === normalizeText(question.correctAnswer),
    )
  ) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "correctAnswer",
      "correctAnswer must match one of the options after normalization.",
    );
  }

  if (
    question.acceptedAliases !== undefined &&
    (!Array.isArray(question.acceptedAliases) ||
      !question.acceptedAliases.every(isNonBlankString))
  ) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      ref,
      "acceptedAliases",
      "acceptedAliases must be an array of non-blank strings when provided.",
    );
  }

  if (isImageQuestion(question, kind)) {
    const imageRef = firstImageRef(question);
    if (!imageRef) {
      addFinding(
        findings,
        "STRUCTURAL_INVALID",
        ref,
        "imageUrl",
        "image questions must provide a non-blank imageUrl or imageId.",
      );
    } else if (!options.imageReferenceExists(imageRef, question)) {
      addFinding(
        findings,
        "STRUCTURAL_INVALID",
        ref,
        imageRef.field,
        `image reference "${imageRef.value}" could not be resolved offline.`,
      );
    }
  }
}

function validateDistractors(
  batch: ContentQuestionSeed[],
  findings: ContentQaFinding[],
) {
  batch.forEach((question, index) => {
    const kind = asQuestionKind(question);
    const ref = questionRef(question, index);
    const accepted = new Set(
      acceptedTargets({
        correctAnswer: question.correctAnswer,
        acceptedAliases: kind === "logo_text" ? question.acceptedAliases : [],
      }),
    );
    let consumedCorrectOption = false;

    question.options.forEach((option, optionIndex) => {
      const normalized = normalizeText(option);
      if (!consumedCorrectOption && accepted.has(normalized)) {
        consumedCorrectOption = true;
        return;
      }
      if (!optionMatchesAnswer(option, question, kind)) return;

      addFinding(
        findings,
        "DISTRACTOR_MATCHES_CORRECT",
        ref,
        `options[${optionIndex}]`,
        `Distractor "${option}" matches the accepted answer set for "${question.correctAnswer}".`,
      );
    });
  });
}

function validateExactDuplicates(
  batch: ContentQuestionSeed[],
  existingChecksums: Set<string>,
  findings: ContentQaFinding[],
) {
  const checksums = new Map<string, number>();
  const promptAnswerKeys = new Map<string, number>();

  batch.forEach((question, index) => {
    const ref = questionRef(question, index);
    if (existingChecksums.has(question.checksum)) {
      addFinding(
        findings,
        "EXACT_DUPLICATE",
        ref,
        "checksum",
        `checksum "${question.checksum}" already exists in the provided checksum list.`,
      );
    }

    const firstChecksumIndex = checksums.get(question.checksum);
    if (firstChecksumIndex !== undefined) {
      addFinding(
        findings,
        "EXACT_DUPLICATE",
        ref,
        "checksum",
        `checksum duplicates ${questionRef(batch[firstChecksumIndex], firstChecksumIndex)} within this batch.`,
      );
    } else {
      checksums.set(question.checksum, index);
    }

    const key = duplicateQuestionAnswerKey(question, asQuestionKind(question));
    const firstKeyIndex = promptAnswerKeys.get(key);
    if (firstKeyIndex !== undefined) {
      addFinding(
        findings,
        "EXACT_DUPLICATE",
        ref,
        "question",
        `normalized prompt and answer duplicate ${questionRef(batch[firstKeyIndex], firstKeyIndex)} within this batch.`,
      );
    } else {
      promptAnswerKeys.set(key, index);
    }
  });
}

function validateNearDuplicates(
  batch: ContentQuestionSeed[],
  threshold: number,
  findings: ContentQaFinding[],
) {
  const prompts = batch.map((question) =>
    effectivePrompt(question, asQuestionKind(question)),
  );
  const exactKeys = batch.map((question) =>
    duplicateQuestionAnswerKey(question, asQuestionKind(question)),
  );

  for (let i = 0; i < batch.length; i += 1) {
    if (!prompts[i]) continue;
    for (let j = i + 1; j < batch.length; j += 1) {
      if (!prompts[j] || exactKeys[i] === exactKeys[j]) continue;
      const similarity = promptSimilarity(prompts[i], prompts[j]);
      if (similarity < threshold) continue;

      addFinding(
        findings,
        "NEAR_DUPLICATE",
        questionRef(batch[j], j),
        "question",
        `effective prompt is ${(similarity * 100).toFixed(1)}% similar to ${questionRef(batch[i], i)}; human review should decide whether to keep both.`,
      );
    }
  }
}

function validateAnswerOveruse(
  batch: ContentQuestionSeed[],
  limit: number,
  findings: ContentQaFinding[],
) {
  const counts = new Map<string, number[]>();
  batch.forEach((question, index) => {
    const key = `${normalizeText(question.category)}|${normalizeText(question.correctAnswer)}`;
    counts.set(key, [...(counts.get(key) ?? []), index]);
  });

  for (const indexes of counts.values()) {
    if (indexes.length <= limit) continue;
    const lastIndex = indexes[indexes.length - 1];
    const question = batch[lastIndex];
    addFinding(
      findings,
      "ANSWER_OVERUSE",
      questionRef(question, lastIndex),
      "correctAnswer",
      `"${question.correctAnswer}" appears ${indexes.length} times in category "${question.category}" within this batch; limit is ${limit}.`,
    );
  }
}

function validateDistractorQuality(
  batch: ContentQuestionSeed[],
  findings: ContentQaFinding[],
) {
  batch.forEach((question, index) => {
    const kind = asQuestionKind(question);
    if (kind === "logo_text" || question.options.length === 0) return;

    const reviewReasons: string[] = [];
    if (longestCorrectTell(question)) {
      reviewReasons.push("correct answer is much longer than every distractor");
    }
    if (hasTypeHomogeneityTell(question.options)) {
      reviewReasons.push("options mix numeric/date-like values with text labels");
    }
    const fillers = fillerOptions(question.options);
    if (fillers.length > 0) {
      reviewReasons.push(
        `option looks like filler: ${fillers.map((value) => `"${value}"`).join(", ")}`,
      );
    }
    if (reviewReasons.length === 0) return;

    addFinding(
      findings,
      "DISTRACTOR_QUALITY",
      questionRef(question, index),
      "options",
      `Heuristic review needed; this does not certify semantic correctness. ${reviewReasons.join("; ")}.`,
    );
  });
}

function rollupFindings(findings: ContentQaFinding[]): ContentQaRollup {
  const bySeverity: Record<ContentQaSeverity, number> = { ERROR: 0, WARN: 0 };
  const byCode = Object.fromEntries(
    Object.keys(FINDING_SEVERITY).map((code) => [code, 0]),
  ) as Record<ContentQaFindingCode, number>;

  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
    byCode[finding.code] += 1;
  }

  return {
    total: findings.length,
    bySeverity,
    byCode,
  };
}

export function contentQaSummary(report: ContentQaReport) {
  return `Content QA ${report.ok ? "passed" : "failed"}: ${report.rollup.total} findings (${report.rollup.bySeverity.ERROR} ERROR, ${report.rollup.bySeverity.WARN} WARN).`;
}

export function validateContentBatch(
  rawBatch: unknown,
  options: ContentQaOptions = {},
): ContentQaReport {
  const findings: ContentQaFinding[] = [];
  const imageReferenceExists =
    options.imageReferenceExists ?? (() => true);

  if (!Array.isArray(rawBatch)) {
    addFinding(
      findings,
      "STRUCTURAL_INVALID",
      "batch",
      "batch",
      "candidate batch must be an array of question rows.",
    );
    const rollup = rollupFindings(findings);
    return { ok: false, findings, rollup };
  }

  const batch: ContentQuestionSeed[] = [];
  rawBatch.forEach((row, index) => {
    if (!isRecord(row)) {
      addFinding(
        findings,
        "STRUCTURAL_INVALID",
        `batch[${index}]`,
        "row",
        "question row must be an object.",
      );
      return;
    }
    batch.push(row as ContentQuestionSeed);
  });

  for (let index = 0; index < batch.length; index += 1) {
    validateStructure(batch[index], index, findings, { imageReferenceExists });
  }

  const structurallyInvalidRefs = new Set(
    findings
      .filter((finding) => finding.code === "STRUCTURAL_INVALID")
      .map((finding) => finding.questionRef),
  );
  const distractorCheckableBatch = batch.filter(
    (question) =>
      typeof question.category === "string" &&
      typeof question.correctAnswer === "string" &&
      Array.isArray(question.options) &&
      question.options.every((option) => typeof option === "string"),
  );
  const structurallyValidBatch = batch.filter(
    (question, index) => !structurallyInvalidRefs.has(questionRef(question, index)),
  );

  validateDistractors(distractorCheckableBatch, findings);
  validateExactDuplicates(
    structurallyValidBatch,
    new Set(options.existingChecksums ?? []),
    findings,
  );
  validateNearDuplicates(
    structurallyValidBatch,
    options.nearDuplicateThreshold ?? DEFAULT_NEAR_DUPLICATE_THRESHOLD,
    findings,
  );
  validateAnswerOveruse(
    structurallyValidBatch,
    options.answerOveruseLimit ?? DEFAULT_ANSWER_OVERUSE_LIMIT,
    findings,
  );
  validateDistractorQuality(structurallyValidBatch, findings);

  const rollup = rollupFindings(findings);
  return {
    ok: rollup.bySeverity.ERROR === 0,
    findings,
    rollup,
  };
}
