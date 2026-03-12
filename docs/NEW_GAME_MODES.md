# New Game Modes — Complete Technical Audit

This document covers every detail of the three new game modes added to VerveQ: **Higher or Lower**, **VerveGrid**, and **Who Am I**. It spans data sourcing, database schema, backend logic, frontend UI, and edge cases.

---

## Table of Contents

1. [Data Foundation](#1-data-foundation)
2. [Higher or Lower](#2-higher-or-lower)
3. [VerveGrid](#3-vervegrid)
4. [Who Am I](#4-who-am-i)
5. [Shared Infrastructure](#5-shared-infrastructure)
6. [File Reference](#6-file-reference)

---

## 1. Data Foundation

All three game modes draw from five Convex tables seeded from JSON files produced by the data pipeline (`scripts/fetchSportsData.ts`). The pipeline pulls from API-FOOTBALL v3 (Pro) and API-SPORTS NBA v2, normalizes the data, and writes JSON files to `scripts/data/`.

### 1.1 Source Data Tables

| Table | Source JSON | Row Count | Description |
|-------|-----------|-----------|-------------|
| `sportsPlayers` | `players.json` | ~12,498 | Player profiles from API-FOOTBALL/NBA |
| `sportsTeams` | `teams.json` | ~373 | Team profiles with logos, venues, founding years |
| `statFacts` | `statFacts.json` | ~107,515 | Numeric stat records (goals, assists, clean sheets, etc.) |
| `gridIndex` | `gridIndex.json` | ~10,483 | Pre-computed row/col intersections for VerveGrid |
| `whoAmIClues` | `whoAmIClues.json` | ~12,498 | 4-clue progressively revealing hint sets per player |

### 1.2 ID Convention

Every record from the JSON files has an `id` field (e.g., `fb_player_54`, `fb_team_33`, `grid_team_fb_team_39_nat_spain`). Convex auto-generates its own `_id`, so the JSON `id` is stored as `externalId` and indexed via `by_external_id` for fast lookups. All cross-table references use `externalId` strings, not Convex `_id` references.

### 1.3 Seeding Process

The seeding script (`scripts/seedSportsDatabase.ts`) reads each JSON file, maps `id` to `externalId`, strips any `null` values (Convex `v.optional()` expects absent fields, not `null`), chunks records into batches of 256, and calls the corresponding Convex mutation via the HTTP API.

Each seed mutation (`frontend-web/convex/seedSportsData.ts`) deduplicates by querying the `by_external_id` index before inserting. Re-running the script is safe — it skips existing records.

**Run command:** `npx tsx scripts/seedSportsDatabase.ts`

---

## 2. Higher or Lower

**Route:** `/higher-lower?sport=football`
**Backend:** `convex/higherLower.ts`
**Frontend:** `src/pages/HigherLowerScreen.tsx`

### 2.1 Concept

The player sees two entities (teams or players) side by side. Entity A shows its stat value openly. Entity B shows "?" — the player must guess whether B's value for the same stat is **higher** or **lower** than A's. Correct guesses continue the streak; one wrong guess ends the game.

### 2.2 Session Initialization (`startSession`)

**Input:** `{ sport: string }`

**Step-by-step:**

1. Query the `statFacts` table, initially trying `statKey = "goalsFor"` for the given sport.
2. If fewer than 2 results, fall back to loading **all** statFacts for that sport.
3. Group the facts by `statKey` into a map. Filter to keys that have at least 2 entries.
4. Pick one `statKey` at random from the valid keys. This statKey stays fixed for the entire session (e.g., every comparison in the session is about "Goals Scored").
5. Shuffle the facts for that key. Pick `factA = shuffled[0]`, `factB = shuffled[1]`.
6. Iterate through the shuffled array trying to find a `factB` whose `value !== factA.value`. If all values are equal, use the second element anyway (the guess will auto-succeed since equal values count as correct for either guess).
7. Look up the photo/logo for each entity:
   - If `entityType === "player"` → query `sportsPlayers` by `externalId` → use `photo`.
   - If `entityType === "team"` → query `sportsTeams` by `externalId` → use `logo`.
8. Create a `higherLowerSessions` row with all data **denormalized** into the session (both names, both values, both photos, the statKey, the contextKey). This avoids extra DB reads during gameplay.
9. Return the session data to the frontend. **Player B's value is NOT returned** — only A's value is visible.

**Session TTL:** 1 hour (`expiresAt`), stored but not actively enforced in reads.

### 2.3 What Stats Are Used

The `statFacts` table contains both **team-level** and **player-level** stats:

**Team stats** (from API-FOOTBALL league standings):
- `goalsFor`, `goalsAgainst`, `cleanSheets` — per team per league per season
- Context format: `league:fb_39` (fb_39 = Premier League)

**Player stats** (aggregated from `playerTeamSeason` records):
- `goals`, `assists`, `appearances`, `minutes`, `cardsYellow` — per player per league per season
- `trophies` — career total (context: `career`)

**NBA stats:**
- `points`, `rebounds` — per player per season

Each stat fact has: `entityType` (player/team), `entityId`, `entityName`, `statKey`, `contextKey`, `value`, and optional `season`.

### 2.4 Guess Logic (`makeGuess`)

**Input:** `{ sessionId, guess: "higher" | "lower" }`

**Evaluation:**
```
isHigher = playerBValue > playerAValue
isEqual  = playerBValue === playerAValue
correct  = isEqual || (guess === "higher" ? isHigher : !isHigher)
```

- **Equal values always count as correct** regardless of guess direction.
- If `guess === "higher"` and B > A → correct.
- If `guess === "lower"` and B < A → correct.

**On correct:**
1. Score increments by 1. Streak increments by 1.
2. Current B becomes the new A (its value is now revealed to the player).
3. Pick a new B from the same `statKey + sport` pool, excluding both the current A and B externalIds.
4. Look up the new B's photo/logo.
5. Patch the session row with all new values.
6. Return the revealed B value + next round's A and B data.
7. If no more candidates exist (pool exhausted), the game ends as a win.

**On wrong:**
1. Session status is set to `"game_over"`.
2. The revealed B value is returned.
3. Score and streak remain unchanged from their pre-guess values.

### 2.5 Scoring

- **+1 point per correct guess.** No time bonuses, no multipliers.
- Score = total correct consecutive guesses.
- The streak counter is identical to the score (resets to 0 on game start).

### 2.6 Frontend UX

**Layout:** Vertical split — Player A (top, green card, value shown) → VS divider → Player B (bottom, blue card, value hidden as "?").

**Interactions:**
- Two buttons: "Higher" (accent/green, TrendingUp icon) and "Lower" (pink, TrendingDown icon).
- Buttons are disabled during animation transitions (1300ms lockout).

**Animations:**
- **Correct:** B card turns green, reveals value. After 1200ms, B slides into A's position, new B slides in with `animate-slide-up` (400ms).
- **Wrong:** B card turns red, shakes (`animate-shake-horizontal`, 600ms), reveals value. Game over panel slides up.

**Header:** Back arrow (to `/home`), streak badge (flame icon, appears at streak >= 3), score badge.

**Stat display:** The stat key is shown in human-readable form at the top (e.g., "Goals Scored — League"). The raw `statKey` is mapped through a label dictionary: `goalsFor` → "Goals Scored", `cleanSheets` → "Clean Sheets", etc. The `contextKey` (e.g., `league:fb_39`) is formatted to just the type ("League").

**Game over:** Shows final score, "Play Again" and "Home" buttons.

---

## 3. VerveGrid

**Route:** `/verve-grid?sport=football`
**Backend:** `convex/verveGrid.ts`
**Frontend:** `src/pages/VerveGridScreen.tsx`

### 3.1 Concept

A 3x3 grid with row headers (e.g., team names) and column headers (e.g., nationalities). Each cell is the intersection of its row and column criteria — the player must name a footballer who satisfies both. For example: Row = "Arsenal", Column = "France" → the player must name a French player who has played for Arsenal.

### 3.2 How the Grid Data is Generated (Pipeline)

The `buildGridIndex()` function in `fetchSportsData.ts` generates all possible row/col intersections from the player data. It builds four categories of intersections:

**1. Team x Nationality**
For every (team, nationality) pair, find all players who played for that team AND have that nationality. Example: `grid_team_fb_team_39_nat_spain` → Wolves + Spain → [Diego Costa, Adama Traore, ...].

**2. Team x Position**
For every (team, position) pair, find all players who played for that team AND play that position. Example: `grid_team_fb_team_42_pos_Midfielder` → Arsenal + Midfielder.

**3. Nationality x Position**
For every (nationality, position) pair. Example: `grid_nat_brazil_pos_Attacker` → Brazilian attackers.

**4. Team x Team**
For every pair of teams, find all players who have played for **both** teams. Example: `grid_team_fb_team_40_team_fb_team_49` → Liverpool + Chelsea → players who played for both.

**Difficulty assignment:** Based on how many valid players exist in the intersection:
- 6+ players → `easy`
- 3-5 players → `medium`
- 1-2 players → `hard`

Each gridIndex entry stores: `rowType`, `rowKey`, `rowLabel`, `colType`, `colKey`, `colLabel`, `playerIds[]` (all valid player externalIds), `difficulty`, and `sport`.

### 3.3 Session Initialization (`startSession`)

**Input:** `{ sport: string }`

**Step-by-step:**

1. Load all `gridIndex` entries for the given sport.
2. Extract unique row criteria (deduped by `rowType:rowKey`) and unique column criteria (deduped by `colType:colKey`).
3. Build a lookup map: `"rowType:rowKey|colType:colKey"` → `playerIds[]`.
4. Shuffle both the row candidates and column candidates randomly.
5. **Brute-force search for a valid 3x3 combination:**
   - Try all combinations of 3 rows and 3 columns (6-deep nested loops over shuffled candidates).
   - For each combination, check all 9 cells (3 rows x 3 cols) by looking up the intersection in the cell lookup map.
   - A combination is valid only if **all 9 cells have at least one valid player**.
   - Stop at the first valid combination found.
6. If no valid 3x3 exists, throw an error.
7. Insert a `verveGridSessions` row with:
   - `rows` and `cols` arrays (the chosen 3 row/col criteria with type, key, label).
   - `cells` array of 9 objects, each containing `rowIdx`, `colIdx`, `validPlayerIds[]`, and initially null `guessedPlayerId`/`guessedPlayerName`/`correct`.
   - `remainingGuesses: 9`, `correctCount: 0`, `status: "active"`.
8. Return the session data (rows, cols, guesses remaining) — **validPlayerIds are NOT returned** to the frontend.

### 3.4 Player Search (`searchPlayers`)

**Input:** `{ queryText: string, sport: string }`

This is a **Convex query** (reactive, not a mutation). It:
1. Returns empty if `queryText` is less than 2 characters.
2. Loads all `sportsPlayers` for the sport using the `by_sport_name` index.
3. Filters by case-insensitive substring match: `player.name.toLowerCase().includes(queryText.toLowerCase())`.
4. Returns the first 10 matches with `externalId`, `name`, `photo`, `position`.

**Frontend debouncing:** The search input has a 300ms debounce before the query fires.

### 3.5 Guess Validation (`submitGuess`)

**Input:** `{ sessionId, cellIndex: number, playerExternalId: string, playerName: string }`

**Validation steps:**
1. Session must exist and be `"active"`.
2. Must have `remainingGuesses > 0`.
3. The target cell must not already be solved (`correct !== true`).
4. **No player reuse:** Check if the same `playerExternalId` was already used in another cell where `correct === true`. If so, return `{ alreadyUsed: true }` without deducting a guess.
5. Check if `playerExternalId` is in the cell's `validPlayerIds` array.

**Outcome:**
- Every guess (correct or wrong) deducts 1 from `remainingGuesses`.
- If correct: cell is marked `correct: true`, `correctCount` increments.
- If wrong: cell stores the wrong player name and `correct: false`.
- Game ends when `correctCount === 9` (perfect) or `remainingGuesses === 0`.
- Status becomes `"completed"` on game end.

### 3.6 Frontend UX

**Layout:** 4x4 CSS grid — top-left corner is empty, top row has 3 column headers (blue), left column has 3 row headers (pink), and the 3x3 interior is the playable grid.

**Cell states:**
- **Empty:** Shows a search icon, light background. Clickable.
- **Correct:** Green background, checkmark icon, player name displayed in small text.
- **Wrong:** Muted background, red X icon, wrong player name in muted text. Cell is still clickable for retry.

**Search interaction:**
1. Click a cell → Dialog modal opens with a search input.
2. Type at least 2 characters → debounced query fires → results appear as a scrollable list.
3. Each result shows: player photo (if available), name, position.
4. Click a result → modal closes, guess is submitted.
5. If wrong: cell shakes (`animate-shake-horizontal`, 600ms).
6. If player was already used: cell shakes without deducting a guess.

**Header:** Back button, correctCount/9 badge (accent), remaining guesses badge (primary).

**Game over:** "Perfect Grid!" (if 9/9) or "Game Over!" panel with score and New Grid / Home buttons.

### 3.7 Grid Dimensions and Rules

- **Grid size:** Always 3x3 (9 playable cells).
- **Max guesses:** 9 (one per cell). No extra guesses.
- **No player reuse:** A player who was correctly placed in one cell cannot be placed in another.
- **Wrong guesses still consume a guess.** You cannot retry a wrong cell with another player unless you have remaining guesses.

---

## 4. Who Am I

**Route:** `/who-am-i?sport=football`
**Backend:** `convex/whoAmI.ts`
**Frontend:** `src/pages/WhoAmIScreen.tsx`

### 4.1 Concept

The player is given progressive clues about a mystery footballer and must guess who it is. There are 4 clues total. The player starts with clue 1 and can optionally reveal more clues, but each reveal reduces their potential score by 25%. They get **one guess** — wrong answer = game over.

### 4.2 How Players Are Selected

**Selection process (`startChallenge`):**

1. **Input:** `{ sport: string, difficulty?: string }`. If `difficulty` is provided, clues are filtered by both `sport` and `difficulty`. Otherwise, all clues for that sport are loaded.
2. All matching `whoAmIClues` entries are loaded from the database using the `by_sport_difficulty` index.
3. **One clue set is picked uniformly at random** from the pool (`Math.random()`).
4. A `whoAmISessions` row is created storing the `clueExternalId`, the `answerName`, initial `score: 1000`, `currentStage: 1`, and `status: "active"`.
5. Only `clue1` is returned to the frontend — the other clues are withheld server-side.

### 4.3 How Clues Are Generated (Pipeline)

The `buildWhoAmIClues()` function in the data pipeline generates clues for **every player** that has at least one `playerTeamSeason` record. Each player gets exactly 4 clues:

**Clue 1 — Nationality + Position** (most generic)
- Format: `"I am from {nationality}. I play as a {position}."`
- Example: `"I am from England. I play as a Midfielder."`

**Clue 2 — Teams played for** (narrowing)
- Lists up to 4 teams the player has appeared for, derived from `playerTeamSeason` records.
- Format: `"I have played for Arsenal, Liverpool."` or `"I have played for Manchester United."` (single team).
- Fallback if no team names resolve: `"I have played in {N} season(s)."`

**Clue 3 — Achievements / Stats** (more specific)
- If the player has won trophies: `"I have won {N} trophy/trophies, including {top 3 names}."`
- If no trophies but has goals: `"I have scored {N} goals across {M} appearances."`
- If NBA player with points: `"I have accumulated {N} points."`
- Fallback: `"I have made {N} appearances in my career."`

**Clue 4 — Transfer history or first name** (most specific / giveaway)
- If the player has transfer records: `"My transfers include: {from} to {to}; {from} to {to}."`
- If no transfers but has a first name: `"My first name is {firstName}."`
- Final fallback: `"I currently play in the {last team name}."`

### 4.4 Difficulty Assignment

Difficulty is assigned based on the player's rank by total career appearances (across all `playerTeamSeason` records):

| Rank (by appearances) | Difficulty |
|------------------------|-----------|
| Top 100 | `easy` — well-known players (e.g., Salah, De Bruyne) |
| 101 - 500 | `medium` — recognizable but not household names |
| 501+ | `hard` — obscure players, squad fillers |

### 4.5 Clue Reveal (`revealNextClue`)

**Input:** `{ sessionId }`

1. Session must be `"active"` and `currentStage < 4`.
2. Increment `currentStage` by 1.
3. Reduce score by 25%: `newScore = Math.floor(session.score * 0.75)`.
4. Fetch the full clue record from `whoAmIClues` by `externalId`.
5. Return the newly revealed clue text and updated score.

**Score progression (starting from 1000):**

| Clues Revealed | Stage | Score | Multiplier |
|----------------|-------|-------|------------|
| 1 (start) | 1 | 1000 | 1x |
| 2 | 2 | 750 | 0.75x |
| 3 | 3 | 562 | 0.56x |
| 4 (all) | 4 | 421 | 0.42x |

The score reduction is cumulative: each reveal applies `floor(current * 0.75)`, not `1000 * 0.75^n`.

### 4.6 Guess Logic (`submitGuess`)

**Input:** `{ sessionId, guess: string }`

The guess is evaluated using the shared `findBestMatch()` function from `convex/lib/fuzzy.ts`. It compares the player's guess against a single-element array: `[session.answerName]`.

**Fuzzy matching algorithm:**

1. **Normalization:** Both the guess and the answer are normalized: `trim → lowercase → strip non-alphanumeric except spaces`.
   - `"João Moutinho"` → `"joo moutinho"` (accents stripped)
   - `"De Bruyne"` → `"de bruyne"`

2. **Levenshtein distance:** Computed between the normalized guess and answer. Uses single-row DP (space-optimized).

3. **Dynamic max distance** (based on answer length):
   - Answer < 8 chars → max 1 edit allowed
   - Answer 8-14 chars → max 2 edits
   - Answer > 14 chars → max 3 edits

4. **Three possible outcomes:**

| Condition | Result | Effect |
|-----------|--------|--------|
| `distance === 0` | Exact match | `correct: true, typoAccepted: false` — game ends, score awarded |
| `distance <= maxDistance` | Fuzzy match | `correct: true, typoAccepted: true` — game ends, score awarded |
| `distance === maxDistance + 1` or `+2` | Close call | `correct: false, closeCall: true` — **NOT game over**, player can try again |
| `distance > maxDistance + 2` | Wrong | `correct: false` — game over, score = 0, answer revealed |

**Key behavior:** A close call does **not** end the game and does **not** deduct score. The player gets another chance. Only a definitive wrong guess ends the game.

### 4.7 Frontend UX

**Layout:** Vertical stack of clue cards, with unrevealed clues shown as faded "???" placeholders.

**Clue display:**
- Each clue is a NeoCard with a numbered circle (1-4) on the left and the clue text on the right.
- The most recently revealed clue has a blue highlight (`color="blue"`).
- Unrevealed clues are shown as faded cards at 30% opacity.
- New clues animate in with `animate-slide-up`.

**Header:** Back button, score multiplier badge (accent, e.g., "0.75x"), score badge (primary, e.g., "750 pts").

**Difficulty badge:** Color-coded: easy = green, medium = yellow/accent, hard = pink.

**Action area (bottom):**
- Text input for player name guess, with Enter key support.
- Two buttons side by side: "Guess" (primary) and "Reveal (-25%)" (accent).
- Reveal button shows "Max" when all 4 clues are already shown, and is disabled.

**Feedback animations:**
- **Close call:** Input shakes (`animate-shake-horizontal`, 600ms) + yellow accent banner saying "Close! Try again".
- **Correct:** Green success card with "Correct!", player name, and earned points. Slide-up animation.
- **Wrong:** Red destructive card with "Wrong!", reveals the answer, shows 0 points.

**After game over:** "Next Player" (starts a new challenge) and "Home" buttons.

---

## 5. Shared Infrastructure

### 5.1 Session Architecture

All three game modes follow the same session pattern:
- **Anonymous sessions:** `userId` is `v.optional(v.id("users"))` — no auth required.
- **Denormalized state:** Everything the frontend needs is embedded in the session row. No extra queries needed during gameplay.
- **TTL:** Each session has `expiresAt: Date.now() + 3600000` (1 hour). The TTL is stored but not actively enforced — sessions don't auto-expire.
- **Status machine:** Each session has a `status` field that acts as a simple state machine.

| Mode | Statuses | Terminal States |
|------|----------|----------------|
| Higher or Lower | `active` → `game_over` | `game_over` |
| VerveGrid | `active` → `completed` | `completed` |
| Who Am I | `active` → `correct` / `failed` | `correct`, `failed` |

### 5.2 Database Indexes

| Table | Index | Used For |
|-------|-------|----------|
| `sportsPlayers` | `by_external_id` | Photo/logo lookups during session init |
| `sportsPlayers` | `by_sport_name` | Player search in VerveGrid |
| `sportsTeams` | `by_external_id` | Team logo lookups |
| `statFacts` | `by_external_id` | Dedup during seeding |
| `statFacts` | `by_stat_key_sport` | Picking facts for Higher or Lower |
| `gridIndex` | `by_sport_difficulty` | Loading grid entries for VerveGrid |
| `gridIndex` | `by_external_id` | Dedup during seeding |
| `whoAmIClues` | `by_sport_difficulty` | Loading clues for Who Am I (with optional difficulty filter) |
| `whoAmIClues` | `by_external_id` | Fetching clue text during reveal |
| `higherLowerSessions` | `by_user` | Future: user session lookup |
| `verveGridSessions` | `by_user` | Future: user session lookup |
| `whoAmISessions` | `by_user` | Future: user session lookup |

### 5.3 Routing

| Route | Screen | Sport Selection |
|-------|--------|----------------|
| `/higher-lower?sport=football` | `HigherLowerScreen` | Via `/sport-select?mode=higher-lower` |
| `/verve-grid?sport=football` | `VerveGridScreen` | Via `/sport-select?mode=verve-grid` |
| `/who-am-i?sport=football` | `WhoAmIScreen` | Via `/sport-select?mode=who-am-i` |

All three are accessible from the HomeScreen's "Play" section, which routes through the SportSelectScreen for sport choice before landing on the game screen.

### 5.4 HomeScreen Cards

Three new cards were added to the Play section on the HomeScreen:

| Card | Icon | Color | Position |
|------|------|-------|----------|
| Higher or Lower | `TrendingUp` | `bg-success` (green) | After Blitz Mode |
| VerveGrid | `Grid3X3` | `bg-electric-blue` (blue) | After Higher or Lower |
| Who Am I | `HelpCircle` | `bg-hot-pink` (pink) | After VerveGrid |

The Forge card remains at the bottom.

---

## 6. File Reference

### Backend (Convex)

| File | Purpose |
|------|---------|
| `convex/schema.ts` | 5 data tables + 3 session tables added |
| `convex/seedSportsData.ts` | 5 batch seed mutations (one per data table) |
| `convex/higherLower.ts` | `startSession`, `makeGuess`, `getSession` |
| `convex/verveGrid.ts` | `startSession`, `searchPlayers`, `submitGuess`, `getSession` |
| `convex/whoAmI.ts` | `startChallenge`, `revealNextClue`, `submitGuess`, `getSession` |
| `convex/lib/fuzzy.ts` | `findBestMatch`, `levenshteinDistance`, `isMatch` (shared, pre-existing) |
| `convex/lib/scoring.ts` | `normalizeAnswer` (shared, pre-existing) |

### Frontend (React)

| File | Purpose |
|------|---------|
| `src/pages/HigherLowerScreen.tsx` | Higher or Lower game UI |
| `src/pages/VerveGridScreen.tsx` | VerveGrid game UI with search dialog |
| `src/pages/WhoAmIScreen.tsx` | Who Am I clue reveal + guess UI |
| `src/App.tsx` | 3 new routes added |
| `src/pages/SportSelectScreen.tsx` | Mode routing for 3 new modes |
| `src/pages/HomeScreen.tsx` | 3 new game mode cards |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/fetchSportsData.ts` | Data pipeline — fetches API data, builds gridIndex/statFacts/whoAmIClues |
| `scripts/seedSportsDatabase.ts` | Seeds Convex tables from JSON files |
