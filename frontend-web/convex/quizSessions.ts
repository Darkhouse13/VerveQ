import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { calculateTimeScore, normalizeAnswer } from "./lib/scoring";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_IMAGE_QUESTIONS = 3;
const QUESTION_BASE_POINTS = 100;

export const createSession = mutation({
  args: {
    sport: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { sport, difficulty }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sessionId = await ctx.db.insert("quizSessions", {
      userId,
      sport,
      difficulty,
      usedChecksums: [],
      score: 0,
      correctCount: 0,
      totalAnswers: 0,
      sumAnswerTimeMs: 0,
      completed: false,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return { sessionId };
  },
});

export const getQuestion = mutation({
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
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }

    const candidates = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", session.sport).eq("difficulty", session.difficulty ?? "intermediate"),
      )
      .collect();

    const usedSet = new Set(session.usedChecksums);
    const available = candidates.filter((q) => !usedSet.has(q.checksum));
    if (!available.length) throw new Error("No questions available");

    const usedImageCount = candidates.filter(
      (c) => usedSet.has(c.checksum) && c.imageId,
    ).length;

    const lastChecksum =
      session.usedChecksums[session.usedChecksums.length - 1];
    const lastWasImage = lastChecksum
      ? candidates.some((c) => c.checksum === lastChecksum && c.imageId)
      : false;

    let pool = available;
    if (usedImageCount >= MAX_IMAGE_QUESTIONS || lastWasImage) {
      const textOnly = available.filter((q) => !q.imageId);
      if (textOnly.length > 0) pool = textOnly;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];
    const now = Date.now();
    await ctx.db.patch(sessionId, {
      usedChecksums: [...session.usedChecksums, picked.checksum],
      currentChecksum: picked.checksum,
      questionStartedAt: now,
    });

    await ctx.db.patch(picked._id, { usageCount: picked.usageCount + 1 });

    const imageUrl = picked.imageId
      ? await ctx.storage.getUrl(picked.imageId)
      : null;

    // correctAnswer + explanation are deliberately withheld — they are
    // revealed by checkAnswer after the server validates the submission.
    return {
      question: picked.question,
      options: picked.options,
      difficulty: picked.difficulty,
      checksum: picked.checksum,
      category: picked.category,
      imageUrl,
    };
  },
});

export const checkAnswer = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    answer: v.string(),
  },
  handler: async (ctx, { sessionId, answer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }

    const checksum = session.currentChecksum;
    if (!checksum) {
      throw new Error("No active question to answer");
    }

    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) {
      throw new Error("Question not found");
    }

    const isCorrect =
      normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
    const now = Date.now();
    const timeTakenMs = Math.max(
      0,
      now - (session.questionStartedAt ?? now),
    );
    const timeTakenSec = timeTakenMs / 1000;
    const score = isCorrect
      ? calculateTimeScore(QUESTION_BASE_POINTS, timeTakenSec)
      : 0;

    await ctx.db.patch(sessionId, {
      score: (session.score ?? 0) + score,
      correctCount: (session.correctCount ?? 0) + (isCorrect ? 1 : 0),
      totalAnswers: (session.totalAnswers ?? 0) + 1,
      sumAnswerTimeMs: (session.sumAnswerTimeMs ?? 0) + timeTakenMs,
      currentChecksum: undefined,
      questionStartedAt: undefined,
    });

    await ctx.db.patch(question._id, {
      timesAnswered: question.timesAnswered + 1,
      timesCorrect: question.timesCorrect + (isCorrect ? 1 : 0),
    });

    return {
      correct: isCorrect,
      score,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
    };
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) return;
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
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

export const getSession = query({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId && session.userId !== userId) return null;
    return {
      sport: session.sport,
      difficulty: session.difficulty,
      score: session.score ?? 0,
      correctCount: session.correctCount ?? 0,
      totalAnswers: session.totalAnswers ?? 0,
      completed: session.completed ?? false,
    };
  },
});
