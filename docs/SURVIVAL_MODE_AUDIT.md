# Survival Mode — Complete Technical Audit

## 1. Overview

Survival Mode is an initials-based name-guessing game. The player is shown 2–3 letter initials of a sports athlete and must type the full name. The game starts with 3 lives and progressively increases difficulty each round. A wrong answer, skip, or tab-switch costs 1 life. The game ends when lives reach zero.

**Core loop:** See initials → type player name → engine validates spelling → correct (score +1, next round) or wrong (lose 1 life, next round) → repeat until game over.

**Supported sports:** Football, Basketball (NBA), Tennis.

**Two variants exist:**
- **Standard Survival** — unlimited attempts, ELO-rated
- **Daily Survival** — one attempt per day per sport, strict anti-cheat (tab switch = forfeit)

---

## 2. Architecture — Two Implementations

The system has a **Convex implementation** (active, used by the web frontend) and a **Python backend** (legacy, same logic). The Convex version is the source of truth for the live product.

### Convex (Active)

| File | Role |
|------|------|
| `app/convex/survivalSessions.ts` | All mutations/queries: `startGame`, `submitGuess`, `useHint`, `skipChallenge`, `penalizeTabSwitch`, `getSession` |
| `app/convex/lib/fuzzy.ts` | Levenshtein distance + `findBestMatch()` for answer validation |
| `app/convex/lib/scoring.ts` | `normalizeAnswer()` used by fuzzy matching |
| `app/convex/lib/elo.ts` | `getSurvivalPerformance()`, `calculateEloChange()`, `getKFactor()`, `clampRating()`, `getTierName()` |
| `app/convex/games.ts` | `completeSurvival` mutation — ELO update + game history insertion |
| `app/convex/schema.ts` | `survivalSessions` table definition |
| `app/convex/dailyChallenge.ts` | Daily attempt tracking, forfeit, completion |
| `app/src/pages/SurvivalScreen.tsx` | Standard survival UI — state management, guess submission, hints, anti-cheat modal |
| `app/src/pages/DailySurvivalScreen.tsx` | Daily variant UI — same gameplay, stricter anti-cheat, daily attempt gating |
| `app/src/hooks/useAntiCheat.ts` | `visibilitychange` listener that fires callback on tab-away |

### Python Backend (Legacy)

| File | Role |
|------|------|
| `backend/sports/survival_engine.py` | `SurvivalEngine` class — challenge generation, answer validation, hints |
| `backend/sports/survival_helpers.py` | `FameCalculator`, `PlayerInfoExtractor`, `PlayerSelector` |
| `backend/sports/utils.py` | `normalize_name()`, `calculate_similarity()`, `get_player_initials()` |
| `backend/services/survival_session.py` | Session CRUD, answer submission (checks ALL valid players for given initials) |
| `backend/routes/survival/session.py` | REST endpoints for session-based gameplay |
| `backend/routes/survival/legacy.py` | Backward-compatible endpoints |

### Data Files

| File | Sport | Scale |
|------|-------|-------|
| `app/convex/data/survival_initials_map.json` | Football | ~1,957 initials → ~30,913 players |
| `app/convex/data/survival_initials_map_tennis.json` | Tennis | ~476 initials → ~1,156 players |
| `app/convex/data/nba_survival_data.json` | Basketball | ~558 initials → ~3,608 players |
| `app/convex/data/football_player_metadata.json` | Football | Club, position, nationality, era per player (used for hints) |

---

## 3. Initials Engine

### What Are Initials?

Initials are the uppercase first letters of each word in a player's name.

**Extraction logic** (Python `utils.py:45-53`):

```python
def get_player_initials(name: str) -> str:
    parts = clean_string(name).split()
    initials = ''.join([part[0].upper() for part in parts if part])
    return initials
```

Examples:
- "Cristiano Ronaldo" → `CR`
- "Kevin De Bruyne" → `KDB`
- "Neymar Jr" → `NJ`

### Data Structure

The initials maps are flat JSON dictionaries: `{ "INITIALS": ["Player Name 1", "Player Name 2", ...] }`.

Football wraps this in `{ "initials_map": { ... } }`. Tennis uses the same wrapper. NBA is a flat map directly.

### Initials Validation

Only uppercase A–Z letters are valid (`survival_helpers.py:196-201`):

```python
def _is_valid_initials(initials: str) -> bool:
    return all(c.isupper() and 'A' <= c <= 'Z' for c in initials)
```

Initials containing accented characters, numbers, or symbols are filtered out.

---

## 4. Challenge Generation

### Convex Implementation (`survivalSessions.ts:53-79`)

```
generateChallenge(sport, round, usedInitials):
  1. Load the initials map for the sport
  2. Get difficulty config for the current round
  3. Filter candidates:
     - initials.length <= diff.initialsLen
     - initials NOT in usedInitials set
     - players.length > 0
  4. Pick one random candidate from filtered list
  5. Return { initials, round, difficulty, validPlayers[] }
```

The `validPlayers` array contains ALL players that share those initials — not just one. This is critical for answer matching (any valid player is accepted).

### Difficulty Progression (`survivalSessions.ts:42-51`)

| Round | Initials Length | Famous Weight | Label |
|-------|----------------|---------------|-------|
| 1–2 | 2 | 1.0 | Easy |
| 3 | 2 | 0.8 | Easy |
| 4 | 2 | 0.6 | Medium |
| 5 | 2 | 0.4 | Medium |
| 6–7 | 2 | 0.2 | Hard |
| 8+ | 3 | 0.2 | Expert |

In the Convex implementation, `famousWeight` is stored but **not used for weighted selection** — candidate selection is purely random from the filtered set. The weight is a vestige of the Python backend's more sophisticated selection.

### Python Backend Selection (Legacy)

The Python engine uses weighted random selection based on fame scores:

**Fame scoring** (`survival_helpers.py:31-57`):
- Hardcoded famous players (Messi, Ronaldo, etc.) → score 10
- Common surname patterns (Silva, Santos, etc.) → score 6
- Default football players → score 4
- Non-football sports → score 3

**Weighted selection** (`survival_helpers.py:131-151`):
- Easy (weight ≥ 0.8): weight = fame_score (famous players picked more often)
- Medium (weight 0.5–0.79): weight = fame_score / 2 (balanced)
- Hard (weight < 0.5): weight = 10 - fame_score (obscure players picked more often)

**Duplicate avoidance**: If selected initials were already used, retry up to 5 times with different players.

**Player cap**: Max 1,000 players processed per generation call, max 5 players per initials group — both for performance.

---

## 5. Spelling / Answer Matching

Two distinct matching systems exist.

### Convex: Levenshtein Distance (`fuzzy.ts`)

The active system uses edit-distance-based matching.

**Normalization** (`scoring.ts:14-19`):
```typescript
function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
}
```
- Lowercase, trim, strip all non-alphanumeric except spaces.

**Levenshtein distance** (`fuzzy.ts:7-33`):
- Standard DP algorithm, O(min(m,n)) space optimization.
- Computes minimum insertions + deletions + substitutions to transform one string into another.

**Match logic** (`fuzzy.ts:48-73`):
```
findBestMatch(guess, validPlayers[]):
  1. Normalize the guess
  2. For each player in validPlayers:
     a. Normalize the player name
     b. Compute Levenshtein distance
     c. Track best (lowest distance) match
     d. Early exit on exact match (distance 0)
  3. Return { matched: distance ≤ 1, distance, matchedPlayer }
```

**Key rule: distance ≤ 1 is accepted.** This means:
- Exact match → distance 0 → correct
- One typo (substitution, insertion, or deletion) → distance 1 → correct (flagged as `typoAccepted`)
- Two or more differences → distance ≥ 2 → wrong

**Examples:**
| Guess | Target | Distance | Result |
|-------|--------|----------|--------|
| "cristiano ronaldo" | "cristiano ronaldo" | 0 | Correct |
| "cristiano ronalod" | "cristiano ronaldo" | 1 | Correct (typo) |
| "cristiano ronald" | "cristiano ronaldo" | 1 | Correct (typo) |
| "cristano ronaldo" | "cristiano ronaldo" | 1 | Correct (typo) |
| "cristano ronalod" | "cristiano ronaldo" | 2 | Wrong |

**Important:** The guess is checked against ALL `validPlayers` for those initials, not just one. If `CR` maps to ["Cristiano Ronaldo", "Claudio Ranieri", ...], naming any of them is accepted.

### Python Backend: Similarity Score (`utils.py`)

The legacy system uses a multi-strategy similarity approach.

**Normalization** (`utils.py:23-42`):
```python
def normalize_name(name):
    normalized = name.lower().strip()
    normalized = re.sub(r'[-._\'`]', ' ', normalized)  # hyphens/dots → spaces
    normalized = re.sub(r'[^\w\s]', '', normalized)     # strip remaining special chars
    normalized = re.sub(r'\s+', ' ', normalized.strip()) # collapse whitespace
```

**Similarity calculation** (`utils.py:56-109`) — cascading strategies:
1. **Exact match** (after normalization) → 1.0
2. **Space-insensitive match** (remove all spaces, compare) → 1.0
3. **Word subset match** (all words from shorter name ⊆ longer name) → 0.9
4. **Word overlap** (Jaccard: intersection / union of word sets) → 0.0–1.0
   - Boosted by +0.1 if same word count and overlap > 0.5
5. **Character overlap fallback** (for single words) → 0.0–1.0

**Thresholds:**
- similarity ≥ 0.8 → **correct**
- 0.5 ≤ similarity < 0.8 → **close** (not accepted, but flagged)
- similarity < 0.5 → **wrong**

---

## 6. Session State & Schema

### Database Schema (`schema.ts`)

```typescript
survivalSessions: defineTable({
  userId: v.optional(v.id("users")),
  sport: v.string(),
  round: v.number(),
  score: v.number(),
  lives: v.number(),                          // 0–3
  hintUsed: v.boolean(),
  usedInitials: v.array(v.string()),          // track used initials to avoid repeats
  gameOver: v.boolean(),
  expiresAt: v.number(),                      // Date.now() + 3,600,000 (1 hour)
  currentChallenge: v.optional(v.object({
    initials: v.string(),
    round: v.number(),
    difficulty: v.string(),
    validPlayers: v.array(v.string()),        // ALL valid players for these initials
  })),
  lastPenalizedRound: v.optional(v.number()), // anti-cheat: prevent double penalty per round
  speedStreak: v.optional(v.number()),        // consecutive fast correct answers
  lastAnswerAt: v.optional(v.number()),       // timestamp of last correct answer
  performanceBonus: v.optional(v.number()),   // accumulated "on fire" bonus
  hintTokensLeft: v.optional(v.number()),     // 0–3
  currentHintStage: v.optional(v.number()),   // 0–3
})
```

### Session Lifecycle

1. **Start** → `startGame({ sport })` creates a row with round=1, lives=3, score=0, generates first challenge
2. **Each round** → `submitGuess` or `skipChallenge` updates the row, generates next challenge
3. **Game over** → `gameOver` set to `true`, no further mutations allowed
4. **Results** → frontend calls `completeSurvival` to record ELO, then navigates to results screen
5. **Expiry** → sessions auto-expire after 1 hour (TTL: `SESSION_TTL_MS = 3,600,000`)

---

## 7. Hint System

Hints are **football-only** and use a **tiered token system**.

### Configuration
- 3 hint tokens per game
- 3 progressive stages (must be used in order: 1 → 2 → 3)
- Each hint costs 1 token

### Stages (`survivalSessions.ts:263-321`)

| Stage | Content | Source |
|-------|---------|--------|
| 1 | `Nationality: {country} \| Club: {club}` | `football_player_metadata.json` lookup on first valid player |
| 2 | `Position: {position} \| Era: {era}` | Same metadata source |
| 3 | `First name: {name}` | First word of a random valid player's name |

**Fallback:** If no metadata exists for the player, stage 1 shows "Football player — N possible answers" and stage 2 shows "N players match these initials".

### Constraints
- `stage` must equal `currentHintStage + 1` (sequential only)
- `hintTokensLeft` must be > 0
- `sport` must be `"football"` (other sports throw an error)
- Using any hint sets `hintUsed: true` on the session
- Hint state (`currentHintStage`) resets to 0 on each new challenge (correct, wrong, or skip)

---

## 8. Speed Streak & "On Fire"

### Streak Tracking (`survivalSessions.ts:162-169`)

```typescript
const elapsed = lastAnswerAt > 0 ? (now - lastAnswerAt) / 1000 : Infinity;
const newStreak = elapsed < 4.0 ? (session.speedStreak ?? 0) + 1 : 1;
const isOnFire = newStreak >= 5;
const bonusIncrement = isOnFire ? 0.1 : 0;
```

**Rules:**
- If a correct answer comes within **4 seconds** of the previous correct answer, streak increments
- If slower than 4 seconds, streak resets to 1
- First answer of the game always starts at streak 1 (elapsed = Infinity)
- **On Fire** activates when streak reaches **5 consecutive fast answers**
- Wrong answer or skip resets streak to 0

### Performance Bonus
- Each correct answer while "on fire" adds **+0.1** to `performanceBonus`
- This bonus is accumulated on the session and passed to `completeSurvival` at game end
- Used in ELO calculation: `finalPerformance = min(1.0, basePerf + performanceBonus)`

### Frontend Visuals (`SurvivalScreen.tsx`)
- Streak ≥ 2: Shows `STREAK: x{n}` badge
- On Fire: Shows `ON FIRE` badge with `animate-pulse-urgent`, `on-fire-bg` background, `on-fire-input` styling

---

## 9. Anti-Cheat System

### Hook (`useAntiCheat.ts`)

```typescript
export function useAntiCheat(onTabAway: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") onTabAway();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [onTabAway]);
}
```

Fires callback whenever the browser tab becomes hidden (user switches tabs, minimizes window, etc.).

### Standard Survival — Penalty Mode (`survivalSessions.ts:374-404`)

```
penalizeTabSwitch(sessionId, currentRound):
  1. If session is over → no penalty
  2. If lastPenalizedRound === currentRound → skip (no double penalty per round)
  3. Deduct 1 life
  4. Set lastPenalizedRound = currentRound
  5. If lives ≤ 0 → gameOver = true
  6. Return { penalized, lives, gameOver }
```

Frontend shows a red modal: "CHEATING DETECTED — You lost focus on the game window. 1 Life deducted." with screen shake animation.

### Daily Survival — Strict Forfeit Mode (`DailySurvivalScreen.tsx:96-106`)

```typescript
useAntiCheat(() => {
  if (attemptId && !forfeited) {
    setForfeited(true);
    forfeitMut({ attemptId }).then(() => {
      toast.error("Challenge forfeited — you switched tabs!");
      navigate("/home", { replace: true });
    });
  }
});
```

Any tab switch immediately forfeits the entire daily challenge. No second chances. The user is redirected to home.

---

## 10. Game Over Conditions

A game ends when any of these occur:

1. **Lives reach 0** — Wrong answer, skip, or tab-switch penalty reduces lives. When `lives <= 0`, `gameOver` is set to `true`.

2. **No more candidates** — `generateChallenge()` returns `null` because all initials matching the difficulty filter have been used. Extremely rare given dataset sizes (1,957+ football initials).

3. **Daily forfeit** — Tab switch in daily mode calls `forfeit()` mutation, ending the attempt.

After game over, the frontend calls `completeSurvival()` to finalize ELO, then navigates to the results screen with: score, round reached, ELO change, new ELO, K-factor info.

---

## 11. ELO & Scoring System

### Performance Score (`elo.ts:39-41`)

```typescript
function getSurvivalPerformance(score: number): number {
  return Math.min(score / 15, 1.0);
}
```

A score of 15 represents perfect performance (1.0). Linear scaling below that.

With "on fire" bonus: `finalPerformance = min(1.0, score/15 + performanceBonus)`.

### Difficulty Tier (based on final score)

| Score | Difficulty | Opponent Rating |
|-------|-----------|-----------------|
| 0–4 | easy | 1000 |
| 5–9 | intermediate | 1200 |
| 10+ | hard | 1400 |

### ELO Calculation (`elo.ts:16-26`)

```typescript
function calculateEloChange(playerRating, performanceScore, difficulty, kFactor):
  opponentRating = { easy: 1000, intermediate: 1200, hard: 1400 }[difficulty]
  expected = 1 / (1 + 10^((opponentRating - playerRating) / 400))
  return round(kFactor * (performanceScore - expected) * 10) / 10
```

Standard ELO formula. The "opponent" is a virtual rating representing the difficulty tier.

### K-Factor (`elo.ts:7-14`)

| Condition | K | Label |
|-----------|---|-------|
| < 30 games played | 40 | Placement Match |
| 30+ games, ELO < 2000 | 32 | Standard |
| ELO ≥ 2000 | 16 | High-Tier Protection |

### Rating Clamp

```typescript
function clampRating(rating: number): number {
  return Math.max(800, Math.min(2400, rating));
}
```

Rating is clamped to [800, 2400].

### Win/Loss Tracking

```typescript
const isWin = score >= 10;
```

Score ≥ 10 counts as a win. Below 10 is a loss. Tracked in `userRatings` table.

### Game History

Each completed game inserts a `gameSessions` row with: userId, sport, mode="survival", score, durationSeconds, eloBefore, eloAfter, eloChange, kFactor, kFactorLabel, endedAt, sessionType="game".

---

## 12. Daily Survival Variant

### How It Differs

| Aspect | Standard | Daily |
|--------|----------|-------|
| Attempts | Unlimited | 1 per day per sport |
| Anti-cheat | -1 life per tab switch | Instant forfeit |
| Tracking | `survivalSessions` only | `dailyAttempts` + `survivalSessions` |
| Results page | `/results` | `/daily-results` |
| ELO | Yes | Yes (calls `completeSurvival` too) |

### Flow (`DailySurvivalScreen.tsx`)

1. `getOrCreateChallengeMut({ sport, mode: "survival" })` — ensures a daily challenge document exists for today
2. `startAttemptMut({ sport, mode: "survival" })` — creates a `dailyAttempts` row; throws if already attempted today
3. `startGameMut({ sport })` — starts a regular survival session for the actual gameplay
4. Gameplay proceeds identically to standard survival
5. On game over: `completeAttemptMut({ attemptId })` marks the daily attempt done, then `completeSurvivalMut()` records ELO
6. Navigate to `/daily-results`

If the user has already played today, they see "You've already played today's survival!" and are redirected home.

---

## 13. Frontend State Management

### React State (`SurvivalScreen.tsx`)

```
sessionId        — Convex document ID for the active survivalSessions row
lives            — Current lives (0–3), synced from server on each action
score            — Current score, synced from server
round            — Current round number, synced from server
challenge        — { initials, difficulty, hint } for current round
guess            — User's text input (controlled)
feedback         — { correct: boolean, answer: string } shown for 1.5 seconds
loading          — true until startGame resolves
submitting       — true while submitGuess is in flight
hints            — Array of hint strings received this round
hintStage        — Current hint stage (0–3)
hintTokens       — Remaining hint tokens (0–3)
speedStreak      — Current streak count
isOnFire         — Whether streak ≥ 5
performanceBonusRef — useRef accumulating +0.1 per "on fire" correct answer
showCheatModal   — Controls anti-cheat dialog visibility
shakeKey         — Incremented to trigger shake animation on penalty
startTime        — useRef recording session start for duration calculation
```

### UI Flow

1. **Loading** — "Starting survival..." pulsing text
2. **Active round** — Header (hearts, streak badge, score) → feedback banner (1.5s) → initials card (large letters in boxes) → hints list → text input → Submit button → Hint/Skip buttons
3. **Game over** — Auto-navigates to results screen with ELO data

---

## 14. Data Flow Diagram

```
User opens /survival?sport=football
  │
  ▼
SurvivalScreen.tsx → startGameMut({ sport: "football" })
  │
  ▼
survivalSessions.ts: startGame()
  ├── Load survival_initials_map.json
  ├── getDifficulty(round=1) → { initialsLen: 2, famousWeight: 1.0, label: "Easy" }
  ├── generateChallenge(football, 1, [])
  │     ├── Filter: initials.length ≤ 2, not used, has players
  │     ├── Random pick from candidates
  │     └── Return { initials: "CR", validPlayers: ["Cristiano Ronaldo", ...], ... }
  ├── Insert survivalSessions row
  └── Return { sessionId, round: 1, lives: 3, score: 0, challenge: { initials: "CR", ... } }
  │
  ▼
User types "Cristiano Ronaldo" → handleGuess()
  │
  ▼
survivalSessions.ts: submitGuess(sessionId, "Cristiano Ronaldo")
  ├── findBestMatch("Cristiano Ronaldo", ["Cristiano Ronaldo", ...])
  │     ├── normalizeAnswer("Cristiano Ronaldo") → "cristiano ronaldo"
  │     ├── normalizeAnswer("Cristiano Ronaldo") → "cristiano ronaldo"
  │     ├── levenshteinDistance("cristiano ronaldo", "cristiano ronaldo") → 0
  │     └── Return { matched: true, distance: 0, matchedPlayer: "Cristiano Ronaldo" }
  ├── Correct! Calculate speed streak
  ├── Generate next challenge for round 2
  ├── Patch session: score+1, round+1, usedInitials+new
  └── Return { correct: true, score: 1, round: 2, nextChallenge: {...}, ... }
  │
  ▼
User sees "Correct! Cristiano Ronaldo" for 1.5s, then next initials appear
  │
  ... (repeat until lives = 0)
  │
  ▼
games.ts: completeSurvival({ sport, score, durationSeconds, performanceBonus })
  ├── getSurvivalPerformance(score) → min(score/15, 1.0)
  ├── Add performanceBonus → finalPerf = min(1.0, basePerf + bonus)
  ├── Determine difficulty tier from score
  ├── calculateEloChange(currentElo, finalPerf, difficulty, kFactor)
  ├── Upsert userRatings row
  ├── Insert gameSessions row
  └── Return { eloChange, newElo, kFactor, kFactorLabel }
  │
  ▼
Navigate to /results with score, round, ELO data
```

---

## 15. Complete File Reference

| File Path | Purpose |
|-----------|---------|
| `app/convex/survivalSessions.ts` | Core game mutations: start, guess, hint, skip, penalize |
| `app/convex/games.ts` | `completeSurvival` — ELO calculation and game history |
| `app/convex/lib/fuzzy.ts` | `levenshteinDistance`, `isMatch`, `findBestMatch` |
| `app/convex/lib/scoring.ts` | `normalizeAnswer` (used by fuzzy) |
| `app/convex/lib/elo.ts` | ELO math: performance, change, K-factor, clamp, tiers |
| `app/convex/schema.ts` | `survivalSessions` table definition |
| `app/convex/dailyChallenge.ts` | Daily challenge creation, attempt gating, forfeit |
| `app/convex/data/survival_initials_map.json` | Football initials → players mapping |
| `app/convex/data/survival_initials_map_tennis.json` | Tennis initials → players mapping |
| `app/convex/data/nba_survival_data.json` | NBA initials → players mapping |
| `app/convex/data/football_player_metadata.json` | Player metadata for hints (club, position, nationality, era) |
| `app/src/pages/SurvivalScreen.tsx` | Standard survival UI component |
| `app/src/pages/DailySurvivalScreen.tsx` | Daily survival UI component |
| `app/src/hooks/useAntiCheat.ts` | Tab visibility change detection hook |
| `backend/sports/survival_engine.py` | Legacy: `SurvivalEngine` class |
| `backend/sports/survival_helpers.py` | Legacy: `FameCalculator`, `PlayerSelector`, `PlayerInfoExtractor` |
| `backend/sports/utils.py` | Legacy: `normalize_name`, `calculate_similarity`, `get_player_initials` |
| `backend/services/survival_session.py` | Legacy: session management service |
| `backend/routes/survival/session.py` | Legacy: REST API endpoints |
