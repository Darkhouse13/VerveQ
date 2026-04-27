import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { pickQuestionPool } from "./lib/imageQuestions";
import { normalizeAnswer } from "./lib/scoring";

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

    return { sessionId, endTimeMs: now + BLITZ_DURATION_MS };
  },
});

export const getQuestion = mutation({
  args: { sessionId: v.id("blitzSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    // Check if time expired
    if (Date.now() >= session.endTimeMs) {
      await ctx.db.patch(sessionId, {
        gameOver: true,
        endedAt: Date.now(),
        currentChecksum: undefined,
      });
      throw new Error("Time expired");
    }
    if (session.gameOver) throw new Error("Game is over");
    if (session.currentChecksum) {
      throw new Error("Answer the current question before requesting another");
    }

    // Get a random unused question
    const allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", session.sport).eq("difficulty", "intermediate"),
      )
      .take(200);

    const pool = pickQuestionPool(allQuestions, session.usedChecksums);

    if (pool.length === 0) {
      await ctx.db.patch(sessionId, {
        gameOver: true,
        endedAt: Date.now(),
        currentChecksum: undefined,
      });
      throw new Error("No more questions");
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];

    // Track used checksum
    await ctx.db.patch(sessionId, {
      usedChecksums: [...session.usedChecksums, pick.checksum],
      currentChecksum: pick.checksum,
    });

    const imageUrl = pick.imageId
      ? await ctx.storage.getUrl(pick.imageId)
      : null;

    // correctAnswer + explanation are withheld; they come back in the
    // submitAnswer response after server-side validation.
    return {
      question: pick.question,
      options: pick.options,
      checksum: pick.checksum,
      imageUrl,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id("blitzSessions"),
    answer: v.string(),
    checksum: v.string(),
  },
  handler: async (ctx, { sessionId, answer, checksum }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.gameOver) {
      return {
        correct: false,
        gameOver: true,
        score: session.score,
        endTimeMs: session.endTimeMs,
        correctAnswer: null as string | null,
        explanation: null as string | null,
      };
    }

    // Only the current server-delivered question is valid.
    if (!session.currentChecksum) {
      throw new Error("No active question for this session");
    }
    if (checksum !== session.currentChecksum) {
      throw new Error("Question not active for this session");
    }

    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) throw new Error("Question not found");

    const isCorrect =
      normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
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
      currentChecksum: undefined,
      ...(gameOver ? { endedAt: Date.now() } : {}),
    });

    return {
      correct: isCorrect,
      gameOver,
      score,
      endTimeMs,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
    };
  },
});

export const endGame = mutation({
  args: { sessionId: v.id("blitzSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }

    if (session.scoreSavedAt) {
      return {
        score: session.score,
        correctCount: session.correctCount,
        wrongCount: session.wrongCount,
      };
    }

    const now = Date.now();

    const timeExpired = now >= session.endTimeMs;
    if (!session.gameOver && !timeExpired) {
      throw new Error("Cannot save an unfinished Blitz session");
    }

    // Save to blitzScores
    await ctx.db.insert("blitzScores", {
      userId: session.userId,
      sport: session.sport,
      score: session.score,
      correctCount: session.correctCount,
      wrongCount: session.wrongCount,
      playedAt: now,
    });

    await ctx.db.patch(sessionId, {
      gameOver: true,
      endedAt: session.endedAt ?? now,
      currentChecksum: undefined,
      scoreSavedAt: now,
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

export const getHighScores = query({
  args: {
    sport: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sport, limit = 20 }) => {
    if (!sport) {
      throw new Error("Sport is required for Blitz leaderboards");
    }

    const scores: Doc<"blitzScores">[] = await ctx.db
      .query("blitzScores")
      .withIndex("by_sport_score", (q) => q.eq("sport", sport))
      .order("desc")
      .take(limit);

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
