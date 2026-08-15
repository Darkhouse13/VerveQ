import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
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
export const CAREER_PATH_LADDER_ROUNDS = 10;
export const CAREER_PATH_LADDER_ROUND_MS = 30_000;
export const CAREER_PATH_LADDER_REVEAL_MS = 1_300;

const CAREER_PATH_MODES = ["classic", "ladder"] as const;
type CareerPathMode = (typeof CAREER_PATH_MODES)[number];

const LADDER_DIFFICULTIES = ["easy", "medium", "hard", "impossible"] as const;
type LadderDifficulty = (typeof LADDER_DIFFICULTIES)[number];
const LADDER_ROUND_DIFFICULTIES: readonly LadderDifficulty[] = [
  "easy", "easy",
  "medium", "medium", "medium",
  "hard", "hard", "hard",
  "impossible", "impossible",
];

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

/**
 * The social format promises complete, readable paths and an escalating final
 * pair. The source set has easy / medium / hard labels, so "impossible" draws
 * from the hard pool but is presented as the ladder's final tier. Seven clubs
 * is the same whole-path cap used by the reels; it is a selection rule, never
 * permission to truncate question content.
 */
function getLadderEntries(difficulty: LadderDifficulty): CareerPathEntry[] {
  const sourceDifficulty = difficulty === "impossible" ? "hard" : difficulty;
  const entries = getEntriesForDifficulty(sourceDifficulty).filter(
    (entry) => entry.clubs.length <= 7,
  );

  if (difficulty !== "impossible") return entries;

  // Reserve the denser hard paths for the two final rungs. The fallback keeps
  // the mode available if content curation ever temporarily thins this pool.
  const densePaths = entries.filter((entry) => entry.clubs.length >= 5);
  return densePaths.length >= 2 ? densePaths : entries;
}

/** Select the advertised 2/3/3/2 run once. The name-bearing IDs never leave
 * Convex; subsequent rounds inherit this queue through their session rows. */
export function buildLadderEntryQueue(random: () => number = Math.random): string[] {
  const used = new Set<string>();
  return LADDER_ROUND_DIFFICULTIES.map((difficulty) => {
    const candidates = getLadderEntries(difficulty).filter((entry) => !used.has(entry.id));
    if (candidates.length === 0) {
      throw new Error(`Not enough unique ${difficulty} career paths for the ladder`);
    }
    const entry = candidates[Math.floor(random() * candidates.length)];
    used.add(entry.id);
    return entry.id;
  });
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
    mode: v.optional(v.union(v.literal("classic"), v.literal("ladder"))),
    ladderRound: v.optional(v.number()),
    excludedEntryIds: v.optional(v.array(v.string())),
    guestToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { sport, difficulty, mode = "classic", guestToken },
  ) => {
    const actor = await resolveActor(ctx, guestToken);
    if (!actor.userId && !actor.guestHash) {
      // Logged out and no usable guest token — the client always supplies one.
      throw new Error("A guest token is required to play as a guest");
    }

    if (sport !== CAREER_PATH_SPORT) {
      throw new Error("Career Path is not available for this sport");
    }

    if (!(CAREER_PATH_MODES as readonly string[]).includes(mode)) {
      throw new Error("Unknown Career Path mode");
    }

    let entry: CareerPathEntry;
    let sessionDifficulty: string;
    let ladderEntryIds: string[] | undefined;

    if (mode === "ladder") {
      ladderEntryIds = buildLadderEntryQueue();
      entry = ENTRIES.find((candidate) => candidate.id === ladderEntryIds![0])!;
      sessionDifficulty = LADDER_ROUND_DIFFICULTIES[0];
    } else if (difficulty) {
      const entries = getEntriesForDifficulty(difficulty);
      if (entries.length === 0) throw new Error("No career paths available for this difficulty");
      entry = entries[Math.floor(Math.random() * entries.length)];
      sessionDifficulty = entry.difficulty;
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
      const entries = selectedPool.entries as CareerPathEntry[];
      entry = entries[Math.floor(Math.random() * entries.length)];
      sessionDifficulty = entry.difficulty;
    }

    const now = Date.now();
    const startsAt = mode === "ladder" ? now : undefined;
    const deadlineAt = startsAt !== undefined
      ? startsAt + CAREER_PATH_LADDER_ROUND_MS
      : undefined;

    const sessionId = await ctx.db.insert("careerPathSessions", {
      ...(actor.userId ? { userId: actor.userId } : {}),
      ...(actor.guestHash ? { guestTokenHash: actor.guestHash } : {}),
      sport,
      entryId: entry.id,
      answerName: entry.answerName,
      clubs: entry.clubs,
      difficulty: sessionDifficulty,
      mode,
      ...(mode === "ladder" ? { ladderRound: 1, ladderEntryIds, startsAt } : {}),
      ...(deadlineAt ? { deadlineAt } : {}),
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
      difficulty: sessionDifficulty,
      mode,
      ...(mode === "ladder" ? { ladderRound: 1, startsAt } : {}),
      ...(deadlineAt ? { deadlineAt } : {}),
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
  resolution?: "guessed" | "timed_out";
  nextRound?: PreparedLadderRound;
};

async function incrementCompletedCareerGame(
  ctx: MutationCtx,
  session: { userId?: Id<"users">; mode?: CareerPathMode; ladderRound?: number },
): Promise<void> {
  if (!session.userId) return;
  if (session.mode === "ladder" && session.ladderRound !== CAREER_PATH_LADDER_ROUNDS) return;
  await incrementTotalGames(ctx, session.userId);
}

type PreparedLadderRound = {
  sessionId: Id<"careerPathSessions">;
  clubs: CareerPathClub[];
  difficulty: LadderDifficulty;
  mode: "ladder";
  ladderRound: number;
  startsAt: number;
  deadlineAt: number;
  score: number;
  maxGuesses: number;
  wrongGuessCount: number;
  guesses: never[];
};

/** Create the next rung inside the mutation that settles the current one.
 * The browser receives only public prompt data; the queued ID and answer stay
 * in the new server session. Its clock begins when the reveal ends. */
async function prepareNextLadderRound(
  ctx: MutationCtx,
  session: Doc<"careerPathSessions">,
): Promise<PreparedLadderRound | null> {
  const currentRound = session.ladderRound ?? 0;
  if (
    session.mode !== "ladder" ||
    currentRound >= CAREER_PATH_LADDER_ROUNDS ||
    session.ladderEntryIds?.length !== CAREER_PATH_LADDER_ROUNDS
  ) {
    return null;
  }

  const nextRound = currentRound + 1;
  const entryId = session.ladderEntryIds[nextRound - 1];
  const entry = ENTRIES.find((candidate) => candidate.id === entryId);
  if (!entry) throw new Error("Queued career path is unavailable");

  const startsAt = Date.now() + CAREER_PATH_LADDER_REVEAL_MS;
  const deadlineAt = startsAt + CAREER_PATH_LADDER_ROUND_MS;
  const difficulty = LADDER_ROUND_DIFFICULTIES[nextRound - 1];
  const sessionId = await ctx.db.insert("careerPathSessions", {
    ...(session.userId ? { userId: session.userId } : {}),
    ...(session.guestTokenHash ? { guestTokenHash: session.guestTokenHash } : {}),
    sport: session.sport,
    entryId,
    answerName: entry.answerName,
    clubs: entry.clubs,
    difficulty,
    mode: "ladder",
    ladderRound: nextRound,
    ladderEntryIds: session.ladderEntryIds,
    startsAt,
    deadlineAt,
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
    difficulty,
    mode: "ladder",
    ladderRound: nextRound,
    startsAt,
    deadlineAt,
    score: BASE_SCORE,
    maxGuesses: CAREER_PATH_MAX_GUESSES,
    wrongGuessCount: 0,
    guesses: [],
  };
}

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
    if (session.mode === "ladder" && session.startsAt && Date.now() < session.startsAt) {
      throw new Error("Round has not started");
    }
    if (session.mode === "ladder" && session.deadlineAt && Date.now() >= session.deadlineAt) {
      await incrementCompletedCareerGame(ctx, session);
      await ctx.db.patch(sessionId, {
        status: "failed",
        score: 0,
        resolution: "timed_out",
      });
      const nextRound = await prepareNextLadderRound(ctx, session);
      return {
        correct: false,
        closeCall: false,
        typoAccepted: false,
        answerName: session.answerName,
        score: 0,
        gameOver: true,
        resolution: "timed_out",
        ...(nextRound ? { nextRound } : {}),
      };
    }
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
      await incrementCompletedCareerGame(ctx, session);
      await ctx.db.patch(sessionId, { status: "correct", resolution: "guessed" });
      const nextRound = await prepareNextLadderRound(ctx, session);
      return {
        correct: true,
        closeCall: false,
        typoAccepted: result.typoAccepted,
        answerName: session.answerName,
        score: session.score,
        gameOver: true,
        resolution: "guessed",
        ...(nextRound ? { nextRound } : {}),
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
      await incrementCompletedCareerGame(ctx, session);
    }
    await ctx.db.patch(sessionId, {
      status: gameOver ? "failed" : "active",
      score: newScore,
      guesses,
      wrongGuessCount,
      ...(gameOver ? { resolution: "guessed" as const } : {}),
    });
    const nextRound = gameOver ? await prepareNextLadderRound(ctx, session) : null;
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
    return gameOver
      ? {
          ...response,
          answerName: session.answerName,
          resolution: "guessed" as const,
          ...(nextRound ? { nextRound } : {}),
        }
      : response;
  },
});

/** Resolve one ladder rung without a guess. Skip is immediate; timeout is
 * server-checked against the deadline so a modified client cannot end a round
 * early while claiming the clock expired. The answer is revealed only after
 * the session has been made terminal. */
export const resolveLadderChallenge = mutation({
  args: {
    sessionId: v.id("careerPathSessions"),
    reason: v.union(v.literal("skipped"), v.literal("timed_out")),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, reason, guestToken }) => {
    const actor = await resolveActor(ctx, guestToken);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!ownsSession(session, actor)) throw new Error("Not authorized");
    if (session.mode !== "ladder") throw new Error("This is not a ladder session");
    if (session.status !== "active") throw new Error("Game is not active");
    if (session.startsAt && Date.now() < session.startsAt) {
      throw new Error("Round has not started");
    }
    if (reason === "timed_out" && session.deadlineAt && Date.now() < session.deadlineAt) {
      throw new Error("Round timer is still running");
    }

    await incrementCompletedCareerGame(ctx, session);
    await ctx.db.patch(sessionId, { status: "failed", score: 0, resolution: reason });
    const nextRound = await prepareNextLadderRound(ctx, session);
    return {
      correct: false,
      closeCall: false,
      typoAccepted: false,
      answerName: session.answerName,
      score: 0,
      gameOver: true,
      resolution: reason,
      ...(nextRound ? { nextRound } : {}),
    };
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
    if (session.mode === "ladder") {
      // The real-time ladder clock keeps running while hidden; switching tabs
      // does not kill the whole ten-round run.
      return { penalized: false, gameOver: false, score: session.score };
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
      mode: session.mode ?? "classic",
      ladderRound: session.ladderRound,
      deadlineAt: session.deadlineAt,
      score: session.score,
      status: session.status,
      expiresAt: session.expiresAt,
      guesses: session.guesses,
      wrongGuessCount: session.wrongGuessCount,
      maxGuesses: session.maxGuesses,
    };
  },
});
