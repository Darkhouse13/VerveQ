# FS-1 Phase 2 — spec gaps found while implementing v0.3

> **RESOLVED — all six ruled on by the owner in SCORING_SPEC.md v0.4
> (2026-07-27).** This document is kept as the evidence behind those rulings,
> not as an open list. What shipped:
>
> | gap | v0.4 ruling |
> | --- | --- |
> | G1 | Clean sheet requires 60+ minutes played, all positions. |
> | G2 | Concession penalty requires 60+ minutes; team goals against from MatchContext. |
> | G3 | ×1.25 renamed **decisive-moment multiplier**; timestamped events only, stated as a feed-data limit. |
> | G4 | Entry-minute events are **inclusive**. |
> | G5 | ×0.75 applies only to a positive base; negative bases pass through undamped. Mis-slotting never outscores correct slotting. |
> | G6 | Engine returns unrounded; display rounds to 1 dp. |
>
> Two follow-ons from those rulings were reported and then settled in
> **v0.4.1 (2026-07-27)**:
>
> - The G5 ruling let negative bases survive, and the crowd multiplier was a
>   plain product — so a positive crowd factor made a negative score *more*
>   negative, punishing a sent-off player harder for being liked. v0.4.1 mirrors
>   the factor against a negative base
>   (`base ≥ 0 ? base × (1 + f) : base × (1 − f)`), on the rationale that the
>   crowd factor is a judgment direction. Cases 20 and 27.
> - v0.4 left the display rounding tie-break unnamed. Away-from-zero is now spec
>   text in §Rounding (−5.75 → −5.8, 5.75 → 5.8); `Math.round` would have broken
>   both toward +∞, shrinking negatives and growing positives by the same
>   half-tenth. −5.75 was reachable under v0.4, so the choice was not academic.

The engine implements SCORING_SPEC.md v0.3 exactly as written. Six places
required a decision the spec does not make, or ask for something the feed cannot
supply. All six are implemented **literally** and listed here as PROPOSALS for
v0.4. Nothing has been adjusted; the spec file is untouched.

Each gap carries the code `G1`–`G6` used in `scoring/scoring.ts`.

## G0 (blocking, already handled) — `goals.conceded` is goalkeeper-only

Not a spec gap but the input-plumbing fact that makes two spec terms computable
at all. MEASURED in probe fixture 1208070: West Ham conceded three goals; **only
their goalkeeper's row carries `conceded: 3`. Every outfield row carries 0.**

So `goals.conceded` is a keeper statistic, not a team one. Reading clean sheets
or the −1-per-2-conceded term off an outfield player's own line would hand every
defender in a 0–3 defeat a clean sheet **and** exempt them from the concession
penalty. The engine therefore takes team goals against from the fixture score via
an explicit `MatchContext`, not from the player line. No spec change needed — but
any other implementation of v0.3 will get this wrong unless told.

## G1 — clean sheet has no minutes qualifier

v0.3 says "Clean sheet: +5 / +4 / +1" with no participation condition. Implemented
literally: **a 1-minute substitute on a clean-sheet side collects the full clean
sheet points.** FPL requires 60 minutes.

*Proposal:* add a 60-minute qualifier, or state deliberately that there isn't
one. Phase 4 will report how often sub-60 appearances collect it.

## G2 — "each 2 goals conceded: −1" has no minutes qualifier either

Same shape, opposite sign, and the feed constrains it further: because of G0 there
is no way to know how many goals were conceded *while an outfield player was on
the pitch*. Implemented against team goals against for the whole match, so a
defender substituted at 30′ in a 0–4 defeat takes the full −2.

*Proposal:* accept the whole-match reading explicitly in v0.4, since the
alternative is not computable at this price tier.

## G3 — the closer multiplier can only reach timed events

v0.3 §Finishers: "All positive event points earned after the 75th minute are
multiplied by ×1.25."

The feed timestamps goals, assists, cards, penalties and own goals. It timestamps
**nothing else** — tackles, saves, key passes, dribbles, blocks and duels arrive
as match totals with no clock. So a finisher's 80th-minute tackle, save or key
pass cannot receive the multiplier, and no amount of care in the engine can
change that.

This is not neutral across positions. A finisher fielded in ATT is scored mostly
through goals and assists, which *are* timed, so the multiplier reaches most of
their upside. A finisher fielded in GK or DEF is scored mostly through saves,
tackles, interceptions and blocks, none of which are timed — **the closer
multiplier is close to inert for them.** Case 14 in `tests/scoring.test.ts` pins
this: a defensive finisher with six tackles after coming on at 70′ earns the
multiplier only on an 88′ penalty won, worth +0.5.

*Proposal:* either accept that the closer multiplier is an attacking mechanic and
say so, or replace it for untimed stats with something computable — e.g. scale a
finisher's untimed contributions by the share of their minutes that fell after
75′. The second keeps the intent but is no longer strictly "events after the
75th minute", so it needs an owner ruling, not a harness decision.

## G4 — "after their entry minute" is exclusive

Implemented strictly: `minute > entryMinute`. An event recorded in the same
minute as the substitution is excluded. A goal at 60′ by a player substituted on
at 60′ therefore does not count.

*Proposal:* confirm, or change to `>=`. Low frequency; Phase 4 will report how
many events in the sample fall exactly on an entry minute.

## G5 — the mismatch zero floor rewards mismatching a sent-off player

This is the one worth the most attention.

v0.3 §Position mismatch: "the player's stat line is still scored through the
fielded slot's template, then multiplied by **×0.75**, floored at zero. Never
negative from mismatch alone (cards etc. still apply)."

The literal text is `max(0, base × 0.75)`, and that is what the engine does. But
the two sentences pull in opposite directions:

| | fielded DEF, verdict DEF | fielded DEF, verdict ATT |
| --- | --- | --- |
| base (90′, yellow, red, 4 conceded) | −5 | −5 |
| after mismatch rule | — | `max(0, −3.75)` = **0** |
| **final** | **−5** | **0** |

Getting the position *wrong* is worth **+5** here. Any user with a red-carded
player is better off deliberately mis-slotting him, which inverts the whole point
of the mechanic — v0.3 says the asymmetry "comes from the dampener", and here the
dampener runs backwards.

The gloss "cards etc. still apply" reads as though negatives should survive the
floor, which the literal text does not do. Cases 16 and 17 in the test suite pin
both halves.

*Proposal:* apply the floor to the **dampener's effect** rather than the total —
i.e. a mismatch may never *improve* a score: `damped = base >= 0 ? base × 0.75 :
base`. That satisfies "never negative from mismatch alone" (a positive score
cannot be driven negative) while keeping "cards etc. still apply" (a negative
score stays negative). Owner decides; the engine will not change until v0.4 says
so.

## G6 — no rounding is specified

Totals are fractional by construction (0.4, 0.5, 0.8, ×1.25, ×0.75). v0.3 says
nothing about rounding, so totals are returned unrounded, with IEEE-754
representation noise suppressed at the 1e-9 level. That is noise suppression, not
rounding to a display precision: `0.4 × 3` is stored as `1.2000000000000002` and
is reported as `1.2`.

*Proposal:* decide a display precision for the UI. It does not affect ranking.

## What the engine guarantees

- Pure and deterministic — no I/O, no clock, no RNG. Case 21 asserts identical
  output including ledger for identical input.
- Every ledger entry's `points` sums exactly to the returned total, multiplier
  lines included (they carry the delta they introduced, not a factor to
  re-apply). Asserted on every case, so §Legibility is a test, not a hope.
- No import from `app/`, from THE DRAW engine, or from `fetch/`.
