import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Ad-hoc "unique users who played" counter — there is no DAU instrument in the
 * product, so this unions distinct userIds across every gameplay table for a
 * time window [sinceMs, untilMs). Pass UTC-ms boundaries (compute the day start
 * client-side so the caller controls local-vs-UTC framing).
 *
 * Timestamp chosen per table to approximate "when the user actually played":
 *  - durable records use their real event time (playedAt / completedAt / endedAt)
 *  - async duels are attributed per side at that side's result.completedAt
 *  - short-lived session tables (TTL ~30-60min) fall back to _creationTime; they
 *    only retain recent rows, so they're complete for short/recent windows only.
 *
 * Guest/anonymous plays (rows with no userId) can't be deduped into "users", so
 * they're tallied separately as anonOrGuestPlays for transparency.
 *
 * Scale note: collects whole tables. Fine for the current size (~hundreds of
 * rows/table); revisit with time-indexed scans if any table grows large.
 */
export const playedSince = internalQuery({
  args: { sinceMs: v.number(), untilMs: v.optional(v.number()) },
  handler: async (ctx, { sinceMs, untilMs }) => {
    const until = untilMs ?? Number.MAX_SAFE_INTEGER;
    const inWin = (t?: number | null) =>
      typeof t === "number" && t >= sinceMs && t < until;

    const users = new Set<string>();
    const byTable: Record<string, Set<string>> = {};
    let anonOrGuestPlays = 0;

    const add = (
      table: string,
      userId: string | null | undefined,
      t?: number | null,
    ) => {
      if (!inWin(t)) return;
      if (!userId) {
        anonOrGuestPlays++;
        return;
      }
      (byTable[table] ??= new Set()).add(userId);
      users.add(userId);
    };

    // Central completed-game record (ELO-bearing), written across modes.
    for (const r of await ctx.db.query("gameSessions").collect())
      add("gameSessions", r.userId, r.endedAt ?? r._creationTime);

    for (const r of await ctx.db.query("blitzScores").collect())
      add("blitzScores", r.userId, r.playedAt);

    for (const r of await ctx.db.query("dailyAttempts").collect())
      add("dailyAttempts", r.userId, r.completedAt ?? r.startedAt ?? r._creationTime);

    // Async duels: each player plays at their own result.completedAt.
    for (const r of await ctx.db.query("duels").collect()) {
      add("duels", r.challengerId, r.challengerResult?.completedAt);
      add("duels", r.opponentId ?? null, r.opponentResult?.completedAt);
    }

    for (const r of await ctx.db.query("liveMatches").collect()) {
      const t = r.completedAt ?? r.createdAt;
      add("liveMatches", r.player1Id, t);
      add("liveMatches", r.player2Id, t);
    }

    for (const r of await ctx.db.query("multiplayerMatches").collect()) {
      const t = r.completedAt ?? r.createdAt;
      for (const uid of r.playerIds) add("multiplayerMatches", uid, t);
    }

    for (const r of await ctx.db.query("arenas").collect())
      for (const p of r.players)
        add("arenas", p.userId, p.lastSeenAt ?? p.joinedAt ?? r.createdAt);

    for (const r of await ctx.db.query("learnSessions").collect())
      add("learnSessions", r.userId, r.completedAt ?? r.startedAt);

    // Short-lived session tables (TTL'd) — complete only for recent windows.
    for (const r of await ctx.db.query("quizSessions").collect())
      add("quizSessions", r.userId ?? null, r._creationTime);
    for (const r of await ctx.db.query("survivalSessions").collect())
      add("survivalSessions", r.userId ?? null, r.startedAt ?? r._creationTime);
    for (const r of await ctx.db.query("blitzSessions").collect())
      add("blitzSessions", r.userId, r.startedAt ?? r._creationTime);
    for (const r of await ctx.db.query("higherLowerSessions").collect())
      add("higherLowerSessions", r.userId ?? null, r._creationTime);
    for (const r of await ctx.db.query("verveGridSessions").collect())
      add("verveGridSessions", r.userId ?? null, r._creationTime);
    for (const r of await ctx.db.query("whoAmISessions").collect())
      add("whoAmISessions", r.userId ?? null, r._creationTime);

    const perTableUniqueUsers: Record<string, number> = {};
    for (const [table, set] of Object.entries(byTable))
      perTableUniqueUsers[table] = set.size;

    return {
      sinceMs,
      untilMs: until === Number.MAX_SAFE_INTEGER ? null : until,
      uniqueUsers: users.size,
      anonOrGuestPlays,
      perTableUniqueUsers,
    };
  },
});
