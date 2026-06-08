# Low-Friction Username-Only Onboarding

Priority: make shared Arena links playable after only a username, while keeping ranked ELO and global leaderboards full-account only.

## Current State Findings

- Convex Anonymous is registered in `app/convex/auth.ts`, but the app's guest button does not call it. `AuthContext.loginAsGuest()` only sets `sessionStorage.verveq_guest_session`, returns local user id `guest_tab`, and tests assert no Convex `signIn` or profile write. Today "guest" has no server identity.
- A real Convex anonymous session would satisfy `getAuthUserId` / `requireUserId`. If the anonymous user then had `username` and `isGuest: false`, the current `UsernameRequiredRoute` would allow it. Without that patch, `isAnonymous: true` is treated as guest and the route blocks. Current `users.ensureProfile` also rejects `isGuest: true`, so username-only needs a dedicated attach path.
- Usernames live on `users.username`, indexed by non-unique `by_username`. `users.ensureProfile` normalizes to `[a-z0-9_]{3,24}`, rejects detected duplicates by exact index lookup plus case-insensitive scan, then patches the user. This still leaves audit HIGH-3: no schema/database-level uniqueness guarantee, so concurrent claims need fail-closed server hardening.
- Arena route `/arena/:code` is wrapped in `UsernameRequiredRoute`. Inside `ChallengeArenaScreen` there is logic to redirect unauthenticated users to `/?from=arena&code=CODE`, but the outer route gate likely intercepts first and sends them to `/` without the code. For current guests, the gate shows a signup CTA with `from=guest`, also losing the code. The screen auto-joins by code only after a username user reaches it.
- Ranked/global eligibility is not centralized. Quiz/survival write `userRatings` in `games.ts`; live match writes ELO in `liveMatches.ts`; leaderboard reads `userRatings` and only filters `gamesPlayed > 0`; season reset archives every `userRatings` row; Blitz has its own `blitzScores` leaderboard. None exclude `isAnonymous` / `isGuest` today.
- No local `RANKING_V2_DESIGN` file was present, so this reconciles against the stated rule: anonymous/username-only users are excluded from ranked ELO and ranked/global leaderboards.

## Proposed Model

- Replace tab-local guest with real Convex anonymous auth for username-only onboarding.
- Add a username-only attach flow:
  1. Client calls `signIn("anonymous")`.
  2. Client calls a server mutation to claim a normalized username for that anonymous `userId`.
  3. Server patches the user with `username`, `displayName`, `isGuest: false`, and leaves `isAnonymous: true` as the durable ranked-exclusion signal.
  4. Frontend treats this as `usernameOnly`, not `guest`.
- Add full-account upgrade later with Convex Auth account linking, preserving the same `users` doc and non-ranked progress. Ranked ELO starts only after upgrade; do not backfill anonymous results into ranked history.

## Mode Set

Username-only playable:

- Challenge Arena host, join, rematch, and final-share flow.
- Shared link duel participation, with existing guest-token flow replaced or bridged to username-only identity.
- Casual/social score modes without ranked writes: Blitz play, Higher/Lower, VerveGrid, Who Am I. Their public scoreboards must exclude username-only users unless we explicitly label a separate unranked board.

Full account required:

- Ranked Quiz and Survival ELO.
- Global ELO leaderboard, season history, ranked profile stats, ELO decay.
- Daily Challenge official leaderboard/streaks.
- Forge submissions/voting.
- Rival search, persistent challenge/rivalry records, and live head-to-head ELO.

## Arena Invite Flow

Shared link headline flow:

1. User opens `/arena/:code`.
2. If no Convex session, show username-only onboarding in the Arena context, preserving `code`.
3. Submit username -> anonymous Convex sign-in -> server username claim -> navigate back to `/arena/:code`.
4. `ChallengeArenaScreen` calls existing `challengeArenas.join({ code })`.
5. Invite context is scoped to that lobby code only. It does not grant ranked access or broad account privileges.

The implementation should move the onboarding redirect ahead of `UsernameRequiredRoute` for `/arena/:code`, or replace the route gate with an Arena-aware gate that preserves the code.

## Guardrails

- Ranked fail-closed: add a shared backend helper such as `assertRankedEligibleUser(ctx, userId)` / `isRankedEligibleUser(ctx, userId)`. It must return false for `isAnonymous: true`, `isGuest: true`, missing user, or missing full-account auth marker. Use it before any ELO write and in leaderboard/season/archive reads.
- No anonymous ranked rows: if a username-only user reaches a ranked completion mutation, throw before `userRatings`, `gameSessions` ranked rows, or season history writes. Arena remains unranked.
- Username uniqueness: stop direct `users.username` patching from signup/onboarding. Route all claims through one server mutation that normalizes, checks claim/user indexes, writes an ownership claim, re-reads, and fails closed if zero or multiple owners exist. Ambiguous usernames are unavailable until operator cleanup; no auto-suffixing.
- Rate limit anonymous onboarding: at minimum throttle username claim attempts per anonymous `userId`, per invite code, and per browser nonce. Add edge/IP limiting if we expose anonymous creation to high traffic.
- Invite scope: onboarding launched from `/arena/:code` stores only that code and attempts only that join. Expired, full, or non-lobby rooms fail with normal Arena errors.
- Upgrade safety: account linking must keep the same `userId`; if linking would create a second user or collide with an existing email account, fail and ask the user to sign in instead.

## Implementation Slices

Backend:

- Auth identity: add anonymous sign-in entry point and `users.claimUsernameOnly` / `users.upgradeUsernameOnly` design; keep password signup protections intact.
- Username hardening: add claim table/indexes and tests for duplicate, case-insensitive duplicate, retry/idempotency, and detected race ambiguity.
- Ranked gate: guard `games.ts`, `liveMatches.ts`, `leaderboards.ts`, `seasonManager.ts`, Blitz high scores, and profile ranked stats.
- Arena access: allow username-only users in `challengeArenas.create/join/start/...` while keeping Arena unranked.
- Upgrade: link password/email credentials to the anonymous user doc and preserve progress.

Frontend:

- Auth state: split `guest` into `anonymousNoUsername`, `usernameOnly`, and `fullAccount`.
- Username-only screen/modal: one username field, inline duplicate/invalid errors, no password/email.
- Arena route: preserve code through onboarding, then return and auto-join.
- Upgrade UI: prompt only when entering ranked/full-account surfaces.
- Mode gates: username-only allowed for the proposed playable set; full-account CTA for ranked/Forge/daily/rivals.

## Decisions Needing Sign-Off

- Mode set: confirm username-only should include Arena host+join, shared-link duels, Blitz play, Higher/Lower, VerveGrid, and Who Am I; confirm Quiz/Survival remain full-account ranked only.
- Username collision policy: reject exact/case-insensitive duplicates with no auto-suffixing; ambiguous race state makes the username unavailable.
- Ranking policy: username-only progress is unranked and not backfilled into ELO/global leaderboards after upgrade.
- Rate-limit depth: start with per-anonymous-user/invite/browser nonce, or require edge/IP limiting before launch.
- Upgrade carryover: carry Arena history and unranked/casual progress, but not ranked ELO, season history, daily leaderboard entries, or Forge authority.
