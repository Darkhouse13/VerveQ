# Production Readiness Audit

Read-only audit of the live surface (app + Convex) performed 2026-04-21.
Phase 0 doc-truth pass performed 2026-05-31 against the current `app/`
tree. Closed items below are marked with current file+line evidence; open
scale/perf/uniqueness hardening items are deferred to the v2 hardening phase,
not abandoned.

Severity ladder:
- **Blocker** — would allow credential theft, leaderboard fraud, data leak, or
  hard fail at production scale. Must be fixed before any public launch.
- **High** — would noticeably degrade UX, produce incorrect rankings, or brick
  a whole mode under common conditions. Fix before launch.
- **Medium** — bug or scale concern that will bite in the first few weeks of
  real traffic, but doesn't make the app unusable.
- **Low** — polish, documentation drift, nice-to-have robustness.

---

## Blockers

### BLOCKER-1 — Password == username in cleartext account creation — **RESOLVED**
**File:** `app/src/contexts/AuthContext.tsx:42-54` (login flow)

Every password-flow signup was:

```ts
const username = displayName.toLowerCase().replace(/\s+/g, "_");
await signIn("password", {
  email: `${username}@verveq.local`,
  password: username,           // <-- password equals normalized username
  flow: "signUp",
  ...
});
```

The password for any account was a deterministic lowercase-and-underscore
transform of the public display name. Anyone who knew a public display name
could log in as that account with no additional information — then play
games, cast Forge votes, forfeit daily attempts, create challenges, and
pollute the leaderboard under that identity.

**Why it mattered:** account takeover at zero cost. Leaderboards, ELO, Forge
contributions all became untrustworthy the moment the app went public.

**Resolution:** Auth now uses Convex Auth's Password provider with real
email + password (12–72 chars, common-password deny list, Scrypt hashing),
plus OTP-based password reset (6 digits, 10-minute expiry) delivered via
Resend. The old deterministic signup path is gone. Legacy
`@verveq.local` accounts are invalidated by the one-shot
`migrations/invalidateLegacyAuth` internal mutation (see
[docs/AUTH.md](AUTH.md)). The related audit finding HIGH-2 (ensureProfile
short-circuit) was folded into the same fix.

---

### BLOCKER-2 — Client-trusted `correctAnswer` on every quiz / blitz / daily path — **RESOLVED**
**Files:**
- `app/convex/quizSessions.ts:116-181` (`checkAnswer`)
- `app/convex/blitz.ts:110-180` (`submitAnswer`)
- `app/convex/dailyChallenge.ts:536-645` (`submitAnswer`)

Current state: these mutations no longer accept client-supplied
`correctAnswer`. Quiz and blitz validate against the server-owned current
checksum and load `quizQuestions` through `by_checksum` before comparing the
submitted answer to `question.correctAnswer`. Daily challenge submission
resolves the stored daily challenge checksum/snapshot, gates ownership with
`attempt.userId === getAuthUserId(ctx)`, and derives `timeTaken` from server
timestamps.

---

### BLOCKER-3 — `completeQuiz` / `completeSurvival` trust client-supplied score/accuracy/averageTime/performanceBonus — **RESOLVED**
**File:** `app/convex/games.ts:33-129` (`completeQuiz`), `app/convex/games.ts:156-244` (`completeSurvival`)

Current state: both completion mutations accept only a server-owned
`sessionId`. `completeQuiz` re-derives `totalAnswers`, `correctCount`,
`accuracy`, `averageTime`, and `sessionScore` from the quiz session row.
`completeSurvival` re-derives `sport`, `score`, `durationSeconds`, and
`performanceBonus` from the survival session row; `performanceBonus` is not
a client argument.

---

### BLOCKER-4 — `getSession` queries leak the answer for Higher/Lower, VerveGrid, and Who Am I — **RESOLVED**
**Files:**
- `app/convex/higherLower.ts:369-399`
- `app/convex/verveGrid.ts:280-315`
- `app/convex/whoAmI.ts:295-341`

Current state: each query returns a projected session. Higher/Lower returns
`playerBValue: null` while active and reveals it only after game over or
expiry. VerveGrid maps cells to UI-safe fields and exposes
`validAnswerCount`, not `validPlayerIds`. Who Am I returns `answerName: null`
while active/early-failed and reveals only after terminal reveal states.

---

### BLOCKER-5 — Daily challenge `submitAnswer` has no attempt-ownership check and trusts `timeTaken` — **RESOLVED**
**File:** `app/convex/dailyChallenge.ts:536-645`, `app/convex/dailyChallenge.ts:650-699`

Current state: `submitAnswer`, `forfeit`, and `completeAttempt` all require
`attempt.userId === getAuthUserId(ctx)`. `submitAnswer` takes no client
`timeTaken`; it derives elapsed time from `currentQuestionStartedAt` or
`startedAt` and patches the server-owned attempt results.

---

## High-severity

### HIGH-1 — Global leaderboard (`getLeaderboard` with no sport/mode) is not actually ranked by ELO — **OPEN / DEFERRED TO V2 HARDENING**
**File:** `app/convex/leaderboards.ts:11-53`

When `sport`/`mode` are absent, the fallback is:

```ts
ratings = await ctx.db.query("userRatings").order("desc").take(200);
```

That orders by `_creationTime desc` (Convex's default), then re-sorts in
memory by `elo_rating`. The "Top 200" bucket is therefore "the 200 most
recently created rating rows" — not the 200 highest ELO players. Once the
user base has more than 200 rating rows, the global leaderboard stops
showing the real top of the ladder.

**Why it matters:** leaderboards that claim to be global are lying. Users
notice; it's a credibility hit.

**Current status:** still open in the current tree. This is a ranking/scale
hardening item for v2: either expose only sport+mode leaderboards (which do
use `by_sport_mode_elo`), or add a global ELO index on `userRatings`.

---

### HIGH-2 — `ensureProfile` short-circuits before setting the username — **RESOLVED**
**File:** `app/convex/users.ts:14-38`

Old handler returned early on any existing user doc, so the patch branch
setting `username` was dead code. Fixed alongside BLOCKER-1: the guard now
keys on whether `existing.username` is present, not whether the doc exists,
so first-time users receive a derived username exactly once and subsequent
calls remain no-ops.

---

### HIGH-3 — Username uniqueness hardening — **OPEN / DEFERRED TO V2 HARDENING**
**File:** `app/convex/users.ts:36-80`, `app/convex/users.ts:93-155`, schema at `app/convex/schema.ts:8-21`

The original "no uniqueness check" bug is closed at the application layer:
`ensureProfile` normalizes the requested handle, checks `by_username`, scans
case-insensitively as a fallback, and rejects collisions before patching the
user row. The remaining v2 hardening gap is schema/database-level uniqueness:
the table still has a regular `by_username` index, not a uniqueness
constraint, so production identity guarantees depend on the mutation-level
guard and Convex transaction behavior.

---

### HIGH-4 — No React ErrorBoundary anywhere in the tree — **RESOLVED**
**File:** `app/src/App.tsx:8`, `app/src/App.tsx:161-163`, `app/src/App.tsx:276-281`; component at `app/src/components/ErrorBoundary.tsx:15-26`

Current state: the root app is wrapped in `ErrorBoundary`, and the challenge
arena route also has a scoped boundary around the screen component.

---

### HIGH-5 — `eloDecay.runDecay` and `seasonManager.checkSeason` scan all user ratings in one mutation — **OPEN / DEFERRED TO V2 HARDENING**
**Files:**
- `app/convex/eloDecay.ts:11-30` — still collects all `userRatings`
- `app/convex/seasonManager.ts:85-95` — season reset still collects all `userRatings`

Convex mutations have a hard per-transaction cost ceiling. A single `collect()`
on `userRatings` with N users × M modes of data loads the whole table into
memory, then performs up to N patches + N inserts in the same transaction.
Season rollover also does per-user `seasonHistory` inserts.

**Why it matters:** the crons currently run daily. At ~10k rating rows the
mutation will time out, decay stops applying, season rollover fails halfway
through and leaves some users archived and others not. Hard to detect until
it happens.

**Current status:** still open in the current tree. Paginate via
`ctx.scheduler.runAfter`: enqueue chunked internal mutations (for example,
500 rows at a time, keyed by a cursor). Season rollover already inserts into
`seasonHistory`; the reset step should likewise be chunked, not a single
transaction.

---

### HIGH-6 — No TTL sweeper for expired game sessions — **RESOLVED**
**Files:** `app/convex/crons.ts:10`, `app/convex/maintenance.ts:7-110`

Current state: `expired-session-cleanup` runs hourly and calls
`maintenance.cleanupExpiredSessions`. The cleanup mutation uses
`by_expiresAt` / `by_endTimeMs` indexes with `take(batchLimit)` and closes or
deletes expired quiz, daily, survival, Higher/Lower, VerveGrid, Who Am I,
and Blitz sessions in bounded batches.

---

### HIGH-7 — `verveGrid.searchPlayers` global fallback scans all football players on every keystroke — **RESOLVED**
**File:** `app/convex/verveGrid.ts:105-180`

Current state: search requires an active, owned session and cell index. It
limits candidate lookup to the current cell's `validPlayerIds` and returns
`[]` when session context is missing, so the old global `sportsPlayers`
fallback scan is gone. The remaining bounded fan-out over valid player IDs
is a lower-priority performance consideration, not the original global-scan
high.

---

## Medium-severity

### MED-1 — `quizSessions.getQuestion` and `blitz.getQuestion` collect entire question pools per request
**Files:** `app/convex/quizSessions.ts:37-42` (`collect()` with no
`.take()`), `app/convex/blitz.ts:48-53` (`take(200)`).

Every question request loads either the entire sport+difficulty slice (quiz)
or up to 200 questions (blitz), then filters in memory. Football at current
scale is ~2.5k quiz questions. Per-user cost scales linearly with mode
plays.

**Why it matters:** N users × 10 questions per session = N×10 full-scan
queries. Not a blocker, but noticeable.

**Suggested fix direction:** stream with `.take(50)` + rejection sampling,
or maintain a `usageCount` + `by_sport_difficulty_usage` index to pick
under-used questions without scanning.

---

### MED-2 — `forge.vote` has a race at the approval threshold
**File:** `app/convex/forge.ts:196-307`

If two voters flip net from 4 → 5 simultaneously, both reads see
`approveCount=4`, both insert a vote, both compute `newNet=5`, both enter
the "approved" branch and both `ctx.db.insert("quizQuestions", ...)` — which
has `by_checksum` but not a uniqueness constraint — producing a duplicate
approved quiz question.

Convex OCC will normally detect write-conflict and retry one of the
transactions. But in retry both will re-compute the same state and still try
to insert. Depends on exact ordering.

**Why it matters:** duplicate quiz questions in the approved pool. Not
catastrophic (quiz duplicates are annoying, not fatal), but also not
idempotent.

**Suggested fix direction:** before insert into `quizQuestions`, re-check
`by_checksum` for existence (same as `submit` does on create) and skip if
already there.

---

### MED-3 — Bundle is a single 528 KB / 153 KB gzipped chunk
**File:** Vite build output.

Every route is statically imported in `App.tsx`. First paint always ships
the whole app including Blitz/Live Match/Forge code for a user who might
only play Quiz.

**Why it matters:** slower first paint on mobile 4G, especially on the
login screen which is by far the most common first load.

**Suggested fix direction:** `const HomeScreen = lazy(() => import(...));`
for non-login routes. One-evening change.

---

### MED-4 — `useAntiCheat` fires on every `visibilitychange` hidden event without a grace period
**File:** `app/src/hooks/useAntiCheat.ts:7-17`

In Daily Quiz (`app/src/pages/DailyQuizScreen.tsx:135-145`) a single tab hide
triggers an immediate forfeit. On mobile Safari, the OS sends `visibilitychange
hidden` when the user gets a notification, opens the share sheet, or when
the network stack backgrounds the tab for any reason. In normal survival
(`survivalSessions.penalizeTabSwitch`) it costs a life.

**Why it matters:** false-positive forfeits in real-world mobile use. Users
perceive this as unfair.

**Suggested fix direction:** debounce — only penalize if the tab stays
hidden > 2 seconds, or require two hides within the same round. Already
noted in `docs/SURVIVAL_MODE_AUDIT.md:§9` that daily forfeit is intentional
but the current implementation is too trigger-happy for mobile.

---

### MED-5 — `auth.config.ts` silently succeeds when `CONVEX_SITE_URL` is undefined
**File:** `app/convex/auth.config.ts:1-8`

```ts
export default {
  providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }],
};
```

If `CONVEX_SITE_URL` isn't set on the deployment, `domain` is `undefined`.
Convex Auth validates tokens against the resulting issuer; depending on the
exact behavior in `@convex-dev/auth@0.0.91`, this either rejects all tokens
or accepts any domain. Either way, no build-time warning.

**Why it matters:** silent auth misconfiguration that only shows up when
users try to sign in and get "invalid token" errors.

**Suggested fix direction:** assert `CONVEX_SITE_URL` at the top of the
file and throw a loud error. Deployment docs should call it out.

---

### MED-6 — `@convex-dev/auth` pinned at pre-1.0 (0.0.91)
**File:** `app/package.json:23`

Pre-1.0 libraries can break across patch versions. The ecosystem around
Convex Auth is still stabilizing. This is acceptable today but warrants
locking to an exact version, not a `^0.0.91` range.

**Suggested fix direction:** change `"@convex-dev/auth": "^0.0.91"` to
`"0.0.91"` until the lib reaches 1.0, and audit upgrade notes before bumping.

---

### MED-7 — `getMatch` has no player-in-match gate
**File:** `app/convex/liveMatches.ts:240-302`

`getMatch` returns the full sanitized match view to any authenticated caller
who knows the `matchId`. During an active question the current
`correctAnswer` is stripped (line 252-267), but anyone can watch any match.
Previous questions' correct answers and opponent's past answers are visible.

**Why it matters:** spectator-style leak. Matches are 1v1 so there's no
legitimate third-party observer. `matchId`s aren't enumerable but do leak
into browser history and could be shared.

**Suggested fix direction:** early-return `null` unless `userId ===
match.player1Id || userId === match.player2Id` (plus maybe a future admin
flag).

---

## Low-severity

### LOW-1 — `docs/SURVIVAL_MODE_AUDIT.md` describes the deleted Python backend in §2 and §15 — **RESOLVED**
Stage 1 removed `backend/`. The Survival audit now labels the Python backend
section historical/superseded and keeps the live Convex implementation as
the source of truth. No Survival code or data changed.

---

### LOW-2 — `docs/CONTRIBUTING.md` "Project Structure" still lists `backend/`, `frontend/`, `tests/` — **PARTIALLY ADDRESSED / DEFERRED**
**File:** `docs/CONTRIBUTING.md`. A historical/superseded header now points
readers to README.md and `docs/DEPLOYMENT.md` for current truth. A full
rewrite of the legacy contribution guidance remains deferred.

---

### LOW-3 — `docs/DESIGN_PROMPT.md` frames the app as "React Native + Expo" — **NO LONGER PRESENT**
`docs/DESIGN_PROMPT.md` is not present in the current tree.

---

### LOW-4 — `docs/SECURITY.md` describes JWT auth — **PARTIALLY ADDRESSED / DEFERRED**
**File:** `docs/SECURITY.md`. A historical/superseded header now points to
`docs/DEPLOYMENT.md` and the stale PostgreSQL production recommendation was
removed. A full security-policy rewrite for Convex Auth remains deferred.

---

### LOW-5 — `verify-no-secrets.sh` at repo root was written for the deleted stack
Still runs checks that partially apply, but references the deleted FastAPI
deployment model. Either refresh or delete.

---

### LOW-6 — No `.env.local.example` documents the current env
`.env.example` and `.env.production.example` were removed in Stage 1. The
runtime now needs `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, optional
`CONVEX_SITE_URL`, plus `API_FOOTBALL_KEY` / `NBA_API_KEY` /
`SPORTSDB_API_KEY` for the scripts. Nothing documents this in tree form.

---

### LOW-7 — `.gitignore` ignores `.env.local` and `.env.*` (good) but also ignores `**/test*.db`
**File:** `.gitignore:176-209`. Current `**/test*.db` pattern no longer
matches anything since test suite was deleted. Harmless but stale.

---

### LOW-8 — `package.json` has dependencies with zero imports
Repeat of `docs/REPO_INVENTORY.md` findings: `@auth/core`,
`@hookform/resolvers`, `date-fns`, `zod` have zero first-party imports.
Each bumps install size and audit surface.

---

### LOW-9 — Fuzzy-match threshold drift between doc and code
**File:** `docs/SURVIVAL_MODE_AUDIT.md:§5` says "distance ≤ 1 accepted" but
`app/convex/lib/fuzzy.ts:39-44` uses dynamic thresholds (1 / 2 / 3
based on target length). Protected scope — don't touch the code — but the
doc should be updated to reflect the actual behavior.

---

### LOW-10 — `package.json` has no script to run lint/typecheck in CI
**File:** `app/package.json:6-20`. `npm run lint` exists but no
combined `npm run check` or `npm run ci` that gates build+lint+test in one
step. The old `.github/workflows/tests.yml` was removed; no replacement.

**RESOLVED 2026-06:** `npm run check` now runs codegen + `tsc -b` + lint +
tests + build in one command; tsc is a hard gate (0 errors on master).

---

### LOW-11 — `quizSessions.submitFeedback`, `sports.list`, and others have no auth gate
These are intentionally public queries, which is fine for non-mutating
reads. But `submitFeedback` is a mutation that lets any anonymous client
skew `difficultyScore` / `difficultyVotes` on any question. Not a blocker
(votes average out) but an abuse vector if anyone script-kiddies it.

---

## Operational notes

- `.ops/curated-parity/` is correctly gitignored. Trust-anchor secrets live
  outside the repo per `docs/DEPLOYMENT.md`. No drift found there.
- `scripts/data/` is gitignored; curated artifacts come from the approved
  pipeline. No drift.
- `pipeline-config.json` is committed and used by `scripts/fetchSportsData.ts`
  and `scripts/fetchData.ts`. No hardcoded secrets; API keys are read from
  `process.env`.
- Sports list is hardcoded in `app/convex/sports.ts:3-7` and again
  in `app/src/pages/HomeScreen.tsx:214,236` (copy strings like
  "Curated football 3x3 grid"). Duplicating the "football-only for three
  modes" story across server + client is fine short-term but will need a
  source-of-truth when adding a second curated sport.

---

## What I deliberately did not flag

- Survival fuzzy-match logic (`app/convex/lib/fuzzy.ts`) —
  protected scope.
- Survival valid-answer data (`app/convex/data/**`) — protected.
- Schema shape (`app/convex/schema.ts`) — protected; index gaps are
  flagged but no schema changes suggested.
- Curated-parity trust-anchor design — intentionally out of scope.

If any of the above should be reopened, treat it as a new decision, not a
follow-up to this audit.
