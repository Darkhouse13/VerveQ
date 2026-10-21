/**
 * Canonical paths for the v2 shell. Everything is namespaced under `/v2`
 * (the legacy `/home`, `/ranks` and `/compete` URLs redirect here).
 *
 * NAVIGATION (VerveQ ONE decision 10): four tabs — Play · Weekend · Ranks ·
 * Profile. Play (`/v2`) replaced BOTH Home and Compete, whose catalogues
 * duplicated each other; Ranks is one screen with a Ladder | Leaderboard
 * segment, reachable at both `ranks` and `leaderboard`.
 */
export const SHELL_ROUTES = {
  /** The Play tab (decision 10): Today, Featured, With friends, More games. */
  play: "/v2",
  /** Historical name for `play`, kept because every game exits "home". */
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
   * DEPRECATED alias of `play` (decision 10 merged Compete into Play). Kept so
   * screens that still say "back to compete" land on Play directly instead of
   * taking the `/compete` redirect hop. The `/compete`, `/compete/sport` and
   * `/compete/sport/:sport` URLs stay registered as redirects to Play (see
   * SHELL_ROUTE_PATTERNS) — SEO pages and old links point at them.
   */
  compete: "/v2",
  /**
   * DEPRECATED: the old step URLs' builders, for game screens whose "other
   * modes" button used to open the Compete grid. They now open Play with the
   * More games catalogue expanded (`#more`), which is where those modes live.
   */
  competeSport: "/v2#more",
  competeSportGrid: (_sport: string) => "/v2#more",
  /** Ranks, Ladder segment (decision 10). */
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
  /** Ranks, Leaderboard segment (decision 10) — same screen as `ranks`. */
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
  /** DAILY SURVIVAL — the shared one-attempt run (Reveal Ladder engine). */
  dailySurvival: "/v2/daily-survival",
  /** WHO'S OLDER? — today's shared ten pairs, then endless. */
  whosOlderPlay: "/v2/whos-older",
  /** MISSING LETTERS — today's shared ten boards, then endless. */
  missingLettersPlay: "/v2/missing-letters",
  /** `/v2/arena/:code` */
  arenaPlay: (code: string) => `/v2/arena/${code}`,
  /** THE WEEKEND hub (FW-GO) — the mode's public front door: budget squad,
   *  crews, the vote stack and the court, one screen each. */
  weekend: "/v2/weekend",
  /** THE WEEKEND crew draft rooms (FW-3). Hub: my crews, create, join. */
  weekendCrews: "/v2/weekend/crews",
  /** `/v2/weekend/crew/:code` — shared competition, record and results. */
  weekendCrew: (code: string) => `/v2/weekend/crew/${code}`,
  /** Creator-only administration for a Weekend crew. */
  weekendCrewCommand: (code: string) => `/v2/weekend/crew/${code}/command`,
  /** `/v2/weekend/draft/:roomId` — one gameweek's draft room. */
  weekendDraft: (roomId: string) => `/v2/weekend/draft/${roomId}`,
  /** THE WEEKEND budget squad — build a fresh 13 under budget (O1). */
  weekendSquad: "/v2/weekend/squad",
  /** THE WEEKEND crowd voting stack (O2). */
  weekendVote: "/v2/weekend/vote",
  /** THE WEEKEND reclamation court (O3). */
  weekendCourt: "/v2/weekend/court",
  /** `/v2/weekend/sheet/:roomId` — a drafter's crew team sheet (O5). */
  weekendSheet: (roomId: string) => `/v2/weekend/sheet/${roomId}`,
  /** THE WEEKEND rules screen (FW-EXPAND U3) — public, like the hub. */
  weekendHowToPlay: "/v2/weekend/how-to-play",
  /** THE WEEKEND fixtures (FW-IMMERSE A3) — public, read-only matchday list. */
  weekendFixtures: "/v2/weekend/fixtures",
  /** THE WEEKEND global gameweek table — budget squads only, live + provisional. */
  weekendLeaderboard: "/v2/weekend/leaderboard",
  /** `/v2/weekend/receipt/:gameweekId` — a settled gameweek's receipt
   *  (FW-RECEIPT); `?room=<roomId>` addresses a crew sheet's receipt. */
  weekendReceipt: (gameweekId: string, roomId?: string) =>
    `/v2/weekend/receipt/${gameweekId}${roomId === undefined ? "" : `?room=${roomId}`}`,
} as const;

/** Route patterns registered in App.tsx (params un-filled). */
export const SHELL_ROUTE_PATTERNS = {
  home: "/v2",
  /** Legacy Compete URLs — redirects to Play (decision 10), never screens. */
  compete: "/compete",
  competeSport: "/compete/sport",
  competeSportGrid: "/compete/sport/:sport",
  ranks: "/v2/ranks",
  leaderboard: "/v2/leaderboard",
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
  dailySurvival: "/v2/daily-survival",
  arena: "/v2/arena",
  arenaPlay: "/v2/arena/:code",
  weekend: "/v2/weekend",
  weekendCrews: "/v2/weekend/crews",
  weekendCrew: "/v2/weekend/crew/:code",
  weekendCrewCommand: "/v2/weekend/crew/:code/command",
  weekendDraft: "/v2/weekend/draft/:roomId",
  weekendSquad: "/v2/weekend/squad",
  weekendVote: "/v2/weekend/vote",
  weekendCourt: "/v2/weekend/court",
  weekendSheet: "/v2/weekend/sheet/:roomId",
  weekendHowToPlay: "/v2/weekend/how-to-play",
  weekendFixtures: "/v2/weekend/fixtures",
  weekendLeaderboard: "/v2/weekend/leaderboard",
  weekendReceipt: "/v2/weekend/receipt/:gameweekId",
} as const;
