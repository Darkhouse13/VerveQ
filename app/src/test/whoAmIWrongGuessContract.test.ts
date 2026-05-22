import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "user_1"),
}));

import * as whoAmI from "../../convex/whoAmI";

function handlerOf<T>(mutation: T): (ctx: unknown, args: unknown) => Promise<Record<string, unknown>> {
  const fn = mutation as { _handler?: (ctx: unknown, args: unknown) => Promise<Record<string, unknown>> };
  if (typeof fn._handler !== "function") throw new Error("not a Convex mutation");
  return fn._handler;
}

describe("Who Am I wrong guess contract", () => {
  it("keeps an ordinary wrong guess active, penalizes score, and hides the answer", async () => {
    const patches: Array<Record<string, unknown>> = [];
    const session = {
      _id: "wai_1",
      userId: "user_1",
      sport: "football",
      clueExternalId: "clue_x",
      answerName: "Thierry Henry",
      currentStage: 2,
      score: 1000,
      status: "active",
      expiresAt: Date.now() + 60_000,
      guesses: [],
      maxGuesses: 6,
      wrongGuessCount: 0,
    };
    const ctx = {
      db: {
        get: async () => session,
        patch: async (_id: string, patch: Record<string, unknown>) => patches.push(patch),
      },
    };

    const result = await handlerOf(whoAmI.submitGuess)(ctx, {
      sessionId: "wai_1",
      guess: "Sadio Mane",
    });

    expect(result).toMatchObject({
      correct: false,
      closeCall: false,
      typoAccepted: false,
      score: 900,
      gameOver: false,
    });
    expect(result).not.toHaveProperty("answerName");
    expect(patches.at(-1)).toMatchObject({
      status: "active",
      score: 900,
      wrongGuessCount: 1,
      maxGuesses: 6,
    });
  });

  it("fails and reveals the answer only on the final allowed wrong guess", async () => {
    const patches: Array<Record<string, unknown>> = [];
    const session = {
      _id: "wai_2",
      userId: "user_1",
      sport: "football",
      clueExternalId: "clue_y",
      answerName: "Thierry Henry",
      currentStage: 1,
      score: 590,
      status: "active",
      expiresAt: Date.now() + 60_000,
      guesses: ["A", "B", "C", "D", "E"].map((guessName, index) => ({
        guessName,
        correct: false,
        closeCall: false,
        scoreAfter: 1000 - index,
        createdAt: Date.now() - index,
      })),
      maxGuesses: 6,
      wrongGuessCount: 5,
    };
    const ctx = {
      db: {
        get: async () => session,
        patch: async (_id: string, patch: Record<string, unknown>) => patches.push(patch),
      },
    };

    const result = await handlerOf(whoAmI.submitGuess)(ctx, {
      sessionId: "wai_2",
      guess: "Sadio Mane",
    });

    expect(result).toMatchObject({
      correct: false,
      closeCall: false,
      score: 531,
      gameOver: true,
      answerName: "Thierry Henry",
    });
    expect(patches.at(-1)).toMatchObject({
      status: "failed",
      wrongGuessCount: 6,
      score: 531,
    });
  });
});
