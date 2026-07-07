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
  /**
   * Account chooser for logged-out visitors hitting a gated surface: sign in,
   * create an account, or continue as guest. Accepts ?next=. The username-only
   * ask (`welcome`) is reserved for the guest choice and invite flows.
   */
  account: "/v2/account",
  /** Username-only onboarding (no password). Accepts ?next= and ?code=. */
  welcome: "/v2/welcome",
  /** Anonymous + username -> full account upgrade. Accepts ?next=. */
  upgrade: "/v2/upgrade",
  /**
   * Compete lands DIRECTLY on the (football) mode grid. The category and sport
   * steps are collapsed while Sport→Football is the only live path; their
   * screens are parked in pages/shell/ and the step URLs below redirect here.
   */
  compete: "/compete",
  /** Legacy step URL — redirects to `compete`. Kept for cheap reintroduction. */
  competeSport: "/compete/sport",
  /** `/compete/sport/:sport` — legacy step URL, redirects to `compete`. */
  competeSportGrid: (sport: string) => `/compete/sport/${sport}`,
  ranks: "/v2/ranks",
  /**
   * Contained legacy surfaces — the existing screens embedded in the shell
   * chrome (v2 nav retained, v1 bottom nav suppressed) so no shell path drops
   * the user back into the v1 app. See App.tsx and the screens' `embedded` prop.
   */
  profile: "/v2/profile",
  /** Preferences + account hub — language switch, account upgrade, sign out. */
  settings: "/v2/settings",
  /**
   * Arena entry hub (group challenge rooms): create a room or join with a
   * code. Distinct from `duels` (head-to-head send-a-link); play happens on
   * `arenaPlay`.
   */
  arena: "/v2/arena",
  duels: "/v2/duels",
  /** Full list of finished duels; the Duels page shows only the latest few. */
  duelHistory: "/v2/duels/history",
  forge: "/v2/forge",
  leaderboard: "/v2/leaderboard",
  rivals: "/v2/rivals",
  /** `/v2/rivals/:opponentUserId` */
  rivalDetail: (opponentUserId: string) => `/v2/rivals/${opponentUserId}`,
  /** Learn v2 (the Learn pillar) — entry, run, spaced review, mastery. */
  learn: "/v2/learn",
  learnRun: "/v2/learn/run",
  learnReview: "/v2/learn/review",
  learnMastery: "/v2/learn/mastery",
  /** In-game prototype layout (migrated modes). Solo Quiz + multi-user Arena. */
  quizPlay: "/v2/quiz",
  /** Solo Blitz on the shell prototype layout. */
  blitzPlay: "/v2/blitz",
  /** Solo Survival on the shell prototype layout (FE reskin). */
  survivalPlay: "/v2/survival",
  /** Solo Higher or Lower on the shell prototype layout (FE reskin). */
  higherLowerPlay: "/v2/higher-lower",
  /** Solo Career Path on the shell prototype layout. */
  careerPathPlay: "/v2/career-path",
  /** Solo VerveGrid on the bespoke GridStage (FE reskin over the existing backend). */
  verveGridPlay: "/v2/verve-grid",
  /** Daily Challenge (quiz) on the shell — reuses QuizPlayView via the DAILY session. */
  dailyPlay: "/v2/daily",
  /** `/v2/arena/:code` */
  arenaPlay: (code: string) => `/v2/arena/${code}`,
} as const;

/** Route patterns registered in App.tsx (params un-filled). */
export const SHELL_ROUTE_PATTERNS = {
  home: "/v2",
  compete: "/compete",
  competeSport: "/compete/sport",
  competeSportGrid: "/compete/sport/:sport",
  ranks: "/v2/ranks",
  settings: "/v2/settings",
  learn: "/v2/learn",
  learnRun: "/v2/learn/run",
  learnReview: "/v2/learn/review",
  learnMastery: "/v2/learn/mastery",
  quizPlay: "/v2/quiz",
  blitzPlay: "/v2/blitz",
  survivalPlay: "/v2/survival",
  higherLowerPlay: "/v2/higher-lower",
  careerPathPlay: "/v2/career-path",
  verveGridPlay: "/v2/verve-grid",
  dailyPlay: "/v2/daily",
  arena: "/v2/arena",
  arenaPlay: "/v2/arena/:code",
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
  daily: "/sport-select?mode=daily-quiz",
  challenge: "/challenge",
  forge: "/forge",
  learn: "/learn",
} as const;
