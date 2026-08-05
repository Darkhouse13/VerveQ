# Mode candidate sim — `calib-skill`

| field | value |
| --- | --- |
| candidate | `calib-skill` |
| description | Calibration adapter: pure structural decisions, no content. |
| date (UTC) | 2026-07-25 |
| harness version | R0.1-v2 |
| seeds | 1000 |
| seed range | 1..1000 |
| search budget — rollouts per action | 64 |
| search budget — max rollout depth | 512 |
| search budget — max episode decisions | 4096 |
| bootstrap resamples | 2000 |
| hidden info at t=0 | absent (empty private information set) |

## Per-agent outcome distribution

| agent | search | knowledge | mean | SE | median | p10 | p90 | min | max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ZeroKnowledge | none | none | 4.8810 | 0.2783 | 0.0000 | 0.0000 | 21.0000 | 0.0000 | 23.0000 |
| SkillOnly | rollout | none | 21.0000 | 0.0447 | 21.0000 | 19.0000 | 23.0000 | 19.0000 | 23.0000 |
| KnowledgeOnly | none | full | 4.8810 | 0.2783 | 0.0000 | 0.0000 | 21.0000 | 0.0000 | 23.0000 |
| Expert | rollout | full | 21.0000 | 0.0447 | 21.0000 | 19.0000 | 23.0000 | 19.0000 | 23.0000 |

### Terminal-state distribution

#### ZeroKnowledge

| terminal state | count | share |
| --- | --- | --- |
| bust | 763 | 76.3% |
| exact | 74 | 7.4% |
| short by 1 | 71 | 7.1% |
| short by 2 | 38 | 3.8% |
| short by 3 | 28 | 2.8% |
| short by 4 | 11 | 1.1% |
| short by 5 | 7 | 0.7% |
| short by 6 | 6 | 0.6% |
| short by 7 | 2 | 0.2% |

#### SkillOnly

| terminal state | count | share |
| --- | --- | --- |
| exact | 1000 | 100.0% |

#### KnowledgeOnly

| terminal state | count | share |
| --- | --- | --- |
| bust | 763 | 76.3% |
| exact | 74 | 7.4% |
| short by 1 | 71 | 7.1% |
| short by 2 | 38 | 3.8% |
| short by 3 | 28 | 2.8% |
| short by 4 | 11 | 1.1% |
| short by 5 | 7 | 0.7% |
| short by 6 | 6 | 0.6% |
| short by 7 | 2 | 0.2% |

#### Expert

| terminal state | count | share |
| --- | --- | --- |
| exact | 1000 | 100.0% |

## Pairwise seed-paired deltas

All four agents ran the same seed set, so every delta below is computed
seed-by-seed and its SE is the paired SE.

| A − B | mean paired delta | paired SE | delta / SE | n |
| --- | --- | --- | --- | --- |
| ZeroKnowledge − SkillOnly | -16.1190 | 0.2612 | -61.72 | 1000 |
| ZeroKnowledge − KnowledgeOnly | 0.0000 | 0.0000 | — | 1000 |
| ZeroKnowledge − Expert | -16.1190 | 0.2612 | -61.72 | 1000 |
| SkillOnly − KnowledgeOnly | 16.1190 | 0.2612 | 61.72 | 1000 |
| SkillOnly − Expert | 0.0000 | 0.0000 | — | 1000 |
| KnowledgeOnly − Expert | -16.1190 | 0.2612 | -61.72 | 1000 |

## Primary metrics

| metric | definition | value | SE |
| --- | --- | --- | --- |
| dKnowledge | Expert.mean − SkillOnly.mean (value of knowledge given skill) | 0.0000 | 0.0000 |
| dSkill | Expert.mean − KnowledgeOnly.mean (value of skill given knowledge) | 16.1190 | 0.2612 |
| dKnowledge + dSkill | per-seed 2·Expert − SkillOnly − KnowledgeOnly | 16.1190 | 0.2612 |
| 3 × SE(sum) | noise-floor comparison value | 0.7835 | — |

**recallShare = 0.0000**  (dKnowledge / (dKnowledge + dSkill))

| quantity | value |
| --- | --- |
| recallShare | 0.0000 |
| bootstrap SE | 0.0000 |
| bootstrap 2.5% | 0.0000 |
| bootstrap 97.5% | 0.0000 |
| bootstrap resamples discarded | 0 |

---

Numbers only. This harness sets no gate thresholds and emits no verdicts.
