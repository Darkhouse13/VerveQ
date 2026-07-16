# THE DRAW — single-screen layout spec (v0 + Ticket 0.2 bench)

Budget device: **390 × 844** (iPhone 12/13/14 class). Both in-run views must fit
without vertical scroll. `npm run draw:layoutcheck` statically verifies a config
against this spec; the sweep excludes ineligible configs. The pixel constants
below are mirrored in `app/src/lib/drawEngine/layout.ts` (`LAYOUT`) — change them
together.

## Global

| Item | Value |
| --- | --- |
| Viewport | 390 × 844 |
| Page padding | 16px each side → content width **358px**, height budget **812px** |
| Gap between stacked sections | 12px |
| Top bar (mode name, exit, cumulative score) | 48px |

## Hard caps (rules, independent of pixel math)

| Cap | Value | Why |
| --- | --- | --- |
| Draft slots (rows) | ≤ 6 | squad strip chips ≥ 44px |
| Offers per row | ≤ 3 | offer cards ≥ 100px wide |
| Synergy families | ≤ 3 | one 24px meter per family |
| Fixtures | ≤ 5 | fixture chips ≥ 56px wide |

## Draft view (one active row at a time)

Stack, top to bottom:

| Section | Height | Notes |
| --- | --- | --- |
| Top bar | 48 | |
| Fixture strip | 64 | 5 chips: `(358 − 4×8)/5 = 65.2px` each ≥ 56px min. Shows archetype icon + threshold — the whole gauntlet is visible from board start. |
| Synergy meters | 3×24 + 2×8 = 88 | one meter per family (club/nation/era), current largest chain |
| Active row | ≤ 190 | 3 offer cards: `(358 − 2×12)/3 = 111.3px` wide ≥ 100px min; height = width × 1.4, capped 190 |
| Row progress dots | 24 | 6 dots |
| Score bar | 44 | cumulative + next threshold |

Total: `48+64+88+190+24+44 + 5×12 = 518px` ≤ 812px. **PASS** with room for
onboarding hints / animation overshoot.

## Round view (bench pick + fixture resolution + bank/push)

| Section | Height | Notes |
| --- | --- | --- |
| Top bar | 48 | |
| Fixture card | 140 | archetype, modifiers, threshold |
| Tap-to-bench squad strip | 92 | Ticket 0.2 D2: all 6 squad chips `(358 − 5×6)/6 = 54.7px` ≥ 44px tap min; 64px tappable chip + 20px bench-state label ("BENCHED" badge on the selected chip) + 8px padding. Before the reveal the strip is the bench selector; after, it shows the fielded five. |
| Synergy meters | 88 | same component as draft view; chains computed on the 5 fielded cards |
| Score-vs-threshold bar | 56 | animated fill |
| BANK / PUSH buttons | 56 | two half-width buttons |

Total: `48+140+92+88+56+56 + 5×12 = 540px` ≤ 812px. **PASS**.

## Eligibility

A config is layout-eligible iff all hard caps hold, every per-element minimum
width holds at the configured counts, and both stacked views fit the 812px
height budget. `checkLayout(config)` returns the violations; sweep candidates
failing it are excluded before simulation.
