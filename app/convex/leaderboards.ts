import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { isRankedEligibleUserDoc } from "./lib/authz";

export const getLeaderboard = query({
  args: {
    sport: v.optional(v.string()),
    mode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sport, mode, limit = 20 }) => {
    let ratings: Doc<"userRatings">[];
    if (sport && mode) {
      ratings = await ctx.db
        .query("userRatings")
        .withIndex("by_sport_mode_elo", (q) =>
          q.eq("sport", sport).eq("mode", mode),
        )
        .order("desc")
        .take(limit);
    } else {
      ratings = await ctx.db.query("userRatings").order("desc").take(200);
    }

    const entries = [];
    for (const r of ratings) {
      if (r.gamesPlayed <= 0) continue;
      const user = await ctx.db.get(r.userId);
      if (!isRankedEligibleUserDoc(user)) continue;
      entries.push({
        rank: entries.length + 1,
        userId: r.userId,
        username: user?.username ?? "Unknown",
        score: r.bestScore,
        elo_rating: r.eloRating,
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
      });
      if (entries.length >= limit) break;
    }

    // Sort by ELO descending and re-rank
    entries.sort((a, b) => (b.elo_rating ?? 0) - (a.elo_rating ?? 0));
    entries.forEach((e, i) => (e.rank = i + 1));

    return {
      sport: sport ?? null,
      gameMode: mode ?? null,
      entries,
      totalEntries: entries.length,
    };
  },
});
