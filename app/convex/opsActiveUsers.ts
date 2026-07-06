import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
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
    for (const r of await ctx.db.query("careerPathSessions").collect())
      add("careerPathSessions", r.userId ?? null, r._creationTime);

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

const DAY_MS = 86_400_000;

/**
 * Daily "unique players (incl. guests)" email. Scheduled by crons.ts to run a
 * little after UTC midnight; reports the full UTC day that just ended.
 *
 * Recipient is OPS_REPORT_EMAIL (falls back to the founder address). Reuses the
 * same Resend env (RESEND_API_KEY + EMAIL_FROM) the auth/notification emails use;
 * if either is missing it logs and no-ops rather than throwing, so a misconfigured
 * deployment never turns into a noisy failed-cron loop.
 *
 * Completeness mirrors playedSince: completions are durable, but a few session
 * tables are TTL'd (~30-60min), so a prior-day count leans on the durable tables.
 */
export const emailDailyReport = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const todayStartUtc = Math.floor(now / DAY_MS) * DAY_MS;
    const sinceMs = todayStartUtc - DAY_MS;
    const untilMs = todayStartUtc;

    const stats = await ctx.runQuery(internal.opsActiveUsers.playedSince, {
      sinceMs,
      untilMs,
    });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const to = process.env.OPS_REPORT_EMAIL || "hamza.bentaieb@verveq.com";
    if (!apiKey || !from) {
      console.error(
        "[opsActiveUsers] daily report skipped: RESEND_API_KEY or EMAIL_FROM not configured",
      );
      return;
    }

    const dateLabel = new Date(sinceMs).toISOString().slice(0, 10); // YYYY-MM-DD
    const breakdown = Object.entries(stats.perTableUniqueUsers)
      .sort((a, b) => b[1] - a[1])
      .map(([table, n]) => `  ${table}: ${n}`)
      .join("\n");

    const subject = `VerveQ players — ${dateLabel}: ${stats.uniqueUsers} unique`;
    const text = [
      `VerveQ unique players for ${dateLabel} (UTC)`,
      ``,
      `Unique users (incl. guests/anonymous): ${stats.uniqueUsers}`,
      `Identity-less guest plays: ${stats.anonOrGuestPlays}`,
      ``,
      `Per-table unique users:`,
      breakdown || "  (none)",
      ``,
      `Window: ${new Date(sinceMs).toISOString()} → ${new Date(untilMs).toISOString()}`,
      `Note: anonymous/guest accounts carry real user IDs, so they're included in the`,
      `unique count. A few session tables are short-lived (TTL ~30-60min), so this`,
      `count leans on durable tables (completed games, blitz, daily, duels, arenas, learn).`,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Resend send failed (${res.status} ${res.statusText}): ${detail.slice(0, 500)}`,
      );
    }
    console.log(
      `[opsActiveUsers] daily report sent to ${to} for ${dateLabel}: ${stats.uniqueUsers} unique`,
    );
  },
});
