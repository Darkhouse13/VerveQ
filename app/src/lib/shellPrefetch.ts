// Idle-time prefetch of the four bottom-tab screens. Route chunks load lazily,
// and the router's startTransition keeps the OLD screen painted while a chunk
// downloads — so an unfetched tab reads as a dead tap on a slow connection.
// Warming the chunks right after the shell first paints makes tab switches
// resolve from cache. Vite dedupes these imports with App.tsx's lazy() calls
// (same modules), so this costs each chunk at most once per session.

const TAB_SCREEN_IMPORTS: Array<() => Promise<unknown>> = [
  () => import("@/pages/shell/ShellHomeScreen"),
  () => import("@/pages/shell/CompeteModeGridScreen"),
  () => import("@/pages/shell/RanksScreen"),
  () => import("@/pages/shell/ShellProfileScreen"),
];

let prefetched = false;

export function prefetchShellTabs(): void {
  if (prefetched) return;
  prefetched = true;
  const warm = () => {
    for (const load of TAB_SCREEN_IMPORTS) {
      // Failures are irrelevant here — the real navigation path has its own
      // recovery (lazyWithRetry); prefetch must never surface an error.
      void load().catch(() => {});
    }
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1500);
  }
}
