import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasUsableUsername } from "./usernames";

export const FULL_ACCOUNT_REQUIRED = "Full account required";
export const USERNAME_REQUIRED = "Username required";
export const SESSION_REQUIRED = "Session required";

export function isRankedEligibleUserDoc(
  user:
    | Pick<Doc<"users">, "_id" | "isAnonymous" | "isGuest">
    | null
    | undefined,
) {
  return !!user && user.isAnonymous !== true && user.isGuest !== true;
}

/**
 * Rung 1 of the identity ladder — ANY server identity, anonymous included.
 * This is the tier the casual/daily surfaces sit on: they key every write on
 * `userId` and never read `username`, so a silent anonymous session is all
 * they need. Kept as a named predicate (rather than a bare `getAuthUserId`
 * null-check at each call site) so the tier a function serves is legible, and
 * so a user id whose doc has since been deleted fails closed.
 */
export function isSessionUserDoc(
  user: Pick<Doc<"users">, "_id"> | null | undefined,
) {
  return !!user;
}

/**
 * Rung 2 — a CLAIMED name. This is the public-board policy: anonymous users
 * never appear on a board, their scores persist against `userId`, and claiming
 * a username makes the already-recorded score visible with no backfill.
 *
 * Currently coincides with {@link isUsernameRequiredUserDoc}, but it is a
 * different question ("may this row be shown to strangers?" vs "may this user
 * enter this route?") and boards are the surface where getting it wrong leaks
 * a name. Keeping the board policy at its own name means changing it later
 * touches one predicate instead of every board handler.
 */
export function isBoardEligibleUserDoc(
  user:
    | Pick<Doc<"users">, "_id" | "username" | "isGuest">
    | null
    | undefined,
) {
  return hasUsableUsername(user ?? null);
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

/**
 * Identity-only gate for the anonymous-first surfaces. Confirms the id from
 * `getAuthUserId` still resolves to a live users doc; imposes no username or
 * credential requirement.
 */
export async function assertSessionUser(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!isSessionUserDoc(user)) {
    throw new Error(SESSION_REQUIRED);
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
