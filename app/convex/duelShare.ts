import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  buildShareCardTexts,
  cardVariantToken,
  GENERIC_CARD_KEY,
  type ShareCardData,
} from "./lib/duelShareCard";
import { captureServerEvent } from "./lib/posthogServer";

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

/**
 * share_link_opened — a real human opened a /s/d/ link.
 *
 * Scheduled fire-and-forget from the share route (like warmCard) rather than
 * awaited inline: the human is mid-302, and a round trip to PostHog must not
 * sit between the tap and the game.
 *
 * Fires ONLY for non-crawlers — the route's existing user-agent check owns
 * that split, so a WhatsApp/Slack unfurl prefetch can never be counted as a
 * person opening the link.
 *
 * distinct_id is minted per open and cannot stitch to the opener's browser id:
 * the SPA never runs on this surface, and persistence is localStorage, so
 * there is no cookie to read server-side. Person processing is off for exactly
 * that reason. Whether the open led to a game is answered by joining link_code
 * to the /duel/:linkCode landing at analysis time — deliberately not asserted
 * here, where it would be a guess.
 */
export const captureShareLinkOpened = internalAction({
  args: { linkCode: v.string(), openId: v.string() },
  handler: async (_ctx, { linkCode, openId }) => {
    await captureServerEvent("share_link_opened", `share_open_${openId}`, {
      mode: "duel",
      link_code: linkCode,
      origin: "server",
      is_crawler: false,
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

const EMPTY_CARD_DATA: ShareCardData = {
  found: false,
  challengerName: null,
  challengerScore: null,
};

// Resolve-or-render the card PNG for the link's CURRENT variant, filling the
// storage cache on a miss. Returns the bytes (for the http route) or null if
// the renderer is unavailable — never throws. Shared by the on-demand image
// route and the warmCard pre-render below.
export async function ensureShareCardCached(
  ctx: ActionCtx,
  linkCode: string,
): Promise<Blob | ArrayBuffer | null> {
  let data: ShareCardData;
  try {
    data = await ctx.runQuery(internal.duelShare.getShareCardData, {
      linkCode,
    });
  } catch {
    data = EMPTY_CARD_DATA;
  }
  const texts = buildShareCardTexts(data);
  const cacheKey = data.found ? linkCode : GENERIC_CARD_KEY;
  const variant = cardVariantToken(cacheKey, data.challengerScore);

  try {
    const cachedId = await ctx.runQuery(internal.duelShare.getCachedCard, {
      linkCode: cacheKey,
      variant,
    });
    if (cachedId) {
      const blob = await ctx.storage.get(cachedId);
      if (blob) return blob;
    }
  } catch {
    // Cache miss path below regenerates.
  }

  try {
    const png: ArrayBuffer = await ctx.runAction(
      internal.duelShareCardNode.renderCard,
      { line1: texts.line1, line2: texts.line2, accent: texts.accent },
    );
    try {
      const storageId = await ctx.storage.store(
        new Blob([png], { type: "image/png" }),
      );
      await ctx.runMutation(internal.duelShare.rememberCachedCard, {
        linkCode: cacheKey,
        variant,
        storageId,
      });
    } catch {
      // Serving the freshly rendered bytes matters more than caching them.
    }
    return png;
  } catch {
    return null;
  }
}

// Pre-render the card for a link's current variant so crawler og:image
// fetches always hit the warm cache (~150ms) instead of a cold render
// (~3-4s, which pushes WhatsApp past its preview-fetch timeout and degrades
// the unfurl to the small thumbnail). Scheduled fire-and-forget from duel
// creation and challenger completion; a failure here just means the http
// route renders on demand as before.
export const warmCard = internalAction({
  args: { linkCode: v.string() },
  handler: async (ctx, { linkCode }) => {
    await ensureShareCardCached(ctx, linkCode);
  },
});
