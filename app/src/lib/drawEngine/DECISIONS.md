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
