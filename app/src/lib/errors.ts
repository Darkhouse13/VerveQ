/**
 * Server mutations surface as Error messages wrapped in Convex transport
 * noise: "[CONVEX M(challengeArenas:join)] [Request ID: …] Server Error
 * Uncaught Error: Arena not found at handler (../convex/… ) Called by client".
 *
 * `humanizeServerError` strips that envelope down to the thrown message.
 * `friendlyError` goes further: it maps the thrown message to curated
 * user-facing copy and, for anything unrecognised, returns a safe fallback so
 * raw server text (internal counts, config names, table/schema details) never
 * reaches a player. Use `friendlyError` for everything shown to users; reserve
 * `humanizeServerError` for diagnostics (e.g. the render-crash ErrorBoundary).
 */
const CONVEX_NOISE = [
  /\[CONVEX [^\]]*\]/g,
  /\[Request ID: [^\]]*\]/g,
  /Server Error/g,
  /Uncaught Error:/g,
  /\bat (?:async )?[\w.<>]+ \([^)]*\)/g,
  /Called by client/g,
];

export function humanizeServerError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!raw) return fallback;
  let cleaned = raw;
  for (const pattern of CONVEX_NOISE) cleaned = cleaned.replace(pattern, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned || !/[a-zA-Z]/.test(cleaned) || cleaned.length > 160) return fallback;
  return cleaned;
}

/**
 * Ordered rules matched against the de-noised server message (case-insensitive,
 * first match wins). `message` is the copy the player sees. An empty `message`
 * means "recognised but never show the server text" — the call-site fallback is
 * used instead (for leaky internals like question counts or config names).
 */
type ErrorRule = { test: RegExp; message: string };

const ERROR_RULES: ErrorRule[] = [
  // — Connectivity (Convex client / fetch failures) —
  {
    test: /failed to fetch|network ?error|connection|websocket|offline|timed out|timeout/i,
    message: "Connection problem. Check your internet and try again.",
  },

  // — Auth & access —
  {
    test: /not authenticated|must be (a registered account|signed in)|please sign in|requires authentication/i,
    message: "Please sign in to continue.",
  },
  {
    test: /not authorized|don.?t have access|forbidden|permission|cannot claim their own/i,
    message: "You don’t have access to this.",
  },
  {
    test: /must have a username|username is required/i,
    message: "Choose a username first.",
  },
  {
    test: /username.*(taken|already in use|unavailable)|already taken/i,
    message: "That username is already taken.",
  },

  // — Already done / duplicates —
  {
    test: /already (been )?(attempted|played|completed today)/i,
    message: "You’ve already played today’s challenge.",
  },
  {
    test: /already (been )?claimed|already (held|taken)|already attached/i,
    message: "Someone’s already taken this challenge.",
  },
  {
    test: /cannot duel yourself|duel yourself/i,
    message: "You can’t duel yourself.",
  },

  // — Not found / expired / closed —
  {
    test: /(duel|arena|room|lobby|match|session|game|challenge|question|user|player) not found|does not exist|no longer exists/i,
    message: "This isn’t available anymore — it may have expired.",
  },
  {
    test: /expired|time.?s? (up|expired)|no longer (open|active|available)|has ended|is over|round is over/i,
    message: "Time’s up — this round is over.",
  },
  {
    test: /declined/i,
    message: "This challenge was declined.",
  },

  // — Capacity —
  {
    test: /arena is full|room is full|lobby is full|is full|already full/i,
    message: "This room is already full.",
  },

  // — Rate limits —
  {
    test: /too many .*(attempts|requests|tries)|rate.?limit|slow down/i,
    message: "Too many tries from your network. Please try again in a bit.",
  },

  // — Out of sync / locked state —
  {
    test: /out of order|is not active|is locked|already (completed|finished|answered)|must be answered|not your turn|out of range/i,
    message: "This got out of sync — please refresh and try again.",
  },

  // — Leaky internals: recognised, but never surface the server text —
  {
    test: /not enough .*questions|no (more )?questions|RESEND_API_KEY|not configured|checksum|schema|index|allowlist|approval|seed|crypto|undefined|null|TypeError|ENOENT|ECONNREFUSED/i,
    message: "",
  },
];

/**
 * Map any caught error to user-facing copy. Known errors get tailored messages;
 * everything else returns `fallback` — raw server text is never shown.
 */
export function friendlyError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const cleaned = humanizeServerError(error, "");
  if (cleaned) {
    for (const rule of ERROR_RULES) {
      if (rule.test.test(cleaned)) return rule.message || fallback;
    }
  }
  // Unrecognised (or nothing legible left) — never leak; show the contextual
  // fallback supplied by the call site.
  return fallback;
}
