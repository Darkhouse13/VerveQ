/**
 * Weekend Fantasy scoring validators (FW-4) — ONE definition, three consumers.
 *
 * `schema.ts` builds the pipeline's tables out of these, `fantasyScores.ts`
 * validates the ingest mutation's arguments with the same objects, and
 * `lib/fantasyScorePipeline.ts` asserts at compile time that
 * `fantasyPlayerStatsValidator` still describes the engine's `PlayerMatchStats`
 * exactly. A stat added to one and not the others is a compile error rather than
 * a stat the feed carries, the table stores, and the engine never sees.
 *
 * They live in `lib/` rather than in `schema.ts` so that a function module can
 * reach them without importing the whole schema — which drags in `authTables`
 * and, with it, the auth package that every handler suite mocks.
 */

import { v } from "convex/values";

export const fantasySlot = v.union(
  v.literal("GK"),
  v.literal("DEF"),
  v.literal("MID"),
  v.literal("ATT"),
);

/**
 * One player's aggregate line for one fixture, every field a COUNT.
 *
 * Mirrors SCORING_SPEC v0.5.1 design principle 3 — only stats the feed was
 * measured to carry. `passesAccurate` is the feed's `passes.accuracy`, which is
 * an accurate-pass count shipped as a string despite the name (measured: 22 of
 * 26 on probe fixture 1208061); `ownGoals` comes from the timed-events feed
 * because the stat line does not carry it.
 */
export const fantasyPlayerStatsValidator = v.object({
  minutes: v.number(),
  goals: v.number(),
  assists: v.number(),
  shotsTotal: v.number(),
  shotsOn: v.number(),
  keyPasses: v.number(),
  passesTotal: v.number(),
  passesAccurate: v.number(),
  dribblesAttempted: v.number(),
  dribblesCompleted: v.number(),
  tackles: v.number(),
  interceptions: v.number(),
  blocks: v.number(),
  duelsTotal: v.number(),
  duelsWon: v.number(),
  foulsCommitted: v.number(),
  foulsDrawn: v.number(),
  yellowCards: v.number(),
  redCards: v.number(),
  saves: v.number(),
  penaltiesWon: v.number(),
  penaltiesConceded: v.number(),
  penaltiesScored: v.number(),
  penaltiesMissed: v.number(),
  penaltiesSaved: v.number(),
  ownGoals: v.number(),
  wasSubstitute: v.boolean(),
});

/** A timed event, clock-placed. Only these categories carry a minute. */
export const fantasyTimedEventValidator = v.object({
  minute: v.number(),
  kind: v.union(
    v.literal("goal"),
    v.literal("assist"),
    v.literal("yellowCard"),
    v.literal("redCard"),
    v.literal("ownGoal"),
    v.literal("penaltyWon"),
    v.literal("penaltyConceded"),
    v.literal("penaltyMissed"),
    v.literal("penaltySaved"),
  ),
});
