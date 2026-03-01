import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { calculateTimeScore, normalizeAnswer } from "./lib/scoring";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const createSession = mutation({
  args: {
    sport: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { sport, difficulty }) => {
    const sessionId = await ctx.db.insert("quizSessions", {
      sport,
      difficulty,
      usedChecksums: [],
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return { sessionId };
  },
});

export const getQuestion = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    sport: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, sport, difficulty }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }

    const candidates = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", sport).eq("difficulty", difficulty ?? "intermediate"),
      )
      .collect();

    const usedSet = new Set(session.usedChecksums);
    const available = candidates.filter((q) => !usedSet.has(q.checksum));
    if (!available.length) throw new Error("No questions available");

    const picked = available[Math.floor(Math.random() * available.length)];
    await ctx.db.patch(sessionId, {
      usedChecksums: [...session.usedChecksums, picked.checksum],
    });

    // Update usage count
    await ctx.db.patch(picked._id, { usageCount: picked.usageCount + 1 });

    return {
      question: picked.question,
      options: picked.options,
      correctAnswer: picked.correctAnswer,
      explanation: picked.explanation,
      difficulty: picked.difficulty,
      checksum: picked.checksum,
      category: picked.category,
    };
  },
});

export const checkAnswer = mutation({
  args: {
    answer: v.string(),
    correctAnswer: v.string(),
    timeTaken: v.number(),
  },
  handler: async (_ctx, { answer, correctAnswer, timeTaken }) => {
    const isCorrect =
      normalizeAnswer(answer) === normalizeAnswer(correctAnswer);
    const score = isCorrect ? calculateTimeScore(100, timeTaken) : 0;

    return {
      correct: isCorrect,
      score,
      correctAnswer,
    };
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.delete(sessionId);
  },
});

export const submitFeedback = mutation({
  args: {
    checksum: v.string(),
    votedDifficulty: v.string(),
  },
  handler: async (ctx, { checksum, votedDifficulty }) => {
    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) return;

    const diffMap: Record<string, number> = {
      easy: 1,
      intermediate: 2,
      hard: 3,
    };
    const voteVal = diffMap[votedDifficulty] ?? 2;
    const newVotes = question.difficultyVotes + 1;
    const newScore =
      (question.difficultyScore * question.difficultyVotes + voteVal) /
      newVotes;

    await ctx.db.patch(question._id, {
      difficultyVotes: newVotes,
      difficultyScore: newScore,
    });
  },
});
