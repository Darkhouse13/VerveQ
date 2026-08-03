import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

// Deploys are image-based and delete the previous release's hashed chunks, so
// a tab that stayed open across a deploy 404s on the next lazy route it visits.
// The flag is keyed per chunk (the factory's bundled source embeds the hashed
// chunk path, so the key changes with each release of that chunk): a session
// that already spent a reload on deploy N can still recover at deploy N+1.
// Loops stay bounded — a reload that serves the same stale bundle reproduces
// the same key, which is now flagged, so the error surfaces instead of
// reloading again. Session-scoped so flags die with the tab.
const RELOAD_FLAG_PREFIX = "vq-chunk-reloaded:";

function reloadFlag(key: string, get: boolean): boolean {
  try {
    if (get) return sessionStorage.getItem(RELOAD_FLAG_PREFIX + key) !== null;
    sessionStorage.setItem(RELOAD_FLAG_PREFIX + key, "1");
    return true;
  } catch {
    // Storage unavailable (private mode) — behave as if already reloaded so we
    // never risk a reload loop we can't detect.
    return get ? true : false;
  }
}

/**
 * The recovery logic behind lazyWithRetry, with the reload injectable so the
 * contract is testable (jsdom's window.location.reload is unstubbable).
 */
export async function importWithReload<T>(
  factory: () => Promise<T>,
  reload: () => void = () => window.location.reload(),
): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    const key = factory.toString();
    if (!reloadFlag(key, true)) {
      reloadFlag(key, false);
      reload();
      // The page is reloading; suspend forever so nothing else renders.
      return await new Promise<never>(() => {});
    }
    throw error;
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
  return lazy(() => importWithReload(factory));
}
