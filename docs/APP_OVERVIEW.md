# VerveQ — Comprehensive App Overview

## What is VerveQ?

VerveQ is a competitive sports trivia platform where players test and prove their sports knowledge through two distinct game modes: **Quiz** and **Survival**. Players earn ELO ratings, climb leaderboards, unlock achievements, and challenge friends — all across three supported sports.

The platform targets sports enthusiasts who want more than casual trivia. VerveQ's ELO rating system, borrowed from competitive chess, provides a meaningful measure of sports knowledge that evolves with every game played.

---

## Supported Sports

| Sport | Emoji | Quiz Questions | Survival Players |
|-------|-------|---------------|-----------------|
| Football | ⚽ | 301 | 30,913 |
| Basketball | 🏀 | 285 | 3,608 |
| Tennis | 🎾 | 274 | 1,156 |
| **Total** | | **860** | **35,677** |

Each sport supports both Quiz and Survival modes. More sports are planned for future releases.

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

**Question count by difficulty:**

| Difficulty | Football | Basketball | Tennis | Total |
|-----------|----------|-----------|--------|-------|
| Easy | 68 | 82 | 72 | 222 |
| Intermediate | 132 | 159 | 141 | 432 |
| Hard | 101 | 44 | 61 | 206 |
| **Total** | **301** | **285** | **274** | **860** |

---

### Survival Mode

A progressive challenge where players guess sports player names from their initials.

**How it works:**
1. Player selects a sport (no difficulty selection — difficulty scales automatically)
2. The game presents 2-letter initials (e.g., "MK") and the player must name a player with those initials
3. Player types a name and submits their guess
4. The system uses fuzzy string matching (Jaro-Winkler algorithm, threshold >= 0.8) to validate the answer
5. Correct guesses advance to the next round; wrong guesses cost a life
6. The game ends when all 3 lives are lost

**Lives system:**
- Players start with 3 lives (displayed as hearts)
- Wrong guesses and skips each cost 1 life
- Game over at 0 lives

**Hint system:**
- One hint available per game
- Using a hint reveals up to 3 sample player names that match the current initials
- Strategic resource — use it wisely on harder rounds

**Skip mechanic:**
- Players can skip a challenge they're stuck on
- Skipping costs 1 life (same penalty as a wrong answer)
- A new challenge is generated for the next round

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
- Uses the Jaro-Winkler distance algorithm
- A guess is accepted if the similarity score is >= 0.8
- This allows for minor typos and spelling variations
- The system tracks the best similarity score for feedback even on incorrect guesses

**Survival data by sport:**

| Sport | Unique Initials | Total Players | Data Size |
|-------|----------------|---------------|-----------|
| Football | 1,957 | 30,913 | 800 KB |
| Basketball (NBA) | 558 | 3,608 | 81 KB |
| Tennis | 476 | 1,156 | 38 KB |

---

## ELO Rating System

VerveQ uses an ELO-based rating system inspired by competitive chess to track player skill.

**Core parameters:**
- **Starting ELO:** 1,200
- **K-Factor:** 32 (controls rating volatility per game)
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

7 achievements are available, each with point values and unlock criteria:

| Achievement | Category | Points | Unlock Criteria |
|------------|----------|--------|----------------|
| 🎯 Quiz Rookie | Quiz | 10 | Complete your first quiz |
| ❤️ Survivor | Survival | 10 | Complete your first survival game |
| 🏆 Quiz Master | Quiz | 50 | Get 100% accuracy in a quiz |
| 🔥 Survival Legend | Survival | 50 | Score 15+ in survival mode |
| ⚡ Multi-Sport Athlete | General | 25 | Play 2+ different sports |
| 💪 Dedicated Player | General | 30 | Play 50 total games |
| 👑 ELO Champion | General | 100 | Reach 1,500 ELO rating |

**Maximum achievable points:** 275

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
| String Matching | Custom Jaro-Winkler implementation |
| Rating System | Custom ELO implementation (K=32) |

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
| `quizQuestions` | 860 quiz questions | by_sport_difficulty, by_checksum |
| `quizSessions` | Active quiz game state (30-min TTL) | — |
| `survivalSessions` | Active survival game state (1-hr TTL) | — |
| `achievements` | Achievement definitions (7 total) | by_achievement_id |
| `userAchievements` | Unlocked achievements per user | by_user, by_user_achievement |
| `challenges` | Player-vs-player challenges | by_challenged_status, by_challenger |

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
| `survivalSessions.useHint` | Mutation | Reveal sample players (one-time) |
| `survivalSessions.skipChallenge` | Mutation | Skip current challenge (-1 life) |

### Games
| Function | Type | Description |
|----------|------|-------------|
| `games.completeQuiz` | Mutation | Record quiz result, update ELO |
| `games.completeSurvival` | Mutation | Record survival result, update ELO |

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

### Sports
| Function | Type | Description |
|----------|------|-------------|
| `sports.list` | Query | Get supported sports configuration |
