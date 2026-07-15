/**
 * Where this visit came FROM — captured once, at first load, per tab.
 *
 * This is deliberately the one thing that IS read from the landing URL, and
 * the distinction matters: provenance is what a URL honestly encodes. The rule
 * this module respects is that no GAMEPLAY event may be inferred from routing
 * — `game_started` fires when a session mutation resolves, never when a path
 * changes. `entry_source` only ever answers "which door did this visitor walk
 * through", which the door itself is the correct authority on.
 *
 * Captured at first load (main.tsx) because by the time a game starts the URL
 * has already moved on. Held in sessionStorage, so it is per-tab and survives
 * in-app navigation but never leaks across a new visit.
 *
 * Note /play and /s/d/ both redirect: /play is a client-side redirect into
 * Career Path, and /s/d/:code is an nginx->Convex 302 out to /duel/:code. Both
 * are read here on the FIRST url seen by the tab, before any redirect runs, so
 * a redirect can never overwrite the real entry door.
 */
export type EntrySource = "share-link" | "homepage" | "profile" | "direct";

const STORAGE_KEY = "vq_entry_source";

/** Refs minted by share surfaces (lib/duel.ts buildShareUrl -> /s/d/:code) and
 *  the off-platform short link (lib/playShortLink.ts). */
function isShareRef(ref: string | null): boolean {
  if (!ref) return false;
  return ref.startsWith("duel_") || ref.endsWith("_share") || ref === "arena";
}

export function classifyEntrySource(
  pathname: string,
  search: string,
): EntrySource {
  const ref = new URLSearchParams(search).get("ref");

  // Share/invite doors: the vanity share path, the duel deep link, and arena
  // room invites. /s/d/ normally 302s away before the SPA boots, but a client
  // -side landing on it is still unambiguously a share arrival.
  if (
    /^\/s\/d\/[^/]+$/.test(pathname) ||
    /^\/duel\/[^/]+$/.test(pathname) ||
    /^\/(v2\/)?arena\/[^/]+$/.test(pathname) ||
    isShareRef(ref)
  ) {
    return "share-link";
  }

  // Someone else's profile / rivals surface.
  if (/^\/(v2\/)?profile$/.test(pathname) || pathname.startsWith("/rivals")) {
    return "profile";
  }

  // The landing pages proper. /play is an off-platform short link, so it is a
  // marketing door rather than the homepage.
  if (pathname === "/" || pathname === "/home" || pathname === "/v2") {
    return "homepage";
  }

  return "direct";
}

/** Record the entry door for this tab. First call wins: a later redirect (or a
 *  re-import of this module from a lazy chunk) must not overwrite it. */
export function captureEntrySource(pathname: string, search: string): void {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, classifyEntrySource(pathname, search));
  } catch {
    // Private-mode / storage-disabled: entry source degrades to "direct"
    // rather than breaking the session.
  }
}

export function getEntrySource(): EntrySource {
  try {
    return (sessionStorage.getItem(STORAGE_KEY) as EntrySource) || "direct";
  } catch {
    return "direct";
  }
}
