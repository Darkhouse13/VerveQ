import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { findBestMatch } from "./lib/fuzzy";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const BASE_SCORE = 1000;

export const startChallenge = mutation({
  args: {
    sport: v.string(),
    difficulty: v.optional(v.string()),
  },
  handler: async (ctx, { sport, difficulty }) => {
    // Fetch clues filtered by sport (and optionally difficulty)
    let clues;
    if (difficulty) {
      // Explicit difficulty — use as-is
      clues = await ctx.db
        .query("whoAmIClues")
        .withIndex("by_sport_difficulty", (q) =>
          q.eq("sport", sport).eq("difficulty", difficulty),
        )
        .collect();
    } else {
      // No difficulty specified: weighted random, excluding "hard"
      const easyClues = await ctx.db
        .query("whoAmIClues")
        .withIndex("by_sport_difficulty", (q) =>
          q.eq("sport", sport).eq("difficulty", "easy"),
        )
        .collect();

      const mediumClues = await ctx.db
        .query("whoAmIClues")
        .withIndex("by_sport_difficulty", (q) =>
          q.eq("sport", sport).eq("difficulty", "medium"),
        )
        .collect();

      // Weighted selection: 70% easy, 30% medium
      const roll = Math.random();
      if (roll < 0.7 && easyClues.length > 0) {
        clues = easyClues;
      } else if (mediumClues.length > 0) {
        clues = mediumClues;
      } else {
        // Fallback: use whichever pool is non-empty
        clues = easyClues.length > 0 ? easyClues : mediumClues;
      }
    }

    if (!clues || clues.length === 0) {
      throw new Error("No clues available for this sport");
    }

    // Pick a random clue from the selected pool
    const clue = clues[Math.floor(Math.random() * clues.length)];

    const sessionId = await ctx.db.insert("whoAmISessions", {
      sport,
      clueExternalId: clue.externalId,
      answerName: clue.answerName,
      currentStage: 1,
      score: BASE_SCORE,
      status: "active",
      expiresAt: Date.now() + SESSION_TTL_MS,
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
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Game is not active");
    if (session.currentStage >= 4) throw new Error("All clues already revealed");

    const newStage = session.currentStage + 1;
    // Each reveal reduces score by 25%
    const newScore = Math.floor(session.score * 0.75);

    // Fetch the clue data
    const clue = await ctx.db
      .query("whoAmIClues")
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
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Game is not active");

    const result = findBestMatch(guess, [session.answerName]);

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
      return {
        correct: false,
        closeCall: true,
        typoAccepted: false,
        score: session.score,
        gameOver: false,
      };
    }

    // Wrong guess — game over
    await ctx.db.patch(sessionId, { status: "failed" });
    return {
      correct: false,
      closeCall: false,
      typoAccepted: false,
      answerName: session.answerName,
      score: 0,
      gameOver: true,
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("whoAmISessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    // Fetch clue data to return revealed clues
    const clue = await ctx.db
      .query("whoAmIClues")
      .withIndex("by_external_id", (q) => q.eq("externalId", session.clueExternalId))
      .first();

    if (!clue) return null;

    // Only return clues up to currentStage
    const clues: string[] = [];
    for (let i = 1; i <= session.currentStage; i++) {
      const key = `clue${i}` as keyof typeof clue;
      clues.push(clue[key] as string);
    }

    return {
      ...session,
      clues,
      difficulty: clue.difficulty,
    };
  },
});
