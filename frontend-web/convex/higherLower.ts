import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// Known stat keys to sample from (avoids fetching all 32K+ facts at once)
const KNOWN_STAT_KEYS = [
  "goalsFor",
  "goalsAgainst",
  "cleanSheets",
  "assists",
  "appearances",
  "yellowCards",
  "redCards",
  "wins",
  "losses",
  "draws",
  "points",
];

// Human-readable labels for context keys (league IDs → display names)
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
  "career": "Career",
};

function getContextLabel(contextKey: string): string {
  return CONTEXT_KEY_LABELS[contextKey] || contextKey;
}

/** Build a strict context key that groups only comparable facts together. */
function buildFullContextKey(fact: {
  entityType: string;
  statKey: string;
  contextKey: string;
  season?: number;
}): string {
  return `${fact.entityType}_${fact.statKey}_${fact.contextKey}_${fact.season ?? "career"}`;
}

/** Shuffle an array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const startSession = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    // Try each stat key (in random order) to find a valid context group.
    // Each by_stat_key_sport query returns ~1-3K docs, well under the 32K limit.
    const statKeysToTry = shuffle([...KNOWN_STAT_KEYS]);

    type FactDoc = {
      _id: any;
      externalId: string;
      sport: string;
      entityType: string;
      entityId: string;
      entityName: string;
      statKey: string;
      contextKey: string;
      value: number;
      season?: number;
    };

    let bestGroup: FactDoc[] | null = null;
    let bestFullKey = "";
    let bestMinSize = 0;

    // Try thresholds in descending order: 5, 3, 2
    for (const minSize of [5, 3, 2]) {
      if (bestGroup) break;

      for (const statKey of statKeysToTry) {
        const facts = await ctx.db
          .query("statFacts")
          .withIndex("by_stat_key_sport", (q) =>
            q.eq("statKey", statKey).eq("sport", sport),
          )
          .collect();

        if (facts.length < 2) continue;

        // Group by full context key within this statKey
        const byFullKey = new Map<string, typeof facts>();
        for (const fact of facts) {
          const key = buildFullContextKey(fact);
          const group = byFullKey.get(key);
          if (group) {
            group.push(fact);
          } else {
            byFullKey.set(key, [fact]);
          }
        }

        // Find groups meeting the minimum size
        const validGroups = Array.from(byFullKey.entries()).filter(
          ([, g]) => g.length >= minSize,
        );

        if (validGroups.length > 0) {
          const [fullKey, groupFacts] =
            validGroups[Math.floor(Math.random() * validGroups.length)];
          bestGroup = groupFacts;
          bestFullKey = fullKey;
          bestMinSize = minSize;
          break;
        }
      }
    }

    if (!bestGroup) {
      throw new Error("No stat groups with enough entries for a game");
    }

    // Pick 2 random facts with different values
    const shuffled = shuffle([...bestGroup]);
    let factA = shuffled[0];
    let factB = shuffled[1];

    for (let i = 1; i < shuffled.length; i++) {
      if (shuffled[i].value !== factA.value) {
        factB = shuffled[i];
        break;
      }
    }

    // Look up photos/logos
    let playerAPhoto: string | undefined;
    let playerBPhoto: string | undefined;

    if (factA.entityType === "player") {
      const playerA = await ctx.db
        .query("sportsPlayers")
        .withIndex("by_external_id", (q) => q.eq("externalId", factA.entityId))
        .first();
      playerAPhoto = playerA?.photo ?? undefined;
    } else if (factA.entityType === "team") {
      const teamA = await ctx.db
        .query("sportsTeams")
        .withIndex("by_external_id", (q) => q.eq("externalId", factA.entityId))
        .first();
      playerAPhoto = teamA?.logo ?? undefined;
    }

    if (factB.entityType === "player") {
      const playerB = await ctx.db
        .query("sportsPlayers")
        .withIndex("by_external_id", (q) => q.eq("externalId", factB.entityId))
        .first();
      playerBPhoto = playerB?.photo ?? undefined;
    } else if (factB.entityType === "team") {
      const teamB = await ctx.db
        .query("sportsTeams")
        .withIndex("by_external_id", (q) => q.eq("externalId", factB.entityId))
        .first();
      playerBPhoto = teamB?.logo ?? undefined;
    }

    const sessionId = await ctx.db.insert("higherLowerSessions", {
      sport,
      score: 0,
      streak: 0,
      currentFactAId: factA.externalId,
      currentFactBId: factB.externalId,
      currentStatKey: factA.statKey,
      currentContext: factA.contextKey,
      currentEntityType: factA.entityType,
      currentSeason: factA.season ?? undefined,
      currentFullContextKey: bestFullKey,
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
      contextLabel: getContextLabel(factA.contextKey),
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
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status === "game_over") throw new Error("Game is over");

    const { playerAValue, playerBValue } = session;
    const isHigher = playerBValue > playerAValue;
    const isEqual = playerBValue === playerAValue;
    const correct = isEqual || (guess === "higher" ? isHigher : !isHigher);

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

    // Correct — B becomes A, pick new B
    const newScore = session.score + 1;
    const newStreak = session.streak + 1;

    // Query by statKey+sport (selective index), then filter by full context key
    const candidates = await ctx.db
      .query("statFacts")
      .withIndex("by_stat_key_sport", (q) =>
        q.eq("statKey", session.currentStatKey).eq("sport", session.sport),
      )
      .collect();

    const fullKey = session.currentFullContextKey;
    const filtered = candidates.filter((f) => {
      if (!fullKey) {
        // Backward compat: old sessions without fullContextKey fall back to statKey match
        return (
          f.externalId !== session.currentFactBId &&
          f.externalId !== session.currentFactAId
        );
      }
      const fKey = buildFullContextKey(f);
      return (
        fKey === fullKey &&
        f.externalId !== session.currentFactBId &&
        f.externalId !== session.currentFactAId
      );
    });

    if (filtered.length === 0) {
      // No more facts — end game as a win
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

    const newFactB = filtered[Math.floor(Math.random() * filtered.length)];

    // Look up photo for new fact B
    let newBPhoto: string | undefined;
    if (newFactB.entityType === "player") {
      const player = await ctx.db
        .query("sportsPlayers")
        .withIndex("by_external_id", (q) => q.eq("externalId", newFactB.entityId))
        .first();
      newBPhoto = player?.photo ?? undefined;
    } else if (newFactB.entityType === "team") {
      const team = await ctx.db
        .query("sportsTeams")
        .withIndex("by_external_id", (q) => q.eq("externalId", newFactB.entityId))
        .first();
      newBPhoto = team?.logo ?? undefined;
    }

    await ctx.db.patch(sessionId, {
      score: newScore,
      streak: newStreak,
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
      contextLabel: getContextLabel(newFactB.contextKey),
      entityType: session.currentEntityType,
      season: session.currentSeason,
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("higherLowerSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});
