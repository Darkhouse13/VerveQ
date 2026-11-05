import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertRankedEligibleUser } from "./lib/authz";
import { unlockAchievements } from "./lib/achievementUnlock";
import { settleQuizSession, settleSurvivalSession } from "./lib/rankedSettle";

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

    if ((session.totalAnswers ?? 0) <= 0) {
      throw new Error("No answers recorded on this session");
    }

    // Settles on the full planned run: unanswered questions count as wrong,
    // so stopping after a lucky start can't farm rating (lib/rankedSettle.ts).
    const result = await settleQuizSession(ctx, session, { abandoned: false });

    // Report unlocks in the same round trip (the app no longer calls
    // achievements.checkAndUnlock after a game; the web still may).
    const { newlyUnlocked } = await unlockAchievements(ctx, userId, {
      mode: session.mode ?? "quiz",
      totalQuestions: result.runLength,
      correctAnswers: result.correctCount,
      accuracy: result.accuracy,
    });

    return {
      newlyUnlocked,
      eloChange: result.eloChange,
      newElo: result.newElo,
      kFactor: result.kFactor,
      kFactorLabel: result.kFactorLabel,
      score: result.score,
      correctCount: result.correctCount,
      totalAnswers: result.totalAnswers,
      accuracy: result.accuracy,
      averageTime: result.averageTime,
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

    const result = await settleSurvivalSession(ctx, session, { countAsPlay: true });
    const { newlyUnlocked } = await unlockAchievements(ctx, userId);

    return {
      newlyUnlocked,
      eloChange: result.eloChange,
      newElo: result.newElo,
      kFactor: result.kFactor,
      kFactorLabel: result.kFactorLabel,
      score: result.score,
      durationSeconds: result.durationSeconds,
    };
  },
});
