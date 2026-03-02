import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const BLITZ_DURATION_MS = 60_000; // 60 seconds
const WRONG_PENALTY_MS = 3_000;   // -3s on wrong
const CORRECT_POINTS = 100;

export const start = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const sessionId = await ctx.db.insert("blitzSessions", {
      userId,
      sport,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      usedChecksums: [],
      gameOver: false,
      startedAt: now,
      endTimeMs: now + BLITZ_DURATION_MS,
    });

    return { sessionId };
  },
});

export const getQuestion = mutation({
  args: { sessionId: v.id("blitzSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.gameOver) throw new Error("Game is over");

    // Check if time expired
    if (Date.now() >= session.endTimeMs) {
      await ctx.db.patch(sessionId, { gameOver: true, endedAt: Date.now() });
      throw new Error("Time expired");
    }

    const MAX_IMAGE_QUESTIONS = 3;

    // Get a random unused question
    const allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", session.sport).eq("difficulty", "intermediate"),
      )
      .take(200);

    const usedSet = new Set(session.usedChecksums);
    const available = allQuestions.filter((q) => !usedSet.has(q.checksum));

    if (available.length === 0) {
      await ctx.db.patch(sessionId, { gameOver: true, endedAt: Date.now() });
      throw new Error("No more questions");
    }

    // Cap image questions per session and prevent consecutive images
    const usedImageCount = allQuestions.filter(
      (q) => usedSet.has(q.checksum) && q.imageId,
    ).length;

    const lastChecksum =
      session.usedChecksums[session.usedChecksums.length - 1];
    const lastWasImage = lastChecksum
      ? allQuestions.some((q) => q.checksum === lastChecksum && q.imageId)
      : false;

    let pool = available;
    if (usedImageCount >= MAX_IMAGE_QUESTIONS || lastWasImage) {
      const textOnly = available.filter((q) => !q.imageId);
      if (textOnly.length > 0) pool = textOnly;
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];

    // Track used checksum
    await ctx.db.patch(sessionId, {
      usedChecksums: [...session.usedChecksums, pick.checksum],
    });

    const imageUrl = pick.imageId
      ? await ctx.storage.getUrl(pick.imageId)
      : null;

    return {
      question: pick.question,
      options: pick.options,
      correctAnswer: pick.correctAnswer,
      explanation: pick.explanation ?? null,
      checksum: pick.checksum,
      imageUrl,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id("blitzSessions"),
    answer: v.string(),
    correctAnswer: v.string(),
  },
  handler: async (ctx, { sessionId, answer, correctAnswer }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.gameOver) return { correct: false, gameOver: true, score: session.score, endTimeMs: session.endTimeMs };

    const isCorrect = answer === correctAnswer;
    let { score, correctCount, wrongCount, endTimeMs } = session;

    if (isCorrect) {
      score += CORRECT_POINTS;
      correctCount += 1;
    } else {
      wrongCount += 1;
      endTimeMs -= WRONG_PENALTY_MS;
    }

    const gameOver = Date.now() >= endTimeMs;

    await ctx.db.patch(sessionId, {
      score,
      correctCount,
      wrongCount,
      endTimeMs,
      gameOver,
      ...(gameOver ? { endedAt: Date.now() } : {}),
    });

    return { correct: isCorrect, gameOver, score, endTimeMs };
  },
});

export const endGame = mutation({
  args: { sessionId: v.id("blitzSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    if (!session.gameOver) {
      await ctx.db.patch(sessionId, { gameOver: true, endedAt: Date.now() });
    }

    // Save to blitzScores
    await ctx.db.insert("blitzScores", {
      userId: session.userId,
      sport: session.sport,
      score: session.score,
      correctCount: session.correctCount,
      wrongCount: session.wrongCount,
      playedAt: Date.now(),
    });

    // Increment total games
    const user = await ctx.db.get(session.userId);
    if (user?.totalGames !== undefined) {
      await ctx.db.patch(session.userId, {
        totalGames: (user.totalGames ?? 0) + 1,
      });
    }

    return {
      score: session.score,
      correctCount: session.correctCount,
      wrongCount: session.wrongCount,
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("blitzSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

export const getHighScores = query({
  args: {
    sport: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sport, limit = 20 }) => {
    let scores;
    if (sport) {
      scores = await ctx.db
        .query("blitzScores")
        .withIndex("by_sport_score", (q) => q.eq("sport", sport))
        .order("desc")
        .take(limit);
    } else {
      scores = await ctx.db
        .query("blitzScores")
        .order("desc")
        .take(200);
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const entries = await Promise.all(
      scores.slice(0, limit).map(async (s, idx) => {
        const user = await ctx.db.get(s.userId);
        return {
          rank: idx + 1,
          userId: s.userId,
          username: user?.username ?? "Unknown",
          score: s.score,
          correctCount: s.correctCount,
          wrongCount: s.wrongCount,
          playedAt: s.playedAt,
        };
      }),
    );

    return { entries, totalEntries: entries.length };
  },
});
