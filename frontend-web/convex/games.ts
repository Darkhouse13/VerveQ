import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  calculateEloChange,
  getQuizPerformance,
  getSurvivalPerformance,
  clampRating,
  getKFactor,
} from "./lib/elo";

export const completeQuiz = mutation({
  args: {
    sport: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    accuracy: v.number(),
    averageTime: v.number(),
    difficulty: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rating = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) =>
        q.eq("userId", userId).eq("sport", args.sport).eq("mode", "quiz"),
      )
      .first();

    const currentElo = rating?.eloRating ?? 1200;
    const { k, label: kFactorLabel } = getKFactor(
      rating?.gamesPlayed ?? 0,
      currentElo,
    );
    const perf = getQuizPerformance(
      args.score,
      args.totalQuestions,
      args.averageTime,
    );
    const eloChange = calculateEloChange(currentElo, perf, args.difficulty, k);
    const newElo = clampRating(currentElo + eloChange);
    const isWin = args.accuracy >= 0.8;

    if (rating) {
      const newGames = rating.gamesPlayed + 1;
      await ctx.db.patch(rating._id, {
        eloRating: newElo,
        peakRating: Math.max(rating.peakRating, newElo),
        gamesPlayed: newGames,
        wins: rating.wins + (isWin ? 1 : 0),
        losses: rating.losses + (isWin ? 0 : 1),
        bestScore: Math.max(rating.bestScore, args.score),
        averageScore:
          (rating.averageScore * (newGames - 1) + args.score) / newGames,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    } else {
      await ctx.db.insert("userRatings", {
        userId,
        sport: args.sport,
        mode: "quiz",
        eloRating: newElo,
        peakRating: newElo,
        gamesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        bestScore: args.score,
        averageScore: args.score,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    }

    await ctx.db.insert("gameSessions", {
      userId,
      sport: args.sport,
      mode: "quiz",
      score: args.score,
      totalQuestions: args.totalQuestions,
      correctAnswers: args.score,
      accuracy: args.accuracy,
      avgAnswerTimeSecs: args.averageTime,
      eloBefore: currentElo,
      eloAfter: newElo,
      eloChange,
      endedAt: Date.now(),
      sessionType: "game",
      kFactor: k,
      kFactorLabel,
    });

    // Increment total games on user
    const user = await ctx.db.get(userId);
    if (user?.totalGames !== undefined) {
      await ctx.db.patch(userId, { totalGames: (user.totalGames ?? 0) + 1 });
    }

    return { eloChange, newElo, kFactor: k, kFactorLabel };
  },
});

export const completeSurvival = mutation({
  args: {
    sport: v.string(),
    score: v.number(),
    durationSeconds: v.number(),
    performanceBonus: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rating = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) =>
        q.eq("userId", userId).eq("sport", args.sport).eq("mode", "survival"),
      )
      .first();

    const currentElo = rating?.eloRating ?? 1200;
    const { k, label: kFactorLabel } = getKFactor(
      rating?.gamesPlayed ?? 0,
      currentElo,
    );
    const basePerf = getSurvivalPerformance(args.score);
    const perf = Math.min(1.0, basePerf + (args.performanceBonus ?? 0));
    const difficulty =
      args.score >= 10 ? "hard" : args.score >= 5 ? "intermediate" : "easy";
    const eloChange = calculateEloChange(currentElo, perf, difficulty, k);
    const newElo = clampRating(currentElo + eloChange);
    const isWin = args.score >= 10;

    if (rating) {
      const newGames = rating.gamesPlayed + 1;
      await ctx.db.patch(rating._id, {
        eloRating: newElo,
        peakRating: Math.max(rating.peakRating, newElo),
        gamesPlayed: newGames,
        wins: rating.wins + (isWin ? 1 : 0),
        losses: rating.losses + (isWin ? 0 : 1),
        bestScore: Math.max(rating.bestScore, args.score),
        averageScore:
          (rating.averageScore * (newGames - 1) + args.score) / newGames,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    } else {
      await ctx.db.insert("userRatings", {
        userId,
        sport: args.sport,
        mode: "survival",
        eloRating: newElo,
        peakRating: newElo,
        gamesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        bestScore: args.score,
        averageScore: args.score,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    }

    await ctx.db.insert("gameSessions", {
      userId,
      sport: args.sport,
      mode: "survival",
      score: args.score,
      durationSeconds: args.durationSeconds,
      eloBefore: currentElo,
      eloAfter: newElo,
      eloChange,
      endedAt: Date.now(),
      sessionType: "game",
      kFactor: k,
      kFactorLabel,
    });

    const user = await ctx.db.get(userId);
    if (user?.totalGames !== undefined) {
      await ctx.db.patch(userId, { totalGames: (user.totalGames ?? 0) + 1 });
    }

    return { eloChange, newElo, kFactor: k, kFactorLabel };
  },
});
