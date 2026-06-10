import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Counts a finished run toward the user's lifetime plays — the number behind
 * the home PLAYS tile and the profile GAMES PLAYED tile. Casual modes count
 * here too; ranked W/L stats stay separate (profile.stats).
 */
export async function incrementTotalGames(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  await ctx.db.patch(userId, { totalGames: (user.totalGames ?? 0) + 1 });
}
