# VerveQ Inside-Out Audit Resolution

Branch: `codex/weekend-stabilization-cleanup`

This document records the fixes and product-facing decisions introduced from the inside-out audit punch list. It is intended to be read alongside `docs/INSIDE_OUT_AUDIT.md`.

## Verification

- `npx.cmd convex codegen`
- `npx.cmd tsc --noEmit`
- `npm.cmd test` -> 134 passing tests
- `npm.cmd run lint` -> 0 errors, 8 pre-existing warnings
- `npm.cmd run build`

## Competitive Scope Decision

- Quiz and Survival are the only modes that affect ELO.
- Higher/Lower, VerveGrid, and Who Am I are intentionally friendly/score-only modes for now.
- Pre-deploy follow-up: the Home screen and mode selection surfaces should visually distinguish ranked modes from friendly modes before release, because all modes currently sit together and can imply equal competitive weight.

## Quiz

- Q1 / X3: `completeQuiz` now rejects expired sessions before ELO finalization.
- Q2: `endSession` no longer deletes answered or active quiz rows. It marks them completed/abandoned and clears the active checksum, avoiding the quit/result race that made `completeQuiz` see "Session not found".
- Q3: image-question selection now treats the three-image cap and no-consecutive-image rule as hard constraints.
- Q4: `usageCount` now increments on `checkAnswer`, not on `getQuestion`, so abandoned fetched questions do not inflate analytics.
- Q5: Quiz results now include a per-question score/time breakdown so players can see how speed and correctness contributed to the final score.
- Q6: quiz session ownership checks now reject legacy rows without a `userId` instead of allowing any authenticated user to touch them.
- X8: Quiz now has an explicit tab-switch penalty mutation and UI hook; switching away ends the quiz.

## Survival

- S1: close calls now get one free retry per round; later close calls count as misses.
- S2: hidden-answer bonus was removed and total performance bonus is capped.
- S3: close calls now reset the speed streak timing window.
- S4: hint reset behavior remains per-round by design and is left as product copy/surfacing work.
- S5: legacy sessions with missing `hintTokensLeft` or `freeSkipsLeft` now fall back to the normal starting values instead of silently acting as zero.
- S6: anti-cheat is still round-aware to avoid double-taxing one accidental switch in the same round. This is documented as intentional behavior.
- S7 / X3: `completeSurvival` now rejects expired sessions before ELO finalization.
- S8: new survival sessions store `startedAt`, and analytics duration uses that gameplay anchor instead of raw row creation time.

## Blitz

- B1 / LM2: Blitz answer checks now use `normalizeAnswer`.
- B2: Blitz start returns the server `endTimeMs`, and the UI uses that authoritative timestamp.
- B3: the UI already has penalty flash feedback for the 3s wrong-answer penalty. No scoring change was made.
- B4: `getQuestion` checks expiry before the active-question guard, so expired sessions report time expiry correctly.
- B5: `endGame` now refuses to save unfinished non-expired sessions.
- B6: subtractive-only timer remains a product design decision.
- B7: Blitz leaderboards now require `sport`, preventing cross-sport ranking pollution.

## Higher/Lower

- HL1: exact-value ties are still excluded from new prompts to avoid ambiguous "higher/lower" answers. The remaining clustered-pool concern is documented as pool design/curation work.
- HL2: pool exhaustion now returns `endReason: "pool_exhausted"`, and the UI distinguishes a perfect exhausted run from a normal loss.
- HL3: Higher/Lower mutations and session reads enforce `expiresAt`.
- HL4: no ELO finalization was added for Higher/Lower. This remains a product decision because the mode currently behaves as score-only.
- HL5: numeric stability around near-equal floats remains a data/display decision. Exact ties are still avoided.
- X8: Higher/Lower now has an explicit tab-switch penalty mutation and UI hook; switching away ends the run.

## VerveGrid

- VG1 / X14: search now uses normalized, diacritic-insensitive matching plus fuzzy token matching.
- VG2: `startSession` filters out boards with empty cell answer pools.
- VG3: the UI handles `alreadyUsed` separately and now shows a specific warning instead of treating it as a normal wrong guess.
- VG4: VerveGrid now exposes answer-count rarity metadata and lightweight cell point labels without revealing the answer pool.
- VG5: VerveGrid search/submission/session reads enforce `expiresAt`.
- VG6: no ELO finalization was added for VerveGrid. This remains a product decision because the mode currently behaves as score-only.
- VG7: `searchPlayers` no longer falls back to a global sport-wide player list when session/cell context is missing.
- X8: VerveGrid now has an explicit tab-switch penalty mutation and UI hook; switching away completes the board.

## Who Am I

- WAI1: failed guesses now keep DB and response score behavior aligned.
- WAI2: close calls now decay score and increment `closeCallCount`.
- WAI3: `submitGuess` and clue reveal now enforce `expiresAt`.
- WAI4: answer matching now includes generated aliases such as first-initial plus surname and initials.
- WAI5: one-and-done failure remains a product design decision.
- WAI6: wrong guesses only reveal `answerName` after all four clues are revealed; early failed guesses keep the answer hidden.
- X8: Who Am I now has an explicit tab-switch penalty mutation and UI hook; switching away fails the attempt.

## Daily Challenge

- D1: daily challenge creation now canonicalizes duplicate same-day rows and deletes non-canonical duplicates.
- D2: daily quiz questions are snapshotted into `dailyChallenges`, and render/scoring use the frozen snapshot if the source question changes or disappears.
- D3: Daily forfeit remains permanent for the UTC day to preserve one-attempt leaderboard fairness; the UI explicitly warns that quitting forfeits today's attempt.
- D4: the daily quiz UI now displays elapsed time from the server `questionStartedAt` instead of resetting on reload.
- D5: the time-bonus curve now rounds instead of floors, removing the visible one-point cliff immediately after 1s.
- D6: starting today's challenge is blocked if yesterday's attempt completed after today's UTC reset.
- D7: daily survival mode now fails loudly with "Daily survival is not implemented yet" instead of creating inert data.
- D8: a daily generator cron now pre-creates quiz dailies shortly after UTC midnight. Lazy creation remains as a fallback/self-heal path.
- D9: daily attempts now have `expiresAt`; stale active attempts can be restarted after expiry and are closed by cleanup.

## Live Match

- LM1: forfeits now apply ELO when the match had started.
- LM2: Live Match answer checks now use `normalizeAnswer`.
- LM3: `eloAppliedAt` makes Live Match ELO application idempotent.
- LM4: stale live matches are reaped by a cron using heartbeat timestamps.
- LM5 / LM10: round scoring is finalized after both answers or timeout using server `timeTaken`, not mutation write order.
- LM6: question text remains snapshotted at match creation by design.
- LM7: `getActiveMatch` now includes `waiting`, `countdown`, `question`, and `roundResult` states.
- LM8: scheduled transition mutations are status-gated so duplicate scheduler jobs become no-ops.
- LM9: opponent correctness is hidden during the active question phase.
- LM11: `createFromChallenge` rejects creation if either player already has an active match.
- LM12: countdown and question timers are anchored to server timestamps in the match document.

## Cross-Cutting

- X1: game completion no longer resets `lastDecayAt` to `0`, preserving the intended post-decay seven-day cadence.
- X2: decay floor is now `1500`, preventing passive decay from silently demoting a player below the Gold boundary.
- X4: playing a rated mode dismisses outstanding decay warnings for that user/sport/mode.
- X5: result screens now explain non-standard K-factor states such as placement matches and high-tier protection.
- X6: ELO and ranked win/loss stats are intentionally limited to Quiz and Survival. Higher/Lower, VerveGrid, and Who Am I stay friendly/score-only modes for now.
- X7: lifetime fields surviving season reset remain intentional.
- X8: anti-cheat is now wired across Quiz, Survival, Blitz, Daily, Higher/Lower, VerveGrid, Who Am I, and Live Match.
- X9: `useAntiCheat` now has a short hidden-state grace period to avoid penalizing transient mobile visibility flickers.
- X10: season reset and ELO decay no longer overlap unsafely; decay skips if a season boundary or reset is pending.
- X11: season reset is now two-phase and idempotent, with `resetStartedAt`, scheduled reset work, duplicate-active cleanup, season-history uniqueness, and `seasonResetAppliedFor` on ratings.
- X12: withdrawn in the audit; no code change required.
- X13: empty fuzzy guesses no longer match one-character targets.
- X14: `normalizeAnswer` now strips diacritics.
- X15: an hourly cleanup cron closes expired active sessions and removes abandoned/retained terminal rows where safe.

## New Schema Fields And Indexes

- `quizSessions.abandonedAt`
- `survivalSessions.startedAt`
- `dailyAttempts.expiresAt`
- `dailyChallenges.questionSnapshots`
- `liveMatches.countdownStartedAt`
- `liveMatches.eloAppliedAt`
- `seasons.resetStartedAt`
- `seasons.by_season_number`
- `seasonHistory.by_season_user_sport_mode`
- `userRatings.seasonResetAppliedFor`
- close-call tracking fields for Survival and Who Am I
