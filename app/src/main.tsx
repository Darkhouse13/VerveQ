import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App.tsx";
import i18n from "./i18n";
import { initSentry } from "./lib/sentry";
import { initAnalytics } from "./lib/analytics";
import { captureEntrySource } from "./lib/entrySource";
import { armExitAbandonReporting } from "./lib/gameAnalytics";
import "./index.css";

// Before first render so global handlers catch everything from frame one.
// No-op outside production builds that carry a DSN.
initSentry();
// Same fail-closed rule: no-op outside production builds that carry a
// VITE_POSTHOG_KEY. Pageviews are captured by AnalyticsPageviews in App.
initAnalytics();
// Which door this visit came through, read from the FIRST url this tab saw —
// /play and /s/d/:code both redirect, so anything later would read the
// destination instead of the entry. Storage only; captures no event.
captureEntrySource(window.location.pathname, window.location.search);
// Closing the tab mid-game tears down the JS context without React running any
// unmount cleanup, so the screens' own abandon handling never sees it.
armExitAbandonReporting();

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
