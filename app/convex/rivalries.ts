import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function pairKeyFor(userAId: Id<"users">, userBId: Id<"users">) {
  const [a, b] = [userAId, userBId].sort() as [Id<"users">, Id<"users">];
  return { pairKey: `${a}|${b}`, userAId: a, userBId: b };
}

function orient(row: Doc<"rivalries"> | null, userId: Id<"users">) {
  if (!row) {
    return {
      wins: 0,
      losses: 0,
      draws: 0,
      currentStreakHolderId: null,
      currentStreakLen: 0,
      lastDuelId: null,
      updatedAt: null,
    };
  }
  const isA = row.userAId === userId;
  return {
    wins: isA ? row.aWins : row.bWins,
    losses: isA ? row.bWins : row.aWins,
    draws: row.draws,
    currentStreakHolderId: row.currentStreakHolderId ?? null,
    currentStreakLen: row.currentStreakLen,
    lastDuelId: row.lastDuelId ?? null,
    updatedAt: row.updatedAt,
  };
}

export const get = query({
  args: { opponentUserId: v.id("users") },
  handler: async (ctx, { opponentUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (userId === opponentUserId) {
      throw new Error("Cannot get a rivalry with yourself");
    }

    const { pairKey } = pairKeyFor(userId, opponentUserId);
    const row = await ctx.db
      .query("rivalries")
      .withIndex("by_pair", (q) => q.eq("pairKey", pairKey))
      .first();
    const opponent = await ctx.db.get(opponentUserId);

    return {
      opponent: opponent
        ? {
            userId: opponentUserId,
            username: opponent.username ?? "Unknown",
            displayName: opponent.displayName ?? opponent.username ?? "Unknown",
          }
        : null,
      ...orient(row, userId),
    };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { rivalries: [] };

    const asA = await ctx.db
      .query("rivalries")
      .withIndex("by_userA", (q) => q.eq("userAId", userId))
      .collect();
    const asB = await ctx.db
      .query("rivalries")
      .withIndex("by_userB", (q) => q.eq("userBId", userId))
      .collect();

    const rivalries = await Promise.all(
      [...asA, ...asB]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (row) => {
          const opponentId = row.userAId === userId ? row.userBId : row.userAId;
          const opponent = await ctx.db.get(opponentId);
          return {
            opponent: {
              userId: opponentId,
              username: opponent?.username ?? "Unknown",
              displayName: opponent?.displayName ?? opponent?.username ?? "Unknown",
            },
            ...orient(row, userId),
          };
        }),
    );

    return { rivalries };
  },
});
