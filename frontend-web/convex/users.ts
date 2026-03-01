import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const ensureProfile = mutation({
  args: {
    username: v.string(),
    displayName: v.optional(v.string()),
    isGuest: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(userId);
    if (existing) return userId;

    // For Convex Auth, user doc is created by the auth system.
    // We patch additional fields onto it.
    await ctx.db.patch(userId, {
      username: args.username,
      displayName: args.displayName ?? args.username,
      isGuest: args.isGuest,
      totalGames: 0,
    });

    return userId;
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
  },
});
