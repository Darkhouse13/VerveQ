// Serve-time image helpers shared by the solo question modes (quiz, blitz,
// daily, duels). The arena has its own copy of the same resolution rule in
// challengeArenas.ts (`imageUrl ?? getUrl(imageId)`).

// QueryCtx typing so both query- and mutation-context serve paths can call in
// (a MutationCtx's db/storage satisfy the reader interfaces structurally).
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type ImageBearing = {
  imageId?: Id<"_storage">;
  imageUrl?: string;
};

/**
 * The one rule for turning a question row into a servable image URL: a URL
 * image (same-origin asset path) wins, otherwise the Convex-storage blob.
 * Every mode must serve through this — the image cap counts BOTH kinds
 * (lib/imageQuestions.ts), so a mode that resolves only `imageId` serves
 * capped-as-image questions with their image silently dropped.
 */
export async function resolveQuestionImageUrl(
  ctx: Pick<QueryCtx, "storage">,
  question: ImageBearing,
): Promise<string | null> {
  if (question.imageUrl) return question.imageUrl;
  if (question.imageId) return await ctx.storage.getUrl(question.imageId);
  return null;
}

/**
 * Peek the image URL of the NEXT planned question so the client can warm the
 * browser cache while the current question is on screen. Best-effort: a stale
 * plan entry (row deleted since planning) just yields null — the serve path
 * re-validates eligibility itself.
 */
export async function peekNextPlannedImageUrl(
  ctx: Pick<QueryCtx, "db" | "storage">,
  plannedChecksums: readonly string[] | undefined,
  usedChecksums: readonly string[],
): Promise<string | null> {
  if (!plannedChecksums) return null;
  const used = new Set(usedChecksums);
  const nextChecksum = plannedChecksums.find((c) => !used.has(c));
  if (!nextChecksum) return null;
  const doc = await ctx.db
    .query("quizQuestions")
    .withIndex("by_checksum", (q) => q.eq("checksum", nextChecksum))
    .first();
  if (!doc) return null;
  return await resolveQuestionImageUrl(ctx, doc);
}
