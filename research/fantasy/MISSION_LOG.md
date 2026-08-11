# FW-LAUNCH — Mission Log

Append-only. One entry per loop iteration: objective, what landed
(commits), what parked, next step.

---

## Iteration 1 — 2026-07-30 — O1 recon + build + walkthrough: DONE

- Objective: O1 (budget mode build UI). COMPLETE.
- Recon: read BUDGET_MODE_SPEC v1.1.1, CROWD_VOTING_SPEC v1.0.1,
  RECLAMATION_COURT_SPEC v1.0.1, DRAFT_ROOM ledger 5. Mapped backend
  + frontend with two Explore agents.
- Gap list vs FW-1/FW-4 (all cosmetic or already-built; nothing
  substantive parked):
  - FW-1 already implements the whole budget write path (createSquad
    is budget-only, validateSquad/validateBudget/lockSweep wired).
    O1b was therefore reads, not writes: new fantasyMarket.ts
    (getOpenGameweek — extracted draft's rule as findOpenGameweek —
    and getMarket), plus budget breakdown + player join on getSquad.
  - Default formation at create: spec says user-chosen; UI defaults
    4-4-2 + MID/ATT finishers, freely editable. Cosmetic.
  - friendlyError swallowed the server's curated validation copy
    (budget totals, cap, locks) behind generic fallbacks — added a
    narrow passthrough rule; without it O1c "validation feedback"
    was impossible. Judged cosmetic/infra, not a spec question.
  - §Competition surfaces (weekend leaderboard, cumulative table,
    percentile/ShareCard, private boards) are in the spec but in NO
    mission objective — recorded for LAUNCH_READINESS as a known
    launch-scope gap, not built, not parked (mission scoping is the
    owner's own text).
  - Weekend screens fire no analytics events (draft rooms included);
    kept consistent (none added), noted for readiness report.
- Landed: 136c658 (market reads, BudgetSquadScreen at
  /v2/weekend/squad unlinked + fail-closed gate, error passthrough,
  O1e boundary tests 91.0/91.5, budget UI contract tests; check
  green 129 files / 1312 tests), 2849e0d (…For cores + DEV
  walkthrough sim, PASS on DEV GW1: over-budget + over-cap rejected
  server-side, legal 13 at 52.0, swap arranged, purge clean twice).
- API spend: 0 calls (no live pulls; market reads DEV rows seeded by
  FW-2).
- Parked: none this iteration.
- Next: O2 crowd voting recon + build.

## Iteration 2 — 2026-07-30 — O2 crowd voting: DONE

- Objective: O2. COMPLETE.
- Recon: spec fully absorbed; FW-4 write path mapped (one insert site,
  supersession stamping, ±15% enforcement in assertCrowdFactorInBand,
  settlement ordering flip→stamp→mark). Key finding: post-finality feed
  reads never write scores, so factors applied at settlement can never
  be clobbered; the verdict-override equivalent IS a live risk for O3
  (a pre-finality revision would reset a court verdict to the feed's)
  — carried forward as an O3 requirement, not parked.
- Gap list: spec is complete on abuse (server-served, single-use,
  cap, conflict exclusion, no probation) — O2d's "if silent" clause
  not triggered; voting is open to all users per spec, not crew-gated.
  Rater-rating leaderboard + ShareCard surfaces are spec'd but in no
  mission objective — accuracy is computed and stored (the court's
  input); the leaderboard surface goes to LAUNCH_READINESS as a
  launch-scope gap. "Insufficient votes on their ledger" honored via
  SlotScore.crowdVotes + the squad slot label (no per-event ledger
  surface exists product-wide; noted for readiness).
- Landed: 7cc6555 — tables, pure lib + 12 unit tests, serving/voting,
  factor application at settlement (new versions, in-band by
  construction, settled immune), rater accuracy (canonical-direction
  bug caught BY the DEV walkthrough and fixed), vote UI, crowd labels
  in squad view. Check green 130 files / 1324 tests. DEV walkthrough
  PASS (synthetic GW902: 139 votes, 8 factor versions at ±15%, v1
  readable, refusals correct, purge clean).
- API spend: 0 (synthetic fixtures, no live pulls).
- Parked: none.
- Next: O3 reclamation court.

## Iteration 3 — 2026-07-30 — O3 reclamation court: DONE

- Objective: O3. COMPLETE.
- Gap list: one substantive ambiguity — "gameweek active users" is
  undefined by the spec → PARKED as OWNER DECISION 1; floors (15/30)
  dominate under any reading until ~3,000 actives, so no outcome can
  differ at launch. Duplicate-filing slot cost read as
  merge-is-an-endorsement (no slot consumed) — the spec's "merge into
  the first, endorsements pool" language; noted in code, judged
  cosmetic. The filer counts as the first endorsement (noted).
  Mission's parenthetical "re-scoring is a re-read" is inaccurate at
  the implementation level (the mismatch dampener is baked into the
  stored grid), so the re-score re-runs scoreAllContexts from the
  stored raw stat revision — same engine, no second rule, new
  version; recorded here rather than silently diverging.
- Integration hazard found in O2 recon and closed here: a feed
  revision landing between a ruling and finality would have re-scored
  with the FEED verdict; applyFixtureStats now consults passed claims
  (inline read, acyclic module graph). Proven live in the walkthrough
  (revisionKeepsRuling).
- Landed: 46fe73a. Check green 131 files / 1335 tests. DEV
  walkthrough PASS first run (synthetic GW903; full report in the
  commit message).
- API spend: 0 (synthetic only).
- Parked: OWNER DECISION 1 (see DECISIONS_NEEDED.md).
- Next: O4 tie-break ladders.

## Iteration 4 — 2026-07-30 — O4 tie-breaks: DONE

- Objective: O4. COMPLETE.
- Authority reconciled: ledger item 5 + §Tie-breaks agree (weekend:
  single-player score → auto-picks → shared; table: H2H weekend wins
  after a cumulative tie); the §Explicitly-deferred bullet's
  parenthetical paraphrases a different order — followed the ledger,
  recorded the discrepancy for the owner's spec-sync ticket (no spec
  edit, no park: the binding sources agree).
- Landed: 94e4342 — pure ladder lib + getCrewTable integration
  (lazy inputs for tied clusters only), tieBreaksApplied: true,
  CrewScreen copy. Tests: 11 pure rung cases + 2 integration
  scenarios (H2H 2–1 breaks an equal-sum tie; dead heat stays tied).
  Check green 132 files / 1346 tests.
- API spend: 0.
- Parked: none new.
- Next: O5 integration pass.

## Iteration 5 — 2026-07-30 — O5 integration pass: DONE

- Objective: O5. COMPLETE (83786e1).
- The scripted loop (fantasyIntegrationSim, synthetic GW905, PASS on
  DEV): both modes in one gameweek, votes → verdict → revision-keeps-
  ruling → idempotent last-look → settlement (factors, finalize,
  stamp, settle, rater accuracy) → crew table with tie-breaks →
  settled immunity → purge clean. Full assertions in the commit.
- Fix-what-broke, both found BY the pass:
  1. No crew-sheet surface existed anywhere (setFormation had no UI
     consumer) — a drafter could not arrange or view their sheet on a
     phone, failing the H1 goal for crew mode. Built CrewSheetScreen
     (+ getMyCrewSheet), swap-only, linked from the completed room.
  2. The budget market picker allowed fixtureless players that the
     server (correctly) refuses — now disabled with the badge.
- Mobile viewport (H1): Playwright smoke on a Pixel-class viewport
  against DEV, real flows end to end (guest onboarding → budget build
  with a live GW1 pick → server-drafted crew → real sheet swap), no
  horizontal scroll anywhere; screenshots committed under
  app/e2e/artifacts. E2E is on-demand (npx playwright test), not part
  of npm run check, and purges its own DEV writes.
- API spend: 0 across the whole mission so far (every walkthrough is
  synthetic or reads DEV rows FW-2 already ingested).
- Parked: none new.
- Next: O6 readiness + blind-verify package.

## Iteration 6 — 2026-07-30 — O6: DONE. **GOAL REACHED.**

- Objective: O6 (terminal). COMPLETE.
- Landed: LAUNCH_READINESS.md (per-objective status, test totals,
  the one parked decision, zero API spend, gaps/wrinkles, the
  owner's prod-deploy checklist) and BLIND_VERIFY_PACKAGE.md (four
  briefs, O1–O4, FS-1-shaped: restricted inputs, two-way
  conformance, adversarial tasks, live DEV runs with double purge;
  prepared only — self-verification is void, a fresh session runs
  them).
- GOAL: THE WEEKEND is feature-complete as a launch candidate on
  DEV — both entry modes exercised end-to-end on a phone viewport
  (Playwright, screenshots committed), crowd voting live, the court
  live, tie-breaks implemented, five scripted walkthroughs PASS,
  all purge-clean, check green 132/1,346. Prod deploy remains the
  owner's manual step per the readiness checklist.
- Mission totals: 7 commits (136c658..O6), 1 parked decision, 0 API
  calls, 0 spec edits.

# MISSION FW-POLISH — THE WEEKEND: from functional to football (2026-08-11)

## Iteration 1 — 2026-08-11 — O1 ship-blockers: DONE

- Objective: O1. COMPLETE.
- a) Formation editable after confirmation: `FormationSection` renders
  D3 preset chips ON the squad screen (and the crew sheet), wired to
  the existing setFormation. Chips a locked arrangement cannot reach
  render disabled (planned client-side against the same rule the
  server enforces). Lock-aware: locked slots pass through verbatim.
- b) D3 chips replace the +/− steppers in the create view too. The
  planner (`src/lib/weekendFormations.ts`, pure, 8 unit tests) keeps
  every filled slot whose role the new shape can hold; the overflow is
  DISPLACED — budget mode confirms, clears the slot and holds the
  player in a visible touchline tray ("Bring back on" = first open
  slot); crew sheets confirm out-of-listed-position instead (the 13
  are the 13 — nobody can be cleared, FW-3).
  NOTE (recorded, not parked): D3's chip list has seven shapes and
  calls them "the legal shapes", but the structural bounds also admit
  5-2-3. The explicit list governs; the test suite pins both facts.
  A squad already in 5-2-3 (steppers era) still renders its derived
  label; no chip is active.
- c) D4: badge is "No fixture" (muted, not warning-yellow); picker
  defaults to fixture-holders only with a "Show all" toggle; hub and
  picker carry "This weekend: <leagues>" derived from a NEW read-only
  presentation query `fantasyMarket.getWeekendLeagues` (postponed/
  cancelled fixtures don't count a league as playing). League display
  names live client-side (`src/lib/leagueNames.ts`), pinned to the
  ids in fantasyConstants.LEAGUE_IDS / fetch/config.ts. Backend note:
  this is the mission's sanctioned "new query for presentation data";
  prod convex will need one deploy at O6, sequenced BEFORE the
  frontend push (the hub calls it via useQuery).
- d) Aug-28 sweep: zero references in app/src; LAUNCH_READINESS.md
  got a dated UPDATE note (historical target, superseded by the
  2026-08-01 ruling). findOpenGameweek verified: earliest finalityAt
  among upcoming/live — already the earliest open window; untouched.
- Check: tsc + lint (1 pre-existing warning, was 2 — two stray const
  exports un-exported) + 139 test files green + build.
- Parked: none.
- Next: O2 pitch view.
