import type { Doc } from "../_generated/dataModel";

/** A ranked Quiz is 10 questions (QUIZ_PLANNED_QUESTIONS in quizSessions.ts). */
export const QUIZ_MASTER_MIN_QUESTIONS = 10;

type QuizGameRow = Pick<Doc<"gameSessions">, "mode" | "totalQuestions" | "correctAnswers" | "accuracy">;

/**
 * "Quiz Master — Get 100% accuracy in a quiz" (seedAchievements.ts). Only a
 * FULL ranked quiz counts: every planned question answered, every answer
 * right. A short session (abandoned after 3 right answers) is not a quiz.
 */
export function isPerfectQuiz(row: QuizGameRow) {
  if (row.mode !== "quiz") return false;
  const total = row.totalQuestions ?? 0;
  if (total < QUIZ_MASTER_MIN_QUESTIONS) return false;
  if (typeof row.correctAnswers === "number") return row.correctAnswers === total;
  return row.accuracy === 1;
}

export function hasPerfectQuiz(rows: QuizGameRow[]) {
  return rows.some(isPerfectQuiz);
}
