/**
 * The single shared search budget.
 *
 * SkillOnly and Expert both run their rollouts through `evaluateActions` in
 * agents.ts, which reads these constants and nothing else. There is deliberately
 * no per-candidate override and no CLI flag: tuning the budget per candidate
 * would make cross-candidate recallShare numbers incomparable. Every report
 * header records these values.
 */
export const SEARCH_BUDGET = {
  /** Monte-Carlo rollouts per legal action, per decision. */
  rolloutsPerAction: 64,
  /** Hard stop on a single rollout, so a buggy candidate cannot hang the run. */
  maxRolloutDepth: 512,
  /** Hard stop on a single episode, same reason. */
  maxEpisodeDecisions: 4096,
} as const;

/** Bootstrap resamples used for the interval around recallShare. Seeded. */
export const BOOTSTRAP_RESAMPLES = 2000;

/**
 * Bumped at R0.6 for the two-layer hidden model. The numbers produced for a
 * candidate that declares no secret layer are bit-for-bit unchanged, so reports
 * carrying `R0.1-v2` remain valid as numbers. The bump exists because
 * `dKnowledge` no longer means the same thing for every adapter: on a candidate
 * that declares secrets it is now the value of the knowable facts rather than
 * the value of clairvoyance, and a reader cannot tell which semantics produced
 * a report without this field and the `knowledge view` header row beside it.
 */
export const HARNESS_VERSION = 'R0.6-v1';
