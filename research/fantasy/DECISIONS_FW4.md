# TICKET FW-4 — decision ledger (scoring execution pipeline)

Append-only, same contract as `DECISIONS_FW2RUN.md`: every deviation from the
ticket's plan, every judgment call the rulings are silent on, and every gate
number lands here, so a dead session's successor can resume from this file alone.

Format per entry: **what** / **why** / **reversal path**.

**No STOP-AND-REPORT condition fired.** SCORING_SPEC.md is untouched and remains
**v0.5.1, LOCKED**. No FW-1/FW-2/FW-3 table or field was modified; one additive
optional field was written (E4 below) under the ticket's explicit authorization,
and one existing field is now WRITTEN for the first time by settlement (E5).

---

## E1 — Session start: what was actually on disk

| Ticket said | Reality |
| --- | --- |
| `research/fantasy/scoring/scoring.ts` is the engine to move | Confirmed, plus `types.ts` and `events.ts` beside it |
| FW-2 client + budget ledger to pull through | The client exists (`fantasyApiFootball.ts`); there is **no persistent budget ledger** — FW-2 deliberately dropped the research ledger ("a stateless action could not maintain [it] anyway") and tracks the provider's own `x-ratelimit-requests-remaining` per client instance |
| Feed shapes | Re-verified on disk before writing the parser: `passes.accuracy = "22"` against `passes.total = 26` on probe fixture 1208061 — a COUNT shipped as a string, matching the FW-2/FS-1 measurement. **No contradiction, so no STOP.** Note the asymmetry: the SEASON-AGGREGATE endpoint `pricing/proxy.ts` reads ships the same field as a PERCENTAGE. The pipeline only ever reads the per-fixture endpoint. |

**The season has not started.** The bootstrapped 2026-2027 season opens
**2026-08-15**; today is 2026-07-29. Every fixture on DEV is `NS`, so a live pull
is not merely unnecessary but impossible: `scoreDueFixtures --dryRun` prints a
0-fixture, 0-request plan. All live verification is therefore synthetic (E7), and
**0 provider requests were spent by this ticket**.

---

## E2 — R1: the engine move took `events.ts` and the normaliser with it

**What:** `scoring/scoring.ts` → `app/convex/lib/fantasyScoring.ts`, with
`types.ts` folded in; `scoring/events.ts` **and the normalisation half of
`sim/dataset.ts`** → `app/convex/lib/fantasyFeedStats.ts`. Pointer note at
`research/fantasy/scoring/MOVED.md`.

**Why more than the ruling names:** R1 says one engine, "do not fork, copy, or
re-implement". The engine cannot be scored without turning a feed payload into a
`PlayerMatchStats`, and that translation carries every measured trap in the feed
(accurate-pass count-as-string; `penalty.commited`'s spelling; a `subst` event
naming the incoming player in `assist`, not `player`; null meaning "did not
record this"). Re-implementing it in the Convex ingest would have been a second
normaliser — and the regression gate would then be comparing two translations as
much as one engine, which is exactly the thing R1 exists to prevent.

**One structural edit, no number changed:** `applyCrowdFactor` extracted from
`scorePlayer`'s crowd block and exported, because R5 stores base and factor
separately and derives the total on read — the mirroring rule for a negative base
must have exactly one definition. `scorePlayer` calls it too. `CROWD_FACTOR_LIMIT`
is exported for the pipeline to enforce; the engine still applies whatever factor
it is handed (R5).

**R1 GATE — PASS.** `npx tsx sim/run.ts --n 2000 --seed 20260729` reproduces
`reports/fs1-phase4b-v050-2026-07-29.json` byte for byte apart from
`meta.generatedAt`: md5 `e18b5995f73e4a48eabdaed8091781e2` on both sides with that
line stripped. Research suite 33/33, `tsc --noEmit` clean.

**Reversal path:** `git revert 0e016e5` restores the files to `research/scoring/`
(git recorded the move as a rename), then revert the import lines in `sim/`,
`tests/` and `pricing/proxy.ts`.

---

## E3 — A score row carries the 4×2 grid, not one number

**What:** the ticket lists a score row's fields as "(baseScore, crowdFactor,
verdictPosition, version, state, revisedFrom)". `fantasyPlayerScores.baseScores`
is instead an object of eight numbers: four fielded positions × starter/finisher.

**Why:** SCORING_SPEC §Position templates scores "the slot position the user
FIELDED", and §Finishers changes both the event basis and the ×1.25 multiplier by
role. One stat line therefore has eight legitimate scores, and a single
`baseScore` would have to pick one — silently making every user's total wrong
whenever they field a player out of position, which is a mechanic the spec
deliberately prices rather than an edge case.

Eight numbers on ONE row rather than eight rows because a feed revision revises a
player's LINE, all eight cells at once: one row per (player, fixture) is one
version per thing that actually changes. It also keeps the table a pure function
of the fixture's stats — the alternative (score only the contexts some squad
fielded) would have to fan out from a fixture to every squad slot holding one of
its players, which is unbounded in ownership.

**Consequence, and it is a feature:** absence is meaningful. A row exists for
every player of a scored fixture, so "no row" means awaiting data (R7) and a
stored 0 means an honest zero. The two cannot render alike because one is the
absence of a row.

**Reversal path:** none needed; a caller that wants one number asks
`totalFor(grid, slot, role, crowdFactor)`.

---

## E4 — `fantasySquads.finalScore`: the one additive field, and why

**What:** an additive optional object on FW-1's `fantasySquads`, stamped once per
squad at the finality cut by `fantasyScores.stampSquadFinalTotals`.

**Why the rulings require it:** P6's crew table is cumulative points over every
weekend a crew has played. Derived live, one crew page costs
members × weekends × 13 slot lookups — around 7,500 indexed reads by April, on a
16,384-read query budget. Stamped, it is O(members).

**Why it cannot drift:** it materialises data that is IMMUTABLE by the time it is
written. Past the cut nothing writes a score (R4), and the stamp only runs when
`now >= gameweek.finalityAt`. It is a record of a settled number, not a cache of a
moving one.

**Flagged for the reclamation-court ticket:** a court re-score is the one thing
that invalidates this field. That ticket must clear `finalScore` for every
gameweek it touches.

**Reversal path:** drop the field and have `getCrewTable` call `squadScore` for
every weekend; correctness is identical, cost is not.

---

## E5 — Settlement writes `fantasyGameweeks.status = "final"`

**What:** finalization patches FW-1/FW-2's lifecycle field. This is a WRITE to an
existing field, not a schema change.

**Why it is authorized:** the schema comment on that field reserves this exact
write — "`status` is deliberately NOT written here. It is a lifecycle field driven
by the passage of time and (later) by settlement". Settlement is this pass.

**Why it is necessary rather than tidy:** `fantasyDraftRooms.targetGameweek`
picks the earliest-finality gameweek whose status is `upcoming|live`. With nothing
ever moving the field, every crew room opened after the first weekend would target
that dead first weekend, forever. It also correctly closes squad editing, which
`fantasySquads.gameweekAcceptsEdits` gates on the same field.

**Not written:** `"live"` and `"settling"`. Promoting a gameweek to `live` needs
its own rule (window opened) and is nobody's ruling here.

**Reversal path:** delete the three-line patch in `finalizeGameweekChunk`; nothing
else in FW-4 reads the field.

---

## E6 — Three judgment calls the rulings are silent on

**E6a — Post-finality, a NEVER-scored fixture stays unscored.** R4 covers
revisions after finality (recorded as raw, scores unchanged). It does not say what
happens to a fixture whose feed arrives for the first time after the cut. The
pipeline refuses to score it: finality is the instant totals stop moving, and a
first-time score would move a squad total after a user saw it settle. Those
players read "awaiting data" for that weekend permanently, which is an honest hole,
and the 6h alert exists precisely so an operator can act BEFORE the cut.

Found while verifying this on DEV: the fixture was being labelled `scored` while
holding no score rows, which would have told every read surface its players had
totals. `state` now means "this fixture has score rows" and nothing else, and
`notScoredReason` says which of the two reasons applies.

**E6b — Revision detection is bounded at 2 re-reads, 6h apart.** R4 requires a
changed hash to be noticed before finality, which is only possible by re-reading a
fixture that already scored; the ruling does not bound it. Unbounded, that is a
poll on every cron tick all weekend. Bounded at 2, a gameweek's LIFETIME spend is
fixtures × 3 × 2 requests = **288** for the biggest gameweek in the bootstrapped
season, against the ticket's 500 ceiling. A changed hash resets the budget, so a
correction earns a fresh look for the correction after it.

**E6c — R2's "no-op" moves one field.** An unchanged fixture writes no raw row,
no score row and no state change — but it does patch `lastAttemptAt` and the
revision-check counter. That is bookkeeping about this pipeline's POLLING, not
about the fixture's data, and it is what makes E6b terminate. Asserted in the
suite by comparing raw and score rows by hash before and after.

---

## E7 — REGRESSION GATE: PASS (harness vs live, 934 comparisons)

`npx tsx scripts/fantasyScoringRegression.ts --execute`, on DEV
`admired-warthog-495` (prod `different-lynx-153` was never contacted;
`npx convex deploy` was never run).

It replays a REAL round out of the FS-1 sample through the shipped
`fantasyScores.applyFixtureStats` and compares every stored score against
`scorePlayer` called the way `sim/run.ts` calls it.

| | |
| --- | --- |
| Sample | league 135 (Serie A), Regular Season 15, season 2024 |
| Fixtures | 10 |
| Player rows | 467 |
| Score rows written | 467 (all version 1, provisional, crowd factor 0) |
| Comparisons | **934** — 467 starter-in-nominal-position + 467 finisher-in-nominal-position |
| Substitute rows in the finisher set | 94 (the decisive-moment multiplier's only reachable path) |
| Harness Σ starter points | **1235.180000** |
| Live Σ starter points | **1235.180000** |
| **Mismatches** | **0** (exact equality, not a tolerance) |
| Provider requests | **0** — the sample is on disk |

Both compared contexts are the ones the harness itself exercises: `baseScoreOf`
(starter, nominal position, crowd 0) and `scorePick` for a finisher (entry-filtered
events + entry minute), which is the only route that reaches the post-75'
multiplier. The synthetic season was purged afterwards; row counts of the purge are
printed by the script.

---

## E8 — Hand-verified numbers (DEV, and in the suites)

Every one of these was computed from SCORING_SPEC v0.5.1 on paper first.

| Line | Fielded slot | Expected | Result |
| --- | --- | --- | --- |
| GK, 90', 3 saves, clean sheet in a 2-0 win | GK (verdict GK) | 1 + 1 + 1.5 + 5 = **8.5** | ✓ |
| same line | DEF | (1 + 1 + 4) × 0.75 = **4.5** | ✓ |
| same line | MID | (1 + 1 + 1) × 0.75 = **2.25** | ✓ |
| same line | ATT | (1 + 1) × 0.75 = **1.5** | ✓ |
| same line | any finisher slot | unused finisher = **0** | ✓ |
| MID, 90', 5 tackles + 2 int, 3 key passes, 46/50 passes, 0-2 loss | MID (verdict MID) | 1 + 4 (cap) + 2.4 + 2 = **9.4** | ✓ |
| same line | DEF | (1 + 2 + 1.2 − 1) × 0.75 = **2.4** | ✓ |
| corrected to 4 key passes | MID | 1 + 4 + 3.2 + 2 = **10.2** as version 2, version 1 still readable at 9.4 | ✓ |
| sub on at 70', goal at 80', 1 shot on | ATT finisher | 1 + 5 + 0.5 + 1.25 = **7.75** | ✓ |
| sent-off DEF, 0-3 loss | DEF (verdict DEF) | 1 − 1 − 4 − 1 = **−5** | ✓ |
| same line | MID (mismatch) | 1 − 1 − 4 = **−4**, undamped (G5) | ✓ |
| 13-slot squad, 4 slots scored | — | 8.5 + 7.6 + 0 + 0.75 = **16.85**, 9 slots awaiting | ✓ |
| crowd 0.15 on the 8.5 base | GK | derived 8.5 × 1.15 = **9.775**; base stored as 8.5 | ✓ |
| crowd 0.20 | — | **rejected**, transaction rolled back, nothing written | ✓ |

---

## E9 — DRAFT_ROOM_SPEC v1.2.0 is now partly stale. NOT amended.

Its §Explicitly deferred says the crew table and standings are "**Blocked on the
scoring execution pipeline**". They are no longer blocked — this ticket built the
table, ordered by cumulative points, with ties displayed as tied.

The **tie-break ladders themselves remain deferred and unimplemented**, exactly as
this ticket instructs, and `getCrewTable` returns `tieBreaksApplied: false` so no
client can mistake the ordering for a settled ladder.

I did not edit the spec: the ticket forbids implementing the ladders and says
nothing about amending the document, and a spec edit that records "half of this
deferral is discharged" is an owner's sentence to write, not mine. **Flagged for
the owner** as the one paragraph in DRAFT_ROOM_SPEC that no longer describes
reality.

---

## E10 — Cron registrations

```
fantasy-score-fixtures    10,25,40,55 * * * *   internal.fantasyScores.scoreDueFixtures
fantasy-settle-gameweeks   2,17,32,47 * * * *   internal.fantasyScores.settleGameweeks
```

Scoring runs at :10, i.e. AFTER FW-2's :00/:15/:30/:45 fixture sync, because what
is scoreable is decided from the rows that sync writes rather than by asking the
feed for a status a second time. Settlement is quarter-hourly so a total is
labelled final within fifteen minutes of the cut and the 6h alert lands inside its
window; it makes no network request at all. Both were exercised on DEV: the scoring
action prints its call plan and returns a 0-fixture plan today; settlement fired
the alert at 3.0h out, finalized a synthetic gameweek, and was a no-op on re-run.
