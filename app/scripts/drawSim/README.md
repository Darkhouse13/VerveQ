# drawSim — THE DRAW sim harness (Ticket 0)

Engine lives in `app/src/lib/drawEngine/` (pure, seeded, no I/O). This
directory holds the bots, simulator, tuning sweep, and layout check.

## Commands (run from `app/`)

```
npm run draw:sim -- --boards 2000 --config <path>   # bot distributions + P0–P5 pass/fail + JSON artifact
npm run draw:sweep                                  # random knob search (≤300 configs × ≤1500 boards)
npm run draw:layoutcheck [-- --config <path>]       # static 390×844 single-screen check
npx tsx scripts/drawSim/calibrate.ts --config <p>   # analytic threshold-plane calibration for one content config
npx tsx scripts/drawSim/calibrate.ts --search 100   # + content-genome search (curve solved analytically per genome)
```

`--config` files are partial `EngineConfig` JSON (deep-merged onto
`DEFAULT_ENGINE_CONFIG`), or `{ "config": ... }` wrappers as written by the
sweep. Everything is seeded — same flags ⇒ identical output.

## Files

- `boardContext.ts` — per-board flat precompute (eff matrix, tag ids) shared by oracle/MC; values come from engine scoring functions so the fast path can't drift.
- `oracle.ts` — exhaustive 3^6 draft enumeration, analytic bank/push (provably optimal: round scores are strictly positive), dead-board detector, P4 line diversity. ~0.4 ms/board.
- `bots.ts` — greedy / synergyChaser / random, all driven through `applyChoice`.
- `metrics.ts` — distributions, P3 push-EV Monte Carlo, criteria + profile distance.
- `evaluate.ts` — one config × N boards ⇒ full metric set (shared by sim & sweep).
- `sim.ts`, `sweep.ts`, `layoutcheck.ts` — CLIs.
- `calibrate.ts` — exploits the fact that bot draft picks are threshold-independent: precomputes per-board bot round-scores + the 729-line score matrix once, then scores the whole geometric threshold plane analytically (~11k curves in seconds). Used to prove the P1b conflict (see `../src/lib/drawEngine/DECISIONS.md`).
- `artifacts/` — gitignored JSON outputs.

## Status

Engine + harness + property tests: complete and green. Tuning: STOP condition
reported — no config passes P0–P3 jointly within the sweep budget; root-cause
analysis in DECISIONS.md ("Tuning outcome").
