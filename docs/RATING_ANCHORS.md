# THE DRAW — Editorial Rating Anchors (real-v5)

**Status:** owner-locked · **Supersedes:** real-v4 procedural fame-pinned ratings (see recon R4)
**Applies to:** the `ratingV5` editorial pass, assembled later as `real-v5`.

This document is the single source of meaning for a card's rating. It does not
modify the card set, the generator, or anything served. Rating batches
(`data/ratings-v5/<pos>.json`) are authored against it.

---

## What a rating means (owner-locked definition)

> **PEAK-CAREER ABILITY, ERA-RELATIVE** — "how good was this player at their
> best, judged against their own era."

It is **NOT** fame, **NOT** longevity, **NOT** cross-era projection. `fameRank`
is a separate, untouched, sitelink-based field; rating must not encode it.

## The scale (owner-locked)

| rating | tier |
|---|---|
| **95** | inner-circle GOAT tier |
| **90–94** | all-time greats at their position |
| **85–89** | world-class peak |
| **80–84** | elite |
| **75–79** | very good international level |
| **61–74** | solid professionals in famous shirts |

## Binding rules

1. **Peak ability, era-relative.** A player is judged at their best against the
   football of their own time. A 1970s defender is judged against 1970s
   football, not asked to survive a 2020s press.
2. **Rate within position class.** GK / DEF / MID / ATT as **carried on the
   card** (not necessarily the player's real-life primary role). A card marked
   DEF is rated against defenders.
3. **Target distribution — keep roughly the real-v4 shape.** min **61**, max
   **95**, median **~80**. The R4 histogram (below) is the reference. The
   anchors define *meaning*; the histogram *disciplines inflation*. If honest
   anchor-rating of a position class materially conflicts with the target
   shape, **STOP and report the conflict with examples** — never silently bend
   either the anchors or the shape.
   *Clarification (Stage-4):* the ~80 median is a **rating-pass discipline, not
   an assembly constraint**. Owner overrides may move it, and coverage gaps are
   fixed by **card-set expansion (separate CIE ticket), never by rating
   adjustment**.
4. **95 = the GOAT of a position, owner-designated.** Exactly one 95 per
   position, no more. Current designations: **Messi (ATT), Neuer (GK), Zidane
   (MID), Beckenbauer (DEF)**. A batch does not spend a 95 itself; it flags a
   candidate for the owner's per-position designation.
5. **Integers only.** No decimals. Ties are not broken by fame — a genuine tie
   is left as a tie.
6. **Justification required for 90+.** Every rating of 90 or above carries a
   one-line `note` in the batch file. Below 90, `note` is optional.
7. **Winger rule (standing).** Wide **forwards** are rated as **ATT**; **true
   wide midfielders** stay **MID**. Position class follows how the player
   actually plays, not the card's inherited label — see
   `data/ratings-v5/position-moves.json` for the Stage-4 reassignments.

## Permitted vs forbidden inputs

**PERMITTED:** football knowledge of honors, peak seasons, contemporary
standing, position-defining status.

**FORBIDDEN:**
- Wikipedia sitelinks / `fameRank`
- the card's current real-v4 rating (do **not** look at it while rating — it is
  fame noise, procedurally generated per R4)
- FIFA / EA or any third-party game ratings (IP exposure + wrong lens — those
  encode a different, non-era-relative model)

---

## Reference — R4 full-set rating histogram (real-v4, N=430)

The target shape the batches are disciplined against. min 61 · max 95 ·
median 80 · mean 79.3.

| bucket | cards | share |
|---|---|---|
| 60–64 | 30 | 7.0% |
| 65–69 | 60 | 14.0% |
| 70–74 | 51 | 11.9% |
| 75–79 | 71 | 16.5% |
| 80–84 | 72 | 16.7% |
| 85–89 | 62 | 14.4% |
| 90–94 | 75 | 17.4% |
| 95 | 9 | 2.1% |

### Reference — R4 DEF column (real-v4, N=129)

The real-v4 DEF ratings were fame-pinned, which systematically **depressed the
whole position class** (DEF median 72 vs ATT median 86 — R4 §5). Editorial
DEF ratings are therefore expected to **rise**; the delta is reported per batch.

real-v4 DEF: min **61** · max **94** · median **72**.
