# Blind verification — SCORING_SPEC v0.5.0 vs engine (2026-07-29)

Independent no-prior-context verification of `specs/SCORING_SPEC.md`
v0.5.0 against `scoring/scoring.ts`, with the sim re-run for
reproducibility. Inputs were restricted to the spec, the engine, the
sim entrypoint (run only) and `reports/fs1-phase4b-v050-2026-07-29.json`.

## Verdict: PASS WITH NOTES

- **Conformance:** every constant, formula, cap, gate and clamp in the
  spec is implemented exactly as written. No scoring divergence found.
- **Hand recomputation:** 12 rows covering GK, interior duel/pass ramps,
  the bound MID defensive cap, ATT goal, decisive-moment fired/not-fired,
  sub under 60', negative total, mismatch dampener, crowd mirror and
  entry-minute inclusivity — 12/12 match hand arithmetic from the spec
  text alone. (Constructed rows: the phase-4b JSON aggregates all 8,110
  rows and carries none individually — see note 4.)
- **Reproducibility:** `npx tsx sim/run.ts --n 2000 --seed 20260729`
  reproduced `fs1-phase4b-v050-2026-07-29.json` byte-identically apart
  from the `generatedAt` stamp.
- Every fixed-value term mean in the report's term attribution equals
  its spec constant.

## Notes (all closed by FW-S2b / spec v0.5.1)

1. **Spec-internal inconsistency:** the universal events table said
   goals pay "+4 to +8"; the templates (and engine) pay +5 (ATT) to
   +8 (GK). No position pays +4.
2. **Unstated interaction:** the feed has no second-yellow split; the
   spec priced yellow −1 and red −4 without saying whether they sum on
   one row. The engine charges counts additively (2Y + 1R = −6).
3. **Drift:** design principle 4 claimed the MID defensive cap binds on
   "~8% of term rows"; the calibration figure is 8.16% of 60+ MID rows,
   and phase-4b measures 6.35% over all rows carrying the term.
4. **Verifiability gap:** the sim offered no per-row output, so report
   scores were not independently reconstructable from the artifact.
5. **Stale engine comments (no code effect):** the header's v0.4 G3
   paragraph still described the pre-P6a multiplier basis; the event-
   counts comment said "strictly after" the entry minute where code and
   spec are inclusive; the `formatPoints` comment said the spec names no
   tie-break rule, which v0.5.0 does.
6. **Unpinned detail:** the 2 dp ramp quantisation's rounding mode was
   unnamed in the spec (engine rounds half-up).

Nothing found affects a single computed score.
