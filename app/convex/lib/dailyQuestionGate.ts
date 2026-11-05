/** Daily Quiz read gate: index must be answered already or the next one up. */
export function assertDailyQuestionReadable(results: unknown, questionIndex: number) {
  const answered = Array.isArray(results) ? results.length : 0;
  if (!Number.isInteger(questionIndex) || questionIndex < 0) {
    throw new Error("Question index out of range");
  }
  if (questionIndex > answered) {
    throw new Error("Question not available yet");
  }
}
