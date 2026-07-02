import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertFullAccountUser } from "./lib/authz";
import { assertClientSport } from "./lib/sports";
import { calculateTimeScore, normalizeAnswer } from "./lib/scoring";
import { pickQuestionPool, planQuestionSequence } from "./lib/imageQuestions";
import { orderAnswerOptions } from "./lib/answerOptions";
import {
  composeLocalizedQuestion,
  fetchQuestionTranslation,
} from "./lib/contentI18n";
import {
  assertStandardMcqQuestion,
  isStandardMcqQuestion,
} from "./lib/mcqEligibility";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const QUESTION_BASE_POINTS = 100;
// A quiz is 10 questions; plan the whole sequence at createSession so each
// getQuestion is a single indexed read instead of a full-slice collect
// (~230ms per question on the live pools). getQuestion keeps the collect
// path as a fallback, so pre-plan sessions and >10-question flows still work.
const QUIZ_PLANNED_QUESTIONS = 10;

/** The sport+difficulty slice narrowed to the session mode's playable rows —
 * shared by planning (createSession) and the per-question fallback. */
type QuizDifficulty = "easy" | "intermediate" | "hard";

async function collectModeCandidates(
  ctx: MutationCtx,
  sport: string,
  mode: string | undefined,
  difficulty: QuizDifficulty,
): Promise<Doc<"quizQuestions">[]> {
  const candidates = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_difficulty", (q) =>
      q.eq("sport", sport).eq("difficulty", difficulty),
    )
    .collect();
  return mode === "came_first"
    ? candidates.filter((q) => q.category === "which_came_first")
    : candidates.filter(isStandardMcqQuestion);
}

function sessionDifficulty(session: {
  mode?: string;
  difficulty?: QuizDifficulty;
}): QuizDifficulty {
  return session.mode === "came_first"
    ? "intermediate"
    : session.difficulty ?? "intermediate";
}

export const createSession = mutation({
  args: {
    sport: v.string(),
    mode: v.optional(v.string()),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("intermediate"), v.literal("hard")),
    ),
  },
  handler: async (ctx, { sport, mode, difficulty }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertFullAccountUser(ctx, userId);
    assertClientSport(sport);
    const normalizedMode = mode === "came_first" ? "came_first" : "quiz";
    const normalizedDifficulty =
      normalizedMode === "came_first" ? "intermediate" : difficulty;

    const candidates = await collectModeCandidates(
      ctx,
      sport,
      normalizedMode,
      sessionDifficulty({ mode: normalizedMode, difficulty: normalizedDifficulty }),
    );
    const plannedChecksums = planQuestionSequence(
      candidates,
      QUIZ_PLANNED_QUESTIONS,
    );

    const sessionId = await ctx.db.insert("quizSessions", {
      userId,
      sport,
      mode: normalizedMode,
      difficulty: normalizedDifficulty,
      plannedChecksums,
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
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, locale }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }

    // Serve from the sequence planned at createSession: one indexed read
    // instead of re-collecting the whole sport+difficulty slice per question.
    let picked: Doc<"quizQuestions"> | null = null;
    if (session.plannedChecksums) {
      const used = new Set(session.usedChecksums);
      for (const checksum of session.plannedChecksums) {
        if (used.has(checksum)) continue;
        const doc = await ctx.db
          .query("quizQuestions")
          .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
          .first();
        // Skip rows deleted or edited out of mode-eligibility since planning.
        if (!doc) continue;
        if (
          session.mode === "came_first"
            ? doc.category !== "which_came_first"
            : !isStandardMcqQuestion(doc)
        ) {
          continue;
        }
        picked = doc;
        break;
      }
    }

    // Fallback — sessions created before planning shipped, or a plan
    // exhausted/staled mid-session: the original full-slice draw.
    if (!picked) {
      const modeCandidates = await collectModeCandidates(
        ctx,
        session.sport,
        session.mode,
        sessionDifficulty(session),
      );
      const pool = pickQuestionPool(modeCandidates, session.usedChecksums);
      if (!pool.length) throw new Error("No questions available");
      picked = pool[Math.floor(Math.random() * pool.length)];
    }
    if (session.mode !== "came_first") {
      assertStandardMcqQuestion(picked);
    }

    const now = Date.now();
    await ctx.db.patch(sessionId, {
      usedChecksums: [...session.usedChecksums, picked.checksum],
      currentChecksum: picked.checksum,
      questionStartedAt: now,
    });

    const imageUrl = picked.imageId
      ? await ctx.storage.getUrl(picked.imageId)
      : null;

    // Display-translate, grade-canonical: serve localized labels plus the
    // canonical `optionValues` the client submits, so grading (which compares
    // the submission to the English correctAnswer) and the checksum are
    // untouched. For en / untranslated, optionValues === options (no-op).
    // correctAnswer + explanation are withheld until checkAnswer.
    const orderedValues = orderAnswerOptions(picked.options, picked.correctAnswer, picked.checksum);
    const translation = await fetchQuestionTranslation(
      ctx,
      picked.checksum,
      locale,
    );
    const localized = composeLocalizedQuestion(picked, orderedValues, translation);
    return {
      question: localized.question,
      options: localized.options,
      optionValues: localized.optionValues,
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
    correctAnswer: v.optional(v.string()),
    timeTaken: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, answer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
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
      usageCount: question.usageCount + 1,
      timesAnswered: question.timesAnswered + 1,
      timesCorrect: question.timesCorrect + (isCorrect ? 1 : 0),
    });

    return {
      correct: isCorrect,
      score,
      timeTaken: timeTakenSec,
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
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if ((session.totalAnswers ?? 0) > 0 || session.currentChecksum) {
      await ctx.db.patch(sessionId, {
        completed: true,
        currentChecksum: undefined,
        questionStartedAt: undefined,
        abandonedAt: Date.now(),
      });
      return;
    }
    await ctx.db.delete(sessionId);
  },
});

export const penalizeTabSwitch = mutation({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.completed) {
      return { penalized: false };
    }

    await ctx.db.patch(sessionId, {
      completed: true,
      currentChecksum: undefined,
      questionStartedAt: undefined,
      abandonedAt: Date.now(),
    });

    return { penalized: true };
  },
});

export const submitFeedback = mutation({
  args: {
    checksum: v.string(),
    votedDifficulty: v.string(),
  },
  handler: async (ctx, { checksum, votedDifficulty }) => {
    // An authenticated identity is required (anonymous auth counts — it still
    // yields a stable userId). Combined with the per-user ledger below, this is
    // what bounds the vote to one per user per question.
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) return;

    // One vote per user per question, first vote wins. difficultyScore is an
    // increment-only running mean (sum/votes), so re-counting a user would skew
    // it with no clean way to back the prior vote out; an existing vote is a
    // no-op. Recording the vote first also closes the door on unlimited voting.
    const existingVote = await ctx.db
      .query("questionFeedbackVotes")
      .withIndex("by_user_checksum", (q) =>
        q.eq("userId", userId).eq("checksum", checksum),
      )
      .first();
    if (existingVote) return;

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
    await ctx.db.insert("questionFeedbackVotes", {
      userId,
      checksum,
      votedDifficulty,
      votedAt: Date.now(),
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
    if (!session.userId || session.userId !== userId) return null;
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
