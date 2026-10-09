/**
 * WHO'S OLDER? retention loop — pure rules (no server import, no ambient clock).
 *
 * Three pieces bring a player back the next day:
 *   1. the DAILY STREAK — consecutive UTC dates with a finished daily;
 *   2. the EMAIL REMINDER — one email per edition, sent in the player's
 *      morning, only once they confirmed the address (double opt-in);
 *   3. the CHALLENGE — a finished daily becomes a "beat my 8/10" link to the
 *      same ten pairs, and the sender sees who took it.
 * convex/whosOlder.ts and convex/whosOlderReminders.ts own the I/O.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** "2026-10-09" + n days, in UTC. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const t = Date.parse(`${dateKey}T00:00:00Z`) + days * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

export type DailyStreak = {
  /** Consecutive finished dailies ending today — or yesterday, while today is still open. */
  current: number;
  best: number;
  playedToday: boolean;
};

/**
 * The streak over the UTC dates on which a daily was FINISHED. A streak whose
 * last day is yesterday is still alive (today's edition can extend it); one
 * whose last day is older is broken and reads 0.
 */
export function computeDailyStreak(finishedDateKeys: Iterable<string>, todayKey: string): DailyStreak {
  const days = [...new Set(finishedDateKeys)].filter((d) => d <= todayKey).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev !== null && addDaysToDateKey(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const playedToday = prev === todayKey;
  const alive = playedToday || prev === addDaysToDateKey(todayKey, -1);
  return { current: alive ? run : 0, best, playedToday };
}

// ── Email reminder ──────────────────────────────────────────────────────────

/** The reminder lands in the player's morning: from 09:00 local … */
export const REMINDER_LOCAL_HOUR_FROM = 9;
/** … and never after 21:59 local. A day whose window was missed is skipped. */
export const REMINDER_LOCAL_HOUR_TO = 21;
/** A subscriber who has not finished a daily for this long stops getting mail. */
export const REMINDER_DORMANT_DAYS = 14;
/** At most this many new reminder sign-ups per player per day (abuse cap). */
export const REMINDER_SIGNUPS_PER_DAY = 3;
/** A pending address gets at most one confirmation email per this window. */
export const REMINDER_CONFIRM_RESEND_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lower-cased, trimmed address, or null when it is not a plausible email. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** "jo***@gmail.com" — what the app shows back; the full address never leaves the server. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(3, local.length - 2)))}@${domain}`;
}

/** A valid IANA zone, or "UTC". The browser reports it; never trust it blindly. */
export function safeTimeZone(tz: string | undefined | null): string {
  if (!tz || tz.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function localHour(nowMs: number, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hour: "numeric",
    hourCycle: "h23",
  }).format(new Date(nowMs));
  return Number(h) % 24;
}

/**
 * Whether this subscriber gets today's reminder on this run. The edition is
 * the UTC date, so a player east of UTC can be mailed as soon as the edition
 * flips; one west of UTC waits for their own morning.
 */
export function reminderDue(args: {
  nowMs: number;
  todayKey: string;
  timeZone: string;
  lastSentDateKey?: string | null;
  playedToday: boolean;
  lastFinishedDateKey?: string | null;
  confirmedAt: number;
}): boolean {
  if (args.lastSentDateKey === args.todayKey || args.playedToday) return false;
  const h = localHour(args.nowMs, args.timeZone);
  if (h < REMINDER_LOCAL_HOUR_FROM || h > REMINDER_LOCAL_HOUR_TO) return false;
  const dormantCutoff = addDaysToDateKey(args.todayKey, -REMINDER_DORMANT_DAYS);
  const lastActive = args.lastFinishedDateKey ?? new Date(args.confirmedAt).toISOString().slice(0, 10);
  return lastActive >= dormantCutoff;
}

/** "14h 22m" until the next UTC midnight — when the streak breaks. */
export function hoursMinutesUntilMidnightUTC(nowMs: number): string {
  const next = Math.floor(nowMs / MS_PER_DAY + 1) * MS_PER_DAY;
  const mins = Math.max(0, Math.floor((next - nowMs) / 60_000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

// ── Challenge ───────────────────────────────────────────────────────────────

export type ChallengeVerdict = "won" | "lost" | "tie";

/** From the challenged player's side. */
export function challengeVerdict(mine: number, theirs: number): ChallengeVerdict {
  if (mine > theirs) return "won";
  if (mine < theirs) return "lost";
  return "tie";
}
