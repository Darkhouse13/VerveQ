import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { isRankedEligibleUserId } from "./lib/authz";
import { getTodayUTC } from "./lib/daily";
import {
  abandonQuizSession,
  settleSurvivalSession,
  survivalRunHasProgress,
} from "./lib/rankedSettle";

const COMPLETED_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLEANUP_BATCH = 500;
// Ranked settlement only looks back this far. Two reasons: (1) expired rows
// that are never deleted (completed quizzes, closed survival runs, finished
// daily attempts) pile up at the low end of by_expiresAt, so an oldest-first
// take(500) eventually never reaches a fresh expiry; (2) runs abandoned long
// before settlement shipped (prod had survival runs up to 171 days old) must
// not be rated retroactively. The cron runs hourly, so 48h is ample slack.
const SETTLE_LOOKBACK_MS = 48 * 60 * 60 * 1000;

export const cleanupExpiredSessions = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = MAX_CLEANUP_BATCH }) => {
    const now = Date.now();
    const batchLimit = Math.min(limit, MAX_CLEANUP_BATCH);
    let removed = 0;
    let closed = 0;
    let settled = 0;

    // A ranked run that expired after ≥1 answer settles as a loss before it
    // is discarded — closing the app is not a free exit (lib/rankedSettle).
    const recentQuizSessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", now - SETTLE_LOOKBACK_MS).lte("expiresAt", now),
      )
      .take(batchLimit);
    for (const session of recentQuizSessions) {
      // ≥1 answer → settle as a loss; a served-but-unanswered first question
      // is parked for the next run (lib/rankedPending) — both via abandon.
      if (
        !(session.completed ?? false) &&
        ((session.totalAnswers ?? 0) > 0 || session.currentChecksum)
      ) {
        await abandonQuizSession(ctx, session);
        settled++;
      }
    }

    // Retention (owner ruling 2026-11-05): every quiz session — completed,
    // abandoned or never finished — is deleted 7 days after it expired, same
    // rule as survival. Unfinished runs were already settled inside the 48h
    // window above; ratings, achievements (Quiz Master scans gameSessions, not
    // this table) and history totals live elsewhere. Windowed at the old end
    // of by_expiresAt so every row in the batch is deletable — the scan can
    // never stall on rows it must keep.
    const staleQuizSessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_expiresAt", (q) =>
        q.lte("expiresAt", now - COMPLETED_SESSION_RETENTION_MS),
      )
      .take(batchLimit);
    for (const session of staleQuizSessions) {
      await ctx.db.delete(session._id);
      removed++;
    }

    const dailyAttempts = await ctx.db
      .query("dailyAttempts")
      // Windowed: finished attempts are never deleted, so an unbounded
      // oldest-first scan stalls on them (prod already holds >500).
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", now - SETTLE_LOOKBACK_MS).lte("expiresAt", now),
      )
      .take(batchLimit);
    for (const attempt of dailyAttempts) {
      const expiresAt = attempt.expiresAt ?? attempt.startedAt + 30 * 60 * 1000;
      // Today's attempts stay open: an expired one with answers is resumable
      // (dailyChallenge.isResumableExpiredAttempt) and an unanswered one is
      // restartable. Only a past day's unfinished attempt is closed out.
      if (
        !attempt.completed &&
        !attempt.forfeited &&
        expiresAt <= now &&
        attempt.date < getTodayUTC()
      ) {
        await ctx.db.patch(attempt._id, {
          forfeited: true,
          completedAt: expiresAt,
        });
        closed++;
      }
    }

    // Ranked runs that ended or expired without completeSurvival still
    // settle on their banked score (no free exit from a bad run).
    const recentSurvivalSessions = await ctx.db
      .query("survivalSessions")
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", now - SETTLE_LOOKBACK_MS).lte("expiresAt", now),
      )
      .take(batchLimit);
    for (const session of recentSurvivalSessions) {
      if (
        !session.completedAt &&
        !session.dailyDate &&
        session.userId &&
        survivalRunHasProgress(session) &&
        (await isRankedEligibleUserId(ctx, session.userId))
      ) {
        await settleSurvivalSession(ctx, session, { countAsPlay: false });
        settled++;
      }
    }

    const survivalSessions = await ctx.db
      .query("survivalSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(batchLimit);
    for (const session of survivalSessions) {
      if (session.expiresAt <= now && !session.gameOver) {
        await ctx.db.patch(session._id, { gameOver: true });
        closed++;
      }
      if (
        session.completedAt &&
        now - session.completedAt > COMPLETED_SESSION_RETENTION_MS
      ) {
        await ctx.db.delete(session._id);
        removed++;
      }
    }

    const higherLowerSessions = await ctx.db
      .query("higherLowerSessions")
      // Windowed like the scans above: these rows are never deleted, so an
      // oldest-first scan stalls on old closed runs and never reaches fresh
      // expiries (or their decks).
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", now - SETTLE_LOOKBACK_MS).lte("expiresAt", now),
      )
      .take(batchLimit);
    for (const session of higherLowerSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "game_over" });
        if (session.deckId && (await ctx.db.get(session.deckId))) {
          await ctx.db.delete(session.deckId);
        }
        closed++;
      }
    }

    const verveGridSessions = await ctx.db
      .query("verveGridSessions")
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", now - SETTLE_LOOKBACK_MS).lte("expiresAt", now),
      )
      .take(batchLimit);
    for (const session of verveGridSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "completed" });
        closed++;
      }
    }

    const careerPathSessions = await ctx.db
      .query("careerPathSessions")
      .withIndex("by_expiresAt", (q) =>
        q.gt("expiresAt", now - SETTLE_LOOKBACK_MS).lte("expiresAt", now),
      )
      .take(batchLimit);
    for (const session of careerPathSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "failed", score: 0 });
        closed++;
      }
    }

    const blitzSessions = await ctx.db
      .query("blitzSessions")
      .withIndex("by_endTimeMs", (q) => q.lte("endTimeMs", now))
      .take(batchLimit);
    for (const session of blitzSessions) {
      if (!session.gameOver) {
        await ctx.db.patch(session._id, {
          gameOver: true,
          endedAt: session.endedAt ?? now,
          currentChecksum: undefined,
        });
        closed++;
      }
    }

    return { removed, closed, settled, batchLimit };
  },
});
