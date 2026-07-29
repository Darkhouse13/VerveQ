# MOVED — the scoring engine now ships in the app

**Ticket FW-4, owner ruling R1 (2026-07-29): ONE ENGINE.**

The three files that used to live in this directory are gone from here, not
copied. Their new homes:

| Was | Is now |
| --- | --- |
| `scoring/scoring.ts` | **`app/convex/lib/fantasyScoring.ts`** |
| `scoring/types.ts` | folded into the same file |
| `scoring/events.ts` | **`app/convex/lib/fantasyFeedStats.ts`**, with the feed normalisation that used to sit in `sim/dataset.ts` |

## Why

Convex bundles from `app/convex/`, so the scoring execution pipeline could only
have reached an engine in `research/` by copying it — and a copied scoring engine
is two engines that agree until the first time somebody edits one. The engine is
now a single file with two callers: the FS-1 sim harness in this package, and the
live pipeline in `app/convex/fantasyScores.ts`. The FW-4 regression gate asserts
they produce identical numbers from identical inputs.

`sim/dataset.ts`'s normalisation moved for the same reason. The engine cannot be
scored without turning a feed payload into a `PlayerMatchStats`, and that
translation carries every measured trap in the feed (`passes.accuracy` is an
accurate-pass count shipped as a string on the per-fixture endpoint — though a
*percentage* on the season-aggregate endpoint `pricing/proxy.ts` reads;
`penalty.commited` is the feed's own misspelling; a `subst` event names the
incoming player in `assist`, not in `player`; null means "did not record this").
A second normaliser in the ingest path would have made the regression gate
compare two translations as much as one engine.

## What did NOT change

The arithmetic. The move was verified by re-running the full sweep:

```
npx tsx sim/run.ts --n 2000 --seed 20260729
```

reproduces `reports/fs1-phase4b-v050-2026-07-29.json` byte for byte apart from
`meta.generatedAt`, and the acceptance suite (`tests/scoring.test.ts`) passes
unchanged against the new location. `SCORING_SPEC.md` is untouched and remains
**v0.5.1, LOCKED**.

One structural edit was made while moving, and it changes no number:
`applyCrowdFactor` was extracted from `scorePlayer`'s crowd block and exported,
because FW-4 R5 stores `baseScore` and `crowdFactor` separately and derives the
total on read — and the mirroring rule for a negative base (a positive crowd
verdict must shrink a negative score toward zero, never deepen it) must have
exactly one definition. `scorePlayer` calls it too.

## If you are looking for the engine to change it

You are almost certainly in the wrong place twice over: the spec is LOCKED, and
the file is `app/convex/lib/fantasyScoring.ts`. Changing a constant needs a new
owner ruling backed by a new measurement (`SCORING_SPEC.md` §Changelog), and
whatever you change is scored by both the harness and every user's weekend.
