# VerveQ — Comprehensive App Overview

> **Read this first.** Production runs the **v2 shell**
> (`VITE_V2_SHELL_ENABLED=true`). The hub this document's Screen Inventory and
> User Flow were written around — `LoginScreen` as the entry, `HomeScreen` as
> the hub — is superseded: v1 `HomeScreen` is **not reachable in production**
> and is stripped from the deployed bundle entirely, and `LoginScreen` mounts
> only for an explicit `?mode=` / `?from=` auth intent.
>
> The v1 seam is **not uniformly dead**, so don't over-read that. Most v1 mode
> routes are `V2Redirect`-wrapped and forward to a `/v2/*` counterpart, but a
> few v1 deep-link screens are still live regardless of the flag —
> `/duel/play/:duelId`, `/duel/result/:duelId` and `/rivals/:opponentUserId`
> render v1 screens under `UsernameRequiredRoute`, and `/duel/:linkCode`
> (the share-link landing) is live and unguarded by design.
>
> Where this document and [`app/src/App.tsx`](../app/src/App.tsx) disagree
> about routes, App.tsx is the truth. See "Screen Inventory" and
> "Authentication" for the live surfaces.

## What is VerveQ?

VerveQ is a competitive sports trivia platform where players test and prove their sports knowledge through multiple game modes: **Quiz**, **Survival**, **Blitz**, **Higher or Lower**, **VerveGrid**, **Career Path**, **Daily Challenge**, and the synchronous multiplayer **Challenge Arena** rooms. Players earn ELO ratings, climb leaderboards, unlock achievements, contribute community questions via **The Forge**, and challenge friends — all across three supported sports.

> **Live Match was removed in July 2026** along with the `liveMatches`
> subsystem. Its former section below is retained as a marker only.

The platform targets sports enthusiasts who want more than casual trivia. VerveQ's ELO rating system, borrowed from competitive chess, provides a meaningful measure of sports knowledge that evolves with every game played.

---

## Supported Sports

| Sport | Emoji | Text Questions | Image Questions | Survival Players |
|-------|-------|---------------|----------------|-----------------|
| Football | ⚽ | 411 | 2,066 | 30,913 |
| Basketball | 🏀 | 285 | 448 | 3,608 |
| Tennis | 🎾 | 274 | — | 1,156 |
| **Total** | | **970** | **2,514** | **35,677** |

**Grand total: 3,484 quiz questions** (970 text + 2,514 image).

> These counts are a **dated snapshot and were not re-verified**. They are live
> Convex row counts, and the bank is composed at runtime
> (`knowledgeQuestions.push(...)`), so they cannot be checked from the repo.
> Directionally they now undercount — the 24 CIE batches and later expansions
> landed after this table was written. Count against the deployment before
> relying on them.

Current mode availability is mixed:

- Survival remains multi-sport in current runtime.
- Higher or Lower is currently football-only in frontend and backend.
- VerveGrid is currently football-only in frontend and backend.
- Career Path is currently football-only in frontend and backend.

---

## Game Modes

### Quiz Mode

A timed multiple-choice trivia game with 10 questions per session.

**How it works:**
1. Player selects a sport and difficulty level (Easy, Medium, or Hard)
2. A session is created and 10 unique questions are served one at a time
3. Each question presents 4 answer options (A, B, C, D)
4. Player taps an option to submit — there is no confirm button; the tap is the answer
5. The correct answer is revealed with an optional explanation; the next question auto-advances after ~2 seconds
6. After 10 questions, the game ends and results are displayed

**Scoring:**
- Base score: 100 points per correct answer
- Time bonus: Faster answers earn more points (linear decay from 100% at 1 second to 0% at 10 seconds)
- Final score is the sum of all time-weighted correct answers

**Difficulty levels:**
- **Easy** — Casual fun, relaxed pace. Common knowledge questions.
- **Medium (Intermediate)** — Balanced challenge. Requires solid sports knowledge.
- **Hard** — Expert level, no mercy. Deep trivia for hardcore fans.

**Image-based questions:**
- Some questions include images: stadium identification, team badge recognition, and player silhouettes
- Maximum 3 image questions per session, with no consecutive image questions
- Images support tap-to-zoom for better visibility
- Knowledge `enterprise_logos` and `which_came_first` content is arena/duel-only and excluded from MCQ quiz, Blitz, and Daily Quiz pools.

**Question deduplication:**
- Each question has a unique checksum (content hash)
- The session tracks all served checksums to prevent repeats within a game
- Questions also track global usage statistics (times answered, times correct, usage count)

**Community difficulty feedback:**
- After answering, players can vote on perceived difficulty
- Votes are aggregated into a community difficulty score per question
- This helps calibrate question difficulty over time

**Question categories by sport:**

| Football | Basketball | Tennis |
|----------|-----------|--------|
| Premier League | NBA Players | Grand Slam Winners |
| La Liga | NBA Teams | Masters 1000 Winners |
| Bundesliga | NBA Draft | Player Records |
| Serie A | NBA Trivia | ATP Rankings |
| Ligue 1 | NBA Championships | Finals and Runners |
| Eredivisie | | Nationality |
| World Cup | | Statistical Comparisons |
| Champions League | | |
| Transfer Records | | |
| International | | |

**Text question count by difficulty:**

| Difficulty | Football | Basketball | Tennis | Total |
|-----------|----------|-----------|--------|-------|
| Easy | 110 | 82 | 72 | 264 |
| Intermediate | 177 | 159 | 141 | 477 |
| Hard | 124 | 44 | 61 | 229 |
| **Total** | **411** | **285** | **274** | **970** |

**Image question count by category:**

| Category | Football | Basketball | Total |
|----------|----------|-----------|-------|
| Player Silhouette | — | — | 2,018 |
| Badge Identification | — | — | 268 |
| Stadium Identification | — | — | 228 |
| **Total** | **2,066** | **448** | **2,514** |

---

### Survival Mode

A progressive challenge where players guess sports player names from their initials.

**How it works:**
1. Player selects a sport (no difficulty selection — difficulty scales automatically)
2. The game presents 2-letter initials (e.g., "MK") and the player must name a player with those initials
3. Player types a name and submits their guess
4. The system uses fuzzy string matching (Levenshtein edit distance) to validate the answer
5. Correct guesses advance to the next round; wrong guesses cost a life
6. The game ends when all 3 lives are lost

**Lives system:**
- Players start with 3 lives (displayed as hearts)
- Wrong guesses cost 1 life
- Game over at 0 lives

**Help system (Reveal Ladder):**
- Served by `survivalSessions.requestHelp`. Per-round ladder stage
  (`helpStage`) plus a per-game skip budget (`skipsLeft`).
- **Stage 1:** Nationality and club/team information
- **Stage 2:** Position, era, or handedness details
- **Stage 3:** First name of a matching player
- Stages must be used in order.
- Help does not cost a token — it **shrinks the round's pot**, which is why
  survival score is banked points rather than a round count (see ELO below).

> The old model — 3 hint tokens per game (`hintTokensLeft`,
> `currentHintStage`) and 1 free skip (`freeSkipsLeft`) — was replaced by the
> Reveal Ladder. Those fields are marked deprecated in `schema.ts` and kept
> optional only so pre-cutover rows still validate until they expire.

**Speed streak / "On Fire" system:**
- Fast answers (under 4 seconds) build a speed streak counter
- Reaching a streak of 5 triggers "On Fire" status
- While "On Fire," each correct answer adds +0.1 to the performance bonus
- Hitting exactly a 5-streak with fewer than 3 lives grants +1 life (earn-a-life)

**Hidden answer bonus:**
- Players earn a bonus for finding valid players who are not the primary (most famous) player for those initials

**Anti-cheat:**
- Tab-switch detection penalizes players who leave the game, after a short
  grace period (`useAntiCheat` defaults `hiddenGraceMs = 1000`, cleared if the
  player returns in time).
- Standard survival: the **first** offense only floors that round's pot
  (`antiCheatWarned` / `potFloorRound`); **repeat** offenses cost a life
  (`schema.ts`).
- Daily survival: instant forfeit.

**Difficulty progression by round:**

| Round | Initials Length | Player Fame | Label |
|-------|----------------|-------------|-------|
| 1-2 | 2 letters | Famous players only | Easy |
| 3 | 2 letters | Mostly famous (80%) | Easy |
| 4 | 2 letters | Mixed (60% famous) | Medium |
| 5 | 2 letters | Less famous (40%) | Medium |
| 6-7 | 2 letters | Obscure players (20%) | Hard |
| 8+ | 2-3 letters | Obscure players (20%) | Expert |

**Fuzzy matching:**
- Uses the Levenshtein edit distance algorithm
- Dynamic tolerance based on player name length:
  - Short names (<8 chars): max 1 edit allowed
  - Medium names (8-14 chars): max 2 edits allowed
  - Long names (>14 chars): max 3 edits allowed
- This allows for minor typos and spelling variations
- Close calls (within 1-2 edits beyond the threshold) are flagged as near misses

**Survival data by sport:**

| Sport | Unique Initials | Total Players | Data Size |
|-------|----------------|---------------|-----------|
| Football | 1,957 | 30,913 | 800 KB |
| Basketball (NBA) | 558 | 3,608 | 81 KB |
| Tennis | 476 | 1,156 | 38 KB |

---

### Blitz Mode

A 60-second rapid-fire quiz that tests speed and accuracy under pressure.

**How it works:**
1. Player selects a sport
2. A 60-second countdown begins immediately
3. Intermediate difficulty questions are served one at a time
4. Player selects an answer; result flashes briefly (400ms correct, 800ms incorrect) then auto-advances
5. Game ends when the timer expires or no more questions are available

**Scoring:**
- 100 points per correct answer
- Wrong answers impose a -3 second time penalty (reduces remaining time)
- No per-question time limit — the global 60-second timer is the constraint

**Special mechanics:**
- Image question limits apply (max 3 per session, no consecutive)
- Anti-cheat: Tab-switching auto-marks the current answer as wrong
- High scores are tracked globally and per-sport via the `blitzScores` table

---

### Higher or Lower

A streak-based guessing game comparing player or team statistics.

**Current availability:** Football-only.

**Current runtime layer:** Approved `higherLowerPools` + `higherLowerFacts`.

**How it works:**
1. Player selects football
2. An initial player/team is shown with a specific stat value (e.g., "Goals Scored")
3. A second player/team is shown with their value hidden
4. Player guesses if the hidden value is "Higher" or "Lower"
5. Correct guesses increment the streak and score, and the current target becomes the new baseline
6. Wrong guesses immediately end the game

**Scoring:**
- 1 point per correct guess
- Final score equals the longest streak

---

### VerveGrid

A 3x3 grid intersection challenge testing deep sports knowledge.

**Current availability:** Football-only.

**Current runtime layer:** Curated `verveGridBoards` derived from `verveGridApprovedIndex`.

**How it works:**
1. Player selects football
2. A 3x3 grid is presented with row headers (e.g., Teams) and column headers (e.g., Nationalities or Positions)
3. Player clicks an empty cell and searches for an athlete who matches both the row and column criteria
4. Players have exactly 9 total guesses for the 9 cells
5. A correctly guessed player cannot be reused in another cell
6. Game ends when all 9 guesses are used or the grid is perfectly filled

**Scoring:**
- Grid completion out of 9 possible correct answers

---

### Career Path

Guess the player from the chronological list of clubs he played for (e.g., Barcelona → Paris Saint-Germain → Inter Miami → Messi). Replaced Who Am I in July 2026.

**Current availability:** Football-only.

**Current runtime layer:** In-bundle dataset `app/convex/data/football_career_paths.json` (no DB content table; sessions live in `careerPathSessions`).

**How it works:**
1. Player launches the mode from the Compete grid (no difficulty picker; rounds mix easy/medium/hard by weight)
2. The full club path is shown up front; the round is worth 1,000 points
3. The player types a name — there is deliberately NO autocomplete; server-side fuzzy matching absorbs typos instead, with a tolerance that scales with the length of the player's name (1–3 edits)
4. A near-miss ("close call") costs 10% of the score but not a guess
5. A wrong guess halves the remaining potential score; three wrong guesses end the round at 0 points

---

### Daily Challenge

A once-per-day challenge with a shared question set and daily leaderboard.
Both Daily Quiz and **Daily Survival** are playable.

**How it works:**
1. Each day (UTC-based), a unique set of questions is generated per sport using seeded shuffling
2. All players receive the same questions on the same day
3. Player selects a sport for Daily Quiz
4. Only one attempt per player per day is allowed
5. Results contribute to a daily leaderboard

**Daily Quiz:**
- 10 questions at intermediate difficulty
- Same scoring as standard quiz (100 points base + time bonus)
- Tap-to-submit: tapping an option locks the answer instantly; the reveal auto-advances after ~2 seconds
- Maximum possible score: 1,000 points

**Daily Survival:**
- Playable at `/v2/daily-survival` (`App.tsx`), served by
  `survivalSessions.startDailyGame`. The daily set is built by
  `ensureDailySurvivalChallenge` (`survivalSessions.ts`, called from
  `dailyChallenge.ts`).
- 10 rounds (`DAILY_SURVIVAL_ROUNDS`).
- **Casual by design — not ranked.** `games.ts` excludes it from ELO
  explicitly.

**Special mechanics:**
- Seeded shuffling ensures fairness — every player faces the same challenge
- Once attempted, results are final until the next UTC day
- Image question limits apply (max 3, no consecutive)

---

### Live Match — REMOVED 2026-07

The real-time head-to-head mode and its whole `liveMatches` subsystem were
deleted. Nothing described here is live:

- `app/convex/liveMatches.ts` — deleted.
- Routes `/live-match` and `/waiting-room` — removed; those URLs now fall
  through to NotFound (`app/src/App.tsx`).
- The `live-match-stale-check` cron — removed with the subsystem
  (`app/convex/crons.ts`).
- Tables `multiplayerMatches`, `challengeHeadToHeads`, `challengeMatchHistory`
  — removals recorded in `app/convex/schema.ts`.

The asynchronous **Duels** system is the surviving head-to-head format — see
[`docs/CHALLENGE_DUELS.md`](CHALLENGE_DUELS.md).

---

### Challenge Arena

Synchronous, server-clocked multiplayer rooms with a mobile-first UI. Additive
to `duels`. (Originally also additive to `liveMatches`, removed 2026-07.)

**Supported modes:** `1v1`, `2v2`, `ffa3`, `ffa4`, `ffa5`.

**How it works (player flow):**
1. From the Challenge tab, tap **Create Arena** (pick mode) or **Join code**.
2. The host gets a 6-char code; share via the Web Share API or copy a
   `/arena/<code>` link. Friends opening the link land in the same lobby.
3. Lobby shows live roster, team picker (2v2), per-player ready state, and
   what's blocking start. A **?** help button in the lobby header opens a
   dismissible rules card. Host can **Start** when ≥2 active and everyone
   ready, or **Force start** after a 15s grace period (drops unready non-hosts).
4. 3-2-1 countdown previews round 1's category, then 5 rounds run automatically:
   football quiz → general knowledge → which came first → name the logo →
   capital cities.
5. Each question runs on a 10-second server-clocked timer with a live progress
   bar. **Tap an option to submit** — there is no separate confirm step;
   submissions lock the moment the tap reaches the server. The reveal screen
   shows the correct answer, every player's pick, points awarded, and your
   running total.
6. Round break shows the round leaderboard (team totals in 2v2), the next
   category, a per-player ready-up button, and an "auto-advance in ~8s" hint.
7. Final screen subscribes to `challengeArenas.getArenaSummary` and renders an
   orange neo-brutalist **CHAMPION** (solo) or **WINNING TEAM** (2v2) hero,
   three award chips (Fastest / Accuracy / Hot Streak — raw tied winners, no
   spreading), and a **FINAL STANDINGS** table (`# / Player / Score / Acc / Avg`)
   that groups members under team markers in 2v2 and highlights the winner row.
   **Rematch — same crew** and **Share result** sit at the bottom and are
   always visible.

**Frontend routes:**
- `/challenge` — entry point with Create Arena / Join code buttons.
- `/arena/:code` — single reactive arena screen that drives lobby, countdown,
  question, reveal, round break, and final podium from one `getRoom` query.

**Recovery:** Refresh, lose signal, or accidentally close the tab — re-opening
`/arena/<code>` rejoins (`join` is idempotent for active players) and resumes
at the room's current phase. Leave is reachable from every screen and never
traps the user.

**Rounds:**
- Football quiz
- General knowledge
- Which came first
- Name the logo, using existing badge-identification image MCQs when available
- Capital cities, seeded idempotently from bundled public-domain factual data

**Scoring:**
- Wrong or missed answers score 0
- Correct answers get base + time bonus + rank-order bonus
- `2v2` leaderboards sum team-member scores

A **username** is required to host or join — not a full account. Both
`create` and `join` go through `assertUsernameRequiredUser`
(`app/convex/lib/authz.ts`), which admits anonymous users that hold a
username, so `usernameOnly` players can play. ELO, matchmaking, chat, and
global leaderboards are intentionally out of scope.

See [`docs/CHALLENGE_ARENA.md`](CHALLENGE_ARENA.md) for state machine,
server-authoritative guarantees, leave-safety, content fallback behavior, cron
details, and the frontend wiring notes.

---

### The Forge

A community-driven question creation and curation system. Not a playable game mode.

**Access requirement:** 1,500+ ELO (Gold tier)

**Three activities:**

1. **Submit** — Create a new multiple-choice question (sport, category, difficulty, 4 options, correct answer, optional explanation and image). Duplicate detection via checksum prevents re-submissions.

2. **Review** — Vote to approve or reject pending questions from other players. Players cannot vote on their own submissions. One vote per reviewer per submission.

3. **My Submissions** — Track the status of submitted questions (pending, approved, rejected) with vote counts.

**Approval system:**
- +5 net votes (approvals minus rejections) = question is approved and auto-inserted into the quiz pool
- -3 net votes = question is rejected
- Approved questions earn the "The Architect" achievement on first approval

---

## ELO Rating System

VerveQ uses an ELO-based rating system inspired by competitive chess to track player skill.

**Core parameters:**
- **Starting ELO:** 1,200
- **K-Factor:** Dynamic based on experience and rating:
  - **40** — Placement matches (fewer than 30 games played)
  - **32** — Standard (default for most players)
  - **16** — High-tier protection (players rated 2,000+)
- **Rating range:** 800 (floor) to 2,400 (ceiling)
- **Tracked per:** sport + mode combination (e.g., football/quiz, basketball/survival)

**How it works:**
1. Each difficulty level has an "opponent rating":
   - Easy: 1,000
   - Intermediate: 1,200
   - Hard: 1,400
2. Expected score is calculated: `E = 1 / (1 + 10^((opponent - player) / 400))`
3. Performance score is computed from game results (0.0 to 1.0)
4. ELO change: `delta = K * (performance - expected)`
5. New rating is clamped to [800, 2400]

**Performance calculation:**

*Quiz mode:*
```
accuracy = correctAnswers / totalQuestions
timeBonus = (avgTime < 5s) ? 0.1 * (1 - avgTime/5) : 0
performance = min(accuracy + timeBonus, 1.0)
```

*Survival mode:*
```
performance = min(points / SURVIVAL_PERFECT_POINTS, 1.0)   // 2000
```
A survival score is **points banked from round pots** (Easy 100 … Expert 300,
shrinking with help usage), *not* a count of correct rounds. ~2000 points is
roughly the old "15 flawless rounds" perfect run
(`getSurvivalPerformance`, `app/convex/lib/elo.ts`).

**Win/Loss determination:**
- Quiz: Win if accuracy >= 80%
- Survival: Win if points >= `SURVIVAL_WIN_POINTS` (1200) — `games.ts`

**Tier system (derived from ELO):**

| Tier | ELO Range | Badge Color |
|------|-----------|-------------|
| Bronze | < 1,200 | Muted |
| Silver | 1,200 - 1,499 | Muted |
| Gold | 1,500 - 1,999 | Primary |
| Platinum | 2,000+ | Accent |

**ELO decay (inactivity penalty):**
- Applies to players at 1,500+ ELO (Gold tier and above)
- After 14 days of inactivity: -25 ELO, then -25 every 7 days thereafter
- Decay floor: Cannot drop below 1,499 via decay
- Players receive a warning notification 3 days before decay triggers
- Playing any game resets the decay timer

**Seasonal reset:**
- Seasons last 90 days
- At season end, all ratings receive a soft reset: `newElo = (currentElo + 1200) / 2`
- Final standings are archived with rank, tier, ELO, games played, and wins
- New season begins automatically

---

## Result Grading

After each quiz game, players receive a letter grade based on accuracy:

| Grade | Accuracy | Stars |
|-------|----------|-------|
| A | >= 90% | 3 |
| B | >= 70% | 2 |
| C | >= 50% | 1-2 |
| D | >= 30% | 1 |
| F | < 30% | 0 |

The results screen also displays:
- Final score (animated)
- ELO change (green arrow up / red arrow down)
- Stats grid: correct answers, average time, accuracy %, total score
- Options to play again, try the other mode, or return home

---

## Achievement System

8 achievements are available, each with point values and unlock criteria:

| Achievement | Category | Points | Unlock Criteria |
|------------|----------|--------|----------------|
| 🎯 Quiz Rookie | Quiz | 10 | Complete your first quiz |
| ❤️ Survivor | Survival | 10 | Complete your first survival game |
| 🏆 Quiz Master | Quiz | 50 | Get 100% accuracy in a quiz |
| 🔥 Survival Legend | Survival | 50 | Score 15+ in survival mode |
| ⚡ Multi-Sport Athlete | General | 25 | Play 2+ different sports |
| 💪 Dedicated Player | General | 30 | Play 50 total games |
| 👑 ELO Champion | General | 100 | Reach 1,500 ELO rating |
| 🛠️ The Architect | Community | 75 | Get your first community question approved in The Forge |

**Maximum achievable points:** 350

Achievements are automatically checked after each game completion. Newly unlocked achievements are displayed on the results screen and visible in the profile.

---

## Leaderboard System

Global rankings filtered by sport, mode, and time period.

**Filters:**
- **Sport:** All, Football, Tennis, Basketball
- **Mode:** Quiz, Survival
- **Period:** Daily, Weekly, All Time

**Display:**
- **Top 3:** Podium view with avatars, names, and ELO ratings. 1st place gets a crown icon.
- **Rank 4+:** List view with rank number, avatar, username, ELO rating, and tier badge.

Rankings are sorted by ELO rating in descending order, limited to players with at least 1 game played.

---

## Challenge System

Players can challenge friends to compete head-to-head through two backend
paths. The Challenge tab (`/challenge`) is now an **async Duel Hub** built on
top of `duels`, `rivalries`, and `challengeNotifications`. The old synchronous
"send invite → live match" path was **removed 2026-07** along with
`liveMatches` and the legacy `challenges` subsystem; Duels is the only
head-to-head path now.

**Async Duel path (primary):**
1. From `/challenge`, tap **New Duel** to pick:
   - **Duel kind** — Sports trivia, Knowledge, or "Which Came First"
   - **Topic** — sport (football / basketball / tennis) or knowledge category
   - **Difficulty** — easy / medium (intermediate) / hard
   - **Opponent** — pick a rival, search a `@username`, or generate a share link
2. The server creates a `duels` row, locks a seeded `questionChecksums[]` set,
   and (for link duels) returns a `linkCode` you can share over the Web Share
   API or copy.
3. Each player answers in-order through `duels.submitAnswer`; the server
   serves the current question, validates, and derives timing from per-question
   `servedAt`.
4. When both players complete, or expiry fires from the hourly cron, the
   server resolves the winner and writes `rivalries`.
5. The Duel Hub groups every duel into **Your Turn** / **Awaiting opponent** /
   **Resolved**, with a per-card status badge and CTA. The Challenge nav icon
   carries an unread badge from `notifications.unreadCount`.

**Synchronous Live Match path — REMOVED 2026-07:**
`liveMatches` and the legacy `challenges` subsystem were both deleted
(`app/convex/schema.ts` records the table removals). Duels are the only
head-to-head path now.

Async duels use the existing `quizQuestions` table. Knowledge is modeled as
`sport: "knowledge"` with category taxonomy, including `which_came_first`;
there is no separate knowledge table.

**Duel states:**
- **Awaiting opponent** — duel is open / in progress
- **Resolved** — both players completed (or attached after expiry)
- **Expired** — server resolved by `expiresAt` hourly cron
- **Declined** — invited opponent rejected the duel

**Rivals screen (`/rivals`):**
- Lists every counterparty from `rivalries.listMine` with running W-L-D,
  current streak, and last duel timestamp
- Tap an opponent to open `/rivals/:opponentUserId` which shows the
  head-to-head card and a one-tap **Rematch** that calls `duels.rematch`

**Share-link landing (`/duel/:linkCode`):**
- Anyone can open the link. A guest can play immediately using a tab-local
  `guestToken` persisted in `localStorage` (`verveq_duel_guest_token::<code>`),
  which the backend hashes into `opponentGuestTokenHash`.
- After the guest finishes the duel, the UI prompts them to create an account.
  A pending-attach hint is persisted to `localStorage` and `LoginScreen`
  redirects back to `/duel/:linkCode` after signup; the landing then calls
  `duels.attachGuestResult` to bind the result to the new account before
  showing the result screen. Signup never auto-creates a Convex anonymous
  user — guest play stays tab-local until the user explicitly registers.

The Challenge Hub, async duel play, result/share card, rivals, and link
landing routes are lazy-loaded behind a `Suspense` boundary and wrapped in a
top-level `ErrorBoundary`. See [`docs/CHALLENGE_DUELS.md`](CHALLENGE_DUELS.md)
for the backend state machine, scoring model, link bridge, rivalry ledger,
and cron behavior — plus the frontend wiring notes appended at the end.

---

## User Profile

Each player has a profile displaying their competitive history:

- **Avatar** — Generated from display name initials
- **ELO Rating** — Highest rating across all sport/mode combinations
- **Tier Badge** — Bronze, Silver, Gold, or Platinum
- **Stats Grid:**
  - Total games played
  - Win rate (%)
  - Best streak
  - Favorite sport (most games played)
- **Achievements** — Grid of unlocked/locked achievement badges (first 6 shown)
- **Recent Games** — Last 10 games with sport, mode, score, date, and ELO change

---

## Authentication

The live model is **username-only onboarding with an in-place upgrade**.
[`docs/AUTH.md`](AUTH.md) is the reference; this is the summary.

A visitor gets a real anonymous *server* identity first, claims a username
second, and attaches email + password later — keeping the same `users` doc,
username, and casual progress. Four states, all derived server-side from
`users.me`:

| State | Can play |
|-------|----------|
| `loggedOut` | cold entry / taste round |
| `needsUsername` | anonymous session, no username yet |
| `usernameOnly` | casual + social modes (Arena, Duels, Career Path, Learn) — **excluded from ranked** |
| `fullAccount` | everything, including ranked (Quiz, Survival, Blitz) |

- **`startAnonymousSession()`** — the real Convex anonymous provider, gated on
  a single-use IP permit. Not a client-side pretend-guest.
- **`claimUsername()`** — uniqueness enforced by the `usernameClaims` table.
- **`upgradeAccount(email, password, displayName?)`** — attaches credentials
  to the same doc via `users.upgradeUsernameOnly`. Ranked is not backfilled;
  it starts on upgrade.
- **`signUp(email, password, username, displayName?)`** — the direct path.
  Username is **explicit**, not derived from the email or display name.

Ranked gating is enforced on both sides: `FullAccountRoute` client-side,
`app/convex/lib/authz.ts` server-side.

`loginAsGuest()` ("Play as guest" on `LoginScreen`) is a **legacy tab-local
seam** with no server identity — every v2 surface treats it as logged out.
"Quick Start" does not exist.

Sessions are Convex Auth; passwords are hashed with Scrypt.

---

## User Flow

> **This is the v1 flow — a rollback seam, not the live product.** In
> production the entry is `/` → `ColdEntryScreen` (signed out) or the v2 shell
> home, and onboarding is `UsernameOnlyOnboarding` (username-only), not a
> 3-step wizard off a login screen. "Quick Start" does not exist in the
> codebase. `App.tsx` is the route truth; the diagram below is retained
> because the mode-level flows (Sport Select → Play → Results, the Arena
> lobby chain, the Duel chain) still describe what happens inside each mode.

```
[v1 seam] Login Screen
  ├── Play as Guest ────────── Onboarding (3 steps) ────────── Home
  └── Create Account ───────── Onboarding (3 steps) ────────── Home

[v1 seam] Home Screen
  ├── Quiz Mode ────── Sport Select ── Difficulty Select ──── Quiz (10 Qs) ── Results
  ├── Survival Mode ── Sport Select ───────────────────────── Survival ─────── Results
  ├── Daily Challenge ─ Sport Select ── Mode Select ────────── Daily Quiz/Survival ── Daily Results
  ├── Blitz Mode ───── Sport Select ───────────────────────── Blitz (60s) ─── Blitz Results
  ├── Higher/Lower ── Sport Select ───────────────────────── Higher or Lower ── Results
  ├── VerveGrid ───── Sport Select ───────────────────────── VerveGrid ──────── Results
  ├── Career Path ─── (direct launch) ──────────────────────── Career Path ────── Results
  ├── Forge ─────────── Submit / Review / My Submissions
  ├── Leaderboard (bottom nav)
  ├── Challenge / Duel Hub (bottom nav)
  │     ├── Challenge Arena
  │     │     ├── Create Arena (mode) ── /arena/:code ── Lobby → Countdown → Question/Reveal × 50 → Round break × 4 → Final Podium ── Rematch
  │     │     └── Join code ── /arena/:code (auto-join, then same flow)
  │     ├── New Duel ── Kind ── Topic ── Difficulty ── Opponent ─┐
  │     │                                                       ├── Duel Play ── Duel Result ── Rematch
  │     │                                                       └── Share Link
  │     ├── Your Turn / Awaiting / Resolved
  │     ├── Rivals ───── Rival Detail ── Rematch
  │     └── Share-link landing (/duel/:linkCode) — guest plays → signup → attach
  └── Profile (bottom nav)

Results Screen
  ├── Play Again ──── Sport Select
  ├── Try Other Mode ── Sport Select
  └── Back to Home
```

**Onboarding steps:**
1. Welcome — Feature overview (ELO Rankings, Game Modes, Achievements)
2. Pick Your Sport — Select a preferred sport
3. Your Skill Level — Select Beginner / Intermediate / Expert

---

## Screen Inventory

**The live routes are the `/v2/*` shell below.** The v1 table that follows is
mostly the rollback seam: with `VITE_V2_SHELL_ENABLED=true` those routes are
`V2Redirect`-wrapped and forward to their v2 counterpart, and v1 `HomeScreen`
is unreachable — dead-code-eliminated from the deployed bundle.

Exceptions worth knowing: `/duel/play/:duelId`, `/duel/result/:duelId` and
`/rivals/:opponentUserId` are **not** redirect-wrapped — they render v1
screens under `UsernameRequiredRoute` and serve real traffic. `/duel/:linkCode`
is live and deliberately unguarded (a shared duel link must land for a
signed-out visitor). Source of truth for both tables is
[`app/src/App.tsx`](../app/src/App.tsx).

### Live (v2 shell)

| Route | Purpose |
|-------|---------|
| `/` | `ColdEntryScreen` when signed out; otherwise redirects to shell home. `LoginScreen` only with an explicit `?mode=` / `?from=` auth intent |
| `/v2/welcome` | `UsernameOnlyOnboarding` — the onboarding card |
| `/v2/upgrade` | `UpgradeAccountForm` — username-only → full account |
| `/v2/account`, `/v2/profile`, `/v2/settings` | Account, profile, settings |
| `/compete`, `/compete/sport`, `/compete/sport/:sport` | Compete category → sport → mode grid |
| `/v2/quiz`, `/v2/survival`, `/v2/blitz` | Ranked modes (`FullAccountRoute`) |
| `/v2/daily`, `/v2/daily-survival` | Daily Quiz, Daily Survival |
| `/v2/higher-lower`, `/v2/verve-grid`, `/v2/career-path` | Casual curated modes |
| `/v2/arena`, `/v2/arena/:code` | Arena hub; lobby by code (onboards inline — no guard, so an invite link never drops its code) |
| `/v2/duels`, `/v2/duels/history`, `/v2/rivals` | Duels + rivalries |
| `/v2/learn`, `/v2/learn/run`, `/v2/learn/mastery`, `/v2/learn/review` | Learn |
| `/v2/leaderboard`, `/v2/ranks` | Leaderboard, Ranks |
| `/v2/forge` | The Forge |
| `/play` | Off-platform short link (promo endcards, social bios) |

### v1 seam (redirect-only in production)

| # | Screen | Route | Purpose |
|---|--------|-------|---------|
| 1 | Login | `/` | Auth entry — now only via explicit auth intent |
| 2 | Onboarding | `/onboarding` | 3-step wizard (superseded by `UsernameOnlyOnboarding`) |
| 3 | Home | `/home` | **Unreachable in production** — redirects to `/v2` home |
| 4 | Sport Select | `/sport-select` | Choose football, tennis, or basketball |
| 5 | Difficulty | `/difficulty` | Choose easy, medium, or hard (quiz only) |
| 6 | Quiz | `/quiz` | 10-question timed quiz gameplay |
| 7 | Survival | `/survival` | Initials guessing gameplay |
| 8 | Results | `/results` | Post-game score, grade, ELO change |
| 9 | Leaderboard | `/leaderboard` | Global rankings with filters |
| 10 | Profile | `/profile` | Personal stats, achievements, history |
| 11 | Challenge / Duel Hub | `/challenge` | Async duel inbox (Your Turn / Awaiting / Resolved) + New Duel flow |
| 12 | Duel Play | `/duel/play/:duelId` | Async duel gameplay (MCQ + Which Came First) |
| 13 | Duel Result | `/duel/result/:duelId` | Duel result + share card + rematch CTA |
| 14 | Duel Link Landing | `/duel/:linkCode` | Shareable-link landing for accounts and guests, with post-play attach prompt |
| 15 | Rivals | `/rivals` | Head-to-head ledger across all opponents |
| 16 | Rival Detail | `/rivals/:opponentUserId` | Per-rival W-L-D, streak, one-tap rematch |
| 17 | Daily Quiz | `/daily-quiz` | Daily quiz challenge |
| 18 | Daily Results | `/daily-results` | Daily challenge results |
| 19 | Blitz | `/blitz` | 60-second speed quiz |
| 20 | Blitz Results | `/blitz-results` | Blitz mode results |
| 21 | ~~Waiting Room~~ | ~~`/waiting-room`~~ | **Removed 2026-07** — falls through to NotFound |
| 22 | ~~Live Match~~ | ~~`/live-match`~~ | **Removed 2026-07** — falls through to NotFound |
| 23 | Forge | `/forge` | Community question editor and reviewer |
| 24 | Higher or Lower | `/higher-lower` | Streak-based stat comparison gameplay |
| 25 | VerveGrid | `/verve-grid` | 3x3 grid intersection challenge |
| 26 | Career Path | `/v2/career-path` | Guess the player from his club history |
| 27 | Challenge Arena | `/arena/:code` | Synchronous arena room — lobby, countdown, 5 rounds of question/reveal, round break, final podium, rematch |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite (SWC plugin) |
| Backend | Convex (serverless TypeScript functions) |
| Database | Convex document database (real-time) |
| Authentication | @convex-dev/auth — Password provider + a hand-rolled `ConvexCredentials({ id: "anonymous" })` (IP-permit gated), **not** the stock Anonymous provider |
| Styling | Tailwind CSS + shadcn/ui components |
| Design System | Neo-brutalism (thick borders, bold shadows, vibrant colors) |
| Routing | React Router v6 |
| Notifications | Sonner toast library |
| String Matching | Custom Levenshtein distance implementation |
| Rating System | Custom ELO implementation (dynamic K-factor) |

---

## Design System

VerveQ uses a **neo-brutalism** design language characterized by:

- **Thick black borders** on all interactive elements
- **Bold drop shadows** that shift on press (active state feedback)
- **Vibrant color palette:**
  - Primary (brand blue)
  - Success (green — correct answers, football)
  - Accent (yellow/orange — tennis)
  - Destructive (red — wrong answers, hard mode)
  - Blue, Pink (secondary actions)
- **Typography:** Bold uppercase headings, clean body text, monospace for scores
- **Mobile-first responsive layout** with max-width constraint

**Custom components (neo/ prefix):**
- `NeoButton` — 9 variants, 5 sizes, press animation
- `NeoCard` — 7 color options, active state with ring + scale
- `NeoBadge` — Status pills with optional rotation
- `NeoInput` — Styled text input with focus ring
- `NeoAvatar` — Circle with generated initials
- `NeoLogo` — "VQ" brand mark
- `BottomNav` — Fixed bottom navigation (Home, Ranks, Challenge, Profile)

---

## Data Architecture

### Convex Tables

> **Partial list.** `app/convex/schema.ts` defines ~45 tables; the table below
> predates several subsystems and omits `arenas`, `arenaAnswers`, `duels`,
> `rivalries`, `challengeNotifications`, `careerPathSessions`, `usernameClaims`,
> `anonymousOnboardingAttempts`, `anonymousOnboardingIpPermits`, `funnelEvents`,
> the `learn*` tables, and the curated content tables. Treat `schema.ts` as the
> source of truth.

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `users` | User identity and profile | by_username (a plain index — uniqueness lives in `usernameClaims`) |
| `userRatings` | ELO ratings per sport/mode | by_user_sport_mode, by_sport_mode_elo |
| `gameSessions` | Historical game records | by_user |
| `quizQuestions` | 3,484 quiz questions (970 text + 2,514 image) | by_sport_difficulty, by_checksum |
| `quizSessions` | Active quiz game state (30-min TTL) | — |
| `survivalSessions` | Active survival game state (1-hr TTL) | — |
| `achievements` | Achievement definitions (8 total) | by_achievement_id |
| `userAchievements` | Unlocked achievements per user | by_user, by_user_achievement |
| ~~`challenges`~~ | **Removed 2026-07** with the synchronous challenge subsystem | — |
| `dailyChallenges` | Daily challenge definitions | by_date_sport_mode |
| `dailyAttempts` | User attempts at daily challenges | by_user_date_sport_mode, by_date_sport_mode_score |
| ~~`liveMatches`~~ | **Removed 2026-07** with the subsystem | — |
| `blitzSessions` | Active blitz game state | by_user |
| `blitzScores` | Blitz high scores | by_sport_score, by_user |
| `seasons` | Seasonal ranking periods | by_active, by_season_number |
| `seasonHistory` | Historical season results | by_user, by_user_season, by_season_sport_mode_rank |
| `decayNotifications` | ELO decay warnings | by_user_dismissed, by_user_sport_mode |
| `questionSubmissions` | Community question proposals (Forge) | by_checksum, by_author, by_status |
| `submissionVotes` | Votes on community questions | by_submission_voter, by_voter |

### Session Management
- **Quiz sessions** expire after 30 minutes
- **Survival sessions** expire after 1 hour
- Sessions track used content (checksums or initials) to prevent repeats within a game
- Sessions are cleaned up on access (lazy deletion)

---

## API Reference (Convex Functions)

### Authentication
| Function | Type | Description |
|----------|------|-------------|
| `auth.signIn` | Action | Sign in (anonymous or password) |
| `auth.signOut` | Action | Sign out current session |

### Users
| Function | Type | Description |
|----------|------|-------------|
| `users.me` | Query | Get current authenticated user |
| `users.ensureProfile` | Mutation | Patch profile fields after auth |
| `users.getByUsername` | Query | Lookup user by username |

### Quiz Sessions
| Function | Type | Description |
|----------|------|-------------|
| `quizSessions.createSession` | Mutation | Start a new quiz session |
| `quizSessions.getQuestion` | Mutation | Fetch next unused question |
| `quizSessions.checkAnswer` | Mutation | Validate answer, calculate score |
| `quizSessions.submitFeedback` | Mutation | Submit difficulty vote on a question |
| `quizSessions.endSession` | Mutation | Delete session (cleanup) |

### Survival Sessions
| Function | Type | Description |
|----------|------|-------------|
| `survivalSessions.startGame` | Mutation | Start survival game, get first challenge |
| `survivalSessions.getSession` | Query | Get current session state |
| `survivalSessions.submitGuess` | Mutation | Submit a player name guess |
| `survivalSessions.requestHelp` | Mutation | Request help on a round (shrinks the round pot) |
| `survivalSessions.skipChallenge` | Mutation | Skip current challenge (free or -1 life) |
| `survivalSessions.penalizeTabSwitch` | Mutation | Apply anti-cheat tab-switch penalty |

### Games
| Function | Type | Description |
|----------|------|-------------|
| `games.completeQuiz` | Mutation | Record quiz result, update ELO |
| `games.completeSurvival` | Mutation | Record survival result, update ELO |

### Blitz
| Function | Type | Description |
|----------|------|-------------|
| `blitz.start` | Mutation | Start a 60-second blitz session |
| `blitz.getQuestion` | Mutation | Fetch next blitz question |
| `blitz.submitAnswer` | Mutation | Submit answer, apply time penalty if wrong |
| `blitz.endGame` | Mutation | End blitz session, save score |
| `blitz.getHighScores` | Query | Get blitz high scores |

### Daily Challenge
| Function | Type | Description |
|----------|------|-------------|
| `dailyChallenge.getOrCreateChallenge` | Mutation | Get or generate today's daily challenge |

### Live Matches — REMOVED 2026-07

`app/convex/liveMatches.ts` was deleted; every `liveMatches.*` function is
gone. Use Duels (`duels.*`) or Arena (`challengeArenas.*`).

### Challenge Arena
| Function | Type | Description |
|----------|------|-------------|
| `challengeArenas.create` | Mutation | Create a lobby and return an arena code |
| `challengeArenas.join` | Mutation | Join a lobby by code |
| `challengeArenas.setReady` | Mutation | Toggle lobby readiness |
| `challengeArenas.setTeam` | Mutation | Select a 2v2 team |
| `challengeArenas.start` | Mutation | Host start; locks all round checksum sets |
| `challengeArenas.submitAnswer` | Mutation | Submit the active answer using server timing/checksum |
| `challengeArenas.readyNextRound` | Mutation | Ready during round break |
| `challengeArenas.leave` | Mutation | Leave safely; transfer host or abandon if empty |
| `challengeArenas.rematch` | Mutation | Create a new room with the same crew |
| `challengeArenas.getRoom` | Query | Reactive sanitized room state |
| `challengeArenas.contentStatus` | Query | Verify arena category content counts |

### Forge
| Function | Type | Description |
|----------|------|-------------|
| `forge.submit` | Mutation | Submit a community question |
| `forge.vote` | Mutation | Vote to approve or reject a submission |
| `forge.getReviewQueue` | Query | Get the review queue |

### Seasons
| Function | Type | Description |
|----------|------|-------------|
| `seasonManager.getCurrentSeason` | Query | Get active season info |

### ELO Decay
| Function | Type | Description |
|----------|------|-------------|
| `eloDecay.runDecay` | **internalMutation** | Apply ELO decay for inactive players. Cron-only — not client-callable |

### Leaderboards
| Function | Type | Description |
|----------|------|-------------|
| `leaderboards.getLeaderboard` | Query | Fetch ranked players with filters |

### Achievements
| Function | Type | Description |
|----------|------|-------------|
| `achievements.list` | Query | Get all non-hidden achievements |
| `achievements.userAchievements` | Query | Get user's unlocked achievements |
| `achievements.checkAndUnlock` | Mutation | Auto-check and unlock earned achievements |

### Challenges
| Function | Type | Description |
|----------|------|-------------|
| ~~`challenges.*`~~ | — | **Removed 2026-07.** `app/convex/challenges.ts` was deleted with the dormant synchronous challenge subsystem. Use Duels (`duels.*`) or Arena (`challengeArenas.*`). |

### Profile
| Function | Type | Description |
|----------|------|-------------|
| `profile.get` | Query | Get aggregated player profile and stats |

### Higher or Lower
| Function | Type | Description |
|----------|------|-------------|
| `higherLower.startSession` | Mutation | Start a new Higher or Lower session |
| `higherLower.makeGuess` | Mutation | Guess higher or lower for the current comparison |
| `higherLower.getSession` | Query | Get current session state |

### VerveGrid
| Function | Type | Description |
|----------|------|-------------|
| `verveGrid.startSession` | Mutation | Start a new VerveGrid session with a curated board |
| `verveGrid.searchPlayers` | Query | Search for players matching grid criteria |
| `verveGrid.submitGuess` | Mutation | Submit a player guess for a grid cell |
| `verveGrid.getSession` | Query | Get current session state |

### Career Path
| Function | Type | Description |
|----------|------|-------------|
| `careerPath.startChallenge` | Mutation | Start a new Career Path round (weighted difficulty mix) |
| `careerPath.submitGuess` | Mutation | Submit a player name guess with length-scaled fuzzy matching |
| `careerPath.penalizeTabSwitch` | Mutation | Fail the round when the player switches tabs |
| `careerPath.getSession` | Query | Get current session state (never includes the answer) |

### Sports
| Function | Type | Description |
|----------|------|-------------|
| `sports.list` | Query | Get supported sports configuration |
