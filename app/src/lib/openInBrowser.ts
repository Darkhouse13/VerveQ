/**
 * One-tap hand-off from Instagram's in-app browser to the phone's real browser
 * (Chrome on Android, Safari on iOS), carrying the daily streak with a `?st=`
 * link.
 *
 * Why: players inside Instagram come back the next day about half as often as
 * players in a phone browser (PostHog, Oct 2026). Instagram's browser keeps no
 * home-screen icon or tab to come back to, and the copy-a-link card it
 * replaces was used twice.
 *
 *  - Android: an `intent://` URL hands the page to Chrome. If Chrome is
 *    missing, `browser_fallback_url` reloads it where it is (harmless).
 *  - iOS 17+: the `x-safari-https://` scheme opens Safari.
 *
 * The link carries `ref=open_in_browser` so the arrival is measurable and the
 * browser it lands in can offer "Add to Home screen" straight away.
 */

export type HandoffPlatform = "android" | "ios";

export const HANDOFF_REF = "open_in_browser";

/** Set in the browser the player lands in; read by the result screen's install hint. */
const ARRIVED_KEY = "verveq_handoff_arrived";
/** A minted streak token per game, reused so re-renders don't burn the 5/day mint limit. */
const TOKEN_KEY_PREFIX = "verveq_handoff_token_";
/** Tokens live 7 days on the server; reuse for 6 so a reused one never expires mid-tap. */
const TOKEN_REUSE_MS = 6 * 24 * 60 * 60 * 1000;

/** Which hand-off this in-app browser supports, or null (not Instagram, or unknown OS). */
export function handoffPlatform(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): HandoffPlatform | null {
  if (!/Instagram/i.test(ua)) return null;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return null;
}

/** The URL that opens `url` (https) in the platform's own browser. */
export function handoffHref(url: string, platform: HandoffPlatform): string {
  const u = new URL(url);
  const rest = `${u.host}${u.pathname}${u.search}${u.hash}`;
  if (platform === "ios") return `x-safari-https://${rest}`;
  return `intent://${rest}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/** The page to open on the other side: the game, the streak token, the ref. */
export function handoffTargetUrl(base: string, game: "older" | "letters", token: string | null): string {
  const u = new URL(`${base}/${game}`);
  if (token) u.searchParams.set("st", token);
  u.searchParams.set("ref", HANDOFF_REF);
  return u.toString();
}

export function readCachedToken(game: string, now: number = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY_PREFIX + game);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token?: string; at?: number };
    if (!token || typeof at !== "number" || now - at > TOKEN_REUSE_MS) return null;
    return token;
  } catch {
    return null;
  }
}

export function cacheToken(game: string, token: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(TOKEN_KEY_PREFIX + game, JSON.stringify({ token, at: now }));
  } catch {
    // No storage: the next render mints again, within the server's daily limit.
  }
}

/** This page load came through the hand-off link: remember it for this browser. */
export function noteHandoffArrival(search: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  const arrived = new URLSearchParams(search).get("ref") === HANDOFF_REF;
  if (arrived) {
    try {
      localStorage.setItem(ARRIVED_KEY, "1");
    } catch {
      // The hint just won't show; nothing else depends on it.
    }
  }
  return arrived;
}

/** This browser was reached through the hand-off (now or on an earlier visit). */
export function cameThroughHandoff(): boolean {
  try {
    return localStorage.getItem(ARRIVED_KEY) === "1";
  } catch {
    return false;
  }
}
