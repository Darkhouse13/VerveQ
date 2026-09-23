import { query } from "./_generated/server";
import { v } from "convex/values";
import { getTodayUTC } from "./lib/daily";
import { resolveQuestionImageUrl } from "./lib/questionServe";

/**
 * Public archive of CLOSED daily quizzes, read at build time by the static SEO
 * layer (app/seo/build.mjs) to publish /football-quiz/<date>/ pages.
 *
 * Only days strictly before today (UTC) are returned: today's quiz is still
 * being played and its answers must never be public. The frozen
 * `questionSnapshots` are exactly what players were served that day, so the
 * archive can't drift from the game. No user data is read.
 */
const MAX_DAYS = 400;

export const dailyQuizArchive = query({
  args: { sport: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const sport = args.sport ?? "football";
    const today = getTodayUTC();
    const rows = await ctx.db
      .query("dailyChallenges")
      .withIndex("by_date_sport_mode", (q) => q.lt("date", today))
      .order("desc")
      .filter((q) => q.and(q.eq(q.field("sport"), sport), q.eq(q.field("mode"), "quiz")))
      .take(MAX_DAYS);

    const days = [];
    for (const row of rows) {
      const snapshots = row.questionSnapshots ?? [];
      if (snapshots.length === 0) continue;
      const questions = [];
      for (const s of snapshots) {
        // Difficulty lives on the bank row, not the frozen snapshot.
        const bank = await ctx.db
          .query("quizQuestions")
          .withIndex("by_checksum", (q) => q.eq("checksum", s.checksum))
          .first();
        questions.push({
          difficulty: bank?.difficulty ?? null,
          question: s.question,
          options: s.options,
          correctAnswer: s.correctAnswer,
          explanation: s.explanation ?? null,
          category: s.category,
          imageUrl: await resolveQuestionImageUrl(ctx, s),
        });
      }
      days.push({ date: row.date, questions });
    }
    return { today, days };
  },
});
