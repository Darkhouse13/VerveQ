# Competitive Modes Current State

This is a current-state inventory of the live competitive/head-to-head surfaces
that a user can reach through the wired `app/` frontend today. It is grounded in
the route table, bottom nav, `ChallengeScreen`, direct entry routes, and the
Convex functions those screens call.

## Top-level reachability

- Bottom nav exposes one competitive entry: `Challenge` -> `/challenge`.
- `/challenge` is wrapped in `UsernameRequiredRoute`, so a guest is stopped at
  the username-required screen before the Challenge hub renders.
- `HomeScreen` does not link to `/challenge`, `/arena/*`, `/duel/*`,
  `/rivals/*`, `/waiting-room`, or `/live-match`. The "Which Came First?"
  card on Home is a solo quiz entry
  (`/difficulty?sport=knowledge&mode=came_first`), not an async duel entry.
- The Challenge hub surfaces Arena create/join, async duel creation/inbox, and
  the rivals list/detail entry.
- `/duel/:linkCode` is intentionally open and handles account and guest link
  recipients. `/duel/play/:duelId`, `/duel/result/:duelId`, `/arena/:code`,
  `/rivals`, `/rivals/:opponentUserId`, `/waiting-room`, and `/live-match`
  require a non-guest account route.
- `ChallengeScreen` calls `liveMatches.getActiveMatch` and redirects to
  `/waiting-room?matchId=...` if an active legacy live match already exists.

## Challenge Arena

Reachable: yes.

Entry point: bottom nav `Challenge` -> `/challenge` -> Challenge Arena card
`Create` or `Join code`; direct shared links use `/arena/:code`.

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
the async `rivalries` ledger or the legacy `challengeHeadToHeads` ledger.

Guest support: no. The route requires a username account; unauthenticated arena
links redirect to login/signup and local guest sessions are redirected to signup.

## Async Duels

Reachable: yes.

Entry point: bottom nav `Challenge` -> `/challenge` -> `New Duel`; existing
duels are listed on the same hub in `Your turn`, `Awaiting opponent`, and
`Resolved`. Direct routes are `/duel/play/:duelId`, `/duel/result/:duelId`, and
share links at `/duel/:linkCode`.

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

Entry point: the Challenge hub shows a top rivals strip when rivalries exist,
plus a `Rivals` card; full list is `/rivals`, and detail is
`/rivals/:opponentUserId`.

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

## Legacy Live Match and Older Challenges (Deprecated/Dormant)

Reachable: dormant legacy only. Live Match is deprecated and is not a supported
way to start play. The route and waiting room remain so an already-active legacy
match can resolve safely, but the older challenge send/accept flow is not
exposed as a normal first-entry UI today.

Entry point: route-level entries are `/waiting-room?matchId=...` and
`/live-match?matchId=...`. The Challenge hub also auto-resumes an existing
active live match through `liveMatches.getActiveMatch`. There is no current
frontend mutation path that creates a new legacy live match: the old
`ResultScreen` rematch glue after a `mode: "challenge"` result is disabled and
no longer calls `challenges.createRematch`, `challenges.accept`, or
`liveMatches.createFromChallenge`.

Format: synchronous 1v1 live match. It has a waiting room, both-player ready
state, countdown, 10 live questions, 10-second question windows, round result
screens, heartbeat/stale-player forfeit handling, and tab-switch forfeit from
the live match UI.

Make-safe behavior: `/challenge` auto-resume can still send a user into an
already-active legacy waiting room. If the other player never appears,
`liveMatches.reapStaleMatches` runs from the `live-match-stale-check` cron and
finalizes stale active matches using the 15-second heartbeat cutoff. Waiting
matches do not apply ELO. The waiting room now has an explicit exit that
abandons an unstarted legacy match and returns home, and it sends the user home
if the backend has already finalized the match. Once a match reaches live play,
the Live Match UI still has manual forfeit and completed/forfeited matches still
route to Results, which has a Home exit.

Player counts: exactly 2 account players.

ELO: yes in backend. Completed matches call `updateMatchElo`; forfeits apply
ELO once the match has moved past `waiting`. The current live-match result
navigation passes `eloChange: null`, so the match result screen does not show
the applied ELO delta.

Persistence: `liveMatches` stores the active/completed match. When finalized,
the backend updates the source `challenges` row, writes `challengeMatchHistory`,
writes/updates `challengeHeadToHeads`, and updates `userRatings` when ELO
applies. This ledger is separate from async duel `rivalries`.

Guest support: no. `/waiting-room` and `/live-match` require a username account,
and `liveMatches` participants are account user IDs.

Older Challenges surfacing: hidden/superseded for normal entry. Backend
functions still exist for `challenges.getPending`, `challenges.create`,
`challenges.accept`, and `challenges.decline`, but `app/src` no longer renders
a pending challenges table, a send-challenge form, or accept/decline controls
from the Challenge tab. `ResultScreen` no longer contains legacy rematch glue,
so a completed Live Match result cannot spawn a new un-startable Live Match.

Future cleanup: remove the legacy routes, `challenges` invite lifecycle, and
`liveMatches` creation/result plumbing once product decides the retained data
and ELO history no longer need those code paths.

## Backend paths wired but not surfaced in current UI

- `challenges.getPending`, `challenges.create`, `challenges.accept`, and
  `challenges.decline` are exported backend functions for the old challenge
  invite lifecycle, but they have no current Challenge hub UI.
- `liveMatches.createFromChallenge` is exported for retained legacy plumbing,
  but there is no current frontend call site and no current pending-challenge
  inbox UI that calls it.
- `liveMatches.abandonWaitingMatch` exists only as a safe-exit mutation for
  unstarted legacy waiting rooms; it does not start a match or apply ELO.
- `challengeHeadToHeads` and `challengeMatchHistory` are maintained for legacy
  live matches, but the reachable `/rivals` screens read the async duel
  `rivalries` table instead.
- `multiplayerMatches` exists in the schema, but no current `app/src` UI or
  Convex function call site references it.

## Open question: overlapping 1v1 paths

This section lists the overlap only; choosing one product direction is a
product call.

| Path | Sync/async | Players | Content/format | ELO | Persistence |
| --- | --- | --- | --- | --- | --- |
| Arena `1v1` | Sync | 2 account players | 5 rounds x 10 shared live questions; mixed arena categories; code lobby and rematch | No | `arenas` + `arenaAnswers`; no rivalry ledger |
| Legacy Live Match (deprecated/dormant) | Sync | 2 account players | 10 shared live questions from a retained `challenges` invite; no normal start path; waiting room and ready flow retained only for active legacy matches | Yes, backend applies it after start; waiting abandon/stale resolution does not | `liveMatches`, `challenges`, `challengeMatchHistory`, `challengeHeadToHeads`, `userRatings` |
| Async Duel | Async | 2 sides; account/account or account/link guest | 10 locked questions; sports, knowledge, or Which Came First; no shared live room | No | `duels`; async `rivalries` ledger for account-backed results |
