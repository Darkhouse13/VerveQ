import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { composeLocalizedClues, fetchClueTranslation } from "./lib/contentI18n";

/**
 * Phase 4.3 — backfill ops for whoAmIClueTranslations (the per-locale DISPLAY
 * overlay for Who Am I clue prose; see docs/I18N_CONTENT_DESIGN.md). These are
 * internal (admin/backfill) functions; the runtime serve path lives in
 * convex/whoAmI.ts via lib/contentI18n.ts. The answer (a proper noun) and the
 * fuzzy matcher are never touched — only the 4 progressive clues translate.
 */

/**
 * Idempotent upsert of one (externalId, locale) clue translation. Guards at
 * write time that the canonical clue still exists — an orphaned row (no
 * canonical clue) is rejected so a translation can never reference a deleted
 * clue. `convex import` bypasses this guard, so the backfill validator
 * replicates it before importing in bulk.
 */
export const upsertClueTranslation = internalMutation({
  args: {
    externalId: v.string(),
    locale: v.string(),
    clue1: v.string(),
    clue2: v.string(),
    clue3: v.string(),
    clue4: v.string(),
    source: v.union(v.literal("llm"), v.literal("human")),
    reviewed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const canonical = await ctx.db
      .query("whoAmIApprovedClues")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .first();
    if (!canonical) {
      throw new Error(`No canonical clue for externalId ${args.externalId}`);
    }
    const doc = {
      externalId: args.externalId,
      locale: args.locale,
      clue1: args.clue1,
      clue2: args.clue2,
      clue3: args.clue3,
      clue4: args.clue4,
      source: args.source,
      reviewed: args.reviewed ?? false,
      updatedAt: Date.now(),
    };
    const existing = await ctx.db
      .query("whoAmIClueTranslations")
      .withIndex("by_externalId_locale", (q) =>
        q.eq("externalId", args.externalId).eq("locale", args.locale),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return { upserted: "updated" as const };
    }
    await ctx.db.insert("whoAmIClueTranslations", doc);
    return { upserted: "inserted" as const };
  },
});

/**
 * Returns a batch of approved Who Am I clues still missing a translation for
 * `locale`, plus overall coverage counts — drives the backfill loop (call
 * repeatedly until `remaining` is 0). Returns the canonical clue1..clue4 (the
 * prose to translate) + answerName (kept canonical, given as context so the
 * translator keeps the embedded name in that exact form).
 */
export const listUntranslatedClues = internalQuery({
  args: { locale: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { locale, limit }) => {
    const clues = await ctx.db.query("whoAmIApprovedClues").collect();

    const translatedIds = new Set<string>();
    for (const tr of await ctx.db.query("whoAmIClueTranslations").collect()) {
      if (tr.locale === locale) translatedIds.add(tr.externalId);
    }

    const untranslated = clues.filter((c) => !translatedIds.has(c.externalId));
    return {
      locale,
      totalClues: clues.length,
      translated: clues.length - untranslated.length,
      remaining: untranslated.length,
      batch: untranslated.slice(0, limit ?? 50).map((c) => ({
        externalId: c.externalId,
        sport: c.sport,
        difficulty: c.difficulty,
        answerName: c.answerName,
        clue1: c.clue1,
        clue2: c.clue2,
        clue3: c.clue3,
        clue4: c.clue4,
      })),
    };
  },
});

/**
 * Verification helper — reproduces exactly what the runtime serve paths return
 * for a clue set in `locale` (fetchClueTranslation + composeLocalizedClues).
 * Confirms the clue prose is localized AND answerName stays canonical (so
 * grading is unaffected), without needing a live game session.
 */
export const previewLocalizedClue = internalQuery({
  args: { externalId: v.string(), locale: v.string() },
  handler: async (ctx, { externalId, locale }) => {
    const clue = await ctx.db
      .query("whoAmIApprovedClues")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();
    if (!clue) return null;
    const translation = await fetchClueTranslation(ctx, externalId, locale);
    const localized = composeLocalizedClues(clue, translation);
    return {
      locale,
      hasTranslation: translation !== null,
      answerName: clue.answerName, // canonical — never localized
      ...localized,
    };
  },
});

/**
 * P4.3 QA — per-locale clue-translation coverage + integrity, read-only.
 * Mirrors contentTranslations.translationCoverageReport for the Who Am I clue
 * overlay. Reports per-locale coverage % + reviewed split and flags `orphans`
 * (translation rows whose externalId no longer exists in whoAmIApprovedClues).
 * Default locales fr+es.
 */
export const clueTranslationCoverageReport = internalQuery({
  args: { locales: v.optional(v.array(v.string())) },
  handler: async (ctx, { locales }) => {
    const targetLocales = locales ?? ["fr", "es"];
    const clues = await ctx.db.query("whoAmIApprovedClues").collect();
    const clueIds = new Set(clues.map((c) => c.externalId));
    const totalClues = clueIds.size;

    const translations = await ctx.db.query("whoAmIClueTranslations").collect();

    const perLocale: Record<
      string,
      { translated: number; remaining: number; coveragePct: number; reviewed: number; unreviewed: number }
    > = {};
    for (const locale of targetLocales) {
      perLocale[locale] = {
        translated: 0,
        remaining: totalClues,
        coveragePct: 0,
        reviewed: 0,
        unreviewed: 0,
      };
    }

    const orphans: Array<{ externalId: string; locale: string }> = [];

    for (const tr of translations) {
      if (!clueIds.has(tr.externalId)) {
        orphans.push({ externalId: tr.externalId, locale: tr.locale });
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
      b.remaining = Math.max(0, totalClues - b.translated);
      b.coveragePct = totalClues === 0 ? 100 : Math.round((b.translated / totalClues) * 1000) / 10;
    }

    return {
      totalClues,
      locales: perLocale,
      orphans: { count: orphans.length, sample: orphans.slice(0, 25) },
      ok: orphans.length === 0,
    };
  },
});
