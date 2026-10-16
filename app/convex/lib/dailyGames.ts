/**
 * The two reel-twin DAILY GAMES — Who's Older? and Missing Letters — share one
 * retention loop: a daily streak, a double-opt-in email reminder and
 * challenge links. Each game keeps its own sessions/challenge tables; the
 * reminder tables are shared and tell the games apart by `game` (absent =
 * Who's Older, the only game when those rows were first written).
 *
 * Read helpers only (no functions are registered here): convex/whosOlder.ts,
 * convex/missingLetters.ts and convex/whosOlderReminders.ts own the I/O.
 */
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { maskEmail } from "./whosOlderRetention";
import { editionNumberForDate } from "./whosOlder";
import { lettersEditionForDate } from "./missingLetters";

export type DailyGame = "older" | "letters";

type Db = Pick<QueryCtx, "db">;

/** The `game` value stored on reminder rows: undefined for Who's Older. */
export function gameField(game: DailyGame): "letters" | undefined {
  return game === "letters" ? "letters" : undefined;
}

export function gameOf(field: "letters" | undefined): DailyGame {
  return field === "letters" ? "letters" : "older";
}

export function editionFor(game: DailyGame, dateKey: string): number {
  return game === "letters" ? lettersEditionForDate(dateKey) : editionNumberForDate(dateKey);
}

/** Dates (UTC keys) on which any of these accounts finished the game's daily. */
export async function finishedDailyDates(ctx: Db, game: DailyGame, userIds: Id<"users">[]) {
  const dates: string[] = [];
  for (const uid of userIds) {
    const rows =
      game === "letters"
        ? await ctx.db
            .query("missingLettersSessions")
            .withIndex("by_user_kind_date", (q) => q.eq("userId", uid).eq("kind", "daily"))
            .collect()
        : await ctx.db
            .query("whosOlderSessions")
            .withIndex("by_user_kind_date", (q) => q.eq("userId", uid).eq("kind", "daily"))
            .collect();
    for (const r of rows) if (r.status === "completed") dates.push(r.dateKey);
  }
  return dates;
}

/**
 * Every account this player's streak spans: their own, plus every browser
 * joined to it — by a copied streak link (dailyStreakLinks, either game) or by
 * opening a reminder email for this game (whosOlderReminderLinks). The jump
 * from Instagram's in-app browser to the phone's own one mints a new
 * anonymous account; these links stitch the two back together.
 */
export async function streakUserIds(ctx: Db, game: DailyGame, userId: Id<"users">) {
  const ids = new Set<Id<"users">>([userId]);
  for (const id of await streakGroupMembers(ctx, userId)) ids.add(id);
  const link = await ctx.db
    .query("whosOlderReminderLinks")
    .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("game", gameField(game)))
    .first();
  if (link) {
    const links = await ctx.db
      .query("whosOlderReminderLinks")
      .withIndex("by_reminder", (q) => q.eq("reminderId", link.reminderId))
      .take(20);
    for (const l of links) ids.add(l.userId);
  }
  return [...ids];
}

/** This account's streak-link group: its id and every account in it (none → null, [itself]). */
export async function streakGroupOf(ctx: Db, userId: Id<"users">) {
  const link = await ctx.db
    .query("dailyStreakLinks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!link) return { groupId: null, members: [userId] };
  const rows = await ctx.db
    .query("dailyStreakLinks")
    .withIndex("by_group", (q) => q.eq("groupId", link.groupId))
    .take(20);
  return { groupId: link.groupId, members: rows.map((r) => r.userId) };
}

async function streakGroupMembers(ctx: Db, userId: Id<"users">) {
  return (await streakGroupOf(ctx, userId)).members;
}

/** The caller's reminder for this game: the one their browser claimed, else the latest they created. */
export async function currentReminder(ctx: Db, game: DailyGame, userId: Id<"users">) {
  const link = await ctx.db
    .query("whosOlderReminderLinks")
    .withIndex("by_user_game", (q) => q.eq("userId", userId).eq("game", gameField(game)))
    .first();
  if (link) return ctx.db.get(link.reminderId);
  return ctx.db
    .query("whosOlderReminders")
    .withIndex("by_creator_game_created", (q) =>
      q.eq("createdByUserId", userId).eq("game", gameField(game)),
    )
    .order("desc")
    .first();
}

/** The reminder this player sees on the result card: claimed, or created here and pending. */
export async function reminderStatus(ctx: Db, game: DailyGame, userId: Id<"users">) {
  const reminder = await currentReminder(ctx, game, userId);
  if (!reminder || reminder.unsubscribedAt) return { state: "none" as const, email: null };
  return {
    state: reminder.confirmedAt ? ("on" as const) : ("pending" as const),
    email: maskEmail(reminder.email),
  };
}

/** Friends' results on this sender's challenges filed after `since` (the reminder email's line). */
export async function challengeResultsSince(
  ctx: Db,
  game: DailyGame,
  fromUserIds: Id<"users">[],
  createdAfter: number,
  since: number,
) {
  let friends = 0;
  for (const uid of fromUserIds) {
    if (game === "letters") {
      const challenges = await ctx.db
        .query("missingLettersChallenges")
        .withIndex("by_from_created", (q) => q.eq("fromUserId", uid).gt("createdAt", createdAfter))
        .take(10);
      for (const c of challenges) {
        const results = await ctx.db
          .query("missingLettersChallengeResults")
          .withIndex("by_challenge", (q) => q.eq("challengeId", c._id))
          .take(50);
        friends += results.filter((x) => x.createdAt > since).length;
      }
    } else {
      const challenges = await ctx.db
        .query("whosOlderChallenges")
        .withIndex("by_from_created", (q) => q.eq("fromUserId", uid).gt("createdAt", createdAfter))
        .take(10);
      for (const c of challenges) {
        const results = await ctx.db
          .query("whosOlderChallengeResults")
          .withIndex("by_challenge", (q) => q.eq("challengeId", c._id))
          .take(50);
        friends += results.filter((x) => x.createdAt > since).length;
      }
    }
  }
  return friends;
}

export async function displayName(ctx: Db, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return user?.username ?? null;
}
