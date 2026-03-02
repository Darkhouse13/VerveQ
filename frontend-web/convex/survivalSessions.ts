import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { findBestMatch } from "./lib/fuzzy";

// Survival data loaded inline for Convex (no filesystem access in mutations)
// These are imported at bundle time.
import footballData from "./data/survival_initials_map.json";
import tennisData from "./data/survival_initials_map_tennis.json";
import nbaData from "./data/nba_survival_data.json";
import footballMetadata from "./data/football_player_metadata.json";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

type InitialsMap = Record<string, string[]>;

type PlayerMetadata = {
  club: string;
  position: string;
  nationality: string;
  era: string;
};

const metadataMap = footballMetadata as Record<string, PlayerMetadata>;

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
      speedStreak: 0,
      lastAnswerAt: 0,
      performanceBonus: 0,
      hintTokensLeft: 3,
      currentHintStage: 0,
    });

    return {
      sessionId,
      round: 1,
      lives: 3,
      score: 0,
      hintAvailable: sport === "football",
      hintTokensLeft: 3,
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
      hintTokensLeft: session.hintTokensLeft ?? 0,
      currentHintStage: session.currentHintStage ?? 0,
      speedStreak: session.speedStreak ?? 0,
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

    const { matched: correct, distance, matchedPlayer } = findBestMatch(
      guess,
      challenge.validPlayers,
    );

    if (correct) {
      const now = Date.now();
      const lastAnswerAt = session.lastAnswerAt ?? 0;
      const elapsed = lastAnswerAt > 0 ? (now - lastAnswerAt) / 1000 : Infinity;

      const newStreak = elapsed < 4.0 ? (session.speedStreak ?? 0) + 1 : 1;
      const isOnFire = newStreak >= 5;
      const bonusIncrement = isOnFire ? 0.1 : 0;

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
        speedStreak: newStreak,
        lastAnswerAt: now,
        performanceBonus: (session.performanceBonus ?? 0) + bonusIncrement,
        currentHintStage: 0,
      });

      return {
        correct: true,
        typoAccepted: distance === 1,
        matchDistance: distance,
        correctAnswer: matchedPlayer,
        lives: session.lives,
        score: newScore,
        round: newRound,
        gameOver: !next,
        speedStreak: newStreak,
        isOnFire,
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
        speedStreak: 0,
        lastAnswerAt: 0,
        currentHintStage: 0,
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
        typoAccepted: false,
        matchDistance: distance,
        correctAnswer: matchedPlayer,
        lives: newLives,
        score: session.score,
        round: next ? session.round + 1 : session.round,
        gameOver: isGameOver,
        speedStreak: 0,
        isOnFire: false,
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
  args: {
    sessionId: v.id("survivalSessions"),
    stage: v.number(),
  },
  handler: async (ctx, { sessionId, stage }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) throw new Error("Invalid session");

    const tokensLeft = session.hintTokensLeft ?? 0;
    const currentStage = session.currentHintStage ?? 0;

    if (stage !== currentStage + 1) {
      throw new Error("Must use hints in order");
    }
    if (tokensLeft <= 0) {
      throw new Error("No hint tokens remaining");
    }
    if (session.sport !== "football") {
      throw new Error("Hints only available for football");
    }

    const players = session.currentChallenge?.validPlayers ?? [];
    let hintText = "";

    if (stage === 1) {
      const meta = players.length > 0 ? metadataMap[players[0]] : undefined;
      if (meta) {
        hintText = `Nationality: ${meta.nationality} | Club: ${meta.club}`;
      } else {
        hintText = `Football player \u2014 ${players.length} possible answers`;
      }
    } else if (stage === 2) {
      const meta = players.length > 0 ? metadataMap[players[0]] : undefined;
      if (meta) {
        hintText = `Position: ${meta.position} | Era: ${meta.era}`;
      } else {
        hintText = `${players.length} players match these initials`;
      }
    } else if (stage === 3) {
      const samplePlayer =
        players[Math.floor(Math.random() * players.length)];
      const firstName = samplePlayer?.split(" ")[0] ?? "Unknown";
      hintText = `First name: ${firstName}`;
    }

    await ctx.db.patch(sessionId, {
      hintTokensLeft: tokensLeft - 1,
      currentHintStage: stage,
      hintUsed: true,
    });

    return {
      stage,
      hintText,
      tokensLeft: tokensLeft - 1,
    };
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
      speedStreak: 0,
      lastAnswerAt: 0,
      currentHintStage: 0,
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
      speedStreak: 0,
      isOnFire: false,
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

export const penalizeTabSwitch = mutation({
  args: {
    sessionId: v.id("survivalSessions"),
    currentRound: v.number(),
  },
  handler: async (ctx, { sessionId, currentRound }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) {
      return { penalized: false, lives: 0, gameOver: true };
    }

    if (session.lastPenalizedRound === currentRound) {
      return {
        penalized: false,
        lives: session.lives,
        gameOver: session.gameOver,
      };
    }

    const newLives = session.lives - 1;
    const isGameOver = newLives <= 0;

    await ctx.db.patch(sessionId, {
      lives: newLives,
      gameOver: isGameOver,
      lastPenalizedRound: currentRound,
    });

    return { penalized: true, lives: newLives, gameOver: isGameOver };
  },
});
