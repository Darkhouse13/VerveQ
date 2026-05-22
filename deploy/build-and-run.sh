#!/usr/bin/env bash
set -euo pipefail
DOMAIN="${1:-verveq.com}"
WWW_DOMAIN="www.${DOMAIN}"
CONVEX_URL="${VITE_CONVEX_URL:-}"
CONVEX_URL="${CONVEX_URL%/}"
if [[ -z "$CONVEX_URL" ]]; then
  echo "ERROR: export VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud first" >&2
  exit 2
fi
cd /home/hermes/projects/verveq/app
VITE_CONVEX_URL="$CONVEX_URL" npm run build
cd /home/hermes/projects/verveq
IMAGE="verveq-web:$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
docker build -f deploy/Dockerfile -t "$IMAGE" .
docker rm -f verveq-web >/dev/null 2>&1 || true
docker run -d --name verveq-web --restart unless-stopped \
  --network coolify \
  --label traefik.enable=true \
  --label traefik.http.middlewares.verveq-gzip.compress=true \
  --label traefik.http.middlewares.verveq-https.redirectscheme.scheme=https \
  --label traefik.http.routers.verveq-apex-http.entryPoints=http \
  --label "traefik.http.routers.verveq-apex-http.rule=Host(\`${DOMAIN}\`)" \
  --label traefik.http.routers.verveq-apex-http.middlewares=verveq-https \
  --label traefik.http.routers.verveq-www-http.entryPoints=http \
  --label "traefik.http.routers.verveq-www-http.rule=Host(\`${WWW_DOMAIN}\`)" \
  --label traefik.http.routers.verveq-www-http.middlewares=verveq-https \
  --label traefik.http.routers.verveq-apex-https.entryPoints=https \
  --label "traefik.http.routers.verveq-apex-https.rule=Host(\`${DOMAIN}\`)" \
  --label traefik.http.routers.verveq-apex-https.middlewares=verveq-gzip \
  --label traefik.http.routers.verveq-apex-https.tls=true \
  --label traefik.http.routers.verveq-apex-https.tls.certresolver=letsencrypt \
  --label traefik.http.routers.verveq-www-https.entryPoints=https \
  --label "traefik.http.routers.verveq-www-https.rule=Host(\`${WWW_DOMAIN}\`)" \
  --label traefik.http.routers.verveq-www-https.middlewares=verveq-gzip \
  --label traefik.http.routers.verveq-www-https.tls=true \
  --label traefik.http.routers.verveq-www-https.tls.certresolver=letsencrypt \
  --label traefik.http.services.verveq.loadbalancer.server.port=80 \
  "$IMAGE"
docker exec verveq-web wget -qO- http://127.0.0.1/healthz
