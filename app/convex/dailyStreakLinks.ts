/**
 * STREAK LINKS — carrying a daily-game streak to another browser without an
 * email (docs/RETURN_LOOP.md part C).
 *
 * Every browser is its own anonymous account, and half the daily players play
 * inside Instagram's in-app browser. A player there copies a link
 * (`createTransfer`); opening it in Safari/Chrome (`claimTransfer`, `?st=` on
 * /older or /letters) joins that browser's account to theirs, and from then on
 * both games' streaks count every account in the group
 * (lib/dailyGames.ts streakUserIds). Rules: lib/whosOlderRetention.ts.
 */
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertSessionUser } from "./lib/authz";
import { streakGroupOf } from "./lib/dailyGames";
import {
  STREAK_TRANSFERS_PER_DAY,
  STREAK_TRANSFER_TTL_MS,
  planStreakMerge,
  streakTransferState,
} from "./lib/whosOlderRetention";

const DAY_MS = 24 * 60 * 60 * 1000;

function randomToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

/** "Copy link" under the streak: a fresh one-week token for the caller. */
export const createTransfer = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);
    const now = Date.now();
    const recent = await ctx.db
      .query("dailyStreakTransfers")
      .withIndex("by_from_created", (q) => q.eq("fromUserId", userId).gt("createdAt", now - DAY_MS))
      .take(STREAK_TRANSFERS_PER_DAY);
    if (recent.length >= STREAK_TRANSFERS_PER_DAY) throw new ConvexError({ code: "rate_limited" });
    const token = randomToken();
    await ctx.db.insert("dailyStreakTransfers", {
      token,
      fromUserId: userId,
      createdAt: now,
      expiresAt: now + STREAK_TRANSFER_TTL_MS,
      claimCount: 0,
    });
    return { token };
  },
});

/**
 * A streak link was opened. Joins this browser's account to the sender's
 * group. Never throws on a bad link: a stale or mistyped `?st=` must not break
 * the game it opens, so every refusal is a `reason`.
 */
export const claimTransfer = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 32 || token.length > 128) return { ok: false as const, reason: "unknown" as const };
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, reason: "signed_out" as const };
    const transfer = await ctx.db
      .query("dailyStreakTransfers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!transfer) return { ok: false as const, reason: "unknown" as const };
    const state = streakTransferState(transfer, userId, Date.now());
    // The sender reopening their own link (same browser) is fine and silent.
    if (state === "own") return { ok: true as const, accounts: 1, alreadyLinked: true };
    if (state !== "ok") return { ok: false as const, reason: state };

    const from = await streakGroupOf(ctx, transfer.fromUserId);
    const to = await streakGroupOf(ctx, userId);
    const plan = planStreakMerge(
      { userId: transfer.fromUserId, groupId: from.groupId, members: from.members },
      { userId, groupId: to.groupId, members: to.members },
    );
    if (!plan.ok) return { ok: false as const, reason: "group_full" as const };
    if (!plan.alreadyLinked) {
      await writeGroup(ctx, plan.groupId, plan.members as Id<"users">[]);
      await ctx.db.patch(transfer._id, { claimCount: transfer.claimCount + 1 });
    }
    return { ok: true as const, accounts: plan.members.length, alreadyLinked: plan.alreadyLinked };
  },
});

/** Points every member's link row at `groupId`, adding rows for new members. */
async function writeGroup(ctx: Pick<MutationCtx, "db">, groupId: string, members: Id<"users">[]) {
  const now = Date.now();
  for (const userId of members) {
    const row = await ctx.db
      .query("dailyStreakLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!row) await ctx.db.insert("dailyStreakLinks", { groupId, userId, createdAt: now });
    else if (row.groupId !== groupId) await ctx.db.patch(row._id, { groupId });
  }
}
