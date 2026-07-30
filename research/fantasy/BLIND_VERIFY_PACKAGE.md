# THE WEEKEND — Blind Verification Package (FW-LAUNCH O6b, 2026-07-30)

Briefs for a FRESH verifier session per objective O1–O4, modeled on
the FS-1/FW-3/FW-4 verification passes (see
`reports/fs1-blind-verify-v050-2026-07-29.md` for the expected report
shape: a PASS/FAIL-WITH-NOTES verdict, conformance both directions,
hand recomputation, reproducibility).

Ground rules for every brief:
- **The building session must not verify itself** — these briefs were
  PREPARED by the FW-LAUNCH session and must be RUN by a session with
  no prior context. Do not read MISSION_LOG.md or the commit messages
  before forming findings; they are the claims under test.
- Inputs are RESTRICTED to the named files plus the live DEV
  deployment (`admired-warthog-495`); never touch prod
  (`different-lynx-153`).
- Conformance runs BOTH directions: every spec rule is implemented
  (spec→code), and no implemented rule is invented (code→spec —
  anything rule-shaped in code with no spec sentence behind it is a
  NOTE at minimum).
- Every live DEV task ends with the named purge, run twice — the
  second run must find nothing.
- `npm run check` from `app/` must be green before and after.

---

## Brief O1 — Budget mode

**Inputs**: `specs/BUDGET_MODE_SPEC.md` (v1.1.1);
`app/convex/lib/{fantasyConstants,fantasySquadRules,fantasyFavoriteClub}.ts`;
`app/convex/{fantasySquads,fantasyMarket,fantasyLocks}.ts`;
`app/src/pages/shell/weekend/BudgetSquadScreen.tsx`;
`app/src/test/{fantasySquadRules,fantasyLockEngine,fantasyBudgetSquadUi}.test*`;
`app/convex/fantasyBudgetSim.ts` (run only).

**Conformance checklist (spec→code)**: 13 = XI + 2 finishers; the
STOP-2 structural formation rule (GK 1, DEF 3–5, MID 2–5, ATT 1–3,
total 11) and STOP-3 free finisher roles; per-club cap 3 with the
favorite exemption (28-day cooldown, snapshot at build); budget 91.0
with the committed+live invariant across partial locks; per-fixture
locks (out AND the v1.0.1 swap-in ban); unpriced players rejected
fail-closed (STOP-4); unfilled slots ride and score zero; fresh squad
weekly (contextKey per gameweek); crew squads never creatable from a
public call (F1).

**Adversarial tasks**: construct a 13 summing 91.5 and confirm the
server's own message rejects it while 91.0 exactly passes; attempt a
4th same-club player, then re-attempt with the favorite set (both
directions); attempt to reach a locked slot through `setFormation`'s
whole-squad argument; attempt to swap IN a player whose synthetic
fixture already kicked off; attempt `createSquad` with
`context: "crew"`.

**Live DEV task**:
`npx convex run fantasyBudgetSim:simulateBudgetBuild '{"salt":"verify"}'`
→ expect PASS and verify the report's claims independently (query the
squad's slots before purging);
`npx convex run fantasyBudgetSim:purgeSimBudgetData` twice.

---

## Brief O2 — Crowd voting

**Inputs**: `specs/CROWD_VOTING_SPEC.md` (v1.0.1) and
`specs/SCORING_SPEC.md` §Crowd multiplier;
`app/convex/lib/{fantasyCrowd,fantasyScoring,fantasyScorePipeline}.ts`;
`app/convex/{fantasyCrowdVoting,fantasyScores}.ts` (the settlement
hook and the score-version insert sites); `app/convex/schema.ts`
(crowd tables); `app/src/test/fantasyCrowd.test.ts`;
`app/src/pages/shell/weekend/VoteScreen.tsx`;
`app/convex/fantasyCrowdSim.ts` (run only).

**Conformance checklist**: pairwise only, server-served, never
user-chosen; same-fixture default → same-league fallback → never
cross-league; "didn't watch" costless (no Elo update, no penalty);
voting opens at full-time, closes at the finality instant AND the
settlement stamp; per-gameweek Elo from 1500 at K=32, one update per
vote; factor = percentile-within-verdict-position mapped onto
[−0.15, +0.15], median 0; liquidity threshold 25 ⇒ factor 0 and a
VISIBLE "insufficient votes"; ratings frozen at finality and the
frozen factor applied; conflict exclusion at serve time over BOTH
squad contexts; single-use pairs (canonical key); 300-serve cap;
rater accuracy scored only post-settlement against frozen consensus
in the CANONICAL pair direction; court weight 0.5 + accuracy.

**The load-bearing invariant, verified both ways**: the derivation is
in-band BY CONSTRUCTION (prove from `deriveCrowdFactors` that no
input can exceed ±0.15), while `assertCrowdFactorInBand` still runs
on every write (find both call sites) — the rejection is the safety
net, never the mechanism. Verify totals derive exclusively through
`applyCrowdFactor`/`totalFor` — grep for any second mirroring of
`base >= 0 ? … : …` outside `fantasyScoring.ts`.

**Adversarial tasks**: hand `deriveCrowdFactors` adversarial ratings
(±10⁶, NaN-adjacent counts) and confirm band + flags; attempt a
second vote on a voted pair, a vote after close, and a factor
application before finality and after settlement (all must refuse);
confirm a crowd version copies `baseScores`/`statHash` verbatim and
stamps supersession.

**Live DEV task**:
`npx convex run fantasyCrowdSim:simulateCrowdWalkthrough '{"salt":"verify"}'`
→ PASS, then confirm the purge left nothing (`simCrowdState` on the
gameweek id from the report, plus `fantasyScoringDev:syntheticStatus`).

---

## Brief O3 — Reclamation court

**Inputs**: `specs/RECLAMATION_COURT_SPEC.md` (v1.0.1);
`app/convex/lib/fantasyCourtRules.ts`; `app/convex/fantasyCourt.ts`;
`app/convex/fantasyScores.ts` (the court-override read in
`applyFixtureStats` and the finality gates); `app/convex/schema.ts`
(court tables); `app/src/test/fantasyCourtRules.test.ts`;
`app/src/pages/shell/weekend/CourtScreen.tsx`;
`app/convex/fantasyCourtSim.ts` (run only);
`research/fantasy/DECISIONS_NEEDED.md` (OWNER DECISION 1 — the one
acknowledged open reading).

**Conformance checklist**: position verdicts only; the timeline as
offsets from `finalityAt` (filing/endorsement close −24h = Monday
23:59; voting closes −2h59m = Tuesday 21:00; verdicts inside the
remaining window; DST argument in the lib header); 2 filings per user
per gameweek, no stake; duplicate claims merge into the first with
pooled endorsements; threshold max(15, 0.5%·actives) to trial,
opening immediately; one first-come 280-char rebuttal; excluded
jurors: the filer and any holder of the player in ANY squad this
gameweek; votes weighted 0.5 + rolling rater accuracy; passes at
quorum max(30, 1%·actives) AND ≥ 60% weighted yes; no appeals —
unresolved-on-time fails; a passed verdict changes the verdict
EVERYWHERE via one re-score; the public tallies log.

**The hard invariant, adversarially**: no court path touches a
settled gameweek and no path mutates an existing score version.
Verify: every court write re-checks the settlement stamp; the
re-score refuses final rows and past-finality clocks and inserts
version N+1 with supersession; `verdictPosition` had NO writer before
the court (search history if needed — on the row it is insert-only).
Also verify the override read: a feed revision between a ruling and
finality re-scores WITH the ruled position.

**Live DEV task**:
`npx convex run fantasyCourtSim:simulateCourtWalkthrough '{"salt":"verify"}'`
→ PASS; independently recompute the verdict from the reported tallies
via `trialPasses`; confirm purge cleanliness as in O2.

---

## Brief O4 — Tie-break ladders

**Inputs**: `specs/DRAFT_ROOM_SPEC.md` ledger item 5 + §Tie-breaks
(NOTE: the §Explicitly-deferred bullet paraphrases the ladder in a
different order — the ledger and §Tie-breaks agree and are the
authority; flag, don't resolve);
`app/convex/lib/fantasyTieBreaks.ts`; `app/convex/fantasyScores.ts`
(`getCrewTable`/`crewTableFor`);
`app/src/test/{fantasyTieBreaks,fantasyScoringSquads}.test.ts`.

**Conformance checklist**: weekend ladder = points → higher single-
player score → fewer auto-picks → shared; crew-table ladder = equal
cumulative points → head-to-head weekend wins → still level stays a
DISPLAYED tie; auto-pick counts read from the draft log (never
stored elsewhere); `tieBreaksApplied: true` in the payload; the
no-invented-facts posture — a rung with missing data falls through
and a weekend with a null total decides nothing (check this against
the spec: it is implementation policy, not spec text — a NOTE if you
judge it a stretch).

**Adversarial tasks**: hand-build a three-way equal-sum group with a
2–1–0 head-to-head and confirm the ordering; a dead heat on every
rung stays `tied: true`; members who never contested a common weekend
gain no wins from it; confirm the untied table does no per-slot or
draft-log reads (the lazy-inputs claim).

**Live task** (fake-db, no DEV writes needed):
`cd app && npx vitest run src/test/fantasyTieBreaks.test.ts src/test/fantasyScoringSquads.test.ts`
— then hand-recompute at least one integration scenario's ranks from
the test's seeded totals using only the spec text.

---

## Reporting

One report per brief under `research/fantasy/reports/` named
`fwlaunch-blind-verify-o<N>-<date>.md`, in the FS-1 shape: verdict,
conformance both directions, hand recomputations (count them),
reproducibility of the live run, numbered notes. Findings that touch
a LOCKED spec go to the owner as notes — the verifier amends nothing.
