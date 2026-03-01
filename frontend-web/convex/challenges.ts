import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getPending = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, challenges: [] };

    const pending = await ctx.db
      .query("challenges")
      .withIndex("by_challenged_status", (q) =>
        q.eq("challengedId", userId).eq("status", "pending"),
      )
      .collect();

    const challenges = await Promise.all(
      pending.map(async (c) => {
        const challenger = await ctx.db.get(c.challengerId);
        return {
          challengeId: c._id,
          challenger: challenger?.username ?? "Unknown",
          sport: c.sport,
          mode: c.mode,
          createdAt: c._creationTime,
          status: c.status,
        };
      }),
    );

    return { total: challenges.length, challenges };
  },
});

export const create = mutation({
  args: {
    challengedUsername: v.string(),
    sport: v.string(),
    mode: v.string(),
  },
  handler: async (ctx, { challengedUsername, sport, mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenged = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", challengedUsername))
      .first();

    if (!challenged) throw new Error("User not found");
    if (challenged._id === userId) throw new Error("Cannot challenge yourself");

    const challengeId = await ctx.db.insert("challenges", {
      challengerId: userId,
      challengedId: challenged._id,
      sport,
      mode,
      status: "pending",
    });

    return { challengeId };
  },
});

export const accept = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenge = await ctx.db.get(challengeId);
    if (!challenge || challenge.challengedId !== userId) {
      throw new Error("Challenge not found");
    }

    await ctx.db.patch(challengeId, { status: "active" });
    return { success: true };
  },
});

export const decline = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenge = await ctx.db.get(challengeId);
    if (!challenge || challenge.challengedId !== userId) {
      throw new Error("Challenge not found");
    }

    await ctx.db.patch(challengeId, { status: "declined" });
    return { success: true };
  },
});
