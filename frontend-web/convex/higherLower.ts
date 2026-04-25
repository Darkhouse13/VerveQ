import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// Human-readable labels for context keys (league IDs -> display names)
const CONTEXT_KEY_LABELS: Record<string, string> = {
  "league:fb_39": "Premier League",
  "league:fb_140": "La Liga",
  "league:fb_135": "Serie A",
  "league:fb_78": "Bundesliga",
  "league:fb_61": "Ligue 1",
  "league:fb_2": "Champions League",
  "league:fb_3": "Europa League",
  "league:fb_848": "Conference League",
  "league:fb_1": "World Cup",
  "league:fb_4": "Euro Championship",
  "league:fb_9": "Copa America",
  "league:fb_15": "FIFA Club World Cup",
  career: "Career",
};

type HigherLowerPoolDoc = {
  externalId: string;
  sport: string;
  entityType: string;
  statKey: string;
  contextKey: string;
  contextLabel: string;
  factCount: number;
  distinctValueCount: number;
  minValue: number;
  maxValue: number;
  season?: number;
};

type HigherLowerFactDoc = {
  externalId: string;
  sport: string;
  poolKey: string;
  entityType: string;
  entityId: string;
  entityName: string;
  statKey: string;
  contextKey: string;
  value: number;
  season?: number;
};

/** Shuffle an array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDifferentValuePair(
  facts: HigherLowerFactDoc[],
): [HigherLowerFactDoc, HigherLowerFactDoc] | null {
  if (facts.length < 2) return null;

  const shuffled = shuffle([...facts]);
  const factA = shuffled[0];
  const differentValueFacts = shuffled.filter(
    (fact) => fact.externalId !== factA.externalId && fact.value !== factA.value,
  );
  if (differentValueFacts.length === 0) return null;

  const factB =
    differentValueFacts[Math.floor(Math.random() * differentValueFacts.length)];
  return [factA, factB];
}

function buildSeenFactIds(
  session: {
    currentFactAId: string;
    currentFactBId: string;
    seenFactIds?: string[];
  },
): Set<string> {
  return new Set([
    ...(session.seenFactIds ?? []),
    session.currentFactAId,
    session.currentFactBId,
  ]);
}

function buildSeenEntityIds(
  session: {
    currentFactAId: string;
    currentFactBId: string;
    seenEntityIds?: string[];
  },
  facts: HigherLowerFactDoc[],
): Set<string> {
  const seenEntityIds = new Set(session.seenEntityIds ?? []);
  const factById = new Map(facts.map((fact) => [fact.externalId, fact]));
  const currentFactA = factById.get(session.currentFactAId);
  const currentFactB = factById.get(session.currentFactBId);

  if (currentFactA) seenEntityIds.add(currentFactA.entityId);
  if (currentFactB) seenEntityIds.add(currentFactB.entityId);

  return seenEntityIds;
}

async function getEntityImage(
  ctx: MutationCtx,
  fact: { entityType: string; entityId: string },
): Promise<string | undefined> {
  if (fact.entityType === "player") {
    const player = await ctx.db
      .query("sportsPlayers")
      .withIndex("by_external_id", (q) => q.eq("externalId", fact.entityId))
      .first();
    return player?.photo ?? undefined;
  }

  if (fact.entityType === "team") {
    const team = await ctx.db
      .query("sportsTeams")
      .withIndex("by_external_id", (q) => q.eq("externalId", fact.entityId))
      .first();
    return team?.logo ?? undefined;
  }

  return undefined;
}

export const startSession = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (sport !== "football") {
      throw new Error("Higher or Lower is currently available for football only");
    }

    const approvedPools = await ctx.db
      .query("higherLowerPools")
      .withIndex("by_sport", (q) => q.eq("sport", sport))
      .collect();

    if (approvedPools.length === 0) {
      throw new Error("No approved Higher or Lower pools available");
    }

    let selectedPool: HigherLowerPoolDoc | null = null;
    let factA: HigherLowerFactDoc | null = null;
    let factB: HigherLowerFactDoc | null = null;

    for (const pool of shuffle([...approvedPools])) {
      const facts = await ctx.db
        .query("higherLowerFacts")
        .withIndex("by_pool_key", (q) => q.eq("poolKey", pool.externalId))
        .collect();
      const pair = pickDifferentValuePair(facts);
      if (!pair) continue;

      selectedPool = pool;
      [factA, factB] = pair;
      break;
    }

    if (!selectedPool || !factA || !factB) {
      throw new Error("No approved Higher or Lower pools with non-tie pairs");
    }

    const playerAPhoto = await getEntityImage(ctx, factA);
    const playerBPhoto = await getEntityImage(ctx, factB);

    const sessionId = await ctx.db.insert("higherLowerSessions", {
      userId,
      sport,
      score: 0,
      streak: 0,
      seenFactIds: [factA.externalId, factB.externalId],
      seenEntityIds: [factA.entityId, factB.entityId],
      currentFactAId: factA.externalId,
      currentFactBId: factB.externalId,
      currentStatKey: factA.statKey,
      currentContext: factA.contextKey,
      currentEntityType: factA.entityType,
      currentSeason: factA.season ?? undefined,
      currentFullContextKey: selectedPool.externalId,
      playerAName: factA.entityName,
      playerBName: factB.entityName,
      playerAValue: factA.value,
      playerBValue: factB.value,
      playerAPhoto,
      playerBPhoto,
      status: "active",
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return {
      sessionId,
      statKey: factA.statKey,
      context: factA.contextKey,
      contextLabel:
        selectedPool.contextLabel ||
        CONTEXT_KEY_LABELS[factA.contextKey] ||
        factA.contextKey,
      entityType: factA.entityType,
      season: factA.season ?? undefined,
      playerAName: factA.entityName,
      playerBName: factB.entityName,
      playerAValue: factA.value,
      playerAPhoto,
      playerBPhoto,
      score: 0,
      streak: 0,
    };
  },
});

export const makeGuess = mutation({
  args: {
    sessionId: v.id("higherLowerSessions"),
    guess: v.union(v.literal("higher"), v.literal("lower")),
  },
  handler: async (ctx, { sessionId, guess }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status === "game_over") throw new Error("Game is over");

    const { playerAValue, playerBValue } = session;
    const isHigher = playerBValue > playerAValue;
    const correct = guess === "higher" ? isHigher : !isHigher;

    if (!correct) {
      await ctx.db.patch(sessionId, { status: "game_over" });
      return {
        correct: false,
        playerBValue,
        score: session.score,
        streak: session.streak,
        gameOver: true,
      };
    }

    // Correct - B becomes A, pick new B
    const newScore = session.score + 1;
    const newStreak = session.streak + 1;

    const poolKey = session.currentFullContextKey;
    if (!poolKey) {
      throw new Error("Session is missing an approved Higher or Lower pool");
    }

    const pool = await ctx.db
      .query("higherLowerPools")
      .withIndex("by_external_id", (q) => q.eq("externalId", poolKey))
      .first();
    if (!pool) {
      throw new Error("Approved Higher or Lower pool not found");
    }

    const candidates = await ctx.db
      .query("higherLowerFacts")
      .withIndex("by_pool_key", (q) => q.eq("poolKey", poolKey))
      .collect();

    const seenFactIds = buildSeenFactIds(session);
    const seenEntityIds = buildSeenEntityIds(session, candidates);

    const unseenValidCandidates = candidates.filter(
      (fact) =>
        fact.externalId !== session.currentFactBId &&
        fact.externalId !== session.currentFactAId &&
        !seenFactIds.has(fact.externalId) &&
        !seenEntityIds.has(fact.entityId) &&
        fact.value !== session.playerBValue,
    );

    if (unseenValidCandidates.length === 0) {
      // Pool exhausted without a valid unseen non-tie candidate.
      await ctx.db.patch(sessionId, {
        score: newScore,
        streak: newStreak,
        status: "game_over",
      });
      return {
        correct: true,
        playerBValue,
        score: newScore,
        streak: newStreak,
        gameOver: true,
      };
    }

    const newFactB =
      unseenValidCandidates[
        Math.floor(Math.random() * unseenValidCandidates.length)
      ];
    const newBPhoto = await getEntityImage(ctx, newFactB);

    await ctx.db.patch(sessionId, {
      score: newScore,
      streak: newStreak,
      seenFactIds: [...seenFactIds, newFactB.externalId],
      seenEntityIds: [...seenEntityIds, newFactB.entityId],
      currentFactAId: session.currentFactBId,
      currentFactBId: newFactB.externalId,
      playerAName: session.playerBName,
      playerBName: newFactB.entityName,
      playerAValue: session.playerBValue,
      playerBValue: newFactB.value,
      playerAPhoto: session.playerBPhoto,
      playerBPhoto: newBPhoto,
      currentContext: newFactB.contextKey,
    });

    return {
      correct: true,
      playerBValue,
      score: newScore,
      streak: newStreak,
      gameOver: false,
      nextPlayerAName: session.playerBName,
      nextPlayerAValue: session.playerBValue,
      nextPlayerAPhoto: session.playerBPhoto,
      nextPlayerBName: newFactB.entityName,
      nextPlayerBPhoto: newBPhoto,
      statKey: session.currentStatKey,
      context: newFactB.contextKey,
      contextLabel:
        pool.contextLabel ||
        CONTEXT_KEY_LABELS[newFactB.contextKey] ||
        newFactB.contextKey,
      entityType: session.currentEntityType,
      season: session.currentSeason,
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("higherLowerSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId && session.userId !== userId) return null;

    // Player B's value is the hidden answer until the user guesses.
    // Reveal it only once the game is over.
    const revealed = session.status === "game_over";
    return {
      _id: session._id,
      sport: session.sport,
      score: session.score,
      streak: session.streak,
      status: session.status,
      playerAName: session.playerAName,
      playerAValue: session.playerAValue,
      playerAPhoto: session.playerAPhoto,
      playerBName: session.playerBName,
      playerBPhoto: session.playerBPhoto,
      playerBValue: revealed ? session.playerBValue : null,
      currentStatKey: session.currentStatKey,
      currentContext: session.currentContext,
      currentEntityType: session.currentEntityType,
      currentSeason: session.currentSeason,
      expiresAt: session.expiresAt,
    };
  },
});
