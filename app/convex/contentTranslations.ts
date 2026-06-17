import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { isStandardMcqQuestion } from "./lib/mcqEligibility";

/**
 * Phase 4.2 — backfill ops for quizQuestionTranslations (the per-locale DISPLAY
 * overlay; see docs/I18N_CONTENT_DESIGN.md). These are internal (admin/backfill)
 * functions; the runtime serve path lives in lib/contentI18n.ts.
 */

/**
 * Idempotent upsert of one (checksum, locale) translation. Guards at write time
 * that `options.length` matches the canonical question — the invariant the serve
 * helper relies on to keep the localized label ↔ canonical value mapping aligned.
 * A mismatched or orphaned (no canonical) row is rejected, so a bad translation
 * can never mis-submit answers.
 */
export const upsertQuestionTranslation = internalMutation({
  args: {
    checksum: v.string(),
    locale: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    explanation: v.optional(v.string()),
    source: v.union(v.literal("llm"), v.literal("human")),
    reviewed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const canonical = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", args.checksum))
      .first();
    if (!canonical) {
      throw new Error(`No canonical question for checksum ${args.checksum}`);
    }
    if (args.options.length !== canonical.options.length) {
      throw new Error(
        `Option count mismatch for ${args.checksum}: translation has ${args.options.length}, canonical has ${canonical.options.length}`,
      );
    }
    const doc = {
      checksum: args.checksum,
      locale: args.locale,
      question: args.question,
      options: args.options,
      explanation: args.explanation,
      source: args.source,
      reviewed: args.reviewed ?? false,
      updatedAt: Date.now(),
    };
    const existing = await ctx.db
      .query("quizQuestionTranslations")
      .withIndex("by_checksum_locale", (q) =>
        q.eq("checksum", args.checksum).eq("locale", args.locale),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return { upserted: "updated" as const };
    }
    await ctx.db.insert("quizQuestionTranslations", doc);
    return { upserted: "inserted" as const };
  },
});

/**
 * Returns a batch of MCQ questions still missing a translation for `locale`,
 * plus overall coverage counts — drives the backfill loop (call repeatedly until
 * `remaining` is 0). Returns the canonical question/options (the order the
 * translation must be aligned to) + explanation.
 */
export const listUntranslatedMcq = internalQuery({
  args: { locale: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { locale, limit }) => {
    const all = await ctx.db.query("quizQuestions").collect();
    const mcq = all.filter(isStandardMcqQuestion);

    const translatedChecksums = new Set<string>();
    for (const tr of await ctx.db.query("quizQuestionTranslations").collect()) {
      if (tr.locale === locale) translatedChecksums.add(tr.checksum);
    }

    const untranslated = mcq.filter((q) => !translatedChecksums.has(q.checksum));
    return {
      locale,
      totalMcq: mcq.length,
      translated: mcq.length - untranslated.length,
      remaining: untranslated.length,
      batch: untranslated.slice(0, limit ?? 50).map((q) => ({
        checksum: q.checksum,
        question: q.question,
        options: q.options,
        explanation: q.explanation ?? null,
        category: q.category,
      })),
    };
  },
});
