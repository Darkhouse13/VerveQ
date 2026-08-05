# Mode candidate sim harness

Research tooling for evaluating **unbuilt** game-mode candidates. Standalone: no
Convex, no React, no network, no dependency on `app/`. It ships nothing to users
and is deliberately not wired into the app CI.

The question it answers: for a given mode candidate, **how much of the outcome is
driven by content knowledge versus by structural skill?**

## Running it

```bash
cd research/modes
npm install

npm run sim -- --candidate calib-trivia            # 1000 seeds, default
npm run sim -- --candidate calib-skill --seeds 200
npm run sim -- --list

npm run check                                      # tsc --noEmit + vitest
```

Reports land in `reports/<candidate>-<YYYY-MM-DD>.md`.

## The two-layer hidden model (R0.6)

Hidden state splits in two, and the split is the whole point of the metric:

- **Knowable facts** — content a well-informed player genuinely knows. Which
  club a player actually played for. Withheld by the UI, recoverable from the
  world.
- **Secrets** — content nobody can know, because the seed drew it at random.
  Which of 32 values today's hidden target is. Only deduction narrows it.

Before R0.6 the knowledge agents were handed the raw state and saw both. On a
secret-bearing mode that made `dKnowledge` measure **clairvoyance** rather than
the value of facts, so every deduction candidate would have scored as pure
recall — the exact mistake that would have wrongly killed a mode like
`lock-eleven`.

An adapter now declares where the line falls:

```ts
knowledgeView?(state: S, rng: Rng): S;   // true facts, secrets resampled
```

Knowledge agents get that view instead of the raw state. `determinize`
resamples *everything* hidden; `knowledgeView` resamples *only the secrets*. The
gap between them is `dKnowledge`, and it is now the value of the facts alone.

**The default is the identity, and it is a claim, not a convenience.** Omitting
`knowledgeView` asserts "this mode has no secrets." The harness cannot check
that — `hidden()` returns both layers mixed together and nothing in the shape of
the data says which is which. A secret-bearing adapter that forgets
`knowledgeView` will silently report inflated `dKnowledge`. That is the most
damaging mistake available to an adapter author here.

Two details that matter more than they look:

- **The searching knowledge agent draws a fresh view per rollout**, not one per
  decision. With a single draw it would integrate over one sampled world while
  its blind counterpart integrates over 64, and the gap would measure
  Monte-Carlo sample count rather than knowledge.
- **`knowledgeView` must preserve the legal-action count and order**, same as
  `determinize`. Checked up front, and again on every Expert rollout.

### Compatibility

Adapters with no `knowledgeView` produce **bit-for-bit the numbers they produced
before R0.6** — verified across every per-seed score, pairwise delta and primary
metric for both existing adapters at 250 and 1000 seeds. The knowledge-view RNG
lives on its own sub-streams and the identity path takes the true state directly
rather than calling a supplied identity function, so nothing an existing adapter
touches is perturbed. Reports written under `R0.1-v2` remain valid as numbers.

The version bumped to `R0.6-v1` anyway, because `dKnowledge` no longer means the
same thing for every adapter and a reader cannot otherwise tell which semantics
produced a report. Every report now carries a `knowledge view` header row saying
which one ran.

## The 2x2

Four stock agents span (search x knowledge). They are candidate-agnostic — there
are no per-candidate heuristics anywhere in `harness/agents.ts`.

|               | no search       | search      |
| ------------- | --------------- | ----------- |
| no knowledge  | `ZeroKnowledge` | `SkillOnly` |
| knowledge     | `KnowledgeOnly` | `Expert`    |

- **ZeroKnowledge** — uniform random over legal actions.
- **SkillOnly** — for each legal action, roll out from `determinize`d states and
  take the best mean score. Searches hard over a world it cannot see into.
- **KnowledgeOnly** — 1-ply greedy on the knowledge view's immediate score.
- **Expert** — SkillOnly's exact rollout machinery, run on the knowledge view.

"Knowledge view" is the true state for a candidate that declares no secrets, and
the true facts with secrets resampled for one that does. See above.

Knowledge denial is enforced by construction rather than by convention: a
no-knowledge agent is handed a view object that has no `state` property at all,
only `revealed`. There is nothing to peek at.

SkillOnly and Expert share one rollout function and one budget constant
(`harness/budget.ts`), so their budgets are identical by construction. The budget
is never tuned per candidate and is recorded in every report header.

## Metrics

```
dKnowledge  = Expert.mean - SkillOnly.mean       value of knowledge given skill
dSkill      = Expert.mean - KnowledgeOnly.mean   value of skill given knowledge
recallShare = dKnowledge / (dKnowledge + dSkill)
```

All deltas are seed-paired (every agent sees the same seed set) and reported with
paired SEs. `recallShare` also carries a seeded bootstrap interval.

**Noise floor.** If `dKnowledge + dSkill <= 3 x SE(sum)`, `recallShare` is emitted
as `UNDEFINED (below noise floor)` along with the raw deltas and SEs. That means
neither faculty moves outcomes — a finding about the candidate, not an error.

The harness emits **numbers only**. No PASS/FAIL, no gate thresholds. Setting a
threshold is an owner decision.

## Writing an adapter

Implement `ModeCandidate<S, A, Pub, Priv>` from `harness/types.ts` and register it
in `harness/registry.ts`. Three contracts matter:

1. **`apply` is pure.** All per-episode randomness is seeded in `init(seed)` and
   carried inside `S`. This is what makes seed-pairing valid.
2. **`determinize` preserves the legal-action count and order.** A state consistent
   with `revealed`, with hidden content resampled uniformly from its plausible
   space. Checked up front; a violation throws rather than skewing a metric.
3. **`score` is defined off-terminal.** If the mode has no partial credit, return 0
   until terminal. That is legitimate, and it makes 1-ply greedy degenerate to
   random — which is itself informative.

A fourth applies to any mode with a secret layer:

4. **Declare `knowledgeView` if the mode has secrets.** Resample only the secret
   layer, from the same prior `determinize` uses given what is revealed, and
   leave every knowable fact true. Omitting it on a secret-bearing mode
   overstates `dKnowledge`; resampling a knowable fact understates it. Both are
   silent. The count/order check is enforced; which layer is which cannot be.

## Calibration adapters

Three throwaway adapters in `candidates/` validate the metric itself. If the
harness cannot separate them, the metric is wrong — that is reported as a
finding, not tuned away.

| adapter        | shape                          | expected                                          |
| -------------- | ------------------------------ | ------------------------------------------------- |
| `calib-trivia` | pure recall, no decisions      | recallShare near 1; SkillOnly ~ ZeroKnowledge      |
| `calib-skill`  | pure structure, no content     | recallShare near 0; KnowledgeOnly ~ ZeroKnowledge  |
| `calib-secret` | pure deduction, zero facts     | recallShare near 0; **near 1 under old semantics** |

Observed at 1000 seeds, budget 64 rollouts/action:

| adapter        | ZeroKnowledge | SkillOnly | KnowledgeOnly | Expert | dKnowledge | dSkill  | recallShare |
| -------------- | ------------- | --------- | ------------- | ------ | ---------- | ------- | ----------- |
| `calib-trivia` | 2.010         | 2.068     | 8.000         | 8.000  | 5.932      | 0.000   | 1.0000      |
| `calib-skill`  | 4.881         | 21.000    | 4.881         | 21.000 | 0.000      | 16.119  | 0.0000      |
| `calib-secret` | 2.713         | 3.598     | 2.727         | 3.576  | -0.021     | 0.850   | -0.0258     |

The first two rows are unchanged from before R0.6, to the digit.

### What `calib-secret` proves

It is the instrument for the two-layer model, and it works by being read twice.
The adapter's hidden content is a value drawn at random by the seed — nobody can
know it, so a mode built on it is pure deduction and its honest recallShare is
zero.

| semantics                          | dKnowledge | dSkill | recallShare |
| ---------------------------------- | ---------- | ------ | ----------- |
| **R0.6** (knowledgeView declared)  | ~0         | ~0.85  | **~0.00**   |
| **pre-R0.6** (knowledgeView stripped) | ~1.38   | 0.000  | **1.0000**  |

Under the old semantics both knowledge agents are handed the true secret, probe
it, and pin the interval on move one — so search buys them nothing, `dSkill` is
exactly zero, and the metric declares a pure deduction mode to be pure recall.
Under R0.6 Expert draws its rollout roots from the same posterior SkillOnly
determinizes from, `dKnowledge` collapses into the noise, and the reading is
correct.

The R0.6 row also reproduces `calib-skill`'s signature independently:
KnowledgeOnly (2.727) sits on top of ZeroKnowledge (2.713), z = -0.22. Knowledge
without search buys nothing over random, which is what a mode with no facts in
it should say.

That delta of ~1.0 on a single unchanged adapter is the evidence the fix does
what it claims. `tests/calibration.test.ts` asserts it directly by running
`calib-secret` with its `knowledgeView` stripped.

`vitest` asserts directional separation only, never absolute thresholds. Claims
of the form "this quantity is zero" are asserted against that run's own 3 x SE
rather than a fixed epsilon, so the test states the statistical claim it means.
`dKnowledge` on `calib-secret` was checked for drift across five independent
1500-seed sets: z = -1.06, -0.26, +2.01, -0.60, -1.42 — it wanders around zero
and changes sign, so the near-zero reading is noise around zero rather than a
small systematic bias.
