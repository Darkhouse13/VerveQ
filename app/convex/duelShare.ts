import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Server-side data backing the /s/d/:linkCode share route. Exposes ONLY the
// challenger's display label and (once they've completed) their score —
// never opponent data, answers, checksums, aliases, emails, or other users'
// info. A failed lookup returns found:false so the route can degrade to a
// generic card without ever erroring.
export const getShareCardData = internalQuery({
  args: { linkCode: v.string() },
  handler: async (ctx, { linkCode }) => {
    const code = linkCode.trim();
    if (!code) {
      return { found: false, challengerName: null, challengerScore: null };
    }
    const duel = await ctx.db
      .query("duels")
      .withIndex("by_linkCode", (q) => q.eq("linkCode", code))
      .first();
    if (!duel) {
      return { found: false, challengerName: null, challengerScore: null };
    }
    const challenger = await ctx.db.get(duel.challengerId);
    const challengerName =
      challenger?.displayName ?? challenger?.username ?? null;
    const challengerScore = duel.challengerResult?.completedAt
      ? duel.challengerResult.score
      : null;
    return { found: true, challengerName, challengerScore };
  },
});

// Human (non-crawler) hit on the share route. Crawler prefetches never call
// this. actor is "anon": at tap time there is no auth session or guest token
// yet — attribution flows through refLinkCode + refChallengerId instead.
export const logLinkTap = internalMutation({
  args: { linkCode: v.string() },
  handler: async (ctx, { linkCode }) => {
    const code = linkCode.trim();
    const duel = code
      ? await ctx.db
          .query("duels")
          .withIndex("by_linkCode", (q) => q.eq("linkCode", code))
          .first()
      : null;
    await ctx.db.insert("funnelEvents", {
      type: "link_tap",
      actor: "anon",
      refLinkCode: code || undefined,
      refChallengerId: duel?.challengerId,
      ts: Date.now(),
      meta: duel ? { duelId: duel._id } : undefined,
    });
  },
});

export const getCachedCard = internalQuery({
  args: { linkCode: v.string(), variant: v.string() },
  handler: async (ctx, { linkCode, variant }) => {
    const row = await ctx.db
      .query("duelShareCards")
      .withIndex("by_link_variant", (q) =>
        q.eq("linkCode", linkCode).eq("variant", variant),
      )
      .first();
    return row?.storageId ?? null;
  },
});

export const rememberCachedCard = internalMutation({
  args: {
    linkCode: v.string(),
    variant: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { linkCode, variant, storageId }) => {
    const existing = await ctx.db
      .query("duelShareCards")
      .withIndex("by_link_variant", (q) =>
        q.eq("linkCode", linkCode).eq("variant", variant),
      )
      .first();
    if (existing) return;
    await ctx.db.insert("duelShareCards", {
      linkCode,
      variant,
      storageId,
      createdAt: Date.now(),
    });
  },
});
