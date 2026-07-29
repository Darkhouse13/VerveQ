# Weekend-fantasy scoring harness (FS-1)

Research tooling for calibrating the weekend-fantasy scoring formula. Standalone:
its own package, no Convex, no React, no dependency on `app/`. It ships nothing to
users and is deliberately not wired into the app CI.

**It has no connection to THE DRAW.** It does not import from, modify, or share
state with `app/src/lib/drawEngine/` or `app/scripts/drawSim/`. THE DRAW engine is
CONTRACT v1.1 frozen and out of scope here.

The question it answers: the structure of the scoring formula is approved — **are
its constants the right size?**

## The network rule

`fetch/` is the **only** directory permitted to touch the network. `scoring/` and
`sim/` are pure: they read from `data/` and nothing else, take no I/O, and must
produce identical output from identical input.

This is the same kind of contract `research/modes` states with its "no network"
line, scoped rather than absolute because Phase 1 has to acquire a sample. The
scope is the point — it keeps the parts that get re-run thousands of times
deterministic and offline, and confines quota-spending code to one place that is
easy to audit.

## Source of truth

`SCORING_SPEC.md` is v0.4.1, owner-approved, and is the sole source of truth for the
scoring engine. Every constant in it is a placeholder this harness exists to
calibrate; the *structure* is not up for review. The engine implements it exactly
as written — the harness proposes changes in its report and never applies them,
and nothing here edits the spec.

## Running it

```bash
cd research/fantasy
npm install

npm run fetch:plan                  # print the request plan + per-day budget, spend nothing
npx tsx fetch/run.ts --probe        # 5 requests: measure the endpoint schema, then stop
npx tsx fetch/run.ts --live         # start the pull
npx tsx fetch/run.ts --live --resume   # continue an interrupted pull

npm run check                       # tsc --noEmit + vitest
```

Dry-run is the default and `--live` is mandatory to reach the network: on a
100 requests/day free tier, a mistyped flag costs a calendar day, so the safe mode
is the one you get for free.

## Credentials

`fetch/env.ts` reads `API_FOOTBALL_KEY` and `AUTH_MODE` from the process
environment first, then from `research/fantasy/.env` (gitignored). Nothing in this
package prints the key — `describeKey` exists so an operator can confirm which key
loaded without the value reaching a terminal, a log, or a report.

## Data

Raw responses land in `data/` (gitignored), one JSON file per fixture plus one per
discovery call, exactly as the provider returned them. **The presence of the file
is the "already fetched" signal**, which is what makes "requests are never
repeated" hold across a multi-day pull even if the state file is lost.
`data/.fetch-state.json` carries the resumable progress and the per-UTC-day
request ledger, rewritten atomically after every single request.

## Hard rules

- **Never invent, estimate, or backfill a football stat.** Missing data is
  reported with its coverage rate, not filled. This is why `fetch/config.ts`
  declares `REQUIRED_STATS` — including the fields the endpoint does *not* carry —
  before the pull rather than after.
- **All STOPs are reported, never worked around.** Each one exits non-zero, prints
  its reason, and appends it to the state file's notes.
- The report emits numbers and *proposals*. Setting a constant is an owner
  decision, not a harness decision — same discipline as `research/modes`.

## Status

**Phases 0-4 complete.**

Phase 0 (recon) and the Phase 1 schema probe:
`reports/phase1-schema-probe-2026-07-27.md`. Three semantic mismatches between
feed and spec were reported there and ruled on by the owner in v0.3.

Phase 2 (the engine): `scoring/scoring.ts` implements SCORING_SPEC exactly;
`scoring/events.ts` reads substitution direction off the events feed. **33 tests
pass** — 27 hand-computed scoring cases plus 6 guarding the subst-direction
trap. The six gaps Phase 2 found were ruled on in v0.4, with two follow-ons in
v0.4.1; evidence in `reports/phase2-spec-gaps-2026-07-27.md`.

**The pull is COMPLETE** (2026-07-29, on the Pro key): **192/192** fixture
player-stat files and **192/192** event files, season 2024, 5 leagues, 8,110
player-fixture rows. Integrity verified in
`reports/fs1-sample-integrity-2026-07-29.md` — stat-line and events feeds each
reconcile against the fixture score in **192/192** fixtures.

Phase 3 (simulation) and Phase 4 (calibration report) target v0.4.1:

- `sim/dataset.ts` — pure loader joining the three feeds
- `sim/integrity.ts` — the coverage/reconciliation pass
- `sim/squads.ts` — three squad generators (`random`, `form`, `chalk`)
- `sim/run.ts` — the sweep: 120,000 squads, caps at 0.5x/1x/2x, crowd clamps at
  0/±10/±15/±25%
- `sim/proposals.ts` — the measured effect of every proposal in the report

**The calibration report is `reports/fs1-phase4-calibration-2026-07-29.md`.** It
contains numbers and proposals only. Nothing in it has been applied: setting a
constant is an owner decision, and `SCORING_SPEC.md` remains at v0.4.1.

### Note on the Pro key

The free-tier constraints this package was built around are gone. The account is
Pro as of 2026-07-29: **7,500 requests/day** (was 100) and **300/minute** (the
config previously assumed 450 — `PRO_TIER_RATE_LIMIT_MS` is now 250ms, giving a
20% cushion). Season 2026 is served, so a Phase 5 re-run against a live season
is possible; the sample in `data/` is season 2024, which is what the free tier
served when the pull began.

`fetch/autopull.sh` has been **retired** — it existed to pace a 215-request
backlog across multiple 100/day windows, and that whole problem no longer
exists. See `DECISIONS_FW2RUN.md` D2.
