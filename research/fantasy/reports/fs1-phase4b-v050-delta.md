# FS-1 Phase 4b — v0.4.1 → v0.5.0 combined-run delta

**Date:** 2026-07-29
**Ticket:** FW-S2 (owner-authorized amendment applying the P1–P8 rulings)
**Baseline:** `reports/fs1-phase3-results-2026-07-29.json` — SCORING_SPEC v0.4.1
**This run:** `reports/fs1-phase4b-v050-2026-07-29.json` — SCORING_SPEC v0.5.0
**Command:** `npx tsx sim/run.ts --n 2000 --seed 20260729 --out reports/fs1-phase4b-v050-2026-07-29.json`
(same seed and scale as FS-1: 20 gameweeks, 8,110 player-fixture rows,
120,000 squads). Byte-reproducibility re-verified: two runs identical
apart from the `generatedAt` stamp. All 33 acceptance tests pass
against the re-pinned v0.5.0 expectations.

---

## STATUS: RESOLVED — band (b) closed by owner ruling (option i)

Four of the five acceptance bands passed outright. Band **(b)** —
destroyer gap ≈ −28% ±2pp — measured **−31.32%**, triggering the
ticket's stop-and-report clause; the amendment was held unpushed
pending an owner ruling. **The owner ruled option (i): −31.32% is
accepted as the correct combined consequence of the rulings as made,
and band (b) is closed as a ticket-authoring error** — the ≈−28%
figure was an isolation artifact (FS-1 measured P5 at v0.4.1
participation levels), not an implementation defect. Analysis in §6.
P5's rate stays +0.7; option (ii) (re-opening the rate) was rejected —
a higher rate lifts creators too, pushes the MID cap bind past its
deliberate ~8%, and the remaining gap belongs to the structural
destroyer-gated lever, which stays unruled and out of scope.

| Gate | Band | Measured | Verdict |
| --- | --- | --- | --- |
| a. participation share | ≈22% ±2pp | **22.95%** | PASS |
| a. team-result share | ≈7% ±1.5pp | **7.68%** | PASS |
| a. combined | < 32% | **30.63%** | PASS |
| b. destroyer gap | ≈−28% ±2pp (vs −33.69%) | **−31.32%** | **CLOSED BY RULING** (improved; band was a ticket-authoring error, measured value accepted) |
| c. ramp movement | no row moves > 1.0 pt | max abs move **1.00** (duels and passes) | PASS |
| d. finisher multiplier | never fires on non-goal/assist | structural: `DECISIVE_KINDS = ['goal','assist']`; pinned by test case 14 (88' penalty won: no multiplier line) | PASS |
| e. squad means | fall for all generators; random < form < chalk | −6.0 / −9.6 / −12.3; 24.8 < 41.5 < 98.8 | PASS |

---

## 1. Positive-mass shares by group

Positive point mass fell 31,113.6 → **25,961.6** (−16.6%), which is
P1+P2 doing exactly what they were accepted to do.

| Group | v0.4.1 | v0.5.0 |
| --- | --- | --- |
| Participation | 9,864 (31.70%) | 5,958 (**22.95%**) |
| Team result | 3,989 (12.82%) | 1,994.5 (**7.68%**) |
| *Combined* | *44.52%* | ***30.63%*** |
| Skill/volume | 10,296.6 (33.09%) | 11,045.1 (**42.54%**) |
| Goals + assists | 4,681 (15.04%) | 4,681 (18.03%) |
| Clean sheets | 2,141 (6.88%) | 2,141 (8.25%) |
| Penalty terms | 142 (0.46%) | 142 (0.55%) |

The system's center of gravity moved from showing up to doing things:
skill terms now carry more positive mass (42.5%) than participation
and team result combined (30.6%). At v0.4.1 the reverse held by 11pp.

## 2. Top terms, v0.5.0 (v0.4.1 in parentheses)

| Term | Rows | Total points | Mean when present | Share |
| --- | --- | --- | --- | --- |
| `minutes.appearance` | 5,958 | 5,958 | 1.00 | 22.95% (was 60plus 25.11% + under60 6.60%) |
| `goals` | 497 | 3,117 | 6.27 | 12.01% (10.02%) |
| `mid.defensive` | 1,686 | 2,991.4 | 1.77 | 11.52% (7.03%) |
| `assists` | 368 | 1,564 | 4.25 | 6.02% (5.03%) |
| `mid.keyPasses` | 1,130 | 1,555.2 | 1.38 | 5.99% (5.00%) |
| `result.win` | 1,464 | 1,464 | 1.00 | 5.64% (9.41%) |
| `def.cleanSheet` | 329 | 1,316 | 4.00 | 5.07% (4.23%) |
| `def.tackles` | 1,218 | 1,010.6 | 0.83 | 3.89% (3.25%) |
| `def.interceptions` | 960 | 926.4 | 0.97 | 3.57% (2.98%) |
| `def.duels` | 608 | 912.7 | 1.50 | 3.52% (3.05%) |

`mid.defensive` is the biggest riser (P5: rate +0.5 → +0.7), now the
third-largest term in the system. `def.duels` now appears on 608 rows
(was 475 paid under the step) at a lower mean (1.50 vs 2.00) — the
ramp spreading the same mechanic over more rows, as designed.

## 3. Destroyer gap (MID, 60+ minutes)

| Config | Destroyer mean / median | Creator mean / median | Gap (mean) | Cap bound on destroyers |
| --- | --- | --- | --- | --- |
| v0.4.1 | 6.298 / 5.5 | 9.498 / 9.0 | −33.69% | 4/178 (2.2%) |
| v0.5.0 | 5.679 / 5.3 | 8.269 / 7.4 | **−31.32%** | 45/178 (25.3%) |

MID combined defensive cap bind rate across all MID term rows:
0.47% → **6.35%**. FS-1's 8.16% figure for P5 is not contradicted:
`sim/proposals.ts` computed it over MID rows with **60+ minutes**
(the destroyer-analysis population), while `run.ts`'s bind table uses
all rows carrying the term regardless of minutes — sub-60 rows rarely
reach 6+ defensive actions and dilute the rate. Same bind criterion,
same stats; on the 60+ population this run reproduces FS-1's number,
so design principle 4's "~8% by design" reads on that population.

## 4. Per-position (played rows only)

| Position | v0.4.1 mean / median | v0.5.0 mean / median | p90 (old → new) |
| --- | --- | --- | --- |
| GK | 5.107 / 4.0 | 3.629 / 2.5 | 10.0 → 8.0 |
| DEF | 4.791 / 3.9 | 3.663 / 2.55 | 10.4 → 8.6 |
| MID | 5.352 / 4.5 | 4.704 / 3.8 | 10.9 → 9.7 |
| ATT | 4.156 / 2.8 | 3.448 / 2.0 | 10.0 → 8.3 |

Every position deflates (P1/P2 are universal); MID deflates least
(P5 pushes against the tide), which narrows the MID-vs-ATT mean gap
slightly (1.20 → 1.26 — effectively unchanged) while GK loses the
most (its score was participation-heaviest). The FS-1 §11 warning
that P1/P2 are the only levers reaching the ATT floor is visible
here: ATT median 2.8 → 2.0.

## 5. Squad-level distributions (spec constants, no crowd, 40,000/generator)

| Generator | v0.4.1 mean / sd / median / p90 | v0.5.0 mean / sd / median / p90 | Mean delta |
| --- | --- | --- | --- |
| random | 30.81 / 11.34 / 29.95 / 45.88 | 24.81 / 9.91 / 23.88 / 38.03 | **−6.00** |
| form | 51.10 / 14.53 / 50.30 / 70.10 | 41.48 / 12.71 / 40.60 / 58.20 | **−9.62** |
| chalk | 111.05 / 16.94 / 109.70 / 133.50 | 98.77 / 16.29 / 97.32 / 120.29 | **−12.28** |

Ordering preserved; the strategy ladder is intact (informed selection
+16.7 over careless, +67%; hindsight a further +57.3). The `random`
floor stays effectively zero (min −1.4). Crowd stability at ±15% is
unchanged to the third decimal (form: Spearman 0.99857 → 0.99872,
pair inversions 1.50% → 1.51%).

## 6. Ramp-affected rows (P4) — and the band-(b) analysis

| Ramp | Eligible | Term pays now | Changed vs step | Gained / lost | Mean Δ on changed | Max gain / max loss |
| --- | --- | --- | --- | --- | --- | --- |
| DEF duels | 1,031 | 608 | 356 | 133 / 223 | −0.105 | +0.91 / −1.00 |
| MID passes | 560 | 388 | 264 | 119 / 145 | −0.067 | +0.98 / −1.00 |

No row moves by more than 1.00 pt (the −1.00 extreme is a row sitting
exactly on the old threshold, which the ramp midpoint now pays +1
instead of +2). Matches FS-1 §4's isolated measurement almost exactly.

**Why band (b) was missed.** FS-1 §5 measured P5 in isolation:
destroyers 7.117, creators 9.896, gap −28.08% — *at v0.4.1
participation and team-result levels*. P1 then removes exactly 1.0
point from every 60+ row (both cohorts are 60+ by construction) and
P2 removes another ~0.4–0.7 mean. Subtracting the same absolute
amount from both cohorts leaves the absolute gap unchanged but
shrinks both means, so the **relative** gap mechanically widens back
to ≈−33% (−32.7% to −33.9% across plausible team-result mixes,
computable from FS-1's own published numbers). The measured −31.32%
is *better* than that arithmetic floor because the pass ramp pays
destroyers' sub-88% completions. There is no unexplained effect
direction and no engine anomaly — the ≈−28% expectation could not
survive combination with P1/P2 under any implementation.

**RULED (owner, 2026-07-29): option (i) accepted.** Band (b) is
closed as a ticket-authoring error; the measured −31.32% stands as
the correct combined consequence of the rulings. Option (ii) —
re-opening P5's rate — is rejected: a higher rate lifts creators too,
pushes the MID cap bind past its deliberate ~8%, and the remaining
gap belongs to the structural destroyer-gated lever (FS-1 §5's
"lever creators do not share"), which stays unruled and out of scope.

## 7. Copy sweep — copy quoting example/typical point totals (report-only, no edits)

| Location | What it quotes | Note |
| --- | --- | --- |
| `research/fantasy/DECISIONS_FW2RUN.md:453` | "51.10 / 111.05" — v0.4.1 form/chalk squad means | Decision-log history; now-stale as *typical totals* (v0.5.0: 41.48 / 98.77) |
| `research/fantasy/DECISIONS_FW2RUN.md:466` | "+0.008 points" cap-sweep mean | Historical measurement record; unaffected in substance |
| `app/` | — | **No fantasy point totals are quoted anywhere in app copy.** The only numeric "pts" strings are quiz-mode fixtures ("444 pts" in `app/src/test/homeDrawCardContract.test.tsx`, `drawRarityPopulationContract.test.tsx`) belonging to a different scoring system; remaining grep hits are Tailwind `pt-*` class names. The WEEKEND teaser (`ShellHomeScreen.tsx`) quotes no totals. |

No app/ edits made or needed.

---

*Produced by ticket FW-S2. The stop-and-report on band (b) was
resolved by owner ruling (§6, option i) and the amendment pushed with
this report.*
