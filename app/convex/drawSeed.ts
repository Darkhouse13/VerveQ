/**
 * THE DRAW — pinned serving content + ops surface (internal only).
 *
 * The engine (app/src/lib/drawEngine, CONTRACT v1.0, frozen) is imported,
 * never modified. This module pins WHAT is served:
 *   - DRAW_CONFIGS: the accepted EngineConfig per configVersion, mapping a
 *     version string to a config module. The knobs themselves live in
 *     drawEngine/configs/ (Ticket C, Step 1) — a single durable copy shared
 *     with the LocalMockApi, so the mock and the server can never drift.
 *     A retune is a NEW config module + a new version key here, never an edit
 *     of an existing one (historical boards are pinned by configVersion).
 *   - DRAW_CARD_SET_SEED: the pinned synthetic generator seed. "accept-0.3
 *     |cards0" is set 0 of the acceptance rotation (ground-truthed 0.0% dead
 *     in the 0.3 oracle sample — the reroll chain stays shallow).
 *
 * A future real CIE card set is a reseed under a new setVersion via
 * seedSyntheticCards' successor + updateSettings — zero code change here
 * beyond registering the set.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { formHint, generateCardSet, type EngineConfig, type PositionId } from "../src/lib/drawEngine";
import { C13V1_CONFIG, C13V1_CONFIG_VERSION } from "../src/lib/drawEngine/configs/c13v1";
import { C13V2_CONFIG, C13V2_CONFIG_VERSION } from "../src/lib/drawEngine/configs/c13v2";
// The committed real card set (selector artifact; byte-guarded by
// drawCardSetSelectorContract). Bundled at deploy time — the DB seed is a
// FULL SYNC of this file under DRAW_REAL_SET_VERSION.
import realCards from "./data/drawCardsReal.candidates.json";

/** Row shape of drawCardsReal.candidates.json (E5 seeding reads a subset). */
interface RealCandidateCard {
  cardId: string;
  name: string;
  rating: number;
  clubs: { tag: string; displayCode: string; fullName: string }[];
  nation: string;
  eraLabel: string;
  eraIndex: number;
  position: PositionId;
  fameRank: number;
}

export const DRAW_SET_VERSION = "synthetic-v1";
export const DRAW_REAL_SET_VERSION = "real-v4";
export const DRAW_CARD_SET_SEED = "accept-0.3|cards0";
// Ticket G3 — c13-2 (engine v1.1 hints + clearance buckets, accepted 13/13
// under profile v1.2) is the ACTIVE config for new settings and new boards.
// c13-1 stays registered: historical drawDailyBoards rows pin it by
// configVersion and must replay forever.
export const DRAW_CONFIG_VERSION = C13V2_CONFIG_VERSION;

const DRAW_CONFIGS: Record<string, EngineConfig> = {
  [C13V1_CONFIG_VERSION]: C13V1_CONFIG,
  [C13V2_CONFIG_VERSION]: C13V2_CONFIG,
};

/** The currently pinned serving config (read-only export for scripts/tests). */
export const DRAW_ACTIVE_CONFIG: EngineConfig = C13V2_CONFIG;

export function resolveDrawConfig(configVersion: string): EngineConfig {
  const config = DRAW_CONFIGS[configVersion];
  if (!config) {
    throw new Error(`Unknown draw configVersion "${configVersion}"`);
  }
  return config;
}

/**
 * Seed the pinned synthetic card set (idempotent upsert by setVersion +
 * cardId) and ensure the drawSettings singleton exists — created DISABLED
 * with no testers, so seeding never opens the mode by itself.
 * Run: npx convex run drawSeed:seedSyntheticCards
 */
export const seedSyntheticCards = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cards = generateCardSet(DRAW_CARD_SET_SEED, C13V1_CONFIG.cardGen);
    let inserted = 0;
    let updated = 0;
    for (const card of cards) {
      const row = {
        cardId: card.id,
        name: card.name,
        rating: card.rating,
        clubs: card.clubs,
        nation: card.nation,
        era: card.era,
        eraIndex: card.eraIndex,
        position: card.position,
        setVersion: DRAW_SET_VERSION,
        synthetic: true,
      };
      const existing = await ctx.db
        .query("drawCards")
        .withIndex("by_setVersion_cardId", (q) =>
          q.eq("setVersion", DRAW_SET_VERSION).eq("cardId", card.id),
        )
        .first();
      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated += 1;
      } else {
        await ctx.db.insert("drawCards", row);
        inserted += 1;
      }
    }

    const settings = await ctx.db.query("drawSettings").first();
    let settingsCreated = false;
    if (!settings) {
      await ctx.db.insert("drawSettings", {
        enabled: false,
        testerUserIds: [],
        activeSetVersion: DRAW_SET_VERSION,
        configVersion: DRAW_CONFIG_VERSION,
      });
      settingsCreated = true;
    }

    return {
      setVersion: DRAW_SET_VERSION,
      cardSetSeed: DRAW_CARD_SET_SEED,
      inserted,
      updated,
      settingsCreated,
    };
  },
});

/**
 * Ticket E5 — seed the REAL card set from the committed selector artifact
 * (app/convex/data/drawCardsReal.candidates.json, built + guarded by
 * scripts/buildDrawCardSet.ts). FULL SYNC by (setVersion, cardId): upserts
 * every committed card and deletes stale rows of this setVersion, so the DB
 * set always equals the committed artifact exactly. Seeding never activates
 * anything — activeSetVersion switches only via updateSettings.
 * Run: npx tsx scripts/seedDrawCards.ts --set real-v4 --execute
 */
export const seedRealCards = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    const incoming = new Set<string>();
    for (const card of realCards as unknown as RealCandidateCard[]) {
      incoming.add(card.cardId);
      const row = {
        cardId: card.cardId,
        name: card.name,
        rating: card.rating,
        clubs: card.clubs.map((c) => c.tag),
        nation: card.nation,
        era: card.eraLabel,
        eraIndex: card.eraIndex,
        position: card.position,
        setVersion: DRAW_REAL_SET_VERSION,
        synthetic: false,
      };
      const existing = await ctx.db
        .query("drawCards")
        .withIndex("by_setVersion_cardId", (q) =>
          q.eq("setVersion", DRAW_REAL_SET_VERSION).eq("cardId", card.cardId),
        )
        .first();
      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated += 1;
      } else {
        await ctx.db.insert("drawCards", row);
        inserted += 1;
      }
    }
    const rows = await ctx.db
      .query("drawCards")
      .withIndex("by_setVersion", (q) => q.eq("setVersion", DRAW_REAL_SET_VERSION))
      .collect();
    for (const row of rows) {
      if (!incoming.has(row.cardId)) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return {
      setVersion: DRAW_REAL_SET_VERSION,
      cards: incoming.size,
      inserted,
      updated,
      deleted,
    };
  },
});

/**
 * Ops toggle for the flag gate. Never touched by gameplay code paths.
 *   npx convex run drawSeed:updateSettings '{"enabled": true}'
 *   npx convex run drawSeed:updateSettings '{"addTesterUserId": "<users id>"}'
 */
export const updateSettings = internalMutation({
  args: {
    enabled: v.optional(v.boolean()),
    activeSetVersion: v.optional(v.string()),
    configVersion: v.optional(v.string()),
    addTesterUserId: v.optional(v.id("users")),
    removeTesterUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("drawSettings").first();
    if (!settings) {
      throw new Error("drawSettings missing — run drawSeed:seedSyntheticCards first");
    }
    if (args.configVersion !== undefined) {
      resolveDrawConfig(args.configVersion); // throws on unknown version
    }
    if (args.activeSetVersion !== undefined) {
      const anyCard = await ctx.db
        .query("drawCards")
        .withIndex("by_setVersion", (q) => q.eq("setVersion", args.activeSetVersion!))
        .first();
      if (!anyCard) {
        throw new Error(`No drawCards seeded for setVersion "${args.activeSetVersion}"`);
      }
    }
    let testerUserIds = settings.testerUserIds;
    if (args.addTesterUserId && !testerUserIds.includes(args.addTesterUserId)) {
      testerUserIds = [...testerUserIds, args.addTesterUserId];
    }
    if (args.removeTesterUserId) {
      testerUserIds = testerUserIds.filter((id) => id !== args.removeTesterUserId);
    }
    await ctx.db.patch(settings._id, {
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
      ...(args.activeSetVersion !== undefined
        ? { activeSetVersion: args.activeSetVersion }
        : {}),
      ...(args.configVersion !== undefined
        ? { configVersion: args.configVersion }
        : {}),
      testerUserIds,
    });
    return await ctx.db.get(settings._id);
  },
});

/**
 * Ticket G3 — ops proof of what the serving layer would publish, without the
 * auth gate getToday sits behind: the active configVersion, the published
 * hint/clearance rules, today's board pin, and a sample hint computed the
 * same way runView's hintsView does. Read-only; leaks bucket strings only
 * (never the seed value itself in a meaningful form — the boardSeed is
 * internal already and is NOT returned here).
 * Run: npx convex run drawSeed:previewServing
 */
export const previewServing = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("drawSettings").first();
    if (!settings) return { settings: null };
    const config = resolveDrawConfig(settings.configVersion);
    const today = new Date().toISOString().slice(0, 10);
    const board = await ctx.db
      .query("drawDailyBoards")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", today))
      .first();
    const firstCardId = board?.board.rows[0]?.[0]?.id ?? null;
    return {
      enabled: settings.enabled,
      configVersion: settings.configVersion,
      activeSetVersion: settings.activeSetVersion,
      publishedRules: {
        formSpread: config.formSpread,
        thresholds: config.thresholds,
        hintReliability: config.hints?.hintReliability ?? null,
        clearance: config.clearance ?? null,
      },
      todayBoard: board
        ? {
            dateKey: board.dateKey,
            configVersion: board.configVersion,
            setVersion: board.setVersion,
            rerollIndex: board.rerollIndex,
            sliceCardCount: board.sliceCardIds?.length ?? null,
            sampleHint:
              config.hints && firstCardId
                ? {
                    cardId: firstCardId,
                    fixtureIndex: 0,
                    hint: formHint(
                      board.boardSeed,
                      firstCardId,
                      0,
                      config.hints.hintReliability,
                    ),
                  }
                : null,
          }
        : null,
    };
  },
});

/** Ops readout: npx convex run drawSeed:showSettings */
export const showSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("drawSettings").first();
    const cardCount = settings
      ? (
          await ctx.db
            .query("drawCards")
            .withIndex("by_setVersion", (q) =>
              q.eq("setVersion", settings.activeSetVersion),
            )
            .collect()
        ).length
      : 0;
    return { settings, activeSetCardCount: cardCount };
  },
});
