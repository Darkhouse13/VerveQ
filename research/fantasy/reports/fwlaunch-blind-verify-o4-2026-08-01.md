# FW-LAUNCH blind verification — O4 tie-break ladders — 2026-08-01

## VERDICT: FAIL

The pure ladders, normal scored crew-table path, lazy-read design, and live integration path passed. The crew-table wrapper violates the locked missing-data policy when an entire equal-rank cluster has `cumulativePoints:null`: it assigns a shared rank but explicitly leaves every row `tied:false`, so an exhausted no-fact ladder is not displayed as a tie.

## Conformance

The three authoritative spec locations agree: §Tie-breaks, §Explicitly deferred, and ledger item 5 all say cumulative points primary; equal cumulative points break by head-to-head weekend wins; still level is a displayed tie.

| Spec rule | Implementation evidence | Result |
|---|---|---|
| Weekend ladder: points → higher top-player score → fewer auto-picks → shared | `compareWeekendResult` checks points, then only available unequal top scores, then only available unequal auto counts (reversed so fewer wins), else zero (`app/convex/lib/fantasyTieBreaks.ts:34-47`). | ✓ |
| Crew primary ordering is cumulative points | Rows compute summed scored weekends and sort descending before any ladder work (`app/convex/fantasyScores.ts:1960-1994`). H2H is entered only for same initial rank (`:2064-2087`). | ✓ |
| Equal cumulative points break by H2H weekend wins | `orderTiedGroup` compares only common room IDs and counts pairwise weekend winners, then sorts descending wins (`fantasyTieBreaks.ts:75-92`); `crewTableFor` applies results only to tied cumulative clusters (`fantasyScores.ts:2064-2101`). | ✓ |
| Still-level members remain displayed ties | Pure library derives shared `subRank` and `stillTied:true` for equal H2H wins (`fantasyTieBreaks.ts:94-102`); crew wrapper copies this for numeric tied clusters (`fantasyScores.ts:2087-2095`). However all-null clusters are skipped after `row.tied=false`, violating this rule (O4-F1). | ✗ |
| Auto-pick counts come from draft log | Lazy helper queries `fantasyDraftLog` and counts only pick rows with `auto===true` (`fantasyScores.ts:2015-2034`); no alternate stored auto count is used. | ✓ |
| Payload says `tieBreaksApplied:true` | Interface literal and returned payload both carry true (`fantasyScores.ts:1831-1835,2104-2111`). Live probe returned true. | ✓ |
| Null weekend total abstains from every rung | `compareWeekendResult` returns zero immediately if either total is null, before top/auto checks (`fantasyTieBreaks.ts:34-35`). | ✓ |
| Unavailable rung falls through | Top score and auto-pick rungs compare only when both sides are non-null (`fantasyTieBreaks.ts:38-45`). | ✓ |
| Exhausted ladder is a displayed tie | Pure library conforms, including disjoint maps. `crewTableFor` fails for clusters whose cumulative totals are all null (`fantasyScores.ts:2000-2008,2066-2070`). | ✗ |
| Settled points read stamped `finalScore`, no per-slot points read | Settled branch reads `squad.finalScore` directly (`fantasyScores.ts:1941-1947`). | ✓ |
| Provisional weekend with scored fixture derives live via `squadScore` | `else if (anyScored)` calls `squadScore` (`fantasyScores.ts:1947-1953`). | ✓ |
| Top-score and draft-log reads occur only for tied clusters | Helpers are defined outside but invoked only while building a cluster after `cluster.length >= 2` and numeric cumulative points (`fantasyScores.ts:2064-2082`). Untied tables never invoke either. | ✓ |

### Code → spec check

No extra tie-break rung was invented. Stable original-index ordering only makes tied payload order deterministic; it does not change ranks or `tied` flags. O4-F1 is the sole implementation/spec disagreement found.

## Adversarial results

A generated scratch file imported only `app/convex/lib/fantasyTieBreaks.ts` and was run with `npx tsx` (no DB/tests).

1. **Three-way 2–1–0 H2H:** structurally produced A `{wins:2,subRank:0}`, B `{1,1}`, C `{0,2}`, all `stillTied:false`.
2. **Dead heat every rung:** all three returned wins 0, `subRank:0`, `stillTied:true`.
3. **Disjoint weekend maps:** common-room lookup found none (`fantasyTieBreaks.ts:80-82`); both returned wins 0, rank 0, tied true.
4. **Null points:** `compareWeekendResult({points:null,top:999,auto:0},{points:1,top:-999,auto:99})` returned 0, proving every lower rung abstains.
5. **Null top score:** equal points with one null top fell through; 0 vs 2 auto-picks returned +2 for the fewer-auto member.
6. **Null auto-picks:** equal points/top with one null auto exhausted to 0.
7. **Hand recomputation:** A beat B in AB and C in AC = 2 wins; B lost AB but beat C in BC = 1; C lost both = 0. Hand ranks 0/1/2 exactly matched the library.
8. **Crew-wrapper all-null cluster:** triggerable statically: with two active crew members and completed-room entries where neither has any scored weekend, both cumulative totals are null. Initial rank assignment gives both the same rank and sets both `tied:false`; the cluster guard then skips ladder application because cumulative is null. Exact steps and impact are O4-F1.

## Live DEV transcript

Deployment contacted: **admired-warthog-495 only**. No external API call was made.

### Pre-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

No test file was opened or used as an O4 input.

### Pure scratch probe

```text
cd app && npx tsx /tmp/o4-tiebreak-probe.ts
```

Output ended:

```text
threeWay: A 2/0/false, B 1/1/false, C 0/2/false
deadHeat: all 0/0/true
disjoint: both 0/0/true
nullPoints: 0
nullTopFallsToAuto: 2
nullAutoExhausts: 0
PASS: hand ranks A=0/B=1/C=2 agree with 2-1-0 wins; all adversarial assertions passed
```

Scratch file was deleted after execution.

### Integration walkthrough

```text
cd app && npx convex run fantasyIntegrationSim:simulateWeekendLoop '{"salt":"verify","keepData":true}'
```

Key output:

```json
{
  "verdict":"PASS",
  "entered":{"budget":true,"crewCode":"UEF6KJ"},
  "settled":{"budgetTotal":29.789125,"crewRanks":["1","2"],"factoredSlots":4},
  "kept":{"gameweekId":"th7a7wck813xmz92ashgdrty618bn0yf"}
}
```

Ready-made probe, run verbatim from `kept.stateProbe`, returned:

```json
{
  "table": {
    "rows": [
      {"cumulativePoints":17.776,"rank":1,"tied":false},
      {"cumulativePoints":17.3455,"rank":2,"tied":false}
    ],
    "tieBreaksApplied":true
  }
}
```

Ranks and flags are consistent with the unequal totals. This live scenario does not exercise O4-F1's all-null cluster.

### Independent before-counts

Corrected direct DEV inspection (an initial jq predicate was malformed and discarded, then rerun) found for the kept GW:

```text
gameweeks 1; fixtures 1; players 8; raw score rows 10; player-score rows 16;
squads 3; crowd pairs 140; crowd ratings 8; rater stats 5;
court claims 1; draft rooms 1
```

The state probe independently showed two crew-table members and `tieBreaksApplied:true`.

### Purge

```text
LOOP PURGE 1: { "deleted": 273, "deletedUsers": 40 }
LOOP PURGE 2: { "deleted": 0, "deletedUsers": 0 }

SYNTH PURGE 1: {
  "fixtureScoringRows":1,"fixtures":1,"gameweekScoringRows":1,
  "gameweeks":1,"players":8,"rawRows":10,"scoreRows":16
}
SYNTH PURGE 2: all corresponding numeric fields 0
```

Post-purge state probe failed with the expected `WALKTHROUGH FAILED: gameweek missing.` Direct inspection found zero matching gameweeks, fixtures, raw rows, score rows, squads, crowd pairs/ratings/rater stats, court claims, and draft rooms. Before → after all independently listed counts went to **0**; users **40→0**. Both second purges were zero.

### Post-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

## Findings

### O4-F1 — MEDIUM — All-null equal-rank cluster is marked `tied:false`

**Evidence:** `crewTableFor` assigns shared rank based on equal `cumulativePoints`, then unconditionally initializes every row with `tied=false` (`app/convex/fantasyScores.ts:1997-2008`). Its tied-cluster loop immediately skips any cluster whose first `cumulativePoints` is null (`:2064-2070`). Consequently the pure ladder never gets a chance to return `stillTied:true`.

**Exact trigger:** create/read a crew table with at least two active members whose completed weekends contain no scored slot, so each row's `cumulativePoints` is null. Both receive the same rank but both payload rows say `tied:false`.

**Spec disagreement:** DRAFT_ROOM_SPEC v1.3.1 says null data invents no fact and an exhausted ladder remains a displayed tie. The implementation has no fact separating these members yet explicitly tells the display they are not tied.

**Blast radius:** pre-scoring crew tables and any crew whose compared members have no scored weekends mislabel shared no-data ranks as non-ties. Numeric equal-point clusters still use the correct pure ladder; the live unequal-total scenario is unaffected.

## Scope disclosures and limits

- No test file or test directory was read, grepped, or used. The mandatory `npm run check` executed the suite and printed the expected synthetic-error stack naming `app/src/test/errorMonitoringContract.test.tsx`; that file was not opened.
- Read the full explicitly named DRAFT_ROOM_SPEC and pure tie-break library.
- Read only `getCrewTable`/`crewTableFor` and directly adjacent type/comment context in `app/convex/fantasyScores.ts`, as authorized.
- `app/convex/fantasyIntegrationSim.ts` was run but not read.
- Created `/tmp/o4-tiebreak-probe.ts` solely as the brief-required scratch input, executed it, and deleted it. It imported only the named pure library.
- No repository file outside O4's named inputs was directly opened or grepped. Direct DEV table commands inspected synthetic rows only. No PROD command or external API was used.
