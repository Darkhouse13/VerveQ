# THE WEEKEND — Launch Readiness (FW-LAUNCH, 2026-07-30)

Launch-candidate state of the 5-league weekend fantasy mode on DEV
(`admired-warthog-495`), targeting the Aug 28–30 2026 gameweek. Prod
deploy is the owner's manual step and is NOT done; see §Prod-deploy
checklist. Mission commits: `136c658..83786e1` (six commits, all on
master, all green through `npm run check`).

> **UPDATE (owner ruling 2026-08-01, recorded FW-POLISH 2026-08-11):**
> the Aug 28–30 target above is historical. THE WEEKEND is live NOW
> (FW-SHIP, §FW-SHIP below); the first playable gameweek is whichever
> window first has any top-five fixture, and partial gameweeks (1–2
> leagues playing) are the normal state for the early season. The hub
> targets the earliest open window by itself — nothing keys off a
> launch date.

## Objective status

| Objective | Status | Evidence |
|---|---|---|
| O1 budget mode build UI | **DONE** | 136c658, 2849e0d; DEV walkthrough `fantasyBudgetSim:simulateBudgetBuild` PASS (over-budget + over-cap rejected server-side, legal 13 at 52.0, swap, purge clean ×2) |
| O2 crowd voting | **DONE** | 7cc6555; DEV walkthrough `fantasyCrowdSim:simulateCrowdWalkthrough` PASS (139 votes, 8 factor versions at ±15%, prior versions readable, refusals, settled immune, purge clean) |
| O3 reclamation court | **DONE** | 46fe73a; DEV walkthrough `fantasyCourtSim:simulateCourtWalkthrough` PASS (rate limit, merge, exclusions, verdict 28–3, re-score with prior readable, revision keeps ruling, post-finality refused, settled immune, purge clean) |
| O4 tie-break ladders | **DONE** | 94e4342; `getCrewTable` serves `tieBreaksApplied: true`; 11 pure rung tests + 2 integration scenarios |
| O5 integration pass | **DONE** | 83786e1; `fantasyIntegrationSim:simulateWeekendLoop` PASS (whole loop, both modes, one gameweek); Playwright mobile E2E PASS (screenshots in `app/e2e/artifacts/`) |
| O6 readiness package | **DONE** | this file + `BLIND_VERIFY_PACKAGE.md` |

## Test totals

- `npm run check`: **132 files / 1,346 tests**, green (baseline at
  mission start: 129 / 1,312; +34 tests, +3 files: crowd rules, court
  rules, tie-breaks, budget UI contract).
- Five scripted DEV walkthroughs (four Convex sims + one Playwright
  mobile E2E), all PASS, all purge-clean. The E2E
  (`npx playwright test` from `app/`) is on-demand, not part of
  `check`: it boots the real app against DEV and purges its writes.

## Parked decisions (DECISIONS_NEEDED.md)

1. **OWNER DECISION 1 — "gameweek active users"** (court thresholds).
   Spec sets max(15, 0.5%·actives) / max(30, 1%·actives) without
   defining actives. Implemented as distinct squad-holding users; the
   floors dominate under any reading until ~3,000 actives.

That is the only parked decision. No spec was amended.

## Spec-sync notes for the owner's ticket (no action taken)

- DRAFT_ROOM §Explicitly deferred: the tie-break ladders are now
  BUILT (O4) — the deferred note is stale. Also, that bullet's
  parenthetical paraphrases the ladder in a different order than
  ledger item 5 and §Tie-breaks (which agree and were followed).
- RECLAMATION_COURT: two readings taken and documented in code, both
  judged within the spec's language: a duplicate filing merges as an
  endorsement and does not consume a filing slot; the filer counts as
  the first endorsement.
- The mission brief's aside that a court re-score is "a re-read, not
  a re-computation" is inaccurate at the implementation level: the
  mismatch dampener is baked into the stored 4×2 grid, so a verdict
  change re-runs `scoreAllContexts` from the stored raw stat revision
  (same engine, new version, no number mutated).
- BUDGET_MODE §Competition surfaces (weekend leaderboard, cumulative
  table, percentile + ShareCard, private boards) and CROWD_VOTING's
  rater leaderboard/streaks/ShareCard are in the specs but in no
  mission objective — see §Known gaps.

## API spend vs ledger

- **Mission spend: 0 calls.** Every walkthrough runs on synthetic
  fixtures or reads DEV rows FW-2 already ingested; no live pull was
  planned or made, so no call plan was printed.
- The standing FW-2/FW-4 crons continue their measured ~480/day sync
  cadence against the 7,500/day cap, unchanged by this mission.

## Known gaps and UX wrinkles

Launch-scope gaps (spec'd, not in any mission objective):
- No weekend leaderboard / cumulative table / percentile ShareCard /
  private boards for budget mode (§Competition surfaces). Budget
  players see their own squad + score only.
- No rater-rating leaderboard/streak/ShareCard surfaces; accuracy is
  computed and stored (the court consumes it).
- No per-event score ledger surface anywhere (SCORING_SPEC principle
  2's "reconstruct from the match ledger" has no UI); "insufficient
  votes" therefore surfaces on the squad slot rows, not a ledger.

Wrinkles:
- **Entry points**: every weekend route is deliberately UNLINKED
  (`/v2/weekend/{crews,squad,vote,court}` + `crew/:code`,
  `draft/:roomId`, `sheet/:roomId` — the sheet is linked from the
  completed draft room only). Launch needs nav tiles/links; placement
  is a product call.
- **Analytics**: zero `track()` events on any weekend surface (draft
  rooms included — pre-existing). If instrumented later, follow
  ANALYTICS.md; also `scrubPath` does not scrub
  `/v2/weekend/crew/:code`, `/draft/:roomId` or `/sheet/:roomId`
  from `$pageview` URLs (pre-existing for the first two).
- **i18n**: weekend strings are inline `defaultValue`s only (house
  pattern for these screens); dev console warns about missing keys.
- Formation changes beyond XI↔finisher swaps are expressed as
  per-slot role edits (legal-state-to-legal-state); there is no bulk
  "switch to 3-5-2" affordance.
- The picker's "affordable only" toggle and position default make the
  common path short, but there is no price-sort toggle.
- The crowd voting stack serves pairs eagerly: a served-then-abandoned
  pair still counts against the 300 cap (spec: the cap is on serves).

## Prod-deploy checklist (the owner's manual steps)

1. **Backend deploy** (`npx convex deploy` — owner only). Ships: the
   three crowd tables + three court tables (additive), fantasyMarket,
   fantasyCrowdVoting, fantasyCourt, fantasyIntegrationSim et al.
   (internal-only sims — runnable solely with deploy credentials;
   destructive sim purges refuse non-synthetic data), `getSquad`'s
   budget breakdown, `getMyCrewSheet`, tie-broken `getCrewTable`, the
   settlement hooks, and the new cron `fantasy-court-resolve`
   (:7/:22/:37/:52 — before the :2-family settle tick by design).
2. **Until that deploy, on prod**: the crew table stays broken (known
   since FW-4) and every new screen fails closed to a quiet "no board
   open" card — the frontend can ship first, and CI will ship it on
   the next master push.
3. **Seed prod prices**: `scripts/seedFantasyPrices.ts` has only run
   on DEV (`guardTarget` blocks live without explicit opt-in). Budget
   mode fail-closes every unpriced player, so an unseeded prod means
   nobody can build a budget squad.
4. **Verify after deploy**: crons list shows `fantasy-court-resolve`;
   `getCrewTable` returns `tieBreaksApplied: true`; the weekend
   routes' gates open (they self-detect the backend).
5. **Constitute the Aug 28–30 gameweek** — FW-2's machinery; confirm
   its `finalityAt` lands Tuesday Sep 1 23:59 Europe/Paris, since
   every court/vote window derives from it.
6. **Link the surfaces** (product call): add the weekend entries to
   the compete grid / home, and extend `scrubPath` if analytics land.
7. Frontend deploy verification: per the house note, verify by
   grepping route chunks (entry hash is stable across
   lazy-chunk-only releases).

## The single most important next step

Deploy the backend to prod and seed prices (steps 1+3): everything
else on this list hangs off that deploy, and both entry modes are
already exercised end-to-end on DEV behind it.

## FW-SHIP — prod bootstrap record (2026-08-11)

Prod (`different-lynx-153`) was found with an EMPTY fantasy data layer at
the FW-SHIP backend deploy, and was bootstrapped by **DEV clone** (owner
ruling, Option A) rather than by fresh FW-2 bootstraps: the six data tables
(fantasyPlayers, fantasyGameweeks, fantasyFixtures, fantasyDraftPoolMeta,
fantasyTransferEvents, fantasyTransferSweeps) were snapshot-exported from
`admired-warthog-495` and imported reference-free (document ids re-minted;
cross-references rewritten by natural key — season/gwNumber, provider
player id, sweep startedAt; verified 0 dangling refs). Verified post-clone:
2,895 prices exactly matching price-final.json, 61 transfer-created players
at 4.0 flagged, 39 departed, 971 transfer events, 50 gameweeks (= DEV).
API_FOOTBALL_KEY was set on prod the same day (copied from DEV; one shared
Pro key, combined cron spend ≈ 1,100/day vs the 7,500 cap).

**The seedFantasyPrices DEV-pin STAYS.** The script must never run on prod
— the clone already carries every price, and `guardTarget()` continues to
block `different-lynx-153` by design.

## FW-T1 — Transfer ingestion: prod runbook (added 2026-08-11)

FW-T1 keeps `fantasyPlayers` club-true through transfer windows:
`fantasyTransferEvents` + `fantasyTransferSweeps` (additive tables),
an owner-invokable backfill, and a daily sweep cron
(`fantasy-transfer-sweep`, 04:40 UTC). Rulings: prices static (a new
player enters at the 4.0 floor, pool "flagged"); existing squads
grandfathered (the club cap binds at mutation time only, against the
pre-edit baseline); unresolvable records are logged, never guessed.

**After the owner's manual backend deploy** (`npx convex deploy`
picks up the two tables, the pipeline, and the cron — the cron
activates automatically with the deploy and needs no separate step),
run the prod backfill once, from `app/` with prod credentials:

    npx convex run fantasyTransfers:backfillTransfers --prod

- **Expected call count**: 96 `/transfers` calls (one per covered
  club) + one `/players/squads` call per destination club that has
  players new to the universe. The DEV backfill on 2026-08-11 cost
  **142 calls** (96 + 46); by late August expect roughly 100–200,
  against the 500-call ceiling the action enforces (it prints the
  plan first and refuses to spend past the ceiling). Well inside the
  7,500/day budget alongside the ~480/day fixture sync.
- **Eyeball in the returned report**:
  - `counts` — DEV 2026-08-11 for scale: 190 internal, 169
    incoming-known, 61 incoming-new, 534 outgoing, 17 unresolved.
  - `unresolved` — the full R3 list. Two kinds: "destination club
    missing" (feed half-records; harmless, nothing was touched) and
    "position unavailable … STOP-AND-REPORT" (a new player the feed
    gave no position for — NOT created, never defaulted; review and
    decide manually).
  - `newPlayers` — every created player with club and the 4.0
    price. All must be price 4.0, pool "flagged".
  - `positionless` — the STOP-AND-REPORT list again, pulled to the
    top so it cannot be missed.
- **Verify idempotence** (optional, ~100 calls): a second run must
  report `alreadySeen == candidates` and every other count 0 — DEV
  second run: 971/971 already-seen, zero applied.
- The daily cron thereafter windows itself from the last successful
  sweep (3-day overlap, overlap is free by record identity) and runs
  year-round — the January window needs no new switch.

## FW-POLISH — prod deploy record (2026-08-11)

Backend deploy #2 to `different-lynx-153` (authorized: owner ruling
2026-08-01, ship phase; clean tree at 74ee46d): the only function change
since FW-SHIP is the read-only presentation query
`fantasyMarket.getWeekendLeagues` (+32 lines, no mutations, no schema).
Deployed BEFORE the frontend push (the hub calls it via useQuery);
verified live: `--prod fantasyMarket:getWeekendLeagues` → GW1, 6
fixtures, league 140. Frontend shipped by CI on the same commit; route
chunks verified by content (theme-weekend, pitch, picker prompts, "No
fixture" all present). Live 380px walkthrough on verveq.com passed:
dark canvas on WEEKEND routes only (#0d0d0d hub vs cream Home), pitch
renders, formation editable live (a real 4-4-2 → 3-5-2 switch), picker
eligible-only default, zero page errors, zero horizontal scroll. One
benign QA artifact remains on prod: guest user `fwpolish_qa` with an
empty 3-5-2 squad (no picks).

## FW-POLISH-2 — prod deploy record (2026-08-11)

Frontend-only ship (formation UX consolidation + dark-canvas glare):
NO backend deploy — the diff touches app/src and app/e2e exclusively.
CI deploy on cb0f878 (deploy + Check workflows green). Verified by
route-chunk content (BudgetSquadScreen chunk carries the R2 catalogue
strings; CSS carries weekend-sheet-in and the near-black
--neo-shadow-color inside .theme-weekend). Live 380px walkthrough on
verveq.com: single chooser on the setup page (15 famous formations +
finishers), 4-2-3-1 renders as pitch rows [1,4,2,3,1], the chooser
sheet opens from the tappable SHAPE label, visible bottom nav is
rgb(18,18,18)/border-0 on WEEKEND and cream routes alike, hub door
shadows cast rgb(0,0,0), zero console errors, zero horizontal
overflow. QA artifact: guest `fwpolish2_qa` with an empty 4-2-3-1
squad (joins fwpolish_qa from FW-POLISH).
