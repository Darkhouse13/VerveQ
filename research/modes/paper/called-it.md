# CANDIDATE — `called-it`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**
> **Gambling-adjacency: HIGH. See risk lines — this is the flagged candidate.**

## Axis

**Prediction** — calling unresolved outcomes.

## Loop (3 sentences)

Each matchday you are given a slate of five real upcoming fixtures and, rather
than picking winners, you assign each outcome a **probability**. Scoring is a
proper scoring rule (Brier), so claiming 90% on something that happens beats
claiming 60%, and claiming 90% on something that does not is punished far
harder than claiming 60% would have been. Results settle when the matches
finish and your calibration curve updates across a rolling season.

The identity case, stated honestly: a well-calibrated newcomer who says 55% on
everything they cannot read will beat a knowledgeable fan who says 95% on their
own team every week. That inversion is real. But it is weaker here than
anywhere else in the set, because football knowledge genuinely *does* improve a
forecast, and pretending otherwise would be dishonest.

## Heartbeat G2 — **THE STAKE**

*One named moment: the confidence commit on the last fixture.*

Four fixtures are already priced. The fifth is presented alone with your
running season score visible beside it and a slider that starts at 50%. Moving
the slider past 80% in either direction triggers a confirm — the game makes you
say out loud that you are sure.

It is a named moment and it is irreversible. What it is not is a *session*
heartbeat: the resolution arrives hours or days later, outside the session, so
the spike is deferred past the point where the app can capture it. Every other
candidate in this set resolves its tension while the player is still holding
the phone. That structural fact is the honest reason for the adrenaline score
below and is not a tuning problem.

## Content G3 — data needed + source

| Datum | Source | Notes |
| --- | --- | --- |
| Upcoming fixture lists | official federation / league publications — approved class "Standards / governing bodies", `docs/CIE_SOURCING_POLICY.md` §3 | ongoing feed, not a one-time fetch |
| Match results for settlement | same | must be timely and correct; settlement is the product |
| Historical results for calibration baselines | Wikidata (CC0) for major competitions | sparse and slow for recent matches |

G3 **passes** — the source class is on the approved registry and the facts are
citable. Two exposures are named rather than buried:

1. **Database rights over fixture lists.** Fixture-list compilations have been
   the specific subject of EU database-right litigation. `CIE_SOURCING_POLICY.md`
   §2 explicitly warns that compilation rights exist independently of the facts
   being unprotectable. A source-approval pass under §7 is mandatory before any
   build, and the answer may well be that a licensed feed is required.
2. **Settlement is an operational dependency, forever.** Postponements,
   abandonments, VAR reversals and late kickoffs all have to be handled
   correctly and quickly or the mode is broken in public. This is unlike every
   other candidate here, whose content is inert once fetched.

## Uncertainty source

**Genuinely unresolved real-world events.** This is the only candidate whose
uncertainty is not authored, seeded, or epistemic — nobody knows the answer,
including us. That is its distinctive appeal and also the source of its
problems: outcome variance over a five-fixture slate swamps skill, and it takes
a large number of slates before calibration separates a good forecaster from a
lucky one.

## Session shape

**daily** — a slate per matchday. Very short session (~60 seconds), with the
payoff arriving asynchronously later.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 2 | 6 | The eventual outcome carries real charge but it lands days after the session ends, leaving the in-app moment almost flat. |
| Shareable artifact | ×3 | 2 | 6 | A slip of probabilities is postable but visually indistinguishable from the betting slips that already saturate football social feeds, so it borrows a form rather than owning one. |
| Daily refresh w/o burn | ×2 | 5 | 10 | The football calendar generates fresh content indefinitely at no cost to us — the strongest refresh position available. |
| Content cost (inv.) | ×2 | 2 | 4 | Not a fetch but a permanent operational dependency on a timely, correct results feed, plus a probable licensing bill for fixture data. |
| Build cost (inv.) | ×2 | 2 | 4 | The forecasting UI is trivial; settlement correctness — postponements, abandonments, VAR reversals — is where the entire cost sits and it never stops. |
| Prior-art headroom | ×2 | 1 | 2 | The sweep returned essentially nothing but prediction and betting-tips apps across an entire results page, making this the most saturated territory examined by a clear margin. |
| Social fit | ×1 | 4 | 4 | Pick-em pools and prediction leagues are a proven, natural social form with obvious league and duel shapes. |
| **TOTAL** | | | **36 / 75** | |

## Risk lines

1. **GAMBLING ADJACENCY — the flagged line.** Structurally this is a betting
   slip with the money removed. Consequences to weigh: app-store category and
   age-rating exposure; advertising restrictions in multiple jurisdictions;
   inbound partnership pressure from operators; and the reputational question
   of whether VerveQ wants to sit next to that industry at all. The Brier-score
   framing genuinely reduces the resemblance — you are scored on honesty rather
   than on winning — but it does not remove it, and a regulator reads mechanics
   rather than intent.
2. **Skill signal is slow.** Calibration needs dozens of slates to separate
   skill from luck, and most users will not stay long enough to see it.
3. **Weakest identity fit in the set.** Real football knowledge really does
   improve real forecasts. This is the candidate most likely to reward the
   knowledgeable player the platform's identity rule is trying to neutralise.
4. **Prior art plus operational cost together.** Either alone would be
   survivable. Both, on a saturated market with a permanent settlement
   liability, is why this scores where it does.
