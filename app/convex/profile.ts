import { query } from "./_generated/server";
import { v } from "convex/values";
import { isRankedEligibleUserDoc } from "./lib/authz";
import { isStreakAlive, utcDayNumber } from "./lib/streaks";

export const get = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;
    const rankedEligible = isRankedEligibleUserDoc(user);

    const ratings = rankedEligible
      ? await ctx.db
          .query("userRatings")
          .withIndex("by_user_sport_mode", (q) => q.eq("userId", userId))
          .collect()
      : [];

    const games = rankedEligible
      ? await ctx.db
          .query("gameSessions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(10)
      : [];

    const rankedRatings = ratings.filter(
      (r) => r.mode === "quiz" || r.mode === "survival",
    );

    const totalGames = rankedRatings.reduce((s, r) => s + r.gamesPlayed, 0);
    const totalWins = rankedRatings.reduce((s, r) => s + r.wins, 0);
    const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;
    const currentElo =
      rankedRatings.length > 0
        ? Math.round(Math.max(...rankedRatings.map((r) => r.eloRating)))
        : 1200;

    // Find favorite sport (most games played)
    const sportGames: Record<string, number> = {};
    for (const r of rankedRatings) {
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
      sessionType: g.sessionType,
      kFactorLabel: g.kFactorLabel,
    }));

    return {
      userId: user._id,
      username: user.username ?? "",
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      eloRating: currentElo,
      // Anonymous (username-only) users are excluded from ranked, so their
      // `eloRating` above is just the 1200 baseline — clients use this flag to
      // show "—" instead of implying a ranked standing that doesn't exist.
      rankedEligible,
      // All completed plays counted on the user doc (includes casual modes),
      // vs `stats.totalGames` which counts ranked quiz/survival only.
      totalPlays: user.totalGames ?? 0,
      createdAt: user._creationTime,
      stats: {
        totalGames,
        totalWins,
        winRate,
        // A streak is only current while unbroken (played today/yesterday);
        // stale values report 0 instead of resurrecting an ended streak.
        currentStreak: isStreakAlive(user.lastPlayedDay, utcDayNumber(Date.now()))
          ? (user.currentStreak ?? 0)
          : 0,
        bestStreak: user.bestStreak ?? 0,
        favoriteSport: favSport,
      },
      recentGames,
    };
  },
});
