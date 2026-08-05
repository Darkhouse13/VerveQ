import { describe, expect, it } from 'vitest';

import { calibSecret } from '../candidates/calibSecret.ts';
import { calibSkill } from '../candidates/calibSkill.ts';
import { calibTrivia } from '../candidates/calibTrivia.ts';
import { renderReport } from '../harness/report.ts';
import { simulate, type SimulationResult } from '../harness/simulate.ts';
import { makeRng } from '../harness/rng.ts';
import type { AnyCandidate } from '../harness/types.ts';

/**
 * The calibration adapters validate the metric, not the adapters. Assertions
 * here are directional and deliberately loose: they check that the harness
 * separates the three reference shapes by a wide margin. They do not encode any
 * gate threshold — that is an owner decision.
 *
 * Where a claim is "this quantity is zero", it is asserted against that run's
 * own 3 x SE rather than against a magic constant, so the test states the
 * statistical claim it actually means and does not tighten silently when the
 * seed count changes.
 */

const SEEDS = 250;
/** calib-secret's dKnowledge is a near-zero difference and needs a tighter SE. */
const SECRET_SEEDS = 400;

function run(candidate: Parameters<typeof simulate>[0]): SimulationResult {
  return simulate(candidate, { seeds: SEEDS });
}

function meanOf(result: SimulationResult, agentId: string): number {
  const found = result.runs.find((entry) => entry.agentId === agentId);
  if (!found) throw new Error(`no run for ${agentId}`);
  return found.summary.mean;
}

const trivia = run(calibTrivia);
const skill = run(calibSkill);

describe('harness plumbing', () => {
  it('gives every agent the same seed set', () => {
    for (const result of [trivia, skill]) {
      expect(result.seeds.length).toBe(SEEDS);
      for (const agentRun of result.runs) {
        expect(agentRun.scores.length).toBe(SEEDS);
      }
      expect(result.runs.map((agentRun) => agentRun.agentId)).toEqual([
        'ZeroKnowledge',
        'SkillOnly',
        'KnowledgeOnly',
        'Expert',
      ]);
    }
  });

  it('reports all six pairwise deltas', () => {
    expect(trivia.pairwise).toHaveLength(6);
    expect(skill.pairwise).toHaveLength(6);
  });

  it('runs every episode to a terminal state', () => {
    for (const result of [trivia, skill]) {
      for (const agentRun of result.runs) {
        expect(agentRun.truncated).toBe(0);
      }
    }
  });

  it('detects that calib-skill withholds nothing and calib-trivia withholds content', () => {
    expect(trivia.hiddenAtStart.present).toBe(true);
    expect(skill.hiddenAtStart.present).toBe(false);
  });

  it('is reproducible across runs at the same seed set', () => {
    const repeat = run(calibTrivia);
    expect(repeat.runs.map((agentRun) => agentRun.summary.mean)).toEqual(
      trivia.runs.map((agentRun) => agentRun.summary.mean),
    );
  });
});

describe('determinize contract', () => {
  it('is enforced up front', () => {
    const broken = {
      ...calibSkill,
      determinize: () => ({ target: 21, counter: 0, movesLeft: 1 }),
    };
    expect(() => simulate(broken, { seeds: 2 })).toThrow(/legal-action count/);
  });

  it('is enforced up front for knowledgeView too', () => {
    const broken = {
      ...calibSecret,
      knowledgeView: (state: { lo: number; hi: number }) => ({ ...state, lo: 0, hi: 2 }),
    };
    expect(() => simulate(broken as AnyCandidate, { seeds: 2 })).toThrow(
      /knowledgeView must preserve the legal-action count/,
    );
  });

  it('resamples hidden content for calib-trivia and is the identity for calib-skill', () => {
    const triviaState = calibTrivia.init(7);
    const resampled = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const sample = calibTrivia.determinize(calibTrivia.revealed(triviaState), makeRng(i + 1));
      resampled.add(JSON.stringify(sample.answers));
    }
    expect(resampled.size).toBeGreaterThan(1);

    const skillState = calibSkill.init(7);
    const identity = calibSkill.determinize(calibSkill.revealed(skillState), makeRng(1));
    expect(identity).toEqual(skillState);
  });
});

describe('noise floor', () => {
  /**
   * A mode in which no action changes anything. Neither faculty can move the
   * outcome, so recallShare has no denominator to divide by. This is the
   * UNDEFINED branch, and it is a finding about a candidate rather than an error.
   */
  const inert = {
    id: 'inert',
    description: 'Throwaway: every action leads to the same outcome.',
    init: (seed: number) => ({ steps: 0, seed }),
    legalActions: () => [0, 1, 2],
    apply: (state: { steps: number; seed: number }) => ({ ...state, steps: state.steps + 1 }),
    isTerminal: (state: { steps: number }) => state.steps >= 4,
    score: () => 1,
    revealed: (state: { steps: number }) => ({ steps: state.steps }),
    hidden: () => ({}),
    determinize: (revealed: { steps: number }) => ({ steps: revealed.steps, seed: 0 }),
  };

  const result = simulate(inert, { seeds: 60 });

  it('reports recallShare as UNDEFINED rather than NaN', () => {
    expect(result.primary.belowNoiseFloor).toBe(true);
    expect(result.primary.recallShare).toBeNull();
    expect(result.primary.bootstrap).toBeNull();
  });

  it('still reports the raw deltas and their SEs', () => {
    expect(result.primary.dKnowledge.mean).toBe(0);
    expect(result.primary.dSkill.mean).toBe(0);
    expect(result.primary.sum.se).toBe(0);
  });

  it('renders the UNDEFINED branch in the report', () => {
    const markdown = renderReport(result, '2026-01-01');
    expect(markdown).toContain('UNDEFINED (below noise floor)');
    expect(markdown).not.toContain('NaN');
  });
});

describe('report rendering', () => {
  it('emits no verdicts', () => {
    for (const result of [trivia, skill]) {
      const markdown = renderReport(result, '2026-01-01');
      expect(markdown).not.toMatch(/\bPASS\b|\bFAIL\b/);
      expect(markdown).toContain('rollouts per action | 64');
      expect(markdown).toContain('| seeds | 250 |');
    }
  });
});

/**
 * R0.6. Before the two-layer model the knowledge agents were handed the raw
 * state, so on a mode whose hidden content is an unknowable secret they were
 * measured as clairvoyant and the mode reported as pure recall. These tests are
 * the evidence that the fix works and that it costs the existing adapters
 * nothing.
 */
describe('two-layer hidden model', () => {
  it('defaults to exactly the identity, leaving secret-free adapters untouched', () => {
    // The strong form of "byte-identical numbers": an adapter with no declared
    // secret layer must produce the same per-seed scores as one that declares an
    // explicit identity knowledgeView. If the default ever stopped being the
    // identity, every score array below would move.
    for (const candidate of [calibTrivia, calibSkill]) {
      const withoutView = simulate(candidate, { seeds: SEEDS });
      const withIdentityView = simulate(
        { ...candidate, knowledgeView: (state: unknown) => state } as AnyCandidate,
        { seeds: SEEDS },
      );
      expect(withIdentityView.runs.map((run) => run.scores)).toEqual(
        withoutView.runs.map((run) => run.scores),
      );
      expect(withIdentityView.primary.recallShare).toBe(withoutView.primary.recallShare);
      expect(withoutView.knowledgeModel.secretsDeclared).toBe(false);
    }
  });

  it('records in the result and the report which semantics ran', () => {
    const secret = simulate(calibSecret, { seeds: 20 });
    expect(secret.knowledgeModel.secretsDeclared).toBe(true);
    expect(renderReport(secret, '2026-01-01')).toContain('declared — knowledge agents saw');

    const trivia = simulate(calibTrivia, { seeds: 20 });
    expect(trivia.knowledgeModel.secretsDeclared).toBe(false);
    expect(renderReport(trivia, '2026-01-01')).toContain('identity — candidate declares no secret');
  });

  describe('calib-secret: the same adapter read under both semantics', () => {
    const withModel = simulate(calibSecret, { seeds: SECRET_SEEDS });
    // Stripping knowledgeView is exactly the pre-R0.6 harness: the knowledge
    // agents get the raw state, secret and all.
    const clairvoyant = simulate({ ...calibSecret, knowledgeView: undefined } as AnyCandidate, {
      seeds: SECRET_SEEDS,
    });

    it('resolves recallShare under both semantics', () => {
      expect(withModel.primary.recallShare).not.toBeNull();
      expect(clairvoyant.primary.recallShare).not.toBeNull();
    });

    it('OLD semantics: reports a pure deduction mode as pure recall', () => {
      // Handed the true secret, both knowledge agents probe it and pin the
      // interval on move one, so search buys them nothing and the entire gap
      // lands on dKnowledge.
      expect(clairvoyant.primary.recallShare!).toBeGreaterThan(0.9);
      expect(clairvoyant.primary.dSkill.mean).toBeLessThan(
        3 * clairvoyant.primary.dSkill.se + 1e-12,
      );
    });

    it('NEW semantics: knowing the facts buys nothing, because there are none', () => {
      // Expert now draws its rollout roots from the same posterior SkillOnly
      // determinizes from, so dKnowledge is zero up to noise. Asserted against
      // this run's own SE rather than a fixed epsilon.
      const { dKnowledge } = withModel.primary;
      expect(Math.abs(dKnowledge.mean)).toBeLessThanOrEqual(3 * dKnowledge.se);
      expect(Math.abs(withModel.primary.recallShare!)).toBeLessThan(0.3);
    });

    it('NEW semantics: search still clearly moves the outcome', () => {
      // Without this the near-zero dKnowledge above would be vacuous — it must
      // be zero against a live denominator, not because nothing matters here.
      const { dSkill } = withModel.primary;
      expect(dSkill.mean).toBeGreaterThan(3 * dSkill.se);
      expect(withModel.primary.belowNoiseFloor).toBe(false);
    });

    it('NEW semantics: knowledge without search buys nothing over random', () => {
      // The calib-skill signature, reproduced by a different route: with no
      // facts in the mode, the 1-ply knowledge agent should sit on top of
      // uniform random. Under the old semantics it scored the maximum instead.
      const meanOfSecret = (result: SimulationResult, id: string) =>
        result.runs.find((entry) => entry.agentId === id)!.summary.mean;
      const gap = meanOfSecret(withModel, 'KnowledgeOnly') - meanOfSecret(withModel, 'ZeroKnowledge');
      const pairedSe = withModel.pairwise.find(
        (pair) => pair.a === 'ZeroKnowledge' && pair.b === 'KnowledgeOnly',
      )!.delta.se;
      expect(Math.abs(gap)).toBeLessThanOrEqual(3 * pairedSe);
      expect(
        meanOfSecret(clairvoyant, 'KnowledgeOnly') - meanOfSecret(clairvoyant, 'ZeroKnowledge'),
      ).toBeGreaterThan(3 * pairedSe);
    });

    it('the delta between the two readings is the proof the fix works', () => {
      expect(clairvoyant.primary.recallShare! - withModel.primary.recallShare!).toBeGreaterThan(0.6);
    });
  });
});

describe('calibration: directional separation', () => {
  it('resolves recallShare for both calibration candidates', () => {
    expect(trivia.primary.recallShare).not.toBeNull();
    expect(skill.primary.recallShare).not.toBeNull();
  });

  it('separates pure recall from pure skill by a wide margin', () => {
    const triviaShare = trivia.primary.recallShare!;
    const skillShare = skill.primary.recallShare!;
    expect(triviaShare - skillShare).toBeGreaterThan(0.5);
  });

  it('calib-trivia: skill without knowledge buys nothing over random', () => {
    const delta = meanOf(trivia, 'SkillOnly') - meanOf(trivia, 'ZeroKnowledge');
    const pairedSe = trivia.pairwise.find(
      (pair) => pair.a === 'ZeroKnowledge' && pair.b === 'SkillOnly',
    )!.delta.se;
    expect(Math.abs(delta)).toBeLessThan(3 * pairedSe);
  });

  it('calib-skill: knowledge without search buys nothing over random', () => {
    const delta = meanOf(skill, 'KnowledgeOnly') - meanOf(skill, 'ZeroKnowledge');
    const pairedSe = skill.pairwise.find(
      (pair) => pair.a === 'ZeroKnowledge' && pair.b === 'KnowledgeOnly',
    )!.delta.se;
    expect(Math.abs(delta)).toBeLessThanOrEqual(3 * pairedSe);
  });

  it('calib-skill: search dominates, with or without knowledge', () => {
    expect(meanOf(skill, 'Expert')).toBeGreaterThan(meanOf(skill, 'ZeroKnowledge'));
    expect(meanOf(skill, 'SkillOnly')).toBeGreaterThan(meanOf(skill, 'ZeroKnowledge'));
  });
});
