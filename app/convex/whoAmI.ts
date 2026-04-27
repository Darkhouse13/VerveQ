import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { findBestMatch } from "./lib/fuzzy";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const BASE_SCORE = 1000;
const CLOSE_CALL_SCORE_MULTIPLIER = 0.9;
const DEFAULT_DIFFICULTY_WEIGHTS = [
  { difficulty: "easy", weight: 0.3 },
  { difficulty: "medium", weight: 0.5 },
  { difficulty: "hard", weight: 0.2 },
] as const;

async function getApprovedWhoAmICluesForDifficulty(
  ctx: MutationCtx,
  sport: string,
  difficulty: string,
) {
  return ctx.db
    .query("whoAmIApprovedClues")
    .withIndex("by_sport_difficulty", (q) =>
      q.eq("sport", sport).eq("difficulty", difficulty),
    )
    .collect();
}

function chooseWeightedDifficultyPool<
  T extends { difficulty: string; weight: number; clues: unknown[] },
>(pools: T[]): T | null {
  const availablePools = pools.filter((pool) => pool.clues.length > 0);
  if (availablePools.length === 0) return null;

  const totalWeight = availablePools.reduce((sum, pool) => sum + pool.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const pool of availablePools) {
    roll -= pool.weight;
    if (roll <= 0) {
      return pool;
    }
  }

  return availablePools[availablePools.length - 1];
}

function buildAnswerAliases(answerName: string): string[] {
  const parts = answerName.split(/\s+/).filter(Boolean);
  const aliases = new Set([answerName]);
  if (parts.length >= 2) {
    aliases.add(`${parts[0][0]} ${parts[parts.length - 1]}`);
    aliases.add(`${parts[0][0]}. ${parts[parts.length - 1]}`);
    aliases.add(parts.map((part) => part[0]).join(""));
  }
  return [...aliases];
}

export const startChallenge = mutation({
  args: {
    sport: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { sport, difficulty }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    let clues;

    if (difficulty) {
      clues = await getApprovedWhoAmICluesForDifficulty(ctx, sport, difficulty);
      if (clues.length === 0) {
        throw new Error("No approved clues available for this sport and difficulty");
      }
    } else {
      const difficultyPools = await Promise.all(
        DEFAULT_DIFFICULTY_WEIGHTS.map(async ({ difficulty: poolDifficulty, weight }) => ({
          difficulty: poolDifficulty,
          weight,
          clues: await getApprovedWhoAmICluesForDifficulty(ctx, sport, poolDifficulty),
        })),
      );
      const selectedPool = chooseWeightedDifficultyPool(difficultyPools);
      if (!selectedPool) {
        throw new Error("Who Am I is not available for this sport");
      }
      clues = selectedPool.clues;
    }

    if (!clues || clues.length === 0) {
      throw new Error("Who Am I is not available for this sport");
    }

    const clue = clues[Math.floor(Math.random() * clues.length)];

    const sessionId = await ctx.db.insert("whoAmISessions", {
      userId,
      sport,
      clueExternalId: clue.externalId,
      answerName: clue.answerName,
      currentStage: 1,
      score: BASE_SCORE,
      status: "active",
      expiresAt: Date.now() + SESSION_TTL_MS,
      closeCallCount: 0,
    });

    return {
      sessionId,
      clue1: clue.clue1,
      currentStage: 1,
      score: BASE_SCORE,
      difficulty: clue.difficulty,
    };
  },
});

export const revealNextClue = mutation({
  args: {
    sessionId: v.id("whoAmISessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status !== "active") throw new Error("Game is not active");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { status: "failed", score: 0 });
      throw new Error("Session expired");
    }
    if (session.currentStage >= 4) throw new Error("All clues already revealed");

    const newStage = session.currentStage + 1;
    const newScore = Math.floor(session.score * 0.75);

    const clue = await ctx.db
      .query("whoAmIApprovedClues")
      .withIndex("by_external_id", (q) => q.eq("externalId", session.clueExternalId))
      .first();

    if (!clue) throw new Error("Clue data not found");

    await ctx.db.patch(sessionId, {
      currentStage: newStage,
      score: newScore,
    });

    const clueKey = `clue${newStage}` as keyof typeof clue;
    return {
      clueText: clue[clueKey] as string,
      currentStage: newStage,
      score: newScore,
    };
  },
});

export const submitGuess = mutation({
  args: {
    sessionId: v.id("whoAmISessions"),
    guess: v.string(),
  },
  handler: async (ctx, { sessionId, guess }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status !== "active") throw new Error("Game is not active");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { status: "failed", score: 0 });
      throw new Error("Session expired");
    }

    const result = findBestMatch(guess, buildAnswerAliases(session.answerName));

    if (result.matched) {
      await ctx.db.patch(sessionId, { status: "correct" });
      return {
        correct: true,
        closeCall: false,
        typoAccepted: result.typoAccepted,
        answerName: session.answerName,
        score: session.score,
        gameOver: true,
      };
    }

    if (result.closeCall) {
      const newScore = Math.floor(session.score * CLOSE_CALL_SCORE_MULTIPLIER);
      await ctx.db.patch(sessionId, {
        score: newScore,
        closeCallCount: (session.closeCallCount ?? 0) + 1,
      });
      return {
        correct: false,
        closeCall: true,
        typoAccepted: false,
        score: newScore,
        gameOver: false,
      };
    }

    await ctx.db.patch(sessionId, { status: "failed", score: 0 });
    return {
      correct: false,
      closeCall: false,
      typoAccepted: false,
      answerName: session.currentStage >= 4 ? session.answerName : undefined,
      score: 0,
      gameOver: true,
    };
  },
});

export const penalizeTabSwitch = mutation({
  args: { sessionId: v.id("whoAmISessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status !== "active") {
      return { penalized: false, gameOver: true, score: session.score };
    }

    await ctx.db.patch(sessionId, { status: "failed", score: 0 });
    return { penalized: true, gameOver: true, score: 0 };
  },
});

export const getSession = query({
  args: { sessionId: v.id("whoAmISessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId && session.userId !== userId) return null;

    const clue = await ctx.db
      .query("whoAmIApprovedClues")
      .withIndex("by_external_id", (q) => q.eq("externalId", session.clueExternalId))
      .first();

    if (!clue) return null;

    const clues: string[] = [];
    for (let i = 1; i <= session.currentStage; i++) {
      const key = `clue${i}` as keyof typeof clue;
      clues.push(clue[key] as string);
    }

    // answerName is the hidden truth. Only expose it once the game ends
    // — submitGuess already reveals it in its response on correct/failed.
    const revealed =
      session.status === "correct" ||
      (session.status === "failed" && session.currentStage >= 4);
    return {
      _id: session._id,
      sport: session.sport,
      currentStage: session.currentStage,
      score: session.score,
      status: session.status,
      expiresAt: session.expiresAt,
      clues,
      difficulty: clue.difficulty,
      answerName: revealed ? session.answerName : null,
    };
  },
});
