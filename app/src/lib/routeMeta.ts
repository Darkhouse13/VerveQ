/**
 * Per-route document metadata for the SPA (SEO-1 Part 3).
 *
 * The app is client-rendered, so every route ships the SAME `index.html` head:
 * without this table a crawler (and every shared link preview that reads the
 * live DOM) sees the homepage title on `/compete`, `/v2/daily` and everything
 * else. This is the SECONDARY surface — the indexable one is the static
 * `/games/` layer, which is real HTML and is what the sitemap lists. SPA routes
 * are deliberately absent from the sitemap; the metadata here exists so the
 * routes are honestly labelled when they are reached or shared, not to push
 * them into the index.
 *
 * Kept as a plain lookup (no dependency — react-helmet-async would be a new
 * runtime dep for a job that is three DOM writes). Pure and exported so the
 * table can be asserted without rendering.
 */

export interface RouteMeta {
  title: string;
  description: string;
}

/**
 * Fallback for every unlisted route — mirrors `app/index.html` exactly, so a
 * route with no entry is indistinguishable from a cold load of the shell.
 * If index.html's title/description change, change these with them.
 */
export const DEFAULT_META: RouteMeta = {
  title: "Football Trivia & Quiz Games — Play Free | VerveQ",
  description:
    "Free football trivia and quiz games: a daily quiz, initials survival, career-path guessing and head-to-head duels. Play in your browser, no sign-up.",
};

/** Origin for self-referencing canonicals. Non-www — nginx 301s the www host. */
export const CANONICAL_ORIGIN = "https://verveq.com";

/**
 * Exact pathname → metadata. Parameterised routes (`/v2/arena/:code`,
 * `/duel/:linkCode`) are intentionally absent: their content is per-instance
 * and they fall back to DEFAULT_META rather than claiming a shared title.
 */
export const ROUTE_META: Record<string, RouteMeta> = {
  "/compete": {
    title: "Play Football Quiz Games — Ranked & Casual | VerveQ",
    description:
      "Every VerveQ football game in one place: ranked quiz and survival, daily challenges, duels and arena rooms with friends. Free, no download.",
  },
  "/v2/daily": {
    title: "Daily Football Quiz — Today's Challenge | VerveQ",
    description:
      "Today's ten football questions, the same for every player worldwide. One attempt, speed scoring, and a streak to protect. Resets at midnight UTC.",
  },
  "/v2/daily-survival": {
    title: "Daily Survival — One Shared Run | VerveQ",
    description:
      "One shared survival run per day: name players from their initials until you run out of lives. Same run for everyone, one attempt.",
  },
  "/v2/blitz": {
    title: "Blitz — 60-Second Football Quiz | VerveQ",
    description:
      "Sixty seconds, as many football questions as you can answer. No lifelines, no second chances — just how fast you can think. Free to play.",
  },
  "/v2/higher-lower": {
    title: "Higher or Lower — Football Stats Game | VerveQ",
    description:
      "Is the next player's stat higher or lower? Goals, appearances and trophies, one call at a time. One wrong answer ends the streak.",
  },
  "/v2/career-path": {
    title: "Career Path — Guess the Player | VerveQ",
    description:
      "Read a footballer's club history in order and name him before you run out of guesses. Typo-friendly, hundreds of careers, no sign-up.",
  },
  "/v2/verve-grid": {
    title: "VerveGrid — Daily Football Grid | VerveQ",
    description:
      "Nine cells, nine guesses. Name a player who fits both the row and the column — club, country or position. No player twice.",
  },
  "/v2/arena": {
    title: "Arena — Live Quiz Rooms With Friends | VerveQ",
    description:
      "Create a room, share the code, and everyone answers the same football questions at the same time. Live scoring, up to a full group.",
  },
  "/v2/duels": {
    title: "Duels — Head-to-Head Football Trivia | VerveQ",
    description:
      "Send a link, both of you answer the same football questions, and settle it. Your opponent doesn't need an account to play.",
  },
  "/v2/leaderboard": {
    title: "Leaderboards | VerveQ",
    description:
      "Where you stand in VerveQ football trivia: global ELO rankings, mode leaderboards and the players ahead of you. Updated as games finish.",
  },
  "/v2/weekend/leaderboard": {
    title: "The Weekend Leaderboard | VerveQ",
    description:
      "Live global standings for The Weekend fantasy game: provisional budget-squad points update as each fixture is scored.",
  },
};

/** Search-result truncation budgets — asserted in the contract test. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/**
 * Resolve a pathname to its metadata. A trailing slash is normalised away so
 * `/compete/` and `/compete` agree; unknown paths get the homepage fallback.
 */
export function resolveRouteMeta(pathname: string): RouteMeta {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;
  return ROUTE_META[normalized] ?? DEFAULT_META;
}

/** Self-referencing canonical: origin + path, query and hash discarded. */
export function canonicalFor(pathname: string): string {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;
  return `${CANONICAL_ORIGIN}${normalized === "/" ? "/" : normalized}`;
}
