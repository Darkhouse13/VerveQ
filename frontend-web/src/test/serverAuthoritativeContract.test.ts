/**
 * Runtime regression tests for BLOCKER-2, BLOCKER-3, BLOCKER-4, BLOCKER-5
 * from docs/PROD_READINESS_AUDIT.md.
 *
 * We import the Convex mutation/query definitions directly and inspect
 * each one's `exportArgs()` JSON schema (a stable Convex runtime API).
 * A regression that re-adds `correctAnswer`, client-supplied `score`,
 * or client-supplied `timeTaken` to any of these surfaces will fail
 * the relevant assertion without needing a live deployment.
 *
 * The tests deliberately avoid invoking handlers — calling them would
 * require a real Convex runtime context. The public arg schema is the
 * load-bearing contract; once the server controls the schema, the
 * client cannot send what the schema disallows.
 */
import { describe, it, expect } from "vitest";
import * as quizSessions from "../../convex/quizSessions";
import * as blitz from "../../convex/blitz";
import * as dailyChallenge from "../../convex/dailyChallenge";
import * as games from "../../convex/games";
import * as higherLower from "../../convex/higherLower";
import * as verveGrid from "../../convex/verveGrid";
import * as whoAmI from "../../convex/whoAmI";

type Args = { [key: string]: unknown };

function argsOf(mutation: unknown): Args {
  const fn = mutation as { exportArgs?: () => string };
  if (typeof fn.exportArgs !== "function") {
    throw new Error("not a Convex registered function");
  }
  const raw = JSON.parse(fn.exportArgs());
  // Convex exports args as { type: "object", value: {...} }
  return (raw.value ?? raw) as Args;
}

describe("BLOCKER-2 — correctAnswer must never be a client-supplied arg", () => {
  it("quizSessions.checkAnswer drops correctAnswer and timeTaken", () => {
    const args = argsOf(quizSessions.checkAnswer);
    expect(args).not.toHaveProperty("correctAnswer");
    expect(args).not.toHaveProperty("timeTaken");
    expect(args).toHaveProperty("sessionId");
    expect(args).toHaveProperty("answer");
  });

  it("blitz.submitAnswer drops correctAnswer, keeps checksum for server lookup", () => {
    const args = argsOf(blitz.submitAnswer);
    expect(args).not.toHaveProperty("correctAnswer");
    expect(args).toHaveProperty("sessionId");
    expect(args).toHaveProperty("answer");
    expect(args).toHaveProperty("checksum");
  });

  it("dailyChallenge.submitAnswer drops correctAnswer", () => {
    const args = argsOf(dailyChallenge.submitAnswer);
    expect(args).not.toHaveProperty("correctAnswer");
    expect(args).toHaveProperty("attemptId");
    expect(args).toHaveProperty("answer");
    expect(args).toHaveProperty("questionIndex");
  });
});

describe("BLOCKER-3 — ELO finalizers accept only sessionId", () => {
  it("games.completeQuiz takes only sessionId", () => {
    const args = argsOf(games.completeQuiz);
    expect(Object.keys(args).sort()).toEqual(["sessionId"]);
  });

  it("games.completeSurvival takes only sessionId", () => {
    const args = argsOf(games.completeSurvival);
    expect(Object.keys(args).sort()).toEqual(["sessionId"]);
  });
});

describe("BLOCKER-4 — public getSession queries must not leak the hidden answer", () => {
  function handlerOf<T>(q: T): (ctx: unknown, args: unknown) => Promise<unknown> {
    const fn = q as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
    if (typeof fn._handler !== "function") {
      throw new Error("not a Convex query with an accessible handler");
    }
    return fn._handler;
  }

  it("higherLower.getSession hides playerBValue while the game is active", async () => {
    const activeSession = {
      _id: "sess_1",
      sport: "football",
      score: 3,
      streak: 3,
      status: "active",
      playerAName: "Messi",
      playerAValue: 100,
      playerAPhoto: undefined,
      playerBName: "Ronaldo",
      playerBValue: 99, // this is the hidden truth
      playerBPhoto: undefined,
      currentStatKey: "goalsFor",
      currentContext: "career",
      currentEntityType: "player",
      currentSeason: undefined,
      expiresAt: Date.now() + 60_000,
    };
    const ctx = {
      db: { get: async () => activeSession },
    };
    const result = (await handlerOf(higherLower.getSession)(ctx, {
      sessionId: "sess_1",
    })) as Record<string, unknown>;
    expect(result.playerBValue).toBeNull();
    expect(result.playerAValue).toBe(100);
  });

  it("higherLower.getSession reveals playerBValue once the game is over", async () => {
    const overSession = {
      _id: "sess_2",
      sport: "football",
      score: 3,
      streak: 0,
      status: "game_over",
      playerAName: "Messi",
      playerAValue: 100,
      playerAPhoto: undefined,
      playerBName: "Ronaldo",
      playerBValue: 99,
      playerBPhoto: undefined,
      currentStatKey: "goalsFor",
      currentContext: "career",
      currentEntityType: "player",
      currentSeason: undefined,
      expiresAt: Date.now() + 60_000,
    };
    const ctx = { db: { get: async () => overSession } };
    const result = (await handlerOf(higherLower.getSession)(ctx, {
      sessionId: "sess_2",
    })) as Record<string, unknown>;
    expect(result.playerBValue).toBe(99);
  });

  it("verveGrid.getSession strips validPlayerIds from every cell", async () => {
    const session = {
      _id: "vg_1",
      sport: "football",
      boardTemplateId: "tmpl",
      boardAxisFamily: "family",
      rows: [{ type: "team", key: "r1", label: "Row 1" }],
      cols: [{ type: "team", key: "c1", label: "Col 1" }],
      cells: [
        {
          rowIdx: 0,
          colIdx: 0,
          validPlayerIds: ["p1", "p2"], // answer pool — must NOT appear in result
          guessedPlayerId: undefined,
          guessedPlayerName: undefined,
          correct: undefined,
        },
      ],
      remainingGuesses: 9,
      correctCount: 0,
      status: "active",
      expiresAt: Date.now() + 60_000,
    };
    const ctx = { db: { get: async () => session } };
    const result = (await handlerOf(verveGrid.getSession)(ctx, {
      sessionId: "vg_1",
    })) as { cells: Array<Record<string, unknown>> };
    for (const cell of result.cells) {
      expect(cell).not.toHaveProperty("validPlayerIds");
    }
  });

  it("whoAmI.getSession hides answerName while session is active", async () => {
    const activeSession = {
      _id: "wai_1",
      sport: "football",
      clueExternalId: "clue_x",
      answerName: "Thierry Henry",
      currentStage: 2,
      score: 750,
      status: "active",
      expiresAt: Date.now() + 60_000,
    };
    const clue = {
      externalId: "clue_x",
      clue1: "Born in France",
      clue2: "Played as a striker",
      clue3: "Premier League legend",
      clue4: "Double-winning Arsenal captain",
      difficulty: "medium",
    };
    const ctx = {
      db: {
        get: async () => activeSession,
        query: () => ({
          withIndex: () => ({ first: async () => clue }),
        }),
      },
    };
    const result = (await handlerOf(whoAmI.getSession)(ctx, {
      sessionId: "wai_1",
    })) as Record<string, unknown>;
    expect(result.answerName).toBeNull();
    expect(Array.isArray(result.clues)).toBe(true);
  });

  it("whoAmI.getSession reveals answerName once the session ends", async () => {
    const endedSession = {
      _id: "wai_2",
      sport: "football",
      clueExternalId: "clue_y",
      answerName: "Thierry Henry",
      currentStage: 3,
      score: 0,
      status: "failed",
      expiresAt: Date.now() + 60_000,
    };
    const clue = {
      externalId: "clue_y",
      clue1: "a",
      clue2: "b",
      clue3: "c",
      clue4: "d",
      difficulty: "medium",
    };
    const ctx = {
      db: {
        get: async () => endedSession,
        query: () => ({
          withIndex: () => ({ first: async () => clue }),
        }),
      },
    };
    const result = (await handlerOf(whoAmI.getSession)(ctx, {
      sessionId: "wai_2",
    })) as Record<string, unknown>;
    expect(result.answerName).toBe("Thierry Henry");
  });
});

describe("BLOCKER-5 — daily mutations do not accept client-supplied timing", () => {
  it("dailyChallenge.submitAnswer drops timeTaken", () => {
    const args = argsOf(dailyChallenge.submitAnswer);
    expect(args).not.toHaveProperty("timeTaken");
  });

  it("dailyChallenge.forfeit takes only attemptId", () => {
    const args = argsOf(dailyChallenge.forfeit);
    expect(Object.keys(args).sort()).toEqual(["attemptId"]);
  });

  it("dailyChallenge.completeAttempt takes only attemptId", () => {
    const args = argsOf(dailyChallenge.completeAttempt);
    expect(Object.keys(args).sort()).toEqual(["attemptId"]);
  });
});
