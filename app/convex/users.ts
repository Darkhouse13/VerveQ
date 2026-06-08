import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  auditUsernameDuplicates as auditDuplicateUsernames,
  claimUsernameForUser,
  hasUsableUsername,
  isValidUsername,
  normalizeUsername,
} from "./lib/usernames";

function usernameDerivedFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const localPart = email.split("@")[0] ?? "";
  const derived = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return derived || null;
}

function hasPermanentUsername(user: {
  username?: string;
  isGuest?: boolean;
  isAnonymous?: boolean;
} | null): boolean {
  return !!user &&
    user.isGuest !== true &&
    user.isAnonymous !== true &&
    typeof user.username === "string" &&
    isValidUsername(user.username.trim().toLowerCase());
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const ensureProfile = mutation({
  args: {
    username: v.string(),
    displayName: v.optional(v.string()),
    isGuest: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.isGuest) {
      throw new Error("Guest sessions are temporary and tab-local. Create an account with a username to store data.");
    }

    const existing = await ctx.db.get(userId);
    // Convex Auth creates the users doc up-front, so `existing` is always
    // non-null here. Pre-BLOCKER-1 fix the handler returned early on any
    // existing doc and therefore never patched username, leaving
    // users.getByUsername unable to find first-time users (audit #7).
    //
    // New behavior: patch the username only when it is missing or empty;
    // leave already-set usernames alone so this stays idempotent across
    // subsequent signIn / ensureProfile calls.
    const hasUsername = hasUsableUsername(existing);
    const requestedCandidate = normalizeUsername(args.username);
    const existingUsername = hasUsername
      ? normalizeUsername(existing.username)
      : null;
    const emailDerivedUsername = usernameDerivedFromEmail(existing?.email);
    const shouldReplaceExistingUsername =
      hasUsername &&
      requestedCandidate !== existingUsername &&
      emailDerivedUsername !== null &&
      existingUsername === emailDerivedUsername;
    const claimTarget =
      hasUsername && !shouldReplaceExistingUsername
        ? existing.username
        : args.username;
    const { username: candidate } = await claimUsernameForUser(
      ctx,
      claimTarget,
      userId,
    );

    if (hasUsername) {
      const updates: {
        username?: string;
        displayName?: string;
        isGuest?: boolean;
        totalGames?: number;
      } = {};
      if (shouldReplaceExistingUsername || candidate !== existingUsername) {
        updates.username = candidate;
      }
      if (existing?.isGuest !== args.isGuest) {
        updates.isGuest = args.isGuest;
      }
      if (!existing?.displayName && args.displayName) {
        updates.displayName = args.displayName;
      }
      if (existing?.totalGames === undefined) {
        updates.totalGames = 0;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(userId, updates);
      }
      return userId;
    }


    await ctx.db.patch(userId, {
      username: candidate,
      displayName: args.displayName ?? existing?.displayName ?? candidate,
      isGuest: args.isGuest,
      totalGames: existing?.totalGames ?? 0,
    });

    return userId;
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = normalizeUsername(username);
    const matches = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .collect();
    const permanentMatches = matches.filter(hasPermanentUsername);
    if (permanentMatches.length === 0) return null;
    if (permanentMatches.length > 1) {
      throw new Error("Username is not unique. Ask the user for their account link or user id.");
    }
    return permanentMatches[0];
  },
});

export const auditUsernameDuplicates = query({
  args: {},
  handler: async (ctx) => {
    return await auditDuplicateUsernames(ctx);
  },
});
