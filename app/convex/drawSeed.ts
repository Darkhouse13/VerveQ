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
import {
  formHint,
  generateBoard,
  generateCardSet,
  replay,
  type ChoiceLog,
  type EngineConfig,
  type PositionId,
} from "../src/lib/drawEngine";
import { loadCardSet } from "./drawBoards";
import { boardNumberForDate } from "./lib/drawDaily";
import { C13V1_CONFIG, C13V1_CONFIG_VERSION } from "../src/lib/drawEngine/configs/c13v1";
import { C13V2_CONFIG, C13V2_CONFIG_VERSION } from "../src/lib/drawEngine/configs/c13v2";
// The committed real card set. Bundled at deploy time — the DB seed is a
// FULL SYNC of this file under DRAW_REAL_SET_VERSION.
//
// Ticket E5-F — real-v5 is the editorial-rating pass (docs/RATING_ANCHORS.md):
// v4 ratings + 12 position moves replaced, all other CIE facts byte-identical.
// It ships as a NEW setVersion, additive alongside real-v4 (whose DB rows and
// board replay-identity are pinned forever). The v4 artifact and its byte-exact
// generator contract (drawDataRulesContract) are untouched.
import realCards from "./data/drawCardsReal.candidates.v5.json";

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
// Ticket E5-F: the editorial-rating set. Additive — real-v4 rows stay in the
// DB and keep serving any historical board pinned to them.
export const DRAW_REAL_SET_VERSION = "real-v5";
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
 * Ticket E5 — seed the REAL card set from the committed artifact
 * (app/convex/data/drawCardsReal.candidates.v5.json). FULL SYNC by
 * (setVersion, cardId): upserts every committed card and deletes stale rows of
 * THIS setVersion only, so the DB set for real-v5 always equals the committed
 * artifact exactly and real-v4 rows are never touched. Seeding never activates
 * anything — activeSetVersion switches only via updateSettings.
 * Run: npx tsx scripts/seedDrawCards.ts --set real-v5 --execute
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
            // Same pure function getToday stamps on payloads — epoch proof.
            boardNumber: boardNumberForDate(board.dateKey),
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

/**
 * Ticket G3 — smoke verification for a date's runs (read-only). For every
 * run on the dateKey: regenerate the board from the row's PINNED slice ids +
 * configVersion (exactly the B2 replay-gate recipe), replay the stored
 * choiceLog, and compare outcome/score/rounds to the stored result. Also
 * counts draw_replay_reject funnel events for the date. Nothing is written.
 * Run: npx convex run drawSeed:verifySmokeRun '{"dateKey":"YYYY-MM-DD"}'
 */
export const verifySmokeRun = internalQuery({
  args: { dateKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const dateKey = args.dateKey ?? new Date().toISOString().slice(0, 10);
    const boardDoc = await ctx.db
      .query("drawDailyBoards")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .first();
    if (!boardDoc) return { dateKey, board: null, runs: [] };
    const config = resolveDrawConfig(boardDoc.configVersion);
    const fullSet = await loadCardSet(ctx, boardDoc.setVersion);
    let cardSet = fullSet;
    if (boardDoc.sliceCardIds) {
      const byId = new Map(fullSet.map((c) => [c.id, c]));
      cardSet = boardDoc.sliceCardIds.flatMap((id) => {
        const card = byId.get(id);
        return card ? [card] : [];
      });
    }
    const regenerated = generateBoard(boardDoc.boardSeed, cardSet, config);

    const runs = await ctx.db
      .query("drawRuns")
      .withIndex("by_date_score", (q) => q.eq("dateKey", dateKey))
      .collect();
    const reports = runs.map((run) => {
      let replayed: { finalScore: number; outcome: string; roundsCleared: number } | null = null;
      let replayError: string | null = null;
      try {
        const result = replay(regenerated, config, run.choiceLog as ChoiceLog);
        replayed = {
          finalScore: result.finalScore,
          outcome: result.outcome,
          roundsCleared: result.roundsCleared,
        };
      } catch (error) {
        replayError = error instanceof Error ? error.message : String(error);
      }
      const stored = run.result ?? null;
      const identical =
        replayed !== null &&
        stored !== null &&
        replayed.finalScore === stored.finalScore &&
        replayed.outcome === stored.outcome &&
        replayed.roundsCleared === stored.roundsCleared;
      return {
        status: run.status,
        score: run.score ?? null,
        roundsCleared: stored?.roundsCleared ?? null,
        draftLineHash: run.draftLineHash ?? null,
        choices: (run.choiceLog as unknown[]).length,
        completedAt: run.completedAt ?? null,
        replayIdentity: run.completedAt ? (identical ? "IDENTICAL" : "MISMATCH") : "in-progress",
        replayError,
        replayedScore: replayed?.finalScore ?? null,
      };
    });

    const rejects = (
      await ctx.db
        .query("funnelEvents")
        .withIndex("by_type_ts", (q) => q.eq("type", "draw_replay_reject"))
        .collect()
    ).filter((e) => (e.meta as { dateKey?: string })?.dateKey === dateKey);

    return {
      dateKey,
      board: {
        configVersion: boardDoc.configVersion,
        setVersion: boardDoc.setVersion,
        boardSeed: boardDoc.boardSeed.slice(0, 5) + "...", // scheme only, never the full seed in logs
        sliceCards: boardDoc.sliceCardIds?.length ?? null,
        hintsServed: Boolean(config.hints),
        clearanceServed: Boolean(config.clearance),
      },
      runs: reports,
      replayRejectEvents: rejects.length,
    };
  },
});

/**
 * Ops digest for a date's board (read-only, launch-day telemetry). Everything
 * is computed from stored rows — no engine replay, no writes:
 *  - started/completed run counts (started = row exists, completed = result);
 *  - outcome split over completed runs (banked/busted/fullclear, count + %);
 *  - median finalScore over completed runs;
 *  - rounds-cleared histogram (index 0..5) over completed runs;
 *  - push-rate after clears: of every post-clear decision in the choiceLogs
 *    (type "push" or "bank" — the only two ways a cleared round continues),
 *    the fraction that pushed;
 *  - share funnel: draw_share_view / draw_share_convert counts for the date.
 * Run: npx convex run drawSeed:dailyDigest '{"dateKey":"YYYY-MM-DD"}'
 */
export const dailyDigest = internalQuery({
  args: { dateKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const dateKey = args.dateKey ?? new Date().toISOString().slice(0, 10);
    const runs = await ctx.db
      .query("drawRuns")
      .withIndex("by_date_score", (q) => q.eq("dateKey", dateKey))
      .collect();
    const completed = runs.flatMap((run) =>
      run.completedAt !== undefined && run.result ? [{ run, result: run.result }] : [],
    );

    const outcomeCounts = { banked: 0, busted: 0, fullclear: 0 };
    const roundsClearedHistogram = [0, 0, 0, 0, 0, 0];
    const scores: number[] = [];
    let pushes = 0;
    let banks = 0;
    for (const { run, result } of completed) {
      outcomeCounts[result.outcome] += 1;
      roundsClearedHistogram[Math.min(result.roundsCleared, 5)] += 1;
      scores.push(result.finalScore);
      for (const choice of run.choiceLog) {
        if (choice.type === "push") pushes += 1;
        else if (choice.type === "bank") banks += 1;
      }
    }

    scores.sort((a, b) => a - b);
    const medianScore =
      scores.length === 0
        ? null
        : scores.length % 2 === 1
          ? scores[(scores.length - 1) / 2]
          : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2;
    const pct = (n: number) =>
      completed.length === 0 ? null : Math.round((n / completed.length) * 1000) / 10;

    const shareCount = async (type: "draw_share_view" | "draw_share_convert") =>
      (
        await ctx.db
          .query("funnelEvents")
          .withIndex("by_type_ts", (q) => q.eq("type", type))
          .collect()
      ).filter((e) => (e.meta as { dateKey?: string } | undefined)?.dateKey === dateKey)
        .length;

    return {
      dateKey,
      runsStarted: runs.length,
      runsCompleted: completed.length,
      outcomes: {
        banked: { count: outcomeCounts.banked, pct: pct(outcomeCounts.banked) },
        busted: { count: outcomeCounts.busted, pct: pct(outcomeCounts.busted) },
        fullclear: { count: outcomeCounts.fullclear, pct: pct(outcomeCounts.fullclear) },
      },
      medianScore,
      roundsClearedHistogram,
      // pushes / (pushes + banks); null until any completed run decided.
      pushRateAfterClear:
        pushes + banks === 0 ? null : Math.round((pushes / (pushes + banks)) * 1000) / 10,
      shareViews: await shareCount("draw_share_view"),
      shareConverts: await shareCount("draw_share_convert"),
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
