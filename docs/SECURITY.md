# Security Policy

> The current live stack is `app/` + Convex, not the older FastAPI/PostgreSQL
> model. Deployment notes here are superseded by docs/DEPLOYMENT.md, and the
> authoritative auth reference is docs/AUTH.md. Anything below that describes a
> database, ORM, or token model you cannot find in `app/convex/` is historical.

## Supported Versions

VerveQ ships continuously from `master` — every merge is a production release
(see [DEPLOYMENT.md](DEPLOYMENT.md)). There are no maintained release branches
and no back-porting: the deployed `master` is the only supported version, and
security fixes reach production by merging them.

`app/package.json` declares version `0.1.0`; it is not a release channel and
carries no support promise.

## Reporting a Vulnerability

If you discover a security vulnerability within VerveQ Platform, please send an email to [security@verveq.com] with a detailed description of the issue.

Please include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the vulnerability
- Potential impact of the vulnerability
- Any possible mitigations you've identified

Our security team will acknowledge your report within 48 hours and will send a more detailed response within 72 hours indicating the next steps in handling your report.

After the initial reply to your report, the security team will endeavor to keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

## Security Measures

### Authentication

Authentication is [Convex Auth](https://labs.convex.dev/auth), configured in
[`app/convex/auth.ts`](../app/convex/auth.ts). Full detail — flows, error
contract, known gaps — is in [AUTH.md](AUTH.md).

- Two providers: **Password** (real email + password) and **Anonymous** (guest play, IP-permit rate-limited)
- Passwords are hashed with **Scrypt** via Convex Auth's default crypto. The application never stores or handles a plaintext password at rest
- Password policy is shared by client and server through [`app/convex/lib/passwordPolicy.ts`](../app/convex/lib/passwordPolicy.ts): 8–72 characters, with case-insensitive rejection of common leaked passwords. The Convex `Password` provider enforces it in `validatePasswordRequirements`, so a direct Convex call cannot bypass the client-side check
- Password reset is a 6-digit OTP delivered by email, valid 10 minutes and single-use. Requesting a reset for an unregistered email resolves normally rather than erroring, so the form cannot be used to enumerate accounts
- Session tokens are issued and validated by Convex Auth; the issuer is configured via `CONVEX_SITE_URL` (`app/convex/auth.config.ts`)

### Data Protection

- Sensitive data is never committed to the repository
- Server-side secrets (`RESEND_API_KEY`, `EMAIL_FROM`, `CONVEX_SITE_URL`) are set on the Convex dashboard, **not** in `app/.env.local` — the frontend bundle must never see them
- Only `VITE_`-prefixed variables reach the browser bundle; treat every one of them as public
- Game logic is server-authoritative: answer keys are stripped server-side before a session is returned to the client
- Production error reporting (Sentry) is errors-only with PII scrubbed

### API Security

- Convex functions declare argument validators, and the data layer is Convex's own — there is no SQL and no string-built query surface
- Authorization is checked server-side per function (`app/convex/lib/authz.ts`), not in the client
- Convex Auth has a built-in sign-in attempt limit (`signIn.maxFailedAttempsPerHour`, default 10); anonymous onboarding is additionally IP-permit gated

### Network Security

- HTTPS is enforced in production; TLS terminates at Traefik in front of the app container (see [DEPLOYMENT.md](DEPLOYMENT.md))
- CI never carries deploy secrets in the verification workflow (`check.yml` references none)

## Security Best Practices

For anyone operating this stack:

1. Keep server-side secrets on the Convex dashboard; never commit them or expose them through a `VITE_` variable
2. Use HTTPS for all communications
3. Regularly update dependencies
4. Monitor the Convex deployment logs for suspicious activity
5. Rehearse schema changes on the dev deployment before merging — a merge to `master` ships schema to production
6. Use the Convex deployment and persistence model documented in [DEPLOYMENT.md](DEPLOYMENT.md) for production
