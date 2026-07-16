# drawSim — THE DRAW sim harness (Ticket 0)

Engine lives in `app/src/lib/drawEngine/` (pure, seeded, no I/O). This
directory holds the bots, simulator, tuning sweep, and layout check.

## Commands (run from `app/`)

```
npm run draw:sim -- --boards 2000 --config <path>   # bot distributions + P0–P5 pass/fail + JSON artifact
npm run draw:sweep                                  # random knob search (≤300 configs × ≤1500 boards)
npm run draw:layoutcheck [-- --config <path>]       # static 390×844 single-screen check
npx tsx scripts/drawSim/calibrate.ts --config <p>   # analytic threshold-plane calibration for one content config
npx tsx scripts/drawSim/calibrate.ts --genome <p>   # same, from a ContentGenome JSON (as printed by --search)
npx tsx scripts/drawSim/calibrate.ts --search 100   # + content-genome search (curve solved analytically per genome)
```

`--config` files are partial `EngineConfig` JSON (deep-merged onto
`DEFAULT_ENGINE_CONFIG`), or `{ "config": ... }` wrappers as written by the
sweep. Everything is seeded — same flags ⇒ identical output.

## Files

- `boardContext.ts` — per-board flat precompute (eff matrix, tag ids) + the bench-optimal removal scorer shared by oracle/calibrator; values come from engine scoring functions so the fast path can't drift.
- `oracle.ts` — exhaustive 3^6 draft enumeration with exact per-round bench (argmax over 6 removals — Ticket 0.2 A3), analytic bank/push (provably optimal: round scores are strictly positive), dead-board detector, P4 line diversity. ~1.4 ms/board.
- `bots.ts` — greedy (bench lowest rating×mult; kGreedy face push rule) / synergyChaser (form=1 bench argmax) / random (uniform bench), all driven through `applyChoice`.
- `metrics.ts` — distributions, chaser bench plans, P3 push-EV Monte Carlo at all post-clear decision states (Ticket 0.2 run-level tense), criteria + profile distance.
- `evaluate.ts` — one config × N boards ⇒ full metric set incl. the EV-gap distribution (shared by sim & sweep).
- `archetypeTables.ts` — alternative archetype knob tables (boost-only, mixed mild/deep dips) shared by calibrate & sweep.
- `sim.ts`, `sweep.ts`, `layoutcheck.ts` — CLIs.
- `calibrate.ts` — exploits the fact that bot draft picks are threshold-independent: precomputes per-board bot round-scores + the 729-line score matrix once, then scores the whole threshold plane (base × growth × bossAxis, where bossAxis = bossMult × thresholdShape[last]) analytically (~22k curves in seconds), with the real P3 Monte-Carlo on a stratified shortlist. Used to prove the Ticket 0 P1b conflict and the Ticket 0.1 P3a ceiling (see `../src/lib/drawEngine/DECISIONS.md`).
- `artifacts/` — gitignored JSON outputs.

## Status

Ticket 0.2: matchday bench (one card benched per round, synergy on the 5
fielded cards), run-level P3 tension (tense := |EV gap| ≤ 0.5 × stdev(push)),
kGreedy knob. Engine + harness + property tests green. Tuning: STOP — the
closest config passes 9/10 (only P2 near-miss fails, honestly 43–54% vs
≤ 40%); root cause and methodology notes in drawEngine/DECISIONS.md. Useful
extra calibrate modes: `--eval` (selection-free re-measure of one config) and
`--genome` (plane for a printed ContentGenome).
