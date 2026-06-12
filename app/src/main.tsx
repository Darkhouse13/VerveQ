import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App.tsx";
import i18n from "./i18n";
import { initSentry } from "./lib/sentry";
import "./index.css";

// Before first render so global handlers catch everything from frame one.
// No-op outside production builds that carry a DSN.
initSentry();

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>,
);
