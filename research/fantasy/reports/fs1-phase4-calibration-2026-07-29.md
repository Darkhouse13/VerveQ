# FS-1 Phase 4 — calibration report

**Date:** 2026-07-29
**Spec under test:** `specs/SCORING_SPEC.md` **v0.4.1** (APPROVED)
**Engine:** `scoring/scoring.ts`, implementing v0.4.1 exactly as written
**Sample:** season **2024**, 192 fixtures, 8,110 player-fixture rows, 5 leagues
**Raw results:** `reports/fs1-phase3-results-2026-07-29.json`
**Proposal effect measurements:** `reports/fs1-phase4-proposal-effects-2026-07-29.md`
**Sample integrity:** `reports/fs1-sample-integrity-2026-07-29.md`

---

## What this report is, and is not

It is **numbers and proposals**. Every proposal is a candidate for the owner to
accept, reject or modify; **setting a constant is an owner decision, not a
harness decision**, and nothing here has been applied to the spec. There are no
PASS/FAIL verdicts in this document, by design — a formula constant is not the
kind of thing that passes or fails, it is the kind of thing that is sized.

The *structure* of the formula was never under review. Every finding below is
about the size of a number or the position of a threshold.

---

## 1. Method

### 1.1 Reproducibility

`npx tsx sim/run.ts --n 2000 --out reports/fs1-phase3-results-2026-07-29.json`

Seeded (`--seed 20260729`), pure, offline. `sim/` and `scoring/` read `data/`
and nothing else — no network, no clock inside the computation, no
`Math.random`. Re-running the command reproduces the JSON byte-for-byte apart
from its `generatedAt` stamp. Runtime ~40s.

### 1.2 Scale

| Quantity | Value |
| --- | --- |
| Gameweeks (one league's sampled round each) | 20 |
| Squad generators | 3 |
| Squads per generator per gameweek | **2,000** |
| Total squads simulated | **120,000** |
| Player-fixture rows scored per configuration | 8,110 |
| Cap configurations swept | 0.5x, 1x, 2x |
| Crowd clamps swept | 0%, ±10%, ±15%, ±25% |

### 1.3 The three squad generators

| Generator | What it models | Information it uses |
| --- | --- | --- |
| `random` | the floor — a careless user | none; slots players regardless of nominal position |
| `form` | the realistic middle | **leave-one-out**: each player's mean score in the *other* sampled rounds of his league |
| `chalk` | the upper band | hindsight — samples the gameweek's top quartile |

The leave-one-out construction in `form` is the load-bearing honesty here.
Ranking players by their points *in the gameweek being scored* would make every
distribution look decisive and every cap look well-sized, because the generator
would be reading the answer sheet. **`form` never sees the gameweek it picks
for.** `chalk` deliberately does, and is labelled a hindsight probe rather than a
user model everywhere it appears.

All squads respect the landed FW-1 rules: 13 = XI + 2 finishers, formation
bounds GK 1 / DEF 3–5 / MID 2–5 / ATT 1–3, max 3 per club. Unfilled-slot rate
was **0.000** for all three generators, so no result below is contaminated by
empty slots.

### 1.4 Declared assumptions

**The crowd model is an assumption, not a measurement.** CROWD_VOTING has not
shipped, so there is no vote data. The sweep assumes the crowd broadly agrees
with the scoreline but not exactly:

```
signal = 2 x percentile(base score within gameweek) - 1
factor = clamp x ((1 - 0.4) x signal + 0.4 x uniform(-1, +1))
```

The noise weight of 0.4 matters and is the most challengeable number in this
report: at noise = 0 the crowd would only amplify the existing order, and
reordering would be near-impossible *by construction* — which would make any
clamp look safe for a reason that has nothing to do with the clamp. Absolute
stability figures in §7 move with this parameter. The *relative* comparison
between ±10 / ±15 / ±25% does not.

**The vote-liquidity threshold was not simulated.** It depends on vote volumes
that do not exist yet. Players below it take crowd_factor = 0 per spec; the sims
apply a factor to every player, which is the *pessimistic* case for stability.

**The budget invariant was not simulated.** `price` is null until the pricing
pass (BUDGET_MODE open item 1), so these are crew-mode squads, which carry no
budget. Nothing in this report speaks to budget sizing.

---

## 2. Finding — where points actually come from

Positive point mass across all played rows: **31,113.6**. Negative: −2,001.0.

| Group | Share of positive mass |
| --- | --- |
| **Participation** (minutes played) | **31.7%** |
| **Team result** (win/draw) | **12.8%** |
| *Participation + team result combined* | ***44.5%*** |
| Skill/volume stats (tackles, interceptions, key passes, dribbles, duels, blocks, saves, shots) | 33.1% |
| Goals + assists | 15.0% |
| Clean sheets | 6.9% |

Top individual terms:

| Term | Rows | Total points | Mean when present | Share |
| --- | --- | --- | --- | --- |
| `minutes.60plus` | 3,906 | 7,812 | 2.00 | 25.11% |
| `goals` | 497 | 3,117 | 6.27 | 10.02% |
| `result.win` | 1,464 | 2,928 | 2.00 | 9.41% |
| `mid.defensive` | 1,686 | 2,188 | 1.30 | 7.03% |
| `minutes.under60` | 2,052 | 2,052 | 1.00 | 6.60% |
| `assists` | 368 | 1,564 | 4.25 | 5.03% |
| `mid.keyPasses` | 1,130 | 1,555.2 | 1.38 | 5.00% |
| `def.cleanSheet` | 329 | 1,316 | 4.00 | 4.23% |
| `result.draw` | 1,061 | 1,061 | 1.00 | 3.41% |

**Reading.** Nearly half the positive mass in the system is earned before a
player does anything individually distinguishable: 44.5% comes from being on the
pitch and from the team's result. Goals and assists together are 15.0%.

This directly quantifies the spec's own **§Known tensions item 3** ("Win/draw
points reward players on strong teams regardless of personal performance. Kept
small (+2) deliberately; sims to verify it doesn't dominate"). At +2/+1 the
win/draw terms are 12.8% of positive mass — individually small per row, but
applied to 2,525 rows.

> **PROPOSAL P1 (participation weight).** Consider reducing the 60+ minute
> appearance point from +2 to +1, leaving 1–59 min at +1. **Measured effect:**
> participation share falls from **31.70% to 21.90%** of positive mass (positive
> mass 31,113.6 → 27,207.6); skill and goal terms rise proportionally.
> **Counter-consideration:** the appearance point is also what makes an unfilled
> or benched slot visibly cost something, and it is the least volatile part of a
> score. This is a taste call about how much of the game is selection versus
> performance.

> **PROPOSAL P2 (team result).** Consider reducing win/draw from +2/+1 to
> +1/+0.5. **Measured effect:** team-result share falls from **12.82% to 6.85%**
> of positive mass. The spec already flags this as a tension it wanted measured;
> 12.82% is the measurement. An alternative that preserves the "reward the win"
> feel without the flat subsidy is to gate the win point on 60+ minutes *and* a
> non-zero contribution in any template term.

---

## 3. Finding — the anti-farming caps effectively never bind

Design principle 4 is "Volume stats have caps so tackle-farming on a bad team
doesn't outscore actual quality." Measured bind rates across 8,110 rows:

| Capped term | Rows with term | Rows at cap | **Bind rate** | Mean raw | Mean points lost to cap |
| --- | --- | --- | --- | --- | --- |
| `mid.dribbles` | 922 | 18 | **1.9%** | 0.796 | 0.016 |
| `gk.saves` | 356 | 5 | **1.4%** | 1.497 | 0.010 |
| `mid.keyPasses` | 1,130 | 9 | **0.8%** | 1.385 | 0.008 |
| `att.keyPasses` | 598 | 4 | **0.7%** | 1.209 | 0.008 |
| `att.shotsOn` | 522 | 3 | **0.6%** | 0.708 | 0.003 |
| `att.dribbles` | 509 | 3 | **0.6%** | 0.773 | 0.003 |
| `mid.defensive` | 1,686 | 8 | **0.5%** | 1.302 | 0.004 |
| `def.blocks` | 573 | 2 | **0.4%** | 0.703 | 0.002 |
| `def.interceptions` | 960 | 4 | **0.4%** | 0.969 | 0.004 |
| `def.tackles` | 1,218 | 3 | **0.3%** | 0.831 | 0.001 |

Cap sensitivity sweep (all caps scaled together, played rows only):

| Caps | Mean | Median | p90 | Max | Mean delta vs spec |
| --- | --- | --- | --- | --- | --- |
| **0.5x** | 4.758 | 3.8 | 10.1 | 27.0 | **−0.128** |
| **1x (spec)** | 4.886 | 4.0 | 10.4 | 29.0 | 0 |
| **2x** | 4.894 | 4.0 | 10.5 | 29.0 | **+0.008** |

Per-position mean at 0.5x / 1x / 2x:

| Position | 0.5x | 1x | 2x |
| --- | --- | --- | --- |
| GK | 4.939 | 5.107 | 5.116 |
| DEF | 4.707 | 4.791 | 4.794 |
| MID | 5.159 | 5.352 | 5.365 |
| ATT | 4.090 | 4.156 | 4.162 |

**Reading.** Doubling every cap changes the average score by **+0.008 points** —
i.e. the caps at 2x are, to three decimal places, not there. At the spec's own
values they bind on between 0.3% and 1.9% of rows and remove a mean of at most
0.016 points. The anti-farming mechanism described in design principle 4 is
currently close to inoperative: essentially no real player in the top five
leagues produces enough volume in 90 minutes to reach these ceilings.

Two readings are available and they lead opposite ways, which is why this is a
proposal and not a verdict:

1. *The caps are correctly sized as circuit-breakers* — they exist for the
   pathological case, and the sample shows the pathological case is rare. Under
   this reading, nothing changes.
2. *The caps are decoration* — a mechanism that fires on 0.3% of rows is not
   shaping behaviour, and the spec's promise that caps prevent farming is
   effectively unbacked.

The reason the caps miss is visible in the raw distributions. Percentiles of the
pre-cap value, over rows that carry each term (`sim/proposals.ts`):

| Term | Spec cap | p80 | p85 | p90 | p95 | Max observed |
| --- | --- | --- | --- | --- | --- | --- |
| `gk.saves` | 4 | 2.0 | 2.5 | 3.0 | 3.5 | 5.5 |
| `def.tackles` | 3 | 1.2 | 1.2 | 1.6 | 2.0 | 3.6 |
| `def.interceptions` | 3 | 1.2 | 1.2 | 1.8 | 1.8 | 4.8 |
| `def.blocks` | 2 | 1.0 | 1.0 | 1.0 | 1.5 | 2.5 |
| `mid.defensive` | 4 | 2.0 | 2.0 | 2.5 | 3.0 | 5.5 |
| `mid.keyPasses` | 4 | 1.6 | 2.4 | 2.4 | 3.2 | 5.6 |
| `mid.dribbles` | 2 | 1.0 | 1.0 | 1.5 | 2.0 | 4.0 |
| `att.shotsOn` | 2 | 1.0 | 1.0 | 1.0 | 1.5 | 2.5 |
| `att.keyPasses` | 4 | 1.6 | 1.6 | 2.4 | 2.4 | 5.6 |
| `att.dribbles` | 3 | 1.0 | 1.0 | 1.5 | 1.5 | 3.5 |

Every cap sits at or above the **95th percentile** of its own term, and five of
the ten sit at or above the maximum ever observed. `def.tackles` is capped at 3
in a sample whose largest single value is 3.6.

> **PROPOSAL P3 (cap sizing).** If the caps are meant to shape behaviour rather
> than only to catch outliers, they need to come down substantially — halving
> all of them costs only 0.128 points/row on average. Setting each cap at its
> **p85–p90** puts bind rates in the 10–15% band: `def.tackles` 3 → 1.6,
> `def.interceptions` 3 → 1.8, `mid.defensive` 4 → 2.5, `mid.keyPasses` 4 → 2.4,
> `gk.saves` 4 → 2.5. (These are read directly off the table above, not
> estimated.)
> If instead the caps are intended purely as circuit-breakers, **PROPOSAL P3b**
> is to leave every value alone and reword design principle 4 to say so, since
> the current wording implies an active constraint that the data does not show.

---

## 4. Finding — the two step functions sit on crowded thresholds

The spec's **§Known tensions item 1** asks how often scores hinge on the cliffs.

| Bonus | Eligible rows | Paid | Pay rate | Rows near the line | **Cliff exposure** |
| --- | --- | --- | --- | --- | --- |
| DEF duels (≥60% on ≥6 contested) | 1,031 | 475 | 46.1% | 203 (within 5pp) | **19.7%** |
| MID pass completion (≥88% on ≥40 passes) | 560 | 269 | 48.0% | 213 (within 3pp) | **38.0%** |

Rows where removing the +2 would flip a non-negative score negative: 7 (duels),
1 (pass completion).

**Reading.** Both thresholds sit almost exactly at the median of their
population — they pay out on ~46–48% of eligible rows, which is the worst place
for a cliff to be, because it maximises the number of players near it. The pass
bonus is the sharper case: **38% of eligible midfielders are within 3 percentage
points of the line**, meaning roughly two in five have a 2-point swing decided by
one or two passes. The sign-flip counts are low, so the cliffs rarely change
whether a score is positive — they change its size.

> **PROPOSAL P4 (replace the cliffs with ramps).** Convert both step functions
> to linear ramps over the contested band, preserving the endpoints:
> duels `+2 x clamp((rate − 0.50) / 0.20, 0, 1)` on ≥6 contested, and pass
> completion `+2 x clamp((completion − 0.84) / 0.08, 0, 1)` on ≥40 passes. This
> removes the 59.9%-vs-60.1% discontinuity while leaving the maximum, the
> qualifying volumes and the ledger's legibility intact — the ledger line would
> read "duel dominance 63.2% → +1.32", which still reconstructs by hand.
>
> **Measured effect** (`sim/proposals.ts`):
>
> | Ramp | Rows changed | Gain | Lose | Mean change | Max gain | Max loss |
> | --- | --- | --- | --- | --- | --- | --- |
> | DEF duels | 374 | 133 | 241 | −0.100 | +0.909 | −1.000 |
> | MID passes | 264 | 119 | 145 | −0.067 | +0.978 | −1.000 |
>
> Worth stating plainly: a ramp is **not** point-neutral. Almost twice as many
> defenders lose points as gain them, because the band below the old line is more
> densely populated than the band above it, and the net effect is mildly
> deflationary (−0.10 and −0.07 points on affected rows). Nobody moves by more
> than 1 point either way. If point-neutrality matters, the ramp's top end can be
> raised above +2 to compensate; that is a second decision, not part of P4.
>
> **PROPOSAL P4b (cheaper alternative).** Keep the step but move each threshold
> off the median into a genuinely selective band — duels to 65%, pass completion
> to 91% — which lowers pay rates to a level where the bonus marks distinction
> rather than coin-flips. This does not remove the discontinuity, only the number
> of players standing on it.

---

## 5. Finding — the MID destroyer gap, and why the spec's candidate fix would not close it

The spec's **§Known tensions item 2**: "MID template may still undervalue pure
destroyers if their key-pass count is near zero. Candidate fix: raise the
combined defensive cap for MID."

Measured over 1,521 MID rows with 60+ minutes:

| Cohort | Rows | Mean | Median | p90 |
| --- | --- | --- | --- | --- |
| **Destroyers** (0 key passes, ≥4 tackles+interceptions) | 178 | **6.298** | 5.5 | 9.0 |
| **Creators** (≥2 key passes) | 444 | **9.498** | 9.0 | 15.0 |
| All MID 60+ | 1,521 | 7.092 | 6.3 | 12.3 |

The gap is **3.2 points at the mean (−34%)** and **3.5 at the median (−39%)**.

The decisive number is the last one: **the combined defensive cap binds on only
4 of the 178 destroyer rows (2.2%)**. Raising `MID_DEFENSIVE_CAP` — the spec's
own candidate fix — would therefore change the score of about four rows in
eight thousand. The cap is not what is holding destroyers down; the **rate** is.
At +0.5 per defensive action, a midfielder producing 6 tackles+interceptions
earns 3.0 points, against a creator's 4 key passes at +0.8 earning 3.2 plus the
higher likelihood of an assist.

> **PROPOSAL P5 (raise the MID defensive rate, not the cap).** Move
> `MID_DEFENSIVE` from +0.5 to +0.7 per action, cap unchanged at 4.
> **Measured effect** (`sim/proposals.ts`):
>
> | Config | Destroyer mean | Destroyer median | Creator mean | Gap | Cap bind rate (MID) |
> | --- | --- | --- | --- | --- | --- |
> | spec (0.5, cap 4) | 6.298 | 5.5 | 9.498 | −33.69% | 0.63% |
> | **proposed (0.7, cap 4)** | **7.117** | **6.5** | 9.896 | **−28.08%** | **8.16%** |
> | alt (0.7, cap 3) | 6.696 | 6.0 | 9.803 | −31.70% | 17.18% |
>
> Note the honest size of this: it closes roughly **one sixth** of the gap
> (33.7% → 28.1%), not a third — raising the rate lifts creators too, since they
> also make tackles. It does, however, bring the cap into play (0.63% → 8.16%),
> so P5 and P3 interact and should be decided together. This is offered
> *instead of* the spec's cap-raising candidate, which the measurement indicates
> would be inert.
>
> If the intent is to close the gap substantially rather than partially, the
> lever has to be one creators do not share — e.g. a defensive-actions bonus
> gated on low key-pass volume — which is a structural change and therefore
> outside what this harness may propose.

---

## 6. Finding — the decisive-moment multiplier is mostly unreachable, and unevenly so

v0.4.1 §Finishers applies ×1.25 to positive **timestamped** events after the
75th minute — a feed limit the spec already acknowledges ("weaker for defensive
and goalkeeping finishers"). Quantified:

| Measure | Value |
| --- | --- |
| Substitutions in the sample | 1,734 |
| Entered before the 75th minute | 955 |
| **With any post-75' timed event the multiplier could touch** | **104 (6.0%)** |

By nominal position:

| Position | Substitutions | With a post-75' timed event | Rate |
| --- | --- | --- | --- |
| ATT | 654 | 58 | **8.9%** |
| MID | 661 | 34 | **5.1%** |
| DEF | 415 | 12 | **2.9%** |
| GK | 4 | 0 | **0.0%** |

**Reading.** The multiplier reaches an attacking finisher **3.1x more often**
than a defensive one, and never reached a goalkeeper in 192 fixtures. Combined
with the integrity pass's finding that **the feed carries no event for a saved
penalty at all** (`penalty.saved` exists on the stat line but with no clock), a
GK finisher's single most valuable act — a late penalty save, priced +6 — can
never receive the multiplier under any circumstances.

> **PROPOSAL P6.** Two options, in order of preference:
> **(a)** Restrict the decisive-moment multiplier to a finisher's *goal and
> assist* events explicitly, and state in the spec that it is an attacking
> mechanic. This makes the asymmetry deliberate instead of incidental.
> **(b)** Keep it universal but add a flat late-impact term reachable by any
> finisher who enters after the 75th minute, so defensive and goalkeeping
> finishers have a non-zero path to the mechanic.
> A third option — deriving a clock for defensive actions — is **not** proposed:
> the feed does not carry one, and inventing timings is prohibited.

---

## 7. Finding — crowd clamp stability at ±10 / ±15 / ±25%

Squad-level rank stability against the unclamped ordering (120,000 squads;
crowd model per §1.4):

| Generator | Clamp | Spearman ρ | Pair inversion rate | Mean absolute shift (pts) |
| --- | --- | --- | --- | --- |
| `random` | ±10% | 0.99943 | 0.98% | 1.04 |
| `random` | ±15% | 0.99879 | 1.43% | 1.55 |
| `random` | ±25% | 0.99686 | 2.35% | 2.59 |
| `form` | ±10% | 0.99935 | 0.96% | 1.90 |
| **`form`** | **±15%** | **0.99857** | **1.50%** | **2.80** |
| `form` | ±25% | 0.99633 | 2.52% | 4.67 |
| `chalk` | ±10% | 0.99876 | 1.39% | 5.55 |
| `chalk` | ±15% | 0.99740 | 2.13% | 8.28 |
| `chalk` | ±25% | 0.99382 | 3.33% | 13.96 |

**Reading.** At the spec's launch clamp of **±15%**, the crowd reorders about
**1.5%** of squad pairs for a realistic (`form`) user and shifts a squad total by
**2.8 points** on average against a standard deviation of 14.5 — roughly a fifth
of a standard deviation. Raising the clamp to ±25% raises inversions to 2.5%;
lowering to ±10% drops them to 1.0%. The relationship is close to linear in the
clamp across all three generators, with no threshold effect anywhere in the
range.

The `chalk` row is the one to watch: strong squads are affected roughly twice as
much in absolute points (8.3 at ±15%), because the multiplier is proportional to
a larger base. The crowd matters more at the top of the table than the bottom.

> **PROPOSAL P7.** The measurements support **keeping ±15%** as the launch
> clamp: it is comfortably inside the region where the crowd is a tiebreaker
> rather than a re-ranker, and there is no discontinuity that would make ±10% or
> ±25% qualitatively different. If the product intent is for the crowd to be
> more *felt*, ±25% remains a re-ranking of only ~2.5% of pairs and is
> defensible on these numbers. **Caveat:** all three rows depend on the assumed
> crowd model (§1.4). Re-run this sweep against real vote data before treating
> the absolute percentages as settled.

---

## 8. Finding — per-position balance

Design principle 1: "Every position must be able to score well from the things
fans actually praise." Base scores, players who appeared:

| Position | n | Mean | Median | p75 | p90 | Max |
| --- | --- | --- | --- | --- | --- | --- |
| GK | 388 | 5.107 | 4.0 | 7.0 | 10.0 | 16.5 |
| DEF | 1,849 | 4.791 | 3.9 | 7.4 | 10.4 | 25.6 |
| MID | 2,349 | 5.352 | 4.5 | 7.9 | 10.9 | 29.0 |
| **ATT** | **1,372** | **4.156** | **2.8** | **6.5** | **10.0** | **26.8** |

**Reading.** Means are tightly grouped (4.16–5.35), which is the principle
holding at the aggregate. The distribution shape is not uniform, though:
**ATT's median is 2.8 against MID's 4.5**, a 38% lower typical outcome, while
their p90s are nearly identical (10.0 vs 10.9). Attackers are the boom-or-bust
position — a typical attacking performance scores meaningfully less than a
typical midfield one, and the position's reputation is carried by its tail. GK
is the mirror image: the highest floor relative to its ceiling (max 16.5, by far
the lowest of the four).

This is arguably the design working as intended — attacking returns *should* be
lumpy — but it is worth stating that a user fielding three attackers is taking
on variance the current numbers do not compensate.

> **PROPOSAL P8 — offered, and measured as ineffective.** No change is proposed
> to goal/assist weights, which are already position-inverted for exactly this
> reason. The obvious cheap lever for the ATT floor is `ATT_SHOT_ON` (+0.5, cap
> +2, only 1.18% of positive mass — the smallest skill term in the system), but
> raising it to +0.7 with a cap of 2.8 **moves the ATT mean 4.156 → 4.264 and
> leaves the median unchanged at 2.8**. It does not work, because the typical
> attacker in the sample has zero or one shot on target; the term is absent from
> the very rows that define the floor.
>
> Recorded as a measured negative result rather than dropped, so the same idea is
> not re-proposed later. Raising the ATT floor would require paying for something
> a quiet attacker actually does — the honest options are the universal
> participation and team-result terms (P1/P2, which move every position), or
> accepting the lumpiness as intended.

---

## 9. Squad-level distributions

Spec constants, no crowd, 40,000 squads per generator:

| Generator | Mean | SD | Min | p10 | Median | p90 | Max | Mismatched slots |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `random` | 30.81 | 11.34 | −1.6 | 16.95 | 29.95 | 45.88 | 91.13 | 71.5% |
| `form` | 51.10 | 14.53 | 5.6 | 33.0 | 50.30 | 70.10 | 129.60 | 0% |
| `chalk` | 111.05 | 16.94 | 57.4 | 90.6 | 109.70 | 133.50 | 192.10 | 0% |

**Reading.** The strategy ladder is clean and wide: informed selection is worth
**+20.3 points** over careless selection (+66%), and perfect hindsight a further
**+59.9** (+117%). A negative squad total is reachable but rare — the minimum
across 40,000 random squads was −1.6, so the floor is effectively zero rather
than deeply negative, which keeps a bad week from feeling punitive.

The `random` generator's 71.5% mismatched-slot rate is what exercises the ×0.75
dampener; that it still averages 30.8 points shows the dampener shapes rather
than destroys a careless squad.

---

## 10. Carried-forward feed limits

From `reports/fs1-sample-integrity-2026-07-29.md`, restated because they bound
what any future calibration can do:

1. **No "Second Yellow card" detail exists** anywhere in 3,209 events (780
   yellow, 38 red, zero second-yellow). v0.4.1 prices both reds at −4, so
   nothing is lost — but a spec that ever wants to distinguish them cannot.
2. **No event for a saved penalty.** `penalty.saved` is on the stat line with no
   clock. Drives §6.
3. **Cancelled goals are already excluded from `Goal` rows** — 26
   `Var | Goal cancelled` events exist and event goals still reconcile to the
   fixture score in 192/192 fixtures. No VAR interpretation is needed anywhere.
4. **`goals.conceded` is keeper-only**, which is why MatchContext supplies team
   goals against. Already settled in v0.4 (G2); re-confirmed at full scale.

---

## 11. Proposal summary

All impact figures below are **measured**, not estimated —
`sim/proposals.ts`, output archived at
`reports/fs1-phase4-proposal-effects-2026-07-29.md`.

| # | Area | Proposal | Measured impact |
| --- | --- | --- | --- |
| **P1** | Participation | 60+ min appearance +2 → +1 | participation share **31.70% → 21.90%** |
| **P2** | Team result | win/draw +2/+1 → +1/+0.5 | team-result share **12.82% → 6.85%** |
| **P3** | Caps | set each cap at its p85–p90 (values in §3) | bind rates **0.3–1.9% → 10–15%** |
| P3b | Caps | *alternative:* change nothing, reword design principle 4 | documentation only |
| **P4** | Step functions | replace both cliffs with linear ramps | 638 rows move, none by >1 pt; net **−0.10 / −0.07** pts on affected rows |
| P4b | Step functions | *alternative:* move thresholds to 65% / 91% | pay rates fall from ~47%; discontinuity remains |
| **P5** | MID destroyers | raise `MID_DEFENSIVE` +0.5 → +0.7 (**not** the cap) | destroyer gap **−33.69% → −28.08%**; MID cap bind **0.63% → 8.16%** |
| **P6** | Finishers | make the ×1.25 explicitly attacking, or add a flat late-impact term | addresses a measured **3.1x** ATT-vs-DEF reachability gap |
| **P7** | Crowd clamp | keep ±15% | **1.50%** pair inversion at `form`; linear in the clamp |
| ~~P8~~ | ATT floor | raise `ATT_SHOT_ON` +0.5 → +0.7 | **measured ineffective** — median unchanged at 2.8; recorded so it is not re-proposed |

Three cross-proposal interactions the owner should weigh together rather than
one at a time:

- **P3 and P5 interact.** Raising the MID defensive rate to +0.7 pushes that
  cap's bind rate from 0.63% to 8.16% on its own; adopting P3's smaller caps as
  well would compound it. Decide the rate first, then the cap against the new
  distribution.
- **P1 and P2 both deflate every score.** Adopted together, positive mass falls
  by roughly a quarter, which changes what a "good week" looks like in absolute
  terms and would want a pass over any copy or UI that quotes typical totals.
- **P1/P2 are the only levers that reach the ATT floor** (§8), since a quiet
  attacker earns almost nothing else. If the ATT median is a concern, it argues
  *against* P1/P2 rather than for a new attacking term.

**Every one of these is an owner decision.** None has been applied. The spec is
untouched at v0.4.1.

---

## 12. What was not tested, and why

| Area | Why not |
| --- | --- |
| Budget invariant / price sizing | `price` is null — BUDGET_MODE open item 1. Squads simulated are crew-mode, which carries no budget. |
| Vote-liquidity threshold | Requires vote volumes that do not exist; CROWD_VOTING has not shipped. |
| Reclamation court overrides | RECLAMATION_COURT is a separate spec; verdict positions here come from the feed only. |
| Real crowd behaviour | Modelled, declared in §1.4, and flagged wherever its numbers are used. |
| Season 2026 data | The sample is season 2024 (the newest the free tier served when the pull began). The Pro key now serves 2026, so a re-run against a live season is possible and would be the natural Phase 5. |
