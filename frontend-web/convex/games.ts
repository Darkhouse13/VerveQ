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
    sessionId: v.id("quizSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }

    const totalAnswers = session.totalAnswers ?? 0;
    if (totalAnswers <= 0) {
      throw new Error("No answers recorded on this session");
    }

    const correctCount = session.correctCount ?? 0;
    const accuracy = correctCount / totalAnswers;
    const averageTime = (session.sumAnswerTimeMs ?? 0) / 1000 / totalAnswers;
    const difficulty = session.difficulty ?? "intermediate";
    const sport = session.sport;
    const sessionScore = session.score ?? 0;

    const rating = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) =>
        q.eq("userId", userId).eq("sport", sport).eq("mode", "quiz"),
      )
      .first();

    const currentElo = rating?.eloRating ?? 1200;
    const { k, label: kFactorLabel } = getKFactor(
      rating?.gamesPlayed ?? 0,
      currentElo,
    );
    const perf = getQuizPerformance(correctCount, totalAnswers, averageTime);
    const eloChange = calculateEloChange(currentElo, perf, difficulty, k);
    const newElo = clampRating(currentElo + eloChange);
    const isWin = accuracy >= 0.8;

    if (rating) {
      const newGames = rating.gamesPlayed + 1;
      await ctx.db.patch(rating._id, {
        eloRating: newElo,
        peakRating: Math.max(rating.peakRating, newElo),
        gamesPlayed: newGames,
        wins: rating.wins + (isWin ? 1 : 0),
        losses: rating.losses + (isWin ? 0 : 1),
        bestScore: Math.max(rating.bestScore, correctCount),
        averageScore:
          (rating.averageScore * (newGames - 1) + correctCount) / newGames,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    } else {
      await ctx.db.insert("userRatings", {
        userId,
        sport,
        mode: "quiz",
        eloRating: newElo,
        peakRating: newElo,
        gamesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        bestScore: correctCount,
        averageScore: correctCount,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    }

    await ctx.db.insert("gameSessions", {
      userId,
      sport,
      mode: "quiz",
      score: sessionScore,
      totalQuestions: totalAnswers,
      correctAnswers: correctCount,
      accuracy,
      avgAnswerTimeSecs: averageTime,
      eloBefore: currentElo,
      eloAfter: newElo,
      eloChange,
      endedAt: Date.now(),
      sessionType: "game",
      kFactor: k,
      kFactorLabel,
    });

    await ctx.db.patch(sessionId, { completed: true });

    // Increment total games on user
    const user = await ctx.db.get(userId);
    if (user?.totalGames !== undefined) {
      await ctx.db.patch(userId, { totalGames: (user.totalGames ?? 0) + 1 });
    }

    return {
      eloChange,
      newElo,
      kFactor: k,
      kFactorLabel,
      score: sessionScore,
      correctCount,
      totalAnswers,
      accuracy,
      averageTime,
    };
  },
});

export const completeSurvival = mutation({
  args: {
    sessionId: v.id("survivalSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (!session.gameOver) {
      throw new Error("Session is still active");
    }
    if (session.completedAt) {
      throw new Error("Session already completed");
    }

    const sport = session.sport;
    const score = session.score;
    const performanceBonus = session.performanceBonus ?? 0;
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - session._creationTime) / 1000),
    );

    const rating = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) =>
        q.eq("userId", userId).eq("sport", sport).eq("mode", "survival"),
      )
      .first();

    const currentElo = rating?.eloRating ?? 1200;
    const { k, label: kFactorLabel } = getKFactor(
      rating?.gamesPlayed ?? 0,
      currentElo,
    );
    const basePerf = getSurvivalPerformance(score);
    const perf = Math.min(1.0, basePerf + performanceBonus);
    const difficulty =
      score >= 10 ? "hard" : score >= 5 ? "intermediate" : "easy";
    const eloChange = calculateEloChange(currentElo, perf, difficulty, k);
    const newElo = clampRating(currentElo + eloChange);
    const isWin = score >= 10;

    if (rating) {
      const newGames = rating.gamesPlayed + 1;
      await ctx.db.patch(rating._id, {
        eloRating: newElo,
        peakRating: Math.max(rating.peakRating, newElo),
        gamesPlayed: newGames,
        wins: rating.wins + (isWin ? 1 : 0),
        losses: rating.losses + (isWin ? 0 : 1),
        bestScore: Math.max(rating.bestScore, score),
        averageScore:
          (rating.averageScore * (newGames - 1) + score) / newGames,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    } else {
      await ctx.db.insert("userRatings", {
        userId,
        sport,
        mode: "survival",
        eloRating: newElo,
        peakRating: newElo,
        gamesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        bestScore: score,
        averageScore: score,
        lastPlayed: Date.now(),
        lastDecayAt: 0,
        decayWarningShown: false,
      });
    }

    await ctx.db.insert("gameSessions", {
      userId,
      sport,
      mode: "survival",
      score,
      durationSeconds,
      eloBefore: currentElo,
      eloAfter: newElo,
      eloChange,
      endedAt: Date.now(),
      sessionType: "game",
      kFactor: k,
      kFactorLabel,
    });

    await ctx.db.patch(sessionId, { completedAt: Date.now() });

    const user = await ctx.db.get(userId);
    if (user?.totalGames !== undefined) {
      await ctx.db.patch(userId, { totalGames: (user.totalGames ?? 0) + 1 });
    }

    return {
      eloChange,
      newElo,
      kFactor: k,
      kFactorLabel,
      score,
      durationSeconds,
    };
  },
});
