import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function normalizeUsername(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return normalized || "user";
}

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
    /^[a-z0-9_]{3,24}$/.test(user.username.trim().toLowerCase());
}

async function usernameExistsCaseInsensitive(
  ctx: { db: { query: (table: "users") => unknown } },
  username: string,
  currentUserId: string,
): Promise<boolean> {
  const usersQuery = ctx.db.query("users") as {
    withIndex: (
      indexName: "by_username",
      rangeBuilder: (q: { eq: (field: "username", value: string) => unknown }) => unknown,
    ) => { first: () => Promise<{ _id: string } | null> };
    collect?: () => Promise<Array<{ _id: string; username?: string }>>;
  };

  const exact = await usersQuery
    .withIndex("by_username", (q) => q.eq("username", username))
    .first();
  if (exact && exact._id !== currentUserId) return true;

  if (typeof usersQuery.collect === "function") {
    const normalized = username.toLowerCase();
    const users = await usersQuery.collect();
    return users.some(
      (user) =>
        user._id !== currentUserId &&
        typeof user.username === "string" &&
        user.username.trim().toLowerCase() === normalized,
    );
  }

  return false;
}

async function validateAvailableUsername(
  ctx: { db: { query: (table: "users") => unknown } },
  rawUsername: string,
  currentUserId: string,
): Promise<string> {
  const candidate = normalizeUsername(rawUsername);
  if (!/^[a-z0-9_]{3,24}$/.test(candidate)) {
    throw new Error("Username must be 3-24 lowercase letters, numbers, or underscores.");
  }
  const collision = await usernameExistsCaseInsensitive(ctx, candidate, currentUserId);
  if (collision) {
    throw new Error("Username is already taken. Choose another one.");
  }
  return candidate;
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
    const hasUsername =
      !!existing &&
      typeof existing.username === "string" &&
      existing.username.trim().length > 0;
    const candidate = await validateAvailableUsername(ctx, args.username, userId);

    if (hasUsername) {
      const updates: {
        username?: string;
        displayName?: string;
        isGuest?: boolean;
        totalGames?: number;
      } = {};
      const existingUsername = existing.username!.trim().toLowerCase();
      const emailDerivedUsername = usernameDerivedFromEmail(existing.email);
      if (
        candidate !== existingUsername &&
        emailDerivedUsername !== null &&
        existingUsername === emailDerivedUsername
      ) {
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
