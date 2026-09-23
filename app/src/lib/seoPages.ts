/**
 * The static SEO layer as seen from inside the SPA.
 *
 * Pages under these prefixes are generated at build time (app/seo/build.mjs)
 * as real HTML: the built app shell plus a server-rendered `#seo` block after
 * `#root`. The app bundle loads underneath so a "Play" tap opens the game
 * client-side. React never renders these pages — it only:
 *   - hides `#seo` while the visitor is somewhere else in the app (and shows it
 *     again on Back),
 *   - routes `a[data-spa]` launch links without a page load,
 *   - keeps the static head (title/description/canonical) on the page it
 *     belongs to (components/RouteMeta.tsx).
 */

export const SEO_PATH_PREFIXES = [
  "/games/",
  "/football-quiz/",
  "/who-played-for/",
  "/career-path-quiz/",
] as const;

/** True for any path the static layer owns (trailing slash optional). */
export function isSeoPath(pathname: string): boolean {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return SEO_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/** The path the server-rendered block on THIS document belongs to, if any. */
export function staticSeoPath(): string | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("seo")?.getAttribute("data-seo-path") ?? null;
}

function withSlash(p: string): string {
  return p.endsWith("/") ? p : `${p}/`;
}

/** Is `pathname` the page whose static block is in this document? */
export function isOnStaticPage(pathname: string): boolean {
  const own = staticSeoPath();
  return own !== null && withSlash(own) === withSlash(pathname);
}

/**
 * Game mode a static page markets, for the curiosity funnel. The /games/ slugs
 * keep the exact values funnel.js used, so the PostHog series continues.
 */
const MODE_BY_GAME_SLUG: Record<string, string> = {
  "career-path": "career-path",
  "daily-football-quiz": "daily",
  "football-survival": "survival",
  "higher-or-lower": "higher-lower",
  "football-grid": "verve-grid",
  "football-duels": "duel",
  "60-second-football-quiz": "blitz",
};

export function seoModeFor(pathname: string): string | null {
  const game = pathname.match(/^\/games\/([^/]+)\/?$/);
  if (game) return MODE_BY_GAME_SLUG[game[1]] ?? null;
  if (pathname.startsWith("/football-quiz/")) return "daily";
  if (pathname.startsWith("/who-played-for/")) return "verve-grid";
  if (pathname.startsWith("/career-path-quiz/")) return "career-path";
  return null;
}

/** Page family, so analysis can split game pages from data pages. */
export function seoPageType(pathname: string): string {
  if (pathname === "/games/" || pathname === "/games") return "games_hub";
  if (pathname.startsWith("/games/")) return "game";
  if (pathname.startsWith("/football-quiz/")) return "quiz_archive";
  if (pathname.startsWith("/who-played-for/")) return "grid_answers";
  if (pathname.startsWith("/career-path-quiz/")) return "career_path_quiz";
  return "other";
}

const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|lighthouse|chrome-lighthouse|headlesschrome|google-inspectiontool|APIs-Google/i;

/** Crawlers and audit tools — never shown first-run modals. */
export function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return false;
  return BOT_UA.test(navigator.userAgent || "");
}
