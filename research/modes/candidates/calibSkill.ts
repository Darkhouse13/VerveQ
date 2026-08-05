import type { ModeCandidate } from '../harness/types.ts';

/**
 * calib-skill — pure structural decisions, no content.
 *
 * Walk a counter to a public target in a fixed number of moves, stepping 1, 2 or
 * 3 each time. Overshoot scores nothing. The state is entirely public, so there
 * is no content to know; all that matters is planning the step sizes.
 *
 * Two deliberate structural choices keep the 2x2 clean:
 *
 *  - `score` is 0 off-terminal, because the mode has no partial credit. A 1-ply
 *    greedy agent therefore sees a tie at every decision.
 *  - The final move is forced (a single legal "settle" action), so the last
 *    decision is never the one that produces the terminal state. Without this,
 *    1-ply greedy could read the terminal score off its last real move and would
 *    quietly be doing search.
 *
 * Expected shape: recallShare near 0, KnowledgeOnly indistinguishable from
 * ZeroKnowledge.
 */

const CHOICE_MOVES = 12;
const STEPS = [1, 2, 3] as const;
const SETTLE = 0;

export interface SkillState {
  readonly target: number;
  readonly counter: number;
  readonly movesLeft: number;
}

interface SkillPublic {
  readonly target: number;
  readonly counter: number;
  readonly movesLeft: number;
  readonly [key: string]: number;
}

/** No content at all: the private information set is empty. */
type SkillPrivate = Record<string, never>;

export type SkillAction = number;

export const calibSkill: ModeCandidate<SkillState, SkillAction, SkillPublic, SkillPrivate> = {
  id: 'calib-skill',
  description: 'Calibration adapter: pure structural decisions, no content.',

  init(seed) {
    return { target: 19 + (seed % 5), counter: 0, movesLeft: CHOICE_MOVES + 1 };
  },

  legalActions(state) {
    return state.movesLeft > 1 ? [...STEPS] : [SETTLE];
  },

  apply(state, action) {
    return { target: state.target, counter: state.counter + action, movesLeft: state.movesLeft - 1 };
  },

  isTerminal(state) {
    return state.movesLeft <= 0;
  },

  score(state) {
    if (state.movesLeft > 0) return 0;
    return state.counter <= state.target ? state.counter : 0;
  },

  revealed(state) {
    return { target: state.target, counter: state.counter, movesLeft: state.movesLeft };
  },

  hidden() {
    return {};
  },

  /**
   * Trivially the identity: nothing is hidden, so the revealed info already
   * pins down the full state. Implemented explicitly rather than skipped — it
   * exercises the interface, and it is what makes SkillOnly and Expert provably
   * the same agent on this candidate.
   */
  determinize(revealed) {
    return { target: revealed.target, counter: revealed.counter, movesLeft: revealed.movesLeft };
  },

  terminalLabel(state) {
    if (state.counter > state.target) return 'bust';
    if (state.counter === state.target) return 'exact';
    return `short by ${state.target - state.counter}`;
  },
};
