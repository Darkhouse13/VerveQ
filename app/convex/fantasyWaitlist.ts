/**
 * THE WEEKEND pre-launch waitlist (Ticket FW-P1).
 *
 * Counts interest in the upcoming fantasy mode before launch (late August)
 * and collects emails from visitors who don't have an account yet. Two join
 * paths, one table, one invariant:
 *
 *   - joinWaitlistAsUser    signed-in identities (username-only or full);
 *                           one tap, no input. Writes { userId }.
 *   - joinWaitlistWithEmail anonymous visitors. Server-side normalization
 *                           (trim + lowercase) and format validation.
 *                           Writes { email }.
 *
 * Each mutation writes ONLY its own identity field, so every row carries
 * exactly one of userId | email. Joins are idempotent: the same identity
 * joining twice keeps the original row and reports success — no visible
 * error, ever.
 *
 * Both mutations return result objects instead of throwing for expected
 * failures (invalid email, rate limit): prod redacts plain Error messages
 * (see authEmail.ts), and the funnel.ts convention is that acquisition
 * surfaces never break on instrumentation-adjacent paths.
 *
 * Privacy rule (HARD): emails never leave the server. getTeaserStatus serves
 * a boolean and a number only; no query, log, or analytics property ever
 * carries an email.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

const MINUTE_MS = 60 * 1000;

/**
 * Anonymous email joins are gated by a global sliding window counted on the
 * waitlist table's own _creationTime (built-in by_creation_time index) — the
 * repo's hand-rolled-window convention (users.ts, anonymousOnboardingIp.ts)
 * minus a dedicated attempts table, which this ticket's schema budget doesn't
 * include. Mutations can't see IPs, so there is no per-caller key to window
 * on; the global cap bounds bulk fake-email writes while staying far above
 * any plausible organic join rate. Idempotent re-joins are answered BEFORE
 * the window check, so a rate-limited spike can never surface an error to an
 * already-joined visitor. User joins are keyed to an authenticated identity
 * and idempotent (≤1 row per user), so they carry no window.
 */
export const FANTASY_WAITLIST_RATE_LIMITS = {
  globalJoinsTenMinutes: { max: 30, windowMs: 10 * MINUTE_MS },
} as const;

/** Same normalization pair as users.ts upgradeUsernameOnly. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  // 254 is the RFC 5321 ceiling; longer strings are junk, not addresses.
  return value.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/** Coarse attribution tag: trimmed, bounded, empty → undefined. */
function normalizeSource(value: string | undefined): string | undefined {
  const trimmed = value?.trim().slice(0, 64);
  return trimmed ? trimmed : undefined;
}

export const joinWaitlistAsUser = mutation({
  args: {
    // utm_source ?? ref off the landing URL, else the placement tag.
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false as const, code: "not_authenticated" as const };

    const existing = await ctx.db
      .query("fantasyWaitlist")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return { ok: true as const, joined: false as const };

    await ctx.db.insert("fantasyWaitlist", {
      userId,
      createdAt: Date.now(),
      source: normalizeSource(args.source),
    });
    return { ok: true as const, joined: true as const };
  },
});

export const joinWaitlistWithEmail = mutation({
  args: {
    email: v.string(),
    // utm_source ?? ref off the landing URL, else the placement tag.
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) {
      return { ok: false as const, code: "invalid_email" as const };
    }

    // Idempotency first: an already-joined email is a success regardless of
    // the window below.
    const existing = await ctx.db
      .query("fantasyWaitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) return { ok: true as const, joined: false as const };

    const { max, windowMs } =
      FANTASY_WAITLIST_RATE_LIMITS.globalJoinsTenMinutes;
    const since = Date.now() - windowMs;
    const recent = await ctx.db
      .query("fantasyWaitlist")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
      .collect();
    if (recent.length >= max) {
      return { ok: false as const, code: "rate_limited" as const };
    }

    await ctx.db.insert("fantasyWaitlist", {
      email,
      createdAt: Date.now(),
      source: normalizeSource(args.source),
    });
    return { ok: true as const, joined: true as const };
  },
});

/**
 * Everything the home teaser needs, and nothing more: whether the CALLER is
 * already on the list (signed-in identities only — anonymous membership is
 * session-visual on the client, by design) and the total count. The count is
 * a full-table length read; a pre-launch waitlist is small by definition, and
 * the table stops growing at launch.
 *
 * This query doubles as the teaser's runtime gate: until this module is
 * deployed to prod the call rejects, the card's catch swallows it, and the
 * teaser simply doesn't exist on Home.
 */
export const getTeaserStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const member = userId
      ? (await ctx.db
          .query("fantasyWaitlist")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .first()) !== null
      : false;
    const rows = await ctx.db.query("fantasyWaitlist").collect();
    return { member, count: rows.length };
  },
});
