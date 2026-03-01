# Environment Inventory and Secrets

This document enumerates environments, URLs, Clerk configuration, and required env vars. Fill placeholders per environment (dev/stage/prod).

## Environments

- Dev
  - Backend base URL: <https://api-dev.example.com> (LOCAL: http://localhost:8000)
  - Frontend base URL: <https://app-dev.example.com> (LOCAL: http://localhost:3000)
  - Clerk instance: <https://dev-xxxxx.clerk.accounts.dev>
  - Webhook endpoint: `<BACKEND_BASE_URL>/webhooks/clerk`

- Staging
  - Backend base URL: <https://api-stg.example.com>
  - Frontend base URL: <https://app-stg.example.com>
  - Clerk instance: <https://stg-xxxxx.clerk.accounts.dev>
  - Webhook endpoint: `<BACKEND_BASE_URL>/webhooks/clerk`

- Production
  - Backend base URL: <https://api.example.com>
  - Frontend base URL: <https://app.example.com>
  - Clerk instance: <https://xxxxx.clerk.accounts.dev>
  - Webhook endpoint: `<BACKEND_BASE_URL>/webhooks/clerk`

## Required Environment Variables

Application:
- `DATABASE_URL`: Postgres connection string.
- `BACKEND_BASE_URL`: Absolute URL of the API (per env).
- `FRONTEND_BASE_URL`: Absolute URL of the SPA (per env).

Clerk (Backend):
- `CLERK_SECRET_KEY`: Backend secret key (per env).
- `CLERK_ISSUER`: Issuer URL, e.g., `https://<instance>.clerk.accounts.dev`.
- `CLERK_JWT_AUDIENCE`: Expected audience claim for JWT validation.
- `CLERK_WEBHOOK_SECRET`: Svix webhook signing secret.

Clerk (Frontend):
- `VITE_CLERK_PUBLISHABLE_KEY` or `REACT_APP_CLERK_PUBLISHABLE_KEY`: Publishable key.
- `VITE_CLERK_FRONTEND_API` (optional for dev proxy setups).

Security & CORS:
- `CORS_ALLOWED_ORIGINS`: Comma-separated list (include SPA URL and Clerk widget origins if required).

Observability (optional):
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `LOG_LEVEL`, etc.

## Clerk Configuration Checklist

- [ ] Create separate Dev/Staging/Prod Clerk projects.
- [ ] Configure Allowed Origins and Authorized Redirect URLs for each env.
- [ ] Set Session Token Template to include `org_role`, `org_permissions`, needed `publicMetadata`.
- [ ] Generate and store `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SECRET` in secret manager.
- [ ] Register webhook: `POST /webhooks/clerk` per env.

## Secrets Management

- Store secrets in a managed secret store (e.g., Azure Key Vault/AWS Secrets Manager/GitHub Actions). Do not commit to VCS.
- Rotate `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SECRET` on a defined schedule (e.g., 90 days) and on compromise.

## Notes

- For local development, use HTTPS tunnels (ngrok/Cloudflared) to receive webhooks.
- Keep environment separation strict; never reuse keys across environments.

