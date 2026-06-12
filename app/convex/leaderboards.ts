import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { isRankedEligibleUserDoc } from "./lib/authz";

/**
 * Server-authoritative leaderboard. The ordering contract lives HERE — clients
 * render `entries` in the order received and never re-sort:
 *
 *  - Scoped (sport + mode): rows come off the `by_sport_mode_elo` index in
 *    descending ELO order.
 *  - Unscoped ("All"): `userRatings` holds one row per user-sport-mode, so a
 *    global board must first collapse to one row per user (their best rating)
 *    or the same user shows up once per mode they've played. We collect and
 *    sort in the handler — `.take(n)` on an unindexed query would page by
 *    creation time and silently drop high-ELO users.
 *
 * Ties break by games played (more games first), then by userId so the order
 * is total and stable across reloads. Ranks are assigned server-side after
 * eligibility filtering, so they are strictly 1..n with no duplicates.
 * `getGlobalRank` shares the same candidate computation, so a user's global
 * position always agrees with the position the board would give them.
 *
 * Scale note: this reads the full `userRatings` table for the unscoped board
 * (and the full sport+mode slice when scoped). Fine at the current curated
 * scale (hundreds of rows); revisit with a denormalized best-rating table
 * before the table grows to many thousands.
 */
async function rankedCandidates(
  ctx: QueryCtx,
  sport?: string,
  mode?: string,
): Promise<Doc<"userRatings">[]> {
  let ratings: Doc<"userRatings">[];
  if (sport && mode) {
    ratings = await ctx.db
      .query("userRatings")
      .withIndex("by_sport_mode_elo", (q) =>
        q.eq("sport", sport).eq("mode", mode),
      )
      .order("desc")
      .collect();
  } else {
    ratings = await ctx.db.query("userRatings").collect();
  }

  // One candidate row per user: their best rating among the rows in scope.
  // (Defensive for the scoped path too — a duplicate user-sport-mode row
  // must never become a duplicate board entry.)
  const bestByUser = new Map<Id<"users">, Doc<"userRatings">>();
  for (const r of ratings) {
    if (r.gamesPlayed <= 0) continue;
    const prev = bestByUser.get(r.userId);
    if (!prev || r.eloRating > prev.eloRating) bestByUser.set(r.userId, r);
  }

  return [...bestByUser.values()].sort(
    (a, b) =>
      b.eloRating - a.eloRating ||
      b.gamesPlayed - a.gamesPlayed ||
      (a.userId < b.userId ? -1 : 1),
  );
}

export const getLeaderboard = query({
  args: {
    sport: v.optional(v.string()),
    mode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sport, mode, limit = 20 }) => {
    const candidates = await rankedCandidates(ctx, sport, mode);

    const entries = [];
    for (const r of candidates) {
      if (entries.length >= limit) break;
      const user = await ctx.db.get(r.userId);
      if (!isRankedEligibleUserDoc(user)) continue;
      entries.push({
        rank: entries.length + 1,
        userId: r.userId,
        username: user?.username ?? "Unknown",
        score: r.bestScore,
        elo_rating: r.eloRating,
        gamesPlayed: r.gamesPlayed,
        wins: r.wins,
      });
    }

    return {
      sport: sport ?? null,
      gameMode: mode ?? null,
      entries,
      totalEntries: entries.length,
    };
  },
});

/**
 * One user's true board position — the same ordering and eligibility rules as
 * `getLeaderboard`, walked past the board's display depth. Returns null for
 * users with no ranked games in scope (or who aren't ranked-eligible), so
 * clients can stay honest instead of fabricating a placement.
 */
export const getGlobalRank = query({
  args: {
    userId: v.id("users"),
    sport: v.optional(v.string()),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, { userId, sport, mode }) => {
    const candidates = await rankedCandidates(ctx, sport, mode);

    let rank = 0;
    let myRank: number | null = null;
    for (const r of candidates) {
      const user = await ctx.db.get(r.userId);
      if (!isRankedEligibleUserDoc(user)) continue;
      rank++;
      if (r.userId === userId) myRank = rank;
    }

    return myRank === null ? null : { rank: myRank, total: rank };
  },
});
