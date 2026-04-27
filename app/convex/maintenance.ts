import { internalMutation } from "./_generated/server";

const COMPLETED_SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let removed = 0;
    let closed = 0;

    const quizSessions = await ctx.db.query("quizSessions").collect();
    for (const session of quizSessions) {
      if (
        session.expiresAt <= now &&
        (!(session.completed ?? false) || session.abandonedAt)
      ) {
        await ctx.db.delete(session._id);
        removed++;
      }
    }

    const dailyAttempts = await ctx.db.query("dailyAttempts").collect();
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

    const survivalSessions = await ctx.db.query("survivalSessions").collect();
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

    const higherLowerSessions = await ctx.db.query("higherLowerSessions").collect();
    for (const session of higherLowerSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "game_over" });
        closed++;
      }
    }

    const verveGridSessions = await ctx.db.query("verveGridSessions").collect();
    for (const session of verveGridSessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "completed" });
        closed++;
      }
    }

    const whoAmISessions = await ctx.db.query("whoAmISessions").collect();
    for (const session of whoAmISessions) {
      if (session.expiresAt <= now && session.status === "active") {
        await ctx.db.patch(session._id, { status: "failed", score: 0 });
        closed++;
      }
    }

    return { removed, closed };
  },
});
