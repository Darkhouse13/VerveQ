# Mode candidate batch R1.1 — paper scoring summary

> # ⚠️ PROVISIONAL — OWNER RATIFICATION REQUIRED
> **No adapter may be written for any candidate below until the owner ratifies
> this table.** These are paper scores from a paper design pass. Nothing here
> has been simulated, and in particular **no candidate has been run through the
> `recallShare` harness**, which is the only instrument that actually tests the
> hard identity rule. A high score here means "worth adapting next," never
> "build it."
>
> **No PASS/FAIL verdicts are given and no threshold is drawn.** Setting a
> threshold is an owner decision, consistent with `research/modes/README.md`.

**Date:** 2026-07-26 · **Candidates drafted:** 8 · **Scored:** 7 ·
**Gate-failed:** 1 · **Max score:** 75

## Gate results (applied before any scoring)

| Candidate | G2 — named heartbeat | G3 — sourceable content | Result |
| --- | --- | --- | --- |
| `daily-legend` | THE WINDOW | Wikidata `P54`/`P166`/`P1346` + federation records | scored |
| `tiebreak` | THE SPLIT REVEAL | none required (synthetic; DRAW decision 9 precedent) | scored |
| `lock-eleven` | THE LOCK | `playersSourced.json`, already in repo | scored |
| `rondo` | THE FREEZE | none required (procedural) | scored |
| `the-band` | THE SQUEEZE | Wikidata numerics, GREEN-only + snapshot | scored |
| `congestion` | THE ROTATION CALL | synthetic squads + authored fatigue model | scored |
| `called-it` | THE STAKE | official federation fixtures/results | scored |
| `freeze-frame` | THE REVEAL ✅ | **StatsBomb Open Data — unverifiable licence** ❌ | **GATE-FAIL (G3)** |

`freeze-frame` passed G2 and failed G3, so it receives **no score** per the
gate rule. Reasoning in `freeze-frame.md`; kill-log entry 2 in `KILL_LOG.md`.

## Scores — sorted descending

Weights: Adrenaline ×3 · Shareable ×3 · Refresh ×2 · Content ×2 (inverted,
5 = cheap) · Build ×2 (inverted, 5 = cheap) · Prior art ×2 · Social ×1.

| # | Candidate | Axis | Adren ×3 | Share ×3 | Refresh ×2 | Content ×2 | Build ×2 | Prior art ×2 | Social ×1 | **TOTAL** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `tiebreak` | Allocation | 4 → 12 | 3 → 9 | 5 → 10 | 5 → 10 | 4 → 8 | 5 → 10 | 5 → 5 | **64** |
| 2 | `lock-eleven` | Deduction | 4 → 12 | 4 → 12 | 5 → 10 | 5 → 10 | 4 → 8 | 2 → 4 | 4 → 4 | **60** |
| 3 | `rondo` | Tactical reading | 3 → 9 | 3 → 9 | 5 → 10 | 5 → 10 | 3 → 6 | 5 → 10 | 3 → 3 | **57** |
| 4 | `the-band` | Estimation | 3 → 9 | 3 → 9 | 3 → 6 | 3 → 6 | 5 → 10 | 4 → 8 | 3 → 3 | **51** |
| 5 | `daily-legend` | Valuation | 4 → 12 | 5 → 15 | 2 → 4 | 2 → 4 | 1 → 2 | 2 → 4 | 5 → 5 | **46** |
| 6 | `congestion` | Allocation | 2 → 6 | 2 → 6 | 5 → 10 | 4 → 8 | 2 → 4 | 4 → 8 | 2 → 2 | **44** |
| 7 | `called-it` | Prediction | 2 → 6 | 2 → 6 | 5 → 10 | 2 → 4 | 2 → 4 | 1 → 2 | 4 → 4 | **36** |
| — | `freeze-frame` | Tactical reading | — | — | — | — | — | — | — | **GATE-FAIL (G3)** |

Axis coverage: **all six** axes represented (Valuation 1 — the permitted
maximum; Estimation 1; Deduction 1; Allocation 2; Prediction 1; Tactical
reading 2, one of which gate-failed).

## Prior-art sweep — status and provenance

**SWEPT 2026-07-26. Web access was available; no `PROVISIONAL-NO-SWEEP` marks
are carried.** All prior-art scores are sweep-informed.

Queries run, and what each established:

| Query | Finding |
| --- | --- |
| soccerdraftgame.com daily football draft | Confirmed thick draft territory — soccerdraftgame.com, playfootball.games SuperDraft, fantasydailydraft.com. Reinforces DRAW's own competitive position. |
| daily football wordle-style modes 2026 | Very thick: footbadle (6 modes), Sportdle, Sportsdle, gridsport.games, Sportle, wordlefootball, wordlecup. |
| football Mastermind / hidden lineup deduction | Futboldle, Footle, FootballGenius "Guess The Club", MWM "Guess The Lineup" — all guess *one* answer with attribute feedback, none use set-membership counts. Drove `lock-eleven` to 2. |
| Destiny Eleven / career simulator | destinyeleven.com launched 2026-07-20, 150k players in 2 days; onze-de-reve.fr "Destin"; iOS Footballer Life Simulator. Confirms kill-log entry 1 and caps `daily-legend` at 2. |
| Colonel Blotto football browser game | Academic literature only (Borel 1921, arXiv, Wikipedia); no consumer football implementation. Drove `tiebreak` to 5. |
| calibration / interval estimation daily game | Estimania (daily, 5 numeric questions, log-scale closeness) — point estimates, not intervals. Drove `the-band` to 4. |
| tactical freeze-frame decision game | Academic (pass-selection MPNN, 1v1 shot game theory) and B2B (DrawTactics) only; no consumer daily. Drove `rondo` to 5. |
| free prediction game, Brier, no-money picks | Entire results page was prediction/betting-tips apps. Drove `called-it` to 1. |
| StatsBomb Open Data licence | README requires attribution; binding terms sit in an unread `LICENSE.pdf` (bespoke Public Data User Agreement). Caused the `freeze-frame` GATE-FAIL. |

**Sweep depth limits — stated so the scores are not over-trusted:**

1. `LICENSE.pdf` at `github.com/statsbomb/open-data` was **not readable** in
   this pass. This is the single highest-value follow-up: it alone decides
   whether `freeze-frame` is dead or merely blocked.
2. App-store catalogues (iOS/Android) were sampled through web results, **not
   enumerated**. A mobile-only competitor to `tiebreak` or `rondo` could exist
   and would not have surfaced.
3. Non-English markets were reached only incidentally (the French
   onze-de-reve.fr result). Spanish, Portuguese and Turkish football-game
   markets are large and were not swept.
4. Searches are US-region. Regional daily-game competitors may be
   under-represented.

## What the scores say — three findings

**1. Cheap-content candidates dominate the ranking, and that is a real signal
rather than an artifact of the weights.** The top three (`tiebreak`,
`lock-eleven`, `rondo`) all score 5/5 on content cost and 5/5 on refresh,
because they either need no football facts at all or need only the sourced
table already committed to the repo. Content cost and refresh carry ×2 each —
four of fifteen weight points between them — so this is not a rigged outcome;
these designs genuinely sidestep the platform's most expensive recurring bill.
The counterpoint the owner should weigh: content cheapness and *football feel*
are in tension throughout this set, and the ranking does not price feel.

**2. The two highest-adrenaline, most-shareable designs are the two most
expensive to build.** `daily-legend` posts the best shareable artifact in the
set (5/5 — your trophy cabinet beside the real one) and scores 4/5 on
adrenaline, yet lands fifth because build cost is 1/5 and prior art is 2/5.
`congestion` has the most authentically football decision anywhere here and
lands sixth. If the owner weights emotional payoff above delivery cost, the
ranking inverts substantially — which is precisely why thresholds are the
owner's call and not the analyst's.

**3. Identity risk is not scored, and it is not evenly distributed.** The
rubric has no criterion for "does a knowledgeable player beat a skilled one,"
because that is what the sim harness measures and paper scoring cannot. Ranking
by identity risk instead of by total gives almost the reverse order:
`tiebreak` and `rondo` are near-immune (no football knowledge exists to
apply), while `called-it` and `daily-legend` are the two most likely to fail
`recallShare` outright. **A high total here does not mean a candidate survives
the harness, and a low one does not mean it fails.**

## Suggested next step (owner decides)

Adapting a candidate to `ModeCandidate<S, A, Pub, Priv>` costs roughly the same
regardless of rank, so the informative move is to adapt across the risk
spectrum rather than straight down the table — one near-immune candidate as a
control and one high-identity-risk candidate that the harness could kill
outright. Ratification of this table comes first either way.

## Files

- `daily-legend.md` — Valuation (mandated) — 46
- `tiebreak.md` — Allocation — 64
- `lock-eleven.md` — Deduction — 60
- `rondo.md` — Tactical reading — 57
- `the-band.md` — Estimation — 51
- `congestion.md` — Allocation — 44
- `called-it.md` — Prediction — 36
- `freeze-frame.md` — Tactical reading — GATE-FAIL (G3)
- `KILL_LOG.md` — entry 1 `full-career-sim` (34/75, pre-ruled); entry 2
  `freeze-frame` (gate-fail)
