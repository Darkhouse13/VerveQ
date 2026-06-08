import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasUsableUsername } from "./usernames";

export const FULL_ACCOUNT_REQUIRED = "Full account required";
export const USERNAME_REQUIRED = "Username required";

export function isRankedEligibleUserDoc(
  user:
    | Pick<Doc<"users">, "_id" | "isAnonymous" | "isGuest">
    | null
    | undefined,
) {
  return !!user && user.isAnonymous !== true && user.isGuest !== true;
}

export function isUsernameRequiredUserDoc(
  user:
    | Pick<Doc<"users">, "_id" | "username" | "isGuest">
    | null
    | undefined,
) {
  return hasUsableUsername(user ?? null);
}

export function isFullAccountUserDoc(
  user:
    | Pick<Doc<"users">, "_id" | "username" | "isAnonymous" | "isGuest">
    | null
    | undefined,
) {
  return isRankedEligibleUserDoc(user) && hasUsableUsername(user ?? null);
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

export async function assertUsernameRequiredUser(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!isUsernameRequiredUserDoc(user)) {
    throw new Error(USERNAME_REQUIRED);
  }
  return user;
}

export async function assertFullAccountUser(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!isFullAccountUserDoc(user)) {
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

export async function areFullAccountUsers(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userIds: Id<"users">[],
) {
  for (const userId of userIds) {
    const user = await ctx.db.get(userId);
    if (!isFullAccountUserDoc(user)) return false;
  }
  return true;
}
