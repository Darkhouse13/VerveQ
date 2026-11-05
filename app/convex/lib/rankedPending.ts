/**
 * Ranked first-question carry-over (no free rerolls).
 *
 * A ranked run quit (or left, or expired) after its first question was SERVED
 * but before any answer would otherwise let the player draw a different first
 * question just by quitting. Instead the served question is parked per
 * (user, sport, mode, difficulty) with its ORIGINAL serve time, and the next
 * ranked run for that key serves it first on that same clock. Answering it
 * after the 15 s ranked window counts as a miss (quizSessions.checkAnswer), so
 * quitting to look it up buys nothing. Accidental starts cost nothing more.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { RANKED_ANSWER_LIMIT_SEC, rankedAnswerInTime } from "./scoring";


/** Answer window for a carried-over question: the same 15 s ranked limit as
 *  every ranked question (owner ruling 2026-11-05), on its ORIGINAL clock. */
export const CARRIED_QUESTION_WINDOW_SEC = RANKED_ANSWER_LIMIT_SEC;

export function pendingKey(sport: string, mode: string | undefined, difficulty: string | undefined) {
  // An omitted difficulty plays the intermediate pool (quizSessions
  // sessionDifficulty), so it shares intermediate's slot — otherwise toggling
  // between the two would be a second free first-question draw.
  return `${sport}|${mode ?? "quiz"}|${difficulty ?? "intermediate"}`;
}

/** Every ranked answer, carried or not, counts only inside the 15 s window.
 *  `carriedOver` is kept for call-site clarity; the rule no longer differs. */
export function carriedAnswerCounts(timeTakenSec: number, _carriedOver?: boolean | undefined) {
  return rankedAnswerInTime(timeTakenSec);
}

async function findPending(ctx: QueryCtx | MutationCtx, userId: Id<"users">, key: string) {
  return ctx.db
    .query("rankedPendingQuestions")
    .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
    .first();
}

/** Park a served-but-unanswered first question. One write, only on the quit path. */
export async function parkUnansweredQuestion(ctx: MutationCtx, session: Doc<"quizSessions">) {
  if (!session.userId || !session.currentChecksum || (session.totalAnswers ?? 0) > 0) return;
  const key = pendingKey(session.sport, session.mode, session.difficulty);
  const servedAt = session.questionStartedAt ?? session._creationTime;
  const existing = await findPending(ctx, session.userId, key);
  if (existing) {
    // Keep the OLDEST served question: with parallel runs the player could
    // otherwise park whichever question they prefer.
    if (existing.servedAt <= servedAt) return;
    await ctx.db.patch(existing._id, { checksum: session.currentChecksum, servedAt });
  } else {
    await ctx.db.insert("rankedPendingQuestions", {
      userId: session.userId,
      key,
      checksum: session.currentChecksum,
      servedAt,
    });
  }
}

/** Take (and consume) the parked question for this key, if any. */
export async function takeParkedQuestion(ctx: MutationCtx, userId: Id<"users">, key: string) {
  const parked = await findPending(ctx, userId, key);
  if (!parked) return null;
  await ctx.db.delete(parked._id);
  return { checksum: parked.checksum, servedAt: parked.servedAt };
}
