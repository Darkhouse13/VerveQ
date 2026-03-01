# VerveQ: Migrate Python/FastAPI Backend to Convex

## Context

The VerveQ sports quiz app currently uses a Python/FastAPI backend with SQLAlchemy ORM and SQLite/PostgreSQL. We are replacing the entire backend with Convex (TypeScript serverless functions + real-time document database). Both frontends (React web + React Native/Expo mobile) will be updated to use Convex React hooks instead of REST API calls via React Query/fetch.

**What's being removed:** Python backend, FastAPI, SQLAlchemy, PostgreSQL, JWT auth, React Query, all REST API calls.
**What's being added:** Convex schema, Convex queries/mutations/actions, Convex Auth, Convex React hooks.

---

## Key Design Decisions

1. **Convex location:** Initialize inside `frontend-web/` (it already has `package.json`). The mobile app connects via the same Convex deployment URL — no shared folder needed.
2. **Auth:** Convex Auth with `Anonymous` provider (replaces guest sessions) + `Password` provider (replaces display-name login). No Clerk needed.
3. **Survival data (JSON files):** Keep as static imports in Convex Node.js actions. NOT migrated to database (read-only lookup tables, ~200-500KB each).
4. **Quiz questions:** Store in Convex `quizQuestions` table. Seed via a one-time action from existing exported JSON.
5. **Sessions as documents:** Quiz and survival sessions become Convex documents (persistent, reactive via `useQuery`). Replaces in-memory Python dicts.
6. **Dropped tables:** `Leaderboard` (unused — derived from `userRatings`), `AnalyticsEvent` (broken/stub).
7. **Fuzzy name matching:** Port Jaro-Winkler to TypeScript as pure utility in `convex/lib/fuzzy.ts`.

---

## Phase 0: Convex Setup & Schema

### Tasks
1. **Initialize Convex** in `frontend-web/`: `npx convex dev`
2. **Install deps:** `npm install convex @convex-dev/auth @auth/core`
3. **Create `convex/schema.ts`** — 9 tables translating SQLAlchemy models:

| Convex Table | Source Model | Key Changes |
|---|---|---|
| `users` | User + authTables | Extends Convex Auth user; adds `username`, `displayName`, `avatarUrl`, `isGuest`, `totalGames` |
| `userRatings` | UserRating | `userId: v.id("users")`, indexes: `by_user_sport_mode`, `by_sport_mode_elo` |
| `gameSessions` | GameSession | `userId: v.id("users")`, uses `_creationTime` instead of `created_at` |
| `achievements` | Achievement | `achievementId` (string) as lookup key, index `by_achievement_id` |
| `userAchievements` | UserAchievement | Indexes: `by_user`, `by_user_achievement` |
| `challenges` | Challenge | `challengerId/challengedId: v.id("users")`, status as `v.union(v.literal(...))` |
| `quizQuestions` | QuizQuestion | Indexes: `by_sport_difficulty`, `by_checksum` |
| `quizSessions` | (new — was in-memory) | `sport`, `usedChecksums: v.array(v.string())`, `expiresAt` |
| `survivalSessions` | (new — was in-memory) | `sport`, `round`, `score`, `lives`, `hintUsed`, `usedInitials`, `gameOver`, `currentChallenge` with `validPlayers` for answer validation |

### Schema Detail

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    username: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isGuest: v.boolean(),
    totalGames: v.number(),
  }).index("by_username", ["username"]),

  userRatings: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    eloRating: v.number(),
    peakRating: v.number(),
    gamesPlayed: v.number(),
    wins: v.number(),
    losses: v.number(),
    bestScore: v.number(),
    averageScore: v.number(),
    lastPlayed: v.number(),
  })
    .index("by_user_sport_mode", ["userId", "sport", "mode"])
    .index("by_sport_mode_elo", ["sport", "mode", "eloRating"]),

  gameSessions: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    score: v.optional(v.number()),
    totalQuestions: v.optional(v.number()),
    correctAnswers: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    avgAnswerTimeSecs: v.optional(v.number()),
    details: v.optional(v.any()),
    eloBefore: v.number(),
    eloAfter: v.number(),
    eloChange: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"]),

  achievements: defineTable({
    achievementId: v.string(),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    icon: v.optional(v.string()),
    points: v.number(),
    requirements: v.optional(v.any()),
    requirementType: v.optional(v.string()),
    requirementValue: v.optional(v.number()),
    isHidden: v.boolean(),
  }).index("by_achievement_id", ["achievementId"]),

  userAchievements: defineTable({
    userId: v.id("users"),
    achievementId: v.string(),
    unlockedAt: v.number(),
    progress: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_achievement", ["userId", "achievementId"]),

  challenges: defineTable({
    challengerId: v.id("users"),
    challengedId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    challengerScore: v.optional(v.number()),
    challengedScore: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("declined")
    ),
    winnerId: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
  })
    .index("by_challenged_status", ["challengedId", "status"])
    .index("by_challenger", ["challengerId"]),

  quizQuestions: defineTable({
    sport: v.string(),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.optional(v.string()),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("intermediate"),
      v.literal("hard")
    ),
    bucket: v.string(),
    checksum: v.string(),
    difficultyVotes: v.number(),
    difficultyScore: v.number(),
    timesAnswered: v.number(),
    timesCorrect: v.number(),
    usageCount: v.number(),
  })
    .index("by_sport_difficulty", ["sport", "difficulty"])
    .index("by_checksum", ["checksum"]),

  quizSessions: defineTable({
    sport: v.string(),
    difficulty: v.optional(v.string()),
    usedChecksums: v.array(v.string()),
    expiresAt: v.number(),
  }),

  survivalSessions: defineTable({
    sport: v.string(),
    round: v.number(),
    score: v.number(),
    lives: v.number(),
    hintUsed: v.boolean(),
    usedInitials: v.array(v.string()),
    gameOver: v.boolean(),
    expiresAt: v.number(),
    currentChallenge: v.optional(
      v.object({
        initials: v.string(),
        round: v.number(),
        difficulty: v.string(),
        validPlayers: v.array(v.string()),
      })
    ),
  }),
});
```

### Files to create
- `frontend-web/convex/schema.ts`

---

## Phase 1: Auth Migration

### Tasks
1. **Create `convex/auth.ts`** — Configure Anonymous + Password providers
2. **Create `convex/users.ts`** — `me` query (returns current user), `ensureUserProfile` mutation
3. **Create `convex/http.ts`** — Required by Convex Auth for HTTP endpoints
4. **Rewrite `frontend-web/src/contexts/AuthContext.tsx`** — Replace JWT/localStorage with `useAuthActions()` + `useQuery(api.users.me)`
5. **Update `frontend-web/src/App.tsx`** — Add `ConvexAuthProvider` + `ConvexProvider` to provider stack
6. **Add `.env.local`** — `VITE_CONVEX_URL=<deployment-url>`

### Auth Implementation

```typescript
// convex/auth.ts
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Anonymous,
    Password({
      profile(params) {
        return {
          username: params.username as string,
          displayName: (params.displayName as string) || (params.username as string),
          isGuest: false,
          totalGames: 0,
        };
      },
    }),
  ],
});
```

```typescript
// convex/users.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});
```

### Frontend Provider Stack (New)

```typescript
// frontend-web/src/App.tsx
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

// Provider stack: ConvexAuthProvider → AuthProvider → TooltipProvider → Router
```

### Files to modify
- `frontend-web/src/App.tsx` — Add Convex providers
- `frontend-web/src/contexts/AuthContext.tsx` — Full rewrite
- `frontend-web/src/pages/LoginScreen.tsx` — Update login/guest calls

### Files to create
- `frontend-web/convex/auth.ts`
- `frontend-web/convex/users.ts`
- `frontend-web/convex/http.ts`

---

## Phase 2: Quiz Flow Migration

Replaces: `POST /{sport}/quiz/session`, `GET /{sport}/quiz/question`, `POST /{sport}/quiz/check`, `DELETE /{sport}/quiz/session/{id}`, `POST /{sport}/quiz/feedback`

### Tasks
1. **Create `convex/lib/scoring.ts`** — Port `calculateTimeScore()` and `normalizeAnswer()` from `backend/services/quiz_session.py`
2. **Create `convex/quizSessions.ts`** — 4 functions:
   - `createSession` (mutation) — inserts quizSessions doc
   - `getQuestion` (mutation, reads+writes) — random question from index, excludes used checksums, marks used
   - `checkAnswer` (mutation) — normalize + compare, time-based scoring
   - `endSession` (mutation) — deletes session doc
3. **Update `frontend-web/src/pages/QuizScreen.tsx`** — Replace `useCreateQuizSession()`, `api.get()`, `useCheckAnswer()` with `useMutation(api.quizSessions.*)`

### Key Logic

```typescript
// convex/lib/scoring.ts
export function calculateTimeScore(basePoints: number, timeTaken: number, maxTime = 10.0): number {
  if (timeTaken > maxTime) return 0;
  if (timeTaken <= 1.0) return basePoints;
  return Math.max(0, Math.floor(basePoints * ((maxTime - timeTaken) / (maxTime - 1.0))));
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
}
```

```typescript
// convex/quizSessions.ts — getQuestion is a mutation (reads + writes)
export const getQuestion = mutation({
  args: { sessionId: v.id("quizSessions"), sport: v.string(), difficulty: v.optional(v.string()) },
  handler: async (ctx, { sessionId, sport, difficulty }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || Date.now() > session.expiresAt) throw new Error("Session expired");

    const candidates = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", q => q.eq("sport", sport).eq("difficulty", difficulty ?? "intermediate"))
      .collect();

    const available = candidates.filter(q => !new Set(session.usedChecksums).has(q.checksum));
    if (!available.length) throw new Error("No questions available");

    const picked = available[Math.floor(Math.random() * available.length)];
    await ctx.db.patch(sessionId, { usedChecksums: [...session.usedChecksums, picked.checksum] });

    return { question: picked.question, options: picked.options, correctAnswer: picked.correctAnswer,
             explanation: picked.explanation, difficulty: picked.difficulty, checksum: picked.checksum };
  },
});
```

### Files to create
- `frontend-web/convex/quizSessions.ts`
- `frontend-web/convex/lib/scoring.ts`

### Files to modify
- `frontend-web/src/pages/QuizScreen.tsx`

---

## Phase 3: Survival Flow Migration (Most Complex)

Replaces: `POST /survival/start`, `POST /survival/guess`, `POST /survival/session/{id}/hint`, `POST /survival/session/{id}/skip`

### Tasks
1. **Create `convex/lib/fuzzy.ts`** — Jaro-Winkler similarity, `isMatch()` (threshold 0.8)
2. **Create `convex/actions/survivalEngine.ts`** (`"use node"`) — Loads JSON survival data, generates challenges with round-based difficulty progression
3. **Create `convex/survivalSessions.ts`** — Public functions:
   - `startGame` (action) — calls survivalEngine, then internal mutation to create session doc
   - `getSession` (query) — reactive session state for `useQuery`
   - `submitGuess` (action) — fuzzy match against `validPlayers`, calls internal mutation to update session
   - `useHint` (mutation) — returns sample players, sets `hintUsed=true`
   - `skipChallenge` (action) — deducts life, generates next challenge
4. **Create `convex/survivalHelpers.ts`** — Internal mutations: `createSession`, `applyCorrectGuess`, `applyWrongGuess`, `applySkip`
5. **Copy survival JSON files** to `frontend-web/convex/data/`
6. **Update `frontend-web/src/pages/SurvivalScreen.tsx`** — Use `useQuery` for reactive game state

### Difficulty Progression (Ported from Python)

| Rounds | Level | Initials Length | Famous Weight |
|---|---|---|---|
| 1-3 | Easy | 2 only | High (5x) |
| 4-5 | Medium | 2 only | Medium (2x) |
| 6-7 | Hard | 2 only | Low (1x) |
| 8+ | Expert | 2-3 | Low (1x) |

### Fuzzy Matching

```typescript
// convex/lib/fuzzy.ts — Jaro-Winkler similarity (pure math, no npm deps)
export function jaroWinkler(s: string, t: string, p = 0.1): number { /* ... */ }
export function isMatch(answer: string, target: string): boolean {
  return jaroWinkler(answer, target) >= 0.8;
}
```

### Frontend Pattern (Reactive)

```typescript
// SurvivalScreen.tsx — session state updates reactively via useQuery
const sessionData = useQuery(api.survivalSessions.getSession, sessionId ? { sessionId } : "skip");
// Derive lives, score, round, challenge directly from sessionData — no local state needed
```

### Files to create
- `frontend-web/convex/survivalSessions.ts`
- `frontend-web/convex/survivalHelpers.ts`
- `frontend-web/convex/actions/survivalEngine.ts`
- `frontend-web/convex/lib/fuzzy.ts`
- `frontend-web/convex/data/survival_initials_map.json`
- `frontend-web/convex/data/survival_initials_map_tennis.json`
- `frontend-web/convex/data/nba_survival_data.json`

### Files to modify
- `frontend-web/src/pages/SurvivalScreen.tsx`

---

## Phase 4: Game Completion, Leaderboards, Social Features

### Tasks
1. **Create `convex/lib/elo.ts`** — Port `EloService` (pure math):
   - `calculateEloChange(playerRating, performanceScore, difficulty)` — K=32, difficulty-based opponent rating
   - `getQuizPerf(correct, total, avgTime?)` — base accuracy + time bonus
   - `getSurvivalPerf(score)` — `min(score/15, 1.0)`
   - `calcNewRating(current, change)` — clamp [800, 2400]
2. **Create `convex/games.ts`** — `completeQuiz` and `completeSurvival` mutations
3. **Create `convex/leaderboards.ts`** — `getLeaderboard` query (index `by_sport_mode_elo`, order desc)
4. **Create `convex/achievements.ts`** — `list` query, `userAchievements` query, `checkAndUnlock` mutation
5. **Create `convex/challenges.ts`** — `getPending`, `create`, `accept`, `decline` mutations
6. **Create `convex/sports.ts`** — `list` and `theme` queries (static config, no DB)
7. **Create seed actions** for achievements and quiz questions
8. **Update frontend pages**

### ELO Implementation

```typescript
// convex/lib/elo.ts
const K = 32;
const DIFFICULTY_RATINGS: Record<string, number> = { easy: 1000, intermediate: 1200, hard: 1400 };

export function calculateEloChange(playerRating: number, performanceScore: number, difficulty: string): number {
  const opponentRating = DIFFICULTY_RATINGS[difficulty] ?? 1200;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round((K * (performanceScore - expected)) * 10) / 10;
}
```

### Files to create
- `frontend-web/convex/games.ts`
- `frontend-web/convex/lib/elo.ts`
- `frontend-web/convex/leaderboards.ts`
- `frontend-web/convex/achievements.ts`
- `frontend-web/convex/challenges.ts`
- `frontend-web/convex/sports.ts`
- `frontend-web/convex/actions/seedAchievements.ts`
- `frontend-web/convex/actions/seedQuestions.ts`

### Files to modify
- `frontend-web/src/pages/LeaderboardScreen.tsx`
- `frontend-web/src/pages/ProfileScreen.tsx`
- `frontend-web/src/pages/ChallengeScreen.tsx`
- `frontend-web/src/pages/ResultScreen.tsx`
- `frontend-web/src/pages/DashboardScreen.tsx`
- `frontend-web/src/pages/HomeScreen.tsx`

---

## Phase 5: Mobile Frontend (React Native/Expo) Migration

### Tasks
1. **Install Convex in mobile:** `cd frontend && npm install convex @convex-dev/auth`
2. **Update `frontend/App.js`** — Replace provider stack with `ConvexProvider` + `ConvexAuthProvider`
3. **Rewrite `frontend/src/context/AuthContext.js`** — Use Convex Auth hooks
4. **Remove `frontend/src/context/SessionContext.js`** — Replaced by Convex session documents
5. **Update all screens** — Replace raw `fetch()` calls with `useQuery`/`useMutation`/`useAction`
6. **Remove `frontend/src/config/api.js`** — No longer needed
7. **Add `EXPO_PUBLIC_CONVEX_URL` to `frontend/app.config.js`**

### Files to modify
- `frontend/App.js`
- `frontend/src/context/AuthContext.js`
- All 11 screen files in `frontend/src/screens/`

### Files to delete
- `frontend/src/context/SessionContext.js`
- `frontend/src/config/api.js`

---

## Phase 6: Cleanup

### Tasks
1. **Delete entire `backend/` directory** (Python FastAPI, all routes, services, models)
2. **Delete `frontend-web/src/lib/api.ts`** (fetch wrapper)
3. **Delete `frontend-web/src/hooks/use-api.ts`** (React Query hooks)
4. **Uninstall `@tanstack/react-query`** from `frontend-web/package.json`
5. **Delete deployment configs:** `ecosystem.config.js`, `nginx/`, `systemd/`, `logrotate/`, `scripts/deploy.sh`, `setup_postgres.sql`
6. **Update `frontend-web/src/types/api.ts`** — Keep UI-specific types, replace backend response types with Convex generated types
7. **Run Prettier** on all new TypeScript files (print width 80)

---

## Convex File Tree (Final)

```
frontend-web/convex/
  schema.ts                      # 9 tables + authTables
  auth.ts                        # Anonymous + Password providers
  http.ts                        # Convex Auth HTTP endpoints
  users.ts                       # me query, ensureUserProfile mutation
  quizSessions.ts                # createSession, getQuestion, checkAnswer, endSession
  survivalSessions.ts            # startGame, getSession, submitGuess, useHint, skipChallenge
  survivalHelpers.ts             # Internal mutations for session state updates
  games.ts                       # completeQuiz, completeSurvival (ELO updates)
  leaderboards.ts                # getLeaderboard query
  achievements.ts                # list, userAchievements, checkAndUnlock
  challenges.ts                  # getPending, create, accept, decline
  sports.ts                      # list, theme (static)
  lib/
    elo.ts                       # Pure ELO calculation functions
    scoring.ts                   # Time-based scoring, answer normalization
    fuzzy.ts                     # Jaro-Winkler similarity for survival
  actions/
    survivalEngine.ts            # "use node" — JSON data loading, challenge generation
    seedQuestions.ts              # "use node" — one-time question import
    seedAchievements.ts          # "use node" — seeds 7 default achievements
  data/
    survival_initials_map.json   # Football survival data
    survival_initials_map_tennis.json
    nba_survival_data.json
```

---

## Verification

1. **Schema:** Run `npx convex dev` — confirms schema deploys without errors
2. **Auth:** Login screen → create account → verify user doc in Convex dashboard; guest flow → verify anonymous session
3. **Quiz flow:** Start quiz → answer 10 questions → check scores and ELO update
4. **Survival flow:** Start survival → verify reactive UI updates (lives, score, round via `useQuery`) → use hint → skip → game over → check ELO
5. **Leaderboard:** Play multiple games → verify leaderboard ordering by ELO
6. **Achievements:** Complete first quiz → verify "first_quiz" achievement unlocked
7. **Mobile:** Run `npx expo start` → test same flows on mobile
8. **Cleanup:** Verify no remaining references to `api.ts`, `use-api.ts`, `@tanstack/react-query`, or any REST API paths
