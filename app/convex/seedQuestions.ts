import {
  internalMutation,
  internalAction,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { knowledgeQuestions } from "./knowledgeQuestions";
import { footballRecordsQuestions } from "./footballRecordsQuestions";
import { footballTriviaExpansion } from "./footballTriviaExpansionV1";
import { basketballTriviaExpansion } from "./basketballTriviaExpansionV1";
import { tennisTriviaExpansion } from "./tennisTriviaExpansionV1";
import { scienceQuestions } from "./scienceQuestionsV1";
import { worldHistoryQuestions } from "./worldHistoryQuestionsV1";
import { moviesTvQuestions } from "./moviesTvQuestionsV1";
import { musicQuestions } from "./musicQuestionsV1";
import { videoGamesQuestions } from "./videoGamesQuestionsV1";

export const clearAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("quizQuestions").collect();
    for (const q of questions) {
      await ctx.db.delete(q._id);
    }
    return { deleted: questions.length };
  },
});

export const seedBatch = internalMutation({
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


export const seedKnowledgeQuestions = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;

    for (const q of knowledgeQuestions) {
      const existing = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (qb) => qb.eq("checksum", q.checksum))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

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

    return { inserted, skipped, total: knowledgeQuestions.length };
  },
});

// Football all-time RECORDS question bank (transfers, all-time scorers, titles,
// continental/club competitions, individual records & awards). Deduped against the
// live pool at build time; this also skips by checksum so re-runs are idempotent.
export const seedFootballRecordsQuestions = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;

    for (const q of footballRecordsQuestions) {
      const existing = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (qb) => qb.eq("checksum", q.checksum))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

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

    return { inserted, skipped, total: footballRecordsQuestions.length };
  },
});

// Sports text-trivia expansions (football/basketball/tennis). Web-researched,
// adversarially fact-verified, content-QA clean (0 ERRORs), and deduped against
// the live pool at build time. Each skips by checksum so re-runs are idempotent.
const seedTriviaBank = async (
  ctx: MutationCtx,
  bank: ReadonlyArray<{
    sport: string;
    category: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    difficulty: "easy" | "intermediate" | "hard";
    bucket: string;
    checksum: string;
  }>,
) => {
  let inserted = 0;
  let skipped = 0;
  for (const q of bank) {
    const existing = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (qb) => qb.eq("checksum", q.checksum))
      .first();
    if (existing) {
      skipped++;
      continue;
    }
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
  return { inserted, skipped, total: bank.length };
};

export const seedFootballTriviaExpansion = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, footballTriviaExpansion),
});

export const seedBasketballTriviaExpansion = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, basketballTriviaExpansion),
});

export const seedTennisTriviaExpansion = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, tennisTriviaExpansion),
});

// New Arena subjects (sport "knowledge", dedicated category each). Generated +
// independently fact-verified, deduped, content-QA clean (0 ERRORs). Idempotent
// by checksum.
export const seedScienceQuestions = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, scienceQuestions),
});

export const seedWorldHistoryQuestions = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, worldHistoryQuestions),
});

export const seedMoviesTvQuestions = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, moviesTvQuestions),
});

export const seedMusicQuestions = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, musicQuestions),
});

export const seedVideoGamesQuestions = internalMutation({
  args: {},
  handler: async (ctx) => seedTriviaBank(ctx, videoGamesQuestions),
});

// ── Image question seeding ───────────────────────────────────────────────────

export const insertImageQuestion = internalMutation({
  args: {
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
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (qb) => qb.eq("checksum", args.checksum))
      .first();

    if (existing) return { inserted: false };

    await ctx.db.insert("quizQuestions", {
      ...args,
      difficultyVotes: 0,
      difficultyScore: 0,
      timesAnswered: 0,
      timesCorrect: 0,
      usageCount: 0,
    });
    return { inserted: true };
  },
});

export const seedImageBatch = internalAction({
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
        imageUrl: v.string(),
      }),
    ),
  },
  handler: async (ctx, { questions }) => {
    let inserted = 0;
    let failed = 0;

    for (const { imageUrl, ...questionData } of questions) {
      try {
        // Download image from external URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch image: ${imageUrl} (${response.status})`);
          failed++;
          continue;
        }

        const blob = await response.blob();
        const storageId = await ctx.storage.store(blob);

        const result = await ctx.runMutation(
          internal.seedQuestions.insertImageQuestion,
          { ...questionData, imageId: storageId },
        );

        if (result.inserted) inserted++;
      } catch (err) {
        console.warn(`Error processing question "${questionData.checksum}":`, err);
        failed++;
      }
    }

    return { inserted, failed };
  },
});

// ── One-time migration mutations ─────────────────────────────────────────────

/** Set all badge_identification questions to difficulty "easy". Run once. */
export const fixBadgeDifficulty = internalMutation({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("quizQuestions").collect();
    let updated = 0;
    for (const q of questions) {
      if (q.category === "badge_identification" && q.difficulty !== "easy") {
        await ctx.db.patch(q._id, {
          difficulty: "easy" as const,
          bucket: q.bucket.replace(/_(intermediate|hard)_/, "_easy_"),
        });
        updated++;
      }
    }
    return { updated };
  },
});

/** Clear explanation from all image questions. Run once. */
export const clearImageExplanations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("quizQuestions").collect();
    let updated = 0;
    for (const q of questions) {
      if (q.imageId && q.explanation) {
        await ctx.db.patch(q._id, { explanation: undefined });
        updated++;
      }
    }
    return { updated };
  },
});
