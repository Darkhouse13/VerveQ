# Deployment and Validation Reality

This document is the current source of truth for how deployment and validation work in this repo today.

It intentionally describes the real `frontend-web` + Convex + static bundle workflow used from this workspace. It does not describe the older FastAPI/PostgreSQL deployment model.

## Current stack that matters

- Frontend app: `frontend-web`
- Backend/runtime: Convex functions in `frontend-web/convex`
- Configured dev backend: `frontend-web/.env.local`
- Destructive curated parity target identity: exact `CONVEX_DEPLOYMENT` + `VITE_CONVEX_URL` pair from `frontend-web/.env.local`
- Local ops approval files: `.ops/curated-parity/approved-targets.local.json`, `.ops/curated-parity/destructive-approval.local.json`, `.ops/curated-parity/apply-session.local.json`, and `.ops/curated-parity/approval-history.local.json`
- Local trust anchor for destructive curated parity:
  - Windows: `%LOCALAPPDATA%\VerveQ\curated-parity\trust-anchor.current-user.dpapi`
  - macOS: Keychain generic password item `service=ai.factory.verveq.curated-parity`, `account=current-user`
  - Linux/other: no supported non-repo-local backend yet, so destructive approve/apply remain blocked
- Reachable frontend target from this workspace: locally served production bundle

## Current backend deployment flow

From `frontend-web`:

```bash
npx convex dev
```

For one-shot pushes in this repo, the working command used during recent mode rollouts was:

```bash
npx convex dev --once --typecheck disable
```

That deploys the current Convex function bundle and schema to the configured dev deployment.

For curated football runtime parity after the backend code/schema is deployed, start with the safe self-check:

```bash
cd frontend-web
npm run gameplay:curated-parity:status
```

That command is read-only. It prints a compact readiness header plus the current local allowlist, trust-anchor, approval artifact, and apply-session states.

If you also want the current curated manifest in the same read-only flow, run:

```bash
cd frontend-web
npm run gameplay:curated-parity:inspect
```

That command does not mutate Convex. It prints the detected deployment identity, whether destructive parity is allowed or blocked, which safeguard is in effect, and the current curated manifest summary.

If the inspect output says the target must be approved, create or update the gitignored local allowlist at:

```text
.ops/curated-parity/approved-targets.local.json
```

Then generate a short-lived local approval artifact:

```bash
cd frontend-web
npm run gameplay:curated-parity:approve
```

On supported platforms, the approve step creates the trust anchor automatically for the current local user if it does not exist yet:

- Windows uses current-user DPAPI
- macOS uses a Keychain generic password item

If the trust anchor backend is unavailable, locked, unreadable, or unsupported on the current platform, the workflow stays blocked.

If the target is approved and the short-lived artifact exists, run the destructive apply:

```bash
cd frontend-web
npm run gameplay:curated-parity
```

That command reseeds the curated runtime tables authoritatively from `scripts/data/*`, replaces stale football rows in approved dev/preview safely, and records the applied seed metadata in `curatedSeedMetadata`.

## Curated parity safety model

Destructive curated parity is now blocked by default.

It only proceeds when all of these are true:

1. `frontend-web/.env.local` contains both `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL`
2. the resolved deployment kind is `dev` or `preview`
3. `.ops/curated-parity/approved-targets.local.json` contains the exact current target pair
4. the current platform has a supported non-repo-local curated parity trust-anchor backend and it is available/usable for signing and validation
5. `npm run gameplay:curated-parity:approve` has created a signed still-valid single-use approval artifact for the exact current target and manifest seed version
6. `npm run gameplay:curated-parity` consumes that approval before the first destructive step and opens a matching active apply session for the wrapper-owned seed calls only
7. the run is happening from a local/dev operator workspace rather than CI

Example local ops config:

```json
{
  "version": 1,
  "approvedTargets": [
    {
      "deploymentName": "dev:admired-warthog-495",
      "convexUrl": "https://admired-warthog-495.eu-west-1.convex.cloud",
      "note": "primary dev"
    }
  ],
  "defaultApprovalTtlMinutes": 15
}
```

Recommended operator pattern:

- use `npm run gameplay:curated-parity:status` for the quickest read-only readiness check
- use `npm run gameplay:curated-parity:inspect` when you also want the current manifest summary
- keep approved targets only in the gitignored local ops config file
- let `npm run gameplay:curated-parity:approve` create or reuse the supported platform trust anchor outside the repo; do not try to copy repo-local approval files between machines/users
- use `npm run gameplay:curated-parity:approve` immediately before the destructive apply
- treat each approval as single-use: once apply starts, that approval is consumed and cannot be replayed
- if apply fails after consuming approval, run `approve` again before retrying
- do not rely on long-lived shell env approval state; legacy env approval variables are ignored

If the deployment cannot be confidently identified as an approved dev/preview target, the workflow stops before any clear-and-reseed action.

Inspect output now distinguishes:

- blocked-by-default status summary plus a short status code
- detected platform
- selected trust-anchor backend
- trust-anchor backend availability
- local allowlist state
- approval artifact signature status
- apply-session status
- trust-anchor status (`available`, `missing`, `unsupported`, or `unusable`)

## Common blocked states

| State | Meaning | Operator next step |
| --- | --- | --- |
| `missing-local-allowlist` | The gitignored local allowlist file is absent | Create `.ops/curated-parity/approved-targets.local.json`, then rerun `status` |
| `malformed-local-allowlist` | The allowlist file exists but cannot be trusted | Fix the JSON/schema issues, then rerun `status` |
| `target-not-allowlisted` | The allowlist exists but this exact deployment+URL pair is not approved | Add the current target pair, then rerun `status` |
| `trust-anchor-missing` | Supported platform, but the current local user has no trust anchor yet | Run `npm run gameplay:curated-parity:approve` |
| `trust-anchor-unavailable` | The trust-anchor backend exists but is not usable right now | Fix current-user access to the backend, then rerun `status` |
| `unsupported-platform` | No supported destructive trust-anchor backend exists for this platform | Use Windows (DPAPI) or macOS (Keychain); Linux stays intentionally fail-closed |
| `approval-consumed` | The previous approval already armed an apply session once | Run `npm run gameplay:curated-parity:approve` again |
| `active-apply-session-present` | A destructive apply session is already in progress or still active locally | Wait for it to finish or expire before approving/applying again |

Current platform note:

- Windows local operator workspaces are supported via current-user DPAPI
- macOS local operator workspaces are supported via Keychain generic password storage
- Linux and other platforms currently fail closed for approve/apply until a stronger non-repo-local backend is added

## Current frontend validation flow

The reliable reachable-target validation flow from this workspace is:

```bash
cd frontend-web
npm run build
npx serve -s dist -l 3000
```

That serves a production bundle locally against the configured dev Convex backend. This is the validation path used for Higher or Lower, VerveGrid, and Who Am I Phase 3 closeout checks.

## What "reachable target" means here

- It is a locally served production bundle.
- It is reachable from this workspace.
- It points at the live dev Convex backend configured in `.env.local`.
- It is sufficient for frontend rollout validation when no remote frontend deploy access is available.

## Current gameplay rollout truth

| Mode | Repo status | Backend status | Reachable frontend validation | Separate remote frontend rollout |
| --- | --- | --- | --- | --- |
| Higher or Lower | Complete | Live in dev backend | Validated | Externally blocked when deploy access/config is missing |
| VerveGrid | Complete | Live in dev backend | Validated | Externally blocked when deploy access/config is missing |
| Who Am I | Complete | Live in dev backend | Validated | Externally blocked when deploy access/config is missing |

## Curated parity verification flow

After `npm run gameplay:curated-parity`, verify both parity metadata and runtime startup behavior with:

```bash
cd frontend-web
npm run gameplay:smoke -- all
```

That smoke flow now checks the backend against the repo artifact hashes/counts recorded for the current curated seed version before it runs the gameplay startup checks.

## Important distinction

These are different states and should not be collapsed together:

- `complete in repo`
- `live in dev backend`
- `validated on reachable static target`
- `blocked externally by missing remote frontend deploy access`

## What is not currently available from this workspace

- A reliable remote frontend host deployment path
- The credentials/config needed to publish the current static bundle to a separate remote frontend environment

If remote deploy access/config is missing, treat that as an external operational blocker rather than a repo bug.
