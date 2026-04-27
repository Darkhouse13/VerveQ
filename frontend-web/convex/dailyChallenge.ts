import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getTodayUTC, seededShuffle } from "./lib/daily";
import { normalizeAnswer } from "./lib/scoring";
import type { Id } from "./_generated/dataModel";

const DAILY_QUIZ_COUNT = 10;
const MAX_TIME_SEC = 10;
const DAILY_ATTEMPT_TTL_MS = 30 * 60 * 1000;
const DAILY_GENERATOR_SPORTS = ["football", "basketball", "tennis"] as const;

type DailyMode = "quiz" | "survival";

type QuizQuestionSnapshot = {
  checksum: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  category: string;
  imageId?: Id<"_storage">;
};

function assertDailyQuizMode(mode: DailyMode) {
  if (mode !== "quiz") {
    throw new Error("Daily survival is not implemented yet");
  }
}

function snapshotQuestion(question: {
  checksum: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  category: string;
  imageId?: Id<"_storage">;
}): QuizQuestionSnapshot {
  return {
    checksum: question.checksum,
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    ...(question.explanation ? { explanation: question.explanation } : {}),
    category: question.category,
    ...(question.imageId ? { imageId: question.imageId } : {}),
  };
}

function pickCanonicalChallenge<T extends { createdAt: number; _id: unknown }>(
  challenges: T[],
): T | null {
  if (challenges.length === 0) return null;
  return [...challenges].sort((a, b) => {
    const createdDiff = a.createdAt - b.createdAt;
    if (createdDiff !== 0) return createdDiff;
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

function getChallengeQuestionSnapshot(
  challenge: {
    questionChecksums: string[];
    questionSnapshots?: QuizQuestionSnapshot[];
  },
  questionIndex: number,
): QuizQuestionSnapshot | null {
  const checksum = challenge.questionChecksums[questionIndex];
  if (!checksum) return null;

  const indexed = challenge.questionSnapshots?.[questionIndex];
  if (indexed?.checksum === checksum) return indexed;

  return (
    challenge.questionSnapshots?.find(
      (snapshot) => snapshot.checksum === checksum,
    ) ?? null
  );
}

function getPreviousUTCDate(date: string): string {
  const previous = new Date(date + "T00:00:00Z");
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

function getUTCDateStartMs(date: string): number {
  return Date.parse(date + "T00:00:00Z");
}

function getAttemptExpiresAt(attempt: { startedAt: number; expiresAt?: number }) {
  return attempt.expiresAt ?? attempt.startedAt + DAILY_ATTEMPT_TTL_MS;
}

async function getOrCreateDailyQuizChallenge(
  ctx: MutationCtx,
  sport: string,
) {
  const mode = "quiz" as const;
  const date = getTodayUTC();

  const existingChallenges = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_date_sport_mode", (q) =>
      q.eq("date", date).eq("sport", sport).eq("mode", mode),
    )
    .collect();

  const existing = pickCanonicalChallenge(existingChallenges);
  if (existing) {
    for (const duplicate of existingChallenges) {
      if (duplicate._id !== existing._id) {
        await ctx.db.delete(duplicate._id);
      }
    }
    return existing;
  }

  const MAX_IMAGE_QUESTIONS = 3;
  const questions = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_difficulty", (q) =>
      q.eq("sport", sport).eq("difficulty", "intermediate"),
    )
    .take(200);

  const shuffled = seededShuffle(questions, `${date}-${sport}-quiz`);
  const selected: typeof shuffled = [];
  let imageCount = 0;
  for (const question of shuffled) {
    if (selected.length >= DAILY_QUIZ_COUNT) break;
    const lastWasImage =
      selected.length > 0 && selected[selected.length - 1].imageId != null;
    if (question.imageId) {
      if (imageCount >= MAX_IMAGE_QUESTIONS || lastWasImage) continue;
      imageCount++;
    }
    selected.push(question);
  }

  if (selected.length === 0) {
    throw new Error(`No daily quiz questions available for ${sport}`);
  }

  const id = await ctx.db.insert("dailyChallenges", {
    date,
    sport,
    mode,
    questionChecksums: selected.map((question) => question.checksum),
    questionSnapshots: selected.map(snapshotQuestion),
    survivalInitials: [],
    createdAt: Date.now(),
  });

  const challenges = await ctx.db
    .query("dailyChallenges")
    .withIndex("by_date_sport_mode", (q) =>
      q.eq("date", date).eq("sport", sport).eq("mode", mode),
    )
    .collect();
  const canonical = pickCanonicalChallenge(challenges);
  for (const duplicate of challenges) {
    if (canonical && duplicate._id !== canonical._id) {
      await ctx.db.delete(duplicate._id);
    }
  }

  return canonical ?? (await ctx.db.get(id));
}

// ── Queries ──

export const getOrCreateChallenge = mutation({
  args: {
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
  },
  handler: async (ctx, { sport, mode }) => {
    assertDailyQuizMode(mode);

    const date = getTodayUTC();

    const existingChallenges = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) =>
        q.eq("date", date).eq("sport", sport).eq("mode", mode),
      )
      .collect();

    const existing = pickCanonicalChallenge(existingChallenges);
    if (existing) {
      for (const duplicate of existingChallenges) {
        if (duplicate._id !== existing._id) {
          await ctx.db.delete(duplicate._id);
        }
      }
      return existing;
    }

    // Lazily create today's challenge
    let questionChecksums: string[] = [];
    let questionSnapshots: QuizQuestionSnapshot[] = [];
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
      questionSnapshots = selected.map(snapshotQuestion);
    } else {
      // For survival, we just store an empty array — survival uses its own session logic
      survivalInitials = [];
    }

    const id = await ctx.db.insert("dailyChallenges", {
      date,
      sport,
      mode,
      questionChecksums,
      questionSnapshots,
      survivalInitials,
      createdAt: Date.now(),
    });

    const challenges = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) =>
        q.eq("date", date).eq("sport", sport).eq("mode", mode),
      )
      .collect();
    const canonical = pickCanonicalChallenge(challenges);
    for (const duplicate of challenges) {
      if (canonical && duplicate._id !== canonical._id) {
        await ctx.db.delete(duplicate._id);
      }
    }

    return canonical ?? (await ctx.db.get(id));
  },
});

export const generateTodaysChallenges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const generated = [];
    for (const sport of DAILY_GENERATOR_SPORTS) {
      try {
        const challenge = await getOrCreateDailyQuizChallenge(ctx, sport);
        generated.push({
          sport,
          challengeId: challenge?._id ?? null,
          questionCount: challenge?.questionChecksums.length ?? 0,
          status: "generated",
        });
      } catch (error) {
        generated.push({
          sport,
          challengeId: null,
          questionCount: 0,
          status: "skipped",
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return { generated };
  },
});

export const getAttemptStatus = query({
  args: {
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
  },
  handler: async (ctx, { sport, mode }) => {
    assertDailyQuizMode(mode);

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
    assertDailyQuizMode(mode);

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const date = getTodayUTC();
    const now = Date.now();

    const previousDate = getPreviousUTCDate(date);
    const previousAttempt = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_user_date_sport_mode", (q) =>
        q
          .eq("userId", userId)
          .eq("date", previousDate)
          .eq("sport", sport)
          .eq("mode", mode),
      )
      .first();

    if (
      previousAttempt &&
      getAttemptExpiresAt(previousAttempt) > now &&
      !previousAttempt.forfeited
    ) {
      throw new Error("Previous daily attempt is still active");
    }
    if (
      previousAttempt?.completedAt &&
      previousAttempt.completedAt >= getUTCDateStartMs(date)
    ) {
      throw new Error("Previous daily attempt completed after today's reset");
    }

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

    if (existing) {
      const expired =
        !existing.completed &&
        !existing.forfeited &&
        getAttemptExpiresAt(existing) <= now;
      if (!expired) {
        throw new Error("Already attempted today's challenge");
      }

      await ctx.db.patch(existing._id, {
        score: 0,
        completed: false,
        forfeited: false,
        results: [],
        startedAt: now,
        completedAt: undefined,
        currentQuestionStartedAt: now,
        expiresAt: now + DAILY_ATTEMPT_TTL_MS,
      });

      return { attemptId: existing._id };
    }

    const attemptId = await ctx.db.insert("dailyAttempts", {
      userId,
      date,
      sport,
      mode,
      score: 0,
      completed: false,
      forfeited: false,
      results: [],
      startedAt: now,
      expiresAt: now + DAILY_ATTEMPT_TTL_MS,
      currentQuestionStartedAt: now,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    assertDailyQuizMode(attempt.mode);
    if (attempt.userId !== userId) {
      throw new Error("Not authorized for this attempt");
    }
    if (attempt.completed || attempt.forfeited) {
      throw new Error("Attempt already finished");
    }
    if (Date.now() > getAttemptExpiresAt(attempt)) {
      throw new Error("Attempt expired");
    }

    const challenges = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) =>
        q
          .eq("date", attempt.date)
          .eq("sport", attempt.sport)
          .eq("mode", attempt.mode),
      )
      .collect();

    const challenge = pickCanonicalChallenge(challenges);
    if (!challenge) throw new Error("Challenge not found");

    const checksum = challenge.questionChecksums[questionIndex];
    if (!checksum) throw new Error("Question index out of range");

    const snapshot = getChallengeQuestionSnapshot(challenge, questionIndex);
    const liveQuestion = snapshot
      ? null
      : await ctx.db
          .query("quizQuestions")
          .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
          .first();
    if (!snapshot && !liveQuestion) throw new Error("Question not found");
    const question = snapshot ?? snapshotQuestion(liveQuestion);

    const imageUrl = question.imageId
      ? await ctx.storage.getUrl(question.imageId)
      : null;

    // correctAnswer + explanation are revealed by submitAnswer after the
    // server validates the guess.
    return {
      question: question.question,
      options: question.options,
      checksum: question.checksum,
      category: question.category,
      imageUrl,
      questionStartedAt:
        attempt.currentQuestionStartedAt ?? attempt.startedAt,
    };
  },
});

export const submitAnswer = mutation({
  args: {
    attemptId: v.id("dailyAttempts"),
    answer: v.string(),
    questionIndex: v.number(),
  },
  handler: async (ctx, { attemptId, answer, questionIndex }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    assertDailyQuizMode(attempt.mode);
    if (attempt.userId !== userId) {
      throw new Error("Not authorized for this attempt");
    }
    if (attempt.completed || attempt.forfeited) {
      throw new Error("Attempt already finished");
    }
    if (Date.now() > getAttemptExpiresAt(attempt)) {
      await ctx.db.patch(attemptId, {
        forfeited: true,
        completedAt: Date.now(),
      });
      throw new Error("Attempt expired");
    }

    const results = attempt.results || [];
    if (questionIndex !== results.length) {
      throw new Error("Out-of-order question submission");
    }

    const challenges = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) =>
        q
          .eq("date", attempt.date)
          .eq("sport", attempt.sport)
          .eq("mode", attempt.mode),
      )
      .collect();
    const challenge = pickCanonicalChallenge(challenges);
    if (!challenge) throw new Error("Challenge not found");

    const checksum = challenge.questionChecksums[questionIndex];
    if (!checksum) throw new Error("Question index out of range");

    const snapshot = getChallengeQuestionSnapshot(challenge, questionIndex);
    const liveQuestion = snapshot
      ? null
      : await ctx.db
          .query("quizQuestions")
          .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
          .first();
    if (!snapshot && !liveQuestion) throw new Error("Question not found");
    const question = snapshot ?? snapshotQuestion(liveQuestion);

    const isCorrect =
      normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
    const now = Date.now();
    const startedAt =
      attempt.currentQuestionStartedAt ?? attempt.startedAt;
    const timeTaken = Math.max(0, (now - startedAt) / 1000);

    let score = 0;
    if (isCorrect) {
      if (timeTaken <= 1) score = 100;
      else if (timeTaken <= MAX_TIME_SEC)
        score = Math.round(100 * ((MAX_TIME_SEC - timeTaken) / (MAX_TIME_SEC - 1)));
    }

    const newResults = [
      ...results,
      { correct: isCorrect, timeTaken, score },
    ];
    const totalScore = newResults.reduce(
      (sum: number, r: { score: number }) => sum + r.score,
      0,
    );

    await ctx.db.patch(attemptId, {
      results: newResults,
      score: totalScore,
      currentQuestionStartedAt: now,
    });

    return {
      correct: isCorrect,
      score,
      totalScore,
      timeTaken,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
    };
  },
});

export const forfeit = mutation({
  args: { attemptId: v.id("dailyAttempts") },
  handler: async (ctx, { attemptId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.userId !== userId) {
      throw new Error("Not authorized for this attempt");
    }
    if (attempt.completed) throw new Error("Already completed");

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const attempt = await ctx.db.get(attemptId);
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.userId !== userId) {
      throw new Error("Not authorized for this attempt");
    }
    if (attempt.completed) throw new Error("Already completed");
    if (attempt.forfeited) throw new Error("Attempt forfeited");
    if (Date.now() > getAttemptExpiresAt(attempt)) {
      await ctx.db.patch(attemptId, {
        forfeited: true,
        completedAt: Date.now(),
      });
      throw new Error("Attempt expired");
    }
    if ((attempt.results as unknown[]).length < DAILY_QUIZ_COUNT) {
      throw new Error("Attempt is not complete");
    }

    await ctx.db.patch(attemptId, {
      completed: true,
      completedAt: Date.now(),
    });

    return { score: attempt.score, results: attempt.results };
  },
});
