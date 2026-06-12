#!/usr/bin/env bash
# Build the verveq-web image from the current checkout and recreate the
# production container from it. Publishes are image-based by construction:
# never docker-cp files into a running container — that strands the release
# in the container's writable layer, and the next recreate silently rolls
# production back to whatever the image tag holds.
set -euo pipefail

# --allow-dirty-build is the only flag; the first non-flag argument is the
# domain (default verveq.com).
ALLOW_DIRTY=0
DOMAIN=""
for arg in "$@"; do
  case "$arg" in
    --allow-dirty-build) ALLOW_DIRTY=1 ;;
    --*)
      echo "ERROR: unknown flag: $arg" >&2
      exit 2
      ;;
    *)
      if [[ -n "$DOMAIN" ]]; then
        echo "ERROR: unexpected argument: $arg" >&2
        exit 2
      fi
      DOMAIN="$arg"
      ;;
  esac
done
DOMAIN="${DOMAIN:-verveq.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Refuse to build from a dirty tree: build a8bb1bd shipped an uncommitted edit
# while its Sentry release claimed a clean SHA. Only app/ (every input to the
# vite bundle) and deploy/ (Dockerfile, nginx.conf) reach the image, so only
# dirt there can ship; gitignored files (node_modules, dist, .env.local,
# convex/_generated) are rebuilt or injected per-build and stay exempt.
IMAGE_PATHS=(app deploy)
DIRTY="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all -- "${IMAGE_PATHS[@]}")"

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"

# The Sentry release is RELEASE_SHA, which is also the image tag prefix below —
# one identifier from bundle to container, computed once so they can't drift.
# A dirty build (explicit override only) carries a "-dirty" suffix in both
# places so a release can never again claim a clean SHA for contents that
# weren't committed.
RELEASE_SHA="$GIT_SHA"
if [[ -n "$DIRTY" ]]; then
  if [[ "$ALLOW_DIRTY" -ne 1 ]]; then
    echo "ERROR: working tree is dirty under ${IMAGE_PATHS[*]} — these files would ship under a clean SHA:" >&2
    echo "$DIRTY" >&2
    echo "Commit or stash them, or rerun with --allow-dirty-build to release as ${GIT_SHA}-dirty." >&2
    exit 3
  fi
  RELEASE_SHA="${GIT_SHA}-dirty"
  echo "WARNING: --allow-dirty-build — releasing uncommitted changes as ${RELEASE_SHA}:" >&2
  echo "$DIRTY" >&2
fi
echo "release ${RELEASE_SHA} (HEAD ${GIT_SHA}, tree $([[ -n "$DIRTY" ]] && echo dirty || echo clean))"

CONVEX_URL="${VITE_CONVEX_URL:-}"
CONVEX_URL="${CONVEX_URL%/}"
if [[ -z "$CONVEX_URL" ]]; then
  echo "ERROR: export VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud first" >&2
  exit 2
fi

# npm must not run as root in this repo: root-owned node_modules/refs have
# broken hermes-side builds before. Drop to hermes for the bundle build;
# docker steps below still need root.
ENV_PREFIX="VITE_CONVEX_URL='$CONVEX_URL' VITE_RELEASE_SHA='$RELEASE_SHA'"
[[ -n "${VITE_CONVEX_SITE_URL:-}" ]] && ENV_PREFIX="$ENV_PREFIX VITE_CONVEX_SITE_URL='$VITE_CONVEX_SITE_URL'"
[[ -n "${VITE_V2_SHELL_ENABLED:-}" ]] && ENV_PREFIX="$ENV_PREFIX VITE_V2_SHELL_ENABLED='$VITE_V2_SHELL_ENABLED'"
[[ -n "${VITE_SENTRY_DSN:-}" ]] && ENV_PREFIX="$ENV_PREFIX VITE_SENTRY_DSN='$VITE_SENTRY_DSN'"

# Sentry source-map upload credentials (SENTRY_AUTH_TOKEN/SENTRY_ORG/
# SENTRY_PROJECT, optionally VITE_SENTRY_DSN) live in a hermes-owned 0600 env
# file and are sourced INSIDE the build shell — never inlined on a command
# line (visible in /proc cmdline), never committed, never copied into the
# image (the Dockerfile only takes app/dist). Missing file = build still
# succeeds, just without map upload; vite then emits no maps at all.
SENTRY_ENV_FILE="/home/hermes/.verveq-sentry-env"
BUILD_CMD="cd '$REPO_ROOT/app' && npm ci && { if [ -f '$SENTRY_ENV_FILE' ]; then set -a; . '$SENTRY_ENV_FILE'; set +a; fi; } && $ENV_PREFIX npm run build"
if [[ "$(id -u)" -eq 0 ]]; then
  runuser -l hermes -c "$BUILD_CMD"
else
  bash -c "$BUILD_CMD"
fi

cd "$REPO_ROOT"
IMAGE="verveq-web:${RELEASE_SHA}-$(date +%Y%m%d%H%M%S)"
docker build -f deploy/Dockerfile -t "$IMAGE" .
exec "$SCRIPT_DIR/recreate-from-image.sh" "$IMAGE" "$DOMAIN"
