import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App.tsx";
import i18n from "./i18n";
import { initSentry } from "./lib/sentry";
import { initAnalytics } from "./lib/analytics";
import { armGa4 } from "./lib/ga4";
import { prefetchEntryRoute } from "./lib/inkEntry";
import { captureEntrySource } from "./lib/entrySource";
import { armExitAbandonReporting } from "./lib/gameAnalytics";
import { armPerfVitals } from "./lib/perfVitals";
import { registerServiceWorker } from "./lib/pwa";
import { armInstallPromptCapture, recordFirstVisitDay } from "./lib/installPrompt";
import { settleFirstVisitLanguage } from "./lib/languagePref";
import "./index.css";

// Arms error capture now (errors are buffered) and loads the SDK after first
// paint. No-op outside production builds that carry a DSN.
initSentry();
// Same fail-closed rule: no-op outside production builds that carry a
// VITE_POSTHOG_KEY. The SDK loads after first paint; events before then are
// queued with their original timestamps. Pageviews: AnalyticsPageviews in App.
initAnalytics();
// GA4 for search/acquisition reporting, after first paint (lib/ga4.ts).
armGa4();
// Which door this visit came through, read from the FIRST url this tab saw —
// /play and /s/d/:code both redirect, so anything later would read the
// destination instead of the entry. Storage only; captures no event.
captureEntrySource(window.location.pathname, window.location.search);
// Closing the tab mid-game tears down the JS context without React running any
// unmount cleanup, so the screens' own abandon handling never sees it.
armExitAbandonReporting();
// Field responsiveness data (worst INP, long tasks) — one summary event per
// page lifetime on pagehide; no-ops wherever analytics itself no-ops.
armPerfVitals();
// App-shell service worker (Workbox, autoUpdate). Production builds only —
// no sw.js is emitted under `vite dev`. Never intercepts Convex or PostHog.
registerServiceWorker();
// Chromium's one-shot install event, stashed for the hub-screen install bar.
armInstallPromptCapture();
// The install bar waits for a return visit on a later day.
recordFirstVisitDay();

// A first visit plays in the browser's language (or the FR/ES page it landed
// on) with no prompt; the switch lives in Settings.
settleFirstVisitLanguage();

// Reel traffic lands on a daily game: fetch its screen alongside the guest
// sign-in instead of after it.
prefetchEntryRoute(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
// The ink boot skeleton (index.html) has done its job once React paints.
requestAnimationFrame(() => document.documentElement.classList.remove("boot-ink"));
