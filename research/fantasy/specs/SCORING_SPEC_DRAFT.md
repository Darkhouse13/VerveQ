# Weekend Fantasy — Base Scoring Formula (DRAFT v0.1)

Status: **v0.2 — APPROVED by owner** (assists position-weighted; no captaincy locked). Every number below is a placeholder to be
calibrated by the sim harness (same gate discipline as c13). The *structure*
is what's up for review, not the constants.

## Design principles

1. **Eye-test alignment.** Every position must be able to score well from the
   things fans actually praise: a DM screening a midfield, a CB winning duels,
   a winger beating his man. Goals are not the only currency.
2. **Legibility.** A user must be able to reconstruct any player's score from
   the match ledger in under a minute. No opaque composite indices.
3. **Feed-realistic.** Only stats that affordable feeds reliably provide for
   the top-5 leagues: minutes, goals, assists, shots (on target), key passes,
   pass accuracy, dribbles completed, tackles won, interceptions,
   clearances/blocks, duels won, fouls, cards, saves, goals conceded,
   penalties saved/missed. No xG dependency (coverage is inconsistent at this
   price tier).
4. **Anti-farming.** Volume stats have caps so tackle-farming on a bad team
   doesn't outscore actual quality.

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

The template applied is the **slot position the user fielded**, not the
player's nominal position (see Mismatch section).

### GK
- Goal: +8 · Assist: +6 · Save: +0.5 (cap +4) · Penalty saved: +6
- Clean sheet: +5 · Each 2 goals conceded: −1

### DEF
- Goal: +7 · Assist: +5
- Clean sheet: +4
- Tackle won: +0.6 (cap +3) · Interception: +0.6 (cap +3)
- Clearance/block: +0.25 (cap +2)
- Duels won ≥ 60% with ≥ 6 contested: +2
- Each 2 goals conceded: −1

### MID  ← the Rodri fix lives here
- Goal: +6 · Assist: +4
- Tackle won or interception: +0.6 (combined cap +4)
- Key pass: +0.8 (cap +4)
- Dribble completed: +0.5 (cap +2)
- Pass accuracy ≥ 88% with ≥ 40 passes: +2
- Clean sheet: +1

### ATT
- Goal: +5 · Assist: +3
- Shot on target: +0.5 (cap +2)
- Key pass: +0.8 (cap +4)
- Dribble completed: +0.5 (cap +3)
- No negative for goals conceded

Goals (GK 8 → ATT 5) and assists (GK 6 → ATT 3) are both inverted by
position so rare events from deep positions pay more — same logic FPL uses
for goals, extended to assists by owner decision.

## Finishers (2 slots)

- Score **only** from events after their entry minute. No participation
  floor: unused finisher = 0.
- All positive event points earned after the 75th minute are multiplied by
  **×1.25** (the "closer" multiplier). Applies to starters too? **No** —
  finisher slots only, otherwise it's just late-game inflation for everyone.
- Universal minutes points replaced by: any appearance as sub = +1.

## Position mismatch (locked mechanics, draft numbers)

- Verdict position comes from feed lineup data, overridable by reclamation
  court.
- If verdict ≠ fielded slot: the player's stat line is still scored through
  the **fielded slot's template**, then multiplied by **×0.75**, floored at
  zero. Never negative from mismatch alone (cards etc. still apply).
- If verdict = fielded slot: full points, no explicit bonus. Correctness is
  its own reward; the asymmetry the owner asked for comes from the dampener,
  not a bonus.

## Crowd multiplier (hook only — sized by sims)

Final score = base score × (1 + crowd_factor), where crowd_factor is derived
from the pairwise-vote ELO for that player's gameweek performance, clamped to
**±15%** at launch. Players below the vote-liquidity threshold get
crowd_factor = 0 (base score stands). Threshold and clamp are sim-gated.

## Deliberately absent (each one is a removed FPL complaint)

- **No captaincy.** Captain doubling is the single biggest driver of template
  convergence in FPL. Removing it is a feature. **LOCKED by owner.**
- **No bonus point system.** The BPS is FPL's most-hated black box. Our
  crowd multiplier *is* the bonus system, and it's the fanbase.
- **No price changes from ownership.** Locked earlier.
- **No autosubs.** Locked earlier (per-fixture lock times instead).

## Known tensions for sim review

1. Duels/pass-accuracy threshold bonuses are step functions — cliff effects
   at 59.9% vs 60.1%. Sims should check how often scores hinge on them.
2. MID template may still undervalue pure destroyers if their key-pass count
   is near zero. Candidate fix: raise the combined defensive cap for MID.
3. Win/draw points reward players on strong teams regardless of personal
   performance. Kept small (+2) deliberately; sims to verify it doesn't
   dominate.
