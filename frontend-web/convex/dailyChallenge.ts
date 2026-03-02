import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getTodayUTC, seededShuffle } from "./lib/daily";

const DAILY_QUIZ_COUNT = 10;

// ── Queries ──

export const getOrCreateChallenge = mutation({
  args: {
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
  },
  handler: async (ctx, { sport, mode }) => {
    const date = getTodayUTC();

    const existing = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) =>
        q.eq("date", date).eq("sport", sport).eq("mode", mode),
      )
      .first();

    if (existing) return existing;

    // Lazily create today's challenge
    let questionChecksums: string[] = [];
    let survivalInitials: string[] = [];

    if (mode === "quiz") {
      const MAX_IMAGE_QUESTIONS = 3;

      const questions = await ctx.db
        .query("quizQuestions")
        .withIndex("by_sport_difficulty", (q) =>
          q.eq("sport", sport).eq("difficulty", "intermediate"),
        )
        .take(200);

      const shuffled = seededShuffle(questions, `${date}-${sport}-quiz`);

      // Pick up to DAILY_QUIZ_COUNT questions, capping image questions at 3
      // and preventing consecutive image questions
      const selected: typeof shuffled = [];
      let imageCount = 0;
      for (const q of shuffled) {
        if (selected.length >= DAILY_QUIZ_COUNT) break;
        const lastWasImage =
          selected.length > 0 &&
          selected[selected.length - 1].imageId != null;
        if (q.imageId) {
          if (imageCount >= MAX_IMAGE_QUESTIONS || lastWasImage) continue;
          imageCount++;
        }
        selected.push(q);
      }

      questionChecksums = selected.map((q) => q.checksum);
    } else {
      // For survival, we just store an empty array — survival uses its own session logic
      survivalInitials = [];
    }

    const id = await ctx.db.insert("dailyChallenges", {
      date,
      sport,
      mode,
      questionChecksums,
      survivalInitials,
      createdAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

export const getAttemptStatus = query({
  args: {
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
  },
  handler: async (ctx, { sport, mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const date = getTodayUTC();
    const attempt = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_user_date_sport_mode", (q) =>
        q
          .eq("userId", userId)
          .eq("date", date)
          .eq("sport", sport)
          .eq("mode", mode),
      )
      .first();

    if (!attempt) return null;
    return {
      score: attempt.score,
      completed: attempt.completed,
      forfeited: attempt.forfeited,
      results: attempt.results,
    };
  },
});

export const startAttempt = mutation({
  args: {
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
  },
  handler: async (ctx, { sport, mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const date = getTodayUTC();

    // Check for existing attempt
    const existing = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_user_date_sport_mode", (q) =>
        q
          .eq("userId", userId)
          .eq("date", date)
          .eq("sport", sport)
          .eq("mode", mode),
      )
      .first();

    if (existing) throw new Error("Already attempted today's challenge");

    const attemptId = await ctx.db.insert("dailyAttempts", {
      userId,
      date,
      sport,
      mode,
      score: 0,
      completed: false,
      forfeited: false,
      results: [],
      startedAt: Date.now(),
    });

    return { attemptId };
  },
});

export const getQuestion = query({
  args: {
    attemptId: v.id("dailyAttempts"),
    questionIndex: v.number(),
  },
  handler: async (ctx, { attemptId, questionIndex }) => {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");

    const challenge = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) =>
        q
          .eq("date", attempt.date)
          .eq("sport", attempt.sport)
          .eq("mode", attempt.mode),
      )
      .first();

    if (!challenge) throw new Error("Challenge not found");

    const checksum = challenge.questionChecksums[questionIndex];
    if (!checksum) throw new Error("Question index out of range");

    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();

    if (!question) throw new Error("Question not found");

    const imageUrl = question.imageId
      ? await ctx.storage.getUrl(question.imageId)
      : null;

    return {
      question: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
      checksum: question.checksum,
      category: question.category,
      imageUrl,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    attemptId: v.id("dailyAttempts"),
    answer: v.string(),
    correctAnswer: v.string(),
    timeTaken: v.number(),
  },
  handler: async (ctx, { attemptId, answer, correctAnswer, timeTaken }) => {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.completed || attempt.forfeited)
      throw new Error("Attempt already finished");

    const isCorrect = answer === correctAnswer;
    // Same scoring as quiz: base 100 with time bonus
    const maxTime = 10;
    let score = 0;
    if (isCorrect) {
      if (timeTaken <= 1) score = 100;
      else if (timeTaken <= maxTime)
        score = Math.floor(100 * ((maxTime - timeTaken) / (maxTime - 1)));
    }

    const results = [...(attempt.results || []), { correct: isCorrect, timeTaken, score }];
    const totalScore = results.reduce(
      (sum: number, r: { score: number }) => sum + r.score,
      0,
    );

    await ctx.db.patch(attemptId, { results, score: totalScore });

    return { correct: isCorrect, score, totalScore };
  },
});

export const forfeit = mutation({
  args: { attemptId: v.id("dailyAttempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");

    await ctx.db.patch(attemptId, {
      forfeited: true,
      score: 0,
      completedAt: Date.now(),
    });
  },
});

export const completeAttempt = mutation({
  args: { attemptId: v.id("dailyAttempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.completed) throw new Error("Already completed");

    await ctx.db.patch(attemptId, {
      completed: true,
      completedAt: Date.now(),
    });

    return { score: attempt.score, results: attempt.results };
  },
});
