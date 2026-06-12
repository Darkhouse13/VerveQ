import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Daily play streak — consecutive UTC days with at least one completed run.
 *
 * Day boundaries are UTC to match the daily challenge (`getTodayUTC`), so the
 * "keep the streak" hooks and the daily reset agree on when a day flips. The
 * stored `currentStreak` is only valid while `lastPlayedDay` is today or
 * yesterday; readers (profile.get) must report 0 for older values rather than
 * resurrecting a stale streak.
 */

export const MS_PER_DAY = 86_400_000;

/** UTC day number for a timestamp (days since epoch). */
export function utcDayNumber(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

export interface StreakFields {
  lastPlayedDay?: number;
  currentStreak?: number;
  bestStreak?: number;
}

/**
 * The streak fields a completed play on `day` produces, or null when nothing
 * changes (already counted today, or the stored day is in the future — a
 * clock-skew guard that must never shrink a streak).
 */
export function advanceStreak(
  prev: StreakFields,
  day: number,
): Required<StreakFields> | null {
  const last = prev.lastPlayedDay;
  if (last !== undefined && last >= day) return null;
  const currentStreak =
    last === day - 1 ? (prev.currentStreak ?? 0) + 1 : 1;
  const bestStreak = Math.max(prev.bestStreak ?? 0, currentStreak);
  return { lastPlayedDay: day, currentStreak, bestStreak };
}

/** True while the stored streak is unbroken (played today or yesterday). */
export function isStreakAlive(
  lastPlayedDay: number | undefined,
  day: number,
): boolean {
  return lastPlayedDay !== undefined && lastPlayedDay >= day - 1;
}

/** Count a completed run toward the user's daily streak. */
export async function recordPlayForStreak(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number = Date.now(),
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const patch = advanceStreak(user, utcDayNumber(now));
  if (patch) await ctx.db.patch(userId, patch);
}
