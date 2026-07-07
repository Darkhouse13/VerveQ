import posthog from "posthog-js";

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

let initialized = false;

/** Replace code-bearing path segments so share/join codes never leave.
 *  Every rule is anchored to the FULL path ($) so a later, more generic rule
 *  can never re-match the placeholder a earlier rule just produced. */
export function scrubPath(pathname: string): string {
  return pathname
    .replace(/^\/duel\/play\/[^/]+$/, "/duel/play/:id")
    .replace(/^\/duel\/result\/[^/]+$/, "/duel/result/:id")
    .replace(/^\/duel\/[^/]+$/, "/duel/:code")
    .replace(/^\/v2\/arena\/[^/]+$/, "/v2/arena/:code")
    .replace(/^\/arena\/[^/]+$/, "/arena/:code")
    .replace(/^\/s\/d\/[^/]+$/, "/s/d/:code")
    .replace(/^\/rivals\/[^/]+$/, "/rivals/:id");
}

/** Keep only attribution params; everything else (next=, codes) is dropped. */
export function scrubSearch(search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) {
    if (key === "ref" || key.startsWith("utm_")) kept.set(key, value);
  }
  const serialized = kept.toString();
  return serialized ? `?${serialized}` : "";
}

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!import.meta.env.PROD || !key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "localStorage",
    person_profiles: "identified_only",
  });
  initialized = true;
}

/** One $pageview per route change; the route path IS the game mode, so this
 *  alone answers "which modes get played" without per-screen call sites. */
export function capturePageview(pathname: string, search: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", {
    $current_url: `${window.location.origin}${scrubPath(pathname)}${scrubSearch(search)}`,
  });
}

/** Explicit product events; silently no-ops when analytics is off. */
export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}
