# Mode candidate sim — `calib-secret`

| field | value |
| --- | --- |
| candidate | `calib-secret` |
| description | Calibration adapter: pure deduction on a random secret, zero facts. |
| date (UTC) | 2026-07-26 |
| harness version | R0.6-v1 |
| seeds | 1000 |
| seed range | 1..1000 |
| search budget — rollouts per action | 64 |
| search budget — max rollout depth | 512 |
| search budget — max episode decisions | 4096 |
| bootstrap resamples | 2000 |
| hidden info at t=0 | present — `{"secret":22}` |
| knowledge view | declared — knowledge agents saw true facts with secrets resampled |

## Per-agent outcome distribution

| agent | search | knowledge | mean | SE | median | p10 | p90 | min | max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ZeroKnowledge | none | none | 2.7126 | 0.0480 | 2.4150 | 0.9125 | 5.0000 | 0.1420 | 5.0000 |
| SkillOnly | rollout | none | 3.5975 | 0.0303 | 3.4150 | 2.4150 | 5.0000 | 1.4150 | 5.0000 |
| KnowledgeOnly | none | full | 2.7265 | 0.0480 | 2.4150 | 0.9125 | 5.0000 | 0.1926 | 5.0000 |
| Expert | rollout | full | 3.5761 | 0.0306 | 3.4150 | 2.4150 | 5.0000 | 1.5406 | 5.0000 |

### Terminal-state distribution

#### ZeroKnowledge

| terminal state | count | share |
| --- | --- | --- |
| pinned | 232 | 23.2% |
| 4 left | 65 | 6.5% |
| 6 left | 60 | 6.0% |
| 8 left | 60 | 6.0% |
| 2 left | 55 | 5.5% |
| 7 left | 54 | 5.4% |
| 5 left | 51 | 5.1% |
| 3 left | 49 | 4.9% |
| 9 left | 49 | 4.9% |
| 12 left | 43 | 4.3% |
| 11 left | 34 | 3.4% |
| 10 left | 32 | 3.2% |
| 15 left | 30 | 3.0% |
| 14 left | 28 | 2.8% |
| 18 left | 26 | 2.6% |
| 17 left | 22 | 2.2% |
| 13 left | 21 | 2.1% |
| 16 left | 19 | 1.9% |
| 19 left | 13 | 1.3% |
| 21 left | 12 | 1.2% |
| 22 left | 12 | 1.2% |
| 20 left | 11 | 1.1% |
| 23 left | 9 | 0.9% |
| 24 left | 7 | 0.7% |
| 26 left | 3 | 0.3% |
| 27 left | 1 | 0.1% |
| 28 left | 1 | 0.1% |
| 29 left | 1 | 0.1% |

#### SkillOnly

| terminal state | count | share |
| --- | --- | --- |
| pinned | 255 | 25.5% |
| 3 left | 199 | 19.9% |
| 4 left | 161 | 16.1% |
| 2 left | 136 | 13.6% |
| 5 left | 123 | 12.3% |
| 6 left | 76 | 7.6% |
| 7 left | 27 | 2.7% |
| 8 left | 14 | 1.4% |
| 9 left | 6 | 0.6% |
| 10 left | 2 | 0.2% |
| 12 left | 1 | 0.1% |

#### KnowledgeOnly

| terminal state | count | share |
| --- | --- | --- |
| pinned | 237 | 23.7% |
| 5 left | 64 | 6.4% |
| 4 left | 63 | 6.3% |
| 6 left | 60 | 6.0% |
| 3 left | 53 | 5.3% |
| 7 left | 51 | 5.1% |
| 8 left | 49 | 4.9% |
| 2 left | 47 | 4.7% |
| 9 left | 46 | 4.6% |
| 10 left | 40 | 4.0% |
| 11 left | 37 | 3.7% |
| 13 left | 37 | 3.7% |
| 15 left | 29 | 2.9% |
| 16 left | 28 | 2.8% |
| 12 left | 25 | 2.5% |
| 14 left | 25 | 2.5% |
| 19 left | 22 | 2.2% |
| 18 left | 19 | 1.9% |
| 17 left | 17 | 1.7% |
| 20 left | 17 | 1.7% |
| 21 left | 11 | 1.1% |
| 22 left | 8 | 0.8% |
| 24 left | 6 | 0.6% |
| 23 left | 3 | 0.3% |
| 26 left | 3 | 0.3% |
| 25 left | 2 | 0.2% |
| 28 left | 1 | 0.1% |

#### Expert

| terminal state | count | share |
| --- | --- | --- |
| pinned | 246 | 24.6% |
| 3 left | 204 | 20.4% |
| 4 left | 161 | 16.1% |
| 2 left | 145 | 14.5% |
| 5 left | 96 | 9.6% |
| 6 left | 61 | 6.1% |
| 7 left | 57 | 5.7% |
| 8 left | 18 | 1.8% |
| 9 left | 8 | 0.8% |
| 10 left | 2 | 0.2% |
| 11 left | 2 | 0.2% |

## Pairwise seed-paired deltas

All four agents ran the same seed set, so every delta below is computed
seed-by-seed and its SE is the paired SE.

| A − B | mean paired delta | paired SE | delta / SE | n |
| --- | --- | --- | --- | --- |
| ZeroKnowledge − SkillOnly | -0.8848 | 0.0564 | -15.68 | 1000 |
| ZeroKnowledge − KnowledgeOnly | -0.0138 | 0.0632 | -0.22 | 1000 |
| ZeroKnowledge − Expert | -0.8635 | 0.0564 | -15.30 | 1000 |
| SkillOnly − KnowledgeOnly | 0.8710 | 0.0554 | 15.73 | 1000 |
| SkillOnly − Expert | 0.0214 | 0.0426 | 0.50 | 1000 |
| KnowledgeOnly − Expert | -0.8496 | 0.0570 | -14.91 | 1000 |

## Primary metrics

| metric | definition | value | SE |
| --- | --- | --- | --- |
| dKnowledge | Expert.mean − SkillOnly.mean (value of the knowable facts, given skill) | -0.0214 | 0.0426 |
| dSkill | Expert.mean − KnowledgeOnly.mean (value of skill given knowledge) | 0.8496 | 0.0570 |
| dKnowledge + dSkill | per-seed 2·Expert − SkillOnly − KnowledgeOnly | 0.8283 | 0.0840 |
| 3 × SE(sum) | noise-floor comparison value | 0.2520 | — |

**recallShare = -0.0258**  (dKnowledge / (dKnowledge + dSkill))

| quantity | value |
| --- | --- |
| recallShare | -0.0258 |
| bootstrap SE | 0.0548 |
| bootstrap 2.5% | -0.1495 |
| bootstrap 97.5% | 0.0650 |
| bootstrap resamples discarded | 0 |

Observation: recallShare fell outside [0, 1]. That happens when one of the two
deltas is negative — the agent with the extra faculty scored below the agent
without it. The raw deltas above are the thing to read in that case.

---

Numbers only. This harness sets no gate thresholds and emits no verdicts.
