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
import i18next from "i18next";

const CONVEX_NOISE = [
  /\[CONVEX [^\]]*\]/g,
  /\[Request ID: [^\]]*\]/g,
  /Server Error/g,
  /Uncaught Error:/g,
  /\bat (?:async )?[\w.<>]+ \([^)]*\)/g,
  /Called by client/g,
];

/**
 * English copy for every curated message, keyed as `shell:errors.<key>`. The
 * locale files carry the translations; this table is the fallback when the
 * shell namespace has not loaded yet (and what tests without i18n see).
 */
export const ERROR_COPY = {
  generic: "Something went wrong. Please try again.",
  connection: "Connection problem. Check your internet and try again.",
  signIn: "Please sign in to continue.",
  noAccess: "You don’t have access to this.",
  usernameFirst: "Choose a username first.",
  usernameTaken: "That username is already taken.",
  alreadyPlayed: "You’ve already played today’s game.",
  alreadyClaimed: "Someone’s already taken this one.",
  duelYourself: "You can’t duel yourself.",
  notFound: "This isn’t available anymore — it may have expired.",
  expired: "Time’s up — this round is over.",
  declined: "This duel was declined.",
  roomFull: "This room is already full.",
  rateLimited: "Too many tries from your network. Please try again in a bit.",
  outOfSync: "This got out of sync — please refresh and try again.",
} as const;
export type ErrorKey = keyof typeof ERROR_COPY;

/**
 * The player-facing copy for `key`, in the active UI language. Reads the
 * global i18next instance (the one `@/i18n` initialises) instead of importing
 * `@/i18n`, so this lib carries none of the provider's side effects; before
 * init — or if a lookup throws — it falls back to English.
 */
export function errorCopy(key: ErrorKey): string {
  const fallback = ERROR_COPY[key];
  try {
    if (!i18next.isInitialized) return fallback;
    const value = i18next.t(`errors.${key}`, { ns: "shell", defaultValue: fallback });
    return typeof value === "string" && value ? value : fallback;
  } catch {
    return fallback;
  }
}

export function humanizeServerError(
  error: unknown,
  fallback: string = errorCopy("generic"),
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
 * first match wins). `key` names the copy the player sees (`errors.<key>` in the
 * shell namespace, English default in ERROR_COPY). An empty `key` means
 * "recognised but never show the server text" — the call-site fallback is used
 * instead (for leaky internals like question counts or config names).
 */
type ErrorRule = { test: RegExp; key: ErrorKey | ""; passthrough?: true };

const ERROR_RULES: ErrorRule[] = [
  // — Connectivity (Convex client / fetch failures) —
  {
    test: /failed to fetch|network ?error|connection|websocket|offline|timed out|timeout/i,
    key: "connection",
  },

  // — Auth & access —
  {
    test: /not authenticated|must be (a registered account|signed in)|please sign in|requires authentication/i,
    key: "signIn",
  },
  {
    test: /not authorized|don.?t have access|forbidden|permission|cannot claim their own/i,
    key: "noAccess",
  },
  {
    test: /must have a username|username is required/i,
    key: "usernameFirst",
  },
  {
    test: /username.*(taken|already in use|unavailable)|already taken/i,
    key: "usernameTaken",
  },

  // — Already done / duplicates —
  {
    test: /already (been )?(attempted|played|completed today)/i,
    key: "alreadyPlayed",
  },
  {
    test: /already (been )?claimed|already (held|taken)|already attached/i,
    key: "alreadyClaimed",
  },
  {
    test: /cannot duel yourself|duel yourself/i,
    key: "duelYourself",
  },

  // — Not found / expired / closed —
  {
    test: /(duel|arena|room|lobby|match|session|game|challenge|question|user|player) not found|does not exist|no longer exists/i,
    key: "notFound",
  },
  {
    test: /expired|time.?s? (up|expired)|no longer (open|active|available)|has ended|is over|round is over/i,
    key: "expired",
  },
  {
    test: /declined/i,
    key: "declined",
  },

  // — Capacity —
  {
    test: /arena is full|room is full|lobby is full|is full|already full/i,
    key: "roomFull",
  },

  // — Rate limits —
  {
    test: /too many .*(attempts|requests|tries)|rate.?limit|slow down/i,
    key: "rateLimited",
  },

  // — Weekend fantasy (fantasySquads / fantasySquadRules) —
  // These modules throw CURATED user-facing copy: the budget message carries
  // the exact totals, the cap message names the club, the lock messages say
  // which rule bit. Swallowing them into a generic fallback would delete the
  // validation feedback BUDGET_MODE's build surface owes the player, so they
  // pass through verbatim (matched on their distinctive phrasings only).
  {
    test: /of a .* budget|players from one club|match has (already )?kicked off|no editorial price|already have a squad for this gameweek|gameweek is no longer open|squad belongs to another|created by the draft|set by the draft|finisher|formation must|may not occupy two slots/i,
    key: "",
    passthrough: true,
  },

  // — Out of sync / locked state —
  {
    test: /out of order|is not active|is locked|already (completed|finished|answered)|must be answered|not your turn|out of range/i,
    key: "outOfSync",
  },

  // — Leaky internals: recognised, but never surface the server text —
  {
    test: /not enough .*questions|no (more )?questions|RESEND_API_KEY|not configured|checksum|schema|index|allowlist|approval|seed|crypto|undefined|null|TypeError|ENOENT|ECONNREFUSED/i,
    key: "",
  },
];

/**
 * Map any caught error to user-facing copy. Known errors get tailored messages;
 * everything else returns `fallback` — raw server text is never shown.
 */
export function friendlyError(
  error: unknown,
  fallback: string = errorCopy("generic"),
): string {
  const cleaned = humanizeServerError(error, "");
  if (cleaned) {
    for (const rule of ERROR_RULES) {
      if (rule.test.test(cleaned)) {
        if (rule.passthrough) return cleaned;
        return rule.key ? errorCopy(rule.key) : fallback;
      }
    }
  }
  // Unrecognised (or nothing legible left) — never leak; show the contextual
  // fallback supplied by the call site.
  return fallback;
}

/**
 * The `code` a server mutation threw as `ConvexError({ code, … })`, or null.
 * A ConvexError's `data` is the only payload production Convex lets through —
 * a plain Error's message arrives redacted to "Server Error" — so codes are the
 * reliable way to branch on a server failure. Duck-typed rather than
 * `instanceof ConvexError` so a second copy of `convex/values` can't break it.
 */
export function convexErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("code" in data)) return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * True when a daily start failed because today's attempt is already used.
 * Matches the server's `already_attempted` code (convex/lib/dailyAttemptErrors)
 * and, for older deployments and dev, the legacy message.
 */
export function isAlreadyAttemptedError(error: unknown): boolean {
  if (convexErrorCode(error) === "already_attempted") return true;
  return error instanceof Error && /already attempted/i.test(error.message);
}
