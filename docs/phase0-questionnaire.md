# Phase 0 Questionnaire — Inputs Needed

Provide answers or mark N/A to finalize ADR and configurations.

## 1) Organizations & Roles
- Do we require organizations (multi-tenant) at launch? (Y/N)
  - **Answer: N.** As a solo builder, multi-tenancy is not required at this stage.
- Default roles needed per org (e.g., `org:admin`, `org:member`)? Any custom roles?
  - **Answer: N/A.**
- Custom permissions required (strings) beyond role (e.g., `org:billing:read`)?
  - **Answer: N/A.**
- Platform/global admin concept required? If yes, how assigned?
  - **Answer: Yes.** A simple admin role is sufficient. The first user can be considered the admin. The current implementation does not have a formal admin role, but a user can be designated as one.

## 2) Authorization Strategy per Endpoint Class
- Any endpoint classes that must check Clerk system permissions? Which?
  - **Answer: N/A.** Clerk is not used. Authentication is handled by a custom JWT implementation in `backend/auth/jwt_auth.py`.
- For performance-sensitive endpoints, confirm use of Local Cache over Live Check.
  - **Answer:** The project includes an optional Redis cache backend with an in-memory fallback (`backend/services/cache_backend.py`), which can be enabled for performance-sensitive endpoints.

## 3) Compliance & Data
- Compliance requirements (HIPAA/PCI/ISO/SOC2/data residency)?
  - **Answer: N/A.** No immediate compliance requirements for this project.
- PII policy: which user fields must be stored locally? Any anonymization needs?
  - **Answer:** The `User` model (`backend/database/models.py`) stores `id`, `username`, `email` (nullable), `display_name`, and `avatar_url`. Email is optional, and the system supports anonymous guest accounts.
- Audit requirements: retention periods, event provenance needs?
  - **Answer:** The `AnalyticsEvent` model provides some auditing. The `README.md` mentions "Comprehensive Logging" and "Log Management". Retention periods are not explicitly defined and would depend on the deployment setup (e.g., logrotate).

## 4) Performance Targets
- Expected QPS (p50/p95 peak) for protected endpoints?
  - **Answer: Not formally defined.** Can be established as the user base grows. Rate limiting is enabled by default.
- Latency SLOs (p95/p99) for key endpoints?
  - **Answer: Not formally defined.**
- Webhook E2E sync p95 target (proposal: < 2s) — confirm.
  - **Answer: N/A.** No webhooks are currently implemented.

## 5) Migration (if legacy users)
- Do legacy users exist? Approximate count?
  - **Answer: No.** This appears to be a new project.
- Hash algorithms in use (bcrypt/scrypt/pbkdf2/etc.)?
  - **Answer:** The system uses JWT for authentication tokens. There is no explicit password hashing, as it supports guest accounts and optional email registration.
- Preferred strategy: Big-bang vs Trickle; downtime tolerance?
  - **Answer: N/A.**
- Foreign key continuity: legacy user ID mapping via `externalId`?
  - **Answer: N/A.**

## 6) Environments & URLs
- Backend URLs per env (dev/stage/prod):
  - **dev:** `http://127.0.0.1:8008` (as per user-provided context), `http://localhost:8000`, or `http://10.0.2.2:8000` for the Android emulator.
  - **stage:** `https://staging-api.verveq.com`
  - **prod:** `https://api.verveq.com`
- Frontend URLs per env:
  - **dev:** `http://localhost:19006` (Expo web), `exp://<lan-ip>:19000`
  - **stage/prod:** Not explicitly defined. Would be the URL of the deployed web app or mobile app deep links.
- Clerk instance URLs per env:
  - **Answer: N/A.**
- Webhook URLs per env:
  - **Answer: N/A.**

## 7) Frontend Integration
- Framework: React (confirm), build tool (Vite/CRA/Next)?
  - **Answer: React Native with Expo**, confirmed from `frontend/package.json`.
- Error handling preference for 401/403: sign-out vs modal vs toast?
  - **Answer:** A 401 error triggers a `logout()` function, which signs the user out by clearing their session and token (`frontend/src/context/AuthContext.js`).
- Org context UX: how users pick/switch orgs?
  - **Answer: N/A.**

## 8) Operations
- Secrets manager in use?
  - **Answer: No.** Secrets are managed via environment variables (`.env` files), as seen in `backend/config/settings.py`.
- Observability stack (metrics/logging/tracing) and alerting channels?
  - **Answer:** The project uses structured logging with `logrotate`, a `/health/metrics` endpoint for Prometheus-style metrics, and `scripts/monitor.sh` for health checks.
- Incident runbooks needed for auth outage? Who’s on-call?
  - **Answer:** As the solo builder, you are on-call. The `README.md` contains basic troubleshooting steps. Formal runbooks are not yet created.