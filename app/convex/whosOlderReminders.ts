/**
 * WHO'S OLDER? daily email reminder — the return trigger a player arriving
 * from Instagram's in-app browser otherwise never gets (no bookmark, no app
 * icon, no push). Rules live in lib/whosOlderRetention.ts.
 *
 * Double opt-in: `subscribe` stores the address and mails ONE confirmation;
 * nothing else is sent until its link is opened (`claimToken` with
 * confirm=true). Every later email carries the same token, so opening any of
 * them in a new browser links that browser to the subscription — and with it,
 * to the player's streak (whosOlder.ts streakUserIds).
 *
 * Sending: the hourly cron runs `sendDueReminders`, which mails each confirmed
 * subscriber once per edition, in their local morning, unless they already
 * played today or have been dormant for two weeks. One-click unsubscribe is
 * the http route /whos-older/unsubscribe (also the List-Unsubscribe header).
 *
 * Env: RESEND_API_KEY + EMAIL_FROM (shared with the auth/ops emails);
 * SHARE_PUBLIC_BASE_URL for the links (defaults to https://verveq.com).
 */
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertSessionUser } from "./lib/authz";
import { editionNumberForDate } from "./lib/whosOlder";
import {
  REMINDER_CONFIRM_RESEND_MS,
  REMINDER_SIGNUPS_PER_DAY,
  computeDailyStreak,
  hoursMinutesUntilMidnightUTC,
  normalizeEmail,
  reminderDue,
  safeTimeZone,
} from "./lib/whosOlderRetention";
import { finishedDailyDates } from "./whosOlder";

const DAY_MS = 24 * 60 * 60 * 1000;

function publicBase(): string {
  return (process.env.SHARE_PUBLIC_BASE_URL || "https://verveq.com").replace(/\/+$/, "");
}

function siteBase(): string {
  // CONVEX_SITE_URL is provided by Convex on every deployment.
  return (process.env.CONVEX_SITE_URL || "").replace(/\/+$/, "");
}

export function unsubscribeUrl(token: string): string {
  return `${siteBase()}/whos-older/unsubscribe?t=${encodeURIComponent(token)}`;
}

function playUrl(token: string, extra: Record<string, string>): string {
  const params = new URLSearchParams({ rt: token, ...extra });
  return `${publicBase()}/older?${params.toString()}`;
}

function randomToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

async function linkUser(
  ctx: Pick<MutationCtx, "db">,
  reminderId: Id<"whosOlderReminders">,
  userId: Id<"users">,
) {
  const existing = await ctx.db
    .query("whosOlderReminderLinks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing?.reminderId === reminderId) return;
  // A browser belongs to one address: the latest one it claimed wins.
  if (existing) await ctx.db.delete(existing._id);
  await ctx.db.insert("whosOlderReminderLinks", { reminderId, userId, createdAt: Date.now() });
}

// ── Player-facing ───────────────────────────────────────────────────────────

/**
 * Sign the caller up for the daily reminder. Returns the state the result card
 * shows next: "pending" (check your inbox) or "on" (the address was already
 * confirmed — nothing new is mailed). Errors carry a ConvexError code the
 * client maps to copy: invalid_email, rate_limited.
 */
export const subscribe = mutation({
  args: { email: v.string(), timeZone: v.optional(v.string()) },
  handler: async (ctx, { email: raw, timeZone }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);
    const email = normalizeEmail(raw);
    if (!email) throw new ConvexError({ code: "invalid_email" });

    const recent = await ctx.db
      .query("whosOlderReminders")
      .withIndex("by_creator_created", (q) =>
        q.eq("createdByUserId", userId).gt("createdAt", Date.now() - DAY_MS),
      )
      .take(REMINDER_SIGNUPS_PER_DAY + 1);
    const tz = safeTimeZone(timeZone);
    const existing = await ctx.db
      .query("whosOlderReminders")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      if (existing.confirmedAt && !existing.unsubscribedAt) return { state: "on" as const };
      // Pending, or re-opting in after an unsubscribe: back through
      // confirmation, at most one confirmation email per window.
      const resend =
        Boolean(existing.unsubscribedAt) ||
        !existing.confirmSentAt ||
        Date.now() - existing.confirmSentAt > REMINDER_CONFIRM_RESEND_MS;
      await ctx.db.patch(existing._id, {
        unsubscribedAt: undefined,
        confirmedAt: undefined,
        timeZone: tz,
        ...(resend ? { confirmSentAt: Date.now() } : {}),
      });
      if (resend) {
        await ctx.scheduler.runAfter(0, internal.whosOlderReminders.sendConfirmation, { reminderId: existing._id });
      }
      return { state: "pending" as const };
    }

    if (recent.length >= REMINDER_SIGNUPS_PER_DAY) throw new ConvexError({ code: "rate_limited" });
    const reminderId = await ctx.db.insert("whosOlderReminders", {
      email,
      token: randomToken(),
      timeZone: tz,
      createdByUserId: userId,
      createdAt: Date.now(),
      confirmSentAt: Date.now(),
      sentCount: 0,
    });
    await ctx.scheduler.runAfter(0, internal.whosOlderReminders.sendConfirmation, { reminderId });
    return { state: "pending" as const };
  },
});

/**
 * An email link was opened (`?rt=` on /older). Links this browser to the
 * subscription; `confirm` (the confirmation email's link) also switches the
 * reminders on and links the browser that signed up. Unknown tokens are a
 * silent no-op — a stale link must never break the game it opens.
 */
export const claimToken = mutation({
  args: { token: v.string(), confirm: v.optional(v.boolean()) },
  handler: async (ctx, { token, confirm }) => {
    if (token.length < 32 || token.length > 128) return { ok: false, confirmed: false };
    const reminder = await ctx.db
      .query("whosOlderReminders")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!reminder || reminder.unsubscribedAt) return { ok: false, confirmed: false };
    const newlyConfirmed = Boolean(confirm) && !reminder.confirmedAt;
    if (newlyConfirmed) {
      await ctx.db.patch(reminder._id, { confirmedAt: Date.now() });
      await linkUser(ctx, reminder._id, reminder.createdByUserId);
    }
    const userId = await getAuthUserId(ctx);
    if (userId && (reminder.confirmedAt || newlyConfirmed)) await linkUser(ctx, reminder._id, userId);
    return { ok: true, confirmed: newlyConfirmed };
  },
});

/** "Turn off" on the result card: stops the caller's reminder. */
export const unsubscribeMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const link = await ctx.db
      .query("whosOlderReminderLinks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const reminder = link
      ? await ctx.db.get(link.reminderId)
      : await ctx.db
          .query("whosOlderReminders")
          .withIndex("by_creator_created", (q) => q.eq("createdByUserId", userId))
          .order("desc")
          .first();
    if (reminder && !reminder.unsubscribedAt) {
      await ctx.db.patch(reminder._id, { unsubscribedAt: Date.now() });
    }
    return { ok: true };
  },
});

// ── Internal ────────────────────────────────────────────────────────────────

export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const reminder = await ctx.db
      .query("whosOlderReminders")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!reminder) return { ok: false };
    if (!reminder.unsubscribedAt) await ctx.db.patch(reminder._id, { unsubscribedAt: Date.now() });
    return { ok: true };
  },
});

export const getForSend = internalQuery({
  args: { reminderId: v.id("whosOlderReminders") },
  handler: async (ctx, { reminderId }) => ctx.db.get(reminderId),
});

/** Everyone the reminder goes to on this run, with what their email says. */
export const dueReminders = internalQuery({
  args: { nowMs: v.number() },
  handler: async (ctx, { nowMs }) => {
    const todayKey = new Date(nowMs).toISOString().slice(0, 10);
    const confirmed = await ctx.db
      .query("whosOlderReminders")
      .withIndex("by_unsubscribed_confirmed", (q) =>
        q.eq("unsubscribedAt", undefined).gt("confirmedAt", 0),
      )
      .collect();
    const due = [];
    for (const r of confirmed) {
      if (r.lastSentDateKey === todayKey) continue;
      const links = await ctx.db
        .query("whosOlderReminderLinks")
        .withIndex("by_reminder", (q) => q.eq("reminderId", r._id))
        .take(20);
      const userIds = [...new Set([r.createdByUserId, ...links.map((l) => l.userId)])];
      const dates = await finishedDailyDates(ctx, userIds);
      const streak = computeDailyStreak(dates, todayKey);
      const last = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
      if (
        !reminderDue({
          nowMs,
          todayKey,
          timeZone: r.timeZone,
          lastSentDateKey: r.lastSentDateKey,
          playedToday: streak.playedToday,
          lastFinishedDateKey: last,
          confirmedAt: r.confirmedAt!,
        })
      ) {
        continue;
      }
      // Friends who took this player's challenges since the last email — or,
      // for the first one, since sign-up (a friend often answers before the
      // player gets round to confirming).
      let friends = 0;
      const since = r.lastSentAt ?? r.createdAt;
      for (const uid of userIds) {
        const challenges = await ctx.db
          .query("whosOlderChallenges")
          .withIndex("by_from_created", (q) => q.eq("fromUserId", uid).gt("createdAt", nowMs - 8 * DAY_MS))
          .take(10);
        for (const c of challenges) {
          const results = await ctx.db
            .query("whosOlderChallengeResults")
            .withIndex("by_challenge", (q) => q.eq("challengeId", c._id))
            .take(50);
          friends += results.filter((x) => x.createdAt > since).length;
        }
      }
      due.push({ reminderId: r._id, email: r.email, token: r.token, streak: streak.current, friends });
    }
    return { todayKey, due };
  },
});

export const markSent = internalMutation({
  args: { reminderId: v.id("whosOlderReminders"), dateKey: v.string() },
  handler: async (ctx, { reminderId, dateKey }) => {
    const r = await ctx.db.get(reminderId);
    if (!r) return;
    await ctx.db.patch(reminderId, { lastSentDateKey: dateKey, lastSentAt: Date.now(), sentCount: r.sentCount + 1 });
  },
});

// ── Mail ────────────────────────────────────────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderEmail(args: { heading: string; lines: string[]; button: string; href: string; footer: string; unsubscribe: string }) {
  const text = [args.heading, "", ...args.lines, "", `${args.button}: ${args.href}`, "", args.footer, `Unsubscribe: ${args.unsubscribe}`].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#111;font-family:Arial,Helvetica,sans-serif;color:#fff8f0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="font-family:'Courier New',monospace;font-weight:bold;letter-spacing:3px;color:#c6ff1a;font-size:13px">VERVEQ</td></tr>
<tr><td style="padding-top:18px;font-size:28px;font-weight:900;line-height:1.1">${escapeHtml(args.heading)}</td></tr>
${args.lines.map((l) => `<tr><td style="padding-top:12px;font-size:16px;line-height:1.45;color:#f3ece4">${escapeHtml(l)}</td></tr>`).join("\n")}
<tr><td style="padding-top:24px"><a href="${escapeHtml(args.href)}" style="display:inline-block;background:#c6ff1a;color:#111;font-weight:900;font-size:18px;text-decoration:none;padding:14px 26px;border:3px solid #000;border-radius:10px">${escapeHtml(args.button)}</a></td></tr>
<tr><td style="padding-top:32px;font-size:12px;line-height:1.5;color:#9a948e">${escapeHtml(args.footer)}<br><a href="${escapeHtml(args.unsubscribe)}" style="color:#9a948e">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

async function sendMail(to: string, subject: string, body: { text: string; html: string }, unsubscribe: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("[whosOlderReminders] RESEND_API_KEY or EMAIL_FROM not configured — email not sent");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body.text,
      html: body.html,
      headers: {
        "List-Unsubscribe": `<${unsubscribe}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) {
    console.error(`[whosOlderReminders] Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    return false;
  }
  return true;
}

const FOOTER = "You asked for a daily Who's Older? reminder at verveq.com. One email a day, only on days you haven't played yet.";

export const sendConfirmation = internalAction({
  args: { reminderId: v.id("whosOlderReminders") },
  handler: async (ctx, { reminderId }) => {
    const r = await ctx.runQuery(internal.whosOlderReminders.getForSend, { reminderId });
    if (!r || r.unsubscribedAt || r.confirmedAt) return;
    const unsub = unsubscribeUrl(r.token);
    const body = renderEmail({
      heading: "One tap and you're in.",
      lines: [
        "Confirm and we'll email you when each new Who's Older? goes live, so your streak never dies by accident.",
        "Didn't ask for this? Ignore this email and you'll never hear from us.",
      ],
      button: "Yes, remind me",
      href: playUrl(r.token, { confirm: "1", utm_source: "email", utm_medium: "confirm", utm_campaign: "whos_older_reminder" }),
      footer: FOOTER,
      unsubscribe: unsub,
    });
    await sendMail(r.email, "Confirm your daily Who's Older? reminder", body, unsub);
  },
});

/** Hourly (crons.ts). Resend's default limit is 2 requests/s: sends are paced. */
export const sendDueReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    const { todayKey, due } = await ctx.runQuery(internal.whosOlderReminders.dueReminders, { nowMs });
    if (due.length === 0) return { sent: 0 };
    const edition = editionNumberForDate(todayKey);
    const left = hoursMinutesUntilMidnightUTC(nowMs);
    let sent = 0;
    for (const d of due) {
      const unsub = unsubscribeUrl(d.token);
      const lines = [
        d.streak > 0
          ? `🔥 You're on a ${d.streak}-day streak. Play in the next ${left} to make it ${d.streak + 1}.`
          : "Ten new pairs. The gap shrinks every round, from years to days.",
      ];
      if (d.friends > 0) {
        lines.push(`${d.friends} ${d.friends === 1 ? "friend has" : "friends have"} taken your challenge. See how you compare after today's game.`);
      }
      const body = renderEmail({
        heading: `Who's Older? #${edition} is live`,
        lines,
        button: `Play #${edition}`,
        href: playUrl(d.token, { utm_source: "email", utm_medium: "reminder", utm_campaign: "whos_older_daily" }),
        footer: FOOTER,
        unsubscribe: unsub,
      });
      const subject = d.streak > 0 ? `🔥 Day ${d.streak + 1}? Who's Older? #${edition} is live` : `Who's Older? #${edition} is live`;
      if (await sendMail(d.email, subject, body, unsub)) {
        await ctx.runMutation(internal.whosOlderReminders.markSent, { reminderId: d.reminderId, dateKey: todayKey });
        sent++;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    console.log(`[whosOlderReminders] ${todayKey}: ${sent}/${due.length} reminders sent`);
    return { sent };
  },
});
