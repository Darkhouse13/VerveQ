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

## Iteration 2 — 2026-08-11 — O2 pitch view: DONE

- Objective: O2. COMPLETE.
- `PitchView` (components/weekend/PitchView.tsx): CSS-only pitch —
  striped turf (repeating-linear-gradient), markings as bordered divs
  (penalty box, six-yard box, arc, centre circle over the halfway
  line at the foot), goal end at the top per the fantasy convention.
  No image assets, no crests, no likenesses. XI rows derive from the
  slots' roles; the two finishers sit on a touchline strip that
  shares the turf so empty finisher chips read identically.
- All FW-4 slot states re-rendered at chip size: empty = dashed
  outline + position + plus (a position to fill — the "Empty —
  scores 0" row is gone); filled = surname + price; locked = glyph +
  detail-only sheet; awaiting = "…" and NEVER a number; scored =
  points with the honest zero AS 0.0 + DNP marker; mismatch = ×0.75
  marker (or "as {POS}" browsing hint pre-score); insufficient
  votes = "few votes". The full FW-4 vocabulary (awaiting data /
  did not appear / crowd % / insufficient votes) renders verbatim in
  the slot detail sheet one tap away — chip carries the state, sheet
  carries the sentence. The compact list is fully retired: every
  state fits, so no fallback was parked.
- Tap grammar: armed swap consumes the tap; open slot → picker;
  manned slot → detail sheet with Move / Clear (Clear absent on crew
  sheets — players fixed). Sheet actions call the same handlers the
  list used; no mutation paths changed.
- Both containers (budget squad + crew sheet) render the pitch via
  the unchanged SquadView contract; SlotRow deleted.
- Check green 139 files; budget UI suite reworked to drive chips +
  sheet (11 tests, including a new chip-state contract).
- Parked: none.
- Next: O3 dark-first WEEKEND canvas.

## Iteration 3 — 2026-08-11 — O3 dark-first WEEKEND canvas: DONE

- Objective: O3. COMPLETE.
- `.theme-weekend` token block (index.css), applied via ShellLayout's
  existing `theme` prop on all 10 WEEKEND layout sites plus the five
  portaled DialogContents (portals leave the themed container, so the
  class re-enters it). Canvas 0 0% 5% (#0d0d0d), cream ink, lime
  #c6ff00 in BOTH the primary and accent slots, warm-light borders,
  lime offset shadows. Same Neo primitives throughout — no component
  changed, only tokens. Pitch chips got explicit cream fills (they
  contrast the always-dark turf, not the page theme): cream shirts on
  dark turf is where the demoted cream now lives, alongside the vivid
  four-door cards.
- Zero non-WEEKEND diff PROVEN, not eyeballed: 380px screenshots of
  Home (/v2), Compete (/compete) and the daily quiz screen
  (/v2/daily) taken from the pre-change tree (git stash) and the
  themed tree against the same DEV backend — pixel-compared with PIL,
  all three identical. Evidence committed under
  app/e2e/artifacts/fw-polish/ (o3-before-*/o3-after-*).
- Visual smoke on DEV (simloop_-owned, purged after: purgeUiRun
  deleted 14 rows + 1 user): hub with "This weekend: La Liga" (the
  D4 line working against a genuinely partial GW1), create view with
  chips, empty pitch, picker (eligible-only default, Show all,
  league line), manned pitch. Screenshots committed same directory.
- DEV convex updated (`npx convex dev --once`) so getWeekendLeagues
  answers on DEV — prod needs the same one deploy at O6, BEFORE the
  frontend push.
- Check green 139 files.
- Parked: none.
- Next: O4 copy pass.

## Iteration 4 — 2026-08-11 — O4 copy pass: DONE

- Objective: O4. COMPLETE (deliberately surgical — most WEEKEND copy
  already carries the confident register: "the eye test", "He did /
  Feed's right", "the 13 are the 13", "That pick didn't land").
- Landed: position-voiced picker prompts replacing "Pick for the
  {{role}} slot" — GK "Who starts between the sticks?", DEF "Who
  holds the back line?", MID "Who runs the midfield?", ATT "Who
  leads the line?", finishers "Who changes the game late?" (new
  `finisher` prop threads the slot kind); create card counts
  "shirts" not "slots"; "Finisher slots" → "Your finishers"; the
  draft pool's badge now matches D4's "No fixture" (same key had
  drifted). Contract test pins the GK + finisher prompts.
- Not touched, on purpose: FW-4 score vocabulary (settled /
  provisional / awaiting data / did not appear / insufficient votes)
  — locked semantics, already honest words; every toast string
  (server's words surface verbatim); ANALYTICS.md event names —
  zero analytics changes anywhere this mission so far.
- Check green 139 files.
- Parked: none.
- Next: O5 mobile QA.

## Iteration 5 — 2026-08-11 — O5 mobile QA: DONE

- Objective: O5. COMPLETE.
- weekendMobile.spec.ts rewritten as the FW-POLISH loop at 380×844
  (explicit viewport override) against DEV: hub (doors + D4 league
  line) → guest onboarding → create via chips (4-4-2 pre-pressed) →
  empty pitch (13 empty chips counted) → GK + whole back four picked
  THROUGH the pitch (each position asks its question) → 4-4-2→3-5-2
  with players placed → displacement confirm → tray visible →
  "Bring back on" re-places him → crew create (crew named "FW-O5
  SIM" so purgeUiRun owns it — also fixed weekendGo.spec, whose "GO
  Smoke Crew" name the purge never matched) → draft lobby (Ready up,
  two-drafter floor) → server-drafted crew sheet on the pitch (Move
  without Clear, real setFormation swap) → vote surface → court
  surface. Vote/court are asserted as honest surfaces; serving a
  real pair needs finished matches the suite must not fabricate.
- Every screen: no horizontal scroll. Whole run: zero console
  errors / page errors (asserted, not eyeballed; dev-only i18n
  missing-key WARNINGS are pre-existing and are not errors).
- PASS 14.3s; weekendGo.spec PASS 5.8s after its pitch-tap update.
- Screenshots committed (FW-LAUNCH convention, e2e/artifacts):
  weekend-hub/pitch-empty/pitch-manned/shape-tray/lobby/sheet/vote/
  court-380.png; stale budget-squad-mobile.png + crew-sheet-mobile
  .png (old list UI) retired.
- Parked: none.
- Next: O6 ship.

## Iteration 6 — 2026-08-11 — O6 ship: DONE. **GOAL REACHED.**

- Objective: O6 (terminal). COMPLETE.
- Pre-ship: check green 139 files; full DEV e2e smoke green — the
  weekend specs on the shared config, anonymousFirst + claimCopy
  under their documented VITE_ANONYMOUS_FIRST_ENABLED=true env (an
  earlier blanket run "failed" them only because a stale reused dev
  server lacked the flag; with the documented env: 9 passed 1
  skipped). Clean tree at 74ee46d.
- STOP-and-reconsider honored: backend diff audited before deploy —
  exactly +32 lines, one read-only query, no mutations, no schema.
  Proceeded under the standing "new QUERIES for presentation data
  are fine" rule.
- Ship order: `npx convex deploy` to different-lynx-153 FIRST
  (getWeekendLeagues verified answering on prod), then master push;
  CI deploy workflow success (43s), Check workflow success.
- Live verification (recorded in LAUNCH_READINESS.md §FW-POLISH):
  chunk-content greps + scripted 380px walkthrough — Home cream
  rgb(255,247,240), hub #0d0d0d with "This weekend: La Liga", chips
  with 4-4-2 pressed, pitch with 13 open positions, live shape
  switch to 3-5-2 ON PROD, picker eligible-default with Show all
  off and zero "No fixture" badges, 0px horizontal overflow, no
  page errors. QA footprint: guest `fwpolish_qa`, empty squad.
- Mission totals: 6 commits (aae5683..74ee46d + this doc commit),
  0 parked decisions, 0 analytics changes, 1 sanctioned backend
  query, prod verified live on a phone viewport.

# MISSION FW-POLISH-2 — formation UX consolidation + dark-canvas glare (2026-08-11)

Scope: app/src WEEKEND surfaces + the shared bottom nav (R3 only).
Zero backend changes of any kind (verified: no convex/ file in the
diff); prod shipped by CI frontend deploy alone.

## O1+O2 — 2026-08-11 — one chooser + famous-formation catalogue: DONE (7275062)

- R1: `FormationChooser` (shape + finishers) is the single chooser —
  inline on the setup page above START BUILDING, and the SAME
  component as a bottom sheet (DrawSheet-pattern Radix primitives,
  `weekend-sheet-in` slide-up) opened from the pitch header's
  now-tappable "SHAPE — …" label. The pitch screen's inline chip rows
  are gone. Finisher roles editable from the sheet via the same atomic
  setFormation (locked finishers frozen); lock-awareness + displaced
  tray unchanged.
- R2: 15 named formations over the unchanged band counts, every legal
  band covered (5-2-3 restored per the ruling — supersedes FW-POLISH's
  pinned omission). Same-band switch = pure re-layout: NO mutation,
  nobody displaced, client-side only. PitchView renders the named ROW
  layout (4-2-3-1 → rows 4/2/3/1; diamond → 4/1/2/1/2) with a
  per-role fallback on any slots/layout mismatch. Display name
  persists client-side per squad (localStorage keyed by squadId;
  reload defaults to the band's first-listed name — 4/5/1 defaults to
  4-2-3-1 by the ruling's order).
- Tests pin: exact catalogue list+order, per-entry band legality,
  band coverage incl. 5-2-3, rows sum to the XI (GK row leads, band
  order, no empty rows), name uniqueness, stored-name resolution,
  no-mutation re-layout, sheet-driven finisher change, unreachable
  formations disabled under locks.

## O3 — 2026-08-11 — flush dark nav: DONE (0053d54)

- Root cause found in review: the nav used THEME TOKENS
  (bg-foreground/text-background) that flip inside .theme-weekend —
  the nav rendered as a cream slab on WEEKEND routes — plus a light
  border-t halo (background/40) on every route.
- Fix: literal chrome — pinned near-black surface hsl(0 0% 7%),
  muted-cream tints, lime active accent, border removed. Dark nav on
  cream screens (intended) keeps its look minus the halo.
- Proof committed (chromeProof.spec.ts + chrome-*-380-before/after):
  compete diff confined to nav rows (y=2112..2159/2321), quiz
  byte-identical, home diff = nav + one live countdown digit,
  weekend-hub cream slab → flush dark. Snapshot re-pinned
  (homeDrawCardContract).

## O4 — 2026-08-11 — dark-canvas shadows: DONE (856a57e)

- `.theme-weekend { --neo-shadow-color: 0 0% 0% }` — one token, every
  neo-shadow consumer inside the theme quiets (hub doors, picker
  rows, dialogs, tray, pitch chips). Lime survives as working accent
  only. Non-WEEKEND routes share none of these tokens (O3's pairs
  prove zero diff, nav excepted).

## O5 — 2026-08-11 — 380px full loop: DONE (cb0f878)

- weekendMobile loop extended: setup chooser (15 chips incl. 5-2-3,
  finisher section) → pitch build → no-inline-chips assertion → sheet
  open via label → same-band re-layout to the diamond (no mutation
  path, six pitch rows asserted) → band change to 3-5-2 with the
  displaced tray → bring-back-on → finisher retag from the sheet
  (aria-pressed round-trip) → crew → lobby → drafted sheet → vote →
  court. Zero console errors, zero horizontal scroll, PASS 17s,
  purge clean. New artifacts: create-chooser, shape-sheet,
  pitch-diamond.

## O6 — 2026-08-11 — ship: DONE. **GOAL REACHED.**

- check green before every commit (139 files / 1,493 tests at ship;
  sole eslint warning pre-existing in draw/ClearanceMeter.tsx).
- Push cb0f878; CI deploy + Check workflows both success. NO backend
  deploy (none needed — STOP condition never tripped).
- Deploy verified by chunk content (entry-hash rule honored):
  BudgetSquadScreen-CorVYChc.js carries 4-1-2-1-2 / 4-2-3-1 / 5-2-3 /
  "Your shape & finishers" / shape-label; index CSS carries
  weekend-sheet-in and --neo-shadow-color:0 0% 0% inside
  .theme-weekend.
- Live 380px walkthrough on verveq.com: visible bottom nav
  rgb(18,18,18) border-top 0 on BOTH /v2/weekend and /compete; hub
  door shadow rgb(0,0,0) 6px offset; setup chooser 15 chips +
  finisher section; picked 4-2-3-1 → SHAPE — 4-2-3-1 with pitch rows
  [1,4,2,3,1]; sheet opens from the label; zero console errors, zero
  horizontal overflow on every screen.
- QA footprint on prod: guest `fwpolish2_qa`, empty 4-2-3-1 squad
  (no picks) — same benign-artifact convention as fwpolish_qa.
- Parked: none.

# MISSION FW-EXPAND — three new leagues, opening-weekend perfect (2026-08-12)

Scope: universe 5 → 8 leagues (Eredivisie, Liga Portugal, EFL
Championship), cohort-priced per R1, transfer-current per R2, copy/spec
amendments per R3, R4 invariance asserted, plus U1 matchup line, U2
back-nav fix, U3 How to Play. Prod deploy authorized for the ship phase.

## O1 — 2026-08-12 — league resolution + DEV bootstrap: DONE

- League ids resolved FROM THE FEED (never memory), 4 calls on the
  research ledger (1 refused: the feed rejects search+country combined;
  3 country listings): Eredivisie=88, Primeira Liga=94, Championship=40,
  all with 2026 current. Resolver: fetch/resolveExpansionLeagues.ts,
  fail-closed (exactly one survivor per league or STOP); artifact
  data/expansion-leagues-2026.json.
- LEAGUE_IDS widened to 8 (fantasyConstants.ts, provenance comment),
  display names added (leagueNames.ts — the Record<LeagueId,string>
  type made the build force this), EXPANSION_LEAGUES added to
  fetch/config.ts SEPARATE from LEAGUES (the FS-1/top-five pulls stay
  scoped; widening LEAGUES would have silently changed their budgets).
- **applyGameweeks re-keyed to WINDOW IDENTITY (finalityAt), not
  ordinal.** The old (season, gwNumber) upsert silently re-purposed
  every later gameweek doc when a new window appeared — and the
  expansion inserts 10 (Championship midweeks + the 88/94 opening
  weekend the feed says was Aug 7-10, BEFORE the mission's Friday
  premise). Squads/scores/claims point at doc ids; identity matching
  keeps each doc bound to its real-world window for life and re-stamps
  the label instead. Pure planner reconcileGameweeks +5 unit tests
  (insertion re-stamp, leagueIds patch, orphan-conflict fail-closed).
  This also fixes a latent bug: a postponement into an empty midweek
  would have corrupted numbering via the quarter-hourly sync.
- bootstrapSeason (8 calls): 2,916 fixtures — 39:380, 140:380, 135:380,
  78:306, 61:306, 88:306, 94:306, 40:552; 1,164 created (=new leagues'
  total exactly), 10 gameweeks created, 60 total, 50 re-stamped with
  identity verified (50/50 kept finalityAt; diff in scratchpad).
- Partition assertion: gameweekAudit over ALL 60 gameweeks —
  outOfWindowCount=0 and finalityMatchesWindow=true everywhere; every
  fixture (old and new) is in exactly one window.
- Pre-coverage GW1 (88/94, Aug 7-10, finished before coverage began):
  the settle cron marked it final on its own tick — 18 fixtures
  unscored at the cut is the truthful record for a window with no
  squads; scoring correctly skips settled gameweeks.
- Open board verified: GW2 = weekend 2026-08-14→17, SAME doc id as
  before the expansion (existing squads unaffected), getWeekendLeagues
  = Championship 12 + Eredivisie 9 + Liga Portugal 9 + La Liga 6.
- bootstrapPlayers scoped by new leagueIds arg (unknown ids refused;
  full-universe re-runs would fight the transfer pipeline's
  active/departed ownership): 60 clubs (40:24, 88:18, 94:18), 1,772
  created, 0 skipped-no-position, prices null (fail-closed unbuyable
  until O2 prices them). 8 UPDATED rows = players the universe already
  knew now at new-league clubs — flagged for the O3 R2 pass
  (departedAt not cleared by applyClubPlayers; price is stale top-five).
- API spend day total: 4 (ledgered, research) + 8 + 65 (FW-2 client) =
  77 mission calls; key reported dailyRemaining 6,507 after (shared
  with standing crons). No phase projected anywhere near 1,500.

## O2 — 2026-08-12 — aggregates + R1 cohort pricing: DONE

- Universe snapshot: 1,780 expansion rows exported from DEV (Championship
  745, Eredivisie 526, Primeira 509) — 1,772 O1-created + 8 pre-existing
  players now at expansion clubs (7 with stale departedAt → O3's R2 pass).
- Aggregates pull (pull-expansion-aggregates.ts): plan printed, worst case
  375 vs STOP 1,500; spent 192 = 123 player pages (88:39, 94:36, 40:48) +
  66 team-stat pairs + 3 current-club lists; 2,440 rows. +4 probe calls
  (2025-26 Primeira membership + two team-stat probes) + 1 addendum save.
- TWO FEED QUIRKS, both resolved fail-closed, no invention:
  (a) promotion/relegation PLAYOFF entries tagged with the destination
  league id on non-member clubs (Roda/Waalwijk/Almere/Den Bosch under 88,
  Torreense under 94; team figures empty). Scope rule: cohort admission
  and lines use only entries at clubs with 2025-26 season figures —
  playoff-only players flag with their own reason string.
  (b) provider id-duplication: Estrela's full Primeira season rides rows
  as team 28053 ("Estrela Calheta") while membership + figures live under
  15130 ("Estrela") — verified by probes (28053 played=0, 15130 played=34,
  rows hold exactly 18 full club-seasons). Alias 28053|94→15130|94 with
  the evidence in the addendum manifest and proxy-expansion.ts.
- proxy-expansion.ts: same engine-driven method as proxy.ts (v0.5.1
  scorePlayer, probes, minutes-weighted club expectations, 900' shrinkage
  toward OWN-LEAGUE pool medians). Partition assertion extended per R1:
  eredivisie 318 + ligaportugal 329 + championship 404 + flagged 729 =
  1,780 exact, per-league splits asserted, team-figure gap 0.
- price-expansion.ts: band 4.0–7.5, price = min(7.5 − 0.5·round(7·q),
  ceiling[pos]) per the promoted method — GK 6.0 ceiling bites exactly as
  the promoted precedent; flagged at 4.0 (this includes relegated-in
  top-five players: cross-league minutes are banned signal, the owner
  re-prices names via overrides.json → EXPANSION_REVIEW.md documents the
  path). Gates: partition 1,780, on-scale, band top, monotonicity per
  pool|position. overrides.json applied last (0 match the expansion).
- pricing/EXPANSION_REVIEW.md: top 20 per league (proxy + minutes +
  price), full price distributions, 10 most prominent flagged per league.
- Tie ladder: DraftPool + fantasyDraftPoolMeta.pool + poolMetaValidator
  widened — topfive > promoted > eredivisie > ligaportugal > championship
  > flagged (expansion cohorts between promoted and flagged; order only
  ever decides a price-AND-proxy tie). Missing-row sentinel 3→6.
- Seed: seedExpansionPrices.ts (DEV-pinned sibling of seedFantasyPrices,
  guardTarget, 8 chunks) — 1,774 updated + 6 unchanged, 0 missing;
  histogram 7.5:72 7.0:138 6.5:135 6.0:177 5.5:152 5.0:147 4.5:150
  4.0:809. --verify: every expansion price equals the artifact, 0
  non-price field diffs vs the pre-pricing snapshot. push-expansion-pool:
  1,772 created + 8 updated (the moved players re-labeled), every row
  carries a real clubName (U1 depends on it).
- API spend O2: 197 calls total; check green (1,498).

## O3 — 2026-08-12 — transfer sweep extension + backfill + R2: DONE

- Club set: NO code change needed — the sweep derives coverage from
  fantasyFixtures, so O1's bootstrap widened it to 156 clubs by itself.
  Spend comments/plans recomputed (crons.ts, client, sweep docstrings):
  sync 8×96 ≈ 768/day, transfer ~156+/day, scoring unchanged.
- Backfill since 2026-07-01 over all 156 clubs: plan printed (156 base +
  retry 6 + phase-2 10, ceiling 500), 168 calls. 1,496 in-window records:
  internal 70, incoming-known 151, incoming-new 0 (+3 created via retry),
  outgoing 297, unresolved 7 new, already-seen 971 (the whole pre-
  expansion ledger intact). FW-T1b retry resolved 4 of the 8 standing
  unresolved. STOP-AND-REPORT: 12 position-less mentions → standing
  unresolved now 11, all 'position unavailable from feed' (owner review).
- R2 reactivation pass (fantasyTransfers:reactivationPass, zero API
  calls, new): stored "outgoing" rows whose destination is now covered
  reclassify in place (reclassifiedFrom:"outgoing" audit field added to
  schema; resolvedAt stamped), with the retry pass's out-of-order guard
  and a CORROBORATION gate — the player's current club row must equal the
  event destination (the Aug-12 squad bootstrap is fresher than any July
  record; contradicting it would reactivate ghosts). Results: 65
  candidates → 39 reactivated (ledger now says internal/incoming_known),
  24 superseded (later applied move won), 2 fail-closed and reported
  (M. Payero → 38: no player row, destination squad does not list him;
  G. Kamara → 72: moved on since). Second run: 0 writes.
- NEAR-MISS worth recording: the first deployed draft of the pass
  reported "0 candidates" because listOutgoingEvents omitted the
  classification field the pure predicate checks — `npm run check`'s tsc
  caught it (convex dev had pushed it functionally). Tests-green-every-
  commit is not a formality.
- departedAt hygiene: applyClubPlayers now clears departedAt whenever it
  reactivates (both branches — the schema's contract), and a one-shot
  repairActiveDepartedAt cleared the 7 stale rows O1 flagged (Imray,
  Gauci, Traoré, Zemura, Ravaglia, Machine, Raghouber). Export-verified:
  0 active-with-departedAt rows; second run repairs nothing.
- reactivationCandidate is a pure rule in fantasyTransferRules.ts with 5
  new tests (30 pass in the suite; full check 1,503).
- API spend O3: 168 + 166 (second-run proof) = 334 calls. Day total at
  close: key reports ~6,005 remaining of 7,500 (all consumers combined).

## O4 — 2026-08-12 — R3 copy + spec amendments + R4 invariance: DONE

- Copy: the five-league claim is dead in app/src. "Eight leagues, one
  squad" is the framing on all three surfaces the ruling names — home
  card first bullet (was "All five top leagues, one squad"; snapshot
  re-pinned), compete hero sub, hub subtitle (both replaced "Draft the
  whole European football weekend."). No locale files carry weekend.*
  keys, so defaultValue renders everywhere. Code comments swept:
  fantasyDraftEngine, gameweek test name (fantasyIngest done in O1).
- Specs: DRAFT_ROOM v1.3.1 → v1.4.0 (minor — a rule statement changed):
  pool row "all 8 leagues", pool-note count amended with provenance,
  §auto-pick ladder now names the six-rung pool priority; changelog
  cites FW-EXPAND 2026-08-02. SCORING_SPEC v0.5.1 → v0.5.2 (doc-only):
  principles 3+4 annotated that their top-five measurement basis is
  deliberately NOT re-derived — league-blind engine, zero value
  changes; freeze restated. SCORING_SPEC_VERSION constant bumped with
  the doc (the 0.5.0→0.5.1 editorial precedent; write-only provenance
  stamp, no rescore trigger — verified sole consumer). BUDGET_MODE
  asserts no league universe (checked — its pool statements are
  eligibility-only); CROWD_VOTING's never-cross-league rule unaffected.
- R4: fantasyExpansionInvariance.test.ts pins with literals — budget
  91.0, price scale 4.0/13.0/0.5, club cap 3 + favorite cooldown 28d,
  squad 13=11+2, formation bounds, crew 2-8, finality 23:59 Paris, all
  ten scoring caps, crowd clamp 0.15, court params (filings 2,
  endorsement 15/0.5%, quorum 30/1%, pass 60%), and the engine's
  per-position context values recovered by live probes (GK 5/1/0.5/-1,
  DEF 4/1/0.5/-1, MID 1/1/0.5/0, ATT 0/1/0.5/0). The one deliberate
  change is pinned too: LEAGUE_IDS === exactly the eight. 8 tests.
- Scoring engine: ZERO changes (R4 holds by test, not assumption).
- Check green: 140 files / 1,511 tests.

## O5 — 2026-08-12 — U1 matchup line + U2 back-nav + U3 How to Play: DONE

- U1: getMarket's per-club earliest-kickoff reduce now carries the whole
  matchup (opponentClubId + isHome) off the same fixture row the lock
  rule uses — earliest fixture governs when a window holds two. Opponent
  names resolve server-side by inverting the per-player pool-meta labels
  into a clubId→name map (no schema change; the schema deliberately has
  no clubs table, and TLA codes are not in the feed's ingested shape, so
  the line reads "Getafe · vs Sevilla (H)" with the feed's short display
  names — nothing invented). Picker club line renders " · vs X (H|A)";
  NO FIXTURE rows get null opponent and keep the badge, unchanged.
- U2 root cause, confirmed as the map predicted: four door screens
  (squad, vote, court, crews) hardcoded onBack → SHELL_ROUTES.compete,
  skipping the hub they were entered from — while the crew subtree
  already parent-chained correctly. Fix: those four point at
  SHELL_ROUTES.weekend; the hub keeps /compete (its true parent).
- U3: WeekendHowToPlayScreen at /v2/weekend/how-to-play (ShellGate only,
  public like the hub), linked from a headerRight "?" (HelpCircle, neo
  chrome) on the hub. Content STRICTLY from the specs — budget 91.0,
  prices 4.0–13.0 halves, 13=XI+2, structural shape rule, club cap 3 +
  favorite (28d cooldown), per-fixture locks + no-hindsight, appearance
  +1, goals +5..+8 / assists +3..+6 inverted by depth, win +1 / draw
  +0.5 at 60', clean sheets 5/4/1, −1 per 2 conceded, cards −1/−4
  (−6 second yellow), caps + the two ramps (up to +2), fielded-slot
  templates + ×0.75 positive-only dampener, finisher entry-minute
  scoring + ×1.25 after 75', crowd ±15% with liquidity floor, court
  (2 filings, filing = first endorsement, max(15, 0.5%) threshold,
  max(30, 1%) quorum, 60% share, Monday 23:59 close, Tuesday-evening
  verdicts), crew tie ladder, finality 23:59 Paris day-after. Dark
  WEEKEND theme, Neo cards, mono eyebrows, mobile-first.
- e2e: weekendMobile loop extends — U1 matchup regex on the GK picker's
  first row, U2 ladder (court→hub, squad→hub, crews→hub, hub→compete),
  U3 "?"→rules screen (sections asserted, no horizontal scroll,
  screenshot)→back→hub. PASS 19.6s, zero console errors. Check green
  (1,511).

## O6 — 2026-08-12 — full DEV QA at 380px: DONE

- New committed spec e2e/expansionQa.spec.ts, WINDOW-AGNOSTIC by design:
  it asks the deployment what the open window holds (getWeekendLeagues +
  getMarket, leagueId added to the market projection — read-only) and
  asserts against that, so it survives any future window shape.
- The open window (GW2, Fri 2026-08-14 → Mon 17) holds 4 of the 8
  leagues: Championship 12 + Eredivisie 9 + Liga Portugal 9 + La Liga 6.
  The mission's 8-league-squad gate therefore takes its stated fallback:
  every seeded league visible in the picker, one pick from EACH
  in-window league.
- PASS (8.8s): hub line reads exactly "This weekend: Championship +
  Eredivisie + Liga Portugal + La Liga" (server order); all 8 flagship
  clubs present under Show all (Arsenal/Barcelona/Juventus/Dortmund/
  Marseille/Ajax/Benfica/Wrexham); U1 matchup line asserted on a
  PLAYING club per in-window league (flagships can rest — Barcelona
  does, staggered opening round; the spec derives a playing club from
  market data instead of assuming); No fixture badge asserted for
  out-of-window leagues; 4 picks made, one per in-window league, chip
  states confirmed; zero horizontal scroll; zero console errors.
- Screenshot evidence: expansion-hub-380, expansion-picker-380 (Sevilla
  rows all reading "Sevilla · vs Rayo Vallecano (H)"), expansion-pitch-
  380. weekendMobile full loop re-run green alongside (17.5s) — its U2
  back-ladder and U3 How to Play assertions are the O5 gate re-proven.
- QA footprint purged via the standing purgeUiRun convention.
- Check green (1,511). ENOBUFS footnote: getMarket's 4.7k-row payload
  needs maxBuffer on the spec's convexRun helper.

## O7 — 2026-08-12 — SHIP: DONE. **GOAL REACHED.**

- Order per FW-POLISH precedent: backend deploy FIRST (npx convex deploy
  → different-lynx-153, clean tree at 73a9a5a, ~18:58 UTC), then data
  import, then master push (CI deploy 44s success, Check 1m54s success).
- Prod pre-deploy baseline snapshotted (2,958 players all priced, 4 real
  squads, 50 gameweeks, 1,752 fixtures, 971 events, 0 expansion rows).
- bootstrapSeason --prod: byte-identical to DEV (2,916 fixtures, 1,164
  created, 10 windows inserted at the same ordinals, 50 re-stamped).
  Identity diff: 50/50 kept finalityAt; the open board doc unchanged
  (real squads unaffected, label 1 → 2). gameweekAudit over ALL 60:
  clean (0 out-of-window, finality matches everywhere).
- bootstrapPlayers --prod (88/94/40): 60 clubs, 1,773 created + 9
  updated = 1,782 — the feed moved between the morning DEV pull and the
  prod run. FEED-DRIFT LEDGER, each item accounted:
  (a) Y. Hirakawa + D. Ballard (Bristol City, new squad listings) and
  G. Kamara (QPR — O3's DEV straggler, corroborated on prod): priced
  4.0 / pool flagged per the standing newcomer rule. NOTE FOR OWNER:
  Hirakawa has 855 real league-40 minutes in the aggregates — a cohort
  price awaits an overrides.json entry (EXPANSION_REVIEW path);
  quantile re-ranking for one player would have churned 404 prices.
  (b) I. Bowat (priced 7.0 in the artifact) is no longer in Portsmouth's
  squad — absent on prod, nothing to price; both import gates flagged
  him and were overridden by this recorded accounting, not by code.
  (c) 6 position drifts (feed corrections since morning) — prices stand
  per BUDGET_MODE's static-within-gameweek + weekly-repricing doctrine.
- Prices: seedExpansionPrices --live (two-signal guard: --live +
  CONFIRM_LIVE_DEPLOY) — 1,773 updated + 6 unchanged, 1 missing =
  Bowat. --verify: 1,779/1,780 artifact prices byte-exact, all
  deviations the accounted set above. push-expansion-pool --live:
  1,779 rows + 3 manual = every expansion row carries pool + clubName.
- Transfers on prod: backfill 168 calls (plan-gated), 1,496 in-window
  records — 971 already-seen (the old ledger intact), 221 moves
  applied, 12 position-less STOP-AND-REPORTED (same names as DEV).
  reactivationPass: 65 candidates → 40 reactivated (Kamara included —
  prod corroborates him), 24 superseded, 1 fail-closed (Payero),
  0 departedAt repairs (the prevention fix shipped in this deploy).
  Second runs: backfill 1,496/1,496 already-seen, reactivation 0
  writes. Zero-op proven on prod.
- Final data verification (FW-SHIP P2 discipline): 4,734 players, ZERO
  unpriced anywhere, zero dangling refs (fixtures/poolMeta/slots/
  squads), expansion partition exact (318 eredivisie + 329 ligaportugal
  + 403 championship + 732 flagged = 1,782, all with pool meta), 60
  unique-ordinal gameweeks, 0 active-with-departedAt, every player in
  exactly the 8 covered leagues.
- Deploy verified by chunk content (entry-hash rule honored):
  WeekendHowToPlayScreen chunk live with the spec copy,
  BudgetSquadScreen chunk carries the matchup render, hub chunk carries
  "Eight leagues, one squad".
- LIVE 380px walkthrough on verveq.com, all green: home bullet; hub
  line EXACTLY "This weekend: Championship + Eredivisie + Liga
  Portugal + La Liga"; hub subtitle + "?" affordance; How to Play live
  (scoring + court sections), back → hub; back ladder squad/court/
  crews → hub → compete; expansion players PICKABLE with matchup
  lines — "Ajax · vs Heerenveen (H)", "Benfica · vs Casa Pia (A)",
  "Wrexham · vs Cardiff (A)"; zero console errors; zero horizontal
  overflow. (One walkthrough FAIL was the script visiting the court
  before onboarding — the username gate, not a product bug; re-run
  with a session passed.)
- QA footprint on prod: guests fwexpand_qa/2/3/4, empty squads, no
  picks — the standing benign-artifact convention.
- API spend O7: 8 + 65 + 3-row patches (0) + 168 + 166 = 407 calls;
  key reported 5,547 remaining at close (all consumers, shared key).
- Standing cron spend from tomorrow: sync ~768/day + transfers
  ~156+/day + scoring per due fixtures, per deployment.
