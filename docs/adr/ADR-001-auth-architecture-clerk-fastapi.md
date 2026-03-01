# ADR-001: Adopt Clerk for Authentication and User Management in FastAPI

## Status
Accepted (provisional) — pending Phase 0 answers and sign-off

## Context
- We need secure authentication, session management, MFA/social, and organization-aware RBAC for a FastAPI backend and React SPA.
- Building and operating a full IAM stack in-house is costly and error-prone; we prefer feature velocity with strong security defaults.
- FastAPI requires async-friendly integrations; our API has performance requirements (define SLOs below).

## Decision
Adopt Clerk as the identity platform. Integrate via the official async Python SDK (`clerk-backend-api`) for backend verification and webhooks (Svix) for state sync. Implement an internal AuthService (Anti-Corruption Layer) and a unified `require_user(...)` authorization dependency. Use JWT claims for common checks and a local authorization cache for system-permission, high-QPS endpoints.

## Drivers
- Development speed: prebuilt flows (sign-in/up), MFA, social providers, orgs/roles.
- Security posture: mature JWT validation, key rotation, session lifecycle, signed webhooks.
- Operational clarity: isolate vendor dependency behind ACL; explicit exit/export paths.

## Non-Goals
- Replacing Clerk’s UI components on day one.
- Implementing a custom identity provider.

## Options Considered
1) Clerk (official SDK, webhooks, ACL)
2) DIY auth (passlib/python-jose, custom flows)
3) Alternate IdP (Auth0/Cognito/Okta) with similar pattern

Decision rationale:
- 1) Best velocity and feature completeness; good async SDK. Chosen.
- 2) High build/ops risk; slower delivery; weaker feature set initially.
- 3) Viable but no differentiator for our needs; switching cost exists anyway.

## Architecture Overview
- Frontend handles auth and attaches `Authorization: Bearer <jwt>` to API calls.
- Backend validates JWT (iss, aud, exp, nbf) and injects session/user context.
- Svix-verified webhooks synchronize users, orgs, memberships to local DB.
- Authorization via unified dependency: fast JWT-claim checks; local cache or live checks when needed.

## Authorization Strategy
Patterns:
- JWT-Only: fast; uses `org_role`, `org_permissions`, and selected `publicMetadata`.
- Live Check: accurate; call Clerk for system permissions; higher latency; use for rare admin ops.
- Local Cache: fastest at scale; store roles/permissions via webhooks; eventual consistency.

Selected approach per endpoint class (to be finalized):
- Public: no auth.
- Authenticated user (self): JWT-Only.
- Org member (standard features): JWT-Only.
- Org admin (sensitive writes): Local Cache preferred; Live Check only if cache unavailable.
- Platform admin (global ops): Local Cache + safeguard Live Check on critical actions.

Open items: fill policy map in `docs/auth/authorization-policy-map.md`.

## Data Minimization & Local Model
- Store only required fields locally: `clerk_id`, `email`, names, image URL, and timestamps.
- Users and orgs include `status` enum (active/suspended/deleted) and `deleted_at` for audit.
- Memberships are soft-deleted (`active=false`) to preserve history (`ended_at`, `ended_reason`).
- Track ordering via `clerk_updated_at`; ignore out-of-order stale updates.

## Webhooks
- Verify signatures with Svix (`CLERK_WEBHOOK_SECRET`).
- Idempotency: persist `svix_id`, drop duplicates.
- Background processing; upserts for user/org/member events.
- Rate-limit, validate payload sizes, and reject unknown types.

## Performance & SLOs (proposed; confirm in Phase 0)
- Protected endpoint p95 latency target: TBD ms (proposal: 150–250ms).
- Token verification budget: < 10ms (JWT path) / < 60ms (SDK verify).
- Live permission check budget (when used): < 300ms with timeout and short TTL cache.
- Webhook end-to-end sync p95: < 2s (measure and tune).

## Compliance & Security
- Strict claim validation; NTP-synced clocks.
- Secrets in managed store; rotation schedule.
- Minimize local PII; encrypt at rest as required.
- If HIPAA/PCI/etc.: complete separate due diligence and BAAs before go-live.

## Risks & Mitigations
- Vendor lock-in: ACL, local synced model, periodic export drills.
- System permissions absent from JWT: local cache; limit live checks; timeouts.
- Webhook reliability: retries/backoff, dead-letter, idempotency.
- Performance regressions: async-only SDK calls; circuit breakers; load tests.

## Consequences
Positive:
- Faster delivery with enterprise-grade auth features.
- Smaller security surface and fewer bespoke flows.

Negative:
- Operational dependency on Clerk uptime and APIs.
- Need to build/operate webhook pipeline and local cache.

## Decision Owner
TBD (Auth/Platform Lead)

## Reviewers
TBD (Backend, Frontend, SRE, Security)

## Follow-ups
- Fill policy map and SLOs.
- Approve env inventory and risk register.
- Greenlight migration strategy.

