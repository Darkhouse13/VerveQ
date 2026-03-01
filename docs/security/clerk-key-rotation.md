# Clerk Key Rotation Playbook

The Clerk API credentials that previously lived in .env.example were exposed. Treat them as compromised and rotate immediately in every environment.

## 1. Rotate Backend Secrets
1. Sign in to the Clerk dashboard and open **API Keys** > **Backend API Keys**.
2. Create a new **Secret key**, store it in your password manager, and copy it into your secret store for each environment.
3. Delete the leaked key (sk_test_*). Clerk will revoke it immediately.
4. Update CLERK_SECRET_KEY values in your deployment secrets and local .env (never commit plain values).

## 2. Rotate Webhook Secret
1. Navigate to **Webhooks** > select the VerveQ endpoint.
2. Generate a new signing secret (whsec_*) and deploy it to the backend configuration.
3. Remove the old webhook secret from any config/CI variables.

## 3. Rotate Frontend Publishable Keys
1. In the Clerk dashboard go to **Publishable keys**.
2. Generate a new publishable key for each environment you use (development, staging, production).
3. Update the frontend env files (Expo, Vite) and secret managers referencing the old key.

## 4. Validate
- Re-deploy backend and frontend with the new secrets.
- Hit the /clerk/me demo endpoint with a valid session token to confirm authentication still works.
- Trigger a sample webhook from Clerk to ensure signature verification succeeds.

## 5. Optional: Clean Git History
If this branch was pushed to a remote, rewrite history (e.g. via git filter-repo) to permanently remove the leaked values, then force-push. Ensure any forks are also scrubbed.

Finally, document the new rotation date in your change log or runbook.
