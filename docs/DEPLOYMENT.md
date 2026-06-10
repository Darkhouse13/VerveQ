# VerveQ Deployment Runbook

This is the authoritative runbook for the production frontend at `verveq.com` on the current host. Older notes in this repo described local-only validation, immutable Docker image rollouts, or backend/curated-parity workflows; those are not the procedure used for the current static frontend publish.

## Production topology

- Host: `178.104.196.36` (pin this host for QA while DNS is stale).
- Container: `verveq-web`.
- Fronting: Traefik/Coolify routes traffic to the nginx container on port 80; nginx serves the static SPA inside the container.
- Served docroot: `verveq-web:/usr/share/nginx/html` (container-internal; no host volume mount).
- nginx config: `verveq-web:/etc/nginx/conf.d/default.conf`, sourced from `deploy/nginx.conf`.
- Backend: Convex is unchanged for frontend-only releases. The current production build uses `VITE_CONVEX_URL=https://admired-warthog-495.eu-west-1.convex.cloud` and `VITE_CONVEX_SITE_URL=https://admired-warthog-495.eu-west-1.convex.site`.

## Build

From the repo root on the host:

```bash
cd /home/hermes/projects/verveq/app
npm ci
VITE_V2_SHELL_ENABLED=true \
VITE_CONVEX_URL=https://admired-warthog-495.eu-west-1.convex.cloud \
VITE_CONVEX_SITE_URL=https://admired-warthog-495.eu-west-1.convex.site \
npm run build
```

Package the bundle:

```bash
tar -C /home/hermes/projects/verveq/app/dist -czf /home/hermes/backups/verveq-web/<STAMP>/candidate-dist.tgz .
sha256sum /home/hermes/backups/verveq-web/<STAMP>/candidate-dist.tgz > /home/hermes/backups/verveq-web/<STAMP>/candidate-dist.tgz.sha256
```

## Required pre-publish backup

Back up both layers before publishing: the current webroot and the current nginx config.

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/home/hermes/backups/verveq-web/pre-launch-qa-$stamp
mkdir -p "$backup"
docker exec verveq-web sh -c 'cd /usr/share/nginx/html && tar -czf /tmp/webroot.tgz .'
docker cp verveq-web:/tmp/webroot.tgz "$backup/webroot.tgz"
docker exec verveq-web sh -c 'cat /etc/nginx/conf.d/default.conf' > "$backup/nginx.default.conf"
sha256sum "$backup/webroot.tgz" "$backup/nginx.default.conf" > "$backup/SHA256SUMS"
mkdir "$backup/restore-test" && tar -xzf "$backup/webroot.tgz" -C "$backup/restore-test" && test -s "$backup/restore-test/index.html"
```

## Publish static bundle and nginx config

This deployment is not a pure static swap. Apply the bundle and nginx config together, validate nginx, then reload it.

```bash
backup=/home/hermes/backups/verveq-web/pre-launch-qa-<STAMP>
docker cp /home/hermes/backups/verveq-web/<STAMP>/candidate-dist.tgz verveq-web:/tmp/verveq-dist.tgz
docker cp /home/hermes/projects/verveq/deploy/nginx.conf verveq-web:/etc/nginx/conf.d/default.conf
docker exec verveq-web sh -c 'set -e; root=/usr/share/nginx/html; find "$root" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf /tmp/verveq-dist.tgz -C "$root"; find "$root" -type d -exec chmod 755 {} +; find "$root" -type f -exec chmod 644 {} +; nginx -t; nginx -s reload; wget -qO- http://127.0.0.1/healthz'
```

## One-command rollback

Rollback covers both layers: restore the pre-deploy webroot and the pre-deploy nginx config, then validate and reload nginx.

```bash
backup=/home/hermes/backups/verveq-web/pre-launch-qa-<STAMP>; docker cp "$backup/webroot.tgz" verveq-web:/tmp/rollback-webroot.tgz && docker cp "$backup/nginx.default.conf" verveq-web:/etc/nginx/conf.d/default.conf && docker exec verveq-web sh -c 'set -e; root=/usr/share/nginx/html; parent=/usr/share/nginx; rm -rf "$parent/html.rollback" "$parent/html.prev"; mkdir "$parent/html.rollback"; tar -xzf /tmp/rollback-webroot.tgz -C "$parent/html.rollback"; test -s "$parent/html.rollback/index.html"; mv "$root" "$parent/html.prev"; mv "$parent/html.rollback" "$root"; rm -rf "$parent/html.prev"; nginx -t; nginx -s reload; wget -qO- http://127.0.0.1/healthz'
```

Before running rollback in production, replace `<STAMP>` with the exact backup directory from the failed publish.

## Host-pinned verification

Use host-pinned curl/browser checks until DNS is corrected:

```bash
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/ -I
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/robots.txt
curl --resolve verveq.com:443:178.104.196.36 https://verveq.com/sitemap.xml
```

Browser QA should pin `verveq.com` and `www.verveq.com` to `178.104.196.36`, walk `/privacy`, `/terms`, `/daily`, `/vervegrid`, `/whoami`, `/higherlower`, `/arena/:code`, `/v2/arena`, `/v2/duels`, `/v2/leaderboard`, onboarding/upgrade validation states, and an unknown path. Capture final URL, visible content, console/page errors, failed requests, and non-2xx/3xx network responses.
