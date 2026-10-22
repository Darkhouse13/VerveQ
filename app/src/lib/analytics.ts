import type { PostHog } from "posthog-js";
import { afterFirstPaint } from "./afterFirstPaint";

/**
 * Product analytics — PostHog, fail-closed and privacy-scoped.
 *
 * Mirrors the Sentry posture (lib/sentry.ts): the SDK initializes only in
 * production builds that were given a key (`VITE_POSTHOG_KEY`); dev, preview,
 * and key-less builds are a complete no-op. Nothing leaves the client except
 * what this module explicitly captures:
 *
 *  - autocapture, session recording, and pageleave beacons are OFF
 *  - SPA pageviews are captured manually on route change (App mounts
 *    AnalyticsPageviews), with join/share codes scrubbed from the path and
 *    the query string reduced to attribution params (ref, utm_*)
 *  - persistence is first-party localStorage — no cookies — so returning
 *    visitors count once and retention curves are real
 */

/** True once initAnalytics() decided to run (prod build with a key). */
let enabled = false;
/** The SDK, set once it has loaded. */
let posthog: PostHog | null = null;
/** Calls made before the SDK arrived, replayed in order once it does. */
const pending: Array<(ph: PostHog) => void> = [];
const MAX_PENDING = 200;

/** Run now if the SDK is ready, queue if it is still loading, drop if off. */
function withPosthog(fn: (ph: PostHog) => void): void {
  if (posthog) fn(posthog);
  else if (enabled && pending.length < MAX_PENDING) pending.push(fn);
}

/**
 * Verification test mode — OFF unless a local build sets
 * VITE_ANALYTICS_TEST_MODE. The account has one PostHog project, which also
 * holds the real baseline, so a manual verification pass has to fire synthetic
 * events into the same dataset. Test mode marks every one of them:
 *
 *  - `is_test: true` + `env: "test"` as super properties, so they ride on
 *    EVERY capture from this client (including $pageview) without touching
 *    any existing call site
 *  - a `test_anon_` distinct_id, bootstrapped so the id is test-scoped from
 *    the very first event rather than from the first identify()
 *
 * Analysis excludes them with `is_test != true` (HogQL comparisons are
 * null-safe, so baseline events — which carry no such property — are kept).
 *
 * deploy/build-and-run.sh forwards only VITE_POSTHOG_KEY/_HOST, so this flag
 * cannot reach a deployed bundle and real traffic can never be marked as test.
 */
const TEST_MODE = import.meta.env.VITE_ANALYTICS_TEST_MODE === "1";

/** Ids that must never be handed to identify(). AuthContext's tab-local guest
 *  (LOCAL_GUEST_USER) hardcodes `guest_tab` for EVERY such visitor, so
 *  identifying it would collapse unrelated strangers into one person. */
const NEVER_IDENTIFY = new Set(["guest_tab", "", "null", "undefined"]);

/**
 * The test-scoped anonymous id, stable for the life of the browser profile.
 *
 * It MUST be read back rather than regenerated: bootstrap.distinctID applies on
 * every init, so minting a fresh uuid per page load gives each navigation its
 * own identity. Real users never hit that (no bootstrap; posthog persists the
 * id itself), but it would quietly break the one thing the verification pass
 * exists to prove — that identify() merges pre-claim anonymous history — since
 * the claim would merge only the last page's id and orphan everything before it.
 */
const TEST_ANON_KEY = "vq_test_anon_id";

function stableTestAnonId(): string {
  try {
    const existing = localStorage.getItem(TEST_ANON_KEY);
    if (existing) return existing;
    const minted = `test_anon_${crypto.randomUUID()}`;
    localStorage.setItem(TEST_ANON_KEY, minted);
    return minted;
  } catch {
    return `test_anon_${crypto.randomUUID()}`;
  }
}

/** Replace code-bearing path segments so share/join codes never leave.
 *  Every rule is anchored to the FULL path ($) so a later, more generic rule
 *  can never re-match the placeholder a earlier rule just produced. */
export function scrubPath(pathname: string): string {
  return pathname
    .replace(/^\/duel\/play\/[^/]+$/, "/duel/play/:id")
    .replace(/^\/duel\/result\/[^/]+$/, "/duel/result/:id")
    .replace(/^\/duel\/[^/]+$/, "/duel/:code")
    .replace(/^\/arena\/[^/]+$/, "/arena/:code")
    .replace(/^\/arena\/[^/]+$/, "/arena/:code")
    .replace(/^\/s\/d\/[^/]+$/, "/s/d/:code")
    .replace(/^\/rivals\/[^/]+$/, "/rivals/:id");
}

/** Keep only attribution params; everything else (next=, codes) is dropped.
 *  `entry` is the short-link landing tag (weekendDeepLink.ts, WKND-ENTRY) —
 *  attribution, not payload, so pageviews may carry it. */
export function scrubSearch(search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === "ref" || key === "entry" || key.startsWith("utm_")) {
      kept.set(key, value);
    }
  }
  const serialized = kept.toString();
  return serialized ? `?${serialized}` : "";
}

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!import.meta.env.PROD || !key) return;

  enabled = true;
  // The SDK loads after first paint (or the first tap) so it stays off the
  // entry routes' critical path; anything tracked before then is queued.
  afterFirstPaint(() => {
    void import("posthog-js").then(({ default: ph }) => {
      ph.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        persistence: "localStorage",
        person_profiles: "identified_only",
        // Test-mode only: mint a test-scoped anonymous id up front so synthetic
        // events are filterable by distinct_id as well as by property.
        ...(TEST_MODE
          ? {
              bootstrap: { distinctID: stableTestAnonId() },
              // posthog-js drops every event from an automated browser, and does
              // it silently — it checks the UA blocklist, navigator.userAgentData
              // .brands (which still says HeadlessChrome even when the UA string
              // is overridden) and navigator.webdriver. This flag opts OUT of that
              // filter; without it the scripted verification pass sends NOTHING and
              // reads as a broken app.
              //
              // Test-mode only, and it must stay that way: setting it in production
              // would opt prod out of the bot filter and let crawler hits into the
              // /games/ funnel. Production keeps crawlers out precisely BECAUSE
              // this is absent there.
              opt_out_useragent_filter: true,
            }
          : {}),
      });
      if (TEST_MODE) ph.register({ is_test: true, env: "test" });
      posthog = ph;
      for (const fn of pending.splice(0)) fn(ph);
    });
  });
}

/** One $pageview per route change; the route path IS the game mode, so this
 *  alone answers "which modes get played" without per-screen call sites. */
export function capturePageview(pathname: string, search: string): void {
  const url = `${window.location.origin}${scrubPath(pathname)}${scrubSearch(search)}`;
  const timestamp = new Date();
  withPosthog((ph) => ph.capture("$pageview", { $current_url: url }, { timestamp }));
}

/** Explicit product events; silently no-ops when analytics is off. */
export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  const timestamp = new Date();
  withPosthog((ph) => ph.capture(event, properties, { timestamp }));
}

/**
 * Capture during page teardown. Uses sendBeacon because a normal request
 * started in a pagehide handler is routinely cancelled as the document goes
 * away — the browser owes an unloading page nothing.
 */
export function trackOnExit(
  event: string,
  properties?: Record<string, unknown>,
): void {
  // Before the SDK has loaded there is nothing to send with; the page is
  // going away, so a queued call would never run.
  posthog?.capture(event, properties, { transport: "sendBeacon" });
}

/**
 * Tie the anonymous distinct_id to a stable account id, so a return on another
 * device (or after a storage clear) stitches to the same person.
 *
 * `accountId` must be the Convex users doc id (AuthUser._id). Under
 * person_profiles: "identified_only" this is what mints the person profile;
 * PostHog then attributes the pre-claim anonymous events to it, so curiosity
 * history survives the claim (they stay BILLED as anonymous, which is why
 * identified_only is kept — it is ~4x cheaper and loses nothing here).
 *
 * Returns whether it identified, so callers can assert in tests.
 */
export function identifyAccount(accountId: string | null | undefined): boolean {
  if (!enabled || !accountId || NEVER_IDENTIFY.has(accountId)) return false;
  withPosthog((ph) => ph.identify(accountId));
  return true;
}

/** Drop the identity on logout so the next visitor on this device starts as a
 *  fresh anonymous person instead of inheriting the last one's profile. */
export function resetIdentity(): void {
  withPosthog((ph) => ph.reset());
}
