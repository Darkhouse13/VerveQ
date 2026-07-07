import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertRankedEligibleUser } from "./lib/authz";
import { advanceStreak, utcDayNumber } from "./lib/streaks";
import {
  calculateEloChange,
  getQuizPerformance,
  getSurvivalPerformance,
  getSurvivalDifficultyTier,
  SURVIVAL_WIN_POINTS,
  clampRating,
  getKFactor,
} from "./lib/elo";

async function dismissOutstandingDecayNotifications(
  ctx: MutationCtx,
  userId: Id<"users">,
  sport: string,
  mode: string,
) {
  const notifications = await ctx.db
    .query("decayNotifications")
    .withIndex("by_user_sport_mode", (q) =>
      q.eq("userId", userId).eq("sport", sport).eq("mode", mode),
    )
    .collect();

  for (const notification of notifications) {
    if (!notification.dismissed) {
      await ctx.db.patch(notification._id, { dismissed: true });
    }
  }
}

export const completeQuiz = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    sport: v.optional(v.string()),
    mode: v.optional(v.string()),
    score: v.optional(v.number()),
    totalQuestions: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    averageTime: v.optional(v.number()),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("intermediate"), v.literal("hard")),
    ),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertRankedEligibleUser(ctx, userId);

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
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
    const mode = session.mode ?? "quiz";
    const sessionScore = session.score ?? 0;

    const rating = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) =>
        q.eq("userId", userId).eq("sport", sport).eq("mode", mode),
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
        decayWarningShown: false,
      });
      await dismissOutstandingDecayNotifications(ctx, userId, sport, mode);
    } else {
      await ctx.db.insert("userRatings", {
        userId,
        sport,
        mode,
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
      mode,
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

    // Count the play: lifetime total (legacy docs without the counter are
    // left alone) and the daily streak (always).
    const user = await ctx.db.get(userId);
    if (user) {
      const playPatch = {
        ...(user.totalGames !== undefined
          ? { totalGames: user.totalGames + 1 }
          : {}),
        ...(advanceStreak(user, utcDayNumber(Date.now())) ?? {}),
      };
      if (Object.keys(playPatch).length > 0) {
        await ctx.db.patch(userId, playPatch);
      }
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
    sport: v.optional(v.string()),
    mode: v.optional(v.string()),
    score: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    performanceBonus: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertRankedEligibleUser(ctx, userId);

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    // Daily Survival is casual by design: its result lives in dailyAttempts
    // and must never reach the ELO ladder.
    if (session.dailyDate) {
      throw new Error("Daily survival runs are not ranked");
    }
    if (!session.gameOver) {
      throw new Error("Session is still active");
    }
    if (session.completedAt) {
      throw new Error("Session already completed");
    }
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }

    const sport = session.sport;
    const score = session.score;
    const performanceBonus = session.performanceBonus ?? 0;
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - (session.startedAt ?? session._creationTime)) / 1000),
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
    const difficulty = getSurvivalDifficultyTier(score);
    const eloChange = calculateEloChange(currentElo, perf, difficulty, k);
    const newElo = clampRating(currentElo + eloChange);
    const isWin = score >= SURVIVAL_WIN_POINTS;

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
        decayWarningShown: false,
      });
      await dismissOutstandingDecayNotifications(ctx, userId, sport, "survival");
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

    // Count the play: lifetime total (legacy docs without the counter are
    // left alone) and the daily streak (always).
    const user = await ctx.db.get(userId);
    if (user) {
      const playPatch = {
        ...(user.totalGames !== undefined
          ? { totalGames: user.totalGames + 1 }
          : {}),
        ...(advanceStreak(user, utcDayNumber(Date.now())) ?? {}),
      };
      if (Object.keys(playPatch).length > 0) {
        await ctx.db.patch(userId, playPatch);
      }
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
