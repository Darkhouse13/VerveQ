# VerveQ auth

The live model is **username-only onboarding with an in-place upgrade to a
full account**. A visitor gets a real (anonymous) server identity first,
claims a username second, and attaches an email + password later — keeping
the same `users` doc, username, and casual progress throughout.

Everything below describes what ships. Production runs the v2 shell
(`VITE_V2_SHELL_ENABLED=true`), so the v2 onboarding screens are the live
surface and `LoginScreen` is a secondary entry — see "Entry surfaces".

## Providers

Configured in [`app/convex/auth.ts`](../app/convex/auth.ts):

- **Anonymous** — a real Convex session with a server-side identity, not a
  client-side pretend-guest. It is a hand-rolled
  `ConvexCredentials({ id: "anonymous" })`, **not** the stock Convex Auth
  Anonymous provider: `authorize` requires a single-use IP permit
  (`getAnonymousOnboardingIpPermitParam` →
  `consumeAnonymousOnboardingIpPermit`) and refuses to mint a session
  without one. The created doc carries `isAnonymous: true` and the permit
  id. It does **not** set `isGuest`.
- **Password** — real email + password, hashed with Scrypt. Password reset
  goes through an email-delivered OTP (see below).

There is no account-takeover vector via reset: anonymous users have no
email, so no reset code can be addressed to them.

## Account model

Four states, derived in `AuthContext` **only** from the server `users.me`
doc — never guessed client-side. `AccountState` is the union
`loading | loggedOut | needsUsername | usernameOnly | fullAccount`.

| State | Means | Derivation |
|-------|-------|------------|
| `loading` | `me` has not resolved yet | no `user` and auth still settling |
| `loggedOut` | no Convex session | no `user` |
| `needsUsername` | signed in (usually anonymous) with no usable username yet | `user` present, neither of the below |
| `usernameOnly` | anonymous **with** a username — plays casual, excluded from ranked | `isAnonymous && hasUsername` |
| `fullAccount` | non-anonymous with a username — ranked-eligible | `!isAnonymous && hasUsername` |

`hasUsername` requires `user.isGuest !== true` and a server-stored username
that passes `isValidUsername`. A tab-local guest (below) has no server
identity and therefore reports `loggedOut`, by design.

Route guards in
[`ShellRouteGuards.tsx`](../app/src/components/shell/ShellRouteGuards.tsx)
consume exactly this split:

- `UsernameOnlyRoute` — casual/social modes; any user with a username,
  anonymous or full.
- `FullAccountRoute` — ranked modes; only `isFullAccount`.

Server-side, [`app/convex/lib/authz.ts`](../app/convex/lib/authz.ts) is the
matching authority, so a direct function call cannot bypass the client
guard.

## The onboarding path

1. **`startAnonymousSession()`** — fetches an IP permit from the
   `/anonymous-onboarding/ip-permit` HTTP action, then
   `signIn("anonymous", { … })`. Clears any tab-local guest flag first.
   → state becomes `needsUsername`.
2. **`claimUsername(username, { inviteCode? })`** — calls
   `users.claimUsernameOnly`. Uniqueness is enforced by a real claims table,
   not a naming convention (see "Username uniqueness"). Rate-limited per
   user / device nonce / invite (`USERNAME_ONLY_RATE_LIMITS` in
   [`users.ts`](../app/convex/users.ts)). → state becomes `usernameOnly`.
3. **`upgradeAccount(email, password, displayName?)`** — attaches
   credentials to the *same* user doc. → state becomes `fullAccount`.

Ranked history is not backfilled on upgrade; ranked simply starts once the
account is full.

## Guest → account upgrade

**This is implemented and live.** `upgradeAccount` in `AuthContext` validates
email shape, rejects the legacy `@verveq.local` domain, and applies the
shared password policy client-side, then calls the
`users.upgradeUsernameOnly` mutation. Failures map to the
`upgrade_unavailable` error code.

`users.upgradeUsernameOnly` deliberately **hand-rolls** the credential link
rather than using Convex Auth's `linkAccount`:

1. Requires the caller to be `isAnonymous === true` **and** already hold a
   usable username; anything else is rejected.
2. Re-validates email and password server-side (the client check is not
   trusted).
3. Rejects the upgrade if an `authAccounts` row already exists for that
   email — surfaced as `email_taken`.
4. Hashes with `new Scrypt().hash(...)` and inserts the `authAccounts` row
   directly.
5. **Re-reads the index after the insert** and, if the email is no longer
   uniquely held by this account, deletes its own row and aborts. This is
   the race guard: two concurrent upgrades of the same email cannot both
   win.
6. Patches the user doc: sets `email`, resolves `displayName`, and flips
   `isGuest: false` and `isAnonymous: false` — the single write that moves
   the account from `usernameOnly` to `fullAccount`.

The UI is `UpgradeAccountForm`, rendered by `UpgradeScreen` (`/v2/upgrade`).
Behaviour is locked by `app/src/test/guestUpgradeContract.test.tsx`.

## Entry surfaces

| Surface | What it is |
|---------|-----------|
| `WelcomeScreen` (`/v2/welcome`) | The onboarding card — `UsernameOnlyOnboarding`. |
| `ColdEntryScreen` (`/`) | Signed-out cold visitors: instant taste round, deferred username ask. |
| `ArenaPlayScreen` | Onboards **inline** so a shared invite link never drops its lobby code. |
| `UpgradeScreen` (`/v2/upgrade`) | `UpgradeAccountForm`. |
| `LoginScreen` (`/`) | Email/password + reset. With the v2 shell on, it mounts only for an explicit auth intent (`?mode=` / `?from=`); it is not the default entry. |

**`loginAsGuest()` is a legacy tab-local seam, not the anonymous provider.**
It signs *out* of Convex and sets a `sessionStorage` flag, producing a
client-only guest with no server identity (`LOCAL_GUEST_USER`, id
`guest_tab`). Its only caller is `LoginScreen`. Do not confuse it with
`startAnonymousSession`, which is the real thing.

`signOutToGuest()` is exposed on the context and covered by tests but has
**no production caller** — see "Known gaps".

## Signup / signin flows

Frontend surface lives in
[`app/src/contexts/AuthContext.tsx`](../app/src/contexts/AuthContext.tsx);
the v2 onboarding screens live under
[`app/src/components/shell/onboarding/`](../app/src/components/shell/onboarding/).

| Flow | AuthContext method | Convex call |
|------|--------------------|-------------|
| Start anonymous session | `startAnonymousSession()` | provider = `"anonymous"` (+ IP permit) |
| Claim username | `claimUsername(username, { inviteCode? })` | `users.claimUsernameOnly` |
| Upgrade to full account | `upgradeAccount(email, password, displayName?)` | `users.upgradeUsernameOnly` |
| Sign up | `signUp(email, password, username, displayName?)` | `flow: "signUp"` |
| Sign in | `signIn(email, password)` | `flow: "signIn"` |
| Request reset | `requestPasswordReset(email)` | `flow: "reset"` |
| Confirm reset | `confirmPasswordReset(email, code, newPassword)` | `flow: "reset-verification"` |
| Tab-local guest (legacy) | `loginAsGuest()` | none — `signOut()` + a `sessionStorage` flag |
| Sign out | `logout()` | `signOut()` |

Each method returns `Promise<void>` and throws an `AuthError` with a
discriminable `code` that the UI renders inline. The full set, in
declaration order:

`invalid_email`, `legacy_email`, `weak_password`, `invalid_username`,
`username_taken`, `password_mismatch`, `invalid_credentials`,
`invalid_code`, `reset_unavailable`, `email_taken`, `upgrade_unavailable`,
`rate_limited`, `unknown`.

The `AuthErrorCode` union in `AuthContext.tsx` is the source of truth. Keep
this list in sync with it by hand, but the `SAFE_MESSAGE` pairing below is
not a manual promise: it is typed `Record<AuthErrorCode, string>`, so a code
without an entry fails the typecheck.

`signUp` takes the username **explicitly** — it is not derived from the
email. After a successful signUp, AuthContext calls `users.ensureProfile`
with that normalized username and the optional display name.
`ensureProfile` only patches the username on first use, so subsequent calls
are no-ops for users that already have one, and it rejects `isGuest: true`
docs outright.

(`deriveUsernameFromEmail` still exists in `auth.ts` as a last-resort
fallback inside the Password provider's `profile()` hook — it guarantees a
non-empty candidate. It is not the signUp path.)

## Username uniqueness

Enforced by a real claims table, not by convention. `usernameClaims`
([`schema.ts`](../app/convex/schema.ts)) holds `key`, `username`, `userId`,
`claimedAt`, `releasedAt`, indexed `by_key` and `by_user`.
[`lib/usernames.ts`](../app/convex/lib/usernames.ts) `claimUsernameForUser`
inserts the claim and treats an active claim by another user as a conflict,
surfaced as `username_taken`.

The `users` table's own `by_username` index remains a plain index — Convex
has no unique constraint — so the claims table *is* the uniqueness
mechanism. Do not treat `by_username` as a guarantee.

## Password reset (OTP)

Configured in [`app/convex/authEmail.ts`](../app/convex/authEmail.ts).

- 6-digit numeric code generated with `crypto.getRandomValues`.
- Valid for 10 minutes (`maxAge: 600`).
- Single-use: Convex Auth deletes the verification code row after
  successful `reset-verification`.
- Delivery: Resend HTTP API (`https://api.resend.com/emails`). Plain
  text body — no HTML / React email templates.

A failed delivery — including an unset `RESEND_API_KEY` / `EMAIL_FROM` —
throws `ConvexError({ code: "reset_unavailable" })`. It must be a
ConvexError, not a plain `Error`: production Convex redacts a plain
Error's message to an opaque `"Server Error"` before it reaches the
browser, so the client could never map it to useful copy (see "Client-side
error surfacing"). The diagnostic detail (Resend status and response body)
is `console.error`-logged into the Convex deployment logs and deliberately
kept out of the client-visible payload.

Requesting a reset for an email with **no** password account does not
error. Convex Auth throws a plain `InvalidAccountId` from `retrieveAccount`
before the email provider is ever reached; `requestPasswordReset` swallows
it and resolves, so the reset form cannot be used to probe which emails are
registered. The UI shows the same neutral "if that email is registered, a
reset code is on its way" toast either way.

The swallow predicate is `isOpaqueServerError(err) || isAccountNotFound(err)`
— deliberately wider than `InvalidAccountId` alone. In production the message
is redacted, so account-not-found is *indistinguishable* from any other
opaque server error; both resolve silently. `isAccountNotFound` matches the
raw `InvalidAccountId` text so dev, where messages are legible, behaves the
same as prod instead of leaking account existence that prod hides.

The trade-off is accepted and worth knowing when debugging: an unexpected
opaque failure reads to the user as success. It is not lost — the server
still threw, so it is visible in the Convex deployment logs. A genuine send
failure stays distinguishable because it arrives as a `ConvexError`
(`reset_unavailable`), whose `data` survives redaction; anything else legible
maps through the normal rules against a `reset_unavailable` fallback.

## Password policy

Shared between client and server via
[`app/convex/lib/passwordPolicy.ts`](../app/convex/lib/passwordPolicy.ts)
(re-exported for the frontend as `@/lib/password`).

- Length: 8–72 characters.
- No character-class rules (no forced mixed case / digits / symbols).
- Case-insensitive rejection against a small bundled list of common
  leaked passwords (see
  [`passwordPolicy.ts#COMMON_PASSWORDS`](../app/convex/lib/passwordPolicy.ts)).
  Not an exhaustive deny list — the goal is to block the obvious hits,
  not compete with haveibeenpwned.

Both the client (`LoginScreen` submit handler) and the Convex Password
provider (`validatePasswordRequirements` hook) run this check. Neither
can be bypassed without changing both layers.

## Legacy account invalidation

Pre-fix accounts used `<username>@verveq.local` emails with
`password == username`. Those accounts are compromised by design. After
deploying this BLOCKER-1 fix, the operator must run the one-shot
migration:

```bash
# Dry-run to preview the row counts
npx convex run migrations/invalidateLegacyAuth:run '{"dryRun": true}'

# Apply for real
npx convex run migrations/invalidateLegacyAuth:run '{"dryRun": false}'
```

The migration:

- Finds every `users` doc whose `email` ends in `@verveq.local`.
- Deletes all matching `authAccounts`, `authSessions`,
  `authRefreshTokens`, `authVerificationCodes`, and `authVerifiers` rows
  so the compromised credentials can no longer be used to sign in.
- Leaves the `users` doc itself in place to preserve ELO, stats, and
  session history.
- Clears the legacy `email` field and, if the username matches the
  legacy autogenerated pattern (local part of the fake email), clears it
  so the user can sign up fresh with their real email.

The migration is an `internalMutation` — not callable from the client.
Run it from the Convex dashboard or via `npx convex run` with operator
credentials.

## Required Convex env vars

Set on the Convex dashboard (Settings → Environment Variables), **not**
in `app/.env.local`. The frontend bundle must not see them.

| Var | Purpose | Example |
|-----|---------|---------|
| `RESEND_API_KEY` | Authenticates with Resend's HTTP API | `re_xxx` |
| `EMAIL_FROM` | `From:` address on reset emails | `VerveQ <no-reply@yourdomain.tld>` |
| `CONVEX_SITE_URL` | Issuer for Convex Auth token validation (required by `auth.config.ts`) | `https://your-convex-deployment.convex.site` |

The dev deployment and the production deployment have independent env
var namespaces. Set these on each.

## Client-side error surfacing

Errors surface as `AuthError` with a stable `code`. The LoginScreen
renders the error inline above the submit button in the destructive
color. We deliberately do not toast auth errors — toasts disappear too
fast to act on.

`mapAuthError` in AuthContext resolves the code in this order:

1. **An existing `AuthError` is returned unchanged.** Defensive and
   idempotent — it makes a second mapping pass a no-op. No current call path
   actually feeds one in: the pre-call client guards below throw *before*
   entering their `try`, so they bypass `mapAuthError` rather than passing
   through it.
2. **`ConvexError.data.code`** — the only server payload that survives
   production redaction. Server code that wants a specific client message
   *must* throw `ConvexError({ code })` with a code from the list above.
3. **Message matching** — the thrown message, first de-noised through
   `humanizeServerError` to strip the `[CONVEX A(auth:signIn)] [Request
   ID: …] Server Error … Called by client` envelope. This only ever
   matches on **dev** deployments; in production the message is redacted
   to `"Server Error"` and nothing legible survives, so these rules all
   fall through. Treat them as a dev-ergonomics convenience, not the
   contract.
4. **Catch-all** — the call site's fallback code.

`AuthError.message` is rendered verbatim by LoginScreen, so raw server
text must never reach it. **Every branch that maps a server error** —
matched or catch-all — answers with curated `SAFE_MESSAGE` copy; the
server's text is only ever a routing signal, never user-facing copy. That
matters because matching a phrase must not license passing the rest of the
message through: otherwise a recognised phrase becomes a carrier for
whatever internal detail trails it. This is what stops a raw
`[CONVEX …] Server Error` string from being rendered inline.
`authContract.test.ts` locks it in, including noisy inputs that carry a
recognised phrase alongside internal detail.

That is a guarantee about `mapAuthError`, not about every `AuthError` in
the app. The guards that run *before* each Convex call — email shape,
legacy-domain, `validatePassword` — construct their `AuthError` directly
and never reach `mapAuthError`, so their copy is not drawn from
`SAFE_MESSAGE`: `weak_password` raised that way carries the specific
`describePasswordReason` reason rather than the generic entry. That copy is
client-authored and contains no server text, so the no-leak property holds
either way.

## Known gaps

Two entries previously listed here — guest → account upgrade, and
username-uniqueness hardening (audit HIGH-3) — were **both shipped** and have
been removed. See "Guest → account upgrade" and "Username uniqueness" above.

- **`signOutToGuest` is dead code**: implemented on the context and covered
  by `authContract.test.ts` / `guestUpgradeContract.test.tsx`, but no
  production component calls it. Either wire it up or delete it — a tested
  function with no caller reads as supported when it isn't.
- **`loginAsGuest` is a legacy seam**: the tab-local guest predates the
  anonymous provider and still exists only behind `LoginScreen`. It produces
  a user with no server identity, which every v2 surface treats as logged
  out.
- **Rate limits**: Convex Auth has a built-in `signIn.maxFailedAttempsPerHour`
  (default 10). We have not tuned it. Anonymous onboarding *is* rate-limited
  (`USERNAME_ONLY_RATE_LIMITS`, plus mandatory IP permits). Revisit if
  brute-force attempts show up in logs.
- **Email verification on signup**: not required today. A signup
  immediately gets a session. The `verify` option on the Password
  provider is wired for future use but not enabled.
