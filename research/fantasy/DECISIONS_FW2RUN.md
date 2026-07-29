# TICKET FW-2-RUN — decision ledger

Append-only. Every deviation from a prior plan, every judgment call the specs are
silent on, and every progress checkpoint lands here, so a dead session's
successor can resume from this file alone.

Format per entry: **what** / **why** / **reversal path**.

---

## 2026-07-29 — session start: inherited state survey

Before doing anything, what was actually on disk (the ticket's description of it
was accurate in some places and not others — recording both):

| Ticket said | Reality |
| --- | --- |
| FW-2's offline-built ingestion code (`fantasyIngest`, `fantasyGameweekWindows`, `fantasyApiFootball`) exists per Phase 0 approval | **Does not exist.** `find` over the whole repo (excluding `node_modules`) returns nothing for any of the three names. `app/convex/` carries only FW-1's landed files: `fantasyLocks.ts`, `fantasySquads.ts`, `lib/fantasyConstants.ts`, `lib/fantasyFavoriteClub.ts`, `lib/fantasySquadRules.ts`. |
| autopull runner may have a live PID | No process. `ps` shows nothing; the runner last logged at 2026-07-28T23:50:01Z and went to sleep for 23h59m. |
| 215 requests remaining on the sample | Confirmed: 169/192 fixture files on disk, 0/192 event files. |

`app/convex/crons.ts` is dirty in the working tree with a **pure line-ending
diff** (CRLF→LF, every line rewritten, content identical). This is the CRLF churn
the ticket warned about. Handled in the FW-2 commit — see that entry.

---

## D1 — Objective 1: SEASON GATE — **OPEN**

**What:** `season=2026` on league 39 is served by the key in
`research/fantasy/.env`. The gate is open; the ticket proceeds.

**Evidence** (`fetch/seasonGate.ts`, run 2026-07-29T09:48:22Z):

`/status` (unmetered):

```json
"subscription": { "plan": "Pro", "end": "2026-08-29T09:39:56+00:00", "active": true },
"requests": { "current": 0, "limit_day": 7500 }
```

`/fixtures?league=39&season=2026` → HTTP 200, `errors: []`, `results: 380`,
`paging: {current:1,total:1}`, 38 distinct rounds, status histogram
`{"NS":380}`, date range `2026-08-21T19:00:00+00:00 .. 2027-05-30T15:00:00+00:00`.
First row: fixture 1557367, Arsenal (42) v Coventry (1346), round
"Regular Season - 1".

**Measured, and superseding the free-tier numbers in `data/.fetch-state.json`:**

| Quantity | Free-tier measurement (2026-07-27) | Pro measurement (2026-07-29) |
| --- | --- | --- |
| `x-ratelimit-requests-limit` (daily) | 100 | **7500** |
| `x-ratelimit-limit` (per-minute) | 10 | **300** |
| Season window served | 2022–2024 | 2026 confirmed served (see D2 for the full sweep) |

**Note on the same key:** the key fingerprint is unchanged (32 chars, ending
...7bf9) — the account was upgraded in place rather than re-keyed. No key
rotation was performed or needed (hard boundary respected).

**Note on the 23:45 UTC window boundary:** it is *not* re-confirmable from this
run and is now believed to be free-tier-specific. The provider reported
`requests.current: 0` at 09:48 UTC while our local ledger recorded 100 spent for
the same window — because the subscription itself began at 09:39:56 UTC today,
which reset the counter. The Pro window most likely rolls at the subscription
minute (~09:40 UTC). This is **inferred, not measured**, and deliberately not
acted on: at 7500/day against a workload of ~600 requests the boundary has no
operational consequence. See D3 for how the pacing was set instead.

---

## D2 — `fetch/autopull.sh` retired (deviation from the FS-1 plan)

**What:** deleted `research/fantasy/fetch/autopull.sh`.

**Why:** its entire reason for existing was pacing 215 remaining requests across
multiple 100/day quota windows — a loop that ran one `run.ts --live --resume`
per window and slept ~24h between them. On Pro (7,500/day) the whole remaining
sample fits in a single run, which is exactly what happened: 215 requests, one
invocation, under four minutes. Keeping a sleep-until-23:50-UTC scheduler around
would be keeping a workaround for a constraint that no longer exists, and its
23:45 boundary assumption is now known to be free-tier-specific (see D1).

**Reversal path:** it was a 79-line bash wrapper around
`npx tsx fetch/run.ts --live --resume`, with a `complete()` guard reading
`fetchedFixtures`/`fetchedEvents` lengths out of `data/.fetch-state.json`, an
8-window backstop, and a sleep to the next 23:50 UTC boundary. Reconstructible in
minutes if a future tier ever needs multi-window pacing. A verbatim copy was
taken before deletion and lives in this session's scratchpad
(`autopull.sh.retired`); it is *not* in the repo, so treat the description above
as the durable record.

---

## D3 — Pro pacing set to 250ms, not 200ms

**What:** `fetch/config.ts` `PRO_TIER_RATE_LIMIT_MS` 200 → 250, and the comment
above it corrected.

**Why:** the constant's comment claimed "Pro allows 450/minute". Measured on the
live Pro key, `x-ratelimit-limit` is **300/minute**. 200ms is exactly 300/minute
— i.e. sitting precisely on the limit, where ordinary clock jitter earns a 429.
250ms is 240/minute, a 20% cushion, and costs nothing: the whole remaining
sample was ~215 requests either way.

**Reversal path:** one-line constant change, no behaviour depends on the value
beyond spacing.

---

## D4 — Objective 3: FS-1 SAMPLE COMPLETE

**What:** the sample is finished and verified. One `run.ts --live --resume`
invocation on Pro closed it out.

**Counts:** 192/192 `fixtures/players` files, 192/192 `fixtures/events` files,
215 requests spent (7,319 left on the key at completion). No STOP conditions
fired. Nothing was estimated or backfilled.

**Integrity** — full output in `reports/fs1-sample-integrity-2026-07-29.md`,
produced by the new `sim/integrity.ts`. The figures that matter:

| Measure | Value |
| --- | --- |
| Fixtures enumerated / player files / event files | 192 / 192 / 192 |
| Player-fixture rows loaded | 8,110 |
| Fixture statuses | 192× `FT` (no PST/CANC/ABD in the sample) |
| Events | 3,209 across 192 fixtures |
| Required event fields present | 6/6 at 100.0% |
| **Stat line vs fixture score** | **192/192 agree (100.0%)** |
| **Events feed vs fixture score** | **192/192 agree (100.0%)** |
| subst events carrying an incoming player id | 1,734/1,734 (100.0%) |
| Rows with a nominal position | 8,110/8,110 (100.0%) |

The two goal reconciliations are the load-bearing ones, and both are exact. In
particular the events/score agreement settles a question the VAR rows raised: 26
`Var | Goal cancelled` events exist in the sample, and since event goals still
reconcile to the score in every fixture, **cancelled goals are already excluded
from the `Goal` rows** rather than needing to be subtracted. Nothing in the
harness has to interpret a VAR row, and `sim/dataset.ts` deliberately ignores
them.

**Two measured feed limits, reported not worked around:**

1. **No "Second Yellow card" detail exists anywhere in the sample** (780 yellow,
   38 red, zero second-yellow). Reds are one undifferentiated category. Harmless
   — SCORING_SPEC v0.4.1 prices both at −4 — but it is now measured rather than
   assumed.
2. **No event detail for a SAVED penalty.** `penalty.saved` is on the stat line
   but carries no clock, so a GK finisher's penalty save cannot be placed after
   the 75th minute. The decisive-moment multiplier therefore cannot reach it.
   Carried into the Phase 4 report as a finding.

**On the low non-null rates** in the REQUIRED_STATS table (e.g. `goals.total`
6.1%): these are not a broken pull. The feed omits a stat for a player who did
not record it — a striker with no tackles has `tackles.total` null, not 0. The
structural question (does the field exist at all) was settled by the probe; that
table measures how often a value is carried. The null→0 conversion is the single
interpretation `sim/dataset.ts` performs, and it rests on the probe's
measurement that null means "did not record this".

**New files:** `sim/dataset.ts` (pure loader/normaliser — the join of the three
feeds), `sim/integrity.ts` (this pass). Both obey the README network rule: they
read `data/` and nothing else.

---

## D5 — FW-2's "already built" code did not exist

**What:** the ticket said FW-2's ingestion code (`fantasyIngest`,
`fantasyGameweekWindows`, `fantasyApiFootball`) existed from an offline Phase 0
and only needed finishing. It did not exist in any form — not in the working
tree, not in a stash, not on any branch. All three were written from scratch in
this session, plus `app/src/test/fantasyGameweekWindows.test.ts` (25 tests).

**Why it matters:** nothing was silently discarded or duplicated. If a Phase 0
artefact turns up later, it should be diffed against `fa9c394` rather than
merged on top of it.

**Reversal path:** `git revert fa9c394`.

---

## D6 — ⚠️ OWNER ACTION NEEDED: the DEV deployment carries schema drift from
## uncommitted experiments

**What happened:** `npx convex dev --once` (DEV only — prod was never touched)
refused to push master's schema three times, because DEV holds documents with
fields and enum values that exist in **no commit on any branch**:

| Table | Drift | Evidence |
| --- | --- | --- |
| `drawDailyBoards` | `sliceCardIds`, `sliceConfigVersion` | 1 row, `dateKey` 2026-07-28 |
| `drawRuns` | `shareSlug` (+ a `by_shareSlug` index) | at least 1 row |
| `funnelEvents` | `type` values `draw_share_view`, `draw_share_convert` | present in the sample |

I searched every local and remote branch: **no branch's `schema.ts` contains any
of these names.** They were written to DEV by code that was never committed.

**What I did:** I did **not** delete or modify any draw data, and I did not
touch THE DRAW's engine. I widened the affected validators **temporarily and
locally**, pushed, ran the bootstrap, then removed the widening before
committing. The commit `fa9c394` contains none of it — verified by
`git diff --cached`, which shows only the fantasy fixture-status change in
`schema.ts`.

**One side effect I could not avoid and must report:** pushing master's schema
**deleted the `drawRuns.by_shareSlug` index** from DEV (Convex prints
`Deleted table indexes: [-] drawRuns.by_shareSlug`). The index is recreated the
moment the code that declares it is pushed again. No data was deleted.

**Consequence for the owner:** *the committed master schema still cannot be
pushed to DEV.* This session's DEV deployment is running the temporarily-widened
schema, so FW-2 is live and the data is bootstrapped — but the next clean
`convex dev` from master will fail on the same three rows. Two ways out, both
the owner's call:

1. **Land the draw share/slice work** (the fields are evidently real, in-flight
   product work), which makes DEV's data legal again; or
2. **Delete the four-or-so orphan rows on DEV**, which are stale and
   regenerable (a daily board is deterministic from its stored `boardSeed`).

I did not pick between them: option 2 destroys another feature's data and option
1 lands code I have no mandate over. Both are outside this ticket's boundary.

---

## D7 — Midweek finality is NEW code; FW-1's `finalityAtOrAfter` is untouched

**What:** added `finalityForWindow` (inside `windowFor`) rather than
generalising FW-1's `finalityAtOrAfter`.

**Why:** `finalityAtOrAfter` answers "the first Tuesday 23:59 Europe/Paris at or
after this instant". For a weekend window that is exactly right, and the new test
suite asserts the two agree across a full season of Friday-to-Monday kickoffs
(208 checks). But a midweek gameweek must settle on **Friday** 23:59, and
`finalityAtOrAfter` would say the following Tuesday. Quietly rewriting a landed
FW-1 function — one with its own tests asserting the Tuesday behaviour — to mean
something broader is how a ticket boundary becomes a regression. So the general
rule is new code and the old function keeps its stated scope.

**Verified live:** GW2 (`midweek:2026-08-18`, fixtures Wed 19 / Thu 20 Aug)
settles **Fri 21 Aug 23:59 Paris**; GW25 (`midweek:2027-01-05`) settles
**Fri 8 Jan 23:59**. GW3 (`weekend:2026-08-21`) settles Tue 25 Aug 23:59.

**Reversal path:** delete `fantasyGameweekWindows.ts`; nothing else depends on it
except `fantasyIngest.ts`.

---

## D8 — `abandoned` added to the fixture status union (deviation)

**What:** the pre-authorised schema change was adding **`cancelled`** to
`fantasyFixtures.status`. I added **`abandoned`** as well.

**Why:** the standing rule is "abandoned/voided kicked-off fixtures: record
status, do not invent scoring semantics". Recording a status requires a value to
record it as, and API-Football distinguishes `CANC` (called off before kickoff)
from `ABD` (started, then stopped). Collapsing ABD into `cancelled` would assert
that a match never happened when it half did — which is precisely the invention
the rule forbids. Neither literal carries any scoring meaning in the schema.

**Also decided, and flagged as weaker:** `AWD` (technical win) and `WO`
(walkover) map to `finished`. Rationale: that is a statement about the fixture's
LIFECYCLE — it is over, a result stands — and carries no claim about player
statistics, which such fixtures largely lack. If the owner prefers these to be
their own status, it is a one-line change in `mapStatus`. **Zero AWD/WO/ABD/CANC
fixtures exist in the bootstrapped season today**, so nothing currently depends
on this choice.

**Reversal path:** remove the literal from `schema.ts` and the `ABD` case from
`mapStatus`; no data currently uses it.

---

## D9 — ⚠️ OWNER DECISION NEEDED: favorite-club cooldown, 28 days vs 4 gameweeks
## — NOT IMPLEMENTED

**The conflict.** The ticket's inherited constitution states the favorite-club
cooldown is **28 calendar days (timestamp, not gameweeks)**. But:

- `DRAFT_ROOM_SPEC.md` v1.0 (**LOCKED**) §Favorite-club exemption + ledger item 7
  states a **4-gameweek** cooldown.
- FW-1 landed it that way: `FAVORITE_CLUB_COOLDOWN_GAMEWEEKS = 4` in
  `lib/fantasyConstants.ts`, resolved in `lib/fantasyFavoriteClub.ts`, with
  passing tests in `fantasySquadRules.test.ts`, and
  `users.favoriteClubEffectiveFrom` typed as a **gwNumber**.

These are not reconcilable by implementation: one counts gameweeks, the other
counts milliseconds, and 4 gameweeks ≠ 28 days whenever a midweek round falls in
between — which, per the constitution I just implemented, is now a routine
occurrence (the bootstrapped season has **13 midweek gameweeks out of 49**).

**What I did: nothing.** The hard boundary says spec-vs-reality conflicts get no
implementation, a ledger entry, and a flag. Changing it would also mean amending
a LOCKED v1.0 spec, changing a landed FW-1 constant, its resolver, its tests, and
the meaning of a stored user field — none of which is FW-2's ingestion scope, and
none of which is pre-authorised.

**Cost of the delay: zero, today.** No user has a favorite club set on DEV and
the cooldown is not on FW-2's path.

**When the owner rules,** the change is contained: `FAVORITE_CLUB_COOLDOWN_*` in
`fantasyConstants.ts`, the comparison in `fantasyFavoriteClub.ts`, the semantic
of `users.favoriteClubEffectiveFrom` (gwNumber → epoch ms, which needs a
migration if any row is set), and DRAFT_ROOM_SPEC's changelog.

---

## D10 — Two engineering deviations forced by Convex platform limits

**D10a — fixture writes are chunked (150/mutation).** The first cut wrote all
1,752 season fixtures in one mutation and was killed: `Function execution timed
out (maximum duration: 1s)`. Split into `applyGameweeks` (one small
transaction, ~49 rows) then `applyFixtureChunk` × 12.

The subtle part, and the reason this is a ledger entry rather than a footnote:
**gameweek ordinals are a property of the season, not of a chunk.** Each chunk
therefore carries a pre-resolved `gwNumber` computed by the action over the full
kickoff set. This also forced a change to `syncFixtures`: it now reads the
**whole season** (still 1 request per league — the date-range form costs exactly
the same) and writes only the ±3/+10-day rolling window. Constituting gameweeks
from a 13-day slice would have renumbered the season's 49 gameweeks as 1, 2, 3
every quarter hour and re-parented every squad in the process.

**D10b — every action carries an explicit return type.** An action that spreads
a same-module `ctx.runMutation` result into its return value forms a type cycle
through `_generated/api`. TypeScript does not error on it — it widens silently,
and the damage surfaced in two files with nothing to do with fantasy
(`opsActiveUsers.ts:141` and `ShellProfileScreen.tsx:382`, both degraded to
`unknown`). Confirmed by bisecting: the HEAD-equivalent tree typechecks clean at
145 modules; adding the three unannotated actions broke it at 148. The
annotations are load-bearing and commented as such.

---

## D11 — Objective 2: FW-2 LIVE. Commit `fa9c394`

**Commit:** `fa9c394d65b278320189d55a87bbb0a42d989ef5` —
*feat(fantasy): Ticket FW-2 — API-Football ingestion, gameweek constitution, cron wiring*.
7 files, +1,608/−1. Nothing outside the fantasy namespace except the crons.ts
lines. No CRLF churn (`crons.ts` was restored to its committed LF form first;
the working tree had converted the whole file to CRLF, which would have shown as
a 19-line rewrite).

**`npm run check`: green — 101 test files, 1,003 tests, exit 0.**

**Bootstrap on DEV (`dev:admired-warthog-495`). Prod (`different-lynx-153`) was
never contacted; `npx convex deploy` was never run.**

`bootstrapSeason` — season label `2026-2027`, API season 2026:

| League | Fixtures |
| --- | --- |
| 39 Premier League | 380 |
| 140 La Liga | 380 |
| 135 Serie A | 380 |
| 61 Ligue 1 | 306 |
| 78 Bundesliga | 306 |
| **Total** | **1,752** |

- **Gameweeks constituted: 49** (36 weekend + 13 midweek), all `upcoming`.
- Fixtures created 1,752, updated 0, unchanged 0, **unmapped statuses 0**.
- Written in 12 chunks. `created === fixturesFetched`, so every fixture
  resolved a gameweek — none were skipped.

`bootstrapPlayers` — **96 clubs exactly** (20+20+20+18+18):

| League | Clubs | Players |
| --- | --- | --- |
| 39 | 20 | 609 |
| 135 | 20 | 629 |
| 140 | 20 | 592 |
| 78 | 18 | 551 |
| 61 | 18 | 515 |
| **Total** | **96** | **2,896** |

- Created 2,895, updated 1 (one player appearing in two squads — a transfer),
  deactivated 0, **skippedNoPosition 0**.
- **Every `price` is `null`**, as BUDGET_MODE open item 1 requires.

**Request cost:** 5 (season) + 101 (players) + 5 (sync test) = 111. The key
reported 7,164 remaining afterwards.

**Cron registration** (`crons.ts`, sync strictly before sweep):

```
fantasy-sync-fixtures   0,15,30,45 * * * *   internal.fantasyIngest.syncFixtures
fantasy-lock-sweep      5,20,35,50 * * * *   internal.fantasyLocks.lockSweep
```

Two cron *schedules* rather than two `crons.interval` calls, because
`crons.interval` gives no ordering guarantee between jobs and a sweep running
against a stale kickoff would stamp `lockedAt` at the wrong instant. This also
closes FW-1's STOP-6, which deferred `lockSweep` scheduling to FW-2.

**Both cron functions exercised live and idempotent:**
`syncFixtures` → fetched 1,752, wrote 0 (correct: the season opens 2026-08-15,
outside today's 2026-07-26→2026-08-08 window), gameweeks created 0 / updated 0.
`lockSweep` → 49 gameweeks scanned, 0 stamped (no squads, no kickoffs passed).

**Constitution verified against live data** with the new `gameweekAudit`
internal query. Counts alone could not prove this — `created === fetched` shows
every fixture found *a* gameweek, not the *right* one — so the audit re-derives
each window and checks containment:

| GW | Window | Fixtures | Out of window | Finality matches | First kickoff | Finality (Paris) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | weekend:2026-08-14 | 6 | 0 | ✓ | Sat 15 Aug 19:30 | Tue 18 Aug 23:59 |
| 2 | **midweek**:2026-08-18 | 2 | 0 | ✓ | Wed 19 Aug 21:00 | **Fri 21 Aug 23:59** |
| 3 | weekend:2026-08-21 | 38 | 0 | ✓ | Fri 21 Aug 20:45 | Tue 25 Aug 23:59 |
| 25 | **midweek**:2027-01-05 | 20 | 0 | ✓ | Wed 6 Jan 18:30 | **Fri 8 Jan 23:59** |
| 48 | weekend:2027-05-21 | 48 | 0 | ✓ | Sat 22 May 15:30 | Tue 25 May 23:59 |
| 49 | weekend:2027-05-28 | 39 | 0 | ✓ | Fri 29 May 21:00 | Tue 1 Jun 23:59 |

GW1 holding only La Liga is correct — Spain opens a week before the others.

---

## D12 — `scoring/scoring.ts` caps made overridable (behaviour-preserving)

**What:** the ten cap constants became a `CapConfig` object with
`DEFAULT_CAPS` = the spec's values, plus `scaledCaps(k)`. `scorePlayer` takes an
optional trailing `caps` argument defaulting to `DEFAULT_CAPS`.

**Why:** TICKET FS-1 asks for a 0.5x/2x cap sensitivity sweep, and the caps were
hardcoded. The alternative — reconstructing capped contributions from the ledger
and propagating deltas back through the mismatch dampener and crowd multiplier —
is arithmetic that could silently drift from the engine it is meant to measure.

**Why it is safe:** called without the argument the engine is bit-identical to
before. **All 33 Phase 2 tests pass unchanged**, which is the assertion that
matters — they are the tests that pin v0.4.1 behaviour.

**Reversal path:** inline `DEFAULT_CAPS`'s values back at their use sites.

---

## D13 — Objective 4: PHASE 3 + PHASE 4 COMPLETE

**Phase 3** — `sim/run.ts`, seeded (`--seed 20260729`), pure, offline, ~40s:

- **120,000 squads** — 3 generators x 2,000 x 20 gameweeks
- 8,110 player-fixture rows scored per configuration
- cap configurations 0.5x / 1x / 2x
- crowd clamps 0 / ±10 / ±15 / ±25%
- unfilled-slot rate **0.000** for all three generators
- raw results: `reports/fs1-phase3-results-2026-07-29.json`

The three generators are `random` (floor, careless slotting — 71.5% mismatched
slots), `form` (realistic; **leave-one-out**, weighted by each player's mean
score in the *other* sampled rounds of his league, so it never sees the gameweek
it is picking for), and `chalk` (hindsight upper band). Squad totals: 30.81 /
51.10 / 111.05.

**Phase 4** — `reports/fs1-phase4-calibration-2026-07-29.md`. Numbers and
PROPOSALS only, no PASS/FAIL verdicts anywhere, no spec edits. SCORING_SPEC
remains v0.4.1, byte-unchanged.

**The four findings that carry the report:**

1. **44.5% of all positive point mass comes from participation (31.7%) and team
   result (12.8%)** — before a player does anything individually
   distinguishable. Goals and assists together are 15.0%. This is the
   measurement the spec's §Known tensions item 3 asked for.
2. **The anti-farming caps effectively never bind** — bind rates 0.3%–1.9%, and
   **doubling every cap changes the mean score by +0.008 points**. Every cap
   sits at or above the 95th percentile of its own term; five of ten sit at or
   above the maximum ever observed. Design principle 4 is currently close to
   inoperative.
3. **Both step-function thresholds sit almost exactly at the median of their
   population** (pay rates 46.1% and 48.0%) — the worst place for a cliff.
   **38% of eligible midfielders are within 3 percentage points** of the pass
   line.
4. **The spec's own candidate fix for MID destroyers would not work.** It
   proposes raising the combined defensive cap; the cap binds on **4 of 178**
   destroyer rows. The binding constraint is the rate, not the cap.

**On the honesty of the proposal figures.** The first draft of the report
asserted three effect sizes by eye. They were then computed properly
(`sim/proposals.ts`, archived at
`reports/fs1-phase4-proposal-effects-2026-07-29.md`) and **three of them were
wrong**: P1's participation share after the change is 21.90% (not ~18.9%), P2's
is 6.85% (not ~6.4%), and P5 closes about one sixth of the destroyer gap, not
"about a third" — because raising the defensive rate lifts creators too. A
fourth, P8, turned out to be **ineffective** (the ATT median does not move at
all) and is recorded in the report as a measured negative result rather than
quietly dropped, so the same idea is not re-proposed later. Every impact figure
in the summary table is now measured.

**One assumption is declared prominently in the report and repeated here:** the
crowd-clamp sweep needs a model of crowd behaviour, because CROWD_VOTING has not
shipped and no vote data exists. The model is percentile signal blended with 40%
noise. Absolute stability numbers move with that noise weight; the relative
comparison between ±10/±15/±25% does not. **This should be re-run against real
votes before the clamp is treated as settled.**

**Report proposals (all owner decisions, none applied):** P1 participation
weight, P2 team result, P3/P3b caps, P4/P4b step functions, P5 MID defensive
rate, P6 finisher multiplier reachability, P7 keep ±15% clamp, P8 recorded as
measured-ineffective.

---

## D14 — FS-1 harness committed separately from FW-2

**What:** `research/fantasy/` was **entirely untracked** at session start — the
FS-1 harness, the specs, and every report existed only in the working tree, with
541 untracked paths repo-wide. FW-2 was committed alone first (`fa9c394`,
nothing outside the fantasy namespace + the crons.ts lines, as the ticket
requires); the research harness is committed separately.

**Why separately:** the ticket's commit constraint is about FW-2's diff, and
FS-1 explicitly "stays out of `app/`". Mixing them would have violated the
FW-2 constraint; leaving FS-1 uncommitted would have left the Phase 4 report —
a deliverable — as untracked working-tree state one `git clean` from gone.

**What is NOT in it:** `data/` (the raw API sample) and `.env` remain gitignored,
as `.gitignore` lines 277-281 intend.

---

## D15 — CLOSEOUT: owner rulings STOP-E and STOP-F landed. Commit `c2a5da0`

Both D9 and the parallel-finality question are **resolved by the owner** and
implemented. One commit,
`c2a5da08cd66ea637e8c09cc8042ce324e070d6c`, 9 files, +340/−248.
`npm run check` green: **101 test files, 1,007 tests**.

### STOP-F — favorite-club cooldown is 28 CALENDAR DAYS (resolves D9)

**Spec:** `DRAFT_ROOM_SPEC.md` → **v1.0.2**. Header, changelog, the
§Favorite-club exemption paragraph, and ledger item 7 all amended. No other rule
touched.

**Code:** `FAVORITE_CLUB_COOLDOWN_GAMEWEEKS = 4` → `FAVORITE_CLUB_COOLDOWN_DAYS
= 28` + `FAVORITE_CLUB_COOLDOWN_MS`. Every function in
`lib/fantasyFavoriteClub.ts` takes `now` (epoch ms) where it took `gwNumber`.
`users.favoriteClubEffectiveFrom` is now a **timestamp**; the schema comment
says so explicitly, including that it used to be a gwNumber.

**API change:** `fantasySquads.setFavoriteClub` **drops its `gameweekId`
argument**. Under a time-based cooldown a gameweek is not an input to the
decision, and accepting one would invite a caller to believe it mattered.
Verified no caller passes it — the mutation has no frontend consumer.

**Migration: none needed, and this was checked rather than assumed.** No user
row on dev carries `favoriteClub`, `favoriteClubPending` or
`favoriteClubEffectiveFrom` (the columns do not appear in the users table at
all). Had any row carried the old gwNumber, a small integer such as `7` would
have been read as a 1970 epoch timestamp and settled the pending change
instantly — a silent wrong answer, not a crash. Any future environment that
*does* have rows set needs that conversion before this commit is deployed there.

**Tests:** the cooldown suite is rewritten around a fixed instant, including the
boundary the old integer version could not express (inert at `cut − 1ms`, live
at `cut`), and a regression test named for the reason STOP-F exists — a
congested fortnight in which four gameweeks elapse must NOT satisfy the
cooldown.

### STOP-E — one finality rule

`fantasyConstants.finalityAtOrAfter` is **deleted**, along with
`FINALITY_WEEKDAY` (which existed only to serve it) and that module's now-unused
`MS_PER_DAY`. All consumers read
`fantasyGameweekWindows.windowFor(instant).finalityAt`. No parallel functions,
as instructed.

It had **no production consumers** — only tests — so nothing in the running
system changed behaviour. This reverses the judgment recorded in D7, where I
kept both functions to avoid rewriting a landed FW-1 function; the owner's
ruling is the better call, and the reasoning is now in the code: two finality
functions in one namespace invite a caller to pick the wrong one, and the wrong
one fails silently by returning a plausible timestamp up to four days late.

**Test coverage was moved, not dropped.** The Paris wall-clock assertions (CET
22:59Z vs CEST 21:59Z, both DST switchovers) moved from
`fantasySquadRules.test.ts` to `fantasyGameweekWindows.test.ts` and now run
against `windowFor().finalityAt`, extended to cover midweek rounds settling
Friday in both seasons. A new invariant was added while moving them: across a
full year of kickoffs, every gameweek's finality is strictly after the kickoff
and at or after the window's close. What remained behind is the
`zonedWallClockToEpochMs` primitive those tests were really exercising.

### One self-inflicted bug, caught and fixed before commit

The first draft of the lock-engine cooldown test wrapped itself in
`vi.useFakeTimers()` / `finally { vi.useRealTimers() }` — without noticing that
the file's `beforeEach` **already** installs a fake clock and `afterEach`
restores it. Tearing the harness's clock down mid-suite is a genuine
cross-test-contamination bug. The tests now only call `setSystemTime`.

### Pre-existing flake found while verifying, NOT fixed (out of scope)

`src/test/arenaLifecycleIntegration.test.ts` › *"samples expanded
general-knowledge and capital pools across arena seeds"* fails intermittently in
full parallel runs (observed ~2 times in ~15). **It is unrelated to fantasy** —
no fantasy imports — and it is genuinely nondeterministic:

- `challengeArenas.randomArenaCode()` uses `crypto.getRandomValues`, unseeded.
- `challengeArenas.start` derives the content seed as
  `hashString(\`${arena._id}:${arena.code}:${now}\`)` — so the arena `code`, and
  therefore the sampled question set, is different on every single run.
- The test creates 24 arenas and asserts *statistical thresholds* on the union
  of sampled checksums (`> 80`, `> 70`, `> 40`).

A random draw against a fixed threshold fails some fraction of the time. It
passed 30+ times in isolation and 5/5 at HEAD without this commit's changes,
which is consistent with a low-probability flake rather than a regression.

**Left untouched deliberately:** challenge arena is a non-fantasy mode, and the
hard boundary says those stay untouched. Flagged here for the owner. The fix, if
wanted, is to seed the arena code deterministically in tests or to assert on a
fixed-seed sample rather than a random one.

### D6 — unchanged, owner is handling it

No orphan rows deleted, no draw code landed, as instructed. **The DEV deployment
still runs the pre-closeout functions**: this commit was not pushed, because
pushing master's schema to dev still fails on that same drift. FW-2's
bootstrapped data (1,752 fixtures / 49 gameweeks / 2,896 players) is untouched
and intact.
