/**
 * Canonical paths for the app shell. Home (the Play tab) is `/home`; every
 * other screen sits at the top level (`/weekend/squad`, `/whos-older`). The
 * shell lived under `/v2` until 2026-10: nginx 301s those URLs and
 * `DropV2Redirect` catches the rest, so never mint a `/v2` path again.
 *
 * NAVIGATION (VerveQ ONE decision 10): four tabs — Play · Weekend · Ranks ·
 * Profile. Play (`/home`) replaced BOTH Home and Compete, whose catalogues
 * duplicated each other; Ranks is one screen with a Ladder | Leaderboard
 * segment, reachable at both `ranks` and `leaderboard`.
 */
export const SHELL_ROUTES = {
  /** The Play tab (decision 10): Today, Featured, With friends, More games. */
  play: "/home",
  /** Historical name for `play`, kept because every game exits "home". */
  home: "/home",
  /**
   * Account chooser for logged-out visitors hitting a gated surface: sign in,
   * create an account, or continue as guest. Accepts ?next=. The username-only
   * ask (`welcome`) is reserved for the guest choice and invite flows.
   */
  account: "/account",
  /** Username-only onboarding (no password). Accepts ?next= and ?code=. */
  welcome: "/welcome",
  /** Anonymous + username -> full account upgrade. Accepts ?next=. */
  upgrade: "/upgrade",
  /**
   * DEPRECATED alias of `play` (decision 10 merged Compete into Play). Kept so
   * screens that still say "back to compete" land on Play directly instead of
   * taking the `/compete` redirect hop. The `/compete`, `/compete/sport` and
   * `/compete/sport/:sport` URLs stay registered as redirects to Play (see
   * SHELL_ROUTE_PATTERNS) — SEO pages and old links point at them.
   */
  compete: "/home",
  /**
   * DEPRECATED: the old step URLs' builders, for game screens whose "other
   * modes" button used to open the Compete grid. They now open Play with the
   * More games catalogue expanded (`#more`), which is where those modes live.
   */
  competeSport: "/home#more",
  competeSportGrid: (_sport: string) => "/home#more",
  /** Ranks, Ladder segment (decision 10). */
  ranks: "/ranks",
  /**
   * Contained legacy surfaces — the existing screens embedded in the shell
   * chrome (v2 nav retained, v1 bottom nav suppressed) so no shell path drops
   * the user back into the v1 app. See App.tsx and the screens' `embedded` prop.
   */
  profile: "/profile",
  /** Preferences + account hub — language switch, account upgrade, sign out. */
  settings: "/settings",
  /**
   * Arena entry hub (group challenge rooms): create a room or join with a
   * code. Distinct from `duels` (head-to-head send-a-link); play happens on
   * `arenaPlay`.
   */
  arena: "/arena",
  duels: "/duels",
  /** Full list of finished duels; the Duels page shows only the latest few. */
  duelHistory: "/duels/history",
  forge: "/forge",
  /** Ranks, Leaderboard segment (decision 10) — same screen as `ranks`. */
  leaderboard: "/leaderboard",
  rivals: "/rivals",
  /** `/rivals/:opponentUserId` */
  rivalDetail: (opponentUserId: string) => `/rivals/${opponentUserId}`,
  /** Learn v2 (the Learn pillar) — entry, run, spaced review, mastery. */
  learn: "/learn",
  learnRun: "/learn/run",
  learnReview: "/learn/review",
  learnMastery: "/learn/mastery",
  /** In-game prototype layout (migrated modes). Solo Quiz + multi-user Arena. */
  quizPlay: "/quiz",
  /** Solo Blitz on the shell prototype layout. */
  blitzPlay: "/blitz",
  /** Solo Survival on the shell prototype layout (FE reskin). */
  survivalPlay: "/survival",
  /** Solo Higher or Lower on the shell prototype layout (FE reskin). */
  higherLowerPlay: "/higher-lower",
  /** Solo Career Path on the shell prototype layout. */
  careerPathPlay: "/career-path",
  /** Solo VerveGrid on the bespoke GridStage (FE reskin over the existing backend). */
  verveGridPlay: "/verve-grid",
  /** Daily Challenge (quiz) on the shell — reuses QuizPlayView via the DAILY session. */
  dailyPlay: "/daily",
  /** DAILY SURVIVAL — the shared one-attempt run (Reveal Ladder engine). */
  dailySurvival: "/daily-survival",
  /** WHO'S OLDER? — today's shared ten pairs, then endless. */
  whosOlderPlay: "/whos-older",
  /** MISSING LETTERS — today's shared ten boards, then endless. */
  missingLettersPlay: "/missing-letters",
  /** `/arena/:code` */
  arenaPlay: (code: string) => `/arena/${code}`,
  /** THE WEEKEND hub (FW-GO) — the mode's public front door: budget squad,
   *  crews, the vote stack and the court, one screen each. */
  weekend: "/weekend",
  /** THE WEEKEND crew draft rooms (FW-3). Hub: my crews, create, join. */
  weekendCrews: "/weekend/crews",
  /** `/weekend/crew/:code` — shared competition, record and results. */
  weekendCrew: (code: string) => `/weekend/crew/${code}`,
  /** Creator-only administration for a Weekend crew. */
  weekendCrewCommand: (code: string) => `/weekend/crew/${code}/command`,
  /** `/weekend/draft/:roomId` — one gameweek's draft room. */
  weekendDraft: (roomId: string) => `/weekend/draft/${roomId}`,
  /** THE WEEKEND budget squad — build a fresh 13 under budget (O1). */
  weekendSquad: "/weekend/squad",
  /** THE WEEKEND crowd voting stack (O2). */
  weekendVote: "/weekend/vote",
  /** THE WEEKEND reclamation court (O3). */
  weekendCourt: "/weekend/court",
  /** `/weekend/sheet/:roomId` — a drafter's crew team sheet (O5). */
  weekendSheet: (roomId: string) => `/weekend/sheet/${roomId}`,
  /** THE WEEKEND rules screen (FW-EXPAND U3) — public, like the hub. */
  weekendHowToPlay: "/weekend/how-to-play",
  /** THE WEEKEND fixtures (FW-IMMERSE A3) — public, read-only matchday list. */
  weekendFixtures: "/weekend/fixtures",
  /** THE WEEKEND global gameweek table — budget squads only, live + provisional. */
  weekendLeaderboard: "/weekend/leaderboard",
  /** `/weekend/receipt/:gameweekId` — a settled gameweek's receipt
   *  (FW-RECEIPT); `?room=<roomId>` addresses a crew sheet's receipt. */
  weekendReceipt: (gameweekId: string, roomId?: string) =>
    `/weekend/receipt/${gameweekId}${roomId === undefined ? "" : `?room=${roomId}`}`,
} as const;

/** Route patterns registered in App.tsx (params un-filled). */
export const SHELL_ROUTE_PATTERNS = {
  home: "/home",
  /** Legacy Compete URLs — redirects to Play (decision 10), never screens. */
  compete: "/compete",
  competeSport: "/compete/sport",
  competeSportGrid: "/compete/sport/:sport",
  ranks: "/ranks",
  leaderboard: "/leaderboard",
  settings: "/settings",
  learn: "/learn",
  learnRun: "/learn/run",
  learnReview: "/learn/review",
  learnMastery: "/learn/mastery",
  quizPlay: "/quiz",
  blitzPlay: "/blitz",
  survivalPlay: "/survival",
  higherLowerPlay: "/higher-lower",
  careerPathPlay: "/career-path",
  verveGridPlay: "/verve-grid",
  dailyPlay: "/daily",
  dailySurvival: "/daily-survival",
  arena: "/arena",
  arenaPlay: "/arena/:code",
  weekend: "/weekend",
  weekendCrews: "/weekend/crews",
  weekendCrew: "/weekend/crew/:code",
  weekendCrewCommand: "/weekend/crew/:code/command",
  weekendDraft: "/weekend/draft/:roomId",
  weekendSquad: "/weekend/squad",
  weekendVote: "/weekend/vote",
  weekendCourt: "/weekend/court",
  weekendSheet: "/weekend/sheet/:roomId",
  weekendHowToPlay: "/weekend/how-to-play",
  weekendFixtures: "/weekend/fixtures",
  weekendLeaderboard: "/weekend/leaderboard",
  weekendReceipt: "/weekend/receipt/:gameweekId",
} as const;
