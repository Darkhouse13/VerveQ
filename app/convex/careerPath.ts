import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { findBestMatch } from "./lib/fuzzy";
import { incrementTotalGames } from "./lib/playCount";
import type { CareerPathClub } from "./lib/careerPathClubs";
import careerPathEntries from "./data/football_career_paths.json";

/**
 * Career Path (solo, casual) — guess the player from the chronological list of
 * clubs he played for. The whole path is shown up front; there is NO
 * autocomplete/suggestion layer by design (contrast with VerveGrid's roster
 * search): the player types a name and the server grades it with the shared
 * length-scaled fuzzy matcher (lib/fuzzy), so honest typos still land.
 *
 * GUEST-PLAYABLE with zero friction: this is the mode we market, so a logged-out
 * visitor can play immediately. Identity is either an auth userId OR an
 * unauthenticated `guestToken` (a client secret in localStorage; the server
 * stores only its hash), mirroring the duel-share-link guest model. Grading
 * still happens entirely server-side, so the answer never leaves the server.
 *
 * Content ships in-bundle (data/football_career_paths.json) — curated club
 * paths are proper nouns, so unlike Who Am I's prose clues they need no
 * translation overlay, no external pipeline, and no seeded content table.
 */

// FNV-style string hash (mirrors duels.ts / challengeArenas.ts) — the raw guest
// token is never persisted, only this hash, so a DB leak can't replay sessions.
function hashString(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function guestTokenHash(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    throw new Error("Career Path guest token must be at least 16 characters");
  }
  return hashString(`career-path-guest:${trimmed}`);
}

/**
 * Resolve who is playing. Prefer the authenticated user; otherwise fall back to
 * the guest token. Throws only if the caller is neither authed nor a guest.
 */
async function resolveActor(
  ctx: QueryCtx | MutationCtx,
  guestToken: string | undefined,
): Promise<{ userId: Id<"users"> | null; guestHash: string | null }> {
  const userId = await getAuthUserId(ctx);
  if (userId) return { userId, guestHash: null };
  if (guestToken && guestToken.trim().length >= 16) {
    return { userId: null, guestHash: guestTokenHash(guestToken) };
  }
  return { userId: null, guestHash: null };
}

/** A session belongs to the caller if the auth user OR the guest hash matches. */
function ownsSession(
  session: { userId?: Id<"users">; guestTokenHash?: string },
  actor: { userId: Id<"users"> | null; guestHash: string | null },
): boolean {
  if (session.userId) return actor.userId === session.userId;
  if (session.guestTokenHash) return actor.guestHash === session.guestTokenHash;
  return false;
}

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
  /**
   * Chronological senior-career clubs — the question content. A club is a bare
   * name for a permanent spell, or `{ name, loan: true }` for a loan spell.
   */
  clubs: CareerPathClub[];
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
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { sport, difficulty, guestToken }) => {
    const actor = await resolveActor(ctx, guestToken);
    if (!actor.userId && !actor.guestHash) {
      // Logged out and no usable guest token — the client always supplies one.
      throw new Error("A guest token is required to play as a guest");
    }

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
      ...(actor.userId ? { userId: actor.userId } : {}),
      ...(actor.guestHash ? { guestTokenHash: actor.guestHash } : {}),
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
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, guess, guestToken }): Promise<SubmitGuessResult> => {
    const actor = await resolveActor(ctx, guestToken);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!ownsSession(session, actor)) {
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
      if (actor.userId) await incrementTotalGames(ctx, actor.userId);
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

    if (gameOver && actor.userId) {
      await incrementTotalGames(ctx, actor.userId);
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
  args: {
    sessionId: v.id("careerPathSessions"),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, guestToken }) => {
    const actor = await resolveActor(ctx, guestToken);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!ownsSession(session, actor)) {
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
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, guestToken }) => {
    const actor = await resolveActor(ctx, guestToken);
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (!ownsSession(session, actor)) return null;

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
