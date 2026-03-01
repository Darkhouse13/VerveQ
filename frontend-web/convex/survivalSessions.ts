import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isMatch, similarity } from "./lib/fuzzy";

// Survival data loaded inline for Convex (no filesystem access in mutations)
// These are imported at bundle time.
import footballData from "./data/survival_initials_map.json";
import tennisData from "./data/survival_initials_map_tennis.json";
import nbaData from "./data/nba_survival_data.json";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

type InitialsMap = Record<string, string[]>;

function getInitialsMap(sport: string): InitialsMap {
  if (sport === "tennis") {
    return (tennisData as { initials_map: InitialsMap }).initials_map;
  }
  if (sport === "basketball") {
    // NBA data is a flat initials map (no wrapper)
    return nbaData as unknown as InitialsMap;
  }
  return (footballData as { initials_map: InitialsMap }).initials_map;
}

interface DifficultyLevel {
  initialsLen: number;
  famousWeight: number;
  label: string;
}

function getDifficulty(round: number): DifficultyLevel {
  if (round <= 2) return { initialsLen: 2, famousWeight: 1.0, label: "Easy" };
  if (round === 3) return { initialsLen: 2, famousWeight: 0.8, label: "Easy" };
  if (round === 4)
    return { initialsLen: 2, famousWeight: 0.6, label: "Medium" };
  if (round === 5)
    return { initialsLen: 2, famousWeight: 0.4, label: "Medium" };
  if (round <= 7) return { initialsLen: 2, famousWeight: 0.2, label: "Hard" };
  return { initialsLen: 3, famousWeight: 0.2, label: "Expert" };
}

function generateChallenge(
  sport: string,
  round: number,
  usedInitials: string[],
) {
  const map = getInitialsMap(sport);
  const diff = getDifficulty(round);
  const usedSet = new Set(usedInitials);

  const candidates = Object.entries(map).filter(
    ([initials, players]) =>
      initials.length <= diff.initialsLen &&
      !usedSet.has(initials) &&
      players.length > 0,
  );

  if (!candidates.length) return null;

  const picked =
    candidates[Math.floor(Math.random() * candidates.length)];
  return {
    initials: picked[0],
    round,
    difficulty: diff.label,
    validPlayers: picked[1],
  };
}

export const startGame = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const challenge = generateChallenge(sport, 1, []);
    if (!challenge) throw new Error("No survival data available");

    const sessionId = await ctx.db.insert("survivalSessions", {
      sport,
      round: 1,
      score: 0,
      lives: 3,
      hintUsed: false,
      usedInitials: [challenge.initials],
      gameOver: false,
      expiresAt: Date.now() + SESSION_TTL_MS,
      currentChallenge: challenge,
    });

    return {
      sessionId,
      round: 1,
      lives: 3,
      score: 0,
      hintAvailable: true,
      challenge: {
        initials: challenge.initials,
        difficulty: challenge.difficulty,
        hint: `Find a ${sport} player with initials ${challenge.initials}`,
      },
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    return {
      round: session.round,
      score: session.score,
      lives: session.lives,
      hintUsed: session.hintUsed,
      gameOver: session.gameOver,
      challenge: session.currentChallenge
        ? {
            initials: session.currentChallenge.initials,
            difficulty: session.currentChallenge.difficulty,
            hint: `Find a ${session.sport} player with initials ${session.currentChallenge.initials}`,
          }
        : null,
    };
  },
});

export const submitGuess = mutation({
  args: {
    sessionId: v.id("survivalSessions"),
    guess: v.string(),
  },
  handler: async (ctx, { sessionId, guess }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) throw new Error("Invalid session");

    const challenge = session.currentChallenge;
    if (!challenge) throw new Error("No active challenge");

    const validPlayers = challenge.validPlayers;
    let correct = false;
    let bestSim = 0;
    let matchedPlayer = validPlayers[0] || guess;

    for (const player of validPlayers) {
      const sim = similarity(guess, player);
      if (sim > bestSim) {
        bestSim = sim;
        matchedPlayer = player;
      }
      if (isMatch(guess, player)) {
        correct = true;
        matchedPlayer = player;
        break;
      }
    }

    if (correct) {
      const newRound = session.round + 1;
      const newScore = session.score + 1;
      const next = generateChallenge(
        session.sport,
        newRound,
        session.usedInitials,
      );

      await ctx.db.patch(sessionId, {
        round: newRound,
        score: newScore,
        usedInitials: next
          ? [...session.usedInitials, next.initials]
          : session.usedInitials,
        currentChallenge: next ?? undefined,
        gameOver: !next,
      });

      return {
        correct: true,
        similarity: bestSim,
        correctAnswer: matchedPlayer,
        lives: session.lives,
        score: newScore,
        round: newRound,
        gameOver: !next,
        nextChallenge: next
          ? {
              initials: next.initials,
              difficulty: next.difficulty,
              hint: `Find a ${session.sport} player with initials ${next.initials}`,
            }
          : null,
      };
    } else {
      const newLives = session.lives - 1;
      const isGameOver = newLives <= 0;

      let next = null;
      if (!isGameOver) {
        next = generateChallenge(
          session.sport,
          session.round + 1,
          session.usedInitials,
        );
      }

      await ctx.db.patch(sessionId, {
        lives: newLives,
        gameOver: isGameOver,
        ...(next
          ? {
              round: session.round + 1,
              usedInitials: [...session.usedInitials, next.initials],
              currentChallenge: next,
            }
          : {}),
      });

      return {
        correct: false,
        similarity: bestSim,
        correctAnswer: matchedPlayer,
        lives: newLives,
        score: session.score,
        round: next ? session.round + 1 : session.round,
        gameOver: isGameOver,
        nextChallenge: next
          ? {
              initials: next.initials,
              difficulty: next.difficulty,
              hint: `Find a ${session.sport} player with initials ${next.initials}`,
            }
          : null,
      };
    }
  },
});

export const useHint = mutation({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.hintUsed) throw new Error("Hint unavailable");

    const players = session.currentChallenge?.validPlayers ?? [];
    const sample = players.slice(0, Math.min(3, players.length));

    await ctx.db.patch(sessionId, { hintUsed: true });
    return { samplePlayers: sample };
  },
});

export const skipChallenge = mutation({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) throw new Error("Invalid session");

    const newLives = session.lives - 1;
    const isGameOver = newLives <= 0;

    let next = null;
    if (!isGameOver) {
      next = generateChallenge(
        session.sport,
        session.round + 1,
        session.usedInitials,
      );
    }

    await ctx.db.patch(sessionId, {
      lives: newLives,
      gameOver: isGameOver,
      ...(next
        ? {
            round: session.round + 1,
            usedInitials: [...session.usedInitials, next.initials],
            currentChallenge: next,
          }
        : {}),
    });

    return {
      lives: newLives,
      score: session.score,
      round: next ? session.round + 1 : session.round,
      gameOver: isGameOver,
      challenge: next
        ? {
            initials: next.initials,
            difficulty: next.difficulty,
            hint: `Find a ${session.sport} player with initials ${next.initials}`,
          }
        : null,
    };
  },
});
