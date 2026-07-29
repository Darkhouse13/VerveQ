import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

// Deploys are image-based and delete the previous release's hashed chunks, so
// a tab that stayed open across a deploy 404s on the next lazy route it visits.
// Session-scoped so the flag dies with the tab, keyed so we only ever force one
// reload per session — a genuinely broken network must not loop forever.
const RELOAD_FLAG = "vq-chunk-reloaded";

function sessionFlag(get: boolean): boolean {
  try {
    if (get) return sessionStorage.getItem(RELOAD_FLAG) !== null;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    return true;
  } catch {
    // Storage unavailable (private mode) — behave as if already reloaded so we
    // never risk a reload loop we can't detect.
    return get ? true : false;
  }
}

/**
 * Drop-in replacement for React.lazy that recovers from a failed dynamic
 * import by reloading the page once — which fetches the current index.html
 * and with it the current chunk hashes. Without this, the first tap after a
 * deploy lands on the error boundary with no way out but a manual refresh.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!sessionFlag(true)) {
        sessionFlag(false);
        window.location.reload();
        // The page is reloading; suspend forever so nothing else renders.
        return await new Promise<never>(() => {});
      }
      throw error;
    }
  });
}
