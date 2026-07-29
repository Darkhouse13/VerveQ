# Weekend Fantasy — Base Scoring Formula (v0.4.1)

Status: **v0.4.1 — APPROVED by owner** (assists position-weighted; no
captaincy locked). Every number below is a placeholder to be
calibrated by the sim harness (same gate discipline as c13). The
*structure* is what's up for review, not the constants.

## Changelog

- v0.4.1a — xG note reworded to "provider-specific" (the previous
  "at this price tier" was tied to the free tier and is no longer
  accurate; no scoring change)
- v0.4.1 — crowd factor mirrors against negative bases
- v0.4 — Phase 2 gap rulings (G1–G6)
- v0.3 — feed-reality amendment per phase1 schema probe (2026-07-27)

## Design principles

1. **Eye-test alignment.** Every position must be able to score well
   from the things fans actually praise: a DM screening a midfield, a
   CB winning duels, a winger beating his man. Goals are not the only
   currency.
2. **Legibility.** A user must be able to reconstruct any player's
   score from the match ledger in under a minute. No opaque composite
   indices.
3. **Feed-realistic.** Only stats the feed was measured to carry for
   the top-5 leagues (phase1 schema probe, 2026-07-27): minutes;
   goals; assists; shots total and on target; key passes; accurate
   passes and total passes (both as counts — the feed does not
   supply a completion percentage); dribbles completed and
   attempted; tackles attempted (the feed has no won/lost split);
   interceptions; blocks (the feed carries **no** clearances field);
   duels won and duels contested; fouls committed and drawn; yellow
   and red cards (no second-yellow/straight-red split); saves; goals
   conceded; penalties won, conceded, scored, missed and saved. Own
   goals and substitution entry minutes come from the timed-events
   feed rather than the per-player stat line. No xG dependency
   (coverage is provider-specific).
4. **Anti-farming.** Volume stats have caps so tackle-farming on a
   bad team doesn't outscore actual quality.

## Universal events (all positions)

| Event | Points |
|---|---|
| Played 1–59 min | +1 |
| Played 60+ min | +2 |
| Goal (weighted by position, see templates) | +4 to +8 |
| Assist (weighted by position, see templates) | +3 to +6 |
| Team win, if played 60+ | +2 |
| Team draw, if played 60+ | +1 |
| Yellow card | −1 |
| Second yellow / straight red | −4 |
| Own goal | −3 |
| Penalty missed | −3 |
| Penalty won | +2 |
| Penalty conceded | −2 |

## Position templates

The template applied is the **slot position the user fielded**, not
the player's nominal position (see Mismatch section).

Two qualifiers apply to every template below:

- **Clean sheet requires 60+ minutes played (all positions).**
- **The concession penalty requires 60+ minutes played**, and team
  goals against are taken from the fixture score (MatchContext), not
  from player rows.

Clean sheets and concessions derive from MatchContext because
`goals.conceded` is keeper-only in the feed: in a 0–3 defeat every
outfield player's own row reads 0, so scoring off the player line
would award the whole back four a clean sheet.

### GK
- Goal: +8 · Assist: +6 · Save: +0.5 (cap +4) · Penalty saved: +6
- Clean sheet: +5 · Each 2 goals conceded: −1

### DEF
- Goal: +7 · Assist: +5
- Clean sheet: +4
- Tackle (attempted): +0.4 (cap +3) · Interception: +0.6 (cap +3)
- Block: +0.5 (cap +2)
- Duels won ≥ 60% with ≥ 6 contested: +2
- Each 2 goals conceded: −1

### MID  ← the Rodri fix lives here
- Goal: +6 · Assist: +4
- Tackle (attempted) or interception: +0.5 (combined cap +4)
- Key pass: +0.8 (cap +4)
- Dribble completed: +0.5 (cap +2)
- Pass completion ≥ 0.88 with ≥ 40 total passes: +2, where
  completion = accurate passes ÷ total passes (both counts, per feed)
- Clean sheet: +1

### ATT
- Goal: +5 · Assist: +3
- Shot on target: +0.5 (cap +2)
- Key pass: +0.8 (cap +4)
- Dribble completed: +0.5 (cap +3)
- No negative for goals conceded

Goals (GK 8 → ATT 5) and assists (GK 6 → ATT 3) are both inverted by
position so rare events from deep positions pay more — same logic FPL
uses for goals, extended to assists by owner decision.

## Finishers (2 slots)

- Score **only** from events at or after their entry minute —
  entry-minute events are **inclusive**. No participation floor:
  unused finisher = 0.
- All positive event points earned after the 75th minute are
  multiplied by **×1.25** (the **decisive-moment multiplier**).
  Applies to starters too? **No** — finisher slots only, otherwise
  it's just late-game inflation for everyone.
- The decisive-moment multiplier applies to **timestamped events
  only** — goals, assists and penalty events. This is a feed-data
  limit, not a design choice: the feed carries tackles, saves, key
  passes, dribbles, blocks and duels as match totals with no clock,
  so they cannot be placed after the 75th minute. The multiplier is
  therefore weaker for defensive and goalkeeping finishers than for
  attacking ones.
- Universal minutes points replaced by: any appearance as sub = +1.

## Position mismatch (locked mechanics, draft numbers)

- Verdict position comes from feed lineup data, overridable by
  reclamation court.
- If verdict ≠ fielded slot: the player's stat line is still scored
  through the **fielded slot's template**, then **×0.75 applied only
  when the templated base is positive; negative bases pass through
  undamped. Mis-slotting never outscores correct slotting.**
- If verdict = fielded slot: full points, no explicit bonus.
  Correctness is its own reward; the asymmetry the owner asked for
  comes from the dampener, not a bonus.

## Crowd multiplier (hook only — sized by sims)

crowd_factor is derived from the pairwise-vote ELO for that player's
gameweek performance, clamped to **±15%** at launch. Players below
the vote-liquidity threshold get crowd_factor = 0 (base score
stands). Threshold and clamp are sim-gated.

The factor mirrors against a negative base:

```
final = base ≥ 0 ? base × (1 + crowd_factor)
                 : base × (1 − crowd_factor)
```

The crowd factor is a judgment direction; a positive crowd verdict
must never worsen a score.

## Rounding

The engine returns scores **unrounded**. Display rounds to **1 dp**,
with ties rounded **away from zero** (−5.75 → −5.8, 5.75 → 5.8).

## Deliberately absent (each one is a removed FPL complaint)

- **No captaincy.** Captain doubling is the single biggest driver of
  template convergence in FPL. Removing it is a feature. **LOCKED by
  owner.**
- **No bonus point system.** The BPS is FPL's most-hated black box.
  Our crowd multiplier *is* the bonus system, and it's the fanbase.
- **No price changes from ownership.** Locked earlier.
- **No autosubs.** Locked earlier (per-fixture lock times instead).

## Known tensions for sim review

1. Duels/pass-accuracy threshold bonuses are step functions — cliff
   effects at 59.9% vs 60.1%. Sims should check how often scores
   hinge on them.
2. MID template may still undervalue pure destroyers if their
   key-pass count is near zero. Candidate fix: raise the combined
   defensive cap for MID.
3. Win/draw points reward players on strong teams regardless of
   personal performance. Kept small (+2) deliberately; sims to verify
   it doesn't dominate.
