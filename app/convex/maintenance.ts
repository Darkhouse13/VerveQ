import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const COMPLETED_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLEANUP_BATCH = 500;

export const cleanupExpiredSessions = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = MAX_CLEANUP_BATCH }) => {
    const now = Date.now();
    const batchLimit = Math.min(limit, MAX_CLEANUP_BATCH);
    let removed = 0;
    let closed = 0;

    const quizSessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(batchLimit);
    for (const session of quizSessions) {
      if (
        (!(session.completed ?? false) || session.abandonedAt)
      ) {
        await ctx.db.delete(session._id);
        removed++;
      }
    }

    const dailyAttempts = await ctx.db
      .query("dailyAttempts")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(batchLimit);
    for (const attempt of dailyAttempts) {
      const expiresAt = attempt.expiresAt ?? attempt.startedAt + 30 * 60 * 1000;
      if (!attempt.completed && !attempt.forfeited && expiresAt <= now) {
        await ctx.db.patch(attempt._id, {
          forfeited: true,
          completedAt: expiresAt,
        });
        closed++;
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
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(batchLimit);
    for (const session of higherLowerSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "game_over" });
        closed++;
      }
    }

    const verveGridSessions = await ctx.db
      .query("verveGridSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(batchLimit);
    for (const session of verveGridSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "completed" });
        closed++;
      }
    }

    const whoAmISessions = await ctx.db
      .query("whoAmISessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(batchLimit);
    for (const session of whoAmISessions) {
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

    return { removed, closed, batchLimit };
  },
});
