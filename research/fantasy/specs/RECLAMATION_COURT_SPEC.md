# Weekend Fantasy — Reclamation Court Spec (v1.0.1)

Status: **v1.0.1 — LOCKED, owner confirmed all [MY CALL] items
2026-07-28.** Constants are placeholders; changes by owner ticket
only.

## Changelog

- v1.0.1 — timezone amendment per FW-1 STOP-5 ruling: all "CET" time
  references become "Europe/Paris". No other content changes.
- v1.0 — owner confirmed all [MY CALL] items 2026-07-28.

## Scope [MY CALL]

The court hears **position verdicts only** at launch: "the feed says
he played DEF; he actually played MID." It does not hear stat
disputes (wrong goal attribution etc.) — those are feed-correction
issues handled operationally, not by vote. Rationale: position is a
judgment call the crowd is qualified to make; a goal count is a fact
a vote cannot change. Widening scope later is an owner ticket.

## Timeline (per gameweek, all times Europe/Paris)

| Phase | Window |
|---|---|
| Filing opens | each fixture's full-time |
| Filing closes | Monday 23:59 |
| Endorsement | continuous from filing until Monday 23:59 |
| Voting | any claim past threshold: opens immediately, closes Tuesday 21:00 |
| Verdicts + re-score | Tuesday 21:00–23:59 |
| Finality | Tuesday 23:59 (LOCKED) — scores final, court closed |

Scores are provisional until finality (LOCKED). A successful verdict
re-scores **every** squad holding that player — universal, never
per-user (LOCKED).

## Filing (rate-limit model, LOCKED)

- 2 filings per user per gameweek [placeholder]. No point stake, no
  currency (LOCKED: rate-limit over stake).
- A filing names: player, fixture, claimed position, one-line
  argument [280 chars].
- Duplicate claims (same player+fixture+position) merge into the
  first — endorsements pool, no split courts.

## Endorsement threshold [MY CALL]

- A claim reaches trial at **max(15, 0.5% of gameweek active
  users)** endorsements [placeholders]. Absolute floor stops
  three-friend collusion at small scale; the percentage keeps trial
  volume sane as the base grows.
- Endorsing costs nothing and is not rate-limited (it's "this
  deserves a hearing," not a filing).
- Claims short of threshold at Monday 23:59 die silently; the filing
  slot is not refunded [MY CALL — refunding rewards spray-filing].

## Trial

- Ballot shows: the claim, the feed's verdict, average position map
  if available, the filer's one-liner, and a counter-argument slot
  open to any user [one 280-char rebuttal, first-come][MY CALL].
- **Excluded from voting (LOCKED):** anyone holding the player in
  any squad this gameweek, and the filer.
- **Weighted by rater accuracy [MY CALL]:** votes count at
  0.5 + accuracy, so a coin-flip rater ≈ 1.0 and the best raters
  ≈ 1.5. This is the one place the sealed rater game has teeth —
  the court trusts proven eyes slightly more, and it makes rater
  accuracy worth building for its own sake.
- Passes at **quorum max(30, 1% of gameweek actives) AND ≥ 60%
  weighted yes** [placeholders]. Fails otherwise. No appeals — the
  next gameweek is never blocked by the last one (fail-closed on
  time, always).

## Effects of a passed verdict

- The player's verdict position changes for that gameweek,
  everywhere: mismatch dampeners recompute, position-group
  percentiles for crowd_factor recompute, all affected squads
  re-score. One atomic re-score at verdict time.
- The verdict is logged publicly: claim, tallies (weighted +
  raw), outcome. The court's history is content — "the people ruled
  Trent a midfielder, 71–29" is a ShareCard.

## Abuse posture

- Rate-limited filings + threshold + quorum + conflict exclusion +
  accuracy weighting stack five independent gates; passing all five
  with a brigade requires more organic-looking effort than the ±
  swing of one player's dampener is worth.
- If live data shows organized abuse anyway: probation levers
  (account age, minimum rater history) exist as owner tickets, not
  pre-built.
