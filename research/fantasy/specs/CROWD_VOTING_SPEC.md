# Weekend Fantasy — Crowd Voting Spec (v1.0.1)

Status: **v1.0.1 — LOCKED, owner confirmed all [MY CALL] items
2026-07-28.** Constants are placeholders pending sim/live data;
changes by owner ticket only.

## Changelog

- v1.0.1 — timezone amendment per FW-1 STOP-5 ruling: all "CET" time
  references become "Europe/Paris". No other content changes.
- v1.0 — owner confirmed all [MY CALL] items 2026-07-28.

## What it is

The eye-test instrument. Users judge weekend performances through
rapid pairwise comparisons — "who had the better game?" — never
absolute 1–10 notes. Votes produce a per-gameweek performance rating
per player, which becomes the crowd_factor in SCORING_SPEC v0.4.1
(clamped ±15%, sign-mirrored on negative bases).

## The vote

- Two player cards, one fixture context each, one tap. Options:
  left, right, **didn't watch** (costless skip, LOCKED).
- Server-served pairs only. Users never choose who to compare.
- Voting opens at each fixture's full-time, closes at Tuesday 23:59
  Europe/Paris finality (LOCKED).
- Blitz-style flow: a served stack, tap through, stop whenever.

## Pair-serving algorithm [MY CALL]

1. **Same-fixture pairs by default** — both players were in the one
   match you watched. Highest-signal comparison that exists.
2. **Same-league, same-gameweek** as fallback once a fixture's pairs
   saturate.
3. **Never cross-league pairs** for scoring purposes (locked
   principle: people vote confidently on players they never saw).
4. **Liquidity-targeted:** serving probability weights toward
   under-voted players, so attention spreads beyond the famous ten.
5. **Conflict exclusion (LOCKED):** a user is never served a pair
   containing any player in any of their active squads (budget or
   crew) this gameweek. Enforced at serve time, not filtered at
   count time.

## Rating math [MY CALL]

- Per-gameweek Elo, all appeared players start each gameweek at
  1500. K = 32. One update per vote, standard Elo expectation.
- "Didn't watch" produces no update and no penalty.
- crowd_factor = linear map of the player's final rating percentile
  **within his verdict-position group** for that gameweek onto
  [−0.15, +0.15], median = 0. Percentile-within-position keeps the
  factor from just re-ranking attackers over defenders — it asks
  "how good was he *for his role this weekend*," which is the
  eye-test question.
- **Liquidity threshold (LOCKED principle):** fewer than 25 votes
  [placeholder] ⇒ crowd_factor = 0, base score stands. Below-
  threshold players show "insufficient votes" on their ledger —
  visible, not silent.
- Ratings freeze at finality; the factor applied is the frozen one.

## Rater accuracy (the sealed second game) [MY CALL]

- Each user's vote is scored after finality against the frozen
  consensus: agreeing with the eventual majority direction on that
  pair = accurate. Rolling accuracy → a **rater rating** with its own
  leaderboard, streaks, and ShareCard.
- Sealed by construction: rater rating affects nothing in fantasy
  scoring and fantasy holdings affect nothing in vote weight
  (exclusion already prevents conflicted votes from existing).
- Purpose: makes voting a game worth being good at, and produces a
  trust signal for the reclamation court (see court spec) — the one
  place rater accuracy has teeth.

## Anti-abuse

- One vote per served pair, ever; pairs are single-use per user.
- Serve-rate cap per user per gameweek [placeholder 300] — enough
  for enthusiasts, expensive for farms.
- Brigading resistance is structural: server chooses pairs, targets
  liquidity, excludes conflicts, and Elo from hundreds of scattered
  binary votes is slow to move with any single account.
- New-account votes count from day one [MY CALL — no probation at
  launch; probation is a lever we add if live data shows farming,
  not before].

## Cold start honesty

At current fanbase scale most of the ~1,400 weekly players sit below
threshold, factor 0 — the game degrades gracefully to base scoring
plus a visible crowd layer on the marquee names. That is the designed
behavior, not a failure state. The clamp widens and the threshold
tunes as liquidity grows (owner ticket, sim-gated, LOCKED principle).
