# VerveQ Deployment Runbook

This is the authoritative runbook for the production frontend at `verveq.com`. Publishes are **image-based and durable by construction**: every release builds and tags a fresh Docker image and recreates the container from it. Never `docker cp` files into the running container — that strands the release in the container's writable layer, and the next recreate silently rolls production back to whatever the image tag holds. (This happened: the 2026-06-12 live state existed only in the writable layer of an image tagged 2026-05-27 until the durable cutover that same day.)

## Production topology

- Host: `178.104.196.36` (pin this host for QA while DNS is stale).
- Container: `verveq-web`, image `verveq-web:<git-sha>-<stamp>`.
- Fronting: Traefik (`coolify-proxy`) routes `verveq.com`/`www.verveq.com` to the container's nginx on port 80. Routing and TLS come **entirely from labels passed at `docker run`** (see `deploy/recreate-from-image.sh`); TLS certs live in Traefik's acme store and survive container recreation.
- The container is **not managed by Coolify** — nothing auto-redeploys it on git push. Recreates only happen via the scripts below.
- Image contents: static SPA bundle at `/usr/share/nginx/html` + `deploy/nginx.conf` at `/etc/nginx/conf.d/default.conf`, baked in by `deploy/Dockerfile`. No host volume mounts.
- Backend: Convex is unchanged for frontend-only releases. Production builds use `VITE_CONVEX_URL=https://admired-warthog-495.eu-west-1.convex.cloud` and `VITE_CONVEX_SITE_URL=https://admired-warthog-495.eu-west-1.convex.site`.
- Duel share vanity route: nginx proxies `verveq.com/s/d/*` (page + `card.png`) to the Convex `.site` httpAction (`deploy/nginx.conf` `location ^~ /s/d/`), forwarding path and `User-Agent` intact. The Convex deployment carries `SHARE_PUBLIC_BASE_URL=https://verveq.com` so `og:image` URLs are emitted on the vanity host (`npx convex env set SHARE_PUBLIC_BASE_URL https://verveq.com`).

## Publish

From the repo root on the host (as root; the script drops to `hermes` for the npm build itself — root-run npm leaves root-owned files that break later hermes-side builds):

```bash
cd /home/hermes/projects/verveq
export VITE_V2_SHELL_ENABLED=true
export VITE_CONVEX_URL=https://admired-warthog-495.eu-west-1.convex.cloud
export VITE_CONVEX_SITE_URL=https://admired-warthog-495.eu-west-1.convex.site
./deploy/build-and-run.sh
```

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

Use host-pinned curl/browser checks until DNS is corrected:

```bash
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/ -I
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/robots.txt
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/sitemap.xml
```

Browser QA should pin `verveq.com` and `www.verveq.com` to `178.104.196.36`, walk `/privacy`, `/terms`, `/daily`, `/vervegrid`, `/whoami`, `/higherlower`, `/arena/:code`, `/v2/arena`, `/v2/duels`, onboarding/upgrade validation states, and an unknown path. Capture final URL, visible content, console/page errors, failed requests, and non-2xx/3xx network responses.

## 2026-06-12 durable-cutover artifacts

Point-in-time recovery for the 7cd0687 release, in order of preference:

- Running image: `verveq-web:7cd0687-durable-20260612` (clean nginx base + live webroot + repo nginx.conf).
- Stopped previous container: `verveq-web-prev-20260612T145445Z` (the old writable-layer container; still holds 7cd0687 content).
- Snapshot image: `verveq-web:live-7cd0687-snapshot` (`docker commit` of the pre-cutover container), also exported to `/home/hermes/backups/verveq-web/durable-cutover-20260612/live-7cd0687-snapshot.tar` (`docker load -i` to restore).
