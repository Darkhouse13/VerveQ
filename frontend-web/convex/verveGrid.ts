import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_GUESSES = 9;
const MIN_QUERY_LENGTH = 2;

export const startSession = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
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

    const chosenBoard = boards[Math.floor(Math.random() * boards.length)];

    const sessionId = await ctx.db.insert("verveGridSessions", {
      userId,
      sport,
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
      boardTemplateId: chosenBoard.templateId,
      boardAxisFamily: chosenBoard.axisFamily,
      rows: chosenBoard.rows,
      cols: chosenBoard.cols,
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

    const normalized = queryText.toLowerCase();

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

      const cell = session.cells[cellIndex];
      if (!cell) {
        return [];
      }

      const usedPlayerIds = new Set(
        session.cells
          .filter((gridCell, index) => index !== cellIndex && gridCell.correct === true)
          .map((gridCell) => gridCell.guessedPlayerId)
          .filter((playerId): playerId is string => typeof playerId === "string"),
      );

      return (
        await Promise.all(
          cell.validPlayerIds.map((externalId) =>
            ctx.db
              .query("sportsPlayers")
              .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
              .first(),
          ),
        )
      )
        .filter((player): player is NonNullable<typeof player> => player !== null)
        .filter(
          (player) =>
            !usedPlayerIds.has(player.externalId) &&
            player.name.toLowerCase().includes(normalized),
        )
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(normalized) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(normalized) ? 0 : 1;
          if (aStarts !== bStarts) {
            return aStarts - bStarts;
          }
          return a.name.localeCompare(b.name);
        })
        .slice(0, 10)
        .map((player) => ({
          externalId: player.externalId,
          name: player.name,
          photo: player.photo,
          position: player.position,
          nationality: player.nationality,
        }));
    }

    const players = await ctx.db
      .query("sportsPlayers")
      .withIndex("by_sport_name", (q) => q.eq("sport", sport))
      .collect();

    return players
      .filter((player) => player.name.toLowerCase().includes(normalized))
      .slice(0, 10)
      .map((player) => ({
        externalId: player.externalId,
        name: player.name,
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
    if (session.remainingGuesses <= 0) throw new Error("No guesses remaining");

    const cells = [...session.cells];
    const cell = cells[cellIndex];
    if (!cell) throw new Error("Invalid cell index");
    if (cell.correct === true) throw new Error("Cell already solved");

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
        guessedPlayerId: cell.guessedPlayerId,
        guessedPlayerName: cell.guessedPlayerName,
        correct: cell.correct,
      })),
      remainingGuesses: session.remainingGuesses,
      correctCount: session.correctCount,
      status: session.status,
      expiresAt: session.expiresAt,
    };
  },
});
