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

async function pickUniqueUsername(
  ctx: { db: { query: (table: "users") => unknown } },
  rawUsername: string,
  currentUserId: string,
): Promise<string> {
  const baseCandidate = normalizeUsername(rawUsername);
  let candidate = baseCandidate;
  for (let attempt = 0; attempt < 8; attempt++) {
    const collision = await usernameExistsCaseInsensitive(ctx, candidate, currentUserId);
    if (!collision) return candidate;
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${baseCandidate}_${suffix}`;
  }
  throw new Error("Could not allocate a unique username. Please try again.");
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
    if (hasUsername) {
      const updates: {
        displayName?: string;
        isGuest?: boolean;
        totalGames?: number;
      } = {};
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

    const candidate = await pickUniqueUsername(ctx, args.username, userId);

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
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
  },
});
