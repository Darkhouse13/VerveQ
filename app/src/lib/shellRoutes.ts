/**
 * Canonical paths for the v2 shell. All are NEW, additive routes — they never
 * shadow an existing route. The Compete flow uses the literal `/compete/...`
 * paths from the design brief; Home and Ranks are namespaced under `/v2` to
 * avoid colliding with the live `/home` and `/ranks` routes, which stay intact.
 *
 * The mode grid NAVIGATES to the EXISTING mode routes (see `MODE_ROUTES`) — the
 * shell never reimplements a game mode.
 */
export const SHELL_ROUTES = {
  home: "/v2",
  compete: "/compete",
  competeSport: "/compete/sport",
  /** `/compete/sport/:sport` */
  competeSportGrid: (sport: string) => `/compete/sport/${sport}`,
  ranks: "/v2/ranks",
} as const;

/** Route patterns registered in App.tsx (params un-filled). */
export const SHELL_ROUTE_PATTERNS = {
  home: "/v2",
  compete: "/compete",
  competeSport: "/compete/sport",
  competeSportGrid: "/compete/sport/:sport",
  ranks: "/v2/ranks",
} as const;

/**
 * Existing, live deep links the shell routes INTO. Kept here so the mapping
 * from shell tiles to real modes is auditable in one place. These are not new
 * routes — they already exist in App.tsx.
 */
export const MODE_ROUTES = {
  quiz: "/sport-select?mode=quiz",
  survival: "/sport-select?mode=survival",
  blitz: "/sport-select?mode=blitz",
  higherLower: "/higher-lower",
  verveGrid: "/sport-select?mode=verve-grid",
  whoAmI: "/sport-select?mode=who-am-i",
  daily: "/sport-select?mode=daily-quiz",
  liveMatch: "/live-match",
  challenge: "/challenge",
  forge: "/forge",
  learn: "/learn",
} as const;
