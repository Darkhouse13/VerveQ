# Production Readiness Audit

Read-only audit of the live surface (app + Convex) performed 2026-04-21.
Findings only — nothing fixed. Each item has a severity, a file+line pointer,
what the issue is, why it matters on a public production URL, and a suggested
fix direction.

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

### BLOCKER-2 — Client-trusted `correctAnswer` on every quiz / blitz / daily path
**Files:**
- `app/convex/quizSessions.ts:90-107` (`checkAnswer`)
- `app/convex/blitz.ts:102-137` (`submitAnswer`)
- `app/convex/dailyChallenge.ts:197-230` (`submitAnswer`)

All three mutations accept `correctAnswer` as an **argument from the client**
and compute correctness by comparing `answer === correctAnswer`. The server
doesn't re-derive correctness from the question checksum / stored question
row. Any client (browser devtools, curl) can submit any `answer` along with
an identical `correctAnswer` string and be told "correct, score 100."

Paired with BLOCKER-3 below, this makes the entire leaderboard and ELO graph
fictional.

**Why it matters:** leaderboard fraud, ELO inflation, Forge gold-tier gating
bypass (Forge access gates at ELO ≥ 1500 which can be farmed instantly).

**Suggested fix direction:** mutations should take the question `checksum`
instead of `correctAnswer`. Server loads the row via `by_checksum` and
compares `normalizeAnswer(answer)` to the stored correct answer. Do not
return `correctAnswer` in `getQuestion` / daily `getQuestion` — or if the UI
needs it for the reveal, return it only after a successful submit.

---

### BLOCKER-3 — `completeQuiz` / `completeSurvival` trust client-supplied score/accuracy/averageTime/performanceBonus
**File:** `app/convex/games.ts:12-104` (`completeQuiz`), `107-193` (`completeSurvival`)

```ts
export const completeQuiz = mutation({
  args: { sport, score, totalQuestions, accuracy, averageTime, difficulty }, ...
```

The ELO calculation is derived from `args.score`, `args.accuracy`, and
`args.averageTime`. Nothing ties these to a server-owned session row.
`completeSurvival` additionally trusts `performanceBonus` (used to boost
`finalPerformance` up to the clamp). A malicious client can claim
`score=10, accuracy=1.0, averageTime=0.5` for any sport/difficulty and
receive maximum ELO gain on every submit.

**Why it matters:** ELO rankings are meaningless. Forge access gating,
achievements (`elo_champion` at 1500, `survival_legend` at 15), season
placements, decay cut-offs — all rely on ELO being honest.

**Suggested fix direction:** tie each mode to a server-authoritative session
(`quizSessions` already exists; per-answer results should accumulate
server-side in the session row). `completeQuiz` should take only the
`sessionId` and re-derive score/accuracy/averageTime from the session's
answer log. Refuse `performanceBonus` as a client arg — compute it
entirely from `survivalSessions.performanceBonus` on the server row.

---

### BLOCKER-4 — `getSession` queries leak the answer for Higher/Lower, VerveGrid, and Who Am I
**Files:**
- `app/convex/higherLower.ts:334-339` — returns full session including `playerBValue`
- `app/convex/verveGrid.ts:201-206` — returns full session including `cells[].validPlayerIds`
- `app/convex/whoAmI.ts:178-203` — returns `{...session}` which includes `answerName`

All three are public queries. Any authenticated (or anonymous) client with a
valid Convex deployment URL can call `api.higherLower.getSession({sessionId})`
and read the opposing value, the cell answer pool, or the mystery player name
directly from the response.

These queries aren't currently called from the frontend screens (verified
via grep), but they are exposed to the public API surface regardless.

**Why it matters:** perfect-score cheating on Higher/Lower, VerveGrid, and
Who Am I via a trivial API call. Bypasses all the curated-layer correctness
work.

**Suggested fix direction:** project each `getSession` return down to only
the fields the UI needs — mirror the pattern already used by
`survivalSessions.getSession` (which deliberately excludes `validPlayers`)
and `liveMatches.getMatch` (which strips `correctAnswer` during the active
question).

---

### BLOCKER-5 — Daily challenge `submitAnswer` has no attempt-ownership check and trusts `timeTaken`
**File:** `app/convex/dailyChallenge.ts:197-230`

```ts
export const submitAnswer = mutation({
  args: { attemptId, answer, correctAnswer, timeTaken },
  handler: async (ctx, { attemptId, answer, correctAnswer, timeTaken }) => {
    const attempt = await ctx.db.get(attemptId);
    ...
```

1. No `getAuthUserId()` check — any caller can submit on any attempt given
   the attemptId.
2. `timeTaken` is client-supplied; submitting `timeTaken: 0.5` always scores
   max (`100 * (10 - 0.5) / 9`).
3. `correctAnswer` is client-supplied (see BLOCKER-2).

`forfeit` and `completeAttempt` (same file, lines 232-260) have the same
missing ownership check.

**Why it matters:** griefing (forfeit someone else's daily attempt if you
leak their attemptId), plus the same leaderboard-fraud vector as BLOCKER-2
and BLOCKER-3. Daily leaderboard becomes un-curateable.

**Suggested fix direction:** every daily mutation must verify
`attempt.userId === await getAuthUserId(ctx)`. Derive `timeTaken` server-side
from `attempt.startedAt + questionIndex * question.startedAt` (or store per-
question start timestamps in the attempt row).

---

## High-severity

### HIGH-1 — Global leaderboard (`getLeaderboard` with no sport/mode) is not actually ranked by ELO
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

**Suggested fix direction:** either expose only sport+mode leaderboards
(which do use `by_sport_mode_elo`), or add a new `by_elo` index on
`userRatings` for the global case.

---

### HIGH-2 — `ensureProfile` short-circuits before setting the username — **RESOLVED**
**File:** `app/convex/users.ts:14-38`

Old handler returned early on any existing user doc, so the patch branch
setting `username` was dead code. Fixed alongside BLOCKER-1: the guard now
keys on whether `existing.username` is present, not whether the doc exists,
so first-time users receive a derived username exactly once and subsequent
calls remain no-ops.

---

### HIGH-3 — Username uniqueness is not enforced on profile create
**File:** `app/convex/users.ts:14-38`, schema at `schema.ts:8-21`

`ensureProfile` does no uniqueness check. Even after HIGH-2 is fixed, two
users can sign up with the same display name and end up both patched to the
same `username`. `users.getByUsername` uses `.first()` which returns an
arbitrary match, so challenges silently target the wrong user.

**Why it matters:** name collisions become a social-engineering vector
("create account with the same name as the target, accept their challenges
and forfeit them").

**Suggested fix direction:** on first-time patch, query
`ctx.db.query("users").withIndex("by_username", q => q.eq("username", x))`
and throw if non-empty. Force the UI to let the user pick again.

---

### HIGH-4 — No React ErrorBoundary anywhere in the tree
**File:** `app/src/App.tsx:37-78`; grep for `ErrorBoundary` returns zero hits.

Any uncaught throw inside any screen — a Convex mutation error not wrapped
in try/catch, a parse error on route state, a missing asset — white-screens
the entire app. The screens do catch known Convex errors via `toast.error`,
but nothing catches the unexpected.

**Why it matters:** one bad deploy or one unknown-shape response becomes a
total outage for that user session. Production should degrade to a friendly
error screen with a reset button.

**Suggested fix direction:** wrap `<Routes>` in an ErrorBoundary that logs
to Sentry/equivalent and renders a recovery screen.

---

### HIGH-5 — `eloDecay.runDecay` and `seasonManager.checkSeason` scan all user ratings in one mutation
**Files:**
- `app/convex/eloDecay.ts:11-70` — `const allRatings = await ctx.db.query("userRatings").collect();`
- `app/convex/seasonManager.ts:35` — same, then iterates inserts into `seasonHistory`

Convex mutations have a hard per-transaction cost ceiling. A single `collect()`
on `userRatings` with N users × M modes of data loads the whole table into
memory, then performs up to N patches + N inserts in the same transaction.
Season rollover also does per-user `seasonHistory` inserts.

**Why it matters:** the crons currently run daily. At ~10k rating rows the
mutation will time out, decay stops applying, season rollover fails halfway
through and leaves some users archived and others not. Hard to detect until
it happens.

**Suggested fix direction:** paginate via `ctx.scheduler.runAfter`. Have the
cron enqueue chunked internal mutations (e.g., 500 rows at a time, keyed by
a cursor). Season rollover already inserts into `seasonHistory`; the reset
step should likewise be chunked, not a single transaction.

---

### HIGH-6 — No TTL sweeper for expired game sessions
**Files:** `app/convex/schema.ts` — `quizSessions` (30m), `survivalSessions`
(1h), `higherLowerSessions`/`verveGridSessions`/`whoAmISessions` (1h),
`blitzSessions` (60s window). `crons.ts` only registers `season-check` and
`elo-decay-check`.

Every session mutation checks `Date.now() > session.expiresAt` and refuses
to act on stale rows, but nothing actually deletes them. At N concurrent
players per day × K modes the session tables grow unboundedly. Convex
charges for storage and index size.

**Why it matters:** slow storage cost creep; eventual index bloat hurts
latency of legitimate queries against those tables.

**Suggested fix direction:** add a cron (hourly is fine) that runs an
internal mutation paginating `expiresAt < Date.now()` and deleting. Batch
deletes in chunks of 100-500 to stay inside transaction limits.

---

### HIGH-7 — `verveGrid.searchPlayers` global fallback scans all football players on every keystroke
**File:** `app/convex/verveGrid.ts:122-136`

When `sessionId` or `cellIndex` is missing:

```ts
const players = await ctx.db
  .query("sportsPlayers")
  .withIndex("by_sport_name", q => q.eq("sport", sport))
  .collect();
```

Football slice is ~30k players. `.collect()` + in-memory `.toLowerCase().includes()`
on every character typed, for every user, for every search that loses the
session context. At Convex query costs this will dominate the bill.

**Why it matters:** latency and cost. Also, the "correct" path (with
sessionId + cellIndex) does the same `.map → ctx.db.query().first()` fan-out
per `validPlayerIds` which is bounded but still hot.

**Suggested fix direction:** add a prefix-lowercase index (e.g.
`by_sport_name_lower`) and use `withIndex(...).lte/gte` range for prefix
search. Cap search to `validPlayerIds` only — there's no legitimate reason
to search outside the active cell's eligible list.

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

In daily modes (`DailySurvivalScreen.tsx:95-106`) a single tab hide triggers
an immediate forfeit. On mobile Safari, the OS sends `visibilitychange
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

### LOW-1 — `docs/SURVIVAL_MODE_AUDIT.md` describes the deleted Python backend in §2 and §15
Stage 1 removed `backend/`. The Survival audit's Python implementation table
and "Complete File Reference" section still list `backend/sports/...`,
`backend/services/survival_session.py`, etc. Protected Survival scope — don't
change logic — but the doc should note those rows are historical/archival.

---

### LOW-2 — `docs/CONTRIBUTING.md` "Project Structure" still lists `backend/`, `frontend/`, `tests/`
**File:** `docs/CONTRIBUTING.md:73-96`. All three paths were deleted in
Stage 1. Refresh this section.

---

### LOW-3 — `docs/DESIGN_PROMPT.md` frames the app as "React Native + Expo"
**File:** `docs/DESIGN_PROMPT.md:6`. Repo has been Vite-only for months.

---

### LOW-4 — `docs/SECURITY.md` describes JWT auth
**File:** `docs/SECURITY.md`. Current auth is Convex Auth (Password +
Anonymous) — not JWT claims. Misleading to external researchers filing
security reports.

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
