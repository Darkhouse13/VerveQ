import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";

function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

async function findChallengeTarget(
  ctx: { db: { query: (table: "users") => unknown } },
  rawIdentifier: string,
): Promise<Doc<"users"> | null> {
  const identifier = rawIdentifier.trim();
  if (!identifier) return null;

  const usersQuery = ctx.db.query("users") as {
    withIndex: (
      indexName: "by_username",
      rangeBuilder: (q: { eq: (field: "username", value: string) => unknown }) => unknown,
    ) => { first: () => Promise<Doc<"users"> | null> };
    collect: () => Promise<Array<Doc<"users">>>;
  };

  const exactUsernameMatch = await usersQuery
    .withIndex("by_username", (q) => q.eq("username", identifier))
    .first();
  if (exactUsernameMatch) return exactUsernameMatch;

  const normalizedIdentifier = normalizeHandle(identifier);
  const users = await usersQuery.collect();
  return (
    users.find((user) => {
      const username = typeof user.username === "string" ? user.username : "";
      const displayName =
        typeof user.displayName === "string" ? user.displayName : "";
      return (
        normalizeHandle(username) === normalizedIdentifier ||
        normalizeHandle(displayName) === normalizedIdentifier
      );
    }) ?? null
  );
}

export const getPending = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, challenges: [] };

    const pending = await ctx.db
      .query("challenges")
      .withIndex("by_challenged_status", (q) =>
        q.eq("challengedId", userId).eq("status", "pending"),
      )
      .collect();

    const challenges = await Promise.all(
      pending.map(async (c) => {
        const challenger = await ctx.db.get(c.challengerId);
        return {
          challengeId: c._id,
          challenger: challenger?.username ?? "Unknown",
          sport: c.sport,
          mode: c.mode,
          createdAt: c._creationTime,
          status: c.status,
        };
      }),
    );

    return { total: challenges.length, challenges };
  },
});

export const create = mutation({
  args: {
    challengedUsername: v.string(),
    sport: v.string(),
    mode: v.string(),
  },
  handler: async (ctx, { challengedUsername, sport, mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenged = await findChallengeTarget(ctx, challengedUsername);

    if (!challenged) {
      throw new Error(
        `User not found: ${challengedUsername.trim()}. Try the exact @username shown on their profile.`,
      );
    }
    if (challenged._id === userId) throw new Error("Cannot challenge yourself");

    const challengeId = await ctx.db.insert("challenges", {
      challengerId: userId,
      challengedId: challenged._id,
      sport,
      mode,
      status: "pending",
    });

    return { challengeId };
  },
});

export const accept = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenge = await ctx.db.get(challengeId);
    if (!challenge || challenge.challengedId !== userId) {
      throw new Error("Challenge not found");
    }

    await ctx.db.patch(challengeId, { status: "active" });
    return { success: true };
  },
});

export const decline = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenge = await ctx.db.get(challengeId);
    if (!challenge || challenge.challengedId !== userId) {
      throw new Error("Challenge not found");
    }

    await ctx.db.patch(challengeId, { status: "declined" });
    return { success: true };
  },
});
