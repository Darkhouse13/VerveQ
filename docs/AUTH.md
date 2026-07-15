# VerveQ auth

This document describes the authentication model after the BLOCKER-1 fix
(real email + password instead of deterministic username == password
accounts).

## Providers

Configured in [`app/convex/auth.ts`](../app/convex/auth.ts):

- **Anonymous** — guest play. The "Play as guest" button on the login
  screen uses this. No account takeover vector: guests cannot receive
  password reset emails, and their user doc is flagged `isGuest: true`.
- **Password** — real email + password. Passwords are hashed with Scrypt
  via Convex Auth's default crypto. Password reset goes through an
  email-delivered OTP (see below).

Guest → account upgrade is intentionally not implemented. A guest who
wants a real account signs out and signs up fresh. This is a known gap —
see "Known gaps" below.

## Signup / signin flows

Frontend surface lives in
[`app/src/contexts/AuthContext.tsx`](../app/src/contexts/AuthContext.tsx)
and [`app/src/pages/LoginScreen.tsx`](../app/src/pages/LoginScreen.tsx).

| Flow | AuthContext method | Convex `signIn` flow arg |
|------|--------------------|--------------------------|
| Sign up | `signUp(email, password, displayName?)` | `flow: "signUp"` |
| Sign in | `signIn(email, password)` | `flow: "signIn"` |
| Request reset | `requestPasswordReset(email)` | `flow: "reset"` |
| Confirm reset | `confirmPasswordReset(email, code, newPassword)` | `flow: "reset-verification"` |
| Guest | `loginAsGuest()` | provider = `"anonymous"` |
| Sign out | `logout()` | `signOut()` |

Each method returns `Promise<void>` and throws an `AuthError` with a
discriminable `code` (`invalid_email`, `legacy_email`, `weak_password`,
`password_mismatch`, `invalid_credentials`, `invalid_code`,
`reset_unavailable`, `unknown`) that the UI renders inline.

After a successful signUp, AuthContext calls
`users.ensureProfile` to patch the user doc with a derived username
(email local part, sanitized to `[a-z0-9_]`) and the optional display
name. `ensureProfile` only patches the username on first use — subsequent
calls are no-ops for users that already have one.

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
reset code is on its way" toast either way. A genuine send failure is
distinguishable precisely because it arrives as a ConvexError.

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

1. **`ConvexError.data.code`** — the only server payload that survives
   production redaction. Server code that wants a specific client message
   *must* throw `ConvexError({ code })` with a code from the list above.
2. **Message matching** — the thrown message, first de-noised through
   `humanizeServerError` to strip the `[CONVEX A(auth:signIn)] [Request
   ID: …] Server Error … Called by client` envelope. This only ever
   matches on **dev** deployments; in production the message is redacted
   to `"Server Error"` and nothing legible survives, so these rules all
   fall through. Treat them as a dev-ergonomics convenience, not the
   contract.
3. **Catch-all** — the call site's fallback code.

`AuthError.message` is rendered verbatim by LoginScreen, so raw server
text must never reach it. **Every** branch — matched or catch-all —
answers with curated `SAFE_MESSAGE` copy (one entry per `AuthErrorCode`);
the server's text is only ever a routing signal, never user-facing copy.
That matters because matching a phrase must not license passing the rest
of the message through: otherwise a recognised phrase becomes a carrier
for whatever internal detail trails it. This is what stops a raw
`[CONVEX …] Server Error` string from being rendered inline.
`authContract.test.ts` locks it in, including noisy inputs that carry a
recognised phrase alongside internal detail.

## Known gaps

- **Guest → account upgrade**: not implemented. A follow-up pass can
  add this via `linkAccount` (Convex Auth supports linking a credentials
  account to an existing user document).
- **Username uniqueness hardening** (audit HIGH-3): `ensureProfile`
  normalizes requested handles and rejects duplicates before patching the
  user row. The remaining v2 hardening question is schema/database-level
  uniqueness; the current schema has a regular `by_username` index, not a
  unique constraint.
- **Rate limits**: Convex Auth has a built-in `signIn.maxFailedAttempsPerHour`
  (default 10). We have not tuned it. Revisit if brute-force attempts
  show up in logs.
- **Email verification on signup**: not required today. A signup
  immediately gets a session. The `verify` option on the Password
  provider is wired for future use but not enabled.
