/**
 * Learn v2 — grading contract (FRONTEND ⇄ SERVER seam).
 *
 * This file is the SINGLE source of truth for the shapes the Learn UI submits
 * and the verdict it renders. The frontend is a pure consumer: it NEVER decides
 * correctness. It submits `{ sessionId, questionId, answer }` and renders the
 * server-returned `LearnVerdict`.
 *
 * Question payloads (`LearnQuestion`) are deliberately ANSWER-FREE — no correct
 * key, no accepted strings, no chronological `year` on ordering items. Anything
 * that would let the client grade is intentionally absent; the server holds it.
 *
 * Wiring status:
 *   - All four types (mcq | text | numeric | order) are graded server-side by
 *     `api.learn.submitLearnRung` through the single seam in `useLearnGrading.ts`.
 *     The server returns `{ correct, branchId?, teach, masteryDelta?, nextReview? }`
 *     and never the correct answer. No client-side grading remains.
 *   - The live ladder payload carries the real type discriminator end-to-end.
 *     Text accepted forms, numeric answers, and correct order stay server-only.
 */

export type LearnQuestionType = "mcq" | "text" | "numeric" | "order";
export const LEARN_PIPELINE_PROOF_NODE_ID = "geo.pipeline.proof";

/** Spaced-repetition self-rating (feeds the server schedule; never graded here). */
export type LearnRating = "again" | "hard" | "good" | "easy";

/** "Did that feel like learning or a test?" signal (qualitative, server-bound). */
export type LearnFelt = "learn" | "test";

/** A single multiple-choice option — label only, no correctness marker. */
export interface LearnMcqOption {
  /** Stable key the user submits (e.g. "A"). */
  key: string;
  /** Display text. */
  text: string;
}

/** One orderable item — label only. The grading order (`year`) is server-side. */
export interface LearnOrderItem {
  id: string;
  text: string;
}

interface LearnQuestionBase {
  /** Stable id; for the live MCQ ladder path this is the rung checksum. */
  id: string;
  type: LearnQuestionType;
  subject: string;
  prompt: string;
}

export interface LearnMcqQuestion extends LearnQuestionBase {
  type: "mcq";
  options: LearnMcqOption[];
}

export interface LearnTextQuestion extends LearnQuestionBase {
  type: "text";
  placeholder?: string;
}

export interface LearnNumericQuestion extends LearnQuestionBase {
  type: "numeric";
  unit?: string;
  tolerance?: number;
}

export interface LearnOrderQuestion extends LearnQuestionBase {
  type: "order";
  items: LearnOrderItem[];
}

export type LearnQuestion =
  | LearnMcqQuestion
  | LearnTextQuestion
  | LearnNumericQuestion
  | LearnOrderQuestion;

/** The user's answer, shaped per question type. */
export type LearnAnswer =
  | { type: "mcq"; key: string }
  | { type: "text"; text: string }
  | { type: "numeric"; value: number }
  | { type: "order"; order: string[] };

/** What the FE sends to grade an attempt. */
export interface LearnSubmit {
  sessionId: string;
  questionId: string;
  answer: LearnAnswer;
}

/**
 * The verdict the server returns — the ONLY source of correctness in the app.
 *
 * `teach` explains the WHY (it never restates the answer). When `branchId` is
 * present on an incorrect attempt, the answer hit a known trap and the UI shows
 * the adaptive teaching detour before the full reveal.
 */
export interface LearnVerdict {
  correct: boolean;
  /** Set when a wrong answer matched a known misconception → teaching detour. */
  branchId?: string;
  /** Server teaching payload (the "why"). Rendered verbatim. */
  teach: string;
  /** Optional mastery movement for this attempt (display/telemetry only). */
  masteryDelta?: number;
  /** Optional next-review timestamp (epoch ms) for the spaced schedule. */
  nextReview?: number;
  /** Optional canonical answer string for the reveal ("Accepted: …"). */
  correctAnswer?: string;
  /**
   * TEMPORARY: true only when produced by the client stub grader (the
   * text/numeric/order placeholder). Real server verdicts NEVER set this. The
   * UI uses it solely to surface a "grader pending" affordance.
   */
  pendingGrader?: boolean;
}

/** Subject-mastery row for the review/mastery surfaces (server-provided). */
export interface LearnSubjectMastery {
  id: string;
  label: string;
  /** 0..1 */
  mastery: number;
  /** Count of items due for review. */
  due: number;
  state: "locked" | "learning";
  /** Next due timestamp, epoch ms. */
  nextReview?: number;
}
