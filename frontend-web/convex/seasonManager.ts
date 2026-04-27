import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { clampRating, getTierName } from "./lib/elo";

const SEASON_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const RESET_STALE_MS = 30 * 60 * 1000;

type SeasonDoc = Doc<"seasons">;

function sortSeasonsCurrentFirst(a: SeasonDoc, b: SeasonDoc) {
  const numberDiff = b.seasonNumber - a.seasonNumber;
  if (numberDiff !== 0) return numberDiff;
  const startDiff = b.startDate - a.startDate;
  if (startDiff !== 0) return startDiff;
  return String(a._id).localeCompare(String(b._id));
}

function getCanonicalSeason(seasons: SeasonDoc[]) {
  if (seasons.length === 0) return null;
  return [...seasons].sort(sortSeasonsCurrentFirst)[0];
}

async function getActiveSeasons(ctx: MutationCtx) {
  return (await ctx.db
    .query("seasons")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect()) as SeasonDoc[];
}

async function getLatestSeasonNumber(ctx: MutationCtx) {
  const seasons = (await ctx.db.query("seasons").collect()) as SeasonDoc[];
  return seasons.reduce(
    (latest, season) => Math.max(latest, season.seasonNumber),
    0,
  );
}

export const checkSeason = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeSeasons = await getActiveSeasons(ctx);
    const activeSeason = getCanonicalSeason(activeSeasons);

    if (!activeSeason) {
      const latestSeasonNumber = await getLatestSeasonNumber(ctx);
      await ctx.db.insert("seasons", {
        seasonNumber: latestSeasonNumber + 1,
        startDate: now,
        endDate: now + SEASON_DURATION_MS,
        isActive: true,
      });
      return { createdSeason: latestSeasonNumber + 1 };
    }

    for (const duplicate of activeSeasons) {
      if (duplicate._id !== activeSeason._id) {
        await ctx.db.patch(duplicate._id, { isActive: false });
      }
    }

    if (activeSeason.endDate > now) {
      return { status: "active" };
    }

    if (
      activeSeason.resetStartedAt &&
      !activeSeason.resetCompletedAt &&
      now - activeSeason.resetStartedAt < RESET_STALE_MS
    ) {
      return { status: "reset_in_progress" };
    }

    await ctx.db.patch(activeSeason._id, { resetStartedAt: now });
    await ctx.scheduler.runAfter(0, internal.seasonManager.runSeasonReset, {
      seasonId: activeSeason._id,
    });

    return { status: "reset_scheduled" };
  },
});

export const runSeasonReset = internalMutation({
  args: { seasonId: v.id("seasons") },
  handler: async (ctx, { seasonId }) => {
    const now = Date.now();
    const activeSeason = await ctx.db.get(seasonId);
    if (!activeSeason) throw new Error("Season not found");
    if (activeSeason.resetCompletedAt) {
      return { status: "already_completed" };
    }

    const allRatings = await ctx.db.query("userRatings").collect();

    const groups: Record<string, typeof allRatings> = {};
    for (const rating of allRatings) {
      const key = `${rating.sport}:${rating.mode}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rating);
    }

    for (const [, ratings] of Object.entries(groups)) {
      ratings.sort((a, b) => b.eloRating - a.eloRating);

      for (let i = 0; i < ratings.length; i++) {
        const rating = ratings[i];
        const rank = i + 1;

        const existingHistory = await ctx.db
          .query("seasonHistory")
          .withIndex("by_season_user_sport_mode", (q) =>
            q
              .eq("seasonNumber", activeSeason.seasonNumber)
              .eq("userId", rating.userId)
              .eq("sport", rating.sport)
              .eq("mode", rating.mode),
          )
          .first();

        const finalElo = existingHistory?.finalElo ?? rating.eloRating;
        const tier = existingHistory?.tier ?? getTierName(finalElo);

        if (!existingHistory) {
          await ctx.db.insert("seasonHistory", {
            userId: rating.userId,
            seasonNumber: activeSeason.seasonNumber,
            sport: rating.sport,
            mode: rating.mode,
            finalElo,
            rank,
            tier,
            gamesPlayed: rating.gamesPlayed,
            wins: rating.wins,
            archivedAt: now,
          });
        }

        if (
          finalElo > 1200 &&
          rating.seasonResetAppliedFor !== activeSeason.seasonNumber
        ) {
          const newElo = clampRating(
            Math.round((finalElo + 1200) / 2),
          );
          await ctx.db.patch(rating._id, {
            eloRating: newElo,
            seasonResetAppliedFor: activeSeason.seasonNumber,
          });

          await ctx.db.insert("gameSessions", {
            userId: rating.userId,
            sport: rating.sport,
            mode: rating.mode,
            eloBefore: finalElo,
            eloAfter: newElo,
            eloChange: newElo - finalElo,
            endedAt: now,
            sessionType: "seasonReset",
            details: { seasonNumber: activeSeason.seasonNumber },
          });
        }
      }
    }

    await ctx.db.patch(activeSeason._id, {
      isActive: false,
      resetCompletedAt: now,
    });

    const nextSeasonNumber = activeSeason.seasonNumber + 1;
    const existingNextSeason = await ctx.db
      .query("seasons")
      .withIndex("by_season_number", (q) =>
        q.eq("seasonNumber", nextSeasonNumber),
      )
      .first();

    if (existingNextSeason) {
      await ctx.db.patch(existingNextSeason._id, { isActive: true });
    } else {
      await ctx.db.insert("seasons", {
        seasonNumber: nextSeasonNumber,
        startDate: now,
        endDate: now + SEASON_DURATION_MS,
        isActive: true,
      });
    }

    return { status: "completed", seasonNumber: activeSeason.seasonNumber };
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
      const all = await ctx.db.query("seasonHistory").collect();
      entries = all
        .filter((entry) => entry.seasonNumber === seasonNumber)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, limit);
    }

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          ...entry,
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
