import { findBestMatch, getMaxFuzzyDistance, levenshteinDistance } from "./fuzzy";
import { normalizeAnswer } from "./scoring";

export type LogoTextAnswerQuestion = {
  correctAnswer: string;
  acceptedAliases?: string[];
};

export function logoAnswerTargets(question: LogoTextAnswerQuestion) {
  return [...new Set([question.correctAnswer, ...(question.acceptedAliases ?? [])])]
    .map((target) => target.trim())
    .filter(Boolean);
}

function isWithinOneEditOfLogoAcceptance(guess: string, targets: string[]) {
  const normalizedGuess = normalizeAnswer(guess);
  if (!normalizedGuess) return false;

  return targets.some((target) => {
    const normalizedTarget = normalizeAnswer(target);
    if (!normalizedTarget) return false;
    const distance = levenshteinDistance(normalizedGuess, normalizedTarget);
    return distance === getMaxFuzzyDistance(normalizedTarget) + 1;
  });
}

export function matchLogoGuess(
  guess: string,
  question: LogoTextAnswerQuestion,
) {
  const targets = logoAnswerTargets(question);
  const match = findBestMatch(guess, targets);
  if (match.matched) {
    return { correct: true, close: false };
  }
  return {
    correct: false,
    close: isWithinOneEditOfLogoAcceptance(guess, targets),
  };
}
