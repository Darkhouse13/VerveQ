import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Near-black brand ink: `--foreground` / `--border` / `--neo-shadow-color` are
// all `0 0% 7%` in src/index.css. Drives the manifest's theme_color and the
// <meta name="theme-color"> in index.html, so the browser chrome reads as the
// neo-brutalist frame around the app.
const BRAND_INK = "#121212";

// The shell's actual canvas: `--background` is `30 100% 97%` in src/index.css
// (:root — note `.dark` is never applied, so this is what every session
// paints). The splash screen uses it rather than the ink so the handoff from
// splash to first render is a continuation instead of a black-to-cream flash.
const BRAND_CANVAS = "#FFF7F0";

// Origins the service worker must never intercept, cache, or fallback-route.
// Convex carries every query/mutation/action plus auth; a cached or
// SW-mediated response there breaks real-time sync. PostHog is fire-and-forget
// analytics that must not be replayed from cache. Both are registered as
// explicit NetworkOnly routes rather than left to fall through unmatched, so
// the exclusion is a stated contract in the generated sw.js instead of an
// accident of route ordering.
const CONVEX_URL_PATTERN = /^https:\/\/[^/]+\.convex\.(cloud|site)\//;
const POSTHOG_URL_PATTERN = /^https:\/\/[^/]+\.posthog\.com\//;
// verveq.com/s/d/* is proxied by nginx straight to the Convex .site
// httpAction (deploy/nginx.conf `location ^~ /s/d/`), which serves the OG
// taunt card to crawlers and 302s humans. It must reach the network untouched
// — both as a navigation (denylist) and as a subresource (NetworkOnly).
const SHARE_ROUTE_PATTERN = /^\/s\/d\//;

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
    VitePWA({
      registerType: "autoUpdate",
      // Registration lives in src/main.tsx via `virtual:pwa-register`, so it
      // ships inside the hashed bundle instead of as a separate unhashed
      // registerSW.js the html would have to reference.
      injectRegister: null,
      includeAssets: ["vq-logo.png", "apple-touch-icon-180x180.png", "robots.txt"],
      manifest: {
        id: "/",
        name: "VerveQ",
        short_name: "VerveQ",
        description:
          "Prove you know more than your mates — head-to-head football trivia. Play free, no sign-up.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        lang: "en",
        theme_color: BRAND_INK,
        background_color: BRAND_CANVAS,
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App shell only. public/arena-logos (291 files, 1.4M) and
        // public/games are demand-loaded artwork — precaching them would pay
        // their whole weight on every install for assets most sessions never
        // request.
        globPatterns: [
          "index.html",
          "assets/**/*.{js,css,woff2}",
          "vq-logo.png",
          "pwa-*.png",
          "apple-touch-icon-*.png",
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        // Everything nginx serves from something other than the SPA shell.
        // Without these a navigation to any of them would be answered with
        // index.html out of the precache and soft-404 as the app.
        navigateFallbackDenylist: [
          SHARE_ROUTE_PATTERN,
          /^\/healthz$/,
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/og\//,
          /\.map$/,
        ],
        runtimeCaching: [
          // Order matters — Workbox matches routes in registration order, so
          // every pass-through rule is declared before any caching one.
          //
          // Both methods are registered deliberately: Workbox's registerRoute
          // defaults to GET, and Convex's HTTP transport (queries, mutations,
          // actions, auth) is POST — a GET-only rule would leave the calls
          // that matter relying on unmatched-request fall-through instead of
          // a stated exclusion. PostHog's capture endpoint is POST likewise.
          // (The Convex realtime WebSocket needs no rule at all: service
          // workers never see WebSocket handshakes.)
          { urlPattern: CONVEX_URL_PATTERN, handler: "NetworkOnly", method: "GET" },
          { urlPattern: CONVEX_URL_PATTERN, handler: "NetworkOnly", method: "POST" },
          { urlPattern: POSTHOG_URL_PATTERN, handler: "NetworkOnly", method: "GET" },
          { urlPattern: POSTHOG_URL_PATTERN, handler: "NetworkOnly", method: "POST" },
          // The share vanity route is only ever fetched as a navigation or an
          // <img> (card.png), so GET alone covers it.
          { urlPattern: SHARE_ROUTE_PATTERN, handler: "NetworkOnly", method: "GET" },
          {
            // The only fonts the app loads are Google-hosted (index.html
            // <link>), so "precache the fonts" has to be a runtime rule.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "verveq-fonts",
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
              // Font files come back opaque (status 0) from the CDN.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
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
