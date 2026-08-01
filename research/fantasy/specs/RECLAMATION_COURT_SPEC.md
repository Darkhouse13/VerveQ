# Weekend Fantasy — Reclamation Court Spec (v1.2.0)

Status: **v1.2.0 — LOCKED, owner confirmed all [MY CALL] items
2026-07-28.** Constants are placeholders; changes by owner ticket
only.

## Changelog

- v1.2.0 — **the passed stamp binds to the score write** (owner
  ticket FW-CR2, 2026-08-01), citing the round-2 cross-model blind
  verification of the FW-VS1 package
  (`reports/fwlaunch-blind-verify-o3-2026-08-01.md`, finding O3-F1
  Critical): the resolver could stamp a claim `passed` when the
  re-score reported nothing written — e.g. a claim filed on an
  appearance whose fixture had raw stats on record but was never
  scored — leaving a public ruling no score ever received. The rule,
  now stated and enforced: **a claim may be stamped `passed` only
  when its re-score has landed in the same resolution pass.** A
  passing trial whose re-score cannot land stays on trial with its
  tally recorded and is retried by every resolution pass inside
  [voting close, finality); still unwritten at finality it EXPIRES —
  tally preserved, no verdict, no score effect. §Timeline
  (Resolution vs expiry), §Trial, §Effects amended.
- v1.1.0 — verification sync (owner ticket FW-VS1, 2026-08-01),
  citing the cross-model blind verification of FW-LAUNCH and the
  FW-CR1 remediation (commit b9d0918):
  - **"Gameweek active users" is DEFINED** (owner ruling 2026-07-30):
    the distinct squad-holding users in the gameweek, any context —
    closes the reading parked as OWNER DECISION 1 in
    DECISIONS_NEEDED.md. §Endorsement threshold.
  - **Resolution vs expiry** (FW-CR1): verdicts apply only within
    [voting close, finality); at or after finality an open claim
    EXPIRES — stamped unresolved, no verdict, no tallies, no score
    effect. Court history never asserts an outcome the scores did not
    receive. §Timeline, §Trial.
  - **The rebuttal is a trial-ballot feature**: a claim still in
    filing cannot spend the slot. §Trial.
  - **Crowd-freeze interaction stated**: a passed verdict's re-score
    lands before finality, so the frozen-factor derivation groups the
    ruled player in his ruled position group, re-percentiling both
    affected groups for all members at freeze — designed semantics.
    §Effects of a passed verdict.
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

**Resolution vs expiry (v1.1.0, FW-CR1).** A verdict may be applied
only inside the verdict window — **[Tuesday 21:00, Tuesday 23:59)**,
i.e. [voting close, finality), half-open at both ends. At or after
finality no verdict is applicable at all: any claim still open (in
filing or on trial) **EXPIRES** — stamped "expired — unresolved at
finality", with no verdict and no score effect. Expired is not an
outcome: it is distinct from *failed* (the jury refused it) and from
*died* (it never reached a hearing). The invariant this split
protects: **the court's history never asserts an outcome the scores
did not receive** — after finality the re-score is forbidden (scores
are frozen), so a verdict stamped there would be a ruling the numbers
never got. The resolver's cadence guarantees at least one resolution
pass inside every verdict window (its widest silence, 15 minutes,
fits inside the 2h59m window), so expiry is a fault path, not a
routine one.

**The stamp binds to the write (v1.2.0, FW-CR2).** The same
invariant, enforced at the write itself and not only at the finality
boundary: **`passed` may be stamped only when the verdict's re-score
has landed in the same resolution pass.** A trial that passes the
vote test while its re-score cannot land — the canonical case is a
claim filed on an appearance whose fixture has raw stats on record
but no score rows yet — is **HELD**: it stays on trial, its passing
tally is recorded, and every subsequent resolution pass inside the
verdict window retries it, resolving the moment the score becomes
revisable. Still unwritten at finality, the expiry path stamps it
expired. An expired claim therefore carries a tally exactly when an
in-window pass held it: the tally is the vote's record and stays; the
verdict is what finality refuses. (The v1.1.0 phrase "no tallies" on
expiry described the only expiry then possible — a claim that never
reached an in-window resolution pass; for those, nothing changes.)

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
- **"Gameweek active users" (DEFINED v1.1.0, owner ruling
  2026-07-30):** the distinct users holding at least one squad in the
  gameweek, any context — budget or crew. The same number feeds the
  trial quorum below. (At launch scale the floors dominate under any
  reading; this closes the definition the FW-1 ledger parked as an
  owner decision.)
- Endorsing costs nothing and is not rate-limited (it's "this
  deserves a hearing," not a filing).
- Claims short of threshold at Monday 23:59 die silently; the filing
  slot is not refunded [MY CALL — refunding rewards spray-filing].

## Trial

- Ballot shows: the claim, the feed's verdict, average position map
  if available, the filer's one-liner, and a counter-argument slot
  open to any user [one 280-char rebuttal, first-come][MY CALL].
  **The rebuttal is a trial-ballot feature (v1.1.0):** the slot opens
  with the trial and cannot be spent while the claim is still
  gathering endorsements — a claim in filing has no hearing to
  answer, and a rebuttal burned there would be gone before any juror
  could read it. Refused in filing; the slot survives to trial.
- **Excluded from voting (LOCKED):** anyone holding the player in
  any squad this gameweek, and the filer.
- **Weighted by rater accuracy [MY CALL]:** votes count at
  0.5 + accuracy, so a coin-flip rater ≈ 1.0 and the best raters
  ≈ 1.5. This is the one place the sealed rater game has teeth —
  the court trusts proven eyes slightly more, and it makes rater
  accuracy worth building for its own sake.
- Passes at **quorum max(30, 1% of gameweek actives) AND ≥ 60%
  weighted yes** [placeholders]. Fails otherwise. No appeals — the
  next gameweek is never blocked by the last one. A trial still open
  at finality **expires** rather than failing (v1.1.0, see §Timeline):
  fail-closed on time, but an expiry is the clock's doing, not a
  jury's verdict, and the record says so.
- Passing the vote test is necessary but **not sufficient** for the
  `passed` stamp (v1.2.0, see §Timeline): the stamp lands only with
  the re-score. A passing trial whose re-score cannot land is held on
  trial — tally recorded — and retried while the verdict window
  holds; at finality it expires with the tally preserved.

## Effects of a passed verdict

- The player's verdict position changes for that gameweek,
  everywhere: mismatch dampeners recompute, position-group
  percentiles for crowd_factor recompute, all affected squads
  re-score. One atomic re-score at verdict time — **and the stamp and
  the re-score are one act (v1.2.0)**: `passed` exists in the court's
  history only where that re-score landed.
- **Crowd-freeze interaction (stated v1.1.0).** The re-score lands
  BEFORE finality, and the crowd-factor freeze derives each player's
  position group from his score row's CURRENT verdict at freeze time
  (CROWD_VOTING §Rating math). A ruled player is therefore
  percentiled within the group he was ruled INTO, and **both affected
  groups re-percentile for ALL their members at the freeze** — the
  group he joined absorbs him, the group he left closes around his
  absence. Designed semantics, not a side effect: the eye-test
  question is "how good was he for his role", and his role is what
  the court just ruled.
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
