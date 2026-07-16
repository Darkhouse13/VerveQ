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

- `boardContext.ts` — per-board flat precompute (eff matrix, tag ids) shared by oracle/MC; values come from engine scoring functions so the fast path can't drift.
- `oracle.ts` — exhaustive 3^6 draft enumeration, analytic bank/push (provably optimal: round scores are strictly positive), dead-board detector, P4 line diversity. ~0.4 ms/board.
- `bots.ts` — greedy (Ticket 0.1 C1 face-value rule) / synergyChaser / random, all driven through `applyChoice`.
- `metrics.ts` — distributions, P3 push-EV Monte Carlo at round-2/3 states (Ticket 0.1 C2), criteria + profile distance.
- `evaluate.ts` — one config × N boards ⇒ full metric set incl. the EV-gap distribution (shared by sim & sweep).
- `archetypeTables.ts` — alternative archetype knob tables (boost-only, mixed mild/deep dips) shared by calibrate & sweep.
- `sim.ts`, `sweep.ts`, `layoutcheck.ts` — CLIs.
- `calibrate.ts` — exploits the fact that bot draft picks are threshold-independent: precomputes per-board bot round-scores + the 729-line score matrix once, then scores the whole threshold plane (base × growth × bossAxis, where bossAxis = bossMult × thresholdShape[last]) analytically (~22k curves in seconds), with the real P3 Monte-Carlo on a stratified shortlist. Used to prove the Ticket 0 P1b conflict and the Ticket 0.1 P3a ceiling (see `../src/lib/drawEngine/DECISIONS.md`).
- `artifacts/` — gitignored JSON outputs.

## Status

Engine + harness + property tests: complete and green. Ticket 0.1 amendments
(C1 greedy rule, C2 P3a/P3b, C3 thresholdShape) applied. Tuning: STOP condition
reported again — P3a (tense-state fraction ≥ 40%) is capped near ~15% by the
P2/P1d dispersion requirements; root-cause analysis in DECISIONS.md
("Tuning outcome (Ticket 0.1)").
