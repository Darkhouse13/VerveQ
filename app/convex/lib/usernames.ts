import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return normalized || "user";
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}

export function hasUsableUsername(
  user: Pick<Doc<"users">, "username" | "isGuest"> | null,
): user is Pick<Doc<"users">, "username" | "isGuest"> & { username: string } {
  return (
    !!user &&
    user.isGuest !== true &&
    typeof user.username === "string" &&
    isValidUsername(user.username.trim().toLowerCase())
  );
}

function activeClaim(claim: Doc<"usernameClaims">) {
  return claim.releasedAt === undefined;
}

async function getActiveClaimsByKey(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  key: string,
) {
  const claims = await ctx.db
    .query("usernameClaims")
    .withIndex("by_key", (q) => q.eq("key", key))
    .collect();
  return claims.filter(activeClaim);
}

async function getActiveClaimsByUser(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">,
) {
  const claims = await ctx.db
    .query("usernameClaims")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return claims.filter(activeClaim);
}

async function getExistingUsernameOwners(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  key: string,
) {
  const exact = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", key))
    .collect();
  const owners = new Map<string, Pick<Doc<"users">, "_id" | "username">>();

  for (const user of exact) {
    if (typeof user.username === "string") {
      owners.set(String(user._id), user);
    }
  }

  const allUsers = await ctx.db.query("users").collect();
  for (const user of allUsers) {
    if (
      typeof user.username === "string" &&
      user.username.trim().toLowerCase() === key
    ) {
      owners.set(String(user._id), user);
    }
  }

  return [...owners.values()];
}

export async function claimUsernameForUser(
  ctx: Pick<MutationCtx, "db">,
  rawUsername: string,
  userId: Id<"users">,
) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) {
    throw new Error("Username must be 3-24 lowercase letters, numbers, or underscores.");
  }

  const existingOwners = await getExistingUsernameOwners(ctx, username);
  const otherExistingOwners = existingOwners.filter((user) => user._id !== userId);
  if (otherExistingOwners.length > 0) {
    throw new Error("Username is already taken. Choose another one.");
  }

  const existingClaims = await getActiveClaimsByKey(ctx, username);
  if (existingClaims.length > 1) {
    throw new Error("Username claim is ambiguous. Choose another username.");
  }
  if (existingClaims.length === 1) {
    const [claim] = existingClaims;
    if (claim.userId !== userId) {
      throw new Error("Username is already taken. Choose another one.");
    }
    return { username, key: username, claimId: claim._id };
  }

  const currentUserClaims = await getActiveClaimsByUser(ctx, userId);
  const differentClaims = currentUserClaims.filter((claim) => claim.key !== username);
  if (differentClaims.length > 0) {
    throw new Error("This account already has a username claim.");
  }

  const claimId = await ctx.db.insert("usernameClaims", {
    key: username,
    username,
    userId,
    claimedAt: Date.now(),
  });

  const claimsAfterInsert = await getActiveClaimsByKey(ctx, username);
  if (
    claimsAfterInsert.length !== 1 ||
    claimsAfterInsert[0]._id !== claimId ||
    claimsAfterInsert[0].userId !== userId
  ) {
    throw new Error("Username claim could not be made safely. Try another username.");
  }

  return { username, key: username, claimId };
}

export async function auditUsernameDuplicates(
  ctx: Pick<QueryCtx, "db">,
) {
  const users = await ctx.db.query("users").collect();
  const groups = new Map<
    string,
    Array<{ userId: Id<"users">; username: string }>
  >();

  for (const user of users) {
    if (typeof user.username !== "string" || user.username.trim().length === 0) {
      continue;
    }
    const key = user.username.trim().toLowerCase();
    const group = groups.get(key) ?? [];
    group.push({ userId: user._id, username: user.username });
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([key, owners]) => ({ key, owners }));
}
