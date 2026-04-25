import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { clampRating, getKFactor } from "./lib/elo";

const TOTAL_QUESTIONS = 10;
const QUESTION_TIME_LIMIT_MS = 10_000;
const ROUND_RESULT_DURATION_MS = 2_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;
const BASE_SCORE = 100;

type StoredLiveQuestion = {
  question: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string | null;
};

function sanitizeQuestion(question: StoredLiveQuestion) {
  return {
    question: question.question,
    options: question.options,
  };
}

// ── Mutations ──

export const createFromChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenge = await ctx.db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (
      challenge.challengerId !== userId &&
      challenge.challengedId !== userId
    ) {
      throw new Error("Not authorized");
    }

    // Pick 10 random questions for this sport
    const allQuestions = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", challenge.sport).eq("difficulty", "intermediate"),
      )
      .take(200);

    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, TOTAL_QUESTIONS).map((q) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? null,
    }));

    const now = Date.now();
    const matchId = await ctx.db.insert("liveMatches", {
      player1Id: challenge.challengerId,
      player2Id: challenge.challengedId,
      sport: challenge.sport,
      status: "waiting",
      currentQuestion: 0,
      totalQuestions: TOTAL_QUESTIONS,
      questions: picked,
      player1Answers: [],
      player2Answers: [],
      player1Score: 0,
      player2Score: 0,
      player1Ready: false,
      player2Ready: false,
      player1LastSeen: now,
      player2LastSeen: now,
      createdAt: now,
      challengeId,
    });

    return { matchId };
  },
});

export const setReady = mutation({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, { matchId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");
    if (match.status !== "waiting") throw new Error("Match not in waiting state");

    const isP1 = match.player1Id === userId;
    const isP2 = match.player2Id === userId;
    if (!isP1 && !isP2) throw new Error("Not a player in this match");

    const updates: Record<string, boolean> = {};
    if (isP1) updates.player1Ready = true;
    if (isP2) updates.player2Ready = true;

    const p1Ready = isP1 ? true : match.player1Ready;
    const p2Ready = isP2 ? true : match.player2Ready;

    if (p1Ready && p2Ready) {
      // Both ready — start countdown → question
      await ctx.db.patch(matchId, {
        ...updates,
        status: "countdown",
      });
      // Schedule transition to question after 3s countdown
      await ctx.scheduler.runAfter(3000, internal.liveMatches.startQuestion, {
        matchId,
        questionIdx: 0,
      });
    } else {
      await ctx.db.patch(matchId, updates);
    }

    return { bothReady: p1Ready && p2Ready };
  },
});

export const submitAnswer = mutation({
  args: {
    matchId: v.id("liveMatches"),
    answer: v.string(),
  },
  handler: async (ctx, { matchId, answer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");
    if (match.status !== "question") throw new Error("Not in question phase");

    const isP1 = match.player1Id === userId;
    const isP2 = match.player2Id === userId;
    if (!isP1 && !isP2) throw new Error("Not a player in this match");

    const answersKey = isP1 ? "player1Answers" : "player2Answers";
    const answers = [...(match[answersKey] as Array<Record<string, unknown>>)];

    // Check if already answered this question
    if (answers.length > match.currentQuestion) {
      throw new Error("Already answered this question");
    }

    const currentQ = (match.questions as Array<{ correctAnswer: string }>)[
      match.currentQuestion
    ];
    const correct = answer === currentQ.correctAnswer;
    const timeTaken = match.questionStartedAt
      ? (Date.now() - match.questionStartedAt) / 1000
      : 10;

    // Cutthroat scoring
    const otherAnswers = isP1
      ? (match.player2Answers as Array<Record<string, unknown>>)
      : (match.player1Answers as Array<Record<string, unknown>>);
    const otherAnsweredThisQ = otherAnswers.length > match.currentQuestion;
    const otherCorrect = otherAnsweredThisQ
      ? (otherAnswers[match.currentQuestion] as { correct: boolean }).correct
      : false;

    let score = 0;
    if (correct) {
      // Time bonus: faster = more points
      const timeBonus = Math.max(0, Math.floor((10 - timeTaken) * 10));
      if (!otherAnsweredThisQ || !otherCorrect) {
        // First correct or opponent wrong → full base + time bonus
        score = BASE_SCORE + timeBonus;
      } else {
        // Second correct → 50% base + time bonus
        score = Math.floor(BASE_SCORE / 2) + timeBonus;
      }
    }

    answers.push({
      answer,
      timeTaken,
      correct,
      score,
      answeredAt: Date.now(),
    });

    const scoreKey = isP1 ? "player1Score" : "player2Score";
    const newScore = (match[scoreKey] as number) + score;

    const updates: Record<string, unknown> = {
      [answersKey]: answers,
      [scoreKey]: newScore,
    };

    // Check if both have answered
    const otherLen = otherAnswers.length;
    const bothAnswered = otherLen > match.currentQuestion;

    if (bothAnswered) {
      // Move to round result
      updates.status = "roundResult";
      updates.roundResultUntil = Date.now() + ROUND_RESULT_DURATION_MS;

      // Schedule advance to next question
      await ctx.scheduler.runAfter(
        ROUND_RESULT_DURATION_MS,
        internal.liveMatches.advanceQuestion,
        { matchId },
      );
    }

    await ctx.db.patch(matchId, updates);

    return { correct, score };
  },
});

export const heartbeat = mutation({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, { matchId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const match = await ctx.db.get(matchId);
    if (!match) return;

    if (match.player1Id === userId) {
      await ctx.db.patch(matchId, { player1LastSeen: Date.now() });
    } else if (match.player2Id === userId) {
      await ctx.db.patch(matchId, { player2LastSeen: Date.now() });
    }
  },
});

export const forfeit = mutation({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, { matchId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Match not found");

    const isP1 = match.player1Id === userId;
    const isP2 = match.player2Id === userId;
    if (!isP1 && !isP2) throw new Error("Not authorized");
    const winnerId = isP1 ? match.player2Id : match.player1Id;

    await ctx.db.patch(matchId, {
      status: "forfeited",
      winnerId,
      completedAt: Date.now(),
    });

    return { winnerId };
  },
});

// ── Queries ──

export const getMatch = query({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, { matchId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const match = await ctx.db.get(matchId);
    if (!match) return null;
    if (userId !== match.player1Id && userId !== match.player2Id) {
      return null;
    }

    const p1 = await ctx.db.get(match.player1Id);
    const p2 = await ctx.db.get(match.player2Id);

    const isP1 = userId === match.player1Id;

    // Never expose correctAnswer/explanation through the public match view.
    // Future questions stay hidden entirely; the current/past display shape is
    // question text + options only.
    const questions = (match.questions as StoredLiveQuestion[]).map((q, idx) => {
      const isCurrent = idx === match.currentQuestion;
      const isPast = idx < match.currentQuestion;
      if (
        isPast ||
        (isCurrent &&
          (match.status === "question" ||
            match.status === "roundResult" ||
            match.status === "completed" ||
            match.status === "forfeited"))
      ) {
        return sanitizeQuestion(q);
      }
      return null;
    });

    // Opponent status for current question
    const opponentAnswers = isP1
      ? (match.player2Answers as Array<Record<string, unknown>>)
      : (match.player1Answers as Array<Record<string, unknown>>);
    let opponentStatus: "thinking" | "lockedIn" | "answeredIncorrectly" = "thinking";
    if (opponentAnswers.length > match.currentQuestion) {
      const oppAnswer = opponentAnswers[match.currentQuestion] as { correct: boolean };
      opponentStatus = oppAnswer.correct ? "lockedIn" : "answeredIncorrectly";
    }

    return {
      _id: match._id,
      player1: { id: match.player1Id, username: p1?.username ?? "Player 1", displayName: p1?.displayName ?? "Player 1" },
      player2: { id: match.player2Id, username: p2?.username ?? "Player 2", displayName: p2?.displayName ?? "Player 2" },
      sport: match.sport,
      status: match.status,
      currentQuestion: match.currentQuestion,
      totalQuestions: match.totalQuestions,
      questions,
      player1Score: match.player1Score,
      player2Score: match.player2Score,
      player1Ready: match.player1Ready,
      player2Ready: match.player2Ready,
      winnerId: match.winnerId,
      questionStartedAt: match.questionStartedAt,
      roundResultUntil: match.roundResultUntil,
      opponentStatus,
      isPlayer1: isP1,
      myAnswers: isP1
        ? (match.player1Answers as unknown[])
        : (match.player2Answers as unknown[]),
    };
  },
});

export const getActiveMatch = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Check as player1
    const asP1 = await ctx.db
      .query("liveMatches")
      .withIndex("by_player1", (q) =>
        q.eq("player1Id", userId).eq("status", "waiting"),
      )
      .first();
    if (asP1) return asP1._id;

    const asP1q = await ctx.db
      .query("liveMatches")
      .withIndex("by_player1", (q) =>
        q.eq("player1Id", userId).eq("status", "question"),
      )
      .first();
    if (asP1q) return asP1q._id;

    // Check as player2
    const asP2 = await ctx.db
      .query("liveMatches")
      .withIndex("by_player2", (q) =>
        q.eq("player2Id", userId).eq("status", "waiting"),
      )
      .first();
    if (asP2) return asP2._id;

    const asP2q = await ctx.db
      .query("liveMatches")
      .withIndex("by_player2", (q) =>
        q.eq("player2Id", userId).eq("status", "question"),
      )
      .first();
    if (asP2q) return asP2q._id;

    return null;
  },
});

// ── Internal Scheduled Functions ──

export const startQuestion = internalMutation({
  args: {
    matchId: v.id("liveMatches"),
    questionIdx: v.number(),
  },
  handler: async (ctx, { matchId, questionIdx }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return;
    if (match.status === "completed" || match.status === "forfeited") return;

    const now = Date.now();
    await ctx.db.patch(matchId, {
      status: "question",
      currentQuestion: questionIdx,
      questionStartedAt: now,
    });

    // Schedule timeout check
    await ctx.scheduler.runAfter(
      QUESTION_TIME_LIMIT_MS,
      internal.liveMatches.checkTimeout,
      { matchId, questionIdx },
    );
  },
});

export const advanceQuestion = internalMutation({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return;
    if (match.status === "completed" || match.status === "forfeited") return;

    const nextQ = match.currentQuestion + 1;

    if (nextQ >= match.totalQuestions) {
      // Match complete
      const winnerId =
        match.player1Score > match.player2Score
          ? match.player1Id
          : match.player2Score > match.player1Score
            ? match.player2Id
            : undefined;

      await ctx.db.patch(matchId, {
        status: "completed",
        winnerId,
        completedAt: Date.now(),
      });

      // Update ELO for both players
      await updateMatchElo(ctx, match, winnerId);
      return;
    }

    // Start next question
    const now = Date.now();
    await ctx.db.patch(matchId, {
      status: "question",
      currentQuestion: nextQ,
      questionStartedAt: now,
    });

    // Schedule timeout
    await ctx.scheduler.runAfter(
      QUESTION_TIME_LIMIT_MS,
      internal.liveMatches.checkTimeout,
      { matchId, questionIdx: nextQ },
    );
  },
});

export const checkTimeout = internalMutation({
  args: {
    matchId: v.id("liveMatches"),
    questionIdx: v.number(),
  },
  handler: async (ctx, { matchId, questionIdx }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return;
    if (match.status !== "question") return;
    if (match.currentQuestion !== questionIdx) return;

    // Auto-advance — fill in missed answers with zero score
    const p1Answers = [...(match.player1Answers as Array<Record<string, unknown>>)];
    const p2Answers = [...(match.player2Answers as Array<Record<string, unknown>>)];

    if (p1Answers.length <= questionIdx) {
      p1Answers.push({
        answer: null,
        timeTaken: 10,
        correct: false,
        score: 0,
        answeredAt: Date.now(),
      });
    }
    if (p2Answers.length <= questionIdx) {
      p2Answers.push({
        answer: null,
        timeTaken: 10,
        correct: false,
        score: 0,
        answeredAt: Date.now(),
      });
    }

    await ctx.db.patch(matchId, {
      player1Answers: p1Answers,
      player2Answers: p2Answers,
      status: "roundResult",
      roundResultUntil: Date.now() + ROUND_RESULT_DURATION_MS,
    });

    await ctx.scheduler.runAfter(
      ROUND_RESULT_DURATION_MS,
      internal.liveMatches.advanceQuestion,
      { matchId },
    );
  },
});

// ── ELO Update Helper ──

async function updateMatchElo(
  ctx: Pick<MutationCtx, "db">,
  match: Pick<Doc<"liveMatches">, "player1Id" | "player2Id" | "sport">,
  winnerId: Id<"users"> | undefined,
) {
  const player1Id = match.player1Id;
  const player2Id = match.player2Id;

  // Get ratings
  const p1Rating = await ctx.db
    .query("userRatings")
    .withIndex("by_user_sport_mode", (q) =>
      q.eq("userId", player1Id).eq("sport", match.sport).eq("mode", "quiz"),
    )
    .first();

  const p2Rating = await ctx.db
    .query("userRatings")
    .withIndex("by_user_sport_mode", (q) =>
      q.eq("userId", player2Id).eq("sport", match.sport).eq("mode", "quiz"),
    )
    .first();

  const p1Elo = p1Rating?.eloRating ?? 1200;
  const p2Elo = p2Rating?.eloRating ?? 1200;

  // P1 performance: 1 = win, 0.5 = draw, 0 = loss
  const p1Perf = !winnerId ? 0.5 : winnerId === player1Id ? 1 : 0;
  const p2Perf = !winnerId ? 0.5 : winnerId === player2Id ? 1 : 0;

  // Per-player dynamic K-factor
  const { k: p1K } = getKFactor(p1Rating?.gamesPlayed ?? 0, p1Elo);
  const { k: p2K } = getKFactor(p2Rating?.gamesPlayed ?? 0, p2Elo);

  const p1Expected = 1 / (1 + Math.pow(10, (p2Elo - p1Elo) / 400));
  const p2Expected = 1 / (1 + Math.pow(10, (p1Elo - p2Elo) / 400));

  const p1Change = Math.round(p1K * (p1Perf - p1Expected) * 10) / 10;
  const p2Change = Math.round(p2K * (p2Perf - p2Expected) * 10) / 10;

  const newP1Elo = clampRating(p1Elo + p1Change);
  const newP2Elo = clampRating(p2Elo + p2Change);

  // Update P1
  if (p1Rating) {
    await ctx.db.patch(p1Rating._id, {
      eloRating: newP1Elo,
      peakRating: Math.max(p1Rating.peakRating, newP1Elo),
      gamesPlayed: p1Rating.gamesPlayed + 1,
      wins: p1Rating.wins + (winnerId === player1Id ? 1 : 0),
      losses: p1Rating.losses + (winnerId === player2Id ? 1 : 0),
      lastPlayed: Date.now(),
      lastDecayAt: 0,
      decayWarningShown: false,
    });
  }

  // Update P2
  if (p2Rating) {
    await ctx.db.patch(p2Rating._id, {
      eloRating: newP2Elo,
      peakRating: Math.max(p2Rating.peakRating, newP2Elo),
      gamesPlayed: p2Rating.gamesPlayed + 1,
      wins: p2Rating.wins + (winnerId === player2Id ? 1 : 0),
      losses: p2Rating.losses + (winnerId === player1Id ? 1 : 0),
      lastPlayed: Date.now(),
      lastDecayAt: 0,
      decayWarningShown: false,
    });
  }
}
