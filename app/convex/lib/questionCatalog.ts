/**
 * Per-slice quiz question catalog (perf/security loop, round 8).
 *
 * createSession used to collect the whole sport+difficulty slice (up to ~2k
 * full question docs) to plan a 10-question run. The catalog holds just the
 * playable checksums + an image flag for that slice, so planning reads ONE
 * small doc and the draw is exactly the same uniform-with-image-rules draw
 * (planQuestionSequence) over exactly the same eligible set. Freshness: rebuilt
 * hourly; a question added since is simply not drawn until then, and a
 * question deleted/edited out since is skipped at serve time (getQuestion
 * re-checks eligibility). Missing or oversized catalog → full collect fallback.
 *
 * Refresh is demand-driven (round 10): createSession writes a missing catalog
 * from the rows its fallback already collected, and schedules rebuildSlice when
 * the one it used is older than CATALOG_MAX_AGE_MS. An hourly cron re-reading
 * all 16 slices (~12.5k docs/h) cost far more than it saved at real ranked
 * volume; demand-driven rebuilds are never more than one per slice per hour
 * and never more than one per run, so they dominate both the cron and the old
 * per-run collect.
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isStandardMcqQuestion } from "./mcqEligibility";
import { questionHasImage } from "./imageQuestions";

/** Convex arrays hold at most 8192 items; stay well under. */
export const MAX_CATALOG_ENTRIES = 8000;
/** A catalog older than this is refreshed in the background on its next use. */
export const CATALOG_MAX_AGE_MS = 60 * 60 * 1000;
export const QUIZ_CATALOG_MODES = ["quiz", "came_first"] as const;
export const QUIZ_CATALOG_DIFFICULTIES = ["easy", "intermediate", "hard"] as const;

export type CatalogEntry = { c: string; i: boolean };

export function isPlayableInMode(q: Doc<"quizQuestions">, mode: string): boolean {
  return mode === "came_first" ? q.category === "which_came_first" : isStandardMcqQuestion(q);
}

export function toCatalogEntries(candidates: Doc<"quizQuestions">[]): CatalogEntry[] {
  return candidates.map((q) => ({ c: q.checksum, i: questionHasImage(q) }));
}

/** Shape planQuestionSequence/pickQuestionPool expect (checksum + image fields). */
export function catalogAsCandidates(entries: CatalogEntry[]) {
  return entries.map((e) => ({ checksum: e.c, imageUrl: e.i ? "image" : undefined }));
}

export async function readCatalog(
  ctx: QueryCtx | MutationCtx,
  sport: string,
  mode: string,
  difficulty: string,
) {
  return ctx.db
    .query("quizQuestionCatalogs")
    .withIndex("by_slice", (q) => q.eq("sport", sport).eq("mode", mode).eq("difficulty", difficulty))
    .first();
}

function sameEntries(a: CatalogEntry[], b: CatalogEntry[]) {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k++) if (a[k].c !== b[k].c || a[k].i !== b[k].i) return false;
  return true;
}

export async function writeCatalog(
  ctx: MutationCtx,
  sport: string,
  mode: string,
  difficulty: string,
  entries: CatalogEntry[],
) {
  const existing = await readCatalog(ctx, sport, mode, difficulty);
  if (entries.length > MAX_CATALOG_ENTRIES) {
    // Too big for one doc: drop it so callers use the full-collect fallback.
    if (existing) await ctx.db.delete(existing._id);
    return { written: false, size: entries.length };
  }
  const doc = { sport, mode, difficulty, entries, builtAt: Date.now() };
  if (existing && sameEntries(existing.entries, entries)) {
    // Unchanged slice: only the freshness stamp moves.
    await ctx.db.patch(existing._id, { builtAt: doc.builtAt });
    return { written: false, size: entries.length };
  }
  if (existing) await ctx.db.replace(existing._id, doc);
  else await ctx.db.insert("quizQuestionCatalogs", doc);
  return { written: true, size: entries.length };
}
