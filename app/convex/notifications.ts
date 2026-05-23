import { internalAction, internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { count: 0 };

    const notifications = await ctx.db
      .query("challengeNotifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();

    return {
      count: notifications.filter((notification) => !notification.readAt).length,
    };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const notifications = await ctx.db
      .query("challengeNotifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();

    let updated = 0;
    for (const notification of notifications) {
      if (!notification.readAt) {
        await ctx.db.patch(notification._id, { readAt: now });
        updated++;
      }
    }

    return { updated };
  },
});

export const markEmailStatus = internalMutation({
  args: {
    notificationId: v.id("challengeNotifications"),
    emailStatus: v.union(
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    emailError: v.optional(v.string()),
  },
  handler: async (ctx, { notificationId, emailStatus, emailError }) => {
    await ctx.db.patch(notificationId, {
      emailStatus,
      emailError,
    });
  },
});

export const sendDuelEmail = internalAction({
  args: {
    notificationId: v.id("challengeNotifications"),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { notificationId, to, subject, text }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      await ctx.runMutation(
        internal.notifications.markEmailStatus,
        {
          notificationId,
          emailStatus: "skipped",
          emailError: "RESEND_API_KEY or EMAIL_FROM is not configured",
        },
      );
      return;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `Resend send failed (${res.status} ${res.statusText}): ${detail.slice(0, 500)}`,
        );
      }
      await ctx.runMutation(
        internal.notifications.markEmailStatus,
        { notificationId, emailStatus: "sent" },
      );
    } catch (error) {
      await ctx.runMutation(
        internal.notifications.markEmailStatus,
        {
          notificationId,
          emailStatus: "failed",
          emailError: error instanceof Error ? error.message : "Unknown error",
        },
      );
    }
  },
});
