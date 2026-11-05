import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { CLIENT_SPORTS } from "./lib/sports";
import {
  isPlayableInMode,
  QUIZ_CATALOG_DIFFICULTIES,
  QUIZ_CATALOG_MODES,
  toCatalogEntries,
  writeCatalog,
} from "./lib/questionCatalog";

/** Rebuild one slice's catalog (one slice collect — the cost createSession used to pay per run). */
export const rebuildSlice = internalMutation({
  args: { sport: v.string(), mode: v.string(), difficulty: v.string() },
  handler: async (ctx, { sport, mode, difficulty }) => {
    const rows = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", sport).eq("difficulty", difficulty as "easy" | "intermediate" | "hard"),
      )
      .collect();
    return writeCatalog(ctx, sport, mode, difficulty, toCatalogEntries(rows.filter((r) => isPlayableInMode(r, mode))));
  },
});

/** Manual/ops: one scheduled rebuild per slice, so no single run reads every question. */
export const rebuildAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    let scheduled = 0;
    for (const sport of CLIENT_SPORTS) {
      for (const mode of QUIZ_CATALOG_MODES) {
        // came_first always plays the intermediate pool (quizSessions.sessionDifficulty).
        const difficulties = mode === "came_first" ? (["intermediate"] as const) : QUIZ_CATALOG_DIFFICULTIES;
        for (const difficulty of difficulties) {
          await ctx.scheduler.runAfter(0, internal.questionCatalog.rebuildSlice, { sport, mode, difficulty });
          scheduled++;
        }
      }
    }
    return { scheduled };
  },
});
