# VerveQ — Comprehensive App Overview

## What is VerveQ?

VerveQ is a competitive sports trivia platform where players test and prove their sports knowledge through multiple game modes: **Quiz**, **Survival**, **Blitz**, **Higher or Lower**, **VerveGrid**, **Who Am I**, **Daily Challenge**, and **Live Match**. Players earn ELO ratings, climb leaderboards, unlock achievements, contribute community questions via **The Forge**, and challenge friends — all across three supported sports.

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

Current mode availability is mixed:

- Survival remains multi-sport in current runtime.
- Higher or Lower is currently football-only in frontend and backend.
- VerveGrid is currently football-only in frontend and backend.
- Who Am I is currently football-only in frontend and backend.

---

## Game Modes

### Quiz Mode

A timed multiple-choice trivia game with 10 questions per session.

**How it works:**
1. Player selects a sport and difficulty level (Easy, Medium, or Hard)
2. A session is created and 10 unique questions are served one at a time
3. Each question presents 4 answer options (A, B, C, D)
4. Player selects an answer and clicks "Check Answer"
5. The correct answer is revealed with an optional explanation
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

**Hint system:**
- 3 hint tokens available per game, with 3 progressive stages per challenge
- **Stage 1:** Nationality and club/team information
- **Stage 2:** Position, era, or handedness details
- **Stage 3:** First name of a matching player
- Hints must be used in order (Stage 1 before Stage 2, etc.)
- Each stage consumes 1 hint token — strategic use is key

**Skip mechanic:**
- 1 free skip per game (no life cost)
- Additional skips cost 1 life each
- A new challenge is generated for the next round

**Speed streak / "On Fire" system:**
- Fast answers (under 4 seconds) build a speed streak counter
- Reaching a streak of 5 triggers "On Fire" status
- While "On Fire," each correct answer adds +0.1 to the performance bonus
- Hitting exactly a 5-streak with fewer than 3 lives grants +1 life (earn-a-life)

**Hidden answer bonus:**
- Players earn a bonus for finding valid players who are not the primary (most famous) player for those initials

**Anti-cheat:**
- Tab-switch detection penalizes players who leave the game
- Standard survival: -1 life per tab switch
- Daily survival: Instant forfeit

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

### Who Am I

A progressive clue-based trivia game where more information costs points.

**Current availability:** Football-only.

**Current runtime layer:** Approved `whoAmIApprovedClues`.

**How it works:**
1. Player selects football
2. Game starts with a maximum potential score of 1,000 points
3. Clue 1 is revealed (usually Nationality + Position)
4. Player can make a guess or choose to reveal the next clue (up to 4 total clues)
5. Revealing a clue reduces the potential score by 25% (e.g., 1000 → 750 → 562 → 421)
6. Fuzzy matching allows for minor typos, giving players a "Close call" without ending the game
7. A definitive wrong guess ends the game with 0 points

---

### Daily Challenge

A once-per-day quiz or survival challenge with a shared question set and daily leaderboard.

**How it works:**
1. Each day (UTC-based), a unique set of questions is generated per sport using seeded shuffling
2. All players receive the same questions on the same day
3. Player selects a sport and mode (Daily Quiz or Daily Survival)
4. Only one attempt per player per day per mode is allowed
5. Results contribute to a daily leaderboard

**Daily Quiz:**
- 10 questions at intermediate difficulty
- Same scoring as standard quiz (100 points base + time bonus)
- Maximum possible score: 1,000 points

**Daily Survival:**
- Standard survival mechanics with 3 lives
- Anti-cheat: Tab-switching triggers instant forfeit (stricter than standard survival)
- Speed streaks and hint system available

**Special mechanics:**
- Seeded shuffling ensures fairness — every player faces the same challenge
- Once attempted, results are final until the next UTC day
- Image question limits apply (max 3, no consecutive)

---

### Live Match

Real-time head-to-head competitive quiz between two players.

**How it works:**
1. A challenge is accepted between two players
2. Both players enter a waiting room and mark themselves as "Ready"
3. A 3-second countdown begins once both are ready
4. 10 intermediate questions are served simultaneously to both players
5. Each question has a 10-second timer
6. After both answer (or timeout), a 2-second round result display shows both answers
7. After 10 questions, the winner is determined by higher total score

**Scoring (Cutthroat system):**
- Base: 100 points per correct answer
- Time bonus: 10 points per second saved (e.g., answering in 2s = +80 bonus)
- **First correct** gets full base (100) + time bonus
- **Second correct** (opponent already answered correctly) gets half base (50) + time bonus
- Both wrong: 0 points each
- Maximum per question: ~190 points (correct in <1s, opponent wrong)

**Special mechanics:**
- Opponent status visible during questions: "thinking," "locked in," or "answered incorrectly"
- Heartbeat system: players must ping every 5 seconds; 15 seconds of inactivity = automatic forfeit
- Manual forfeit option available at any time
- ELO ratings are updated for both players after match completion
- Ties are possible when both players achieve equal scores

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
performance = min(score / 15, 1.0)
```
A survival score of 15 represents perfect performance.

**Win/Loss determination:**
- Quiz: Win if accuracy >= 80%
- Survival: Win if score >= 10

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

Players can challenge friends to compete head-to-head.

**How it works:**
1. Enter a friend's username
2. Select a sport and mode (quiz or survival)
3. Send the challenge
4. The challenged player sees it in their pending challenges
5. They can accept or decline
6. Accepted challenges can lead to a Live Match

**Challenge states:**
- **Pending** — Waiting for the challenged player's response
- **Active** — Challenge accepted, game in progress
- **Completed** — Both players have finished, winner determined
- **Declined** — Challenge was rejected

*Note: Guest users cannot send or receive challenges.*

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

VerveQ supports two authentication methods:

1. **Guest Play (Anonymous)**
   - Click "Play as Guest" or "Quick Start"
   - No account creation required
   - Full access to quiz and survival modes
   - Cannot send or receive challenges
   - Guest profiles are temporary

2. **Account Creation (Password)**
   - Enter a display name to create an account
   - Username derived from display name (lowercase, underscores)
   - Full access to all features including challenges
   - Persistent profile, stats, and achievements

Authentication is handled by Convex Auth with JWT-based sessions.

---

## User Flow

```
Login Screen
  ├── Quick Start (guest) ──────────────────────────────────── Home
  ├── Play as Guest ────────── Onboarding (3 steps) ────────── Home
  └── Create Account ───────── Onboarding (3 steps) ────────── Home

Home Screen
  ├── Quiz Mode ────── Sport Select ── Difficulty Select ──── Quiz (10 Qs) ── Results
  ├── Survival Mode ── Sport Select ───────────────────────── Survival ─────── Results
  ├── Daily Challenge ─ Sport Select ── Mode Select ────────── Daily Quiz/Survival ── Daily Results
  ├── Blitz Mode ───── Sport Select ───────────────────────── Blitz (60s) ─── Blitz Results
  ├── Live Match ───── Challenge Accept ── Waiting Room ───── Live Match ──── Results
  ├── Higher/Lower ── Sport Select ───────────────────────── Higher or Lower ── Results
  ├── VerveGrid ───── Sport Select ───────────────────────── VerveGrid ──────── Results
  ├── Who Am I ────── Sport Select ───────────────────────── Who Am I ────────── Results
  ├── Forge ─────────── Submit / Review / My Submissions
  ├── Leaderboard (bottom nav)
  ├── Challenge (bottom nav)
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

| # | Screen | Route | Purpose |
|---|--------|-------|---------|
| 1 | Login | `/` | Authentication entry point |
| 2 | Onboarding | `/onboarding` | 3-step new user wizard |
| 3 | Home | `/home` | Main hub with stats, game entry points |
| 4 | Sport Select | `/sport-select` | Choose football, tennis, or basketball |
| 5 | Difficulty | `/difficulty` | Choose easy, medium, or hard (quiz only) |
| 6 | Quiz | `/quiz` | 10-question timed quiz gameplay |
| 7 | Survival | `/survival` | Initials guessing gameplay |
| 8 | Results | `/results` | Post-game score, grade, ELO change |
| 9 | Leaderboard | `/leaderboard` | Global rankings with filters |
| 10 | Profile | `/profile` | Personal stats, achievements, history |
| 11 | Challenge | `/challenge` | Send/receive player challenges |
| 12 | Dashboard | `/dashboard` | Quick-start games by sport |
| 13 | Daily Quiz | `/daily-quiz` | Daily quiz challenge |
| 14 | Daily Survival | `/daily-survival` | Daily survival challenge |
| 15 | Daily Results | `/daily-results` | Daily challenge results |
| 16 | Blitz | `/blitz` | 60-second speed quiz |
| 17 | Blitz Results | `/blitz-results` | Blitz mode results |
| 18 | Waiting Room | `/waiting-room` | Live match matchmaking lobby |
| 19 | Live Match | `/live-match` | Head-to-head real-time gameplay |
| 20 | Forge | `/forge` | Community question editor and reviewer |
| 21 | Higher or Lower | `/higher-lower` | Streak-based stat comparison gameplay |
| 22 | VerveGrid | `/verve-grid` | 3x3 grid intersection challenge |
| 23 | Who Am I | `/who-am-i` | Progressive clue guessing gameplay |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite (SWC plugin) |
| Backend | Convex (serverless TypeScript functions) |
| Database | Convex document database (real-time) |
| Authentication | @convex-dev/auth (Anonymous + Password providers) |
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

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `users` | User identity and profile | by_username |
| `userRatings` | ELO ratings per sport/mode | by_user_sport_mode, by_sport_mode_elo |
| `gameSessions` | Historical game records | by_user |
| `quizQuestions` | 3,484 quiz questions (970 text + 2,514 image) | by_sport_difficulty, by_checksum |
| `quizSessions` | Active quiz game state (30-min TTL) | — |
| `survivalSessions` | Active survival game state (1-hr TTL) | — |
| `achievements` | Achievement definitions (8 total) | by_achievement_id |
| `userAchievements` | Unlocked achievements per user | by_user, by_user_achievement |
| `challenges` | Player-vs-player challenges | by_challenged_status, by_challenger |
| `dailyChallenges` | Daily challenge definitions | by_date_sport_mode |
| `dailyAttempts` | User attempts at daily challenges | by_user_date_sport_mode, by_date_sport_mode_score |
| `liveMatches` | Real-time PvP match state | by_player1, by_player2 |
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
| `survivalSessions.useHint` | Mutation | Reveal progressive hint (costs 1 token) |
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
| `blitz.end` | Mutation | End blitz session, save score |
| `blitz.getScore` | Query | Get blitz high scores |

### Daily Challenge
| Function | Type | Description |
|----------|------|-------------|
| `dailyChallenge.getOrCreateChallenge` | Mutation | Get or generate today's daily challenge |

### Live Matches
| Function | Type | Description |
|----------|------|-------------|
| `liveMatches.createFromChallenge` | Mutation | Create a live match from an accepted challenge |

### Forge
| Function | Type | Description |
|----------|------|-------------|
| `forge.submit` | Mutation | Submit a community question |
| `forge.vote` | Mutation | Vote to approve or reject a submission |
| `forge.getPending` | Query | Get pending questions for review |

### Seasons
| Function | Type | Description |
|----------|------|-------------|
| `seasonManager.getCurrentSeason` | Query | Get active season info |

### ELO Decay
| Function | Type | Description |
|----------|------|-------------|
| `eloDecay.checkDecay` | Mutation | Check and apply ELO decay for inactive players |

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
| `challenges.getPending` | Query | Get pending challenges for current user |
| `challenges.create` | Mutation | Send a challenge to another player |
| `challenges.accept` | Mutation | Accept a pending challenge |
| `challenges.decline` | Mutation | Decline a pending challenge |

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

### Who Am I
| Function | Type | Description |
|----------|------|-------------|
| `whoAmI.startChallenge` | Mutation | Start a new Who Am I challenge |
| `whoAmI.revealNextClue` | Mutation | Reveal the next clue (reduces potential score) |
| `whoAmI.submitGuess` | Mutation | Submit a player name guess with fuzzy matching |
| `whoAmI.getSession` | Query | Get current session state |

### Sports
| Function | Type | Description |
|----------|------|-------------|
| `sports.list` | Query | Get supported sports configuration |
