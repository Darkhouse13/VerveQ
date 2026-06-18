import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { isStandardMcqQuestion } from "./lib/mcqEligibility";
import { orderAnswerOptions } from "./lib/answerOptions";
import {
  composeLocalizedQuestion,
  fetchQuestionTranslation,
} from "./lib/contentI18n";

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

/**
 * Verification helper — reproduces exactly what the runtime serve paths return
 * for a question in `locale` (orderAnswerOptions + fetchQuestionTranslation +
 * composeLocalizedQuestion). Confirms the display is localized AND `optionValues`
 * stay canonical (so grading is unaffected), without needing a live game session.
 */
export const previewLocalized = internalQuery({
  args: { checksum: v.string(), locale: v.string() },
  handler: async (ctx, { checksum, locale }) => {
    const q = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (x) => x.eq("checksum", checksum))
      .first();
    if (!q) return null;
    const orderedValues = orderAnswerOptions(q.options, q.correctAnswer, q.checksum);
    const translation = await fetchQuestionTranslation(ctx, checksum, locale);
    const localized = composeLocalizedQuestion(q, orderedValues, translation);
    return {
      locale,
      hasTranslation: translation !== null,
      correctAnswer: q.correctAnswer,
      ...localized,
    };
  },
});

/**
 * P4.4 QA — per-locale translation coverage + integrity, read-only. Reports, for
 * each requested locale, how many standard MCQ have a translation (coverage %),
 * the reviewed/unreviewed split, and flags two integrity problems:
 *   - `orphans`: translation rows whose checksum no longer exists in any
 *     `quizQuestions` row (the question was deleted/edited → stale row).
 *   - `nonMcqTargets`: rows whose checksum exists but is not a standard MCQ
 *     (translation can never be served → likely mis-targeted).
 * Drives a CI/ops health check; complements `listUntranslatedMcq` (the backfill
 * driver). Default locales fr+es.
 */
export const translationCoverageReport = internalQuery({
  args: { locales: v.optional(v.array(v.string())) },
  handler: async (ctx, { locales }) => {
    const targetLocales = locales ?? ["fr", "es"];
    const allQuestions = await ctx.db.query("quizQuestions").collect();
    const mcqChecksums = new Set(
      allQuestions.filter(isStandardMcqQuestion).map((q) => q.checksum),
    );
    const anyChecksums = new Set(allQuestions.map((q) => q.checksum));
    const totalMcq = mcqChecksums.size;

    const translations = await ctx.db.query("quizQuestionTranslations").collect();

    const perLocale: Record<
      string,
      { translated: number; remaining: number; coveragePct: number; reviewed: number; unreviewed: number }
    > = {};
    for (const locale of targetLocales) {
      perLocale[locale] = {
        translated: 0,
        remaining: totalMcq,
        coveragePct: 0,
        reviewed: 0,
        unreviewed: 0,
      };
    }

    const orphans: Array<{ checksum: string; locale: string }> = [];
    const nonMcqTargets: Array<{ checksum: string; locale: string }> = [];

    for (const tr of translations) {
      if (!anyChecksums.has(tr.checksum)) {
        orphans.push({ checksum: tr.checksum, locale: tr.locale });
        continue;
      }
      if (!mcqChecksums.has(tr.checksum)) {
        nonMcqTargets.push({ checksum: tr.checksum, locale: tr.locale });
        continue;
      }
      const bucket = perLocale[tr.locale];
      if (!bucket) continue; // a locale outside the requested set
      bucket.translated += 1;
      if (tr.reviewed) bucket.reviewed += 1;
      else bucket.unreviewed += 1;
    }

    for (const locale of targetLocales) {
      const b = perLocale[locale];
      b.remaining = Math.max(0, totalMcq - b.translated);
      b.coveragePct = totalMcq === 0 ? 100 : Math.round((b.translated / totalMcq) * 1000) / 10;
    }

    return {
      totalMcq,
      locales: perLocale,
      orphans: { count: orphans.length, sample: orphans.slice(0, 25) },
      nonMcqTargets: { count: nonMcqTargets.length, sample: nonMcqTargets.slice(0, 25) },
      ok: orphans.length === 0 && nonMcqTargets.length === 0,
    };
  },
});

