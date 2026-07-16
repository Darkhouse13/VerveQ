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
import { generateCardSet, type EngineConfig } from "../src/lib/drawEngine";
import { C13V1_CONFIG, C13V1_CONFIG_VERSION } from "../src/lib/drawEngine/configs/c13v1";

export const DRAW_SET_VERSION = "synthetic-v1";
export const DRAW_CARD_SET_SEED = "accept-0.3|cards0";
export const DRAW_CONFIG_VERSION = C13V1_CONFIG_VERSION;

const DRAW_CONFIGS: Record<string, EngineConfig> = {
  [C13V1_CONFIG_VERSION]: C13V1_CONFIG,
};

/** The currently pinned serving config (read-only export for scripts/tests). */
export const DRAW_ACTIVE_CONFIG: EngineConfig = C13V1_CONFIG;

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
