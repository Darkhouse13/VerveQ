import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";

function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

function hasPermanentUsername(user: Pick<Doc<"users">, "username" | "isGuest" | "isAnonymous"> | null): boolean {
  return !!user &&
    user.isGuest !== true &&
    user.isAnonymous !== true &&
    typeof user.username === "string" &&
    /^[a-z0-9_]{3,24}$/.test(user.username.trim().toLowerCase());
}

function oneOrAmbiguous(
  matches: Array<Doc<"users">>,
  identifier: string,
  matchType: "username" | "display name" | "username or display name",
): Doc<"users"> | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  throw new Error(
    `Multiple users match ${identifier.trim()} by ${matchType}. Ask them for their exact @username.`,
  );
}


async function findPendingChallengeBetweenPlayers(
  ctx: { db: { query: (table: "challenges") => unknown } },
  challengerId: Id<"users">,
  challengedId: Id<"users">,
  sport: string,
  mode: string,
) {
  const challengesQuery = ctx.db.query("challenges") as {
    withIndex: (
      indexName: "by_challenger",
      rangeBuilder: (q: { eq: (field: "challengerId", value: Id<"users">) => unknown }) => unknown,
    ) => { collect: () => Promise<Array<Doc<"challenges">>> };
  };

  const sent = await challengesQuery
    .withIndex("by_challenger", (q) => q.eq("challengerId", challengerId))
    .collect();

  return sent.find(
    (challenge) =>
      challenge.challengedId === challengedId &&
      challenge.sport === sport &&
      challenge.mode === mode &&
      challenge.status === "pending",
  ) ?? null;
}

async function declineOtherPendingChallengesBetweenPlayers(
  ctx: { db: { query: (table: "challenges") => unknown; patch: (id: Id<"challenges">, value: { status: "declined" }) => Promise<void> } },
  player1Id: Id<"users">,
  player2Id: Id<"users">,
  sport: string,
  mode: string,
  keepChallengeId: Id<"challenges">,
) {
  const pendingBothWays = [
    await findPendingChallengeBetweenPlayers(ctx, player1Id, player2Id, sport, mode),
    await findPendingChallengeBetweenPlayers(ctx, player2Id, player1Id, sport, mode),
  ];

  for (const challenge of pendingBothWays) {
    if (challenge && challenge._id !== keepChallengeId) {
      await ctx.db.patch(challenge._id, { status: "declined" });
    }
  }
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
  if (exactUsernameMatch) {
    return hasPermanentUsername(exactUsernameMatch) ? exactUsernameMatch : null;
  }

  const normalizedIdentifier = normalizeHandle(identifier);
  const users = await usersQuery.collect();

  const identityMatches = users.filter((user) => {
    if (!hasPermanentUsername(user)) return false;
    const username = typeof user.username === "string" ? user.username : "";
    const displayName =
      typeof user.displayName === "string" ? user.displayName : "";
    return (
      normalizeHandle(username) === normalizedIdentifier ||
      normalizeHandle(displayName) === normalizedIdentifier
    );
  });
  return oneOrAmbiguous(identityMatches, identifier, "username or display name");
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


export const getRecentOpponents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { opponents: [] };

    const byOpponent = new Map<
      Id<"users">,
      {
        opponentId: Id<"users">;
        lastSport: string;
        lastMode: string;
        lastPlayedAt: number;
        versusSummary: {
          wins: number;
          losses: number;
          draws: number;
          totalMatches: number;
        };
      }
    >();

    const remember = (
      opponentId: Id<"users">,
      lastSport: string,
      lastMode: string,
      lastPlayedAt: number,
      versusSummary = { wins: 0, losses: 0, draws: 0, totalMatches: 0 },
    ) => {
      const existing = byOpponent.get(opponentId);
      if (!existing || lastPlayedAt > existing.lastPlayedAt) {
        byOpponent.set(opponentId, {
          opponentId,
          lastSport,
          lastMode,
          lastPlayedAt,
          versusSummary,
        });
      }
    };

    const asPlayerA = await ctx.db
      .query("challengeHeadToHeads")
      .withIndex("by_player_a", (q) => q.eq("playerAId", userId))
      .collect();
    const asPlayerB = await ctx.db
      .query("challengeHeadToHeads")
      .withIndex("by_player_b", (q) => q.eq("playerBId", userId))
      .collect();

    for (const row of asPlayerA) {
      remember(row.playerBId, row.sport, row.mode, row.lastPlayedAt ?? row._creationTime, {
        wins: row.playerAWins,
        losses: row.playerBWins,
        draws: row.draws,
        totalMatches: row.totalMatches,
      });
    }
    for (const row of asPlayerB) {
      remember(row.playerAId, row.sport, row.mode, row.lastPlayedAt ?? row._creationTime, {
        wins: row.playerBWins,
        losses: row.playerAWins,
        draws: row.draws,
        totalMatches: row.totalMatches,
      });
    }

    const sent = await ctx.db
      .query("challenges")
      .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
      .collect();
    const received = await ctx.db
      .query("challenges")
      .withIndex("by_challenged", (q) => q.eq("challengedId", userId))
      .collect();

    for (const challenge of sent) {
      remember(challenge.challengedId, challenge.sport, challenge.mode, challenge.completedAt ?? challenge._creationTime);
    }
    for (const challenge of received) {
      remember(challenge.challengerId, challenge.sport, challenge.mode, challenge.completedAt ?? challenge._creationTime);
    }

    const opponents = await Promise.all(
      Array.from(byOpponent.values())
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
        .slice(0, 12)
        .map(async (entry) => {
          const user = await ctx.db.get(entry.opponentId);
          if (!hasPermanentUsername(user)) return null;
          return {
            opponentId: entry.opponentId,
            username: user.username,
            displayName: user.displayName ?? user.username,
            lastSport: entry.lastSport,
            lastMode: entry.lastMode,
            lastPlayedAt: entry.lastPlayedAt,
            versusSummary: entry.versusSummary,
          };
        }),
    );

    return { opponents: opponents.filter((opponent) => opponent !== null) };
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

    const challenger = await ctx.db.get(userId);
    if (!hasPermanentUsername(challenger)) {
      throw new Error("A permanent username is required. Create an account to use challenges.");
    }

    const challenged = await findChallengeTarget(ctx, challengedUsername);

    if (!challenged) {
      throw new Error(
        `Registered account not found: ${challengedUsername.trim()}. Ask them for their exact @username from Profile.`,
      );
    }
    if (challenged._id === userId) throw new Error("Cannot challenge yourself");

    const existingPending = await findPendingChallengeBetweenPlayers(
      ctx,
      userId,
      challenged._id,
      sport,
      mode,
    );
    if (existingPending) {
      return { challengeId: existingPending._id, alreadyPending: true };
    }

    const reciprocalPending = await findPendingChallengeBetweenPlayers(
      ctx,
      challenged._id,
      userId,
      sport,
      mode,
    );
    if (reciprocalPending) {
      return { challengeId: reciprocalPending._id, reciprocalPending: true };
    }

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


export const createRematch = mutation({
  args: {
    opponentId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
  },
  handler: async (ctx, { opponentId, sport, mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenger = await ctx.db.get(userId);
    if (!hasPermanentUsername(challenger)) {
      throw new Error("A permanent username is required. Create an account to use challenges.");
    }

    const opponent = await ctx.db.get(opponentId);
    if (!hasPermanentUsername(opponent)) {
      throw new Error("Opponent account not found. Ask them for their exact @username from Profile.");
    }
    if (opponentId === userId) throw new Error("Cannot challenge yourself");

    const existingPending = await findPendingChallengeBetweenPlayers(
      ctx,
      userId,
      opponentId,
      sport,
      mode,
    );
    if (existingPending) {
      return { challengeId: existingPending._id, alreadyPending: true };
    }

    const reciprocalPending = await findPendingChallengeBetweenPlayers(
      ctx,
      opponentId,
      userId,
      sport,
      mode,
    );
    if (reciprocalPending) {
      return { challengeId: reciprocalPending._id, reciprocalPending: true };
    }

    const challengeId = await ctx.db.insert("challenges", {
      challengerId: userId,
      challengedId: opponentId,
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

    await declineOtherPendingChallengesBetweenPlayers(
      ctx,
      challenge.challengerId,
      challenge.challengedId,
      challenge.sport,
      challenge.mode,
      challengeId,
    );
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
