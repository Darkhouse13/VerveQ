# FW-LAUNCH blind verification — O3 reclamation court — 2026-08-01

## VERDICT: PASS WITH NOTES

The hard score/history binding invariants, both finality boundaries, held/retry/expiry behavior, current-verdict crowd regrouping, and live three-gameweek walkthrough all conformed. One code→spec note remains: a new filing automatically counts the filer as the first endorsement, a threshold behavior the spec does not state.

## Conformance

| Spec rule | Implementation evidence | Result |
|---|---|---|
| Position verdicts only | Filing accepts only `claimedPosition` using the slot validator and rejects the currently recorded position (`app/convex/fantasyCourt.ts:148-188`); no stat-dispute field/path exists. Schema claim key is player + fixture + claimed position (`app/convex/schema.ts:2140-2192`). | ✓ |
| Filing/endorsement close finality−24h; voting closes finality−2h59m; verdict window `[close,finality)` | Offsets are exact constants and helpers (`app/convex/lib/fantasyCourtRules.ts:27-53`); `inVerdictWindow` uses `now >= close && now < finality` (`fantasyCourtRules.ts:66-68`). Every operation uses the corresponding boundary (`fantasyCourt.ts:151,259,312,344,603`). | ✓ |
| Open claims expire at/after finality; held tally preserved, ordinary expiry null | Resolver expiry branch patches only status/resolvedAt and never judges or re-scores (`fantasyCourt.ts:549-572`), thereby preserving a pre-existing held tally and leaving an untouched claim without one. Live lag claim was expired/null; held-never-scored claim expired with 31-voter tally. | ✓ |
| Resolver cadence covers window | Cadence `[7,22,37,52]`, max-gap and coverage functions are at `fantasyCourtRules.ts:41,71-105`; named tests exhaustively establish every minute-aligned finality has a tick. | ✓ |
| Active users = distinct squad holders, any context | `activeUsersOf` scans all GW squads and counts distinct `userId`, with no context filter (`fantasyCourt.ts:91-102`). This exactly matches both spec v1.2.0 and OWNER DECISION 1 in the explicitly named decisions file. | ✓ |
| Two filings/GW, no stake, 280 characters | Constants/argument validator at `fantasyCourtRules.ts:21-24,142-145`; filing count gate at `fantasyCourt.ts:196-203`; no currency/stake read or write exists. | ✓ |
| Duplicate claims merge with pooled endorsements | Existing filing/trial claim is found by canonical claim key and delegated to endorsement rather than inserted (`fantasyCourt.ts:177-195`); endorsement rows are unique by claim/user (`schema.ts:2194-2201`). | ✓ |
| Threshold max(15, 0.5% actives), opens immediately | Formula at `fantasyCourtRules.ts:108-110`; promotion occurs immediately after the increment reaches threshold (`fantasyCourt.ts:127-138,273-277`). Filer-as-first behavior is Finding O3-F1. | ✓* |
| One first-come 280-char rebuttal, trial-only; filing refusal preserves slot | `rebutClaimFor` requires trial before checking/writing the slot, then rejects existing rebuttal and invalid text (`fantasyCourt.ts:291-319`). Live filing attempt was refused, followed by a successful trial rebuttal and second-refusal. | ✓ |
| Exclude filer and holders in any GW squad | Filer check and all-context holdings scan precede vote insertion (`fantasyCourt.ts:104-123,346-365`). | ✓ |
| Vote weight 0.5 + rolling accuracy | Accuracy is read and passed to `raterWeightOf`, then snapshotted on vote (`fantasyCourt.ts:374-377`). | ✓ |
| Quorum max(30,1%) and weighted yes ≥60%; no appeals | Formula and pass predicate at `fantasyCourtRules.ts:112-132`; resolver computes raw/weighted tallies and uses only that predicate (`fantasyCourt.ts:598-635`). Terminal failed/passed statuses have no appeal path. | ✓ |
| Passing unlandable score is held; retry; passed stamp binds to same-pass `written:true` | Resolver calls re-score first and stamps passed only inside `if (rescore.written)`; otherwise only tallies are patched and status remains trial (`fantasyCourt.ts:636-665`). Live passes showed held 2 → one passed/rescored + one held → one expired. | ✓ |
| Passed verdict changes score everywhere via one N+1 row | `rescoreForVerdict` inserts a new universal player-score version from current stats and claimed verdict, then adds only a supersession pointer to old row (`fantasyCourt.ts:443-522`). Squad totals derive from this shared player row. | ✓ |
| No settled court write; no mutation of score values; no unbound outcome | Public write cores call `assertNotSettled` (`fantasyCourt.ts:78-86,150,254,290,339`); resolver skips settled GWs (`:540-546`); re-score refuses past finality, settlement stamp, missing/current-final rows (`:459-475`). Score values are insert-only; old row receives only `supersededByVersion` (`:501-520`). Passed stamp is conditioned on `written:true` (`:646-655`). | ✓ |
| Feed revision after ruling retains ruled verdict | `applyFixtureStats` loads passed claims and chooses court position over feed position (`app/convex/fantasyScores.ts:502-550`), then inserts that verdict (`:687-707`). Live `revisionKeepsRuling:true`; direct rows retained DEF through later versions. | ✓ |
| Public tallies log | Public docket returns tallies for every claim (`fantasyCourt.ts:394-458`); CourtScreen renders claim/outcome and passed/failed weighted/raw tallies (`app/src/pages/shell/weekend/CourtScreen.tsx:66-150`). Expired held tally remains in the public payload even though expired card text emphasizes no ruling. | ✓ |
| Crowd freeze groups by current ruled position | Freeze reads `row.verdictPosition` into entries (`app/convex/fantasyCrowdVoting.ts:459-476`); derivation groups directly by each entry's verdict (`app/convex/lib/fantasyCrowd.ts:102-115`). Thus both the joined and vacated groups are rebuilt from current rows. | ✓ |

### Code → spec check

One rule-shaped behavior lacked an authorizing sentence: automatic first endorsement by the filer (O3-F1). No other unbacked court behavior was found.

## Adversarial results

1. **Settlement-lag boundary:** structurally prevented by the resolver's `now >= finalityAt` expiry branch before verdict logic (`fantasyCourt.ts:549-573`) and re-score's independent `isAfterFinality` refusal (`:459-466`). Live 31-juror passing lag claim became `expired`, tallies null, and had no court-generated score version.
2. **Stamp-binding / unscored fixture:** structurally held because `passed` patch is reachable only when `rescore.written` is true (`fantasyCourt.ts:636-665`). Live first in-window pass held both claims; after one fixture scored, retry passed/rescored that claim and held the other; finality expired the never-scored claim with its 31-juror tally intact.
3. **Final score rows:** re-score checks `current.state === "final"` and refuses (`fantasyCourt.ts:468-471`); old versions are never numerically patched (`:501-520`).
4. **Feed revision reset attempt:** structurally prevented by passed-claim override in ingest (`fantasyScores.ts:502-550`). Direct live rows showed ruled player p4: v1 MID → v2 DEF court → later v3/v4 still DEF.
5. **Filer vote:** live refusal `The filer does not vote on their own claim.` Gate at `fantasyCourt.ts:347`.
6. **Holder vote:** live refusal `You hold this player in a squad this gameweek…`; all-context scan at `fantasyCourt.ts:104-123,348-352`.
7. **Second court vote:** live refusal `You have already voted on this claim.` Unique read/check at `fantasyCourt.ts:355-365`.
8. **Rebuttal while filing / second rebuttal:** live refusals `That claim is not on trial.` and `The counter-argument slot is already taken.`; checks occur before patch (`fantasyCourt.ts:291-309`).
9. **Hand verdict recomputation:** `trialPasses({31,28,3,30})` returned true: quorum met and 28/31 = 90.32% ≥60%. Both stamp claims with `{31,31,0,30}` also returned true. The library agreed with all reported outcomes.
10. **Crowd regrouping:** statically, freeze takes current verdict; live report independently exercised ruled DEF at −15% (versus +15% if left MID), receiving group re-percentile, and vacated MID median.

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
cd app && npx convex run fantasyCourtSim:simulateCourtWalkthrough '{"salt":"verify","keepData":true}'
```

Key output:

```text
verdictLine: PASS
main tallies: 31 raw, 28 yes / 3 no, weighted 28 / 3, quorum 30
lagResolverCounts: expired 1, passed 0, rescored 0
stampHeldPass: held 2, passed 0, rescored 0
stampRetryPass: held 1, passed 1, rescored 1
stampExpiryPass: expired 1
```

Kept IDs:

```text
main  th7ardbh94rp7t280p6xzqcgcs8bnktk
lag   th7cfc8wanjn546sjjefrrmbe58bnfyg
stamp th7aarcx9502pzwzsyvwde7h0s8bn75b
```

### Independent before inspection

Required claim queries returned:

- Main: one `died` claim (null tally), one `passed` claim (31, 28–3).
- Lag: one `expired` claim with null tallies.
- Stamp: one `passed` 31–0 claim and one `expired` 31–0 claim with tally preserved.

Required scoring status returned:

- GW903: final, one scored fixture, 9 raw rows; ruled player's raw revision reached 2.
- GW904: final, one scored fixture, 2 raw rows.
- GW905: final; `late` fixture scored; `never` fixture was `awaiting_data` with `FT-class but structurally unscoreable: no events in the feed`; 4 raw rows.

Direct before-counts: **5 claims, 61 endorsements, 124 votes**. Synthetic counts: **3 gameweeks, 4 fixtures, 14 players, 15 raw rows, 21 score rows, 4 fixture-scoring rows, 3 gameweek-scoring rows**. Direct score inspection confirmed stamp p0 had v1 DEF superseded by v2 final MID, while never-scored p2 had zero score rows.

### Purge

```text
LAG PURGE 1:   { "deleted": 47, "deletedUsers": 0 }
LAG PURGE 2:   { "deleted": 0,  "deletedUsers": 0 }
STAMP PURGE 1: { "deleted": 94, "deletedUsers": 0 }
STAMP PURGE 2: { "deleted": 0,  "deletedUsers": 0 }
MAIN PURGE 1:  { "deleted": 59, "deletedUsers": 40 }
MAIN PURGE 2:  { "deleted": 0,  "deletedUsers": 0 }

SYNTH PURGE 1: {
  "fixtureScoringRows":4,"fixtures":4,"gameweekScoringRows":3,
  "gameweeks":3,"players":14,"rawRows":15,"scoreRows":21
}
SYNTH PURGE 2: all corresponding numeric fields 0
```

All three post-purge claim queries returned `[]`; all three synthetic-status queries returned empty output. Direct court table inspection reported no documents. Before → after: claims **5→0**, endorsements **61→0**, votes **124→0**, sim users **40→0**, and all listed synthetic counts → **0**.

### Post-check

```text
cd app && npm run check
132 test files passed; 1356 tests passed; TypeScript/lint/build completed.
Lint: 0 errors, 2 warnings. Build completed.
```

## Findings

### O3-F1 — LOW — The filer is automatically counted as endorsement #1 without spec authority

**Evidence:** a new claim is inserted with `endorsements: 1`, followed by a `fantasyCourtEndorsements` row for the filer (`app/convex/fantasyCourt.ts:204-219`). The spec separately defines filing and endorsing, states a threshold in endorsements, and explicitly says duplicate filings merge as endorsements, but never says the original filing is itself an endorsement.

**Trigger:** file a novel claim. It immediately reports one endorsement without the filer invoking `endorseClaim`; 14 additional distinct endorsements reach the floor of 15 and open trial.

**Blast radius:** every claim reaches trial with one fewer post-filing endorsement than the literal threshold requires. At larger active populations, the same one-vote offset remains. The live walkthrough's `trialOpened:15` used this implementation count.

## Scope disclosures and limits

- Read the explicitly named `app/src/test/fantasyCourtRules.test.ts` despite the general test-file prohibition.
- Read `research/fantasy/DECISIONS_NEEDED.md` despite the general decisions-file prohibition because O3 explicitly named it. It contained only OWNER DECISION 1; its definition agrees with spec and code.
- Read only court-table context in `app/convex/schema.ts`.
- Read `app/convex/fantasyScores.ts` only through searches/context for the named court override and finality/insert gates. Broad context output displayed adjacent scoring/finality sections; only named O3 responsibilities were used.
- Re-read only the grouping/freeze regions of `fantasyCrowd.ts` and `fantasyCrowdVoting.ts` to independently establish O3's interaction.
- `app/convex/fantasyCourtSim.ts` was run but not read.
- No repository file outside O3's named inputs was directly opened or grepped. `npm run check` printed the expected synthetic-error stack naming `app/src/test/errorMonitoringContract.test.tsx`; that file was not opened.
- Direct DEV table inspection supplemented the required state queries. No PROD command or external API was used.
