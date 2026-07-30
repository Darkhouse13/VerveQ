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
