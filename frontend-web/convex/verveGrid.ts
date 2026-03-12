import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_GUESSES = 9;

// Only allow these nationalities as grid axes to prevent obscure/impossible cells
const ALLOWED_NATIONALITIES = new Set([
  "Argentina",
  "Brazil",
  "England",
  "France",
  "Spain",
  "Germany",
  "Italy",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Uruguay",
  "Colombia",
]);

export const startSession = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    // Only fetch "easy" and "medium" grid entries — exclude "hard" (1-2 players)
    const easyEntries = await ctx.db
      .query("gridIndex")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", sport).eq("difficulty", "easy"),
      )
      .collect();

    const mediumEntries = await ctx.db
      .query("gridIndex")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", sport).eq("difficulty", "medium"),
      )
      .collect();

    const allEntries = [...easyEntries, ...mediumEntries];

    if (allEntries.length < 9) {
      throw new Error("Not enough grid data for this sport");
    }

    // Collect unique row and col criteria
    const rowMap = new Map<string, { type: string; key: string; label: string }>();
    const colMap = new Map<string, { type: string; key: string; label: string }>();

    for (const entry of allEntries) {
      const rowId = `${entry.rowType}:${entry.rowKey}`;
      const colId = `${entry.colType}:${entry.colKey}`;
      if (!rowMap.has(rowId)) {
        rowMap.set(rowId, { type: entry.rowType, key: entry.rowKey, label: entry.rowLabel });
      }
      if (!colMap.has(colId)) {
        colMap.set(colId, { type: entry.colType, key: entry.colKey, label: entry.colLabel });
      }
    }

    // Filter out obscure nationalities from row and col candidates
    for (const [id, val] of rowMap) {
      if (val.type === "nationality" && !ALLOWED_NATIONALITIES.has(val.key)) {
        rowMap.delete(id);
      }
    }
    for (const [id, val] of colMap) {
      if (val.type === "nationality" && !ALLOWED_NATIONALITIES.has(val.key)) {
        colMap.delete(id);
      }
    }

    // Build a lookup: "rowType:rowKey|colType:colKey" → playerIds
    const cellLookup = new Map<string, string[]>();
    for (const entry of allEntries) {
      const key = `${entry.rowType}:${entry.rowKey}|${entry.colType}:${entry.colKey}`;
      cellLookup.set(key, entry.playerIds);
    }

    // Try to find a valid 3x3 grid
    const rowCandidates = Array.from(rowMap.entries()).sort(() => Math.random() - 0.5);
    const colCandidates = Array.from(colMap.entries()).sort(() => Math.random() - 0.5);

    let chosenRows: { type: string; key: string; label: string }[] = [];
    let chosenCols: { type: string; key: string; label: string }[] = [];
    let cells: {
      rowIdx: number;
      colIdx: number;
      validPlayerIds: string[];
    }[] = [];
    let found = false;

    // Brute-force search for a valid 3x3 combination
    for (let ri = 0; ri < rowCandidates.length - 2 && !found; ri++) {
      for (let rj = ri + 1; rj < rowCandidates.length - 1 && !found; rj++) {
        for (let rk = rj + 1; rk < rowCandidates.length && !found; rk++) {
          const testRows = [rowCandidates[ri], rowCandidates[rj], rowCandidates[rk]];

          for (let ci = 0; ci < colCandidates.length - 2 && !found; ci++) {
            for (let cj = ci + 1; cj < colCandidates.length - 1 && !found; cj++) {
              for (let ck = cj + 1; ck < colCandidates.length && !found; ck++) {
                const testCols = [colCandidates[ci], colCandidates[cj], colCandidates[ck]];

                // Check all 9 cells have valid players
                const testCells: typeof cells = [];
                let allValid = true;

                for (let r = 0; r < 3 && allValid; r++) {
                  for (let c = 0; c < 3 && allValid; c++) {
                    const row = testRows[r][1];
                    const col = testCols[c][1];
                    const key = `${row.type}:${row.key}|${col.type}:${col.key}`;
                    const playerIds = cellLookup.get(key);

                    if (!playerIds || playerIds.length === 0) {
                      allValid = false;
                    } else {
                      testCells.push({
                        rowIdx: r,
                        colIdx: c,
                        validPlayerIds: playerIds,
                      });
                    }
                  }
                }

                if (allValid && testCells.length === 9) {
                  chosenRows = testRows.map(([, v]) => v);
                  chosenCols = testCols.map(([, v]) => v);
                  cells = testCells;
                  found = true;
                }
              }
            }
          }
        }
      }
    }

    if (!found) {
      throw new Error("Could not generate a valid 3x3 grid — not enough overlapping data");
    }

    const sessionId = await ctx.db.insert("verveGridSessions", {
      sport,
      rows: chosenRows,
      cols: chosenCols,
      cells: cells.map((c) => ({
        ...c,
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
      rows: chosenRows,
      cols: chosenCols,
      remainingGuesses: MAX_GUESSES,
      correctCount: 0,
    };
  },
});

export const searchPlayers = query({
  args: {
    queryText: v.string(),
    sport: v.string(),
  },
  handler: async (ctx, { queryText, sport }) => {
    if (queryText.length < 2) return [];

    const normalized = queryText.toLowerCase();

    // Query by sport and scan for name prefix match
    const players = await ctx.db
      .query("sportsPlayers")
      .withIndex("by_sport_name", (q) => q.eq("sport", sport))
      .collect();

    const matches = players
      .filter((p) => p.name.toLowerCase().includes(normalized))
      .slice(0, 10)
      .map((p) => ({
        externalId: p.externalId,
        name: p.name,
        photo: p.photo,
        position: p.position,
        nationality: p.nationality,
      }));

    return matches;
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
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.status !== "active") throw new Error("Game is not active");
    if (session.remainingGuesses <= 0) throw new Error("No guesses remaining");

    const cells = [...session.cells];
    const cell = cells[cellIndex];
    if (!cell) throw new Error("Invalid cell index");
    if (cell.correct === true) throw new Error("Cell already solved");

    // Check if player was already used in another cell
    const alreadyUsed = cells.some(
      (c, i) => i !== cellIndex && c.guessedPlayerId === playerExternalId && c.correct === true,
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
    return await ctx.db.get(sessionId);
  },
});
