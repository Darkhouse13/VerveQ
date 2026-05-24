type McqQuestionCandidate = {
  category: string;
  options: readonly string[];
  questionKind?: string;
};

export function isStandardMcqQuestion(question: McqQuestionCandidate) {
  const isMcqKind =
    question.questionKind === undefined || question.questionKind === "mcq";

  return (
    isMcqKind &&
    question.category !== "which_came_first" &&
    question.category !== "enterprise_logos" &&
    Array.isArray(question.options) &&
    question.options.length === 4
  );
}

export function assertStandardMcqQuestion(question: McqQuestionCandidate) {
  if (!isStandardMcqQuestion(question)) {
    throw new Error("Question is not renderable in MCQ quiz");
  }
}
