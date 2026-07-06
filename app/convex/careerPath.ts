import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertUsernameRequiredUser } from "./lib/authz";
import { findBestMatch } from "./lib/fuzzy";
import { incrementTotalGames } from "./lib/playCount";
import careerPathEntries from "./data/football_career_paths.json";

/**
 * Career Path (solo, casual) — guess the player from the chronological list of
 * clubs he played for. The whole path is shown up front; there is NO
 * autocomplete/suggestion layer by design (contrast with VerveGrid's roster
 * search): the player types a name and the server grades it with the shared
 * length-scaled fuzzy matcher (lib/fuzzy), so honest typos still land.
 *
 * Content ships in-bundle (data/football_career_paths.json) — curated club
 * paths are proper nouns, so unlike Who Am I's prose clues they need no
 * translation overlay, no external pipeline, and no seeded content table.
 */

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const BASE_SCORE = 1000;
const CLOSE_CALL_SCORE_MULTIPLIER = 0.9;
const WRONG_GUESS_SCORE_MULTIPLIER = 0.5;
export const CAREER_PATH_MAX_GUESSES = 3;
export const CAREER_PATH_SPORT = "football";

const DEFAULT_DIFFICULTY_WEIGHTS = [
  { difficulty: "easy", weight: 0.3 },
  { difficulty: "medium", weight: 0.5 },
  { difficulty: "hard", weight: 0.2 },
] as const;

export interface CareerPathEntry {
  id: string;
  answerName: string;
  /** Extra gradeable names (nicknames, common short forms). */
  acceptedAnswers?: string[];
  /** Chronological senior-career clubs — the question content. */
  clubs: string[];
  difficulty: string;
}

const ENTRIES: CareerPathEntry[] = careerPathEntries as CareerPathEntry[];

export function getCareerPathEntries(): CareerPathEntry[] {
  return ENTRIES;
}

function getEntriesForDifficulty(difficulty: string): CareerPathEntry[] {
  return ENTRIES.filter((entry) => entry.difficulty === difficulty);
}

function chooseWeightedDifficultyPool<
  T extends { difficulty: string; weight: number; entries: unknown[] },
>(pools: T[]): T | null {
  const availablePools = pools.filter((pool) => pool.entries.length > 0);
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

/**
 * Gradeable name variants for an entry. Deliberately NO bare-initials alias
 * (unlike the old Who Am I builder): with the fuzzy budget, a 2-letter alias
 * would accept nearly any 1-2 character guess.
 */
export function buildCareerPathAnswerAliases(
  answerName: string,
  acceptedAnswers?: string[],
): string[] {
  const aliases = new Set<string>();
  for (const source of [answerName, ...(acceptedAnswers ?? [])]) {
    aliases.add(source);
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      aliases.add(parts[parts.length - 1]); // bare surname — what most players type
      aliases.add(parts.slice(1).join(" ")); // multiword surnames ("van Dijk")
      aliases.add(`${parts[0][0]} ${parts[parts.length - 1]}`);
      aliases.add(`${parts[0][0]}. ${parts[parts.length - 1]}`);
    }
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
    await assertUsernameRequiredUser(ctx, userId);

    if (sport !== CAREER_PATH_SPORT) {
      throw new Error("Career Path is not available for this sport");
    }

    let entries: CareerPathEntry[];
    if (difficulty) {
      entries = getEntriesForDifficulty(difficulty);
      if (entries.length === 0) {
        throw new Error("No career paths available for this difficulty");
      }
    } else {
      const selectedPool = chooseWeightedDifficultyPool(
        DEFAULT_DIFFICULTY_WEIGHTS.map(({ difficulty: poolDifficulty, weight }) => ({
          difficulty: poolDifficulty,
          weight,
          entries: getEntriesForDifficulty(poolDifficulty),
        })),
      );
      if (!selectedPool) {
        throw new Error("Career Path is not available right now");
      }
      entries = selectedPool.entries as CareerPathEntry[];
    }

    const entry = entries[Math.floor(Math.random() * entries.length)];

    const sessionId = await ctx.db.insert("careerPathSessions", {
      userId,
      sport,
      entryId: entry.id,
      answerName: entry.answerName,
      clubs: entry.clubs,
      difficulty: entry.difficulty,
      score: BASE_SCORE,
      status: "active",
      expiresAt: Date.now() + SESSION_TTL_MS,
      closeCallCount: 0,
      guesses: [],
      maxGuesses: CAREER_PATH_MAX_GUESSES,
      wrongGuessCount: 0,
    });

    return {
      sessionId,
      clubs: entry.clubs,
      difficulty: entry.difficulty,
      score: BASE_SCORE,
      maxGuesses: CAREER_PATH_MAX_GUESSES,
      wrongGuessCount: 0,
      guesses: [],
    };
  },
});

type CareerPathGuess = {
  guessName: string;
  correct: boolean;
  closeCall: boolean;
  scoreAfter: number;
  createdAt: number;
};

// One result shape across the correct / close-call / wrong branches; fields
// that only some branches produce are optional.
type SubmitGuessResult = {
  correct: boolean;
  closeCall: boolean;
  typoAccepted: boolean;
  score: number;
  gameOver: boolean;
  answerName?: string;
  wrongGuessCount?: number;
  maxGuesses?: number;
  guesses?: CareerPathGuess[];
};

export const submitGuess = mutation({
  args: {
    sessionId: v.id("careerPathSessions"),
    guess: v.string(),
  },
  handler: async (ctx, { sessionId, guess }): Promise<SubmitGuessResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status !== "active") throw new Error("Game is not active");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { status: "failed", score: 0 });
      throw new Error("Session expired");
    }

    const entry = ENTRIES.find((candidate) => candidate.id === session.entryId);
    const result = findBestMatch(
      guess,
      buildCareerPathAnswerAliases(session.answerName, entry?.acceptedAnswers),
    );

    if (result.matched) {
      await incrementTotalGames(ctx, userId);
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
      // A near-miss (1-2 edits past the typo budget) costs a little score but
      // NOT a guess — the player is probably fighting spelling, not knowledge.
      const newScore = Math.floor(session.score * CLOSE_CALL_SCORE_MULTIPLIER);
      await ctx.db.patch(sessionId, {
        score: newScore,
        closeCallCount: session.closeCallCount + 1,
        guesses: [
          ...session.guesses,
          {
            guessName: guess.trim(),
            correct: false,
            closeCall: true,
            scoreAfter: newScore,
            createdAt: Date.now(),
          },
        ],
      });
      return {
        correct: false,
        closeCall: true,
        typoAccepted: false,
        score: newScore,
        gameOver: false,
        wrongGuessCount: session.wrongGuessCount,
        maxGuesses: session.maxGuesses,
      };
    }

    const wrongGuessCount = session.wrongGuessCount + 1;
    const gameOver = wrongGuessCount >= session.maxGuesses;
    // Each wrong guess halves the remaining potential; a failed round earns 0.
    const newScore = gameOver ? 0 : Math.floor(session.score * WRONG_GUESS_SCORE_MULTIPLIER);
    const guesses = [
      ...session.guesses,
      {
        guessName: guess.trim(),
        correct: false,
        closeCall: false,
        scoreAfter: newScore,
        createdAt: Date.now(),
      },
    ];

    if (gameOver) {
      await incrementTotalGames(ctx, userId);
    }
    await ctx.db.patch(sessionId, {
      status: gameOver ? "failed" : "active",
      score: newScore,
      guesses,
      wrongGuessCount,
    });
    const response = {
      correct: false,
      closeCall: false,
      typoAccepted: false,
      score: newScore,
      gameOver,
      wrongGuessCount,
      maxGuesses: session.maxGuesses,
      guesses,
    };
    return gameOver ? { ...response, answerName: session.answerName } : response;
  },
});

export const penalizeTabSwitch = mutation({
  args: { sessionId: v.id("careerPathSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
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
  args: {
    sessionId: v.id("careerPathSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId !== userId) return null;

    // answerName NEVER leaves the server through this query — reveals happen
    // only through submitGuess's terminal responses.
    return {
      _id: session._id,
      sport: session.sport,
      clubs: session.clubs,
      difficulty: session.difficulty,
      score: session.score,
      status: session.status,
      expiresAt: session.expiresAt,
      guesses: session.guesses,
      wrongGuessCount: session.wrongGuessCount,
      maxGuesses: session.maxGuesses,
    };
  },
});
