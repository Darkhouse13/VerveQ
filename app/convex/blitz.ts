import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assertUsernameRequiredUser,
  isRankedEligibleUserDoc,
  isRankedEligibleUserId,
} from "./lib/authz";
import { assertClientSport } from "./lib/sports";
import { pickQuestionPool } from "./lib/imageQuestions";
import { normalizeAnswer } from "./lib/scoring";
import { advanceStreak, utcDayNumber } from "./lib/streaks";
import { orderAnswerOptions } from "./lib/answerOptions";
import {
  composeLocalizedQuestion,
  fetchQuestionTranslation,
} from "./lib/contentI18n";
import {
  assertStandardMcqQuestion,
  isStandardMcqQuestion,
} from "./lib/mcqEligibility";

const BLITZ_DURATION_MS = 60_000; // 60 seconds
const WRONG_PENALTY_MS = 3_000;   // -3s on wrong
const CORRECT_POINTS = 100;
// Clock-skew tolerance for finalizing a run. The client's countdown fires
// `endGame` the instant ITS clock passes `endTimeMs`; if the device clock runs
// ahead of the server's, the server can still read `now < endTimeMs` and would
// otherwise reject the finalize, bouncing the player to the home page instead
// of the results screen. Finalizing a few seconds early is harmless — the score
// is only the sum of answers already locked in, and no points can be earned
// after time is up — so we accept a small grace window.
const FINALIZE_GRACE_MS = 3_000;

export const start = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertUsernameRequiredUser(ctx, userId);
    assertClientSport(sport);

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
  args: { sessionId: v.id("blitzSessions"), locale: v.optional(v.string()) },
  handler: async (ctx, { sessionId, locale }) => {
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

    // Collect the FULL sport+intermediate pool (mirrors quizSessions.getQuestion).
    // The old `.take(200)` silently capped Blitz to the first 200 questions by
    // index order, so most of the pool (e.g. football intermediate ≫ 200) was
    // permanently unreachable in this mode — every Blitz run drew from the same
    // 200-question window. Collecting the whole pool makes Blitz reach all of it.
    const allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", session.sport).eq("difficulty", "intermediate"),
      )
      .collect();

    const pool = pickQuestionPool(
      allQuestions.filter(isStandardMcqQuestion),
      session.usedChecksums,
    );

    if (pool.length === 0) {
      await ctx.db.patch(sessionId, {
        gameOver: true,
        endedAt: Date.now(),
        currentChecksum: undefined,
      });
      throw new Error("No more questions");
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    assertStandardMcqQuestion(pick);

    // Track used checksum
    await ctx.db.patch(sessionId, {
      usedChecksums: [...session.usedChecksums, pick.checksum],
      currentChecksum: pick.checksum,
    });

    const imageUrl = pick.imageId
      ? await ctx.storage.getUrl(pick.imageId)
      : null;

    // Display-translate, grade-canonical (docs/I18N_CONTENT_DESIGN.md): canonical
    // optionValues are submitted; options may be localized labels. For en /
    // untranslated, optionValues === options (no-op). correctAnswer + explanation
    // are withheld until submitAnswer.
    const orderedValues = orderAnswerOptions(pick.options, pick.correctAnswer, pick.checksum);
    const translation = await fetchQuestionTranslation(ctx, pick.checksum, locale);
    const localized = composeLocalizedQuestion(pick, orderedValues, translation);
    return {
      question: localized.question,
      options: localized.options,
      optionValues: localized.optionValues,
      checksum: pick.checksum,
      imageUrl,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    sessionId: v.id("blitzSessions"),
    answer: v.string(),
    checksum: v.optional(v.string()),
    correctAnswer: v.optional(v.string()),
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
    if (checksum !== undefined && checksum !== session.currentChecksum) {
      throw new Error("Question not active for this session");
    }
    const activeChecksum = session.currentChecksum;

    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", activeChecksum))
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

    const timeExpired = now >= session.endTimeMs - FINALIZE_GRACE_MS;
    if (!session.gameOver && !timeExpired) {
      throw new Error("Cannot save an unfinished Blitz session");
    }

    if (await isRankedEligibleUserId(ctx, session.userId)) {
      await ctx.db.insert("blitzScores", {
        userId: session.userId,
        sport: session.sport,
        score: session.score,
        correctCount: session.correctCount,
        wrongCount: session.wrongCount,
        playedAt: now,
      });
    }

    await ctx.db.patch(sessionId, {
      gameOver: true,
      endedAt: session.endedAt ?? now,
      currentChecksum: undefined,
      scoreSavedAt: now,
    });

    // Count the play: lifetime total (legacy docs without the counter are
    // left alone) and the daily streak (always).
    const user = await ctx.db.get(session.userId);
    if (user) {
      const playPatch = {
        ...(user.totalGames !== undefined
          ? { totalGames: user.totalGames + 1 }
          : {}),
        ...(advanceStreak(user, utcDayNumber(now)) ?? {}),
      };
      if (Object.keys(playPatch).length > 0) {
        await ctx.db.patch(session.userId, playPatch);
      }
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

    // `blitzScores` has one row per RUN, so a hot streak by one player would
    // otherwise fill several board slots. Walk the index in score order and
    // keep each user's best run — the board lists users, not runs. Like the
    // ELO board, ordering and ranks are decided here; clients never re-sort.
    const scores: Doc<"blitzScores">[] = await ctx.db
      .query("blitzScores")
      .withIndex("by_sport_score", (q) => q.eq("sport", sport))
      .order("desc")
      .collect();

    const entries = [];
    const seen = new Set<string>();
    for (const s of scores) {
      if (entries.length >= limit) break;
      if (seen.has(s.userId)) continue;
      seen.add(s.userId);
      const user = await ctx.db.get(s.userId);
      if (!isRankedEligibleUserDoc(user)) continue;
      entries.push({
        rank: entries.length + 1,
        userId: s.userId,
        username: user?.username ?? "Unknown",
        score: s.score,
        correctCount: s.correctCount,
        wrongCount: s.wrongCount,
        playedAt: s.playedAt,
      });
    }

    return { entries, totalEntries: entries.length };
  },
});
