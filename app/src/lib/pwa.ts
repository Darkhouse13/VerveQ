/**
 * Service worker registration.
 *
 * The worker itself is generated at build time by vite-plugin-pwa (Workbox
 * generateSW, `registerType: "autoUpdate"`), which is also where the update
 * semantics live: the generated sw.js calls skipWaiting + clientsClaim, so a
 * new release takes over without a custom update prompt. That leaves nothing
 * for the registration side to do beyond pointing at the file, which is why
 * this is a plain `navigator.serviceWorker.register` rather than the plugin's
 * `virtual:pwa-register` helper — the virtual module is only resolvable when
 * the PWA plugin is loaded, and vitest.config.ts runs without it.
 *
 * Production-only, matching the fail-closed convention initSentry() and
 * initAnalytics() already follow: no sw.js exists under `vite dev`, and
 * registering one there would 404 on every cold load.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Registration competes with the app's own first paint for bandwidth, so it
  // waits for load rather than racing the initial render.
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // A failed registration costs the install prompt and offline shell, not
      // the session — the app runs fine unregistered, so this stays silent.
    });
  });
}
