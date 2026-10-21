/**
 * Reel entry routes — where reel traffic lands. Every route runs on the ink
 * ground now (VerveQ ONE decision 1; index.html boots ink everywhere), so this
 * no longer picks the palette: it picks the card-shaped InkLoader over the
 * spinner, and the language prompt's reel behaviour.
 */
const INK_ENTRY = /^\/(older|whos-older|letters|missing-letters|draw|weekend)(\/|$)|^\/v2\/(whos-older|missing-letters|weekend)(\/|$)/;

export function isInkEntryPath(pathname: string): boolean {
  return INK_ENTRY.test(pathname);
}

/**
 * Start downloading the landing screen's code at boot. The daily games sit
 * behind SessionRoute, which renders nothing until the guest sign-in lands
 * (two round trips), so their chunk used to start only after sign-in. Same
 * specifiers as App.tsx's lazy() calls, so Vite serves one module either way.
 */
export function prefetchEntryRoute(pathname: string): void {
  const load =
    /^\/(older|whos-older)(\/|$)|^\/v2\/whos-older/.test(pathname)
      ? () => import("@/pages/shell/play/WhosOlderPlayScreen")
      : /^\/(letters|missing-letters)(\/|$)|^\/v2\/missing-letters/.test(pathname)
        ? () => import("@/pages/shell/play/MissingLettersPlayScreen")
        : /^\/draw(\/|$)/.test(pathname)
          ? () => import("@/pages/draw/DrawScreen")
          : /^\/(weekend)(\/|$)|^\/v2\/weekend\/?$/.test(pathname)
            ? () => import("@/pages/shell/weekend/WeekendHubScreen")
            : null;
  // Failures are harmless: the real navigation retries through lazyWithRetry.
  if (load) void load().catch(() => {});
}
