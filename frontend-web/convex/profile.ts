import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const ratings = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) => q.eq("userId", userId))
      .collect();

    const games = await ctx.db
      .query("gameSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    const totalGames = ratings.reduce((s, r) => s + r.gamesPlayed, 0);
    const totalWins = ratings.reduce((s, r) => s + r.wins, 0);
    const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    const maxElo = ratings.reduce((m, r) => Math.max(m, r.eloRating), 1200);

    // Find favorite sport (most games played)
    const sportGames: Record<string, number> = {};
    for (const r of ratings) {
      sportGames[r.sport] = (sportGames[r.sport] ?? 0) + r.gamesPlayed;
    }
    const favSport =
      Object.entries(sportGames).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const recentGames = games.map((g) => ({
      id: g._id,
      sport: g.sport,
      gameMode: g.mode,
      score: g.score ?? 0,
      eloChange: g.eloChange,
      playedAt: g.endedAt ?? g._creationTime,
    }));

    return {
      userId: user._id,
      username: user.username ?? "",
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      eloRating: maxElo,
      createdAt: user._creationTime,
      stats: {
        totalGames,
        totalWins,
        winRate,
        currentStreak: 0,
        bestStreak: 0,
        favoriteSport: favSport,
      },
      recentGames,
    };
  },
});
