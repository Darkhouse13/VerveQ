# Open bugs — web app

Found 2026-11-04 while taking stock of the web app for the Android app plan.
Each item was checked against the code (and prod data where noted). Paths are
relative to `app/`.

**Status 2026-11-04 (fix pass):** code fixes for #1, #2, #4, #6 are in the
working tree, tested, **not committed and not deployed**. Nothing reaches
players until the owner approves a `npx convex deploy` (PROD) and the web
deploy. #5 and #6 also need one seed run on PROD after that deploy (below).
#7 fixed. #3 and #8 documented.

**Owner steps to ship (in order, all need your go-ahead):**
1. From `app/`: `npx convex deploy` (PROD — ships #1, #2, #4 backend, #5/#6 seed code).
2. From `app/`: `npx convex run seedAchievements:seed --prod` — idempotent:
   inserts the missing `the_architect` row and rewrites `dedicated_player`'s
   description to "Play 50 ranked games". Expected result
   `{ seeded: 1, updated: 1 }`. Touches no unlocks.
3. Ship the web frontend as usual (CI) — the heartbeat, "Away" badge and new
   badge copy are frontend changes.

Severity: P1 wrong behavior · P2 broken but low reach · P3 docs/nit.

**Rules for the fixing agent**
- `npx convex deploy` deploys to **PROD** (`different-lynx-153`). Do not deploy
  or write to prod data without the owner's go-ahead.
- Don't change the look of the web app (it was just redesigned 2026-10-22).
  These are logic fixes.
- Add a test for each fix where the repo already has a contract test nearby
  (`src/test/*Contract.test.ts`).

---

## 1. P1 — "Quiz Master" achievement can never be unlocked

**Status: FIXED (code, not deployed).**


- **Where:** `convex/achievements.ts` `checkAndUnlock` (the `checks` list, ~line 81).
- **What:** `quiz_master` is defined in `convex/seedAchievements.ts` (requirement
  `max_quiz_accuracy` = 100) and exists in the prod `achievements` table, but
  `checkAndUnlock` never checks it. Prod has 0 unlocks.
- **Why it's not a one-liner:** the check reads `userRatings`, which has no
  accuracy field. The fix needs the per-game result: either check at quiz
  completion (`games.completeQuiz`, score = questions answered) or store a
  best-accuracy value on the rating row.
- **Fix:** `checkAndUnlock` now checks `quiz_master` against `gameSessions`
  (every finished ranked game is logged there, so earlier perfect quizzes
  count too). Rule in `convex/lib/achievementRules.ts`: mode `quiz`, at least
  10 questions, every answer right. Test: `src/test/achievementRulesContract.test.ts`.

## 2. P1 — Rivals page is always empty for username-only players

**Status: FIXED (code, not deployed).**


- **Where:** route `/rivals` and `/rivals/:opponentUserId` in `src/App.tsx`
  (~line 317) use `UsernameOnlyRoute`; the server in `convex/rivalries.ts`
  returns `null` / `{ rivalries: [] }` unless both players are full accounts
  (`isRankedEligibleUserId`, lines 41, 45, 72, 89).
- **What:** username-only players can open the page and play duels, but never
  see a rival. They get an empty state with no explanation.
- **Owner ruling 2026-11-04:** let username-only players have rivalries.
- **Fix:** new `isRivalryEligibleUserDoc` in `convex/lib/authz.ts` (claimed
  username, not a guest; nameless anonymous sessions stay out). Used by both
  reads (`convex/rivalries.ts` get + listMine) and the write when a duel
  resolves (`convex/duels.ts` applyRivalryOnce). Test: new case in
  `src/test/duelLifecycleIntegration.test.ts`. Duels that already resolved
  between username-only players before the deploy were marked applied without
  a ledger row; they won't be backfilled.

## 3. P1 — Async duels almost never finish (verify the flow end to end)

**Status: DOCUMENTED — backend lifecycle proven; web browser walk still open.**


- **Prod data, last 90 days:** 41 duels created → 34 expired, 6 waiting,
  **1 resolved**.
- **What's unknown:** whether this is people not playing, or a broken step.
  `docs/CHALLENGE_DUELS.md` says the real-browser two-player walk was never
  done.
- **Task:** walk the full flow with two browsers (one signed in, one logged
  out): create a link duel at `/duels` → open `/s/d/:linkCode` →
  `/duel/:linkCode` → play as guest → sign up → `attachGuestResult` → result
  for both sides → rematch. Fix anything that breaks. If it all works, write
  that down in `docs/CHALLENGE_DUELS.md` and close this item.
- **2026-11-04:** the backend lifecycle was run end to end on DEV by the
  Android app work (two sessions: create link duel → play → share → open link
  → play → resolve → shows in `listMine`). Recorded in
  `docs/CHALLENGE_DUELS.md`. No backend bug. What's left is a two-browser walk
  of the **web** landing (`/s/d/:code` → `/duel/:code`); no test renders that
  page. The low completion rate is most likely people not playing (only one
  link per duel, 72 h window, no reminder) — push reminders in the Android app
  target exactly this.

## 4. P2 — Arena has no presence: `heartbeat` is never called

**Status: FIXED (code, not deployed).**


- **Where:** `convex/challengeArenas.ts` `heartbeat` (~line 2376) writes
  `lastSeenAt`; nothing in `src/` calls it.
- **What:** a player who closes the tab stays listed as in the room. Others
  can't tell who has left; only `leave` or being unready at force-start
  removes someone.
- **Fix:** call `heartbeat` on an interval from
  `src/pages/shell/play/ArenaPlayScreen.tsx` while the room is open, and show
  players with a stale `lastSeenAt` as disconnected. (The Android app will
  need the same thing.)
- **Also needed (2026-11-04, Android app):** `getRoom` does not return each
  player's `lastSeenAt`, so no client can show "Away". Expose it (or a derived
  `away: boolean`) in getRoom's player shape. The Android app already sends
  `heartbeat` every 15 s while a room is open.
- **Fix:** `getRoom` returns `players[].lastSeenAt` and a top-level `serverNow`
  (`convex/challengeArenas.ts`). The web room heartbeats every 15 s while the
  tab is visible and the room isn't final/abandoned
  (`src/pages/shell/play/ArenaPlayScreen.tsx`). The lobby roster shows a muted
  "Away" badge (existing NeoBadge muted style, no redesign) after 45 s without
  a beat (`isArenaPlayerAway` in `src/lib/arena.ts`; copy `arenaRoom.away` in
  en/fr/es). Tests: `src/test/arenaPresenceContract.test.ts` + a new case in
  `src/test/arenaLifecycleIntegration.test.ts`.

## 5. P2 — "The Architect" achievement is missing from prod

**Status: NEEDS OWNER — code ready; one seed run on PROD (step 2 above).**


- **Where:** `convex/seedAchievements.ts` defines `the_architect` (a Forge
  question approved); the prod `achievements` table has the other 7 but not
  this one.
- **What:** `checkAndUnlock` can still insert the unlock, but there's no
  definition row to show it on the profile.
- **Fix:** the seed (`convex/seedAchievements.ts`) is idempotent — it only
  inserts missing ids — and now also refreshes a row's name/description when
  the copy changed. Re-running it on PROD inserts `the_architect`. Not run
  (prod write): see owner step 2 at the top.

## 6. P3 — "Dedicated player" counts only ranked games

**Status: FIXED (code, not deployed) + seed run on PROD needed.**


- **Where:** `convex/achievements.ts` — `totalGames` sums `userRatings.gamesPlayed`,
  which only Quiz and Survival write.
- **What:** the badge says "50 games" but daily games, Career Path, Who's
  Older, Missing Letters, Arena etc. don't count. Prod: 2 unlocks.
- **Owner ruling 2026-11-04:** reword, don't change the counting.
- **Fix:** "Play 50 ranked games" in the seed and in en/fr/es
  (`shell.json` → `dedicated_player.desc`: "Play 50 ranked games" /
  "Joue 50 parties classées" / "Juega 50 partidas clasificatorias"). The PROD
  `achievements` row updates on the seed run (owner step 2).

## 7. P3 — Arena doc points to a deleted file

**Status: FIXED.**


- **Where:** `docs/CHALLENGE_ARENA.md` ~line 270 refers to
  `app/src/pages/ChallengeArenaScreen.tsx` and `V2ArenaCodeRedirect`; neither
  exists. Play now lives in `src/pages/shell/play/ArenaPlayScreen.tsx`, views in
  `src/pages/arena/`.
- **Fix:** update the doc.

## 8. P2 — Weekend player club looks wrong for some players (data check)

**Status: DOCUMENTED — the example is provider data, not our bug.**


- **Seen 2026-11-04** while drawing the Android mockups from prod `fantasyPlayers`:
  e.g. Barcola listed at Liverpool. Other prices/clubs may have the same drift.
- **Task:** compare `fantasyPlayers` club assignments against the provider
  squad feed (`fantasySquadReconcile.ts`) and list mismatches. Read-only
  first; any prod fix needs the owner's go-ahead.
- **Findings (read-only, PROD, 2026-11-04):** `fantasyPlayers` has 5,676 rows.
  Barcola (`providerPlayerId` 161904) has `clubId` 40 (Liverpool) because the
  API-Football transfer feed reported **PSG (85) → Liverpool (40)** on
  2026-08-29/30; two `fantasyTransferEvents` rows record it (one superseded),
  and the transfer sweep applied it as designed. So our pipeline matches the
  provider. Whether the provider is right is the open question.
- **Next step (not done, needs API-Football calls):** for each active
  `fantasyPlayers` row, compare `clubId` with the provider's current
  `/players/squads?team=` lists (what `fantasySquadReconcile.ts` already
  fetches on Thursdays) and list players whose provider squad differs. Run it
  as a read-only script against PROD data with the provider key; no writes.

## 9. LOW (storage) — finished ranked quiz sessions are never deleted

- **Seen 2026-11-05** (perf/security loop, round-5 review): the hourly cleanup
  (`convex/maintenance.ts`) only deletes expired *unfinished* or abandoned
  `quizSessions`; completed rows are kept forever, so the table only grows.
  Not a hot-path cost (every hot read is by id or by a bounded index range),
  only storage.
- **Constraint for any fix:** the one-time Quiz Master backfill
  (`convex/lib/achievementUnlock.ts`, guarded by `users.quizMasterBackfilled`)
  scans a user's past ranked sessions. Deleting completed sessions must either
  wait until that user is backfilled, or first record the facts the backfill
  needs (a perfect run) on the user / `gameSessions`.
- **Suggested fix:** a windowed cron that deletes completed sessions older than
  N days only for users with `quizMasterBackfilled = true`.

## 10. P1 — Signing in from a guest session keeps the guest until reload

**Status: FIXED (code, not deployed) — found 2026-11-08 in the Android app;
reproduced on the web the same night (DEV, Playwright): guest → `/?mode=signin`
→ sign in → `/quiz` showed "Ranked needs an account" until a reload.**

- **Cause (library behaviour, `@convex-dev/auth` 0.0.96 + `convex` 1.40):**
  `signIn("password")` while a guest (anonymous) session is active stores the
  new tokens, but auth stays "signed in" the whole time. `ConvexProviderWithAuth`
  only calls `client.setAuth` again when auth goes signed-out → signed-in
  (`convex/dist/esm/react/ConvexAuthState.js`, effect deps), so the live
  connection keeps the guest's JWT until it expires (~1 h) or the page reloads.
  `users.me` keeps returning the guest. Server side is correct (checked on DEV:
  a guest-token `auth:signIn` returns the account's tokens and `me` resolves
  to the account).
- **Who hits it on the web:** anonymous-first is live, so every new browser
  holds a guest session before the player taps "Sign in".
- **Android fix (mobile/src/lib/auth.tsx):** after a successful password
  sign-in, remount `ConvexAuthProvider` (a `key` bump) so it reconnects with
  the stored account token.
- **Web fix:** `AuthContext.signIn` calls `onAccountSwitch()` after a successful
  `convexSignIn("password")`; `App.tsx` re-keys `ConvexAuthProvider`
  (`src/contexts/accountSwitch.ts`). The router reads the URL, so the player
  stays on the page. Re-run of the same Playwright walk: Ranked opens at once.
  Test: `src/test/authContract.test.ts` ("restarts the auth layer…"). Ships with
  the next web deploy (owner go-ahead).
