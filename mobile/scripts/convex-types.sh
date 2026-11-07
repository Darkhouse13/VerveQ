#!/usr/bin/env bash
# Type-only snapshot of the web app's Convex API for the mobile app.
# Re-run after backend changes: npm run convex-types
set -euo pipefail
cd "$(dirname "$0")/../../app"
OUT=../mobile/.convex-types
npx tsc --declaration --emitDeclarationOnly --noEmit false --skipLibCheck \
  --strict false --target es2020 --module esnext --moduleResolution bundler \
  --types node --rootDir . --outDir "$OUT" convex/_generated/api.d.ts 2>&1 | grep -v "error TS" || true
mkdir -p "$OUT/convex/_generated"
cp convex/_generated/api.d.ts convex/_generated/dataModel.d.ts convex/_generated/server.d.ts "$OUT/convex/_generated/"
echo "convex types → $OUT"
