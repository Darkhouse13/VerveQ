import type { Breadcrumb, ErrorEvent } from "@sentry/react";
import { afterFirstPaint } from "./afterFirstPaint";

type SentryModule = typeof import("@sentry/react");

/**
 * Frontend error monitoring — errors only, privacy-safe.
 *
 * Scope is deliberately narrow: no session replay, no performance/browser
 * tracing, no profiling. The SDK initializes only in production builds that
 * were given a DSN (`VITE_SENTRY_DSN`); dev, preview, and DSN-less builds are
 * a complete no-op. `release` is the git short SHA injected at build time
 * (`VITE_RELEASE_SHA`), matching the deployed image tag so events map to the
 * exact bundle that produced them.
 *
 * PII handling fails closed: no IP/user context ever leaves the client, the
 * page URL (which can carry duel link codes) is dropped with the rest of the
 * request envelope, and breadcrumbs are reduced to a scrubbed allowlist.
 * When in doubt about a field, remove it. The SDK sets no cookies.
 */

/** Strip query string and fragment — that's where tokens/codes would live. */
function scrubUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  return url.split(/[?#]/)[0];
}

/**
 * Allowlist-style breadcrumb scrubbing. Returning null drops the crumb.
 *  - console: dropped entirely (free-form text can echo usernames/answers)
 *  - fetch/xhr: method + status + query-stripped URL only (no bodies)
 *  - navigation: query-stripped from/to paths only
 *  - everything else (ui.click selectors, etc.): keep shape, drop `data`
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category === "console") return null;
  if (crumb.category === "fetch" || crumb.category === "xhr") {
    return {
      type: crumb.type,
      category: crumb.category,
      timestamp: crumb.timestamp,
      level: crumb.level,
      data: {
        method:
          typeof crumb.data?.method === "string" ? crumb.data.method : undefined,
        status_code:
          typeof crumb.data?.status_code === "number"
            ? crumb.data.status_code
            : undefined,
        url: scrubUrl(crumb.data?.url),
      },
    };
  }
  if (crumb.category === "navigation") {
    return {
      type: crumb.type,
      category: crumb.category,
      timestamp: crumb.timestamp,
      level: crumb.level,
      data: {
        from: scrubUrl(crumb.data?.from),
        to: scrubUrl(crumb.data?.to),
      },
    };
  }
  return { ...crumb, data: undefined };
}

/**
 * Fail-closed event scrub: drop the user envelope (IP, id, username — we
 * never want any of it), the request envelope (page URL incl. duel link
 * codes, headers, cookies), and re-scrub breadcrumbs as a backstop in case
 * any crumb bypassed beforeBreadcrumb.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.request;
  delete event.server_name;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  return event;
}

/**
 * Errors thrown by scripts that in-app browsers (Instagram/Facebook WebViews)
 * inject into the page itself — their native bridge dying is not our bug and
 * not actionable. Strings match as substrings, regexes as-is (Sentry
 * inboundFilters semantics). Injected frames can carry our page URL as the
 * filename, so URL-based filtering can't catch these; match on message.
 */
export const IGNORE_ERROR_PATTERNS: (string | RegExp)[] = [
  // Android WebView: page JS posts to a bridge object the host app already
  // tore down ("Error invoking postMessage: Java object is gone").
  "Java object is gone",
  // iOS WKWebView: injected pagehide handlers dereference
  // window.webkit.messageHandlers after the handler was removed.
  /window\.webkit\.messageHandlers/,
];

function sentryEnabled(): boolean {
  return import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN;
}

let sentryModule: Promise<SentryModule | null> | null = null;

/** The SDK, loaded once on demand (and initialized when enabled). */
function loadSentry(): Promise<SentryModule | null> {
  if (!sentryModule) {
    sentryModule = import("@sentry/react")
      .then((Sentry) => {
        if (sentryEnabled()) {
          Sentry.init({
            dsn: import.meta.env.VITE_SENTRY_DSN,
            environment: "production",
            release: import.meta.env.VITE_RELEASE_SHA,
            sendDefaultPii: false,
            // Errors only: no tracing/replay/profiling integrations are
            // registered, and the explicit 0 keeps it that way.
            tracesSampleRate: 0,
            // BrowserSession (release-health pings on every pageload) is on
            // by default — drop it so nothing leaves unless an error occurs.
            integrations: (defaults) =>
              defaults.filter((integration) => integration.name !== "BrowserSession"),
            ignoreErrors: IGNORE_ERROR_PATTERNS,
            beforeSend: scrubEvent,
            beforeBreadcrumb: scrubBreadcrumb,
          });
        }
        return Sentry;
      })
      .catch(() => null);
  }
  return sentryModule;
}

/**
 * Error monitoring, deferred: the SDK loads after first paint (or on the
 * first error) so it stays off the entry routes' critical path. Errors thrown
 * before it arrives are buffered and reported once it does.
 */
export function initSentry(): void {
  if (!sentryEnabled() || typeof window === "undefined") return;
  const early: unknown[] = [];
  const onError = (event: globalThis.ErrorEvent) => early.push(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => early.push(event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  const start = () => {
    void loadSentry().then((Sentry) => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      if (!Sentry) return;
      for (const error of early.splice(0, 20)) Sentry.captureException(error);
    });
  };
  afterFirstPaint(start);
}

/** Report a caught error (render crashes). No-op unless Sentry is enabled. */
export function captureError(error: unknown, context?: Parameters<SentryModule["captureException"]>[1]): void {
  void loadSentry().then((Sentry) => Sentry?.captureException(error, context));
}
