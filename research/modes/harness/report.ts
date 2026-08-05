import { BOOTSTRAP_RESAMPLES, HARNESS_VERSION } from './budget.ts';
import type { SimulationResult } from './simulate.ts';

/**
 * Markdown rendering. Numbers only: no PASS/FAIL, no gate thresholds, no
 * verdicts. Threshold-setting is an owner decision, not a harness decision.
 */

function num(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return String(value);
  return value.toFixed(digits);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`);
  return [head, rule, ...body].join('\n');
}

export function renderReport(result: SimulationResult, isoDate: string): string {
  const { primary, budget } = result;
  const seedFirst = result.seeds[0];
  const seedLast = result.seeds[result.seeds.length - 1];

  const header = table(
    ['field', 'value'],
    [
      ['candidate', `\`${result.candidateId}\``],
      ['description', result.description],
      ['date (UTC)', isoDate],
      ['harness version', HARNESS_VERSION],
      ['seeds', String(result.seeds.length)],
      ['seed range', `${seedFirst}..${seedLast}`],
      ['search budget — rollouts per action', String(budget.rolloutsPerAction)],
      ['search budget — max rollout depth', String(budget.maxRolloutDepth)],
      ['search budget — max episode decisions', String(budget.maxEpisodeDecisions)],
      ['bootstrap resamples', String(BOOTSTRAP_RESAMPLES)],
      [
        'hidden info at t=0',
        result.hiddenAtStart.present
          ? `present — \`${result.hiddenAtStart.preview}\``
          : 'absent (empty private information set)',
      ],
      [
        'knowledge view',
        result.knowledgeModel.secretsDeclared
          ? 'declared — knowledge agents saw true facts with secrets resampled'
          : 'identity — candidate declares no secret layer, knowledge agents saw the raw state',
      ],
    ],
  );

  const agentTable = table(
    ['agent', 'search', 'knowledge', 'mean', 'SE', 'median', 'p10', 'p90', 'min', 'max'],
    result.runs.map((run) => [
      run.agentId,
      run.search,
      run.knowledge,
      num(run.summary.mean),
      num(run.summary.se),
      num(run.summary.median),
      num(run.summary.p10),
      num(run.summary.p90),
      num(run.summary.min),
      num(run.summary.max),
    ]),
  );

  const terminalSections = result.runs
    .map((run) => {
      const rows = run.terminalDistribution.map((bucket) => [
        bucket.label,
        String(bucket.count),
        pct(bucket.share),
      ]);
      const truncated =
        run.truncated > 0
          ? `\n\n${run.truncated} of ${run.summary.n} episodes hit the decision cap without reaching a terminal state.`
          : '';
      return `#### ${run.agentId}\n\n${table(['terminal state', 'count', 'share'], rows)}${truncated}`;
    })
    .join('\n\n');

  const pairwiseTable = table(
    ['A − B', 'mean paired delta', 'paired SE', 'delta / SE', 'n'],
    result.pairwise.map((pair) => [
      `${pair.a} − ${pair.b}`,
      num(pair.delta.mean),
      num(pair.delta.se),
      pair.delta.se === 0 ? '—' : num(pair.delta.mean / pair.delta.se, 2),
      String(pair.delta.n),
    ]),
  );

  const primaryTable = table(
    ['metric', 'definition', 'value', 'SE'],
    [
      [
        'dKnowledge',
        result.knowledgeModel.secretsDeclared
          ? 'Expert.mean − SkillOnly.mean (value of the knowable facts, given skill)'
          : 'Expert.mean − SkillOnly.mean (value of knowledge given skill)',
        num(primary.dKnowledge.mean),
        num(primary.dKnowledge.se),
      ],
      [
        'dSkill',
        'Expert.mean − KnowledgeOnly.mean (value of skill given knowledge)',
        num(primary.dSkill.mean),
        num(primary.dSkill.se),
      ],
      ['dKnowledge + dSkill', 'per-seed 2·Expert − SkillOnly − KnowledgeOnly', num(primary.sum.mean), num(primary.sum.se)],
      ['3 × SE(sum)', 'noise-floor comparison value', num(primary.noiseFloor), '—'],
    ],
  );

  const recallLines: string[] = [];
  if (primary.recallShare === null) {
    const sum = num(primary.sum.mean);
    const trigger =
      primary.noiseFloorReason === 'sum-not-finite'
        ? `dKnowledge + dSkill = ${sum} is not finite.`
        : primary.noiseFloorReason === 'sum-degenerate-zero'
          ? `dKnowledge + dSkill = ${sum} is zero within floating-point tolerance (|sum| < 1e-12).`
          : `dKnowledge + dSkill = ${sum} ≤ 3 × SE = ${num(primary.noiseFloor)}.`;
    recallLines.push(
      '**recallShare = UNDEFINED (below noise floor)**',
      '',
      trigger,
      '',
      'Neither skill nor knowledge moves outcomes on this candidate at this seed count',
      'and search budget. The raw deltas and their standard errors are in the table above.',
    );
  } else {
    const boot = primary.bootstrap;
    recallLines.push(
      `**recallShare = ${num(primary.recallShare)}**  (dKnowledge / (dKnowledge + dSkill))`,
      '',
      table(
        ['quantity', 'value'],
        [
          ['recallShare', num(primary.recallShare)],
          ['bootstrap SE', boot ? num(boot.se) : '—'],
          ['bootstrap 2.5%', boot ? num(boot.p2_5) : '—'],
          ['bootstrap 97.5%', boot ? num(boot.p97_5) : '—'],
          ['bootstrap resamples discarded', boot ? String(boot.discarded) : '—'],
        ],
      ),
    );
    if (primary.recallShare < 0 || primary.recallShare > 1) {
      recallLines.push(
        '',
        'Observation: recallShare fell outside [0, 1]. That happens when one of the two',
        'deltas is negative — the agent with the extra faculty scored below the agent',
        'without it. The raw deltas above are the thing to read in that case.',
      );
    }
  }

  return [
    `# Mode candidate sim — \`${result.candidateId}\``,
    '',
    header,
    '',
    '## Per-agent outcome distribution',
    '',
    agentTable,
    '',
    '### Terminal-state distribution',
    '',
    terminalSections,
    '',
    '## Pairwise seed-paired deltas',
    '',
    'All four agents ran the same seed set, so every delta below is computed',
    'seed-by-seed and its SE is the paired SE.',
    '',
    pairwiseTable,
    '',
    '## Primary metrics',
    '',
    primaryTable,
    '',
    ...recallLines,
    '',
    '---',
    '',
    'Numbers only. This harness sets no gate thresholds and emits no verdicts.',
    '',
  ].join('\n');
}
