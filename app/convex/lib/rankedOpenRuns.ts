/**
 * One live ranked run per player (perf/security loop, round 8).
 *
 * Parallel ranked runs were a free choice: open several, answer the one whose
 * first question you know, abandon the rest. Starting a ranked run now closes
 * the player's other live ones first, through the same rules every exit uses:
 * quiz ≥1 answer → settles as a loss; quiz 0 answers → its served question is
 * parked (oldest kept) and comes back first, on its original clock; survival
 * with progress → settles on its banked score. Indexed and bounded.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { isRankedEligibleUserId } from "./authz";
import { abandonQuizSession, settleSurvivalSession, survivalRunHasProgress } from "./rankedSettle";

/** More live runs than this for one player is abuse; the rest expire via the cron. */
export const MAX_OPEN_RUNS_CLOSED = 20;

export async function closeOpenRankedQuizRuns(ctx: MutationCtx, userId: Id<"users">, now: number) {
  const open = await ctx.db
    .query("quizSessions")
    .withIndex("by_user_completed_expiresAt", (q) =>
      q.eq("userId", userId).eq("completed", false).gt("expiresAt", now),
    )
    .take(MAX_OPEN_RUNS_CLOSED);
  for (const session of open) await abandonQuizSession(ctx, session);
  return open.length;
}

export async function closeOpenRankedSurvivalRuns(ctx: MutationCtx, userId: Id<"users">, now: number) {
  const open = await ctx.db
    .query("survivalSessions")
    .withIndex("by_user_gameOver_expiresAt", (q) =>
      q.eq("userId", userId).eq("gameOver", false).gt("expiresAt", now),
    )
    .take(MAX_OPEN_RUNS_CLOSED);
  let closed = 0;
  for (const session of open) {
    if (session.dailyDate) continue; // the shared daily has its own one-attempt rules
    if (!session.completedAt && survivalRunHasProgress(session) && (await isRankedEligibleUserId(ctx, userId))) {
      await settleSurvivalSession(ctx, session, { countAsPlay: false });
    } else {
      await ctx.db.patch(session._id, { gameOver: true });
    }
    closed++;
  }
  return closed;
}
