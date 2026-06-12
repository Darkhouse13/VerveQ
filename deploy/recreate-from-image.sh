#!/usr/bin/env bash
# Recreate the production verveq-web container from an already-built image.
# The previous container is kept STOPPED (renamed verveq-web-prev-<stamp>) as
# the instant rollback:
#   docker rm -f verveq-web && docker rename verveq-web-prev-<stamp> verveq-web && docker start verveq-web
# Usage: recreate-from-image.sh <image> [domain]
set -euo pipefail
IMAGE="${1:?usage: recreate-from-image.sh <image> [domain]}"
DOMAIN="${2:-verveq.com}"
WWW_DOMAIN="www.${DOMAIN}"
docker image inspect "$IMAGE" >/dev/null

if docker inspect verveq-web >/dev/null 2>&1; then
  OLD_NAME="verveq-web-prev-$(date -u +%Y%m%dT%H%M%SZ)"
  docker rename verveq-web "$OLD_NAME"
  docker stop "$OLD_NAME" >/dev/null
  echo "previous container kept stopped as: $OLD_NAME"
fi

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
echo
echo "verveq-web now running image: $IMAGE"
