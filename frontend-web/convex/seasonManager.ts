import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { clampRating, getTierName } from "./lib/elo";

const SEASON_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export const checkSeason = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find active season
    const activeSeason = await ctx.db
      .query("seasons")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (!activeSeason) {
      // No active season — create Season 1
      await ctx.db.insert("seasons", {
        seasonNumber: 1,
        startDate: now,
        endDate: now + SEASON_DURATION_MS,
        isActive: true,
      });
      return;
    }

    if (activeSeason.endDate > now) {
      // Season still active
      return;
    }

    // Season ended — execute reset procedure
    const allRatings = await ctx.db.query("userRatings").collect();

    // Group by sport+mode
    const groups: Record<string, typeof allRatings> = {};
    for (const r of allRatings) {
      const key = `${r.sport}:${r.mode}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    for (const [, ratings] of Object.entries(groups)) {
      // Sort by ELO desc to compute ranks
      ratings.sort((a, b) => b.eloRating - a.eloRating);

      for (let i = 0; i < ratings.length; i++) {
        const r = ratings[i];
        const rank = i + 1;
        const tier = getTierName(r.eloRating);

        // Archive to seasonHistory
        await ctx.db.insert("seasonHistory", {
          userId: r.userId,
          seasonNumber: activeSeason.seasonNumber,
          sport: r.sport,
          mode: r.mode,
          finalElo: r.eloRating,
          rank,
          tier,
          gamesPlayed: r.gamesPlayed,
          wins: r.wins,
          archivedAt: now,
        });

        // Apply soft reset: newElo = (currentElo + 1200) / 2
        if (r.eloRating > 1200) {
          const newElo = clampRating(Math.round((r.eloRating + 1200) / 2));
          await ctx.db.patch(r._id, { eloRating: newElo });

          // Record season reset session
          await ctx.db.insert("gameSessions", {
            userId: r.userId,
            sport: r.sport,
            mode: r.mode,
            eloBefore: r.eloRating,
            eloAfter: newElo,
            eloChange: newElo - r.eloRating,
            endedAt: now,
            sessionType: "seasonReset",
          });
        }
      }
    }

    // Mark old season inactive
    await ctx.db.patch(activeSeason._id, {
      isActive: false,
      resetCompletedAt: now,
    });

    // Create new season
    await ctx.db.insert("seasons", {
      seasonNumber: activeSeason.seasonNumber + 1,
      startDate: now,
      endDate: now + SEASON_DURATION_MS,
      isActive: true,
    });
  },
});

export const getCurrentSeason = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("seasons")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
  },
});

export const getPastSeasons = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("seasons")
      .withIndex("by_active", (q) => q.eq("isActive", false))
      .order("desc")
      .collect();
  },
});

export const getSeasonHistory = query({
  args: {
    seasonNumber: v.number(),
    sport: v.optional(v.string()),
    mode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { seasonNumber, sport, mode, limit = 20 }) => {
    let entries: Doc<"seasonHistory">[];
    if (sport && mode) {
      entries = await ctx.db
        .query("seasonHistory")
        .withIndex("by_season_sport_mode_rank", (q) =>
          q
            .eq("seasonNumber", seasonNumber)
            .eq("sport", sport)
            .eq("mode", mode),
        )
        .take(limit);
    } else {
      // No sport+mode filter — collect all for this season and sort by rank
      const all = await ctx.db.query("seasonHistory").collect();
      entries = all
        .filter((e) => e.seasonNumber === seasonNumber)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, limit);
    }

    // Enrich with username
    const enriched = await Promise.all(
      entries.map(async (e) => {
        const user = await ctx.db.get(e.userId);
        return {
          ...e,
          username: user?.username ?? "Unknown",
        };
      }),
    );

    return enriched;
  },
});

export const getUserSeasonHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("seasonHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
