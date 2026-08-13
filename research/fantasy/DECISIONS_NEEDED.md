# FW-LAUNCH — Decisions Needed

Parked decisions for the owner. Numbered, append-only. Each entry:
context (≤5 lines), options, and what was done meanwhile (always the
most restrictive reading that lets work continue, or the slice
skipped entirely).

## OWNER DECISION 1 — "gameweek active users" definition (court thresholds)

RECLAMATION_COURT_SPEC v1.0.1 sets the endorsement threshold at
max(15, 0.5% of gameweek active users) and quorum at max(30, 1%),
but never defines "gameweek active users". Options: (a) distinct
squad-holding users that gameweek (measurable, what I implemented);
(b) users with any fantasy action (votes/filings included); (c) app-
wide weekly actives. Meanwhile: implemented (a) — under ANY reading
the floors dominate until ~3,000 actives, so the choice cannot change
an outcome at launch scale; the max() with a possibly-under-counted
percentage is the restrictive direction.

## OWNER DECISION 2 — ownership display at scale (FW-SCOUT)

The player sheet's "in N% of this gameweek's squads" is computed live by
walking the gameweek's squads (fine at today's tens). Above 2,000 squads
the query returns ownership as ABSENT (hidden, honest) rather than slow
or sampled — the guard constant is OWNERSHIP_MAX_SQUADS in
convex/fantasyPlayerCard.ts. Options at scale: (a) stamped per-player
rollup maintained at lock/settlement (the finalScore precedent — my
recommendation); (b) periodic cached counts table; (c) drop the line.
Meanwhile: live compute under the guard, hidden above it, hidden below
the 10-squad noise floor either way.

## OWNER DECISION 3 — the top-five mapping changed shape (FW-REPRICE)

The mission locked the band ceilings but not the mapping onto them, and R3
says "spread by signal, ceiling reserved for the top". I applied that to the
top-five pool too, not only to the cohorts, so `price = clamp(proxy, 4.0,
ceiling)` is gone and every pool now normalises by its own pool+position
maximum. Forced, not preferred: MEASURED, clamping the availability-weighted
signal directly puts 587/644 top-five DEF, 461/607 MID and 132/143 GK on the
4.0 floor, because a median availability of 0.43 drags the distribution under
the floor — the same flattening R3 forbids, aimed downward, and it makes the
mission's own goal ("a club's clear starter outprices his backups everywhere")
arithmetically impossible. Options: (a) normalise per pool+position, what I
did; (b) keep direct value and accept a mostly-4.0 board; (c) rescale the
signal globally instead of per position. Meanwhile: (a), with every locked
constraint intact and the budget still binding (most expensive legal 13:
141.0 → 143.5 against a 91.0 budget; mean price 4.99 → 5.06).

## OWNER DECISION 4 — R2's three boundaries (FW-REPRICE)

R2 as written ("the player with the most last-season minutes must price >=
every teammate at that position") fails on cases it was plainly not aimed at,
so I gave it three documented boundaries, each found by running it: it
compares within a POOL (a promoted club's squad spans two bands, and ordering
across them is the cross-league comparison the lock forbids — 5 of 12 first-run
inversions were only this); it binds only where the most-played man reached
900' (below that a club has no "clear starter" and the assertion is noise —
2 more); and the exemption margin is 5% on per-90 (below that the proxy cannot
tell two players apart, above it the teammate is genuinely better — the last 5,
at +8.3% to +10.5%). Options: (a) as implemented; (b) a stricter margin, which
would force price to track minutes rather than merit within a club; (c) assert
across pools, which contradicts the locked cohort separation. Meanwhile: (a) —
0 violations, and the Porto case the mission names is asserted, not exempted.

## OWNER DECISION 5 — eight players are in both universe snapshots (FW-REPRICE)

`players-seed-snapshot.json` (2026-07-29) and
`expansion-players-snapshot.json` (2026-08-12) both contain 8 apiFootballIds,
with the SAME convexId — one row, snapshotted twice, and FW-T1 transfer
ingestion moved the player between the two reads (J. Gauci to Oxford,
U. Raghouber to Burnley, and six more). This PREDATES the mission: both
committed price artifacts already listed them at different prices (Raghouber
5.5 core / 4.0 expansion), both seed scripts write the same row, and the two
`--verify` passes therefore contradict each other today. I priced each once,
at his CURRENT club (the newer snapshot), and emitted an identical row into
both files so the 2,895 / 1,780 counts every consumer asserts still hold and
the seeds agree instead of racing. Options: (a) as implemented; (b) shrink the
core artifact to 2,887 and update every hard-coded size; (c) re-export both
snapshots from the live table and regenerate. Meanwhile: (a), with an
assertion that the shared rows are byte-identical across the two artifacts.
Recommend (c) before the next reprice — the snapshots are drifting.

## OWNER DECISION 6 — the prior-season constants (FW-REPRICE)

The mission specified the SHAPE of the under-900' rule but not its numbers:
"a real body of work" and "a stated discount" are mine to state. I used
1,800' (20 full matches) and 0.85, with availability the mean of the two
seasons. 1,800 is deliberately above the 900' thinness bar — the restrictive
reading, lifting fewer players off a low price on a two-year-old season. 135
players are priced off 2024-25. Options: a lower bar (more returning starters
rescued, more risk of pricing a man who will not play), a harsher discount, or
availability weighted toward the recent season rather than a flat mean.
Meanwhile: as stated, all three values in PROXY_METHOD.md §FW-REPRICE and every
affected player listed in REPRICE_REVIEW.md §Season selection.
