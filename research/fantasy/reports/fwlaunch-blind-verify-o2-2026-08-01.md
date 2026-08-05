# FW-LAUNCH blind verification — O2 crowd voting — 2026-08-01

## VERDICT: PASS WITH NOTES

All persisted/live paths and all specified game rules conformed. One low-severity pure-layer edge is triggerable: a non-finite `voteCount` is treated as liquid and is not flagged insufficient. The shipped DB-backed vote path produces finite integer counts, so the live path was not affected.

## Conformance

| Spec rule | Implementation evidence | Result |
|---|---|---|
| Pairwise, server-served, never user-chosen | Only `servePairFor` constructs and inserts pair rows; public vote accepts an existing pair ID and choice (`app/convex/fantasyCrowdVoting.ts:185-284,300-357`). UI renders server-returned cards (`app/src/pages/shell/weekend/VoteScreen.tsx:123-148,202-215`). | ✓ |
| Same fixture first, same-league fallback, never cross-league | Candidate lists are built in that order and concatenated same-fixture first; fallback requires equal `leagueId` (`fantasyCrowdVoting.ts:235-241`). | ✓ |
| Liquidity-targeted serving | Eligible players are sorted least-voted first, with jitter only as tie-break (`fantasyCrowdVoting.ts:221-231`). | ✓ |
| “Didn't watch” is costless | Skip patches only pair status/time and returns before rating-row creation or Elo update (`fantasyCrowdVoting.ts:314-319`). | ✓ |
| Opens at full time; closes at finality instant and settlement stamp | Voteable pool includes appeared players only from fixtures with status `finished` (`fantasyCrowdVoting.ts:86-125`); window requires `now < finalityAt` and non-final settlement stamp (`fantasyCrowdVoting.ts:62-70`). | ✓ |
| Per-GW Elo starts 1500, K=32, one update per vote | Constants and standard Elo update are at `app/convex/lib/fantasyCrowd.ts:26-57`; rating rows initialize to 1500 and each accepted vote increments each count once (`fantasyCrowdVoting.ts:322-349`). | ✓ |
| Percentile within current verdict position; map to [−.15,+.15], median 0 | Freeze reads each current score row's `verdictPosition` (`fantasyCrowdVoting.ts:459-475`); derivation groups on that field and maps bounded rank percentile linearly (`fantasyCrowd.ts:102-142`). | ✓ |
| Threshold 25: zero + visible flag; sub-threshold excluded from population | Constants and early exclusion/flag are at `fantasyCrowd.ts:32,102-115`; only liquid maps form percentile groups. `SlotScoreCell` renders “insufficient votes” on settled zero-factor scored rows (`BudgetSquadScreen.tsx:369-409`). Crew sheet renders shared `SquadView`, which renders `SlotScoreCell` (`CrewSheetScreen.tsx:128-145`; `BudgetSquadScreen.tsx:317-318`). Valid persisted counts conform; malformed NaN caveat is Finding O2-F1. | ✓* |
| Ratings freeze and frozen factor is applied | Voting closes at cut/stamp; settlement invokes crowd application before finalizing rows (`fantasyScores.ts:1347-1368`); application refuses pre-finality and settled GWs (`fantasyCrowdVoting.ts:422-454`). | ✓ |
| Conflict exclusion over budget and crew contexts at serve time | Every squad for the user is scanned, filtered to this GW without context restriction, and filled players excluded before serving (`fantasyCrowdVoting.ts:131-154,213-215`). | ✓ |
| Single-use canonical pairs | `pairKeyOf` is order-independent (`fantasyCrowd.ts:64-68`); previously served keys are excluded (`fantasyCrowdVoting.ts:198-243`); cast rejects any non-`served` status before checking the window (`fantasyCrowdVoting.ts:304-312`). Schema indexes canonical key (`app/convex/schema.ts:2070-2087`). | ✓ |
| 300 serve cap | Constant 300 (`fantasyCrowd.ts:35`); serve counts existing GW pairs and refuses at cap (`fantasyCrowdVoting.ts:198-210`). | ✓ |
| Accuracy only post-settlement, canonical direction | Scorer requires final stamp (`fantasyCrowdVoting.ts:542-558`) and converts served orientation to canonical low-ID direction before consensus and accuracy comparison (`fantasyCrowdVoting.ts:570-612`). | ✓ |
| Court weight = 0.5 + rolling accuracy | `raterWeightOf` is exactly `0.5 + accurate/scored`, with historyless default 1.0 (`fantasyCrowd.ts:159-165`); rolling totals aggregate settled per-GW rows (`fantasyCrowdVoting.ts:629-650`). | ✓ |
| Factor derivation in-band by construction; write rejection remains safety net | Rank percentile is in [0,1], then `(p−.5)×2×.15` (`fantasyCrowd.ts:118-141`). `assertCrowdFactorInBand` rejects non-finite/out-of-band values (`fantasyScorePipeline.ts:158-165`). It runs at crowd-version write (`fantasyCrowdVoting.ts:498`) and at both ingest gates (`fantasyScores.ts:463-468,661-665`). | ✓ |
| Totals use the one mirrored-sign implementation | `totalFor` delegates to `applyCrowdFactor` (`fantasyScorePipeline.ts:125-132`); the sole executable `base >= 0 ? 1+f : 1-f` expression in named implementation inputs is `fantasyScoring.ts:839-841`. | ✓ |
| Crowd update creates N+1, copies base/hash, and stamps supersession | Insert copies `baseScores`, `statHash`, verdict, raw revision and spec version, sets `revisedFrom`, then patches old row's `supersededByVersion` (`fantasyCrowdVoting.ts:500-518`). | ✓ |

### Code → spec check

No persisted rule-shaped behavior lacked a spec sentence. The one malformed pure-input behavior is separately recorded as O2-F1.

## Adversarial results

1. **Extreme/invalid pure derivation:** `deriveCrowdFactors` was called with ratings −1,000,000, +1,000,000 and `NaN`, plus vote counts 24, 25 and `NaN`. Every emitted factor was finite and within ±0.15. Count 24 was factor 0 / `insufficientVotes:true`; count 25 was not flagged. A NaN count was factor 0 / `insufficientVotes:false`, triggerable as detailed in O2-F1.
2. **Second vote while open:** live walkthrough re-balloted a pair and returned exactly `That pair has already been answered.` Static order confirms status/used-pair rejection at `fantasyCrowdVoting.ts:304-308`, before gameweek/window lookup at lines 310-312; therefore closure could not be the refusal.
3. **Vote after close:** live output: `Voting for this gameweek has closed.` Structurally blocked by `votingWindowOpen` before any vote update (`fantasyCrowdVoting.ts:310-319`).
4. **Factor application before finality:** live output: `before finality — ratings are not frozen yet`; structurally returns zero writes (`fantasyCrowdVoting.ts:440-450`).
5. **Factor application after settlement:** live output: `settled gameweek immune`; structurally returns zero writes (`fantasyCrowdVoting.ts:429-439`).
6. **Version integrity:** direct table inspection found eight players with v1 provisional rows superseded by v2 final rows. For every player, v2 `statHash` and full `baseScores` exactly matched v1, `revisedFrom=1`, and v1 `supersededByVersion=2`; only the crowd factor/version/finality fields changed as intended.

## Live DEV transcript

Deployment contacted: **admired-warthog-495 only**. No external API call was made.

### Pre-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

### Walkthrough

```text
cd app && npx convex run fantasyCrowdSim:simulateCrowdWalkthrough '{"salt":"verify","keepData":true}'
```

Key output:

```json
{
  "verdict": "PASS",
  "votesCast": 139,
  "factorVersionsWritten": 8,
  "secondVoteRejected": "That pair has already been answered.",
  "afterCloseRejected": "Voting for this gameweek has closed.",
  "preFinalityRefused": "before finality — ratings are not frozen yet",
  "settledImmune": "settled gameweek immune",
  "kept": { "gameweekId": "th7fxfqb840pg183qp7a7rdc798bmep9" }
}
```

### Independent before-counts

```text
npx convex run fantasyCrowdSim:simCrowdState '{"gameweekId":"th7fxfqb840pg183qp7a7rdc798bmep9"}'
```

Returned **140 pairs, 8 ratings, 5 raterStats**. Rating counts were 34–35, all above threshold; five rater rows had 27/27 or 28/28 accuracy.

```text
npx convex run fantasyScoringDev:syntheticStatus '{"season":"SYNTH-O2-CROWD","gwNumber":902}'
```

Returned one final GW, one scored fixture, one final gameweek-scoring row, and **8 raw rows**. Direct `fantasyPlayerScores` inspection added **16 score rows** (8 v1 + 8 v2) and verified the version-copy invariant above.

Before synthetic counts: gameweeks 1, fixtures 1, players 8, raw rows 8, score rows 16, fixture-scoring rows 1, gameweek-scoring rows 1. Crowd-side rows: 153 = pairs 140 + ratings 8 + rater stats 5; sim users 5.

### Purge

```text
CROWD PURGE 1: { "deleted": 153, "deletedUsers": 5 }
CROWD PURGE 2: { "deleted": 0, "deletedUsers": 0 }

SYNTH PURGE 1: {
  "fixtureScoringRows": 1, "fixtures": 1, "gameweekScoringRows": 1,
  "gameweeks": 1, "players": 8, "rawRows": 8, "scoreRows": 16
}
SYNTH PURGE 2: {
  "fixtureScoringRows": 0, "fixtures": 0, "gameweekScoringRows": 0,
  "gameweeks": 0, "players": 0, "rawRows": 0, "scoreRows": 0
}
```

Post-purge state queries returned `{pairs:0,raterStats:[],ratings:[]}` and no synthetic-status payload. Before → after: crowd rows **153→0**, sim users **5→0**, gameweeks **1→0**, fixtures **1→0**, players **8→0**, raw rows **8→0**, score rows **16→0**, fixture-scoring **1→0**, gameweek-scoring **1→0**.

### Post-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

## Findings

### O2-F1 — LOW — Non-finite vote count is treated as liquid by the pure derivation

**Evidence:** `deriveCrowdFactors` only tests `entry.voteCount < 25` (`app/convex/lib/fantasyCrowd.ts:109`). In JavaScript, `NaN < 25` is false, so an entry with `voteCount: NaN` enters the liquid group. The required adversarial call returned `{playerId:"nanCount", factor:0, insufficientVotes:false}`.

**Exact trigger:** call `deriveCrowdFactors([{playerId:"nanCount", verdictPosition:"ATT", rating:1234, voteCount:Number.NaN}])`.

**Spec disagreement:** a non-count has no evidence satisfying “25 votes”; nevertheless the implementation treats it as threshold-sufficient and does not show the required insufficient-votes flag. This is also code behavior with no spec authorization.

**Blast radius:** direct callers of the pure function with malformed counts can suppress the visible insufficiency flag and include malformed entries in percentile populations. The named DB-backed path creates counts at 0 and increments by one, and the live run showed finite counts, so no shipped persisted trigger was established.

## Scope disclosures and limits

- Read the explicitly named `app/src/test/fantasyCrowd.test.ts` despite the general test-file prohibition.
- Read only SCORING_SPEC's explicitly named Crowd multiplier section (located with context grep).
- Read only the crowd-table region of `app/convex/schema.ts`.
- Read `app/convex/fantasyScores.ts` only through searches/context for the explicitly named settlement hook, score insert sites, factor guards, and supersession sites. Search context displayed adjacent finalization text, but it was not used beyond those named responsibilities.
- Read only `SlotScoreCell` and its render call in `BudgetSquadScreen.tsx`, as explicitly authorized. `CrewSheetScreen.tsx` was a full named input.
- `app/convex/fantasyCrowdSim.ts` was run but not read, as required.
- No repository file outside O2's named inputs was directly opened or grepped. `npm run check` printed the expected synthetic-error stack naming `app/src/test/errorMonitoringContract.test.tsx`; that file was not opened or inspected.
- Direct DEV score-table inspection was used to independently compare versions; no PROD command or external API was used.
