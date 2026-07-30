# Weekend Fantasy — Budget Mode Spec (v1.1.1)

Status: **v1.1.1 — LOCKED by owner 2026-07-29 (squad budget set at
91.0).** Founding ruling LOCKED: **fresh squad weekly**. The budget is
now a real number, not a placeholder; the price tick remains pending
FS-1 calibration. The *rules* below are settled and change by owner
ticket only — this amendment was itself an owner ticket (FW-PR3).

## Changelog

- v1.1.1 — doc-only patch: open item 1 now names the constant as it
  shipped — `SQUAD_BUDGET = 91.0` in `app/convex/lib/fantasyConstants.ts`
  (commit 4ff2a28) — instead of the pre-pricing placeholder name, which
  no longer exists in code. No rule changes.
- v1.1.0 — **squad budget set: 91.0** (FW-PR3, owner ruling
  2026-07-29). Open item 1's budget half is closed and the §Squad
  construction row moves from "principle LOCKED, number pending" to
  LOCKED. Basis and what the number buys: §Budget. The price tick
  stays open.
- v1.0.1 — the swap-in ban graduated from implementation to spec
  (FW-1 closeout ruling 3): a player whose own fixture has kicked off
  cannot be swapped IN, preventing hindsight selection. The lock rule
  previously stated only that a locked player could not be swapped
  OUT, leaving the symmetric case to implementers. §Deadlines &
  editing.
- v1.0 — header/status corrected from the stale "v0.1 draft for owner
  red-pen" download (FW-1 Phase 0, STOP-1 ruling 2026-07-28), and
  three FW-1 rulings recorded in the text:
  - **STOP-2** — "any standard shape" is now a structural rule, not an
    unwritten enumeration (§Squad construction).
  - **STOP-5** — finality restated as **Tuesday 23:59 Europe/Paris**
    wall clock; "CET" was imprecise and a fixed UTC+1 would drift an
    hour against users' local Tuesday for most of a season (CEST).
  - Open item 2 (private boards at launch) resolved CONFIRMED.

## Founding shape (LOCKED)

Every gameweek, every user builds a new 13 from scratch under budget.
No squad persistence, no transfers, no transfer economy, no chips,
no wildcards — none of that layer exists, deliberately. The product
is the *weekend*: build Thursday, watch it resolve, settled Tuesday
23:59 Europe/Paris (finality cut, LOCKED), fresh board Friday.

What dies with squad persistence (each a removed FPL complaint):
- The 38-week grind and the "my season's dead by October" dropout
- Transfer-hit math and hoarded free transfers
- Price-change casino (already locked out) loses its last reason to
  exist — prices only matter at build time
- Returning after skipped weeks carries zero penalty — lapse-proof
  by design

Season-scale competition comes from the **cumulative table** (sum of
weekend scores) and weekend-win streaks, not from roster continuity.
Same principle as the draft-mode crew table: season-emergent, not
season-burdened.

## Squad construction

| Rule | Value | Status |
|---|---|---|
| Squad | 13: XI + 2 finishers | LOCKED |
| Formation | any shape satisfying the structural rule below, user-chosen | LOCKED |
| Position quotas at build | none — all-positions-eligible; mismatch rule prices the risk | LOCKED |
| Per-club cap | 3, favorite-club exempt (4-GW change cooldown) | LOCKED |
| Budget | **91.0** for the 13 slots — see §Budget | LOCKED |
| Price tick | pending pricing pass | open |
| Prices | editorial (v5-scale derived), identical for all users, static within a gameweek, repriced weekly by editorial review | LOCKED |

**Formation structural rule (LOCKED, FW-1 STOP-2 ruling 2026-07-28).**
A legal XI is exactly:

| Line | Count |
|---|---|
| GK | exactly 1 |
| DEF | 3–5 |
| MID | 2–5 |
| ATT | 1–3 |
| **Total** | **11** |

A structural rule rather than an enumerated list of named shapes: it
admits every formation a normal person would name (4-4-2, 4-3-3,
3-5-2, 5-3-2, 4-5-1, 3-4-3, …) and excludes nonsense, without the
spec having to maintain a catalogue.

The **2 finisher slots carry their own slotRole** (GK/DEF/MID/ATT),
chosen freely and unconstrained by the XI's shape — consistent with
all-positions-eligible. The structural rule governs the XI only.
(FW-1 STOP-3 ruling 2026-07-28.)

## Budget (LOCKED, FW-PR3 owner ruling 2026-07-29)

**91.0** for all 13 slots. Prices are `pricing/price-final.json` on the
4.0–13.0 scale in 0.5 steps; the budget is in the same units, so a
squad is legal on cost when its 13 prices sum to 91.0 or less.

**Basis: `pricing/BUDGET_ANALYSIS.md` (commit 114133d).** What 91.0
buys, against the archetypes costed there:

| Shape | Cost | Under 91.0? |
|---|---|---|
| Cheapest legal squad | 52.0 | yes — 39.0 of headroom |
| Three elites + near-floor fill | 78.5 | yes — 12.5 of slack |
| Two elites + ~5.9-average fill | 91.0 | yes — exactly at the line |
| Two elites + best value fill | 97.0 | **no** |
| Balanced, nobody above 9.0 | 113.5 | **no** |
| Max-stars | 138.0 | **no** |

So the number buys a real choice rather than one dominant build: two
elite names carried by a 5.9-average supporting eleven, or three elites
paid for by filling near the floor. It does not buy the all-9.0
balanced squad, and max-stars is out of reach by 47.0 — which is the
"top-priced XI exceeds budget by a wide margin" calibration principle
this row has carried since v1.0, now satisfied by a measured margin
instead of an intention.

**The open-position ceiling needs no budget handling** (owner ruling,
FW-PR2 closeout). Position quotas at build are none, so the dearest
FW-1-legal 13 ignores position entirely and costs 146.0 — nine MID and
four ATT, no keeper, no defenders. That is not a hole in the budget: it
is what §Position mismatch is for. Every one of those players is
fielded outside his verdict position and scores through the fielded
slot's template **×0.75**, so the shape taxes itself. Pricing the risk
rather than forbidding the shape is the standing rule here
(§Squad construction, "all-positions-eligible; mismatch rule prices the
risk"), and the budget does not duplicate it.

## Deadlines & editing (per-fixture locks, LOCKED)

- Each player locks individually at his fixture's kickoff.
- Until his lock: he can be swapped out, moved between XI/finisher,
  re-slotted, or repositioned — freely.
- After his lock: that slot is frozen (player, slot, position) and
  his cost is committed.
- A player whose own fixture has kicked off cannot be swapped IN
  (prevents hindsight selection).
- Budget invariant holds at every edit: committed (locked) cost +
  current unlocked selections ≤ budget. Editing Sunday around a
  locked Saturday is the intended skill.
- Unfilled slots at their last possible lock simply score zero —
  no auto-fill in budget mode (unlike draft's default sheet; here
  absence is the user's own loss only, no crew to protect).

## Scoring

SCORING_SPEC v0.4.1 verbatim: templates by fielded slot, mismatch
dampener, finisher decisive-moment multiplier, crowd multiplier with
sign mirror, DNP = 0, no autosubs, no captaincy.

## Competition surfaces

1. **Weekend leaderboard** — global, per gameweek, settles Tuesday.
2. **Cumulative table** — season-running sum; skipped weekends score
   0 but never eliminate (lapse-proof principle).
3. **Percentile + ShareCard** — "top 4% of GW3" is the share loop.
4. **Private boards** — code-joined leaderboard filter over the same
   scores (no separate game state; a lens, not a mode). Cheap to
   ship, high retention value. RECOMMENDED at launch — owner may
   veto for scope.

## Interaction with draft mode

Same engine, same locks, same finality, same favorite-club profile
field. A user's budget squad and draft-crew squads are independent
rosters scored by the same pipeline. Nothing in either mode's state
references the other.

## Open items

1. ~~Budget number~~ — **RESOLVED: 91.0** by owner 2026-07-29
   (FW-PR3). See §Budget. The pricing pass has priced the full pool
   (`pricing/price-final.json`, 2,895 players); in code the constant
   is `SQUAD_BUDGET = 91.0` in `app/convex/lib/fantasyConstants.ts`
   (wired in commit 4ff2a28), exactly the single-constant swap FW-1
   STOP-4 designed for. **Price tick — still open**, pending FS-1
   calibration. The fail-closed rule is permanent and not
   contingent on that: an unpriced player is **rejected** from a budget
   squad, whatever the tick turns out to be (FW-1 STOP-4 ruling
   2026-07-28).
2. ~~Private boards at launch~~ — **CONFIRMED at launch** by owner
   2026-07-28. Ships as a leaderboard lens over the same scores, not a
   separate game state.
3. Build-phase nudge when a selected player's fixture is soon —
   UX-phase detail, parked.
