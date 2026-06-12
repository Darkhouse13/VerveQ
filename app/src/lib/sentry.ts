import * as Sentry from "@sentry/react";
import type { Breadcrumb, ErrorEvent } from "@sentry/react";

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

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!import.meta.env.PROD || !dsn) return;

  Sentry.init({
    dsn,
    environment: "production",
    release: import.meta.env.VITE_RELEASE_SHA,
    sendDefaultPii: false,
    // Errors only: no tracing/replay/profiling integrations are registered,
    // and the explicit 0 keeps it that way if defaults ever shift.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
