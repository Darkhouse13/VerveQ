# Deployment and Validation Reality

This document is the current source of truth for how deployment and validation work in this repo today.

It intentionally describes the real `app` + Convex + static bundle workflow used from this workspace. It does not describe the older FastAPI/PostgreSQL deployment model.

## Current stack that matters

- Frontend app: `app`
- Backend/runtime: Convex functions in `app/convex`
- Configured dev backend: `app/.env.local`
- Destructive curated parity target identity: exact `CONVEX_DEPLOYMENT` + `VITE_CONVEX_URL` pair from `app/.env.local`
- Local ops approval files: `.ops/curated-parity/approved-targets.local.json`, `.ops/curated-parity/destructive-approval.local.json`, `.ops/curated-parity/apply-session.local.json`, and `.ops/curated-parity/approval-history.local.json`
- Local trust anchor for destructive curated parity:
  - Windows: `%LOCALAPPDATA%\VerveQ\curated-parity\trust-anchor.current-user.dpapi`
  - macOS: Keychain generic password item `service=ai.factory.verveq.curated-parity`, `account=current-user`
  - Linux/other: no supported non-repo-local backend yet, so destructive approve/apply remain blocked
- Reachable frontend target from this workspace: locally served production bundle

## Current backend deployment flow

### Deploy preconditions

Before pushing backend changes from an operator workspace:

1. Work from the correct checkout: repo root `VerveQ`, app workspace `app`.
2. Pull exactly to the intended target commit with `git pull --ff-only`.
3. Confirm `CONVEX_DEPLOY_KEY` is valid for `dev:admired-warthog-495`; do not use a key for any other deployment.
4. Regenerate generated files with `cd app && npm run codegen`; `app/convex/_generated/` is ignored build output and `git status --short` should stay clean.
5. Run `npx convex dev --once --typecheck disable`.
6. Run `internal.challengeArenas.seedContentGaps` only when Challenge Arena content changed.
7. Verify `challengeArenas.contentStatus` after any content seed.

From `app`:

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
cd app
npm run gameplay:curated-parity:status
```

That command is read-only. It prints a compact readiness header plus the current local allowlist, trust-anchor, approval artifact, and apply-session states.

If you also want the current curated manifest in the same read-only flow, run:

```bash
cd app
npm run gameplay:curated-parity:inspect
```

That command does not mutate Convex. It prints the detected deployment identity, whether destructive parity is allowed or blocked, which safeguard is in effect, and the current curated manifest summary.

If the inspect output says the target must be approved, create or update the gitignored local allowlist at:

```text
.ops/curated-parity/approved-targets.local.json
```

Then generate a short-lived local approval artifact:

```bash
cd app
npm run gameplay:curated-parity:approve
```

On supported platforms, the approve step creates the trust anchor automatically for the current local user if it does not exist yet:

- Windows uses current-user DPAPI
- macOS uses a Keychain generic password item

If the trust anchor backend is unavailable, locked, unreadable, or unsupported on the current platform, the workflow stays blocked.

If the target is approved and the short-lived artifact exists, run the destructive apply:

```bash
cd app
npm run gameplay:curated-parity
```

That command reseeds the curated runtime tables authoritatively from `scripts/data/*`, replaces stale football rows in approved dev/preview safely, and records the applied seed metadata in `curatedSeedMetadata`.

## Curated parity safety model

Destructive curated parity is now blocked by default.

It only proceeds when all of these are true:

1. `app/.env.local` contains both `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL`
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

## Production frontend deploy + rollback runbook (verveq.com)

This is the authoritative path for publishing the static frontend to production. It has been run end-to-end twice; treat deviations from it as exceptions to call out, not alternatives.

### Topology

- Production host runs Docker with a Traefik reverse proxy on the `coolify` network (HTTP→HTTPS redirect, gzip, Let's Encrypt certs for `verveq.com` + `www.verveq.com`).
- The frontend is an nginx container (`verveq-web`) built from `deploy/Dockerfile`; the **web root inside the container is `/usr/share/nginx/html`**, populated from `app/dist`.
- nginx config is `deploy/nginx.conf`. It implements the **cache split that must never regress**:
  - `index.html` (and every SPA-fallback response): `Cache-Control: no-cache` — the shell is what points at new hashed assets, so it must revalidate on every deploy.
  - hashed assets (`*.js`, `*.css`, images, fonts): `expires 30d` + `Cache-Control: public, immutable`.
  - `robots.txt` and `sitemap.xml` have explicit `location =` blocks so they are served as static files instead of falling through to the SPA fallback (which soft-404s as the app shell).
- `GET /healthz` inside the container returns `ok` and is the post-deploy health probe.

### Build environment

The bundle is built on the host from the repo checkout (`/home/hermes/projects/verveq`), with the flag state baked in at build time:

```bash
export VITE_CONVEX_URL=https://admired-warthog-495.eu-west-1.convex.cloud
export VITE_V2_SHELL_ENABLED=true   # v2 shell is the live default
```

`VITE_*` vars are compile-time: changing them requires a rebuild, not a container restart. `app/.env.local` is not read by the production build script — export explicitly.

### Backup before deploy (timestamped + hashed + restore-tested)

Before replacing the running container, snapshot what is currently serving:

```bash
STAMP=$(date +%Y%m%d%H%M%S)
docker exec verveq-web sh -c 'cd /usr/share/nginx/html && tar cf - .' > /root/backups/verveq-web-${STAMP}.tar
sha256sum /root/backups/verveq-web-${STAMP}.tar | tee -a /root/backups/MANIFEST
# Restore-test: a backup that has not been unpacked is not a backup.
mkdir -p /tmp/restore-test-${STAMP} && tar xf /root/backups/verveq-web-${STAMP}.tar -C /tmp/restore-test-${STAMP} \
  && test -f /tmp/restore-test-${STAMP}/index.html && echo RESTORE-OK && rm -rf /tmp/restore-test-${STAMP}
```

Also record the currently-running image tag — it is the rollback target:

```bash
docker inspect --format '{{.Config.Image}}' verveq-web | tee -a /root/backups/MANIFEST
```

### Deploy

```bash
cd /home/hermes/projects/verveq
export VITE_CONVEX_URL=... VITE_V2_SHELL_ENABLED=true
./deploy/build-and-run.sh verveq.com
```

The script builds the bundle, bakes it into an image tagged `verveq-web:<git-short-sha>-<timestamp>` (every deploy is a uniquely-tagged, immutable rollback point), replaces the `verveq-web` container with full Traefik labels, and curls `/healthz` inside the container.

### Post-deploy verification

```bash
curl -fsS https://verveq.com/healthz
curl -fsSI https://verveq.com/ | grep -i cache-control          # expect no-cache
curl -fsS https://verveq.com/robots.txt | head -2                # expect robots, not HTML
curl -fsS https://verveq.com/sitemap.xml | head -2               # expect XML, not HTML
curl -fsSI "https://verveq.com/assets/$(curl -fsS https://verveq.com/ | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2)" | grep -i cache-control  # expect immutable
```

**Stale-DNS host-pin caveat:** the workstation running verification may resolve `verveq.com` to a stale IP (old A record, local cache, or VPN split-DNS). Both prior runs hit this. Pin the resolution to the production host instead of trusting the resolver:

```bash
curl --resolve verveq.com:443:<PROD_HOST_IP> -fsS https://verveq.com/healthz
```

If pinned checks pass but unpinned ones fail, it is DNS propagation/caching — do not roll back for it.

### Rollback (one command)

Every deploy leaves its predecessor's image intact, so rollback is re-running the previous image (look it up with `docker images "verveq-web" | head` or in `/root/backups/MANIFEST`):

```bash
docker rm -f verveq-web && docker run -d --name verveq-web --restart unless-stopped --network coolify \
  $(docker inspect --format '{{range $k,$v := .Config.Labels}}--label {{$k}}={{$v}} {{end}}' verveq-web 2>/dev/null || echo "") \
  verveq-web:<previous-tag>
```

In practice the proven minimal form (labels are identical across versions because they come from the run script) is to re-run `deploy/build-and-run.sh` from the previous git commit, or:

```bash
docker rm -f verveq-web && deploy/run-image.sh verveq-web:<previous-tag>   # if extracted; otherwise reuse the docker run block from build-and-run.sh with the old tag
```

Because `index.html` is served `no-cache`, clients pick up the rollback on their next request — no cache purge step exists or is needed. Verify with the same pinned `curl` checks as a deploy.

## Current frontend validation flow

The reliable reachable-target validation flow from this workspace is:

```bash
cd app
npm run build
npx serve -s dist -l 3000
```

That serves a production bundle locally against the configured dev Convex backend. This is the validation path used for Higher or Lower, VerveGrid, and Who Am I Phase 3 closeout checks.

## What "reachable target" means here

- It is a locally served production bundle.
- It is reachable from this workspace.
- It points at the live dev Convex backend configured in `app/.env.local`.
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
cd app
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

- The credentials/SSH access to the production host — the deploy + rollback runbook above runs ON the production host, not from a development workspace.

From a workspace without host access, treat "publish the bundle" as an operator handoff: point the operator at the runbook section above.
