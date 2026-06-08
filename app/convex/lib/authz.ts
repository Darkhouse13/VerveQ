import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const FULL_ACCOUNT_REQUIRED = "Full account required";

export function isRankedEligibleUserDoc(
  user:
    | Pick<Doc<"users">, "_id" | "isAnonymous" | "isGuest">
    | null
    | undefined,
) {
  return !!user && user.isAnonymous !== true && user.isGuest !== true;
}

export async function isRankedEligibleUserId(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  return isRankedEligibleUserDoc(user);
}

export async function assertRankedEligibleUser(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!isRankedEligibleUserDoc(user)) {
    throw new Error(FULL_ACCOUNT_REQUIRED);
  }
  return user;
}

export async function areRankedEligibleUsers(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userIds: Id<"users">[],
) {
  for (const userId of userIds) {
    if (!(await isRankedEligibleUserId(ctx, userId))) return false;
  }
  return true;
}
