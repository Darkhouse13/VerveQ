import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// Source-map upload to Sentry runs only when the deploy host provides the
// full credential set (plus the release SHA the maps belong to). When it
// does: maps are built as 'hidden' (no sourceMappingURL reference in the
// bundle), uploaded tied to the release, then deleted from dist/ so the
// deployed webroot never serves a .map. Without credentials no maps are
// generated at all — either way nothing map-shaped ships.
const SENTRY_UPLOAD_ENABLED = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    process.env.VITE_RELEASE_SHA,
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: SENTRY_UPLOAD_ENABLED ? ("hidden" as const) : false,
  },
  plugins: [
    react(),
    ...(SENTRY_UPLOAD_ENABLED
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: process.env.VITE_RELEASE_SHA },
            sourcemaps: {
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
            telemetry: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
