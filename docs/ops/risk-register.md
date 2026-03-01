# Risk Register — Clerk Integration

Track integration risks with probability, impact, mitigation, owner, and status.

## Legend
- Probability: Low / Medium / High
- Impact: Low / Medium / High / Critical
- Status: Open / Mitigating / Monitoring / Closed

## Risks

1. Webhook delivery failures or duplication
- Probability: Medium
- Impact: High
- Mitigation: Svix signature verification; idempotency via `svix_id`; retries/backoff; dead-letter; alerts on failure rate.
- Owner: Backend
- Status: Open

2. System permissions not present in JWT (authZ gaps)
- Probability: High
- Impact: High
- Mitigation: Local authorization cache via webhooks; limit Live Checks to admin routes; timeouts and short TTL cache.
- Owner: Backend
- Status: Open

3. Vendor lock-in
- Probability: Medium
- Impact: Medium/High
- Mitigation: Anti-Corruption Layer; local synced user/org model; periodic data export drill; avoid Clerk-specific types outside adapter.
- Owner: Platform
- Status: Open

4. Performance regression from synchronous or live Clerk calls
- Probability: Medium
- Impact: High
- Mitigation: Async-only SDK usage; circuit breakers; per-request latency budgets; load testing with auth enabled.
- Owner: Backend/SRE
- Status: Open

5. Migration complexity (legacy users)
- Probability: Medium
- Impact: High
- Mitigation: Dedicated sprint; trickle strategy with dual-auth; data audit; rollback plan; shadow-read comparison.
- Owner: Backend/QA
- Status: Open (if applicable)

6. JWT validation misconfiguration (iss/aud/clock skew)
- Probability: Medium
- Impact: High
- Mitigation: Strict claim checks; environment-specific `iss/aud`; NTP; integration tests covering skew/expiry.
- Owner: Backend/SRE
- Status: Open

7. Key rotation and JWKS changes
- Probability: Low/Medium
- Impact: Medium/High
- Mitigation: Use official SDK; if custom validation, implement JWKS cache + rotation; alert on validation errors spike.
- Owner: Backend
- Status: Open

8. Rate limiting or outage on Clerk API
- Probability: Low/Medium
- Impact: High
- Mitigation: Backoff/retry; local cache for reads; graceful degradation of non-critical admin features; status page monitoring.
- Owner: SRE
- Status: Open

9. PII handling/data residency/compliance gaps
- Probability: Variable
- Impact: High/Critical
- Mitigation: Data minimization; encrypt at rest; confirm Clerk certifications/BAAs; legal review; logging scrub.
- Owner: Security/Legal
- Status: Open

10. Event ordering issues in webhooks
- Probability: Medium
- Impact: Medium/High
- Mitigation: `clerk_updated_at` ordering guard; idempotent upserts; retries; audit trail of last applied event.
- Owner: Backend
- Status: Open

## Review Cadence
- Weekly during build
- Daily during migration/cutover
- Monthly post‑launch until risks 1–4 are Closed

