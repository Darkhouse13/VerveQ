import { internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { clampRating } from "./lib/elo";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DECAY_AMOUNT = 25;
const DECAY_FLOOR = 1500;
const DECAY_THRESHOLD_ELO = 1500;

export const runDecay = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeSeasons = await ctx.db
      .query("seasons")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    const seasonBoundaryPending =
      activeSeasons.length === 0 ||
      activeSeasons.some(
        (season) =>
          season.endDate <= now ||
          (season.resetStartedAt && !season.resetCompletedAt),
      );
    if (seasonBoundaryPending) {
      return { status: "season_reset_pending" };
    }

    const allRatings = await ctx.db.query("userRatings").collect();

    for (const rating of allRatings) {
      if (rating.eloRating < DECAY_THRESHOLD_ELO) continue;

      const referenceTime =
        rating.lastDecayAt && rating.lastDecayAt > 0
          ? rating.lastDecayAt
          : rating.lastPlayed;
      const thresholdDays =
        rating.lastDecayAt && rating.lastDecayAt > 0 ? 7 : 14;
      const daysSinceReference = (now - referenceTime) / MS_PER_DAY;

      if (daysSinceReference >= thresholdDays && rating.eloRating > DECAY_FLOOR) {
        // Apply decay
        const newElo = clampRating(
          Math.max(DECAY_FLOOR, rating.eloRating - DECAY_AMOUNT),
        );
        const eloChange = newElo - rating.eloRating;

        await ctx.db.patch(rating._id, {
          eloRating: newElo,
          lastDecayAt: now,
          decayWarningShown: false,
        });

        await ctx.db.insert("gameSessions", {
          userId: rating.userId,
          sport: rating.sport,
          mode: rating.mode,
          eloBefore: rating.eloRating,
          eloAfter: newElo,
          eloChange,
          endedAt: now,
          sessionType: "decay",
        });
      } else if (
        daysSinceReference >= thresholdDays - 3 &&
        !rating.decayWarningShown
      ) {
        // Show warning 3 days before decay
        await ctx.db.patch(rating._id, { decayWarningShown: true });

        const decayDate = referenceTime + thresholdDays * MS_PER_DAY;
        await ctx.db.insert("decayNotifications", {
          userId: rating.userId,
          sport: rating.sport,
          mode: rating.mode,
          decayDate,
          dismissed: false,
          createdAt: now,
        });
      }
    }

    return { status: "completed" };
  },
});

export const getDecayWarnings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("decayNotifications")
      .withIndex("by_user_dismissed", (q) =>
        q.eq("userId", userId).eq("dismissed", false),
      )
      .collect();
  },
});

export const dismissDecayWarning = mutation({
  args: { notificationId: v.id("decayNotifications") },
  handler: async (ctx, { notificationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notification = await ctx.db.get(notificationId);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(notificationId, { dismissed: true });
  },
});
