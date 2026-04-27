# VerveQ inside-out audit — per-mode evidence-backed punch list

Branch: `codex/weekend-stabilization-cleanup`. Scope: 8 game modes plus shared lib. PR1 items (exit confirms, NeoCard a11y, image alts, explanations rendered, anti-cheat toasts, survival difficulty wired, Jaro-Winkler doc bug) excluded.

---

## 1. Quiz — `convex/quizSessions.ts`, `src/pages/QuizScreen.tsx`

**Q1.** **`completeQuiz` doesn't check `expiresAt` — finalize after the 30-min TTL.** `games.ts:12-32` validates ownership, `completed`, `totalAnswers > 0`, but never `Date.now() > session.expiresAt`. `getQuestion` and `checkAnswer` both check (`quizSessions.ts:50,108`). A player who answered all 10 questions in 28 minutes can leave the tab open, return hours later, hit the implicit "finish" button, and ELO writes. — **wrong**

**Q2.** **`endSession` deletes the row without enforcing `completed=true`.** `quizSessions.ts:163-176`. A client that fires `endSession` before `completeQuiz` (e.g. in a quit-then-confirm race) silently drops the session — `completeQuiz` then throws "Session not found". Idempotent for the user (no ELO writes), but it means a quit during the result-fetch race produces a generic error instead of a clean state. — **annoying**

**Q3.** **Image-question constraint is "soft" — fallback can serve a 4th image or two consecutive images.** `lib/imageQuestions.ts:25-29`: when `usedImageCount >= 3` or `lastWasImage`, the function tries to filter to text-only — but if `textOnly.length === 0` it returns the unfiltered `available` pool (i.e. images allowed). With a small per-difficulty pool that's mostly images, both rules can be silently violated. Repro: difficulty + sport with <10 text questions and 5+ image questions, play long enough that text candidates exhaust. — **wrong**

**Q4.** **`usageCount` increments before the player is shown the question — even if they navigate away.** `quizSessions.ts:75` patches `usageCount + 1` immediately on `getQuestion`. If user fetches Q1 and quits without answering, the question's popularity is inflated. Skews the analytics meaning of `usageCount`. — **annoying**

**Q5.** **Time-bonus formula has no surface representation.** `quizSessions.ts:130-138` calls `calculateTimeScore(100, timeTakenSec)` but the player has no idea what curve they're on; the result screen shows a number. No score breakdown for the player to know whether speed was rewarded or accuracy was rewarded. — **design decision**

**Q6.** **`session.userId` is optional in schema (`schema.ts:126`) but checked with `if (session.userId && session.userId !== userId)`** — `quizSessions.ts:47, 105, 171`. A pre-existing row with no userId can be touched by *any* authenticated user. Likely defensive for legacy rows; flag-only since modern `createSession` always sets `userId` (L22). — **annoying** (audit only)

**Triage:** `fix soonest`

---

## 2. Survival — `convex/survivalSessions.ts`, `src/pages/SurvivalScreen.tsx`

**S1.** **Close-call returns early — no penalty, no rate limit, no round increment, no streak reset.** `survivalSessions.ts:842-859`. If a guess is within `[threshold+1, threshold+2]` edits of any valid player, the response is "close call, retry" with full session state intact. There is no cap on close-call submissions per round. A patient player can iterate variants until they land within the typo threshold. The intent is "encouraging retry", but the loop has no terminator. Repro: round 5, type 5 close-misses of "Ronaldo" — none cost lives. — **exploitable**

**S2.** **Hidden-answer bonus stacks with typo bonus.** `survivalSessions.ts:870-873, 898`: `isHiddenAnswer = matchedPlayer !== primaryPlayer` adds a +0.2 `performanceBonus`. `performanceBonus` is then added to `basePerf` in `games.ts:172` and feeds ELO. Players have no UI signal of who the "primary" is — every non-primary correct answer silently grants +0.2 bonus, which compounds across rounds (no cap on `performanceBonus`). Combined with on-fire (+0.1/round once `streak >= 5`), a long run stacks bonuses unboundedly until `Math.min(1.0, ...)` clamps at completeSurvival. — **wrong** (math is opaque to player, scoring becomes hard to predict)

**S3.** **Close-call doesn't update `lastAnswerAt`, so speed-streak window is preserved across slow misses.** `survivalSessions.ts:842-859` early-returns; `lastAnswerAt` is never re-stamped. So a player can close-call for 30s, then submit a correct within 4s of *the previous correct*, and the streak counter still ticks. The "speed" in "speed streak" is measured between corrects, ignoring time spent close-calling. Generous, not exploitable, but the docstring's "4 second" window is effectively per-correct, not per-action. — **annoying** (math surprise)

**S4.** **Wrong answer resets `speedStreak` and `lastAnswerAt`, but also sets `currentHintStage: 0` even when no hint was used this round.** `survivalSessions.ts:933-946`. The hint-stage reset is invisible — if a player used hint stages 1–2 in round 5, they got a tighter pool; on round 6 (wrong), `currentHintStage` clears. That's correct, but it means a player who *missed* round 6 entirely (no hint requested) has their hint progression reset implicitly each round anyway, since L899 also clears it on correct. It's defensive, but the player sees "Hint" reappear on every new round with no warning that prior round's hints don't carry. — **design decision**

**S5.** **`hintTokensLeft` and `freeSkipsLeft` are session-locked but the schema makes them optional and `startGame` may not initialize them.** `schema.ts:154,172`. If a session ever exists with `hintTokensLeft === undefined`, `useHint` (L985,991) treats it as 0 and throws "No hint tokens remaining" silently — but if the UI thinks tokens are non-zero from cached state, the player sees a generic error. — **annoying**

**S6.** **Anti-cheat penalty is round-scoped, not lifetime — multiple tab-aways within the SAME round are no-ops.** `survivalSessions.ts:1154` returns `{penalized: false}` if `lastPenalizedRound === currentRound`. So once a player has been docked one life this round, they can tab away freely until they answer. The intent is "no double-tax in one round" but the wording is "we penalize tab-switching", which is broader than what's implemented. — **annoying**

**S7.** **`completeSurvival` doesn't check `expiresAt`.** `games.ts:131-149` checks `gameOver` and `completedAt`, never TTL. A 60-min-expired survival session that ended in game over can still be completed for ELO. — **wrong** (mirror of Q1)

**S8.** **`durationSeconds` derived from `_creationTime`, not from when the player actually engaged.** `games.ts:154-157`. A player who opens survival, walks away for 10 min, then plays 90s gets `durationSeconds ≈ 690`. Not score-affecting but it pollutes the `gameSessions` analytics. — **annoying**

**Triage:** `fix soonest`

---

## 3. Blitz — `convex/blitz.ts`, `src/pages/BlitzScreen.tsx`

**B1.** **`submitAnswer` uses strict equality, not `normalizeAnswer`.** `blitz.ts:141`. Quiz uses normalize at `quizSessions.ts:128-129`. Daily uses normalize at `dailyChallenge.ts:249-250`. Live Match uses strict equality at `liveMatches.ts:154`. The asymmetry means: if a `quizQuestions` row has trailing whitespace or unusual punctuation in `correctAnswer` and the player's tapped option differs by even one char, Blitz/Live mark wrong while Quiz/Daily mark right. The DB has no constraint that `correctAnswer ∈ options`. Audit `quizQuestions` for any drift and you've got latent bugs. — **wrong**

**B2.** **Clock-drift acceptance window.** `blitz.ts:50, 152` validate against `endTimeMs` server-side; `BlitzClock` polls `Math.ceil((endTimeMs - Date.now()) / 1000)` every 100ms client-side. Clock displays 0:00 up to ~990ms before the server stops accepting, so a fast tapper at displayed 0:00 sometimes scores a 17th question and sometimes doesn't. Repro: spam-tap an answer right as the clock hits 0:00 across 10 sessions; you'll occasionally get one extra correct. — **exploitable** (small magnitude)

**B3.** **Wrong-answer 3s penalty makes the visible clock jump backward.** `blitz.ts:149` decrements `endTimeMs` by 3000 on wrong; the response carries the new `endTimeMs`. UI was rendering against the old value until the response lands (~100-300ms typical). Visual jank, not a scoring bug, but "0:05 → submit wrong → 0:02" mid-frame is jarring. — **annoying**

**B4.** **`getQuestion` already-pulled-question guard fights with the time-expired branch.** `blitz.ts:44-57`: if `currentChecksum` is set, throws "Answer the current question". If time expired, clears `currentChecksum` and throws "Time expired". But the time-expired branch runs only AFTER the currentChecksum guard. So if a player has a question pulled and the clock runs out without submitting, they hit "Answer the current question" not "Time expired" — confusing error. Repro: pull Q, wait 60s, hit get-next. — **wrong**

**B5.** **No `endGame` invariant on `gameOver`.** `blitz.ts:175-208`: idempotent via `scoreSavedAt`, but also writes a `blitzScores` row regardless of whether `gameOver` was reached legitimately. If a client called `endGame` early (e.g. user navigates away), the score is saved at whatever the in-progress score was. There's no "minimum-N-questions" or "game must have finished" guard. — **wrong** (unfinished games count toward leaderboard)

**B6.** **`endTimeMs` only ever shrinks — no positive countdown extension.** Wrong = -3s. There's no "speed bonus" or "perfect streak" that adds time. Combined with the 60s start, this means Blitz is purely subtractive. May be intentional, but worth noting against the design. — **design decision**

**B7.** **No daily/account leaderboard sport partitioning when `sport` arg is omitted.** `blitz.ts:241-253`: when `sport === undefined`, `take(200)` then sort. Cross-sport scores compete on a single ladder — Football and Tennis, very different question pools, ranked together. — **wrong**

**Triage:** `fix soonest`

---

## 4. Higher/Lower — `convex/higherLower.ts`, `src/pages/HigherLowerScreen.tsx`

**HL1.** **Tie-value filter prematurely ends games.** `higherLower.ts:281`: `fact.value !== session.playerBValue`. Any candidate fact whose value exactly matches the new "A" gets filtered out. In stat pools clustered around a median (e.g. "goals scored: most players have 0–5"), late-game `unseenValidCandidates.length` collapses fast, hitting the L284 "pool exhausted" branch — game ends with score+1, status `game_over`, but the player thought they had momentum. Repro: streak ~15 on a low-distinct-value pool. — **wrong**

**HL2.** **Pool-exhaustion ends as `correct: true, gameOver: true` with no end-screen distinction.** `higherLower.ts:284-298`. The player's last correct answer is credited, but the game ends for a non-player-fault reason and the UI has no way to show "you ran out of pool, not lives". — **annoying**

**HL3.** **`expiresAt` set but never checked.** `higherLower.ts:196` sets `expiresAt: Date.now() + SESSION_TTL_MS` (1 hour). No mutation reads it. A player can resume a 7-day-old session and pick up at the same streak. — **exploitable**

**HL4.** **No ELO finalization for H/L.** Audited `games.ts` end to end — no `completeHigherLower`. `higherLowerSessions` schema has no `eloChange`. The status enum is `active | game_over` — terminal state writes nothing to `userRatings`. Listed as competitive in `CLAUDE.md` but score is session-local. — **design decision** (intentional? leaderboard? if so, where?)

**HL5.** **Pool selection uses `playerAValue` and `playerBValue` as ints — no documented numeric stability.** `higherLowerFacts.value: v.number()` (`schema.ts:427`). If two facts are within FP epsilon (e.g. averages), strict `!==` filtering at L281 may include them as "different" but they appear identical in the UI. — **annoying**

**Triage:** `investigate`

---

## 5. VerveGrid — `convex/verveGrid.ts`, `src/pages/VerveGridScreen.tsx`

**VG1.** **Search is `name.toLowerCase().includes()`, no fuzzy / no diacritic normalization.** `verveGrid.ts:111`. "Muller" returns 0 hits when DB has "Müller". "ronaldnho" returns 0 because no Levenshtein. The rest of the app uses `findBestMatch` for player input; VerveGrid uses substring-only — inconsistent UX with Survival/WhoAmI. — **wrong**

**VG2.** **Empty `validPlayerIds` cell not validated at `startSession`.** `verveGrid.ts:36-41` copies cells verbatim from `verveGridBoards`. If a board row has a cell with `validPlayerIds: []`, the player sees an unguessable cell. No assertion. Any guess into that cell is `cell.validPlayerIds.includes(...)` → false → they lose a guess for nothing. Repro: any board with bad seed data. — **wrong**

**VG3.** **`alreadyUsed` check returns `correct: false` but also doesn't decrement `remainingGuesses`.** `verveGrid.ts:178-180`: returns early without patching, before line 183 decrement. Good behavior, but the response shape `{ correct: false, alreadyUsed: true, ... }` collides with a "wrong guess" response in the UI's render path — VerveGridScreen needs to handle the `alreadyUsed` flag specifically; if it doesn't, players see a "wrong" toast instead of "already used in another cell". Verify in screen. — **investigate**

**VG4.** **`validPlayerIds.length` per cell is never exposed to the player.** Schema (`schema.ts:608`) stores it; the API at `verveGrid.ts:215+` returns cells via `getSession`, but `getSession` returns... let me verify. From the substring readout, `validPlayerIds` is a curated set per cell. Whether a cell has 1 valid player or 50 fundamentally changes difficulty, and the player can't see this. The "score" is not weighted by cell rarity. — **design decision**

**VG5.** **`expiresAt` set but never checked** (`verveGrid.ts:45`, no read). Same pattern as H/L. — **exploitable**

**VG6.** **No ELO finalization** — same as H/L. Score lives only on the session. — **design decision**

**VG7.** **`searchPlayers` falls back to global player list when no `sessionId`/`cellIndex` provided** (`verveGrid.ts:131-145`). That branch returns *any* player, ignoring the cell's valid set. If the screen ever passes only `queryText` (or fails to pass session args), the player gets a list of irrelevant suggestions. Defensive on server, but a UI regression there silently breaks gameplay without an error. — **annoying**

**Triage:** `fix soonest`

---

## 6. Who Am I — `convex/whoAmI.ts`, `src/pages/WhoAmIScreen.tsx`

**WAI1.** **Wrong final guess returns `score: 0` even though `session.score` was patched per-reveal.** `whoAmI.ts:180-188`: on `failed`, the response has `score: 0`. But the DB row's `score` is e.g. 421 (from `revealNextClue` patches at L127-130). `getSession` (L221) returns the DB score. So the submit response says "you got 0", but the post-game query says "421". Whichever the result-screen reads determines what the player sees. Repro: submit a wrong guess after revealing all 4 clues — compare the submit response payload to a follow-up `getSession` poll. — **wrong**

**WAI2.** **`closeCall` on submit doesn't reduce score and doesn't consume anything.** `whoAmI.ts:170-178`. A player can keep submitting almost-right answers forever; the score doesn't decay (only reveals do). With 1000-char tolerance + 4 reveal stages of 0.75× decay, a determined guesser can extract the right answer with no penalty by close-calling until they spell it correctly. — **exploitable**

**WAI3.** **`submitGuess` doesn't check `expiresAt`.** `whoAmI.ts:141-189`. 1-hour TTL set at L89, never read. Same as H/L. — **exploitable**

**WAI4.** **`fundBestMatch(guess, [session.answerName])` only considers the canonical name.** `whoAmI.ts:156`. If the answer is "Cristiano Ronaldo dos Santos Aveiro" (full name) and the curated `answerName` is "Cristiano Ronaldo", a player typing "C. Ronaldo" might miss the threshold (length-scaled: 16 chars → 3 edits — probably matches). But there's no alias list. A player typing "CR7" never matches. Compare to Survival which uses `validPlayers` — multi-name pool. — **annoying**

**WAI5.** **`status: "failed"` is permanent — no way to retry the same clue set.** `whoAmI.ts:180`. UI flow: get one wrong → game over → start new session with a new clue. That's by design, but the score-decay structure (1000 → 750 → 562 → 421) suggests "earn through clues" — punishing one mistake feels harsh given a clue set may be ambiguous. — **design decision**

**WAI6.** **`getSession` returns `answerName: null` while active, but `submitGuess` always returns `session.answerName` in its response on a final guess** (`whoAmI.ts:164`). On a *correct* guess this is fine. On a wrong final guess (status→failed), the response leaks the answer at L186 — needed for the UI reveal, but means a malicious client can intentionally submit any garbage to learn the answer. The scoring punishes them (score: 0) but the data is leaked. — **wrong** (anti-pattern; a wrong guess at clue 1 gives away the answer)

**Triage:** `fix soonest`

---

## 7. Daily Challenge — `convex/dailyChallenge.ts`, `src/pages/Daily*.tsx`

**D1.** **Lazy creation has no uniqueness guard — two simultaneous loads at UTC midnight insert two rows.** `dailyChallenge.ts:12-78`. The `by_date_sport_mode` index is non-unique (`schema.ts:187`). Two concurrent `getOrCreateChallenge` calls race; both `first()` returns null, both `insert`. Subsequent readers see whichever row the index orders first — but one player who got their `getOrCreate` to return the second-inserted row has a different question set than every other player that day. — **wrong** (rare, only at the midnight-UTC concurrency boundary)

**D2.** **Question deletion mid-day breaks attempts.** `dailyChallenge.ts:188`: throws "Question not found". `dailyChallenges.questionChecksums` is a frozen array — there's no snapshot of the question text. If an admin (or seed reset) removes a question after the daily was created, players hit a hard error mid-attempt. — **annoying**

**D3.** **`forfeit` is permanent — `startAttempt` blocks any retry today.** `dailyChallenge.ts:134, 288-305`. After a forfeit, `forfeited=true` AND row exists. `startAttempt` rejects. Player can't try again, even if they forfeited by mistake. UI may not warn. — **wrong** (or design — but should be made loud)

**D4.** **Reload silently penalizes — `currentQuestionStartedAt` is server-anchored at last submit, not at page-load.** `dailyChallenge.ts:252-254, 275`. After Q1 submit, server stamps now. If the user reloads on Q2, the client UI shows fresh 10s, but server's clock has been counting since Q1's submit. Repro: submit Q1, immediately reload before answering Q2; the elapsed time in the next submit reflects (reload duration + answer time). The agent's earlier claim that this *inflates* score was inverted — it actually deflates score. — **wrong** (player loses score for a refresh)

**D5.** **Time-bonus formula has a discontinuity at 1s.** `dailyChallenge.ts:258-260`: `<=1s → 100`, `<=10s → 100 * (10-t)/9`. At exactly 1.001s the player gets `100 * 8.999/9 ≈ 99.99 → 99`. So 1.0s = 100, 1.001s = 99. Cliff. Note also the curve floors at `> 10s → 0`, which truncates at the question's 10s wall — but `MAX_TIME_SEC = 10` is a constant; if a player takes 11s on the *server clock* due to network latency, the score is 0. — **annoying**

**D6.** **Day-rollover behavior is a one-way trap on midnight UTC.** `getTodayUTC()` is recomputed per call. `attempt.date` is fixed at start. If user starts at 23:58, day rolls to 04-27 mid-attempt; `submitAnswer` uses `attempt.date = "04-26"` — questions still resolve correctly. But the leaderboard for 04-26 receives a 04-27-completed score. The user then loads daily on 04-27 — `getTodayUTC()` returns 04-27, `getAttemptStatus` searches for 04-27 row, finds none, allows starting a new attempt. So the player gets two attempts that day (one for 04-26 retroactive, one for 04-27). — **exploitable** (free re-roll if you start near midnight)

**D7.** **Survival mode of daily is inert.** `dailyChallenge.ts:62-65`: `else { survivalInitials = []; }` and the schema field is empty. There's no read path for it in `dailyChallenge.ts` — the survival daily flow lives elsewhere or is unwired. Worth confirming it actually works for survival mode; if not, the `mode: "survival"` literal in the schema is dead weight. — **investigate**

**D8.** **No cron generates dailies — they appear on first read.** `crons.ts` has no daily generator. Players in UTC-12 get the new daily several hours later than UTC+12 players (when *they* visit). For ladder fairness this is fine since `attempt.date` is server-UTC, but for streak math it matters: the time-of-day a player is "expected" to play shifts. — **design decision**

**D9.** **`dailyAttempts` rows have no `expiresAt`.** Stale in-progress attempt (no `completed` and no `forfeited`) blocks `startAttempt` indefinitely. If a player abandons mid-game and `forfeit` is never called, they're locked out. Need a cleanup or an explicit "abandoned" state. — **wrong**

**Triage:** `fix soonest`

---

## 8. Live Match — `convex/liveMatches.ts`, `src/pages/LiveMatchScreen.tsx`

**LM1.** **`forfeit` doesn't update ELO.** `liveMatches.ts:237-259`: patches status/winnerId/completedAt, never calls `updateMatchElo`. So a player who quits mid-match loses no ELO; the winner gains nothing. Compare to natural completion at L429-431 which calls `updateMatchElo`. **Important** — this means rage-quit is the dominant strategy when losing. Repro: be losing in Q5, hit forfeit; check `userRatings` — unchanged for both players. — **exploitable**

**LM2.** **Strict-equality answer match.** `liveMatches.ts:154`: `answer === currentQ.correctAnswer`. Same risk as Blitz — any drift in option strings vs `correctAnswer` silently penalizes. — **wrong** (mirror of B1)

**LM3.** **No ELO idempotency marker on `liveMatches`.** Schema (`schema.ts:208-239`) has no `eloAppliedAt`. `advanceQuestion` (`liveMatches.ts:405-432`) calls `updateMatchElo` then sets `status: "completed"` AND `winnerId`. Convex retries the entire mutation on transient failure; if the patch lands but the network response is lost and the scheduler reruns, both players get +/-K twice. — **wrong**

**LM4.** **`HEARTBEAT_TIMEOUT_MS = 15000` is defined but never referenced.** `liveMatches.ts:11` constant; no cron in `crons.ts` reads `player1LastSeen` / `player2LastSeen`. Disconnected players leave the match in `waiting` or `question` indefinitely. `getActiveMatch` (`liveMatches.ts:333-374`) returns waiting/question matches, blocking re-matchmaking. Repro: enter a match, kill the tab, try to start a new live match — you're stuck on the old one. — **wrong**

**LM5.** **Cutthroat scoring read-then-write race window.** `liveMatches.ts:160-178`: P1's mutation reads `match.player2Answers`. If P2's mutation has not committed yet, P1 sees `otherAnswers.length <= currentQuestion` (P2 hasn't answered), awards full base. If P2 was actually faster but their mutation had not yet committed when P1's read-phase ran, P1 still wins the tiebreak. Convex serializes mutations on the same doc, so this is unlikely under same-doc contention — but the second mutation's handler re-runs from scratch on conflict, so the second writer always sees the fresher state. The real race is in *opponent timestamp resolution* — `answeredAt: Date.now()` vs `timeTaken` derived from `questionStartedAt`. — **investigate**

**LM6.** **Question text + correctAnswer locked at match creation.** `liveMatches.ts:54-59` snapshots `quizQuestions`. Stale data if the question is corrected mid-match. Annoying not exploitable. — **annoying**

**LM7.** **`getActiveMatch` returns `waiting` AND `question` but not `countdown` or `roundResult`.** `liveMatches.ts:333-374`. A player whose match is in those transient states gets `null` from `getActiveMatch` — UI sends them back to lobby, breaking the resume path on a brief disconnect during countdown. — **wrong**

**LM8.** **`setReady` schedules the countdown via `runAfter(3000)`, but if both players are already ready and the second `setReady` sees the first one's stale state, both schedule the countdown.** `liveMatches.ts:104-117`: `p1Ready = isP1 ? true : match.player1Ready` etc. If P1 calls setReady, then P2 calls before P1's patch landed, P2's read of `match.player1Ready` is `false`, so P2 only patches its own ready bit, no schedule. P1's mutation re-reads to confirm — wait, P1's read was the one that saw both as ready. So P1 schedules. Re-running P2 sees both as ready → P2 also schedules. Two `startQuestion` runs back-to-back, both setting `currentQuestion: 0` and `questionStartedAt: now` — mostly idempotent, but each schedules a `checkTimeout`, doubling the scheduled work. — **annoying** (extra scheduler fires)

**LM9.** **`opponentStatus` leaks correctness during the question phase.** `liveMatches.ts:299-306`: returns `lockedIn` (correct) vs `answeredIncorrectly` (wrong). The opponent's answer-correctness is exposed to the still-thinking player while the question is live. With the round-result transition only firing when both have answered (L201-211), a fast P1 can wait, see P2's correctness leak via the live query, then lock in their own answer based on whether P2 was right. — **exploitable**

**LM10.** **Time-tiebreak unstable on identical-clock submits.** `liveMatches.ts:155-157`: `timeTaken` floats. Two near-simultaneous corrects yield score = `BASE + Math.floor((10 - tt) * 10)`. The 50%-base penalty for "second correct" hinges on which mutation wrote first, which is non-deterministic under contention. — **wrong**

**LM11.** **`createFromChallenge` does not check whether either player already has an active match.** `liveMatches.ts:30-83`. Two challenges to the same player can each create their own `liveMatch` row, leaving the player with multiple active rows. `getActiveMatch` will return whichever the index sorts first. — **wrong**

**LM12.** **`questions` and `questionStartedAt` are in a single mutable doc — countdown overlay uses scheduler, not server time.** No way to recover a question's start time after a network drop except `match.questionStartedAt`. Client overlays should derive *all* timer state from `questionStartedAt`. The `CountdownOverlay` (referenced by screen) is hardcoded 3s client-side, not anchored to server. — **investigate**

**Triage:** `fix soonest`

---

## 9. Cross-cutting (ELO, Decay, Scoring, Fuzzy, Anti-cheat, Crons, TTL)

**X1.** **`lastDecayAt: 0` reset on every game completion makes the decay timer impossible to trigger for ~13-day-cadence players.** `games.ts:70, 191`; `liveMatches.ts:554, 569`. `eloDecay.ts:21-25` says: if `lastDecayAt > 0` use it (7-day threshold); else fall back to `lastPlayed` (14-day threshold). Since `lastDecayAt` is reset to 0 on every game and `lastPlayed` is updated to `now`, the 7-day branch is **unreachable** for any active player. A player who plays once every 13 days never decays. The intended decay-then-7-days path is dead. — **exploitable**

**X2.** **Decay floor (1499) is at the Silver/Gold tier boundary.** `eloDecay.ts:8`; tiers from `lib/elo.ts:50-53`: Gold = `>=1500`. A Gold-tier player at 1500 idle 14 days → first decay → 1499 = Silver. They lose tier but only via a passive process; the warning notification system may show a generic "your rating will decay" but doesn't say "you'll drop a tier". — **wrong**

**X3.** **`completeQuiz` / `completeSurvival` don't check `session.expiresAt`.** `games.ts:12-32, 131-149`. ELO can be finalized hours/days after the session was supposed to expire. — **wrong** (covered as Q1, S7 above)

**X4.** **Decay-warning notification orphaning.** `eloDecay.ts:51-56`: warning fires at day 11 (of 14). `decayWarningShown: true` patched. Player plays before day 14 → `completeQuiz` resets `decayWarningShown: false` and `lastDecayAt: 0`. The `decayNotifications` row (L59-66) is NOT deleted. User sees a still-undismissed warning until they click dismiss, even though they just played. — **annoying**

**X5.** **K-factor cliff at exactly `gamesPlayed === 30` and `eloRating >= 2000`.** `lib/elo.ts:11-13`: `<30 → K=40`, `>=2000 → K=16`, else K=32. A player who just hit game 30 sees K drop from 40 → 32. A player who just crossed 2000 ELO sees K drop from 32 → 16. The math implies an "instant-loss-K=24" moment for someone hitting 2000 ELO at game 29 — clean numerically but jarring for the player. UX has no surface for "your K just changed". — **annoying** (math surprise)

**X6.** **Quiz "win" defined as `accuracy >= 0.8`** (`games.ts:56`). Survival "win" = `score >= 10` (`games.ts:177`). Live Match "win" = winner of the game (any score). H/L, VerveGrid, Who Am I, Blitz: never write to `userRatings.wins` at all (no completion path). Inconsistent. — **wrong** (or design)

**X7.** **`peakRating`, `bestScore`, `gamesPlayed`, `wins`, `losses` are NOT reset by `seasonManager`.** Only `eloRating`. So the "best ever" stats across all seasons appear in the live `userRatings` row after a soft reset, while the new season's `eloRating` starts somewhere else. Lifetime peak survives season boundary — is this intentional? Probably yes. But it makes "best score this season" impossible to compute from `userRatings` alone; you must use `seasonHistory`. — **design decision**

**X8.** **Anti-cheat is wired into Survival only.** `useAntiCheat` consumers (verify in repo) call back into the per-mode mutation. `survivalSessions.ts:1154-1168` is the only mutation that records a tab-switch penalty. Quiz, Blitz, Daily, H/L, VerveGrid, WhoAmI, LiveMatch: tab-switching is a freebie. Player can alt-tab during a 10s daily question, look up the answer, return, and submit. — **exploitable**

**X9.** **`useAntiCheat` likely fires on mobile screen-lock too.** `visibilitychange` to `hidden` fires on lock-screen on iOS/Android. A legitimate "phone locks for 5s" counts as cheating in Survival. — **annoying** (already in PR1's plan as a toast — verify it's mobile-aware)

**X10.** **Two crons fire 5 minutes apart on UTC midnight: `season-check` (00:00) and `elo-decay-check` (00:05).** `crons.ts:6-7`. Convex doesn't promise serialization between cron jobs. If `seasonManager.checkSeason` is mid-flight when `eloDecay.runDecay` fires, decay reads userRatings rows that may be partially written. Likelier in practice: the season cron is fast (<1s), but with global rating sweeps it could overlap. No locking. — **investigate**

**X11.** **`seasonManager.checkSeason` has no idempotency guarantee against retries.** If Convex retries the cron (network blip on internal mutation), a duplicate "active" season can be inserted (no unique index on `seasons.isActive`). Schema (`schema.ts:269-276`). — **wrong**

**X12.** **`eloDecay` inserts a `gameSessions` row of `sessionType: "decay"` per ratings sweep.** `eloDecay.ts:41-50`. If the decay cron runs twice (retry), the user gets two decay rows but only one rating drop (idempotent on userRatings since `lastDecayAt: now` is patched first time, second pass sees `daysSinceReference < 7` and skips the decay branch). But the insert at L41 still fires before the day-check, no — let me re-read: L28 `if (daysSinceReference >= thresholdDays && rating.eloRating > DECAY_FLOOR)` gates the patch + insert. So second pass: lastDecayAt is now `now` (just patched), days = 0 → no decay. **Idempotent in practice.** Stand-down on this one. — _withdrawn_

**X13.** **Empty-string normalize matches 1-character names.** `lib/fuzzy.ts:46-51` + `normalizeAnswer("") === ""`, distance = 1, threshold for 1-char name = 1 → match. Real player names are never 1 char, so practically irrelevant — but `findBestMatch("", validPlayers)` will return the first valid player with `typoAccepted: true` if any are 1 char. Audit `validPlayers` for 1-char entries. — **annoying** (latent)

**X14.** **`normalizeAnswer` strips punctuation/case but not diacritics.** Confirmed by the substring match in VerveGrid (`verveGrid.ts:111`) and by reading callers — `normalizeAnswer` is at `lib/scoring.ts` (per imports at `quizSessions.ts:4`). Names like "Kylian Mbappé" vs "Kylian Mbappe" hit a 1-edit distance — fine for short names (threshold 2-3), but for an exact-match check (Quiz, Daily, Blitz) the diacritic differs. Quiz/Daily uses normalize on both sides which only helps if normalize stripped accents — verify the function actually does. If not, "Mbappe" won't match "Mbappé". — **investigate** (single source of truth, easy verify)

**X15.** **Session TTLs are advisory — Convex has no native TTL, no sweeper exists in `crons.ts`.** Quiz (30 min), Survival (60 min), H/L (1h), VerveGrid (1h), WhoAmI (1h), liveMatches (none), dailyAttempts (none). DB grows unboundedly with abandoned sessions. — **annoying** (operational)

---

## 10. Triage

### Fix soonest (real bugs / exploits, low surface area)
| # | Mode | Finding |
|---|---|---|
| LM1 | LiveMatch | `forfeit` doesn't update ELO — rage-quit is free |
| LM4 | LiveMatch | Heartbeat timeout never enforced — orphaned waiting matches |
| LM3 | LiveMatch | No ELO idempotency marker on retry |
| LM9 | LiveMatch | Opponent correctness leaked during question phase |
| X1 | Cross | `lastDecayAt: 0` resets — 13-day-cadence players never decay |
| X8 | Cross | Anti-cheat only wired in Survival; tab-switch is free in 7 modes |
| Q1/S7 | Quiz/Survival | `completeX` doesn't check `expiresAt` — finalize after TTL |
| S1 | Survival | Close-call has no rate limit / no penalty |
| S2 | Survival | Hidden-answer + on-fire bonuses stack opaquely |
| WAI2 | WhoAmI | Close-call lets infinite guesses, no decay on close-call |
| WAI3 | WhoAmI | No `expiresAt` check |
| WAI6 | WhoAmI | Wrong final guess always reveals `answerName` in response |
| HL3 | H/L | No `expiresAt` check |
| VG5 | VerveGrid | No `expiresAt` check |
| VG2 | VerveGrid | Empty `validPlayerIds` cells unguessable, not validated |
| B7 | Blitz | Cross-sport leaderboard pollution when sport arg omitted |
| B5 | Blitz | `endGame` saves score for unfinished games |
| D9 | Daily | `dailyAttempts` no `expiresAt` — abandoned attempt locks out player |
| D6 | Daily | Day-rollover allows two attempts (one for each side of midnight) |
| B1/LM2 | Blitz/Live | Strict equality vs Quiz/Daily's normalize — silent drift bug |

### Investigate (likely real, needs deeper read or repro before fixing)
| # | Mode | Finding |
|---|---|---|
| HL1 | H/L | Tie-value filter ends games prematurely on clustered pools |
| LM5 | LiveMatch | Cutthroat scoring race semantics under same-doc contention |
| LM7 | LiveMatch | `getActiveMatch` doesn't return `countdown`/`roundResult` — broken resume |
| LM12 | LiveMatch | Countdown overlay not anchored to server time |
| D1 | Daily | Race-induced duplicate `dailyChallenges` rows at midnight |
| D7 | Daily | Survival mode of daily appears unwired in `dailyChallenge.ts` |
| VG3 | VerveGrid | `alreadyUsed` UI handling in screen — verify branch |
| X14 | Cross | `normalizeAnswer` diacritic stripping — confirm in `lib/scoring.ts` |
| X10 | Cross | Cron overlap (season-check vs elo-decay 5min apart) |
| X2 | Cross | Decay floor 1499 silently demotes Gold→Silver |
| X11 | Cross | `seasonManager` not idempotent on retry — duplicate active season |
| Q3 | Quiz | Image-question soft-fallback violates 3-cap or no-consecutive |
| HL4 | H/L | No ELO finalization — is this intentional? |
| VG6 | VerveGrid | No ELO finalization — same question |

### Design decision needed
| # | Mode | Finding |
|---|---|---|
| Q5 | Quiz | Time-bonus formula not surfaced — player can't optimize |
| B6 | Blitz | Subtractive-only timer — no positive reinforcement |
| WAI5 | WhoAmI | One-and-done failure feels harsh given the clue investment |
| S4 | Survival | Hint-stage reset semantics not surfaced |
| VG4 | VerveGrid | Cell rarity (validPlayerIds size) not exposed — score not weighted |
| X6 | Cross | "Win" definition varies per mode; some modes don't track wins at all |
| X7 | Cross | `peakRating` etc. survive season reset — intended? |
| D8 | Daily | No daily generator cron (lazy-load). Streak math vs timezone fairness. |
| D3 | Daily | Forfeit permanence — UX should warn or allow retry |
| LM6 | LiveMatch | Question text snapshot at match creation — staleness window |

---

### Confidence notes / caveats
- **Refined two agent claims that overstated severity:** WhoAmI score is not "always 0" — it floors at ~421 after 4 reveals (L118 math). Daily reload doesn't *inflate* score; it *deflates* it because `currentQuestionStartedAt` is server-anchored.
- **Withdrew X12** (eloDecay double-insert) — re-read shows the decay branch is gated on `daysSinceReference >= thresholdDays`, so the second cron pass sees `days = 0` and skips.
- **Did not directly read:** `WaitingRoomScreen.tsx`, every `Daily*Screen.tsx`, anti-cheat hook source. Some screen-side claims (LM7, VG3, X14) are flagged "investigate" pending those reads.
- **Sport-agnostic findings dominate** — most issues live in Convex modules and apply to football/basketball/tennis equally.
