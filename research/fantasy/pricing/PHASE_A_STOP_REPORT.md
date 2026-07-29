# FW-PR1 Phase A — STOP report: join gate failed at 77.7%

**Status: STOPPED at the Step 2 join gate.** The ticket requires ≥ 90% of the
universe to join to 2025-26 aggregates; the pull achieved **2,248 / 2,895 =
77.7%**. Per the ticket's fail-closed rules, Steps 3–4 (proxy scores, anchor
grid) did **not** run. Nothing here needs re-pulling — the raw data is on disk
and the resume path is cheap once the owner rules on the gap.

## What ran

| Step | Outcome |
| --- | --- |
| 1. Universe export | `fantasyPlayers` exported from DEV (`admired-warthog-495`) via `npx convex export`. 2,895 players, all active, ids unique. GK 341 / DEF 931 / MID 912 / ATT 711. → `data/players-seed-snapshot.json` (local; `data/` is gitignored by repo convention). |
| 2. Aggregates pull | `pull-aggregates.ts`. Plan printed before any request: worst case 596 calls vs the 2,000 STOP threshold. Actual spend **284 calls** (188 player pages + 96 club stat calls), throttled at 240/min through the shared FW-2 client/ledger. 3,722 raw rows → `data/player-aggregates-2025-26.json` + `data/team-stats-2025-26.json`, manifests included. Server-side quota after the run: 6,780 of 7,500 remaining. |

Pull sanity evidence (quoted from the raw file, not invented): Haaland
(id 1100) 35 apps, 2,958 min, 27 goals; Salah (306) 27 apps, 2,148 min, 7G/7A;
Lewandowski (762, Real Madrid row) 36 apps, 16 goals. Pagination reconciles:
188 pages × ~20 rows ≈ 3,722 rows; 121 players appear in two leagues
(mid-season cross-league transfers), which the join handles by player id.

## Why the join is 77.7% — verified, not an artifact

The join is on API-Football player id (numeric both sides); matched count
2,248 proves the key works. The 647 unmatched are **genuinely absent from all
five leagues' 2025-26 player pages** (spot-verified). They split into two
cohorts:

**1. Promoted-club squads (~317 players, 13 clubs).** The universe is the
*2026-27* squads (seeded July 2026); the signal season is 2025-26. Every club
promoted into a top-5 league this summer spent 2025-26 in a second division
the pull does not cover:

| Club | No-data players | | Club | No-data players |
| --- | --- | --- | --- | --- |
| Venezia | 29 | | Malaga | 24 |
| Hull City | 29 | | Racing Santander | 23 |
| Schalke 04 | 26 | | Elversberg | 22 |
| Deportivo | 25 | | Frosinone | 22 |
| Monza | 25 | | Coventry | 20 |
| Troyes | 24 | | Paderborn | 11* |
| Ipswich | 24 | | Le Mans | 24 |

\* Paderborn's 11 suggests a partial case worth an eye in Phase B.

**2. New arrivals from outside the top 5 + academy players (~330).** Spread
thin across all 96 clubs (1–11 each) and all four positions (GK 73, DEF 196,
MID 221, ATT 157): summer signings from other leagues and youth players with
no 2025-26 top-5 minutes.

The ticket anticipated exactly this cohort ("promoted-club players, new
arrivals → no proxy, flagged list") — but at 22.3% it is more than double the
10% the gate allows, because the universe/signal mismatch is structural: a
complete summer transfer window plus five promoted-club slots sit between the
signal season and the seeded squads.

## Options for the owner (Phase B call, not mine)

- **A. Accept the gap.** Proceed with 2,248 proxied players; 647 go to
  FLAGS.md as designed. The anchor grid is still comfortably buildable
  (proxied per position: GK 268, DEF 735, MID 691, ATT 554 vs 7 anchors
  needed). Promoted-club players would carry no data-drafted ordering and be
  priced editorially in Phase B/C.
- **B. Per-player backfill for all 647** via `/players?id=X&season=2025`
  (647 calls, fits today's remaining 6,780). Returns each player's 2025-26
  stats from *whatever* competition (Championship, Serie B, Eredivisie…).
  Closes most of the gap but mixes league quality into the signal — a proxy
  comparability caveat the spec would need to own.
- **C. Backfill promoted-club players only** (~317 calls), flag the rest.
  Halves the gap, contains the league-quality caveat to 13 known clubs.

## Resume path

`pull-aggregates.ts` is idempotent and the raw pull is already on disk; on a
ruling, Step 3 starts from the existing JSON without re-spending quota
(a backfill under B/C adds one bounded pull, plan-printed the same way).
