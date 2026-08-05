import { makeRng, mixSeed, pickIndex } from '../harness/rng.ts';
import type { ModeCandidate, Rng } from '../harness/types.ts';

/**
 * calib-trivia — pure recall, no decisions.
 *
 * A run of independent multiple-choice questions. Every choice is structurally
 * identical; the only thing that separates them is which one the content says is
 * correct, and that lives entirely in hidden info. There is nothing to plan.
 *
 * Expected shape: recallShare near 1, SkillOnly indistinguishable from
 * ZeroKnowledge. This adapter is a throwaway used to validate the metric — if
 * the harness cannot recover that shape, the metric is wrong and that is the
 * finding.
 */

const QUESTIONS = 8;
const CHOICES = 4;

export interface TriviaState {
  /** Hidden: the correct choice index of each question. */
  readonly answers: readonly number[];
  readonly index: number;
  readonly correct: number;
}

interface TriviaPublic {
  readonly index: number;
  readonly correct: number;
  readonly questions: number;
  readonly choices: number;
  readonly [key: string]: number;
}

interface TriviaPrivate {
  /** Only the questions not yet answered are still withheld. */
  readonly remainingAnswers: readonly number[];
  readonly [key: string]: readonly number[];
}

/** Action = the chosen answer index. */
export type TriviaAction = number;

function drawAnswers(rng: Rng, from: number): number[] {
  const answers: number[] = [];
  for (let i = 0; i < QUESTIONS; i++) {
    // Questions already answered no longer influence anything; park them at 0.
    answers.push(i < from ? 0 : pickIndex(rng, CHOICES));
  }
  return answers;
}

export const calibTrivia: ModeCandidate<TriviaState, TriviaAction, TriviaPublic, TriviaPrivate> = {
  id: 'calib-trivia',
  description: 'Calibration adapter: pure recall, no structural decisions.',

  init(seed) {
    return { answers: drawAnswers(makeRng(mixSeed(seed, 0x717a)), 0), index: 0, correct: 0 };
  },

  legalActions() {
    return Array.from({ length: CHOICES }, (_, i) => i);
  },

  apply(state, action) {
    const hit = action === state.answers[state.index] ? 1 : 0;
    return { answers: state.answers, index: state.index + 1, correct: state.correct + hit };
  },

  isTerminal(state) {
    return state.index >= QUESTIONS;
  },

  /** Running tally. Defined off-terminal, which is what gives greedy its edge. */
  score(state) {
    return state.correct;
  },

  revealed(state) {
    return {
      index: state.index,
      correct: state.correct,
      questions: QUESTIONS,
      choices: CHOICES,
    };
  },

  hidden(state) {
    return { remainingAnswers: state.answers.slice(state.index) };
  },

  /** Resample every unanswered question's key uniformly over the choice set. */
  determinize(revealed, rng) {
    return {
      answers: drawAnswers(rng, revealed.index),
      index: revealed.index,
      correct: revealed.correct,
    };
  },

  terminalLabel(state) {
    return `${state.correct}/${QUESTIONS} correct`;
  },
};
