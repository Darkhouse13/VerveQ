# Competitive Modes Current State

This is a current-state inventory of the live competitive/head-to-head surfaces
that a user can reach through the wired `app/` frontend today. It is grounded in
the route table, the shell nav, direct entry routes, and the Convex functions
those screens call.

Production runs the v2 shell (`VITE_V2_SHELL_ENABLED=true`). The v1 screens
still compile from source, but every v1 competitive route is wrapped in
`V2Redirect` / `V2ArenaCodeRedirect` and forwards to its `/v2` counterpart while
the flag is on, so v1 is a rollback seam and not a live surface. Where the two
differ, this document describes the v2 surface.

## Top-level reachability

- The shell nav exposes one competitive entry: `Compete` -> `/compete`
  (`app/src/components/shell/ShellNav.tsx`). There is no `Challenge` tab. The v1
  `BottomNav` still lists `Challenge` -> `/challenge`, but that route redirects
  to `/v2/duels` while the shell flag is on.
- The live head-to-head routes are `/v2/duels`, `/v2/duels/history`, `/v2/arena`,
  `/v2/arena/:code`, `/v2/rivals`, and `/v2/rivals/:opponentUserId`. All except
  `/v2/arena/:code` are wrapped in `ShellGate` + `UsernameOnlyRoute`, so a
  logged-out visitor onboards with `?next=` back to the surface instead of
  bouncing home.
- `/v2/arena/:code` carries no route guard: the screen onboards inline so a
  shared invite link never drops its lobby code.
- `/duel/:linkCode` is intentionally open and handles account and guest link
  recipients.
- Live Match and the older challenge invite flow no longer exist in any form;
  see "Removed subsystems" below.

## Challenge Arena

Reachable: yes.

Entry point: the dedicated Arena hub at `/v2/arena` (`ArenaHubScreen`), which
offers create and join-by-code; direct shared links use `/v2/arena/:code`. Old
`/arena/:code` links are forwarded code-intact by `V2ArenaCodeRedirect`.

Format: synchronous server-clocked room. The host creates a code, players join
the lobby, ready up, then the server runs countdown, question, reveal, round
break, and final phases. The room locks 5 rounds of 10 questions at start
(50 questions total). Current round categories are football quiz, general
knowledge, Which Came First, enterprise logos, and capital cities.

Player counts: modes are `1v1`, `2v2`, `ffa3`, `ffa4`, and `ffa5`, with
capacities 2, 4, 3, 4, and 5. Start requires at least 2 active players and no
more than the selected mode capacity; `2v2` also requires valid teams.

ELO: no. The arena code path does not write `userRatings`.

Persistence: arena state is stored in `arenas`, answers in `arenaAnswers`, and
recent question novelty in `arenaRecentlySeenQuestions`. Final podium/standings
are derived from arena answers. Arena rematch creates a new arena and stamps
`rematchArenaId` / `rematchArenaCode` on the finished room. It does not write
the async `rivalries` ledger.

Guest support: playing still requires a username, but `/v2/arena/:code` has no
route guard — the screen onboards inline so a shared invite link never drops its
lobby code. The `/v2/arena` hub is gated by `UsernameOnlyRoute`.

## Async Duels

Reachable: yes.

Entry point: the Duel hub at `/v2/duels` (`ChallengeScreen` rendered embedded in
`ShellLayout`) -> `New Duel`; existing duels are listed on the same hub in
`Your turn`, `Awaiting opponent`, and `Resolved`. `/duel/play/:duelId` and
`/duel/result/:duelId` are shared routes — they are not redirected by the shell
flag and stay gated by `UsernameRequiredRoute`. Share links use
`/duel/:linkCode`; `/duels/history` forwards to `/v2/duels/history`.

Format: asynchronous 1v1. The creator chooses Sports trivia, Knowledge, or
Which Came First, then topic/category, difficulty, and opponent. Opponents can
be selected from rivals, by username lookup, or through a one-shot share link.
Each duel locks 10 questions server-side. Players answer independently; there
is no shared live room, but per-question score still uses server `servedAt`
timing.

Player counts: exactly 2 logical sides: challenger and opponent. The opponent
can be a target account or the first valid link claimant.

ELO: no. Async duel resolution does not update `userRatings`.

Persistence: duel state and per-question results live on `duels`. Account vs
account duel resolution writes the `rivalries` ledger once via
`rivalryAppliedAt`; link guest results defer rivalry application until the guest
result is attached to a real account. Duel notifications feed the Challenge tab
badge.

Guest support: creation and account-targeted play require a username account.
The share-link route `/duel/:linkCode` supports unauthenticated/local-guest
recipients with a guest token, and can later attach the result to a new account.

## Rivalries

Reachable: yes, when the user has a username account.

Entry point: the Duel hub shows a top rivals strip when rivalries exist, plus a
`Rivals` card; full list is `/v2/rivals`, and detail is
`/v2/rivals/:opponentUserId`. The v1 `/rivals` forwards to `/v2/rivals`, but
`/rivals/:opponentUserId` is not redirected and still renders the v1 detail
screen under `UsernameRequiredRoute`.

Format: not a gameplay mode. Rivalries are the head-to-head ledger produced by
resolved async duels. The list shows opponent records, W-L-D, active streak,
and last-duel recency. Detail shows the oriented record, streak, and rematch
actions.

Player counts: 1v1 pair ledger only.

ELO: no. Rivalries display duel W-L-D/streaks and do not read or write
`userRatings`.

Persistence: `rivalries` stores canonical account pairs, wins/losses/draws,
current streak, `lastDuelId`, and `updatedAt`. Detail rematch calls
`duels.rematch` from the last duel.

Guest support: no direct guest rivalry screen. Guest link-duel results only
enter the rivalry ledger after the guest creates/signs into an account and the
result is attached.

## Removed subsystems

These are gone from the codebase — not dormant, not retained, not awaiting
cleanup. Nothing in this list has a module, route, cron, or table left.

- **Live Match** (removed 2026-07, `7de7662`). `app/convex/liveMatches.ts` is
  deleted, so `getActiveMatch`, `createFromChallenge`, `abandonWaitingMatch`,
  and `reapStaleMatches` no longer exist. The `live-match-stale-check` cron is
  gone from `app/convex/crons.ts`. The `/live-match` and `/waiting-room` routes
  were removed from `app/src/App.tsx` and now fall through to `NotFound`. The
  mode had been unstartable since the challenge subsystem went, and the
  `liveMatches` table removal is recorded at `app/convex/schema.ts:635-640`.
  `ChallengeScreen` no longer calls `getActiveMatch` or redirects into a waiting
  room (`app/src/pages/ChallengeScreen.tsx:76-77`).
- **The synchronous challenge invite subsystem** (removed 2026-07, `896a47a`).
  `app/convex/challenges.ts` is deleted, so `challenges.getPending`, `create`,
  `accept`, `decline`, and `createRematch` no longer exist. The `challenges`,
  `challengeHeadToHeads`, and `challengeMatchHistory` table removals are
  recorded at `app/convex/schema.ts:198-201`. It never had a production entry
  point.
- **`multiplayerMatches`** (removed 2026-07). The pre-arenas beta lobby table
  had no writer anywhere; removal is recorded at `app/convex/schema.ts:631`.

Orphaned rows for any of the above on older deployments are unvalidated and are
purgeable from the Convex dashboard.

ELO consequence: none of the three head-to-head surfaces inventoried above
writes `userRatings`. Live Match was the only head-to-head path that applied
ELO, and it is gone; Arena, async duels, and rivalries all leave `userRatings`
untouched. Solo modes still write it through `games.ts`.

## Open question: overlapping 1v1 paths

This section lists the overlap only; choosing one product direction is a
product call.

| Path | Sync/async | Players | Content/format | ELO | Persistence |
| --- | --- | --- | --- | --- | --- |
| Arena `1v1` | Sync | 2 account players | 5 rounds x 10 shared live questions; mixed arena categories; code lobby and rematch | No | `arenas` + `arenaAnswers`; no rivalry ledger |
| Async Duel | Async | 2 sides; account/account or account/link guest | 10 locked questions; sports, knowledge, or Which Came First; no shared live room | No | `duels`; async `rivalries` ledger for account-backed results |

Legacy Live Match previously occupied a third row here. It was removed in
2026-07 and is no longer part of the overlap.
