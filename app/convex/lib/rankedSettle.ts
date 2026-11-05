/**
 * Ranked rating settlement, shared by every path that ends a ranked run.
 *
 * Integrity rule (perf/security loop, round 4): a ranked rating settles on the
 * FULL run. Quiz: unanswered questions count as wrong, and quitting /
 * abandoning / letting a run expire after at least one answer settles as a
 * loss — so finishing only lucky starts can't farm ELO. Survival: a run that
 * ended (game over, cash-out, abandon or expiry) always settles on its banked
 * score, whether or not the client ever called completeSurvival.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { advanceStreak, utcDayNumber } from "./streaks";
import { isRankedEligibleUserId } from "./authz";
import { parkUnansweredQuestion } from "./rankedPending";
import {
  calculateEloChange,
  clampRating,
  getKFactor,
  getQuizPerformance,
  getSurvivalDifficultyTier,
  getSurvivalPerformance,
  SURVIVAL_WIN_POINTS,
} from "./elo";

/** Ranked quizzes are 10 questions (quizSessions QUIZ_PLANNED_QUESTIONS). */
export const RANKED_QUIZ_QUESTIONS = 10;

async function dismissOutstandingDecayNotifications(
  ctx: MutationCtx,
  userId: Id<"users">,
  sport: string,
  mode: string,
) {
  const notifications = await ctx.db
    .query("decayNotifications")
    .withIndex("by_user_sport_mode", (q) =>
      q.eq("userId", userId).eq("sport", sport).eq("mode", mode),
    )
    .collect();
  for (const notification of notifications) {
    if (!notification.dismissed) {
      await ctx.db.patch(notification._id, { dismissed: true });
    }
  }
}

async function countPlay(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const playPatch = {
    ...(user.totalGames !== undefined ? { totalGames: user.totalGames + 1 } : {}),
    ...(advanceStreak(user, utcDayNumber(Date.now())) ?? {}),
  };
  if (Object.keys(playPatch).length > 0) await ctx.db.patch(userId, playPatch);
}

async function applyRating(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    sport: string;
    mode: string;
    perf: number;
    difficulty: Parameters<typeof calculateEloChange>[2];
    isWin: boolean;
    resultValue: number; // bestScore / averageScore input
  },
) {
  const { userId, sport, mode } = args;
  const rating = await ctx.db
    .query("userRatings")
    .withIndex("by_user_sport_mode", (q) =>
      q.eq("userId", userId).eq("sport", sport).eq("mode", mode),
    )
    .first();
  const currentElo = rating?.eloRating ?? 1200;
  const { k, label: kFactorLabel } = getKFactor(rating?.gamesPlayed ?? 0, currentElo);
  const eloChange = calculateEloChange(currentElo, args.perf, args.difficulty, k);
  const newElo = clampRating(currentElo + eloChange);
  const now = Date.now();
  if (rating) {
    const newGames = rating.gamesPlayed + 1;
    await ctx.db.patch(rating._id, {
      eloRating: newElo,
      peakRating: Math.max(rating.peakRating, newElo),
      gamesPlayed: newGames,
      wins: rating.wins + (args.isWin ? 1 : 0),
      losses: rating.losses + (args.isWin ? 0 : 1),
      bestScore: Math.max(rating.bestScore, args.resultValue),
      averageScore: (rating.averageScore * (newGames - 1) + args.resultValue) / newGames,
      lastPlayed: now,
      decayWarningShown: false,
    });
    await dismissOutstandingDecayNotifications(ctx, userId, sport, mode);
  } else {
    await ctx.db.insert("userRatings", {
      userId,
      sport,
      mode,
      eloRating: newElo,
      peakRating: newElo,
      gamesPlayed: 1,
      wins: args.isWin ? 1 : 0,
      losses: args.isWin ? 0 : 1,
      bestScore: args.resultValue,
      averageScore: args.resultValue,
      lastPlayed: now,
      lastDecayAt: 0,
      decayWarningShown: false,
    });
  }
  return { currentElo, eloChange, newElo, k, kFactorLabel };
}

/** The run length a quiz is judged on: the planned sequence (never fewer than
 *  the questions actually answered). */
export function rankedQuizRunLength(session: Doc<"quizSessions">): number {
  const planned = session.plannedChecksums?.length
    ? Math.min(RANKED_QUIZ_QUESTIONS, session.plannedChecksums.length)
    : RANKED_QUIZ_QUESTIONS;
  return Math.max(planned, session.totalAnswers ?? 0);
}

/**
 * Settle a ranked quiz session. `abandoned` = quit / tab-switch / expiry:
 * always a loss. Marks the session completed (idempotency) and returns the
 * rating outcome. Callers must have checked ownership; the session must not
 * already be completed.
 */
export async function settleQuizSession(
  ctx: MutationCtx,
  session: Doc<"quizSessions">,
  { abandoned }: { abandoned: boolean },
) {
  const userId = session.userId!;
  const totalAnswers = session.totalAnswers ?? 0;
  const runLength = rankedQuizRunLength(session);
  const correctCount = session.correctCount ?? 0;
  const accuracy = correctCount / runLength; // unanswered = wrong
  const averageTime = totalAnswers > 0 ? (session.sumAnswerTimeMs ?? 0) / 1000 / totalAnswers : 0;
  const difficulty = session.difficulty ?? "intermediate";
  const mode = session.mode ?? "quiz";
  const perf = getQuizPerformance(correctCount, runLength, averageTime);
  const isWin = !abandoned && accuracy >= 0.8;

  const r = await applyRating(ctx, {
    userId,
    sport: session.sport,
    mode,
    perf,
    difficulty,
    isWin,
    resultValue: correctCount,
  });

  await ctx.db.insert("gameSessions", {
    userId,
    sport: session.sport,
    mode,
    score: session.score ?? 0,
    totalQuestions: runLength,
    correctAnswers: correctCount,
    accuracy,
    avgAnswerTimeSecs: averageTime,
    eloBefore: r.currentElo,
    eloAfter: r.newElo,
    eloChange: r.eloChange,
    endedAt: Date.now(),
    sessionType: "game",
    kFactor: r.k,
    kFactorLabel: r.kFactorLabel,
  });

  await ctx.db.patch(session._id, {
    completed: true,
    currentChecksum: undefined,
    questionStartedAt: undefined,
    ...(abandoned ? { abandonedAt: session.abandonedAt ?? Date.now() } : {}),
  });
  if (!abandoned) await countPlay(ctx, userId);

  return {
    eloChange: r.eloChange,
    newElo: r.newElo,
    kFactor: r.k,
    kFactorLabel: r.kFactorLabel,
    score: session.score ?? 0,
    correctCount,
    totalAnswers,
    runLength,
    accuracy,
    averageTime,
  };
}

/**
 * End a ranked quiz the player walked away from (quit, tab switch, expiry).
 * ≥1 answer → settles as a loss; 0 answers → no rating change. Returns
 * whether a rating was written.
 */
export async function abandonQuizSession(ctx: MutationCtx, session: Doc<"quizSessions">) {
  if (session.completed) return { settled: false };
  const totalAnswers = session.totalAnswers ?? 0;
  if (totalAnswers > 0 && session.userId && (await isRankedEligibleUserId(ctx, session.userId))) {
    // Every planned question answered (completeQuiz lost to a dropped
    // connection, app killed on the last reveal): the run was played in full,
    // so it settles on its real result, not as a quit.
    const playedInFull = totalAnswers >= rankedQuizRunLength(session);
    await settleQuizSession(ctx, session, { abandoned: !playedInFull });
    return { settled: true };
  }
  // Quit before the first answer: the served question is parked so the next
  // ranked run serves it again on its original clock (no free reroll).
  await parkUnansweredQuestion(ctx, session);
  await ctx.db.patch(session._id, {
    completed: true,
    currentChecksum: undefined,
    questionStartedAt: undefined,
    abandonedAt: Date.now(),
  });
  return { settled: false };
}

/** Settle a finished (or abandoned / expired) ranked survival run on its banked score. */
export async function settleSurvivalSession(
  ctx: MutationCtx,
  session: Doc<"survivalSessions">,
  { countAsPlay }: { countAsPlay: boolean },
) {
  const userId = session.userId!;
  const score = session.score;
  const perf = Math.min(1.0, getSurvivalPerformance(score) + (session.performanceBonus ?? 0));
  const r = await applyRating(ctx, {
    userId,
    sport: session.sport,
    mode: "survival",
    perf,
    difficulty: getSurvivalDifficultyTier(score),
    isWin: score >= SURVIVAL_WIN_POINTS,
    resultValue: score,
  });
  const now = Date.now();
  const durationSeconds = Math.max(0, Math.round((now - (session.startedAt ?? session._creationTime)) / 1000));
  await ctx.db.insert("gameSessions", {
    userId,
    sport: session.sport,
    mode: "survival",
    score,
    durationSeconds,
    eloBefore: r.currentElo,
    eloAfter: r.newElo,
    eloChange: r.eloChange,
    endedAt: now,
    sessionType: "game",
    kFactor: r.k,
    kFactorLabel: r.kFactorLabel,
  });
  await ctx.db.patch(session._id, { gameOver: true, completedAt: now });
  if (countAsPlay) await countPlay(ctx, userId);
  return { eloChange: r.eloChange, newElo: r.newElo, kFactor: r.k, kFactorLabel: r.kFactorLabel, score, durationSeconds };
}

/** A ranked survival run that has started counting (any progress at all). */
export function survivalRunHasProgress(session: Doc<"survivalSessions">): boolean {
  return session.round > 1 || session.score > 0 || session.lives < 3 || (session.correctCount ?? 0) > 0;
}
