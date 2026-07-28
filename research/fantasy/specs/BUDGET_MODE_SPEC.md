# Weekend Fantasy — Budget Mode Spec (v1.0.1)

Status: **v1.0.1 — LOCKED by owner 2026-07-28 (private boards at
launch confirmed).** Founding ruling LOCKED: **fresh squad weekly**.
Constants are placeholders pending the pricing pass and FS-1
calibration; the *rules* below are settled and change by owner ticket
only.

## Changelog

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
| Budget | set after pricing pass; calibrated so the top-priced XI exceeds budget by a wide margin | principle LOCKED, number pending |
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

1. Budget number + price tick — after the pricing pass prices the
   full pool (owner sign-off on the curve). FW-1 carries a placeholder
   constant (`PLACEHOLDER_PENDING_PRICING_PASS = 100.0`) so the budget
   invariant is implemented and tested; the real number replaces the
   constant with no code change. Until pricing lands, an unpriced
   player is **rejected** from a budget squad (fail closed — the mode
   cannot launch unpriced). FW-1 STOP-4 ruling 2026-07-28.
2. ~~Private boards at launch~~ — **CONFIRMED at launch** by owner
   2026-07-28. Ships as a leaderboard lens over the same scores, not a
   separate game state.
3. Build-phase nudge when a selected player's fixture is soon —
   UX-phase detail, parked.
