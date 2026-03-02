import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

    const existing = await ctx.db
      .query("userAchievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const unlockedSet = new Set(existing.map((e) => e.achievementId));

    // Get user stats
    const ratings = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) => q.eq("userId", userId))
      .collect();

    const totalGames = ratings.reduce((s, r) => s + r.gamesPlayed, 0);
    const quizGames = ratings
      .filter((r) => r.mode === "quiz")
      .reduce((s, r) => s + r.gamesPlayed, 0);
    const survivalGames = ratings
      .filter((r) => r.mode === "survival")
      .reduce((s, r) => s + r.gamesPlayed, 0);
    const maxSurvivalScore = ratings
      .filter((r) => r.mode === "survival")
      .reduce((m, r) => Math.max(m, r.bestScore), 0);
    const maxElo = ratings.reduce((m, r) => Math.max(m, r.eloRating), 0);
    const sportsPlayed = new Set(ratings.map((r) => r.sport)).size;

    const user = await ctx.db.get(userId);
    const approvedQuestions = user?.approvedQuestionsCount ?? 0;

    const checks: [string, boolean][] = [
      ["first_quiz", quizGames >= 1],
      ["first_survival", survivalGames >= 1],
      ["survival_legend", maxSurvivalScore >= 15],
      ["multi_sport_athlete", sportsPlayed >= 2],
      ["dedicated_player", totalGames >= 50],
      ["elo_champion", maxElo >= 1500],
      ["the_architect", approvedQuestions >= 1],
    ];

    const newlyUnlocked: string[] = [];
    for (const [achId, met] of checks) {
      if (met && !unlockedSet.has(achId)) {
        await ctx.db.insert("userAchievements", {
          userId,
          achievementId: achId,
          unlockedAt: Date.now(),
        });
        newlyUnlocked.push(achId);
      }
    }

    return {
      newlyUnlocked,
      totalUnlocked: existing.length + newlyUnlocked.length,
    };
  },
});
