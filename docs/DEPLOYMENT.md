# VerveQ Deployment Runbook

> **Merging to `master` is a FRONTEND production release.** It republishes
> the SPA bundle to the host, with no confirmation step. The Convex backend
> (functions *and* schema, prod `different-lynx-153`) is **never deployed by
> CI** — Ticket 0.1 C4 removed that step; backend deploys are run by hand
> (see "What a master push does"). A master push whose frontend depends on
> undeployed Convex functions ships a frontend that fails those calls until
> the backend is deployed. Read "What a master push does" before merging.
>
> **Who may deploy the backend (owner ruling 2026-08-01):** the old
> owner-manual-only rule is ABOLISHED. Claude Code deploys prod when — and
> only when — a ticket/mission explicitly authorizes prod, from a provably
> clean tree on latest `master`. Without that explicit authorization the
> backend deploy remains the owner's action. First exercised by mission
> FW-SHIP (2026-08-11).

This runbook describes the host topology, the image-based publish mechanics,
and rollback. It is **not** the trigger for a normal release: the deploy
workflow is (see below). The commands here are what that automation runs on
the host, and remain the path for rollback and out-of-band publishes.
Where this file and [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
disagree, the workflow is the truth.

Publishes are **image-based and durable by construction**: every release builds and tags a fresh Docker image and recreates the container from it. Never `docker cp` files into the running container — that strands the release in the container's writable layer, and the next recreate silently rolls production back to whatever the image tag holds. (This happened: the 2026-06-12 live state existed only in the writable layer of an image tagged 2026-05-27 until the durable cutover that same day.)

## What a master push does

Defined entirely in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
Trigger: `push: branches: [master]`, plus a manual `workflow_dispatch`. A
single `deploy` job runs ONE publish:

- **Frontend → the host over SSH.** The server pins the deploy key to a
  forced command, so the literal `deploy` argument is ignored; it triggers
  the same image-based publish documented below.

**The Convex backend is NOT part of CI.** Ticket 0.1 C4 removed the
`npx convex deploy` step from the workflow; backend releases are run by hand
(owner, or Claude Code under an explicit ticket authorization — see the box
at the top), from a provably clean tree on latest `master`:

```bash
cd app
CONVEX_DEPLOY_KEY=<prod key> npx convex deploy   # targets prod different-lynx-153
# PowerShell: $env:CONVEX_DEPLOY_KEY = "<prod key>"; npx convex deploy
# An authenticated `npx convex login` session with prod access works in place
# of the key (how FW-SHIP deployed; no CONVEX_DEPLOY_KEY exists on the dev box).
```

**Deploy-history correction (recorded 2026-08-11):** an UNRECORDED partial
backend deploy predated FW-SHIP — `fantasyScores.getCrewTable` (FW-4 era)
already existed in the prod function catalog before the FW-SHIP deploy, while
the fantasy data layer was empty and `API_FOOTBALL_KEY` unset. Treat any
"prod backend was last deployed at X" claim from before 2026-08-11 as
unreliable; from FW-SHIP onward, deploys are recorded in the commit history
and in `research/fantasy/LAUNCH_READINESS.md`.

Functions and schema both ship. Deploy the backend BEFORE (or with) any
master push whose frontend calls new Convex functions; until then those
calls reject at runtime (surfaces built to the fail-closed convention, e.g.
the Home draw card and the WEEKEND mode screens, quietly show their
"nothing open" states — the pre-launch teaser that pioneered the pattern is
retired).

**There is no CI ordering to reason about — there is only one CI step.**
Ticket 0.1 C4 removed `npx convex deploy` from the workflow, so the two
releases are fully independent: the frontend ships automatically on push, the
backend ships whenever the command above is run by hand, and neither gates,
triggers, or rolls back the other. (An earlier revision of this file described
a sequential Convex-then-frontend CI job with a `success()` dependency between
the steps. That job no longer exists; the description was stale and has been
removed. Where this file and `deploy.yml` disagree, the workflow is the truth
— see the top of this section.)

What that independence actually costs you, and the resulting rule:

- **Frontend pushed without its backend** → the new bundle calls Convex
  functions that aren't deployed, and those calls reject at runtime until the
  backend is deployed. This is the common failure and the reason for the rule below.
- **Backend deployed without its frontend** → the new backend serves the old
  bundle, for as long as you leave it. Harmless if the change is
  backward-compatible; user-visible immediately if it isn't.
- **Frontend publish fails** → nothing ships; production keeps serving the
  previous image. Roll forward or back with the publish/rollback commands
  below.

So: **a Convex contract change always lands before the frontend that depends
on it**, and breaking backend changes want the two releases close together.
Backward-compatible backend changes can ship whenever.

`concurrency: group: verveq-deploy` with `cancel-in-progress: false`
(`deploy.yml:20-22`) allows one deploy at a time and lets an in-flight run
finish rather than cancelling it mid-build.

## Production topology

- Host: `178.104.196.36`. DNS verified 2026-06-12: `verveq.com` and `www.verveq.com` both resolve A-only to this IP (no AAAA/CNAME, checked against 1.1.1.1 as well as the local resolver), so QA no longer needs to pin the host.
- Container: `verveq-web`, image `verveq-web:<git-sha>-<stamp>`.
- Fronting: Traefik (`coolify-proxy`) routes `verveq.com`/`www.verveq.com` to the container's nginx on port 80. Routing and TLS come **entirely from labels passed at `docker run`** (see `deploy/recreate-from-image.sh`); TLS certs live in Traefik's acme store and survive container recreation.
- The container is **not managed by Coolify**. It is still auto-redeployed on every push to `master` — not by Coolify, but by `deploy.yml`'s SSH step, which triggers the host-side forced command that runs the scripts below. Running those scripts by hand is the manual/rollback path, not the only path.
- Image contents: static SPA bundle at `/usr/share/nginx/html` + `deploy/nginx.conf` at `/etc/nginx/conf.d/default.conf`, baked in by `deploy/Dockerfile`. No host volume mounts.
- Backend: **a master push never touches Convex** — every CI release is frontend-only (Ticket 0.1 C4), and the backend ships only via a hand-run `npx convex deploy` — owner, or Claude Code under explicit ticket authorization (see "What a master push does"). Production builds use `VITE_CONVEX_URL=https://different-lynx-153.convex.cloud` and `VITE_CONVEX_SITE_URL=https://different-lynx-153.convex.site`.
- Duel share vanity route: nginx proxies `verveq.com/s/d/*` (page + `card.png`) to the Convex `.site` httpAction (`deploy/nginx.conf` `location ^~ /s/d/`), forwarding path and `User-Agent` intact. The Convex deployment carries `SHARE_PUBLIC_BASE_URL=https://verveq.com` so `og:image` URLs are emitted on the vanity host (`npx convex env set SHARE_PUBLIC_BASE_URL https://verveq.com`).

## Publish

This is the mechanism `deploy.yml`'s SSH step drives on every master push
(`deploy.yml:5-6`). Run it by hand only for an out-of-band or frontend-only
publish, or to roll forward after a host move.

From the repo root on the host (as root; the script drops to `hermes` for the npm build itself — root-run npm leaves root-owned files that break later hermes-side builds):

```bash
cd /home/hermes/projects/verveq
export VITE_V2_SHELL_ENABLED=true
export VITE_CONVEX_URL=https://different-lynx-153.convex.cloud
export VITE_CONVEX_SITE_URL=https://different-lynx-153.convex.site
./deploy/build-and-run.sh
```

> **`VITE_DRAW_ENABLED` is intentionally absent above.** THE DRAW is dark: the
> flag is dev-only (`app/.env.local`), so `/draw` does not exist in the prod
> bundle. It is a double gate — even with the flag on, `drawSettings.enabled`
> (or tester membership) is checked server-side on every draw function, so the
> flag alone opens nothing. Both gates stay until the Home ticket links the
> mode. To run it locally:
>
> ```bash
> cd app
> # PowerShell: $env:VITE_DRAW_ENABLED = "true"; npm run dev
> VITE_DRAW_ENABLED=true npm run dev
> ```

This:
1. Runs `npm ci` + `vite build` in `app/` (as `hermes`).
2. Builds `verveq-web:<git-sha>-<stamp>` from `deploy/Dockerfile` (bundle + nginx conf baked in).
3. Calls `deploy/recreate-from-image.sh`, which renames the running container to `verveq-web-prev-<stamp>` and keeps it **stopped** as the instant rollback, then recreates `verveq-web` from the fresh image with the full Traefik label set and `--restart unless-stopped`.
4. Health-checks `http://127.0.0.1/healthz` inside the new container.

To redeploy an already-built image (e.g. promote a verified tag, or roll forward after a host move) without rebuilding:

```bash
/home/hermes/projects/verveq/deploy/recreate-from-image.sh verveq-web:<tag>
```

## One-command rollback

The previous container is kept stopped with its labels intact, so rollback is:

```bash
docker rm -f verveq-web && docker rename verveq-web-prev-<STAMP> verveq-web && docker start verveq-web
```

Replace `<STAMP>` with the name printed during the failed publish (`docker ps -a --filter name=verveq-web-prev` lists them). Alternatively, recreate from any previous image tag:

```bash
/home/hermes/projects/verveq/deploy/recreate-from-image.sh verveq-web:<previous-tag>
```

Prune `verveq-web-prev-*` containers and stale image tags only after the new release has soaked.

## Host-pinned verification

DNS resolves `verveq.com`/`www.verveq.com` to the host (verified 2026-06-12), so plain `curl`/browser checks work. Keep the `--resolve` pin for checks that must hit the origin independent of DNS (e.g. mid-propagation during a future host move):

```bash
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/ -I
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/robots.txt
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/sitemap.xml
```

Browser QA should walk `/privacy`, `/terms`, `/daily`, `/vervegrid`, `/v2/career-path`, `/higherlower`, `/arena/:code`, `/v2/arena`, `/v2/duels`, onboarding/upgrade validation states, and an unknown path. Capture final URL, visible content, console/page errors, failed requests, and non-2xx/3xx network responses.

## 2026-06-12 durable-cutover artifacts

Point-in-time recovery for the 7cd0687 release, in order of preference:

- Running image: `verveq-web:7cd0687-durable-20260612` (clean nginx base + live webroot + repo nginx.conf).
- Stopped previous container: `verveq-web-prev-20260612T145445Z` (the old writable-layer container; still holds 7cd0687 content).
- Snapshot image: `verveq-web:live-7cd0687-snapshot` (`docker commit` of the pre-cutover container), also exported to `/home/hermes/backups/verveq-web/durable-cutover-20260612/live-7cd0687-snapshot.tar` (`docker load -i` to restore).
