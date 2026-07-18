/**
 * THE DRAW — share-link serving (Ticket I, the duelShare precedent).
 *
 * getSharedRun is the public landing-page fetch for /s/r/<slug>. It is a
 * MUTATION, not a query, for the same reason duels.getByLinkCode is one: the
 * open must log a funnelEvents row (draw_share_view) and queries can't write.
 *
 * DELIBERATELY NO requireDrawUser and NO auth: the whole point of the landing
 * route is that a logged-out recipient in a fresh profile sees the shared
 * result. What makes that safe is the payload, not a gate — the summary is
 * spoiler-free by construction (lib/drawShare builders: outcomes and synergy
 * tags only) and NEVER carries board contents, card names, the boardSeed, or
 * the choiceLog. drawShareLinkContract.test.tsx locks the exact key set.
 */

import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getTodayUTC } from "./lib/daily";
import { boardNumberForDate } from "./lib/drawDaily";
import { buildIdentity, buildTrail, randomRunShareSlug } from "./lib/drawShare";
import { userActorKey } from "./funnel";

/** Collision-checked slug allocation (duels.generateUniqueLinkCode mirror). */
export async function generateUniqueRunShareSlug(
  ctx: Pick<MutationCtx, "db">,
): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const slug = randomRunShareSlug();
    const existing = await ctx.db
      .query("drawRuns")
      .withIndex("by_shareSlug", (q) => q.eq("shareSlug", slug))
      .first();
    if (!existing) return slug;
  }
  throw new Error("Could not allocate a unique run share slug");
}

async function runBySlug(ctx: Pick<MutationCtx, "db">, rawSlug: string) {
  const slug = rawSlug.trim();
  if (!slug) return { slug, run: null };
  const run = await ctx.db
    .query("drawRuns")
    .withIndex("by_shareSlug", (q) => q.eq("shareSlug", slug))
    .first();
  return { slug, run };
}

/**
 * The spoiler-free public summary of a shared run + the draw_share_view
 * funnel event (actor "anon" — at open time there is no auth session, the
 * /s/d/ link_tap precedent). Unknown/incomplete slugs return { found: false }
 * and log nothing.
 */
export const getSharedRun = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const { slug, run } = await runBySlug(ctx, args.slug);
    // A slug only ever exists on a completed run, but fail closed anyway:
    // no result ⇒ nothing shareable.
    if (!run || !run.result) return { found: false as const };
    await ctx.db.insert("funnelEvents", {
      type: "draw_share_view",
      actor: "anon",
      refLinkCode: slug,
      ts: Date.now(),
      meta: { dateKey: run.dateKey },
    });
    return {
      found: true as const,
      boardNumber: boardNumberForDate(run.dateKey),
      dateKey: run.dateKey,
      outcome: run.result.outcome,
      trail: buildTrail(run.result.rounds, run.result.outcome),
      identity: buildIdentity(run.result.rounds),
      score: run.result.finalScore,
      // Whether that board is still the live one — drives the landing CTA
      // ("beat {score}" only makes sense while the board can still be played).
      isToday: run.dateKey === getTodayUTC(),
    };
  },
});

/**
 * draw_share_convert — the landing CTA was tapped. Logged only for slugs that
 * resolve (an unknown slug converting is noise, not funnel). Actor is the
 * tapper if a session already exists, else "anon" (guest bootstrap happens
 * later, on /draw).
 */
export const recordShareConvert = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const { slug, run } = await runBySlug(ctx, args.slug);
    if (!run || !run.result) return { ok: false as const };
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("funnelEvents", {
      type: "draw_share_convert",
      actor: userId ? userActorKey(userId) : "anon",
      refLinkCode: slug,
      ts: Date.now(),
      meta: { dateKey: run.dateKey },
    });
    return { ok: true as const };
  },
});

/**
 * One-shot backfill: allocate slugs for completed runs that predate Ticket I.
 * Safe to re-run (skips runs that already have one); in-progress runs get
 * theirs at completion like everyone else.
 */
export const backfillShareSlugs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query("drawRuns").collect();
    let allocated = 0;
    for (const run of runs) {
      if (run.completedAt === undefined || run.shareSlug) continue;
      await ctx.db.patch(run._id, {
        shareSlug: await generateUniqueRunShareSlug(ctx),
      });
      allocated += 1;
    }
    return { scanned: runs.length, allocated };
  },
});
