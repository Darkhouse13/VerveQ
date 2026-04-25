/**
 * Runtime regression tests for the ownership / authorization pass that
 * followed BLOCKER-2..5. Each test invokes a Convex handler directly with
 * a fake ctx and asserts that callers who do not own the underlying
 * session/attempt/match either get rejected or receive a null projection.
 *
 * `@convex-dev/auth/server` is mocked so each test can control the result
 * of `getAuthUserId(ctx)` independently.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  // convexAuth is imported by convex/auth.ts; stub it so imports succeed.
  convexAuth: () => ({ auth: {}, signIn: () => {}, signOut: () => {}, store: {}, isAuthenticated: () => false }),
}));

import * as survivalSessions from "../../convex/survivalSessions";
import * as higherLower from "../../convex/higherLower";
import * as verveGrid from "../../convex/verveGrid";
import * as whoAmI from "../../convex/whoAmI";
import * as liveMatches from "../../convex/liveMatches";
import * as quizSessions from "../../convex/quizSessions";

function handlerOf<T>(q: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const fn = q as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof fn._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return fn._handler;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
});

describe("Area 1 — Survival mutations reject non-owning callers", () => {
  const ownedSession = {
    _id: "surv_1",
    userId: "userA",
    sport: "football",
    round: 1,
    score: 0,
    lives: 3,
    usedInitials: ["AB"],
    gameOver: false,
    currentChallenge: {
      initials: "AB",
      round: 1,
      difficulty: "Easy",
      validPlayers: ["Alice Bob"],
      maskedName: "____ ___",
      primaryPlayer: "Alice Bob",
    },
    speedStreak: 0,
    lastAnswerAt: 0,
    hintTokensLeft: 3,
    currentHintStage: 0,
    freeSkipsLeft: 1,
  };

  function ctxWithSession() {
    return {
      db: {
        get: async () => ownedSession,
        patch: async () => {},
      },
    };
  }

  it("submitGuess throws when the caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    await expect(
      handlerOf(survivalSessions.submitGuess)(ctxWithSession(), {
        sessionId: "surv_1",
        guess: "alice bob",
      }),
    ).rejects.toThrow(/authorized/i);
  });

  it("useHint throws when the caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    await expect(
      handlerOf(survivalSessions.useHint)(ctxWithSession(), {
        sessionId: "surv_1",
        stage: 1,
      }),
    ).rejects.toThrow(/authorized/i);
  });

  it("skipChallenge throws when the caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    await expect(
      handlerOf(survivalSessions.skipChallenge)(ctxWithSession(), {
        sessionId: "surv_1",
      }),
    ).rejects.toThrow(/authorized/i);
  });

  it("penalizeTabSwitch throws when the caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    await expect(
      handlerOf(survivalSessions.penalizeTabSwitch)(ctxWithSession(), {
        sessionId: "surv_1",
        currentRound: 1,
      }),
    ).rejects.toThrow(/authorized/i);
  });

  it("getSession returns null when the caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    const res = await handlerOf(survivalSessions.getSession)(ctxWithSession(), {
      sessionId: "surv_1",
    });
    expect(res).toBeNull();
  });

  it("submitGuess rejects unauthenticated callers", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    await expect(
      handlerOf(survivalSessions.submitGuess)(ctxWithSession(), {
        sessionId: "surv_1",
        guess: "alice bob",
      }),
    ).rejects.toThrow(/authenticated/i);
  });
});

describe("Area 2 — Curated getSession queries reject non-owners", () => {
  it("higherLower.getSession returns null when caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    const ctx = {
      db: {
        get: async () => ({
          _id: "hl_1",
          userId: "userA",
          sport: "football",
          status: "active",
          score: 0,
          streak: 0,
          playerAName: "A",
          playerAValue: 10,
          playerBName: "B",
          playerBValue: 11,
          currentStatKey: "goals",
          currentContext: "career",
          currentEntityType: "player",
          expiresAt: Date.now() + 60_000,
        }),
      },
    };
    const res = await handlerOf(higherLower.getSession)(ctx, {
      sessionId: "hl_1",
    });
    expect(res).toBeNull();
  });

  it("verveGrid.getSession returns null when caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    const ctx = {
      db: {
        get: async () => ({
          _id: "vg_1",
          userId: "userA",
          sport: "football",
          rows: [],
          cols: [],
          cells: [],
          remainingGuesses: 9,
          correctCount: 0,
          status: "active",
          expiresAt: Date.now() + 60_000,
        }),
      },
    };
    const res = await handlerOf(verveGrid.getSession)(ctx, {
      sessionId: "vg_1",
    });
    expect(res).toBeNull();
  });

  it("whoAmI.getSession returns null when caller is not the session owner", async () => {
    authMock.getAuthUserId.mockResolvedValue("userB");
    const ctx = {
      db: {
        get: async () => ({
          _id: "wai_1",
          userId: "userA",
          sport: "football",
          clueExternalId: "clue_x",
          answerName: "Thierry Henry",
          currentStage: 1,
          score: 1000,
          status: "active",
          expiresAt: Date.now() + 60_000,
        }),
        query: () => ({
          withIndex: () => ({ first: async () => ({ difficulty: "medium" }) }),
        }),
      },
    };
    const res = await handlerOf(whoAmI.getSession)(ctx, {
      sessionId: "wai_1",
    });
    expect(res).toBeNull();
  });

  it("higherLower.getSession returns null for unauthenticated callers", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    const ctx = { db: { get: async () => ({ userId: "userA" }) } };
    const res = await handlerOf(higherLower.getSession)(ctx, {
      sessionId: "hl_2",
    });
    expect(res).toBeNull();
  });
});

describe("Area 3 — liveMatches participant gate", () => {
  const matchDoc = {
    _id: "match_1",
    player1Id: "userA",
    player2Id: "userB",
    sport: "football",
    status: "waiting",
    currentQuestion: 0,
    totalQuestions: 10,
    questions: [],
    player1Answers: [],
    player2Answers: [],
    player1Score: 0,
    player2Score: 0,
    player1Ready: false,
    player2Ready: false,
    player1LastSeen: Date.now(),
    player2LastSeen: Date.now(),
    createdAt: Date.now(),
  };

  it("getMatch returns null when caller is neither player", async () => {
    authMock.getAuthUserId.mockResolvedValue("userC");
    const ctx = {
      db: {
        get: async () => matchDoc,
      },
    };
    const res = await handlerOf(liveMatches.getMatch)(ctx, {
      matchId: "match_1",
    });
    expect(res).toBeNull();
  });

  it("getMatch returns null for unauthenticated callers", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    const ctx = { db: { get: async () => matchDoc } };
    const res = await handlerOf(liveMatches.getMatch)(ctx, {
      matchId: "match_1",
    });
    expect(res).toBeNull();
  });
});

describe("Area 4 — quizSessions.submitFeedback requires auth", () => {
  it("throws when caller is unauthenticated", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ first: async () => null }),
        }),
        patch: async () => {},
      },
    };
    await expect(
      handlerOf(quizSessions.submitFeedback)(ctx, {
        checksum: "chk_1",
        votedDifficulty: "easy",
      }),
    ).rejects.toThrow(/authenticated/i);
  });
});
