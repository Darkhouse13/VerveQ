import { SEARCH_BUDGET } from './budget.ts';
import { makeRng, mixSeed, pickIndex } from './rng.ts';
import type { PublicInfo, Rng } from './types.ts';

/**
 * The four stock agents form a 2x2 over (search x knowledge). They are
 * candidate-agnostic: nothing below inspects a candidate id, a state field, or
 * an action shape. The only things an agent may call are the pure ops handed to
 * it in its view.
 *
 *                 no search        search
 *   no knowledge  ZeroKnowledge    SkillOnly
 *   knowledge     KnowledgeOnly    Expert
 */

/** The candidate's pure functions, with no state bound in. */
export interface CandidateOps<S, A, Pub extends PublicInfo> {
  legalActions(state: S): A[];
  apply(state: S, action: A): S;
  isTerminal(state: S): boolean;
  score(state: S): number;
  determinize(revealed: Pub, rng: Rng): S;
}

interface BaseView<S, A, Pub extends PublicInfo> {
  readonly ops: CandidateOps<S, A, Pub>;
  /** Actions legal in the true state, in contract order. */
  readonly legalActions: A[];
  /** Tie-breaking stream. Derived per episode, identically for every agent. */
  readonly rng: Rng;
  /** Base seed for this decision's search sub-streams. Identical per agent. */
  readonly searchSeed: number;
}

/**
 * Knowledge denial is enforced by construction, not by convention: a view built
 * for a no-knowledge agent has no `state` property at all, so there is no true
 * state for the agent to read even by accident.
 */
export interface BlindView<S, A, Pub extends PublicInfo> extends BaseView<S, A, Pub> {
  readonly knowledge: 'none';
  readonly revealed: Pub;
}

/**
 * The knowledge view. `state` is NOT necessarily the true state: for a
 * secret-bearing candidate the runner passes it through `knowledgeView`, so the
 * agent sees true facts and resampled secrets. On a candidate that declares no
 * secrets this is the true state, exactly as before R0.6.
 *
 * `stateFor(k)` supplies a **fresh** draw per rollout index. This matters: with
 * one fixed draw the searching knowledge agent would be integrating over a
 * single sampled world while its blind counterpart integrates over 64, and the
 * resulting gap would measure Monte-Carlo sample count rather than knowledge.
 * Under the identity default every `stateFor(k)` returns the same true state,
 * which is why the existing adapters are unaffected.
 */
export interface OmniscientView<S, A, Pub extends PublicInfo> extends BaseView<S, A, Pub> {
  readonly knowledge: 'full';
  /** One knowledge-view draw, for agents that do not search. */
  readonly state: S;
  /** An independent knowledge-view draw per rollout, for agents that do. */
  stateFor(rolloutIndex: number): S;
}

export type AgentView<S, A, Pub extends PublicInfo> =
  | BlindView<S, A, Pub>
  | OmniscientView<S, A, Pub>;

export interface Agent {
  readonly id: string;
  readonly search: 'none' | 'rollout';
  readonly knowledge: 'none' | 'full';
  choose<S, A, Pub extends PublicInfo>(view: AgentView<S, A, Pub>): A;
}

function wrongView(agentId: string, want: string): Error {
  return new Error(`${agentId} requires a ${want} view; the runner handed it the other one`);
}

/** Argmax over action values, ties broken uniformly at random. */
function argmax(values: number[], rng: Rng): number {
  let best = -Infinity;
  const tied: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] > best) {
      best = values[i];
      tied.length = 0;
      tied.push(i);
    } else if (values[i] === best) {
      tied.push(i);
    }
  }
  return tied[pickIndex(rng, tied.length)];
}

/**
 * The one and only rollout machine. SkillOnly and Expert both go through it and
 * differ solely in `rootFor` — determinized samples versus the true state — so
 * their budgets are identical by construction rather than by discipline.
 *
 * Rollout randomness is common across actions (same stream seed for every action
 * at a given rollout index k). That is a plain variance reduction: it cancels
 * the shared downstream noise so the comparison isolates the action itself. It
 * is applied identically to both search agents and depends on no candidate
 * specifics.
 */
function evaluateActions<S, A, Pub extends PublicInfo>(
  view: AgentView<S, A, Pub>,
  rootFor: (rolloutIndex: number) => S,
  rootSource: 'determinize' | 'knowledgeView',
): number[] {
  const { ops, searchSeed } = view;
  const actionCount = view.legalActions.length;
  const totals = new Array<number>(actionCount).fill(0);

  for (let k = 0; k < SEARCH_BUDGET.rolloutsPerAction; k++) {
    const root = rootFor(k);
    const rootActions = ops.legalActions(root);
    if (rootActions.length !== actionCount) {
      throw new Error(
        `${rootSource} contract violation: root has ${rootActions.length} legal actions, ` +
          `the true state has ${actionCount}`,
      );
    }
    const rolloutSeed = mixSeed(searchSeed, k, 0x5f);

    for (let j = 0; j < actionCount; j++) {
      const rng = makeRng(rolloutSeed);
      let state = ops.apply(root, rootActions[j]);
      let depth = 0;
      while (!ops.isTerminal(state) && depth < SEARCH_BUDGET.maxRolloutDepth) {
        const actions = ops.legalActions(state);
        if (actions.length === 0) break;
        state = ops.apply(state, actions[pickIndex(rng, actions.length)]);
        depth++;
      }
      totals[j] += ops.score(state);
    }
  }

  return totals.map((total) => total / SEARCH_BUDGET.rolloutsPerAction);
}

/** No search, no knowledge. Uniform over legal actions. */
export const zeroKnowledge: Agent = {
  id: 'ZeroKnowledge',
  search: 'none',
  knowledge: 'none',
  choose<S, A, Pub extends PublicInfo>(view: AgentView<S, A, Pub>): A {
    if (view.knowledge !== 'none') throw wrongView('ZeroKnowledge', 'blind');
    return view.legalActions[pickIndex(view.rng, view.legalActions.length)];
  },
};

/**
 * Search, no knowledge. Each rollout draws a fresh determinized world from the
 * revealed info, so the agent searches hard over a world it cannot see into.
 */
export const skillOnly: Agent = {
  id: 'SkillOnly',
  search: 'rollout',
  knowledge: 'none',
  choose<S, A, Pub extends PublicInfo>(view: AgentView<S, A, Pub>): A {
    if (view.knowledge !== 'none') throw wrongView('SkillOnly', 'blind');
    const values = evaluateActions(
      view,
      (k) => view.ops.determinize(view.revealed, makeRng(mixSeed(view.searchSeed, k, 0xd1))),
      'determinize',
    );
    return view.legalActions[argmax(values, view.rng)];
  },
};

/**
 * No search, knowledge. One-ply greedy on the knowledge view: take the action
 * whose immediate resulting score is highest. In a mode with no partial credit
 * every action ties here and this degenerates to uniform random — by design,
 * not by oversight.
 */
export const knowledgeOnly: Agent = {
  id: 'KnowledgeOnly',
  search: 'none',
  knowledge: 'full',
  choose<S, A, Pub extends PublicInfo>(view: AgentView<S, A, Pub>): A {
    if (view.knowledge !== 'full') throw wrongView('KnowledgeOnly', 'omniscient');
    const values = view.legalActions.map((action) =>
      view.ops.score(view.ops.apply(view.state, action)),
    );
    return view.legalActions[argmax(values, view.rng)];
  },
};

/**
 * Search and knowledge. SkillOnly's machinery, run on the knowledge view.
 *
 * The only difference between this agent and SkillOnly is where the rollout
 * roots come from: `knowledgeView` samples keep knowable facts true, while
 * `determinize` samples resample them. Everything else — budget, rollout
 * policy, common random numbers, argmax — is shared code. That is what makes
 * `dKnowledge = Expert - SkillOnly` the value of the facts and nothing else.
 */
export const expert: Agent = {
  id: 'Expert',
  search: 'rollout',
  knowledge: 'full',
  choose<S, A, Pub extends PublicInfo>(view: AgentView<S, A, Pub>): A {
    if (view.knowledge !== 'full') throw wrongView('Expert', 'omniscient');
    const values = evaluateActions(view, (k) => view.stateFor(k), 'knowledgeView');
    return view.legalActions[argmax(values, view.rng)];
  },
};

/** Report order: the 2x2 read left-to-right, top-to-bottom. */
export const AGENTS: readonly Agent[] = [zeroKnowledge, skillOnly, knowledgeOnly, expert];

export const AGENT_IDS = {
  zeroKnowledge: 'ZeroKnowledge',
  skillOnly: 'SkillOnly',
  knowledgeOnly: 'KnowledgeOnly',
  expert: 'Expert',
} as const;
