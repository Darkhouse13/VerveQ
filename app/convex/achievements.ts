import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { unlockAchievements } from "./lib/achievementUnlock";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("achievements").collect();
    return all.filter((a) => !a.isHidden);
  },
});

export const userAchievements = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    if (!userId) return [];
    const unlocked = await ctx.db
      .query("userAchievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return Promise.all(
      unlocked.map(async (ua) => {
        const achievement = await ctx.db
          .query("achievements")
          .withIndex("by_achievement_id", (q) =>
            q.eq("achievementId", ua.achievementId),
          )
          .first();
        return {
          ...ua,
          achievement: achievement ?? {
            achievementId: ua.achievementId,
            name: ua.achievementId,
            description: "",
            category: "",
            points: 0,
            isHidden: false,
          },
        };
      }),
    );
  },
});

export const checkAndUnlock = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await unlockAchievements(ctx, userId);
  },
});
