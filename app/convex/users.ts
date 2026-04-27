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
    // Convex Auth creates the users doc up-front, so `existing` is always
    // non-null here. Pre-BLOCKER-1 fix the handler returned early on any
    // existing doc and therefore never patched username, leaving
    // users.getByUsername unable to find first-time users (audit #7).
    //
    // New behavior: patch the username only when it is missing or empty;
    // leave already-set usernames alone so this stays idempotent across
    // subsequent signIn / ensureProfile calls.
    const hasUsername =
      !!existing &&
      typeof existing.username === "string" &&
      existing.username.trim().length > 0;
    if (hasUsername) {
      const updates: {
        displayName?: string;
        isGuest?: boolean;
        totalGames?: number;
      } = {};
      if (existing?.isGuest !== args.isGuest) {
        updates.isGuest = args.isGuest;
      }
      if (!existing?.displayName && args.displayName) {
        updates.displayName = args.displayName;
      }
      if (existing?.totalGames === undefined) {
        updates.totalGames = 0;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(userId, updates);
      }
      return userId;
    }

    // Pick a unique candidate. We only try a few deterministic variants
    // before giving up — full uniqueness enforcement is tracked separately
    // (audit HIGH-3).
    const baseCandidate = args.username.trim() || "user";
    let candidate = baseCandidate;
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", candidate))
        .first();
      if (!collision || collision._id === userId) break;
      const suffix = Math.random().toString(36).slice(2, 6);
      candidate = `${baseCandidate}_${suffix}`;
    }

    await ctx.db.patch(userId, {
      username: candidate,
      displayName: args.displayName ?? existing?.displayName ?? candidate,
      isGuest: args.isGuest,
      totalGames: existing?.totalGames ?? 0,
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
