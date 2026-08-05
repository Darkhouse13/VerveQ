# CANDIDATE — `the-band`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**

## Axis

**Estimation** — numeric guessing with error bands.

## Loop (3 sentences)

Five sourced numeric quantities are put to you in a day — a career appearance
count, a transfer fee, a stadium capacity — and for each you submit not a
number but an **interval**, a low and a high you are willing to stand behind.
Containing the truth scores, and a narrower interval scores far more than a
wide one, so a wild guess wrapped in a huge band earns almost nothing. You hold
a single shared width budget across all five, so being honest about what you
don't know on question two is what buys you the precision to cash in on
question four.

The identity claim rests on that last sentence. The mode does not reward
knowing the number; it rewards **knowing how much you know**. A player with no
football knowledge who is well calibrated — wide where blind, tight where the
prompt structurally constrains the answer — beats a knowledgeable player who is
overconfident, which is the exact skill/knowledge inversion the platform wants.

## Heartbeat G2 — **THE SQUEEZE**

*One named moment: buying certainty with budget.*

After you set a band but before you submit it, one hint is offered — a real
sourced constraint that provably narrows where the truth can sit ("this figure
is higher than the same figure for X"). Taking it costs width from your shared
budget for the remaining questions.

So the moment is: *pay from the future to be sure now, or stay blind and keep
your room to manoeuvre.* It is BANK/PUSH's structure translated into
information rather than score — you are choosing between a certain smaller
outcome and an uncertain larger one, and the cost is paid by your later self.
It is a weaker heartbeat than DRAW's because nothing busts; the punishment is
attritional rather than sudden. That is stated plainly and priced in the
adrenaline score.

## Content G3 — data needed + source

| Datum | Source | Status in repo |
| --- | --- | --- |
| The quantity itself + its value | Wikidata (CC0) — the approved preferred backbone per `docs/CIE_SOURCING_POLICY.md` §3 | pattern present; **numeric stat properties are a new fetch** |
| Volatile figures (fees, valuations) | official federation / league publications (approved class: standards & governing bodies) | **new fetch** |
| Provenance envelope | `{qid, property, retrievedAt, sourceQuality}` | **present** as a shape in `playersSourced.json` |

Every quantity must be a **single unambiguous sourced figure with a snapshot
date**. That constraint does real work here: `CIE_SOURCING_POLICY.md` §4 rates
volatile numeric figures **AMBER** — ingest with corroboration, snapshot, and
avoid the soft parts. Appearance counts and fees drift between sources, and a
band game punishes ambiguity far more harshly than an MCQ does, because a
player can be *correct* and still be marked outside the band.

Consequence, stated as a design rule rather than discovered later: **only
GREEN-quality, snapshot-dated, corroborated figures are eligible.** That
shrinks the usable pool considerably and is the reason the refresh score below
is a 3 and not a 5.

## Uncertainty source

**Your own ignorance, made explicit and made scoreable.** There is no RNG
anywhere — the truth is fixed and sourced. What varies is how much of the
plausible space you can rule out from the prompt's structure, and the game's
entire scoring surface is built on making you price that honestly.

## Session shape

**daily** (primary) — five quantities, shared seed, ~3 minutes.
**duel** (secondary) — same five, better calibration wins; works but the
opponents never interact.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 3 | 9 | Watching the truth land just inside a tight band is a real spike, but it repeats five times without escalating and nothing ever busts. |
| Shareable artifact | ×3 | 3 | 9 | A row of five bars showing hit-or-miss plus total width is clean and novel, though "my bands were narrow" is a harder brag to land than a score or a streak. |
| Daily refresh w/o burn | ×2 | 3 | 6 | Any player crossed with any stat is a large space, but the GREEN-only, corroborated, unambiguous subset is far smaller than the raw combinatorics suggest. |
| Content cost (inv.) | ×2 | 3 | 6 | A new numeric-property fetch on top of an existing provenance pattern, plus per-figure corroboration that the AMBER rating in the sourcing policy makes mandatory. |
| Build cost (inv.) | ×2 | 5 | 10 | A two-handle slider and a scoring function — the lightest engine in the set, with no simulation, no solver, and no opponent modelling. |
| Prior-art headroom | ×2 | 4 | 8 | Estimania ships a daily five-question numeric estimation game with log-scale closeness scoring, but it scores point estimates rather than intervals, and no football-specific interval game surfaced in the sweep. |
| Social fit | ×1 | 3 | 3 | Shared-seed leaderboards are natural and the duel is legitimate, but there is no interaction and calibration is a quiet thing to compete over. |
| **TOTAL** | | | **51 / 75** | |

## Risk lines

1. **Explaining the scoring.** "Narrower is better if you're right" is one
   sentence, but players who do not internalise it will submit maximal bands,
   score zero, and leave. Onboarding carries unusual weight here.
2. **Ambiguity is fatal, not annoying.** Unlike an MCQ, a disputed figure makes
   a *correct* player wrong. The GREEN-only rule above is not optional polish.
3. **Trivia adjacency.** This is the candidate closest to the identity line.
   The band mechanic is what separates it from a numeric quiz, and if the
   harness shows knowledge still dominates outcomes, there is no second lever
   to pull — it would simply be trivia with sliders.
