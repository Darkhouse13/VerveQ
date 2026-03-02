import { query } from "./_generated/server";
import { v } from "convex/values";
import { getTodayUTC } from "./lib/daily";

export const getDailyLeaderboard = query({
  args: {
    date: v.optional(v.string()),
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { date, sport, mode, limit = 20 }) => {
    const targetDate = date ?? getTodayUTC();

    const attempts = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_date_sport_mode_score", (q) =>
        q.eq("date", targetDate).eq("sport", sport).eq("mode", mode),
      )
      .order("desc")
      .take(100);

    // Filter to completed only and sort by score
    const completed = attempts
      .filter((a) => a.completed && !a.forfeited)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const entries = await Promise.all(
      completed.map(async (a, idx) => {
        const user = await ctx.db.get(a.userId);
        return {
          rank: idx + 1,
          userId: a.userId,
          username: user?.username ?? "Unknown",
          score: a.score,
          completedAt: a.completedAt,
        };
      }),
    );

    return {
      date: targetDate,
      sport,
      mode,
      entries,
      totalEntries: entries.length,
    };
  },
});
