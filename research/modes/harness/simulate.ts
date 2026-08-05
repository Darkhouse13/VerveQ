import { AGENTS, AGENT_IDS, type Agent, type AgentView, type CandidateOps } from './agents.ts';
import { SEARCH_BUDGET } from './budget.ts';
import { makeRng, mixSeed } from './rng.ts';
import {
  bootstrapRatio,
  combine,
  pairedDelta,
  se,
  summarize,
  type BootstrapResult,
  type PairedDelta,
  type Summary,
} from './stats.ts';
import type { AnyCandidate } from './types.ts';

export interface EpisodeResult {
  seed: number;
  score: number;
  label: string;
  reachedTerminal: boolean;
  decisions: number;
}

export interface TerminalBucket {
  label: string;
  count: number;
  share: number;
}

export interface AgentRun {
  agentId: string;
  search: Agent['search'];
  knowledge: Agent['knowledge'];
  scores: number[];
  summary: Summary;
  terminalDistribution: TerminalBucket[];
  /** Episodes stopped by the decision cap instead of by `isTerminal`. */
  truncated: number;
}

export type NoiseFloorReason = 'sum-not-finite' | 'sum-degenerate-zero' | 'sum-at-or-below-floor';

export interface PairwiseDelta {
  a: string;
  b: string;
  delta: PairedDelta;
}

export interface PrimaryMetrics {
  /** Expert - SkillOnly: the value of knowledge, given skill. */
  dKnowledge: PairedDelta;
  /** Expert - KnowledgeOnly: the value of skill, given knowledge. */
  dSkill: PairedDelta;
  /** Per-seed (2 * Expert - SkillOnly - KnowledgeOnly), i.e. dKnowledge + dSkill. */
  sum: { mean: number; se: number };
  /** The 3 * SE(sum) comparison value. */
  noiseFloor: number;
  belowNoiseFloor: boolean;
  /** Which clause of the noise-floor rule fired; null when the sum clears it. */
  noiseFloorReason: NoiseFloorReason | null;
  /** null exactly when `belowNoiseFloor`. */
  recallShare: number | null;
  bootstrap: BootstrapResult | null;
}

export interface SimulationResult {
  candidateId: string;
  description: string;
  seeds: number[];
  runs: AgentRun[];
  pairwise: PairwiseDelta[];
  primary: PrimaryMetrics;
  /** Whether the candidate withholds anything at all at t = 0. */
  hiddenAtStart: { present: boolean; preview: string };
  /**
   * Whether the candidate declared a secret layer. When false the knowledge
   * agents saw the raw state, so `dKnowledge` is the value of everything the
   * mode withholds; when true it is the value of the knowable facts only.
   */
  knowledgeModel: { secretsDeclared: boolean };
  budget: typeof SEARCH_BUDGET;
}

function opsOf(candidate: AnyCandidate): CandidateOps<unknown, unknown, never> {
  return {
    legalActions: (state) => candidate.legalActions(state),
    apply: (state, action) => candidate.apply(state, action),
    isTerminal: (state) => candidate.isTerminal(state),
    score: (state) => candidate.score(state),
    determinize: (revealed, rng) => candidate.determinize(revealed, rng),
  };
}

function labelOf(candidate: AnyCandidate, state: unknown): string {
  return candidate.terminalLabel
    ? candidate.terminalLabel(state)
    : `score ${candidate.score(state)}`;
}

/**
 * One episode. The tie-break RNG is derived from the seed alone, never from the
 * agent id, so every agent meets the same randomness on the same seed.
 *
 * The knowledge-view sub-streams hang off `searchSeed`, which is derived from
 * (seed, decision) and is therefore identical for every agent. They are
 * separate streams from the tie-break RNG and from the rollout streams, so a
 * candidate that declares no secrets consumes exactly the randomness it
 * consumed before R0.6 — nothing here perturbs an existing adapter's numbers.
 */
export function playEpisode(candidate: AnyCandidate, agent: Agent, seed: number): EpisodeResult {
  const ops = opsOf(candidate);
  const rng = makeRng(mixSeed(seed, 0xa9e17));
  const knowledgeView = candidate.knowledgeView?.bind(candidate);
  let state: unknown = candidate.init(seed);
  let decisions = 0;

  while (!candidate.isTerminal(state) && decisions < SEARCH_BUDGET.maxEpisodeDecisions) {
    const legalActions = candidate.legalActions(state);
    if (legalActions.length === 0) break;
    const searchSeed = mixSeed(seed, decisions, 0x3c);
    // Bound so the closures below cannot observe the reassignment at the end of
    // the loop body. They are only called synchronously inside `choose`, but
    // relying on that would be a needless trap for a future edit.
    const trueState = state;

    const view: AgentView<unknown, unknown, never> =
      agent.knowledge === 'full'
        ? {
            knowledge: 'full',
            // No `knowledgeView` means "this mode has no secrets", and the
            // identity is applied by taking the true state directly rather than
            // by calling a supplied identity function. Same result, but it makes
            // the pre-R0.6 path literally the pre-R0.6 code.
            state: knowledgeView
              ? knowledgeView(trueState, makeRng(mixSeed(searchSeed, 0x6b)))
              : trueState,
            stateFor: knowledgeView
              ? (rolloutIndex: number) =>
                  knowledgeView(trueState, makeRng(mixSeed(searchSeed, rolloutIndex, 0x6c)))
              : () => trueState,
            ops,
            legalActions,
            rng,
            searchSeed,
          }
        : {
            knowledge: 'none',
            revealed: candidate.revealed(state) as never,
            ops,
            legalActions,
            rng,
            searchSeed,
          };

    state = candidate.apply(state, agent.choose(view));
    decisions++;
  }

  return {
    seed,
    score: candidate.score(state),
    label: labelOf(candidate, state),
    reachedTerminal: candidate.isTerminal(state),
    decisions,
  };
}

function distribution(episodes: readonly EpisodeResult[]): TerminalBucket[] {
  const counts = new Map<string, number>();
  for (const episode of episodes) {
    counts.set(episode.label, (counts.get(episode.label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: count / episodes.length }))
    .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
}

/**
 * Fails loudly if a candidate's `determinize` does not preserve the legal-action
 * count. Checked up front so a broken adapter reports as a contract violation
 * rather than as a strange metric.
 */
function assertDeterminizeContract(candidate: AnyCandidate, seed: number): void {
  const state = candidate.init(seed);
  if (candidate.isTerminal(state)) return;
  const expected = candidate.legalActions(state).length;
  const sample = candidate.determinize(candidate.revealed(state), makeRng(mixSeed(seed, 0x11)));
  const got = candidate.legalActions(sample).length;
  if (got !== expected) {
    throw new Error(
      `${candidate.id}: determinize must preserve the legal-action count ` +
        `(root has ${expected}, determinized sample has ${got})`,
    );
  }
}

/**
 * Same up-front check as `assertDeterminizeContract`, for the other resampler.
 * A `knowledgeView` that changes the action count would otherwise surface as a
 * mid-run rollout failure for Expert only, which reads as a strange metric
 * rather than as a broken adapter.
 */
function assertKnowledgeViewContract(candidate: AnyCandidate, seed: number): void {
  if (!candidate.knowledgeView) return;
  const state = candidate.init(seed);
  if (candidate.isTerminal(state)) return;
  const expected = candidate.legalActions(state).length;
  const sample = candidate.knowledgeView(state, makeRng(mixSeed(seed, 0x12)));
  const got = candidate.legalActions(sample).length;
  if (got !== expected) {
    throw new Error(
      `${candidate.id}: knowledgeView must preserve the legal-action count ` +
        `(true state has ${expected}, knowledge view has ${got})`,
    );
  }
}

export interface SimulateOptions {
  seeds?: number;
  /** First seed in the contiguous seed set. */
  seedOffset?: number;
  onProgress?: (agentId: string, done: number, total: number) => void;
}

export function simulate(candidate: AnyCandidate, options: SimulateOptions = {}): SimulationResult {
  const seedCount = options.seeds ?? 1000;
  const seedOffset = options.seedOffset ?? 1;
  const seeds = Array.from({ length: seedCount }, (_, i) => seedOffset + i);

  assertDeterminizeContract(candidate, seeds[0]);
  assertKnowledgeViewContract(candidate, seeds[0]);

  const runs: AgentRun[] = [];
  const byAgent = new Map<string, number[]>();

  for (const agent of AGENTS) {
    const episodes: EpisodeResult[] = [];
    for (let i = 0; i < seeds.length; i++) {
      episodes.push(playEpisode(candidate, agent, seeds[i]));
      if (options.onProgress && (i + 1) % 50 === 0) {
        options.onProgress(agent.id, i + 1, seeds.length);
      }
    }
    const scores = episodes.map((episode) => episode.score);
    byAgent.set(agent.id, scores);
    runs.push({
      agentId: agent.id,
      search: agent.search,
      knowledge: agent.knowledge,
      scores,
      summary: summarize(scores),
      terminalDistribution: distribution(episodes),
      truncated: episodes.filter((episode) => !episode.reachedTerminal).length,
    });
  }

  const pairwise: PairwiseDelta[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      pairwise.push({
        a: runs[i].agentId,
        b: runs[j].agentId,
        delta: pairedDelta(runs[i].scores, runs[j].scores),
      });
    }
  }

  const expert = byAgent.get(AGENT_IDS.expert)!;
  const skill = byAgent.get(AGENT_IDS.skillOnly)!;
  const knowledge = byAgent.get(AGENT_IDS.knowledgeOnly)!;

  const dKnowledge = pairedDelta(expert, skill);
  const dSkill = pairedDelta(expert, knowledge);

  // Per-seed dKnowledge + dSkill, so the SE of the sum accounts for the shared
  // Expert term rather than pretending the two deltas are independent.
  const sumPerSeed = combine([expert, skill, knowledge], [2, -1, -1]);
  const sumMean = dKnowledge.mean + dSkill.mean;
  const sumSe = se(sumPerSeed);
  const noiseFloor = 3 * sumSe;
  // The rule is `sum < 3 * SE(sum)`, widened to `<=` so that the fully
  // degenerate case — every agent scoring identically, so sum and SE are both
  // exactly 0 — reports UNDEFINED instead of evaluating 0/0 to NaN. A mode where
  // nothing any agent does changes the outcome is the clearest possible instance
  // of "below the noise floor".
  const noiseFloorReason: NoiseFloorReason | null = !Number.isFinite(sumMean)
    ? 'sum-not-finite'
    : Math.abs(sumMean) < 1e-12
      ? 'sum-degenerate-zero'
      : sumMean <= noiseFloor
        ? 'sum-at-or-below-floor'
        : null;
  const belowNoiseFloor = noiseFloorReason !== null;

  const numeratorPerSeed = combine([expert, skill], [1, -1]);

  const primary: PrimaryMetrics = {
    dKnowledge,
    dSkill,
    sum: { mean: sumMean, se: sumSe },
    noiseFloor,
    belowNoiseFloor,
    noiseFloorReason,
    recallShare: belowNoiseFloor ? null : dKnowledge.mean / sumMean,
    bootstrap: belowNoiseFloor
      ? null
      : bootstrapRatio(numeratorPerSeed, sumPerSeed, seeds[0] ^ seeds.length),
  };

  const hiddenSample = candidate.hidden(candidate.init(seeds[0]));
  const hiddenJson = JSON.stringify(hiddenSample);
  const present = hiddenJson !== undefined && hiddenJson !== '{}' && hiddenJson !== 'null';

  return {
    candidateId: candidate.id,
    description: candidate.description,
    seeds,
    runs,
    pairwise,
    primary,
    hiddenAtStart: {
      present,
      preview: hiddenJson === undefined ? 'undefined' : hiddenJson.slice(0, 160),
    },
    knowledgeModel: { secretsDeclared: candidate.knowledgeView !== undefined },
    budget: SEARCH_BUDGET,
  };
}
