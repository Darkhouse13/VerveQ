import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedBatch = mutation({
  args: {
    questions: v.array(
      v.object({
        sport: v.string(),
        category: v.string(),
        question: v.string(),
        options: v.array(v.string()),
        correctAnswer: v.string(),
        explanation: v.optional(v.string()),
        difficulty: v.union(
          v.literal("easy"),
          v.literal("intermediate"),
          v.literal("hard"),
        ),
        bucket: v.string(),
        checksum: v.string(),
      }),
    ),
  },
  handler: async (ctx, { questions }) => {
    let inserted = 0;
    for (const q of questions) {
      const existing = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (qb) => qb.eq("checksum", q.checksum))
        .first();

      if (!existing) {
        await ctx.db.insert("quizQuestions", {
          ...q,
          difficultyVotes: 0,
          difficultyScore: 0,
          timesAnswered: 0,
          timesCorrect: 0,
          usageCount: 0,
        });
        inserted++;
      }
    }
    return { inserted };
  },
});
