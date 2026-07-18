# THE DRAW — design decision log (v0)

Ticket 0 scope: pure engine + sim harness + tuning sweep. Repo-only; no Convex,
no UI, no deploys.

## Locked decisions

1. **Visible gauntlet + thresholds.** All 5 fixtures — archetype, modifiers,
   and threshold — are part of `BoardSpec` and shown from board start. The
   draft is a planning puzzle, not a reveal gamble; hidden thresholds would
   make bank/push decisions feel arbitrary and untunable.

2. **Fixed 18-card board, sequential reveal.** The 6×3 offer grid is fully
   derived from the board seed and does not react to picks. UI reveals one row
   at a time, but the contents are fixed — so a choice log fully determines a
   run and replay is exact. No skips, no redraft.

3. **Global form seeding.** Form is seeded from `(boardSeed, cardId,
   roundIndex)` only. Trade-off accepted: forms are technically derivable
   client-side (a discoverable "form meta"), and a scripted player could
   compute them. Rejected alternative: per-user salting — it would make the
   same board score differently for different users, which breaks shared
   leaderboards and "beat my run" challenges. Leaderboard fairness wins.

4. **bustKeep = 0.25.** A bust keeps 25% of cumulative rather than 0. Zero
   makes pushing feel punitive and inflates near-miss rage-quits; a healthy
   keep fraction keeps EV(push) close enough to EV(bank) to create genuine
   tension (profile criterion P3) while still stinging.

5. **Matchday bench (Ticket 0.2 A1 — supersedes v0's "whole squad plays").**
   Each round, before the reveal, exactly one of the 6 drafted cards is
   benched; the 5 fielded cards score. The bench pick is an explicit per-round
   `bench` entry in ChoiceLog (replay identity covers it). The oracle stays
   exact: per-round optimal bench = argmax over the 6 removals, which is
   round-independent given the stop policy (rounds are additive) —
   property-tested against exhaustive bench enumeration.

6. **No mid-run redraft.** The draft is the skill expression; the run is the
   consequence. Mid-run card swaps would blow the 3^6 decision space up and
   dilute draft tension.

7. **Synergy = largest chain per family on the FIELDED cards, families
   multiply (Ticket 0.2 A2).** Per family (club / nation / era — position
   excluded) the single largest shared-tag chain among the 5 fielded cards
   counts; chains ≥ 3 grant table multipliers (3→×1.5, 4→×2.0, 5→×2.5
   default; the 6-chain entry is gone — chains cap at the field size) and
   family multipliers stack multiplicatively. Hard cap of 3 families, tied to
   the 3 synergy meters in LAYOUT_SPEC.md. Benching a chain member breaks the
   chain — the bench is a real synergy decision, not just a dud-drop.

8. **Score shape.** `roundScore = (Σ rating × form × fixtureMult) ×
   Π familySynergyMult`. Synergy applies to the squad sum, not per card, so
   the meters can show one honest multiplier. A card matching several
   modifiers on one fixture multiplies them all.

9. **Card contents synthetic-only.** Generated syllable names + `CLUB_A…`,
   `NATION_A…`, `ERA_1990s`-style vocabularies. No real players, clubs, or
   managers anywhere in code, fixtures, or test data (repo-wide rule for this
   ticket; real-content mapping is a later ticket).

## Ticket 0.1 amendments (owner-ordered, 2026-07-16)

The Ticket 0 STOP was accepted upstream; Ticket 0.1 amended the two
mis-specified profile instruments and added one additive knob:

- **C1 — greedy bank rule**: the `cumulative > 1.5 × F1 threshold` trigger is
  deleted. Greedy now PUSHES iff its squad's face value (Σ ratings — no form,
  no fixture modifiers, no synergy) ≥ 1.0 × the next threshold, else BANKS.
  This removes the old variance coupling entirely: greedy's bank round is a
  deterministic function of (face value, threshold curve).
- **C2 — P3 redefinition**: bank-point sampling is dropped. All chaser-reached
  post-clear states at rounds 2 and 3 (1-based; one visit per board per round)
  are sampled. EV(push) = Monte-Carlo value under the chaser's own continuation
  policy. "Tense" := EV(push) − EV(bank) ∈ [−20%, +10%] of banked. P3a: tense
  fraction ≥ 40%. P3b: among tense states, stdev(push) ≥ 35% of banked —
  implemented as the **median over tense states** (flagged interpretation; the
  full EV-gap distribution is reported alongside).
- **C3 — thresholdShape**: `ThresholdConfig.thresholdShape?: number[]` — an
  optional per-fixture multiplier on the geometric curve (default all 1s).
  Additive only; omitting it reproduces the v0 curve bit-for-bit.

## Ticket 0.2 (owner-ordered, 2026-07-16): matchday bench + run-level P3

D1 amendment (final): A1 bench (one card benched per round, 5 fielded score;
`bench` entries in ChoiceLog), A2 synergy on fielded cards only (table
3→1.5, 4→2.0, 5→2.5), A3 bot bench policies + greedy kGreedy knob, D2 layout
re-check (tap-to-bench squad strip, round view 540px ≤ 812px). Oracle stays
exact (per-round argmax over removals — property-tested); ~2.4 ms/board.

## Tuning outcome (Ticket 0.2) — STOP on P2 (one criterion left)

The bench + run-level P3 unlocked nearly everything: the closest config
(`app/scripts/drawSim/artifacts/c13-1.json`) passes **9/10** at the official
2000-board confirmation (P0 99.65%, P1a 1, P1b 2, P1c 4, P1d 23.4%,
P3a 46.9% of runs tense, P3b 80.6%, P4 97.7%, P5) and fails only
**P2: 46.5% near-miss vs the ≤ 40% band** — a gap that held at 43–54% in
every honest measurement across the campaign (~440 content genomes over three
full searches incl. a margin-targeted round, ~100k analytic curves per genome
incl. thresholdShape and kGreedy planes, selection-free multi-seed re-checks).

Root cause: **the spec'd push policies self-select near-miss failures.**
Greedy pushes only when its fielded face ≈ kGreedy × next threshold; the
chaser only when its last score ≥ 1.1 × next threshold (and consecutive round
scores are strongly correlated). Both bots therefore enter exactly the rounds
they *almost* clear, and their failures land just under the threshold. Deep
failures (needed for P2's ≥ 60% share) require hidden inter-round dips >12%,
and dips that strong also break P0 (the oracle's bench cannot dodge a
field-wide dip on marginal boards) or drain P3a's tense mass. Configs with
honest P2 ≤ 40% exist, but none of them holds P3a ≥ 40% at the same time.

Fail-closed: STOP; profile not loosened. Suggested (not applied) resolutions:
widen P2's band (near-miss ≤ ~50%), narrow the near-miss window (12% → ~6%),
or pool the random bot's fails into P2 (its uniform bench produces the deep
failures the policy bots avoid).

## Ticket 0.3 (owner-ordered, 2026-07-16): P2 amendment — the STOP-3 ruling

The owner accepts the Ticket 0.2 structural finding and rules as follows
(deliberate design decision, not a search-convenience loosening):

- **P2's old ≤ 40% ceiling was a proxy for rigging-perception** ("the game
  fakes near-misses to bait pushes"). The 0.2 analysis showed near-miss
  clustering is *emergent from rational play*: both spec'd policies (greedy's
  face rule, chaser's 1.1× rule) only enter rounds they almost clear, so
  their failures land just under the threshold. That is what push-your-luck
  play IS — **emergent near-miss clustering under rational play is accepted
  as a genre property.**
- **Manufactured near-miss risk is guarded by mechanism invariants, not by a
  rate band**: thresholds are visible from board start (locked decision 1),
  form is globally seeded from (boardSeed, cardId, roundIndex) — never user
  identity or choices (locked decision 3), and every fail beyond round 1 is
  entered by a player-chosen push. The engine has no channel through which a
  near-miss could be manufactured per-player.
- **C1**: P2's window is unchanged (fail within 12% of threshold,
  greedy+chaser pooled); the band becomes **25%–60%**. The 60% line is a
  **degeneracy alarm** (a signal the margin distribution has collapsed), not
  a tuning target.
- **C2**: new report-only diagnostic (no gate) — near-miss attribution: share
  of near-miss fails by round index, split forced (round 1) vs chosen push
  (round ≥ 2). It keeps the forced/chosen distinction visible in every future
  acceptance table.
- **Primary question for the first human playtest: "do busts feel fair?"**

## Acceptance outcome (Ticket 0.3) — STOP on P0 (set-lottery, now measured)

The amended profile was evaluated selection-free per the 0.3 protocol:
`calibrate --eval` on c13-1 across the 10-set rotation, 2000 boards per set,
gates on the POOLED result (seed `accept-0.3`, kGreedy 1, 20000 boards).
Result **9/10**: every criterion passes — including the amended P2 at 47.1%
(mid-band) and P3a at 47.2% — EXCEPT **P0: 98.00% full-clearable vs ≥ 99.5%**
(401/20000 dead, all flagged). Per-set P0 spans 91.4%–99.7%; only 1 of 10
sets clears the bar. Ground-truthed against the real oracle (set 8 sample:
6.7% dead; set 0: 0.0%) — the instrument is correct, the failure is real.

Root cause: **dead-board rate is a card-set property.** The 0.2 "9/10 with
P0 99.65%" was measured on the single sim-seed card set — exactly the
set-lottery draw the 0.2 honesty note warned about; 0.3's rotation protocol
is the first time P0 was measured across fresh sets, and it regressed like
every other band criterion under honest re-measurement. C2 attribution
(report-only): 96.2% of pooled near-miss fails come from chosen pushes
(round ≥ 2), only 3.8% from the forced round 1.

Fail-closed: STOP; nothing landed, frozen, pushed, or tagged. Options for an
owner ruling (not applied): treat P0 as a pinned-set acceptance criterion —
the shipped game pins ONE card set, and set 0 shows 0.0% dead is achievable —
combined with production-time `detectDeadBoard` regeneration; or re-tune
content for cross-set P0 robustness before freezing.

## Ticket 0.4 (owner-ordered, 2026-07-16): P0 two-tier restructure — the STOP-4 ruling

The owner accepts the Ticket 0.3 structural finding (dead-board rate is a
card-set property) and rules: **no criterion is loosened; P0 is relocated to
the tier where each guarantee actually lives.** The player-facing dead-board
rate was never a statistical promise — it is 0% by construction via a runtime
oracle gate. The two-tier acceptance architecture:

- **P0-config (Tier 1 — gates config acceptance, this ticket):** pooled
  full-clear ≥ 97% across the 10-set rotation. Per-set P0 remains a
  report-only diagnostic. This is the honest cross-set robustness statement a
  content-free config CAN make; demanding 99.5% of every fresh random card
  set was gating the config on the set lottery.
- **P0-runtime (CONTRACT INVARIANT, binds from v1.0):** production serving
  MUST pass `detectDeadBoard` — a dead board is never served. Dead seed ⇒
  deterministic reroll chain: served board index = first non-dead k in
  hash(dateSeed, k) for k = 0, 1, 2, …; a pure function of the date seed,
  shared by all users (leaderboard fairness preserved; locked decision 3
  untouched). Implementation lands in the Convex serving ticket; the
  invariant text lands now (types.ts docblock + this entry).
- **P0-set (Tier 2 — forward requirement, recorded):** the pinned production
  card set must achieve ≥ 99.5% natural clear over ≥ 2000 boards in its own
  Tier-2 acceptance run (CIE card-set ticket). Set 0 of the 0.3 rotation
  (99.70%) shows this is achievable without touching the config.

Empirical support for the STOP-3 ruling, from the 0.3 C2 attribution
diagnostic: **96.2% of pooled near-miss fails are entered by a chosen push**
(round ≥ 2); only 3.8% come from the forced round 1. Near-miss clustering is
a product of player agency, not of board construction — exactly the
"emergent from rational play" mechanism the STOP-3 ruling accepted.

## Acceptance outcome (Ticket 0.4) — PASS 10/10; CONTRACT v1.0 frozen

`calibrate --eval` on c13-1, same protocol as 0.3 (10-set rotation × 2000
boards, seed `accept-0.3`, kGreedy 1, 20000 boards, selection-free), gated on
the amended profile (0.3 criteria + P0-config): **10/10 PASS**. P0-config
98.00% pooled full-clear (401/20000 dead, all flagged) vs the ≥ 97% gate;
P1a 1, P1b 2, P1c 4, P1d 21.9%, P2 47.1% of 5258 fails (mid-band),
P3a 47.2% of runs (per-state 18.2% of 72511 states), P3b 79.2%, P4 96.5%,
P5 207/207 identical. Per-set P0 spans 91.4–99.7% (diagnostic only). The run
is bit-identical to the 0.3 acceptance (same seed) — only the gate changed,
per the ruling. Log: `app/scripts/drawSim/artifacts/eval-accept-0.4.log`.

Landed and frozen: types.ts marked **CONTRACT v1.0** (breaking changes
closed; additive knobs by owner ticket only, P0-runtime invariant included),
tag `draw-engine-v1.0`.

## Ticket G (owner-ordered, 2026-07-18): engine v1.1 — form hints + assisted/reader bots

Owner-sanctioned ADDITIVE contract change (v1.0 → v1.1); no breaking changes.
Landed (independent of the tuning outcome, per the E3 precedent of landing the
instrument):

- **hints.ts** — `formHint(boardSeed, cardId, roundIndex, hintReliability)` →
  COLD | NEUTRAL | HOT. True band = tercile of the SAME seeded u that formFor
  realizes; an independent noise stream (`|hint|`) keeps the true band with
  probability `hintReliability`, else shows one of the other two bands
  uniformly — so hintReliability IS P(hint == realized band) and the hint
  marginal stays uniform (no population tell). Bayes helpers
  (`hintPosteriorMeanU` / `hintPosteriorForm`); reliability 1/3 collapses the
  posterior to the prior. SANITIZATION: hints are design-public PRE-round
  (pure function of board seed — locked decision 3 untouched); the realized
  form value remains post-resolution only; contract-tested that the hint
  carries no information beyond its band statistics
  (drawHintsContract.test.ts).
- **types.ts** — `EngineConfig.hints?: HintConfig { hintReliability }`
  (additive; omitted ⇒ bit-for-bit v1.0).
- **bots.ts** — `assisted` (the shipped-human model: chain-first draft,
  F3-band-centre bench = the chaser's formless argmax, push by exact band
  arithmetic: push iff the next threshold sits at or below `kAssisted` of the
  next round's projected band); `reader` (assisted + Bayesian hint use: every
  form-1 weight replaced by the posterior mean form given the card's hint,
  same for bench and push). Ladder target random < greedy < chaser <
  assisted ≤ reader — held in every measurement.
- **kAssisted (bot-model knob, FLAGGED)** — the ticket fixes the assisted
  bot's bench/push to "exact F3 band arithmetic" but the arithmetic alone
  does not fix the push TOLERANCE (where across the band the threshold must
  sit). Modeled as a harness-level knob like kGreedy (Ticket 0.2 A3
  precedent): push iff bandFraction(threshold) ≤ kAssisted, resolved by the
  profile fit (P1d's band is exactly the instrument that pins it). Default
  0.5 (= band centre). This is a session interpretation, not owner text —
  recorded here for the owner to affirm or overrule.
- **Profile v1.1 instruments** (metrics/evaluate/calibrate, active only for
  configs WITH hints): P1d gates ASSISTED full-clear [10%, 25%] (chaser FC
  demoted to diagnostic); P2 pools greedy+assisted; P3 measured on assisted
  with the band-policy continuation; NEW P6: reader median final score ≥
  1.08 × assisted's; P1c and all bands unchanged. Ticket G slice-rotation
  acceptance bars (amended by the ticket): pooled P0-set ≥ 99.4%, per-slice
  ≥ 99.0%, would-be reroll alarm 1% — measured on DEFAULT-scorer slices (the
  E5 serving policy), `calibrate --eval --slicerotation --defaultscorer`.

## Tuning outcome (Ticket G) — STOP on P3a + P6 (one dial, three masters)

The c13-2 sweep (`calibrate --sweepg`: formSpread × hintReliability ×
threshold plane × kGreedy × kAssisted, 4 campaigns ≈ 7k combinations on 20
default-scorer real-v4 slices × 4000 boards, stage-2 real-MC P3 + P4,
shrunk search targets) found NO passing config. Fail-closed: STOP; nothing
frozen as c13-2, no DECISIONS loosening, serving stays on c13-1 (no hints).

Closest config, honest selection-free 20×500 re-measure (seed accept-g-stop;
fs 0.45, base 400, growth 1.24, shape5 1.1, hr 0.8, kGreedy 0.9, kAssisted
0.2): **11/13 PASS** — P0-set 99.80% (worst slice 99.20%, reroll 0.20%),
P1a 1, P1b 2, P1c 4, P1d 20.3%, P2 49.9%, P3b 64.2%, P4 97.3%, P5 104/104 —
failing only **P3a 19.7%** (≥ 40%) and **P6 +1.1%** (≥ +8%). Artifact:
scripts/drawSim/artifacts/g-closest.json (gitignored).

Root cause — **P1d, P3a and P6 are three readings of ONE quantity: how often
the assisted model's pushes are marginal.** The F3 band centre is the
formless round score, so a band player's pushes are near-optimally informed:
- P1d ≤ 25% needs marginal pushes RARE (at P0-compatible threshold heights
  an aggressive band player full-clears ~50% — measured 53.0% at kAssisted
  0.5; the kAssisted dial reaches the band only at 0.2, i.e. push at ≥
  bottom-fifth of the band).
- P3a ≥ 40% needs marginal pushes COMMON — tense states ARE marginal
  decisions. Measured max across every sweep and honest run: **~23–26%**;
  in the P1d-passing region ~17–20%. (The v1.0 chaser scored 45.1% on the
  same slices because its backward-looking 1.1× rule manufactures
  marginality; the band policy is too well-informed to be tense.)
- P6 ≥ +8% needs marginal pushes COMMON — hints only pay where a decision
  can flip. Honest frontier: **+4.2%** at the most-aggressive corner
  (kAssisted 0.5, hr 0.9, where P1d is 53%); **+1.1%** in the P1d band.
  (Search-stage P6 up to +13% did not survive selection-free re-measure —
  winner's curse, as the harness notes predict.)

Threshold knobs cannot decouple them: raising thresholds/boss walls moves
P0-set down with P1d (axis 1.6 ⇒ P1d 29% but P0 96%, min-slice 92.5%), and
conservatism (kAssisted ↓) buys P1d exactly by destroying the marginality
P3a/P6 need. What v1.0 kept on separate dials (P1d on the chaser's
manufactured marginality, P3 on the same), v1.1's better-informed player
collapses onto one.

Everything else co-holds comfortably: the amended P0 bars pass across the
region (up to 99.98% pooled / 99.5% worst slice), P2 lands mid-band once
assisted joins the pool (44–55%), the ladder holds everywhere measured, and
hints ARE strictly worth reading (reader ≥ assisted in every honest run) —
just not +8% worth.

Suggested (not applied — owner rulings required):
1. **Re-gate P1d and P3 on the chaser** (v1.0 semantics) and keep assisted/
   reader as P6's instrument at kAssisted 0.5: on measured numbers this
   passes P0/P1/P2/P3 as at E5, with honest P6 ≈ +4% — combine with (2).
2. **Lower P6's bar to what a bench+push hint reader can honestly earn
   (≈ +3–5%)**, or widen the hint channel (reader uses hints at DRAFT, a
   spec change) if +8% must stand.
3. **Accept that the band player IS the game now**: re-band P1d for assisted
   (e.g. [35%, 55%]) and drop P3a to a diagnostic — a deliberate profile
   redesign, not a tune.

## Ticket G2 (owner-ordered, 2026-07-18): coarse clearance signal + c13-2 — PASS 13/13

The owner's answer to STOP-G: replace the exact F3-band player with a
COARSELY-informed one, so tight decisions stay tense and hints have
something to resolve. Landed:

- **clearance.ts** — `clearanceSignal(bandMid, threshold, cfg)` →
  SAFE | TIGHT | LONGSHOT with knob cutoffs (`EngineConfig.clearance`
  { safeRatio, longshotRatio }, ADDITIVE — SAFE at ≥ safeRatio×t, LONGSHOT
  below longshotRatio×t), plus `bandMidFor` (= the F3 band centre, proven
  equal to formless scoreRound by contract test). ONE definition shared by
  UI and bots.
- **bots.ts** — `coarseAssisted` (chain-first draft; bench = lowest RAW face,
  rating × fixture modifier, no synergy accounting; pushes ONLY on SAFE) and
  `coarseReader` (bench by posterior face; signal recomputed on the
  hint-posterior band centre; pushes on anything not posterior-LONGSHOT —
  hints demote cold TIGHTs to bank and promote hot LONGSHOTs to push). Both
  bucket cutoffs are live: safeRatio governs the unassisted push,
  longshotRatio the informed one.
- **Profile v1.2** (configs with `clearance`): P1d [10, 25%] on
  coarseAssisted; P2 pools greedy+coarseAssisted; P3b (tense-state spread ≥
  30%) on the coarseAssisted policy; P6 ≥ +3% (coarseReader over
  coarseAssisted); amended slice bars unchanged (pooled ≥ 99.4, per-slice ≥
  99.0, reroll alarm 1%, default-scorer slices).
- **v1.2 P3 SPLIT (session interpretation, FLAGGED for owner affirmation):**
  the ticket relocates "P2/P3b" to coarseAssisted and names P3a separately —
  read as: **P3a stays on the CHASER**, the v1.0 manufactured-marginality
  instrument. Empirical basis: P3a on ANY forward-looking (mid-projecting)
  bot, exact or coarse, maxes ~26–27% across ~15k swept combinations
  (G1+G2), while the chaser scores 45–52% on the same slices — its
  backward-looking 1.1× rule pushes into states a mid-projection correctly
  avoids, which is precisely the tension P3a was built to certify. If the
  owner meant P3a-on-coarseAssisted, the honest answer is: unreachable
  (frontier ~27%), and this becomes a STOP again.
- **Ladder (two-chain reading, FLAGGED for owner affirmation):** the ticket's
  ladder text carries no operator between chaser and coarseAssisted
  ("random < greedy < chaser coarseAssisted ≤ coarseReader"). Read as two
  chains — backbone random < greedy < chaser AND coarseAssisted ≤
  coarseReader — which is design-coherent (the coarse pair deliberately
  models a mediocre player; chaser FC runs 30%, above the shipped-player
  band). Measured: the chaser↔coarseAssisted leg is slice-lottery-dominated
  (−2.0% / +1.4% across the two acceptance seeds; sweep margins up to +7.7%
  do not survive re-measure) and CANNOT be made robustly positive while P1d
  caps coarseAssisted at 25% — under a strict chaser < coarseAssisted
  reading, Ticket G2 is a STOP on that leg alone. Both specified chains held
  monotone in every measurement.

**c13-2 ACCEPTED (13/13, selection-free, twice)** — configs/c13v2.ts
(fs 0.48; thresholds base 375 × growth 1.29, no boss shape; hints 0.6;
clearance 1.15/1.05; content knobs pinned from c13-1; bot knob kGreedy 0.9):

- seed accept-g2 (20 default-scorer slices × 500): P0-set 99.81% (worst
  slice 99.40%, reroll 0.19%), P1a 1, P1b 2, P1c 4, P1d 18.6% (chaser FC
  29.6% diagnostic), P2 57.3%, P3a 51.5%, P3b 73.1%, P4 97.5%, P5 104/104,
  P6 +7.6% — 13/13.
- seed accept-g2-confirm (independent, controls the two-candidates-on-one-
  seed multiplicity — an earlier safe-1.15/fs-0.45 candidate passed 13/13 on
  accept-g2 but broke the strict-reading ladder leg and was rejected):
  P0-set 99.71% (worst slice 99.20%, reroll 0.29%), P1d 18.7%, P2 56.4%,
  P3a 52.3%, P3b 74.7%, P4 97.1%, P6 +6.4% — 13/13, and the full 5-bot
  ladder monotone even under the strict reading (734 < 1685 < 3494 < 3542 <
  3769).

Sweep provenance: calibrate --sweepg (G2 mode — formSpread ×
hintReliability × safeRatio × longshotRatio × threshold plane, kGreedy per
curve, joint selection incl. P6 and ladder cushion, stage-2 split-P3 MC),
campaigns sweep-g2a…g2g on 20 default-scorer slices × 4000 boards; winner
from sweep-g2f. NOT ACTIVATED: serving stays on c13-1 (no hints, no
clearance); activation awaits the owner's dev replay + rulings on the two
flagged readings.

## Harness honesty notes (Ticket 0.2 methodology)

- **Card-set lottery**: the card set is derived from the evaluation seed, so
  P1d/P2-class criteria swing ±4–6 points between seeds for the same config.
  The calibrator precompute now rotates 10 card sets; a single-seed 2000-board
  sim remains a set-lottery draw (flagged for the future real-content ticket:
  the shipped, pinned card set needs its own acceptance run).
- **Winner's curse**: selecting over ~10⁶ (content, curve) pairs on
  few-hundred-board statistics inflates every band criterion by ~2σ (≈ 4–8
  points). The calibrator's search targets are therefore shrunk inside the
  profile bands, and `calibrate --eval` provides selection-free re-measurement
  of one exact config on fresh rotated sets; reported PASS/FAIL always uses
  the true profile bands via the sim.

## Tuning outcome (Ticket 0.1) — STOP again, on P3a

C1 worked as intended: **P1b is no longer structurally conflicted** (greedy
median 2 is a clean corridor `t2 ≤ median face < t3`, verified at 2000 boards).
P0, P1a, P1c, P3b, P4, P5 pass together robustly; P1d and P2 land near their
band edges (seed-sensitive by a few points).

**P3a (tense states ≥ 40% of round-2/3 states) is unreachable** in every
explored region: the calibrator searched ~110 content genomes (both archetype
families plus a mixed mild/deep-dip table, synergy step down to 0.05, formSpread
to 0.45, bustKeep/fullClearBonus/setSize free) × the full analytic threshold
plane (base × growth × bossAxis incl. thresholdShape walls ≈ 22k curves each,
real-MC P3 on ~300 shortlisted curves per genome), plus the official D6 sweep
(260 configs, STOP) and a 2000-board sim of the winner. Best tense fraction in
any region with P0 ≥ 99%: **~16%**; in regions passing P0–P2: **6–15%**.
(Curves showing 40–50% exist only where P0 < 10% — a handful of surviving
states on dead boards.)

Root cause — **P3a and P2 are two ends of one dispersion dial**: a successful
push adds ≥ ~25–30% of banked, so a tense state needs next-round clear
probability in a ~0.3-wide window; with 6-card form averaging (σ ≈ f/4.2) that
window spans only ~12–15% of score/threshold margin. P2 (near-miss ≤ 40% of
fails) demands a fat tail of *deep* failures, and P1d (chaser FC ∈ [10, 25%])
demands broad cross-board outcome dispersion — both force the margin
distribution to be several times wider than the tense window, capping the
tense fraction near 15%. Concentrating margins raises P3a and P2 together:
empirically P2 crosses 40% (fail) while P3a is still ≤ ~16%.

Fail-closed: STOP; the profile was not loosened. Closest config
(passes 7/10 incl. P0/P1a/P1b/P1c/P4/P5; fails P1d 38.8%, P2 48.4%,
P3a 6.7%): `app/scripts/drawSim/artifacts/best-calibrated-v3.json`, 2000-board
sim in `sim-final-v3.json`.

## Tuning outcome (Ticket 0)

The D6 sweep (260 configs) plus an analytic threshold-plane calibrator
(`app/scripts/drawSim/calibrate.ts`, ~2.4M (content, curve) combinations)
found no config passing P0–P3 jointly. Fail-closed: STOP, profile NOT
loosened. Root cause identified: **P1b (greedy median ≈ 2) conflicts
structurally with P0/P1c/P1d** — greedy's fixed bank rule
(`cumulative > 1.5 × F1 threshold`) requires most of its F1-score mass inside
a 1.5×-wide window, i.e. low score variance, while oracle/chaser separation
requires exactly the variance sources (synergy, modifiers) that widen it
(greedy p50→p90 spans ≥1.6× in every separating config). P3's "EV gap in
[−15%, 0] AND spread ≥ 40%" additionally never held at the *median* bank
point in any sim run (in-range points: 2–6%). Closest configs and per-criterion
tables are in `app/scripts/drawSim/artifacts/`. See the ticket report for the
suggested (not applied) rule/profile amendments.

## Harness interpretation notes (flagged, not silently decided)

- **Oracle bank/push**: round scores are strictly positive, so per draft line
  the optimal policy is provably "push until the first future fail, bank just
  before it" (or full-clear). The oracle enumerates all 3^6 lines and resolves
  bank/push analytically instead of enumerating 2^k stop policies; this is
  exhaustive-equivalent, not an approximation.
- **Dead-board detector** = "no draft line full-clears", computed exactly from
  the same enumeration. P0's "remainder flagged" is thus exact by
  construction; the detector exists as a standalone `detectDeadBoard` for
  production board-generation use.
- **P3 states (Ticket 0.2)**: EV(push) is Monte-Carlo estimated from the
  player's information set (future forms unknown ⇒ resampled uniform; squad,
  bench plan, synergy, modifiers, thresholds known), continuing with the
  chaser's own policy after the forced push — form=1 bench each round, push
  while score ≥ 1.1 × next threshold. States sampled = every chaser-reached
  post-clear decision state (cleared rounds 1..4), one visit per board per
  round. tense := |EV(push) − EV(bank)| ≤ 0.5 × stdev(push outcomes). P3a is
  run-level (fraction of chaser runs with ≥ 1 tense state); the per-state
  tense fraction and full EV-gap distribution are reported alongside. P3b's
  "stdev(push) ≥ 30% of banked among tense states" is evaluated as the median
  over tense states (carried over from the 0.1 flagged interpretation).
- **Greedy projection (Ticket 0.2 A3)**: greedy benches the lowest
  rating × fixture-modifier for the upcoming fixture; its C1 push rule
  compares Σ ratings of the 5 cards it would field next round (ratings only,
  per C1's "face value") against kGreedy × next threshold.

## Card-set data decisions (Ticket E0.6)

- **Age-16 CLAMP replaces the age-16 discard (sourceStartYear derivation).** A
  senior first-team P54 statement starting before the player's 16th year is
  anchored to `max(membershipStart, birthYear+16)`, not discarded. The discard let
  an academy-on-first-team P580 delete the earliest career point and promote a later
  transfer across an era bucket; the clamp never deletes a career. Since E0.5, this
  value is not a debut and no date is published — the ONLY thing it decides is the
  era bucket — so the debut-accuracy objection that kept the filter no longer applies.
  Full clamp re-bucket delta in drawCardsReal.BUILD_NOTES.md (E0.6).
- **Falcao definitional ruling (owner-signed).** A sub-16 debut is a CURIOSITY, not
  an anchor; the clamp IS the definition of the anchor (born+16). Falcao's age-13
  Gimnasia de la Plata 1999 statement clamps to 2002, moving his card from bucket 3
  to bucket 2. Accepted as the pipeline's definition rather than patched per-player.
  Recorded also in the dossier (sourceStartYearMeaning.clampAndCuriosities) and
  ownerCitedOverrides.json (_doc, where he is NOT overridden — the clamp re-buckets him).
- **Two era restores (owner-signed, ownerEraRestores.json).** De Bruyne (eraYear 2009,
  Wikipedia-cited) and van der Sar (eraYear 1990, sourced to his own P54 Ajax statement;
  external corroboration was blocked per verify2 and NOT fabricated) are re-admitted from
  the erased-earliest-career fail-closed. The canonical still emits null; the restore is
  an editorial override that never edits a fact.

## Ticket E4/E5 (owner-ordered, 2026-07-17): Daily Deck slice serving — the rotation ruling

- E3's P0-set Tier-2 gate measured real-v4 served WHOLE at 88.20% natural
  full-clear (STOP; diagnosis: 430 cards over 323 club tags is ~2.6× less
  synergy-dense than the 50-card/11-tag synthetic genome c13-1 was tuned on).
  The owner remedy (Ticket E4) is SERVING-LAYER density restoration: each day
  serves a ~46-card SLICE of the pinned real set built to the synthetic
  profile. The engine is untouched — sliceDeck.ts is an additive module
  (seeded, pure) permitted by the E4 owner ticket.
- E4 acceptance (calibrate --eval --slicerotation, 20 slices × 1000 boards,
  seed accept-slice-rotation, c13-1 unchanged): two independent 20000-board
  runs measured pooled P0-set **99.48% / 99.46%** against the 99.5% bar —
  every other criterion PASS (P1d 24.3%, P2 44.6%, P3a 45.1%, P3b 77.9%,
  P4 95.7%, P5 207/207 identical). The session STOPPED rather than re-roll
  knob jitters until acceptance noise crossed the bar (winner's-curse
  discipline). Diagnosis, measured: every composition knob moves P0-set and
  P1d TOGETHER (frontier corner ≈ 99.47/24.3); residual dead boards have
  normal chain sizes and die on the row-arrangement lottery (~0.5% floor
  composition cannot reach); real cards carry ~1.1 chain-relevant club chips
  vs the synthetic 2.2 (fact chips cannot be fabricated). Log:
  scripts/drawSim/artifacts/eval-accept-daily-deck-v1.log (local artifact).
- **OWNER RULING (Ticket E5, 2026-07-17): the measured 99.47% (99.46–99.48
  across the two 20000-board runs) is ACCEPTED under the amended rotation
  bars.** This is an explicit owner adjudication recorded here, not a session
  loosening. Rationale: the confidence interval straddles the bar; 8 of the
  10 synthetic rotation sets c13-1 was itself accepted on measured below
  99.5 per-set (pooled synthetic acceptance was 98.0%); and the P0-runtime
  CONTRACT INVARIANT serves 0 dead boards to players regardless (the
  measured would-be reroll rate is 0.54%).
- **SERVING SCORER RULING (Ticket E5, in-session owner answer): production
  computes the daily slice with sliceDeck's DEFAULT tie-break scorer** — the
  ticket-literal 3-arg call. The screened acceptance scorer (64 candidates ×
  2048 oracle+chaser probes, sliceScorer.ts) costs 2–30 minutes on hard days
  and cannot run inside Convex (mutation or action). Served slices measure
  ~99.2% natural clear vs the instrument's screened 99.47%; the delta is
  invisible to players (P0-runtime rerolls either way; would-be reroll depth
  ~0.8% vs ~0.5%) and the P1a–P4 bands held under both policies in tuning.
  The screened scorer remains the acceptance INSTRUMENT for future slice
  profiles; the served policy is the generator + default scorer, and the
  board row pins the realized slice (sliceCardIds) so replay identity never
  depends on re-running selection.
