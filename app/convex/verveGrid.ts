import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertUsernameRequiredUser } from "./lib/authz";
import { normalizeAnswer } from "./lib/scoring";
import { incrementTotalGames } from "./lib/playCount";
import { levenshteinDistance } from "./lib/fuzzy";
import {
  expandPlayerDisplayName,
  playerSearchTokens,
} from "./lib/playerSearch";
import {
  acceptedTiersFor,
  DEFAULT_DIFFICULTY,
  difficultyArg,
  difficultyFallbackChain,
  type DifficultyLevel,
} from "./lib/gameDifficulty";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_GUESSES = 9;
const MIN_QUERY_LENGTH = 2;

/**
 * Does this player match the search query? Matches across the player's full
 * token bag (display name + first name + last name), so "Harry Kane" finds a
 * row stored as name "H. Kane" / firstName "Harry Edward" / lastName "Kane",
 * and "Haaland" finds a compound lastName "Braut Haaland". `normalizedQuery`
 * must already be normalizeAnswer()'d by the caller.
 */
function matchesPlayerSearch(player: RosterPlayer, normalizedQuery: string): boolean {
  const tokens = playerSearchTokens(player.name, player.firstName, player.lastName);
  if (tokens.length === 0) return false;

  // Whole-query substring over the token bag — handles partial single tokens
  // ("fost" → "foster") and contiguous multi-token queries.
  if (tokens.join(" ").includes(normalizedQuery)) return true;

  // Otherwise every query token must hit some name token (prefix or typo-close).
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return false;
  return queryTokens.every((queryToken) => {
    const maxDistance = queryToken.length < 5 ? 1 : 2;
    return tokens.some(
      (token) =>
        token.startsWith(queryToken) ||
        levenshteinDistance(queryToken, token) <= maxDistance,
    );
  });
}

/**
 * Index-range prefixes to scan for a roster search. Stored names/surnames are
 * capitalized ("Jack Butland", "B. Foster" / lastName "Foster"), so we probe
 * the query as typed plus a title-cased variant.
 */
export function buildRosterSearchPrefixes(queryText: string): string[] {
  const trimmed = queryText.trim().replace(/\s+/g, " ");
  if (!trimmed) return [];
  const titleCased = trimmed
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
  return [...new Set([trimmed, titleCased])];
}

type RosterPlayer = {
  externalId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  position?: string;
  nationality?: string;
};

/** 0 if the player's (expanded) display name starts with the query — these lead. */
function leadsByPrefix(player: RosterPlayer, normalizedQuery: string): number {
  const display = expandPlayerDisplayName(player.name, player.firstName, player.lastName);
  return normalizeAnswer(display).startsWith(normalizedQuery) ? 0 : 1;
}

/** Rank + dedupe + cap full-roster search hits. Pure so the contract can pin it. */
export function rankRosterSearchResults<T extends RosterPlayer>(
  players: T[],
  queryText: string,
  excludedExternalIds: ReadonlySet<string> = new Set(),
  limit = 10,
): T[] {
  const normalized = normalizeAnswer(queryText);
  const seen = new Set<string>();
  return players
    .filter((player) => {
      if (seen.has(player.externalId)) return false;
      seen.add(player.externalId);
      return (
        !excludedExternalIds.has(player.externalId) &&
        matchesPlayerSearch(player, normalized)
      );
    })
    .sort((a, b) => {
      const aStarts = leadsByPrefix(a, normalized);
      const bStarts = leadsByPrefix(b, normalized);
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function getCellRarity(validAnswerCount: number) {
  if (validAnswerCount <= 3) {
    return { rarityTier: "rare", points: 3 };
  }
  if (validAnswerCount <= 10) {
    return { rarityTier: "uncommon", points: 2 };
  }
  return { rarityTier: "common", points: 1 };
}

function publicCellMetadata(cell: { rowIdx: number; colIdx: number; validPlayerIds: string[] }) {
  const validAnswerCount = cell.validPlayerIds.length;
  return {
    rowIdx: cell.rowIdx,
    colIdx: cell.colIdx,
    validAnswerCount,
    ...getCellRarity(validAnswerCount),
  };
}

export const startSession = mutation({
  args: { sport: v.string(), difficulty: difficultyArg },
  handler: async (ctx, { sport, difficulty }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertUsernameRequiredUser(ctx, userId);
    if (sport !== "football") {
      throw new Error("VerveGrid is currently available for football only");
    }

    const boards = await ctx.db
      .query("verveGridBoards")
      .withIndex("by_sport", (q) => q.eq("sport", sport))
      .collect();

    if (boards.length === 0) {
      throw new Error("No curated VerveGrid boards are available for this sport");
    }

    const playableBoards = boards.filter(
      (board) =>
        board.cells.length === 9 &&
        board.cells.every((cell) => cell.validPlayerIds.length > 0),
    );

    if (playableBoards.length === 0) {
      throw new Error("No playable VerveGrid boards are available for this sport");
    }

    // Pick the requested difficulty's board pool. Widen toward "hard" if it's
    // empty (e.g. easy/intermediate boards not seeded yet) so a grid always
    // starts. A board with no difficulty tag is treated as "hard".
    const requested: DifficultyLevel = difficulty ?? DEFAULT_DIFFICULTY;
    let servedDifficulty: DifficultyLevel = requested;
    let difficultyPool = playableBoards;
    for (const level of difficultyFallbackChain(requested)) {
      const accepted = acceptedTiersFor(level);
      const pool = playableBoards.filter((board) =>
        accepted.has((board.difficulty as DifficultyLevel | undefined) ?? "hard"),
      );
      if (pool.length > 0) {
        servedDifficulty = level;
        difficultyPool = pool;
        break;
      }
    }

    const chosenBoard =
      difficultyPool[Math.floor(Math.random() * difficultyPool.length)];

    const sessionId = await ctx.db.insert("verveGridSessions", {
      userId,
      sport,
      difficulty: servedDifficulty,
      boardTemplateId: chosenBoard.templateId,
      boardAxisFamily: chosenBoard.axisFamily,
      rows: chosenBoard.rows,
      cols: chosenBoard.cols,
      cells: chosenBoard.cells.map((cell) => ({
        ...cell,
        guessedPlayerId: undefined,
        guessedPlayerName: undefined,
        correct: undefined,
      })),
      remainingGuesses: MAX_GUESSES,
      correctCount: 0,
      status: "active",
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return {
      sessionId,
      difficulty: servedDifficulty,
      boardTemplateId: chosenBoard.templateId,
      boardAxisFamily: chosenBoard.axisFamily,
      rows: chosenBoard.rows,
      cols: chosenBoard.cols,
      cells: chosenBoard.cells.map(publicCellMetadata),
      remainingGuesses: MAX_GUESSES,
      correctCount: 0,
    };
  },
});

export const searchPlayers = query({
  args: {
    queryText: v.string(),
    sport: v.string(),
    sessionId: v.optional(v.id("verveGridSessions")),
    cellIndex: v.optional(v.number()),
  },
  handler: async (ctx, { queryText, sport, sessionId, cellIndex }) => {
    if (queryText.length < MIN_QUERY_LENGTH) {
      return [];
    }

    // Search spans the FULL roster — never the cell's valid answers. Whether a
    // pick counts is only decided server-side on lock-in (submitGuess), so the
    // search box can't be used as an answer oracle.
    const usedPlayerIds = new Set<string>();
    if (sessionId !== undefined && cellIndex !== undefined) {
      const userId = await getAuthUserId(ctx);
      if (!userId) return [];
      const session = await ctx.db.get(sessionId);
      if (!session || session.sport !== sport) {
        return [];
      }
      if (session.userId && session.userId !== userId) {
        return [];
      }
      if (Date.now() > session.expiresAt || session.status !== "active") {
        return [];
      }
      for (const [index, gridCell] of session.cells.entries()) {
        if (index !== cellIndex && gridCell.correct === true && typeof gridCell.guessedPlayerId === "string") {
          usedPlayerIds.add(gridCell.guessedPlayerId);
        }
      }
    }

    // Gather a candidate pool from two sources, then let rankRosterSearchResults
    // decide relevance. Dedupe by externalId.
    const candidatesById = new Map<string, RosterPlayer>();
    const addCandidate = (player: RosterPlayer) => {
      candidatesById.set(player.externalId, player);
    };

    // (1) Full-text search index over `searchText` (name + firstName + lastName
    // tokens). This is what makes "Harry Kane" / "Jude Bellingham" / "Haaland"
    // (compound lastName "Braut Haaland") findable — a prefix scan over the
    // abbreviated `name`/`lastName` alone can't reach them.
    const normalizedQuery = normalizeAnswer(queryText);
    if (normalizedQuery) {
      const searchHits = await ctx.db
        .query("sportsPlayers")
        .withSearchIndex("search_text", (q) =>
          q.search("searchText", normalizedQuery).eq("sport", sport),
        )
        .take(64);
      for (const player of searchHits) addCandidate(player);
    }

    // (2) Legacy prefix scans over name/lastName. Kept as a robust fallback that
    // also covers any rows not yet carrying `searchText` (pre-backfill window).
    for (const prefix of buildRosterSearchPrefixes(queryText)) {
      const upperBound = `${prefix}￿`;
      const byName = await ctx.db
        .query("sportsPlayers")
        .withIndex("by_sport_name", (q) =>
          q.eq("sport", sport).gte("name", prefix).lt("name", upperBound),
        )
        .take(25);
      const byLastName = await ctx.db
        .query("sportsPlayers")
        .withIndex("by_sport_lastName", (q) =>
          q.eq("sport", sport).gte("lastName", prefix).lt("lastName", upperBound),
        )
        .take(25);
      for (const player of [...byName, ...byLastName]) addCandidate(player);
    }

    return rankRosterSearchResults(
      [...candidatesById.values()],
      queryText,
      usedPlayerIds,
    ).map((player) => ({
      externalId: player.externalId,
      // Show the recognisable full name ("Harry Kane"), not the stored "H. Kane".
      name: expandPlayerDisplayName(player.name, player.firstName, player.lastName),
      photo: player.photo,
      position: player.position,
      nationality: player.nationality,
    }));
  },
});

export const submitGuess = mutation({
  args: {
    sessionId: v.id("verveGridSessions"),
    cellIndex: v.number(),
    playerExternalId: v.string(),
    playerName: v.string(),
  },
  handler: async (ctx, { sessionId, cellIndex, playerExternalId, playerName }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status !== "active") throw new Error("Game is not active");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { status: "completed" });
      throw new Error("Session expired");
    }
    if (session.remainingGuesses <= 0) throw new Error("No guesses remaining");

    const cells = [...session.cells];
    const cell = cells[cellIndex];
    if (!cell) throw new Error("Invalid cell index");
    if (cell.correct !== undefined) throw new Error("Cell already answered");

    const alreadyUsed = cells.some(
      (gridCell, index) =>
        index !== cellIndex &&
        gridCell.guessedPlayerId === playerExternalId &&
        gridCell.correct === true,
    );
    if (alreadyUsed) {
      return { correct: false, alreadyUsed: true, remainingGuesses: session.remainingGuesses };
    }

    const correct = cell.validPlayerIds.includes(playerExternalId);
    const newRemaining = session.remainingGuesses - 1;
    const newCorrectCount = correct ? session.correctCount + 1 : session.correctCount;

    cells[cellIndex] = {
      ...cell,
      guessedPlayerId: playerExternalId,
      guessedPlayerName: playerName,
      correct,
    };

    const allSolved = newCorrectCount === 9;
    const noGuesses = newRemaining <= 0;
    const newStatus = allSolved || noGuesses ? "completed" : "active";

    if (newStatus === "completed") {
      await incrementTotalGames(ctx, userId);
    }

    await ctx.db.patch(sessionId, {
      cells,
      remainingGuesses: newRemaining,
      correctCount: newCorrectCount,
      status: newStatus,
    });

    return {
      correct,
      alreadyUsed: false,
      remainingGuesses: newRemaining,
      correctCount: newCorrectCount,
      gameOver: newStatus === "completed",
      allSolved,
    };
  },
});

export const penalizeTabSwitch = mutation({
  args: { sessionId: v.id("verveGridSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.status !== "active") {
      return {
        penalized: false,
        gameOver: true,
        correctCount: session.correctCount,
      };
    }

    await incrementTotalGames(ctx, userId);
    await ctx.db.patch(sessionId, { status: "completed" });
    return {
      penalized: true,
      gameOver: true,
      correctCount: session.correctCount,
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("verveGridSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId && session.userId !== userId) return null;

    // validPlayerIds per cell is the answer pool — never return it.
    // Clients only need to know what they've guessed so far.
    return {
      _id: session._id,
      sport: session.sport,
      boardTemplateId: session.boardTemplateId,
      boardAxisFamily: session.boardAxisFamily,
      rows: session.rows,
      cols: session.cols,
      cells: session.cells.map((cell) => ({
        rowIdx: cell.rowIdx,
        colIdx: cell.colIdx,
        validAnswerCount: cell.validPlayerIds.length,
        ...getCellRarity(cell.validPlayerIds.length),
        guessedPlayerId: cell.guessedPlayerId,
        guessedPlayerName: cell.guessedPlayerName,
        correct: cell.correct,
      })),
      remainingGuesses: session.remainingGuesses,
      correctCount: session.correctCount,
      status:
        session.status === "active" && Date.now() > session.expiresAt
          ? "completed"
          : session.status,
      expiresAt: session.expiresAt,
    };
  },
});
