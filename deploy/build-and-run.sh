#!/usr/bin/env bash
# Build the verveq-web image from the current checkout and recreate the
# production container from it. Publishes are image-based by construction:
# never docker-cp files into a running container — that strands the release
# in the container's writable layer, and the next recreate silently rolls
# production back to whatever the image tag holds.
set -euo pipefail
DOMAIN="${1:-verveq.com}"
CONVEX_URL="${VITE_CONVEX_URL:-}"
CONVEX_URL="${CONVEX_URL%/}"
if [[ -z "$CONVEX_URL" ]]; then
  echo "ERROR: export VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud first" >&2
  exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# npm must not run as root in this repo: root-owned node_modules/refs have
# broken hermes-side builds before. Drop to hermes for the bundle build;
# docker steps below still need root.
ENV_PREFIX="VITE_CONVEX_URL='$CONVEX_URL'"
[[ -n "${VITE_CONVEX_SITE_URL:-}" ]] && ENV_PREFIX="$ENV_PREFIX VITE_CONVEX_SITE_URL='$VITE_CONVEX_SITE_URL'"
[[ -n "${VITE_V2_SHELL_ENABLED:-}" ]] && ENV_PREFIX="$ENV_PREFIX VITE_V2_SHELL_ENABLED='$VITE_V2_SHELL_ENABLED'"
BUILD_CMD="cd '$REPO_ROOT/app' && npm ci && $ENV_PREFIX npm run build"
if [[ "$(id -u)" -eq 0 ]]; then
  runuser -l hermes -c "$BUILD_CMD"
else
  bash -c "$BUILD_CMD"
fi

cd "$REPO_ROOT"
IMAGE="verveq-web:$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
docker build -f deploy/Dockerfile -t "$IMAGE" .
exec "$SCRIPT_DIR/recreate-from-image.sh" "$IMAGE" "$DOMAIN"
