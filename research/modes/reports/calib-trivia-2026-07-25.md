# Mode candidate sim — `calib-trivia`

| field | value |
| --- | --- |
| candidate | `calib-trivia` |
| description | Calibration adapter: pure recall, no structural decisions. |
| date (UTC) | 2026-07-25 |
| harness version | R0.1-v2 |
| seeds | 1000 |
| seed range | 1..1000 |
| search budget — rollouts per action | 64 |
| search budget — max rollout depth | 512 |
| search budget — max episode decisions | 4096 |
| bootstrap resamples | 2000 |
| hidden info at t=0 | present — `{"remainingAnswers":[2,1,3,3,0,2,0,1]}` |

## Per-agent outcome distribution

| agent | search | knowledge | mean | SE | median | p10 | p90 | min | max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ZeroKnowledge | none | none | 2.0100 | 0.0384 | 2.0000 | 1.0000 | 4.0000 | 0.0000 | 6.0000 |
| SkillOnly | rollout | none | 2.0680 | 0.0400 | 2.0000 | 1.0000 | 4.0000 | 0.0000 | 7.0000 |
| KnowledgeOnly | none | full | 8.0000 | 0.0000 | 8.0000 | 8.0000 | 8.0000 | 8.0000 | 8.0000 |
| Expert | rollout | full | 8.0000 | 0.0000 | 8.0000 | 8.0000 | 8.0000 | 8.0000 | 8.0000 |

### Terminal-state distribution

#### ZeroKnowledge

| terminal state | count | share |
| --- | --- | --- |
| 2/8 correct | 322 | 32.2% |
| 1/8 correct | 262 | 26.2% |
| 3/8 correct | 198 | 19.8% |
| 4/8 correct | 100 | 10.0% |
| 0/8 correct | 97 | 9.7% |
| 5/8 correct | 16 | 1.6% |
| 6/8 correct | 5 | 0.5% |

#### SkillOnly

| terminal state | count | share |
| --- | --- | --- |
| 2/8 correct | 304 | 30.4% |
| 1/8 correct | 252 | 25.2% |
| 3/8 correct | 219 | 21.9% |
| 0/8 correct | 98 | 9.8% |
| 4/8 correct | 90 | 9.0% |
| 5/8 correct | 32 | 3.2% |
| 6/8 correct | 4 | 0.4% |
| 7/8 correct | 1 | 0.1% |

#### KnowledgeOnly

| terminal state | count | share |
| --- | --- | --- |
| 8/8 correct | 1000 | 100.0% |

#### Expert

| terminal state | count | share |
| --- | --- | --- |
| 8/8 correct | 1000 | 100.0% |

## Pairwise seed-paired deltas

All four agents ran the same seed set, so every delta below is computed
seed-by-seed and its SE is the paired SE.

| A − B | mean paired delta | paired SE | delta / SE | n |
| --- | --- | --- | --- | --- |
| ZeroKnowledge − SkillOnly | -0.0580 | 0.0554 | -1.05 | 1000 |
| ZeroKnowledge − KnowledgeOnly | -5.9900 | 0.0384 | -156.05 | 1000 |
| ZeroKnowledge − Expert | -5.9900 | 0.0384 | -156.05 | 1000 |
| SkillOnly − KnowledgeOnly | -5.9320 | 0.0400 | -148.44 | 1000 |
| SkillOnly − Expert | -5.9320 | 0.0400 | -148.44 | 1000 |
| KnowledgeOnly − Expert | 0.0000 | 0.0000 | — | 1000 |

## Primary metrics

| metric | definition | value | SE |
| --- | --- | --- | --- |
| dKnowledge | Expert.mean − SkillOnly.mean (value of knowledge given skill) | 5.9320 | 0.0400 |
| dSkill | Expert.mean − KnowledgeOnly.mean (value of skill given knowledge) | 0.0000 | 0.0000 |
| dKnowledge + dSkill | per-seed 2·Expert − SkillOnly − KnowledgeOnly | 5.9320 | 0.0400 |
| 3 × SE(sum) | noise-floor comparison value | 0.1199 | — |

**recallShare = 1.0000**  (dKnowledge / (dKnowledge + dSkill))

| quantity | value |
| --- | --- |
| recallShare | 1.0000 |
| bootstrap SE | 0.0000 |
| bootstrap 2.5% | 1.0000 |
| bootstrap 97.5% | 1.0000 |
| bootstrap resamples discarded | 0 |

---

Numbers only. This harness sets no gate thresholds and emits no verdicts.
