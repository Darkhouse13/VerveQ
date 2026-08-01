# THE WEEKEND — Blind Verification Package (FW-LAUNCH O6b, 2026-07-30; repaired FW-VS1 + FW-CR2, 2026-08-01)

Briefs for a FRESH verifier session per objective O1–O4, modeled on
the FS-1/FW-3/FW-4 verification passes (see
`reports/fs1-blind-verify-v050-2026-07-29.md` for the expected report
shape: a PASS/FAIL-WITH-NOTES verdict, conformance both directions,
hand recomputation, reproducibility).

The FW-VS1 repair: every command below now exists and runs as
written; the O2/O3 live tasks use the sims' `keepData` contract so
before-counts are independently inspectable; O4 requires no
test-file access; each brief names its purge commands explicitly.

The FW-CR2 repair (after the round-2 verification, reports
`fwlaunch-blind-verify-o1..o4-2026-08-01.md`): every input gap the
round-2 reports flagged is closed — O1 can verify unfilled-slot
scoring (the `squadScore` region is a named input), O2's second-vote
attempt is runnable (the crowd walkthrough exercises the used-pair
rejection server-side and reports it) and the crew-sheet surface is
named, O3 can verify the crowd-freeze regrouping in-compartment (the
freeze/derivation files are named inputs). Spec versions cited below
are the FW-CR2 revisions; the O3 walkthrough now covers the FW-CR2
stamp-binding scenarios and keeps THREE gameweeks with FOUR purge
commands.

Ground rules for every brief:
- **The building session must not verify itself** — these briefs were
  PREPARED by the FW-LAUNCH session and must be RUN by a session with
  no prior context. Do not read MISSION_LOG.md or the commit messages
  before forming findings; they are the claims under test.
- Inputs are RESTRICTED to the named files plus the live DEV
  deployment (`admired-warthog-495`); never touch prod
  (`different-lynx-153`).
- **A file a brief explicitly names as an input is readable even
  where a general category rule would forbid it; disclose the read.**
- Conformance runs BOTH directions: every spec rule is implemented
  (spec→code), and no implemented rule is invented (code→spec —
  anything rule-shaped in code with no spec sentence behind it is a
  NOTE at minimum).
- Every live DEV task ends with the brief's named purge commands,
  each run twice — the second pass must delete zero rows.
- `npm run check` from `app/` must be green before and after.

The sims' shared data contract (FW-VS1):
- `fantasyCrowdSim`, `fantasyCourtSim`, `fantasyIntegrationSim`
  accept `"keepData": true` — the run then SKIPS its purge phase,
  leaves every row on DEV for inspection, and the report's `kept`
  field carries the ids and the exact purge commands to run when
  done.
- `fantasyBudgetSim` and `fantasyDraftSim` always keep their rows
  (their purges were always separate commands); they accept
  `keepData` for CLI uniformity.
- Every purge is idempotent: run it twice, paste both outputs, the
  second must be all zeros.

---

## Brief O1 — Budget mode

**Inputs**: `specs/BUDGET_MODE_SPEC.md` (v1.3.0);
`app/convex/lib/{fantasyConstants,fantasySquadRules,fantasyFavoriteClub}.ts`;
`app/convex/{fantasySquads,fantasyMarket,fantasyLocks}.ts`;
`app/convex/fantasyScores.ts` (the `squadScore` region ONLY — the
slot-aggregation function where an unfilled slot contributes nothing
to the total; FW-CR2, closes O1-F2);
`app/src/pages/shell/weekend/BudgetSquadScreen.tsx`;
`app/src/test/{fantasySquadRules,fantasyLockEngine,fantasyBudgetSquadUi}.test*`;
`app/convex/fantasyBudgetSim.ts` (run + read — its boundary phase is
one of the claims under test).

**Conformance checklist (spec→code)**: 13 = XI + 2 finishers; the
STOP-2 structural formation rule (GK 1, DEF 3–5, MID 2–5, ATT 1–3,
total 11) and STOP-3 free finisher roles; the duplicate-player
prohibition (v1.2.0 — each player at most once per squad,
`duplicate_player`); per-club cap 3 with the favorite exemption
(**28-day** cooldown as a timestamp, prior favorite in force during a
cooldown, first-ever set immediate — v1.2.0, snapshot at build);
budget 91.0 with the committed+live invariant across partial locks;
per-fixture locks (out AND the v1.0.1 swap-in ban); unpriced players
rejected fail-closed (STOP-4); player eligibility — active with a
fixture in the target gameweek, server-rejected otherwise (v1.3.0,
the deliberate divergence from draft's no-fixture rule; closes
O1-F1); unfilled slots ride and score zero — verify BOTH halves: the
null slot is legal and costless (`fantasySquadRules`) and the
`squadScore` aggregation gives an empty slot nothing while counting
it `emptySlots`, so its contribution to the total is exactly zero
(the named `fantasyScores.ts` region; closes O1-F2); fresh squad
weekly (contextKey per gameweek); crew squads never creatable from a
public call (F1 — `assertPublicSquadCreateArgs`, the guard the
public wrapper calls first).

**Adversarial tasks**: the sim's FW-VS1 boundary phase demonstrates,
server-side, in one transaction-local synthetic world: a 13 summing
exactly 91.0 accepted; the 91.5 variant refused with both boundary
numbers in the message; a 4th same-club player accepted with the
favorite set AND refused from a non-favorite club; a locked slot
refused through `setFormation`'s whole-squad argument; a kicked-off
player refused as a swap-in; `context: "crew"` refused. Verify each
claim in the report against the code paths (file:line), then verify
independently at the pure layer: hand `validateBudget` a 91.5 squad
and confirm the message carries 91.5 and 91.0; hand
`validateClubCap` 4-same-club with and without the favorite;
hand `planFavoriteClubChange` a first-ever set (immediate) and a
change (queued 28 days, prior in force).

**Live DEV task**:
`npx convex run fantasyBudgetSim:simulateBudgetBuild '{"salt":"verify"}'`
→ expect PASS; verify the report's claims independently (query the
squad's slots — the run keeps its live-market rows; the synthetic
boundary world is transaction-local by design and is asserted by the
report's `boundaryWorld` line).
**Purge**: `npx convex run fantasyBudgetSim:purgeSimBudgetData`
twice; the second run must report zero deletions.

---

## Brief O2 — Crowd voting

**Inputs**: `specs/CROWD_VOTING_SPEC.md` (v1.2.0) and
`specs/SCORING_SPEC.md` §Crowd multiplier;
`app/convex/lib/{fantasyCrowd,fantasyScoring,fantasyScorePipeline}.ts`;
`app/convex/{fantasyCrowdVoting,fantasyScores}.ts` (the settlement
hook and the score-version insert sites); `app/convex/schema.ts`
(crowd tables); `app/src/test/fantasyCrowd.test.ts`;
`app/src/pages/shell/weekend/VoteScreen.tsx`;
`app/src/pages/shell/weekend/BudgetSquadScreen.tsx` (`SlotScoreCell`
— the v1.1.0 "insufficient votes" surface, shared by the budget and
crew-sheet views);
`app/src/pages/shell/weekend/CrewSheetScreen.tsx` (FW-CR2, closes
O2-F2 — verify the crew sheet actually renders `SlotScoreCell`, so
the "insufficient votes" surface exists on BOTH squad views);
`app/convex/fantasyCrowdSim.ts` (run only).

**Conformance checklist**: pairwise only, server-served, never
user-chosen; same-fixture default → same-league fallback → never
cross-league; "didn't watch" costless (no Elo update, no penalty);
voting opens at full-time, closes at the finality instant AND the
settlement stamp; per-gameweek Elo from 1500 at K=32, one update per
vote; factor = percentile-within-verdict-position mapped onto
[−0.15, +0.15], median 0 — the group keyed on each row's CURRENT
`verdictPosition` at freeze time (v1.1.0, court-ruled rows in their
ruled group); liquidity threshold 25 ⇒ factor 0, a VISIBLE
"insufficient votes" on the squad score surfaces, AND exclusion from
the group's percentile population — sub-threshold players neither
receive nor shape factors (v1.2.0, closes O2-F3); ratings frozen at
finality and the frozen factor applied; conflict exclusion at serve
time over BOTH squad contexts; single-use pairs (canonical key);
300-serve cap; rater accuracy scored only post-settlement against
frozen consensus in the CANONICAL pair direction; court weight
0.5 + accuracy.

**The load-bearing invariant, verified both ways**: the derivation is
in-band BY CONSTRUCTION (prove from `deriveCrowdFactors` that no
input can exceed ±0.15), while `assertCrowdFactorInBand` still runs
on every write (find both call sites) — the rejection is the safety
net, never the mechanism. Verify totals derive exclusively through
`applyCrowdFactor`/`totalFor` — grep for any second mirroring of
`base >= 0 ? … : …` outside `fantasyScoring.ts`.

**Adversarial tasks**: hand `deriveCrowdFactors` adversarial ratings
(±10⁶, NaN-adjacent counts) and confirm band + flags; attempt a
second vote on a voted pair — RUNNABLE (FW-CR2, closes O2-F1): the
walkthrough's own `probeSecondVote` phase re-ballots a pair voter 0
already voted, server-side through `castVoteFor`, while voting is
still OPEN (so the refusal can only be the used-pair check), and the
report's `secondVoteRejected` field carries the refusal verbatim —
confirm it reads "That pair has already been answered." and verify
the static gate order (used-pair before window); attempt a vote
after close, and a factor application before finality and after
settlement (all must refuse); confirm a crowd version copies
`baseScores`/`statHash` verbatim and stamps supersession.

**Live DEV task**:
`npx convex run fantasyCrowdSim:simulateCrowdWalkthrough '{"salt":"verify","keepData":true}'`
→ PASS with a `kept` block and `secondVoteRejected` present. Inspect the kept rows independently
BEFORE purging (before-counts are yours, not the report's):
`npx convex run fantasyCrowdSim:simCrowdState '{"gameweekId":"<kept.gameweekId>"}'`
and
`npx convex run fantasyScoringDev:syntheticStatus '{"season":"SYNTH-O2-CROWD","gwNumber":902}'`.
**Purge** (the two commands from `kept.purgeCommands`, in order):
`npx convex run fantasyCrowdSim:purgeSimCrowdData '{"gameweekId":"<kept.gameweekId>"}'`
then
`npx convex run fantasyScoringDev:purgeSynthetic '{"season":"SYNTH-O2-CROWD"}'`,
each twice — second pass all zeros; then re-run the two state queries
above and confirm they read empty.

---

## Brief O3 — Reclamation court

**Inputs**: `specs/RECLAMATION_COURT_SPEC.md` (v1.2.0);
`app/convex/lib/fantasyCourtRules.ts`; `app/convex/fantasyCourt.ts`;
`app/convex/fantasyScores.ts` (the court-override read in
`applyFixtureStats` and the finality gates); `app/convex/schema.ts`
(court tables); `app/src/test/fantasyCourtRules.test.ts`;
`app/src/pages/shell/weekend/CourtScreen.tsx`;
`app/convex/lib/fantasyCrowd.ts` (`deriveCrowdFactors`) and
`app/convex/fantasyCrowdVoting.ts`
(`applyCrowdFactorsForGameweek` — the freeze) (FW-CR2, closes O3-F2:
the crowd-freeze regrouping interaction is verifiable inside this
compartment — read them for the grouping-by-CURRENT-verdict claim,
not for O2's checklist);
`app/convex/fantasyCourtSim.ts` (run only);
`research/fantasy/DECISIONS_NEEDED.md` (OWNER DECISION 1 is now
closed in spec v1.1.0 — confirm the definitions agree).

**Conformance checklist**: position verdicts only; the timeline as
offsets from `finalityAt` (filing/endorsement close −24h = Monday
23:59; voting closes −2h59m = Tuesday 21:00; verdicts ONLY inside
[voting close, finality) — `inVerdictWindow`, half-open both ends);
the v1.1.0 resolution/expiry split: at/after finality an open claim
EXPIRES (status `expired`, no verdict, no tallies, no score effect)
and the resolver cadence provably covers the verdict window
(`cadenceCoversVerdictWindow`); "gameweek active users" = distinct
squad-holders, any context (v1.1.0 — `activeUsersOf`); 2 filings per
user per gameweek, no stake; duplicate claims merge into the first
with pooled endorsements; threshold max(15, 0.5%·actives) to trial,
opening immediately; one first-come 280-char rebuttal, TRIAL-ONLY
(v1.1.0 — refused in filing, slot survives); excluded jurors: the
filer and any holder of the player in ANY squad this gameweek; votes
weighted 0.5 + rolling rater accuracy; passes at quorum
max(30, 1%·actives) AND ≥ 60% weighted yes; no appeals — a trial
still open at finality EXPIRES, distinct from failed and died; the
v1.2.0 stamp binding — `passed` may be stamped ONLY when the
re-score landed in the same pass; a passing trial with no landable
score is HELD on trial (tally recorded, `held` counted) and retried
in-window, expiring at finality with the tally PRESERVED (an expired
claim carries a tally exactly when an in-window pass held it); a
passed verdict changes the verdict EVERYWHERE via one re-score; the
public tallies log; the crowd-freeze regrouping interaction
(§Effects, v1.1.0) — the freeze groups by CURRENT verdict, now
statically verifiable from the named freeze/derivation inputs.

**The hard invariant, adversarially**: no court path touches a
settled gameweek, no path mutates an existing score version, and no
outcome is stamped that the scores did not receive — at EITHER
boundary: the FW-CR1 settlement-lag scenario (past finality but not
yet stamped settled, a passing jury's claim must expire, not pass)
AND the FW-CR2 stamp-binding scenario (a passing jury's claim on an
UNSCORED fixture must be held, not stamped — `passed` binds to
`rescoreForVerdict` reporting `written: true` in the same pass).
Verify: every court write re-checks the settlement stamp; the
re-score refuses final rows and past-finality clocks and inserts
version N+1 with supersession; the resolver's passed branch tests
`rescore.written` before stamping; `verdictPosition` on the row is
insert-only. Also verify the override read: a feed revision between
a ruling and finality re-scores WITH the ruled position.

**Live DEV task**:
`npx convex run fantasyCourtSim:simulateCourtWalkthrough '{"salt":"verify","keepData":true}'`
→ PASS with a `kept` block (three gameweeks: main, the
settlement-lag one, and the FW-CR2 stamp-binding one). Independently
recompute the verdict from the reported tallies via `trialPasses`;
confirm the lag claim reads `expired` with null tallies; confirm the
stamp gameweek's claims read one `passed` (on the fixture that
scored late in-window, with its re-scored version present) and one
`expired` WITH a 31-juror tally preserved (held in-window, fixture
never scored, zero score rows) — the report's `stampHeldPass` /
`stampRetryPass` / `stampExpiryPass` counters narrate the three
resolver passes. Inspect the kept rows BEFORE purging:
`npx convex run fantasyCourtSim:courtSimClaims '{"gameweekId":"<kept.gameweekId>"}'`
(and with `<kept.lagGameweekId>` / `<kept.stampGameweekId>`) and
`npx convex run fantasyScoringDev:syntheticStatus '{"season":"SYNTH-O3-COURT","gwNumber":903}'`
(and `"gwNumber":904` for the lag gameweek, `"gwNumber":905` for the
stamp gameweek — 905's `never` fixture must read `awaiting_data`
with a `notScoredReason`, not scored).
**Purge** (the four commands from `kept.purgeCommands`, IN ORDER —
the lag and stamp gameweeks first with `purgeUsers: false`):
`npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"<kept.lagGameweekId>","purgeUsers":false}'`
then
`npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"<kept.stampGameweekId>","purgeUsers":false}'`
then
`npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"<kept.gameweekId>"}'`
then
`npx convex run fantasyScoringDev:purgeSynthetic '{"season":"SYNTH-O3-COURT"}'`,
each twice — second pass all zeros; then re-run the state queries and
confirm empty.

---

## Brief O4 — Tie-break ladders

**Inputs**: `specs/DRAFT_ROOM_SPEC.md` (v1.3.1) ledger item 5 +
§Tie-breaks (the §Explicitly-deferred paraphrase was corrected in
v1.3.0 and ledger item 5's crew-table clause rewritten in v1.3.1
after the round-2 finding O4-F1 — confirm §Tie-breaks, §Explicitly
deferred and ledger item 5 now state the SAME ladder: cumulative
points primary, equal points broken by head-to-head weekend wins,
still level a displayed tie); `app/convex/lib/fantasyTieBreaks.ts`;
`app/convex/fantasyScores.ts` (`getCrewTable`/`crewTableFor`);
`app/convex/fantasyIntegrationSim.ts` (run only — the live path).
**No test files are inputs to this brief**, and none are needed:
the adversarial scenarios below are hand-built against the pure
library.

**Conformance checklist**: weekend ladder = points → higher single-
player score → fewer auto-picks → shared; crew-table ladder = equal
cumulative points → head-to-head weekend wins → still level stays a
DISPLAYED tie; auto-pick counts read from the draft log (never
stored elsewhere); `tieBreaksApplied: true` in the payload; the
missing-data policy — now spec text (v1.3.0 §Tie-breaks), verify
both directions: a null weekend total abstains from every rung, a
rung unavailable on either side falls through, an exhausted ladder
stays a displayed tie.

**Adversarial tasks — hand-built inputs against the pure library**
(write a scratch `.ts` file importing from
`app/convex/lib/fantasyTieBreaks.ts` and run it with
`npx tsx`; no DB, no tests):
- a three-way equal-sum group with a 2–1–0 head-to-head record →
  `orderTiedGroup` returns subRanks 0/1/2, none `stillTied`;
- a dead heat on every rung → all members `stillTied: true` at the
  same subRank;
- members who never contested a common weekend gain no wins from it
  (disjoint `weekends` maps → 0–0, still tied);
- null points on one side of a weekend → `compareWeekendResult`
  returns 0 whatever the other rungs say; a null rung input
  (topPlayerScore or autoPicks) falls through to the next rung;
- an all-null cluster (every member's deciding inputs null — the
  ladder exhausted with no facts, round-3 finding O4-F1) → all
  members share subRank 0 with `stillTied: true`, and the crew
  wrapper renders the shared rank `tied: true`;
- hand-recompute at least one multi-member scenario's ranks from the
  spec text alone and confirm the library agrees.

**The lazy-inputs claim, corrected (FW-VS1) — verify the ACTUAL
design by static analysis of `crewTableFor` (file:line citations)**:
- a SETTLED weekend's points come from the squad's stamped
  `finalScore` — no per-slot reads;
- a PROVISIONAL weekend with any scored fixture derives live through
  `squadScore` — per-slot reads by design (FW-4R N3: the weekend in
  flight is the one that can still move), NOT lazily skipped;
- the draft-log reads (auto-pick counts) and the per-slot
  top-player-score reads happen ONLY for tied clusters, in all
  cases — the untied table never pays for them.

**Live DEV task** (the `getCrewTable` path, via the integration sim's
keepData contract):
`npx convex run fantasyIntegrationSim:simulateWeekendLoop '{"salt":"verify","keepData":true}'`
→ PASS with a `kept` block; then run the ready-made probe from
`kept.stateProbe` and confirm the crew table payload carries
`tieBreaksApplied: true` with ranks and `tied` flags consistent with
the members' totals.
**Purge** (from `kept.purgeCommands`, in order):
`npx convex run fantasyIntegrationSim:purgeLoopData '{"gameweekId":"<kept.gameweekId>"}'`
then
`npx convex run fantasyScoringDev:purgeSynthetic '{"season":"SYNTH-O5-LOOP"}'`,
each twice — second pass all zeros.

---

## Reporting

One report per brief under `research/fantasy/reports/` named
`fwlaunch-blind-verify-o<N>-<date>.md`, in the FS-1 shape: verdict,
conformance both directions, hand recomputations (count them),
reproducibility of the live run, numbered notes. Findings that touch
a LOCKED spec go to the owner as notes — the verifier amends nothing.
