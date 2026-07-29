# Weekend Fantasy — Base Scoring Formula (v0.5.1)

Status: **v0.5.1 — LOCKED by owner** (assists position-weighted; no
captaincy locked). The constants below are no longer placeholders:
they were calibrated by the FS-1 sim harness
(`reports/fs1-phase4-calibration-2026-07-29.md`) and settled by owner
rulings on proposals P1–P8. **The spec remains LOCKED — v0.5.1 is
editorial only, scoring structure and constants are unchanged since
v0.5.0, and neither changes without a new owner ruling backed by a new
measurement.**

## Changelog

- v0.5.1 — editorial closeout of the v0.5.0 blind verification
  (`reports/fs1-blind-verify-v050-2026-07-29.md`); **no scoring
  change**:
  - universal-table goal range corrected "+4 to +8" → "+5 to +8" (the
    templates pay +5 to +8; no position pays +4);
  - card pricing stated explicitly: yellows and a red on the same row
    are additive (second-yellow dismissal = −1 −1 −4 = −6);
  - design principle 4's MID defensive cap bind rate restated
    precisely (8.16% of 60+ MID rows, calibration sample; 6.35% of
    term rows in phase-4b);
  - ramp quantisation pinned: 2 dp, round half-up.
  The freeze stands: LOCKED, no structural or constant change without
  a new owner ruling backed by a new measurement.
- v0.5.0 — FS-1 Phase 4 calibration rulings (owner rulings on P1–P8,
  basis `reports/fs1-phase4-calibration-2026-07-29.md`):
  - **P1 accepted** — appearance is a flat +1 for any minutes played
    (the 60+ minute point drops from +2 to +1; one ledger line).
  - **P2 accepted, simple form** — team win +2 → +1, draw +1 → +0.5.
    The contribution-gated alternative was rejected.
  - **P3 rejected / P3b accepted** — no cap value changes; design
    principle 4 reworded to name the caps as outlier circuit-breakers.
  - **P4 accepted** — both step bonuses (DEF duels, MID pass
    completion) replaced by linear ramps with endpoints and
    qualifying volumes preserved.
  - **P5 accepted** — MID defensive rate +0.5 → +0.7 per action, cap
    unchanged at 4; supersedes the former Known-tensions candidate
    fix (raising the cap), which FS-1 measured as inert.
  - **P6 accepted, option (a)** — the ×1.25 decisive-moment
    multiplier applies only to a finisher's goal and assist events
    after 75'; declared an attacking mechanic.
  - **P7 accepted** — crowd clamp stays ±15% (re-validate against
    real vote data post-launch).
  - **P8** — no scoring change; ATT boom-or-bust distribution
    recorded as accepted design in Known tensions.
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
4. **Anti-farming, sized as circuit-breakers.** Volume stats have
   caps, but the caps are **outlier circuit-breakers, not an active
   balancing mechanism**: each is sized at or above ~p95 of the
   volumes actually observed in the top-5 leagues (FS-1 §3), so they
   bind rarely and exist to stop pathological tackle-farming rather
   than to shape ordinary scores. One deliberate exception: after the
   v0.5.0 MID defensive rate increase (P5), the MID combined
   defensive cap binds on 8.16% of 60+ MID rows (phase-4 calibration
   sample; 6.35% over all rows carrying the term in phase-4b)
   **by design** — that is the P5/P3 interaction the owner accepted.

## Universal events (all positions)

| Event | Points |
|---|---|
| Appearance (any minutes played) | +1 |
| Goal (weighted by position, see templates) | +5 to +8 |
| Assist (weighted by position, see templates) | +3 to +6 |
| Team win, if played 60+ | +1 |
| Team draw, if played 60+ | +0.5 |
| Yellow card | −1 |
| Second yellow / straight red | −4 |
| Own goal | −3 |
| Penalty missed | −3 |
| Penalty won | +2 |
| Penalty conceded | −2 |

Card points are **additive within a row**: yellows and a red on the
same stat line each price separately, so a second-yellow dismissal —
which the feed reports as two yellows plus a red — scores
−1 −1 −4 = **−6**. The feed carries no second-yellow event type
(design principle 3), so both red types price −4.

Appearance is deliberately flat (P1): one ledger line, +1 for any
minutes, no 60-minute tier. The 60-minute threshold still gates the
team-result points, clean sheets and the concession penalty — it is
the appearance *reward* that no longer scales with it. The win/draw
points carry no contribution condition: the gated alternative in the
FS-1 report was considered and **rejected** (P2, simple form).

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
- Duel-dominance ramp (≥ 6 contested):
  **+2 × clamp((duelRate − 0.50) / 0.20, 0, 1)**, where duelRate =
  duels won ÷ duels contested
- Each 2 goals conceded: −1

### MID  ← the Rodri fix lives here
- Goal: +6 · Assist: +4
- Tackle (attempted) or interception: +0.7 (combined cap +4)
- Key pass: +0.8 (cap +4)
- Dribble completed: +0.5 (cap +2)
- Pass-completion ramp (≥ 40 total passes):
  **+2 × clamp((completion − 0.84) / 0.08, 0, 1)**, where
  completion = accurate passes ÷ total passes (both counts, per feed)
- Clean sheet: +1

**Ramps, not steps (P4).** v0.4.1's two threshold bonuses (duels
≥ 60% → +2; completion ≥ 88% → +2) were step functions sitting almost
exactly on the median of their eligible populations — FS-1 §4 measured
38% of eligible midfielders within 3pp of the pass cliff. v0.5.0
replaces both with linear ramps that preserve the endpoints (the
maximum stays +2, zero stays zero) and the qualifying volumes
(≥ 6 contested, ≥ 40 passes). The old cliff positions (60% duels,
88% completion) now sit at the ramp midpoint and pay +1; full +2
requires 70% / 92%, and the ramp reaches zero at 50% / 84%. The +2 top end was deliberately NOT
raised. Ramp points are computed and shown to **2 dp, rounded
half-up** (0.625 → 0.63) so the ledger line still reconstructs by
hand — e.g. "duel dominance 63.2% → +1.32".

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
- A finisher's **goal and assist events after the 75th minute** are
  multiplied by **×1.25** (the **decisive-moment multiplier**).
  Applies to starters too? **No** — finisher slots only, otherwise
  it's just late-game inflation for everyone.
- The decisive-moment multiplier is an **attacking mechanic by
  ruling** (P6a, v0.5.0): it applies to goal and assist events only,
  not to penalty events or anything else. The DEF/GK path is
  **intentionally absent**, and here is why it cannot be otherwise:
  the feed carries no clock for defensive actions (tackles, blocks,
  duels, saves arrive as match totals) and **no event at all for a
  saved penalty** (`penalty.saved` exists only on the un-clocked stat
  line) — FS-1 §6/§10. v0.4.1 applied the multiplier to "positive
  timestamped events" including penalties won/saved, which reached an
  attacking finisher 3.1× more often than a defensive one and never
  reached a goalkeeper in 192 fixtures; v0.5.0 makes the asymmetry
  deliberate instead of incidental.
- Appearance as sub = +1 (same flat appearance point as everyone
  else since v0.5.0; a finisher's is labelled separately in the
  ledger because it has no 60-minute history to inherit).

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

## Crowd multiplier

crowd_factor is derived from the pairwise-vote ELO for that player's
gameweek performance, clamped to **±15%** at launch. Players below
the vote-liquidity threshold get crowd_factor = 0 (base score
stands).

The ±15% clamp is **ruled, with a caveat** (P7, v0.5.0): FS-1 §7
measured it as a tiebreaker rather than a re-ranker (~1.5% pair
inversions for a realistic user, linear in the clamp, no threshold
effect anywhere in ±10–25%). But FS-1's crowd model is an
**assumption**, not a measurement (report §1.4) — CROWD_VOTING has
not shipped and no vote data exists. **Re-validate this clamp against
real vote data post-launch before treating it as settled.** The
vote-liquidity threshold remains sim-gated.

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

## Known tensions — measured and ruled (FS-1, 2026-07-29)

Items 1–3 below were open "sims to verify" questions until FS-1
measured them (`reports/fs1-phase4-calibration-2026-07-29.md`) and
the owner ruled. They are recorded here so the reasoning survives the
numbers.

1. **Step-function cliffs — measured, removed (P4).** The duel and
   pass-completion bonuses were step functions sitting near the
   median of their eligible populations: pay rates ~46–48%, with 38%
   of eligible midfielders within 3pp of the pass line (report §4).
   v0.5.0 replaced both with the linear ramps in the templates above.
2. **MID destroyers — measured, rate raised (P5).** Destroyers
   (0 key passes, ≥4 defensive actions) scored −33.69% vs creators at
   the mean (report §5). The v0.4.1 candidate fix recorded here —
   raising the combined defensive cap — was measured as **inert**
   (the cap bound on 2.2% of destroyer rows) and is withdrawn.
   The ruled fix is the rate: +0.5 → +0.7 per action, cap unchanged;
   this closes roughly a sixth of the gap and deliberately brings the
   cap into play on ~8% of 60+ MID rows (see design principle 4 for
   the precise figures).
3. **Win/draw subsidy — measured, halved (P2).** At +2/+1 the
   team-result terms were 12.8% of all positive point mass, and
   participation another 31.7% (report §2) — nearly half the system's
   points earned before any individually distinguishable act. v0.5.0
   cut appearance to a flat +1 (P1) and win/draw to +1/+0.5 (P2).
4. **ATT is boom-or-bust by accepted design (P8).** A typical
   attacking performance scores less than a typical midfield one
   (median 2.8 vs 4.5 at v0.4.1) while the p90s are nearly identical;
   the position's reputation is carried by its tail. The obvious
   lever — raising the shot-on-target rate — was **measured
   ineffective** (report §8: mean moved 4.156 → 4.264, median
   unchanged), and must not be re-proposed without new evidence.
