import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => "stub_user"),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({
    auth: {},
    signIn: () => {},
    signOut: () => {},
    store: {},
    isAuthenticated: () => false,
  }),
}));

import * as blitz from "../../convex/blitz";
import * as dailyChallenge from "../../convex/dailyChallenge";
import * as games from "../../convex/games";
import * as higherLower from "../../convex/higherLower";
import * as quizSessions from "../../convex/quizSessions";
import * as verveGrid from "../../convex/verveGrid";
import * as whoAmI from "../../convex/whoAmI";
import {
  calculateEloChange,
  getSurvivalPerformance,
} from "../../convex/lib/elo";

type RegisteredFunction = {
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  exportArgs?: () => string;
};

type Args = Record<string, unknown>;

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

function argsOf(fn: unknown): Args {
  const registered = fn as RegisteredFunction;
  if (typeof registered.exportArgs !== "function") {
    throw new Error("not a Convex registered function with args");
  }
  const raw = JSON.parse(registered.exportArgs());
  return (raw.value ?? raw) as Args;
}

function makeQuizQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "question_1",
    checksum: "checksum_1",
    correctAnswer: "Stored Answer",
    explanation: "Stored explanation",
    usageCount: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    ...overrides,
  };
}

function makeQuizQuestionQuery(question: Record<string, unknown>) {
  return (table: string) => {
    if (table !== "quizQuestions") {
      throw new Error(`unexpected table query: ${table}`);
    }
    return {
      withIndex: () => ({
        first: async () => question,
      }),
    };
  };
}

function makeDailyQuery(challenge: Record<string, unknown>) {
  return (table: string) => {
    if (table !== "dailyChallenges") {
      throw new Error(`unexpected table query: ${table}`);
    }
    return {
      withIndex: () => ({
        collect: async () => [challenge],
      }),
    };
  };
}

function makeUserRatingsQuery(rating: Record<string, unknown> | null = null) {
  return (table: string) => {
    if (table !== "userRatings") {
      throw new Error(`unexpected table query: ${table}`);
    }
    return {
      withIndex: () => ({
        first: async () => rating,
      }),
    };
  };
}

afterEach(() => {
  vi.useRealTimers();
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("stub_user");
});

describe("BLOCKER-2: correctness is derived from stored answers", () => {
  it("quizSessions.checkAnswer ignores a forged client correctAnswer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:04.000Z"));
    const patch = vi.fn();
    const session = {
      _id: "quiz_session",
      userId: "stub_user",
      sport: "football",
      mode: "quiz",
      difficulty: "intermediate",
      usedChecksums: ["checksum_1"],
      expiresAt: Date.now() + 60_000,
      score: 0,
      correctCount: 0,
      totalAnswers: 0,
      sumAnswerTimeMs: 0,
      currentChecksum: "checksum_1",
      questionStartedAt: Date.now() - 4_000,
      completed: false,
    };
    const ctx = {
      db: {
        get: async () => session,
        patch,
        query: makeQuizQuestionQuery(makeQuizQuestion()),
      },
    };

    const result = (await handlerOf(quizSessions.checkAnswer)(ctx, {
      sessionId: "quiz_session",
      answer: "Forged Answer",
      correctAnswer: "Forged Answer",
      timeTaken: 0.1,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: false,
      score: 0,
      correctAnswer: "Stored Answer",
    });
    expect(patch).toHaveBeenCalledWith(
      "quiz_session",
      expect.objectContaining({
        correctCount: 0,
        totalAnswers: 1,
        currentChecksum: undefined,
      }),
    );
  });

  it("blitz.submitAnswer ignores a forged client correctAnswer", async () => {
    const endTimeMs = Date.now() + 60_000;
    const patch = vi.fn();
    const session = {
      _id: "blitz_session",
      userId: "stub_user",
      sport: "football",
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      usedChecksums: ["checksum_1"],
      currentChecksum: "checksum_1",
      gameOver: false,
      startedAt: Date.now(),
      endTimeMs,
    };
    const ctx = {
      db: {
        get: async () => session,
        patch,
        query: makeQuizQuestionQuery(makeQuizQuestion()),
      },
    };

    const result = (await handlerOf(blitz.submitAnswer)(ctx, {
      sessionId: "blitz_session",
      answer: "Forged Answer",
      checksum: "checksum_1",
      correctAnswer: "Forged Answer",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: false,
      score: 0,
      correctAnswer: "Stored Answer",
    });
    expect(patch).toHaveBeenCalledWith(
      "blitz_session",
      expect.objectContaining({
        wrongCount: 1,
        endTimeMs: endTimeMs - 3_000,
        currentChecksum: undefined,
      }),
    );
  });

  it("dailyChallenge.submitAnswer ignores a forged client correctAnswer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:04.000Z"));
    const startedAt = Date.now() - 4_000;
    const patch = vi.fn();
    const attempt = {
      _id: "attempt_1",
      userId: "stub_user",
      date: "2026-05-29",
      sport: "football",
      mode: "quiz",
      score: 0,
      completed: false,
      forfeited: false,
      results: [],
      startedAt,
      expiresAt: Date.now() + 60_000,
      currentQuestionStartedAt: startedAt,
      questionStartedAts: [startedAt],
    };
    const challenge = {
      _id: "challenge_1",
      date: "2026-05-29",
      sport: "football",
      mode: "quiz",
      questionChecksums: ["checksum_1"],
      questionSnapshots: [
        {
          checksum: "checksum_1",
          question: "Question?",
          options: ["Stored Answer", "B", "C", "D"],
          correctAnswer: "Stored Answer",
          explanation: "Stored explanation",
          category: "football",
        },
      ],
      survivalInitials: [],
      createdAt: 1,
    };
    const ctx = {
      db: {
        get: async () => attempt,
        patch,
        query: makeDailyQuery(challenge),
      },
    };

    const result = (await handlerOf(dailyChallenge.submitAnswer)(ctx, {
      attemptId: "attempt_1",
      answer: "Forged Answer",
      questionIndex: 0,
      correctAnswer: "Forged Answer",
      timeTaken: 0.1,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: false,
      score: 0,
      totalScore: 0,
      timeTaken: 4,
      correctAnswer: "Stored Answer",
    });
    expect(patch).toHaveBeenCalledWith(
      "attempt_1",
      expect.objectContaining({
        score: 0,
        results: [{ correct: false, timeTaken: 4, score: 0 }],
      }),
    );
  });
});

describe("BLOCKER-3: ELO finalizers ignore forged score fields", () => {
  it("completeQuiz uses quizSessions scoring state, not client totals", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:00.000Z"));
    const session = {
      _id: "quiz_session",
      userId: "stub_user",
      sport: "football",
      mode: "quiz",
      difficulty: "intermediate",
      expiresAt: Date.now() + 60_000,
      completed: false,
      score: 37,
      correctCount: 1,
      totalAnswers: 2,
      sumAnswerTimeMs: 6_000,
    };
    const insert = vi.fn(async () => "inserted");
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async (id: string) =>
          id === "quiz_session" ? session : { _id: "stub_user", totalGames: 0 },
        query: makeUserRatingsQuery(null),
        insert,
        patch,
      },
    };

    const result = (await handlerOf(games.completeQuiz)(ctx, {
      sessionId: "quiz_session",
      sport: "basketball",
      score: 999_999,
      totalQuestions: 10,
      accuracy: 1,
      averageTime: 0.1,
      difficulty: "hard",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      score: 37,
      correctCount: 1,
      totalAnswers: 2,
      accuracy: 0.5,
      averageTime: 3,
    });
    const gameSessionInsert = insert.mock.calls.find(
      ([table]) => table === "gameSessions",
    )?.[1] as Record<string, unknown>;
    expect(gameSessionInsert).toMatchObject({
      sport: "football",
      score: 37,
      totalQuestions: 2,
      correctAnswers: 1,
      accuracy: 0.5,
      avgAnswerTimeSecs: 3,
    });
  });

  it("completeSurvival uses survivalSessions score and performanceBonus", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:20.000Z"));
    const session = {
      _id: "survival_session",
      userId: "stub_user",
      sport: "football",
      score: 4,
      performanceBonus: 0,
      gameOver: true,
      expiresAt: Date.now() + 60_000,
      startedAt: Date.now() - 20_000,
    };
    const insert = vi.fn(async () => "inserted");
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async (id: string) =>
          id === "survival_session"
            ? session
            : { _id: "stub_user", totalGames: 0 },
        query: makeUserRatingsQuery(null),
        insert,
        patch,
      },
    };

    const result = (await handlerOf(games.completeSurvival)(ctx, {
      sessionId: "survival_session",
      sport: "basketball",
      score: 999,
      durationSeconds: 1,
      performanceBonus: 1,
    })) as Record<string, unknown>;

    const expectedEloChange = calculateEloChange(
      1200,
      getSurvivalPerformance(4),
      "easy",
      40,
    );
    expect(result).toMatchObject({
      score: 4,
      durationSeconds: 20,
      eloChange: expectedEloChange,
    });
    const gameSessionInsert = insert.mock.calls.find(
      ([table]) => table === "gameSessions",
    )?.[1] as Record<string, unknown>;
    expect(gameSessionInsert).toMatchObject({
      sport: "football",
      mode: "survival",
      score: 4,
      durationSeconds: 20,
      eloChange: expectedEloChange,
    });
  });
});

describe("BLOCKER-4: curated getSession queries do not leak answers", () => {
  it("higherLower.getSession strips playerBValue even after game over", async () => {
    const session = {
      _id: "hl_1",
      userId: "stub_user",
      sport: "football",
      score: 3,
      streak: 0,
      status: "game_over",
      playerAName: "A",
      playerAValue: 100,
      playerAPhoto: undefined,
      playerBName: "B",
      playerBValue: 99,
      playerBPhoto: undefined,
      currentStatKey: "goals",
      currentContext: "career",
      currentEntityType: "player",
      currentSeason: undefined,
      expiresAt: Date.now() + 60_000,
    };
    const result = (await handlerOf(higherLower.getSession)(
      { db: { get: async () => session } },
      { sessionId: "hl_1" },
    )) as Record<string, unknown>;

    expect(result).not.toHaveProperty("playerBValue");
    expect(result.playerAValue).toBe(100);
  });

  it("verveGrid.getSession strips validPlayerIds from every cell", async () => {
    const session = {
      _id: "vg_1",
      userId: "stub_user",
      sport: "football",
      boardTemplateId: "tmpl",
      boardAxisFamily: "family",
      rows: [{ type: "team", key: "r1", label: "Row 1" }],
      cols: [{ type: "team", key: "c1", label: "Col 1" }],
      cells: [
        {
          rowIdx: 0,
          colIdx: 0,
          validPlayerIds: ["p1", "p2"],
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
    const result = (await handlerOf(verveGrid.getSession)(
      { db: { get: async () => session } },
      { sessionId: "vg_1" },
    )) as { cells: Array<Record<string, unknown>> };

    expect(result.cells[0]).not.toHaveProperty("validPlayerIds");
    expect(result.cells[0].validAnswerCount).toBe(2);
  });

  it("whoAmI.getSession strips answerName after terminal states", async () => {
    const session = {
      _id: "wai_1",
      userId: "stub_user",
      sport: "football",
      clueExternalId: "clue_x",
      answerName: "Hidden Player",
      currentStage: 4,
      score: 0,
      status: "failed",
      expiresAt: Date.now() + 60_000,
    };
    const clue = {
      externalId: "clue_x",
      clue1: "One",
      clue2: "Two",
      clue3: "Three",
      clue4: "Four",
      difficulty: "medium",
    };
    const ctx = {
      db: {
        get: async () => session,
        query: () => ({
          withIndex: () => ({ first: async () => clue }),
        }),
      },
    };

    const result = (await handlerOf(whoAmI.getSession)(ctx, {
      sessionId: "wai_1",
    })) as Record<string, unknown>;

    expect(result).not.toHaveProperty("answerName");
    expect(result.clues).toEqual(["One", "Two", "Three", "Four"]);
  });
});

describe("BLOCKER-5: daily attempts enforce ownership and server time", () => {
  function makeOtherAttempt(overrides: Record<string, unknown> = {}) {
    return {
      _id: "attempt_1",
      userId: "other_user",
      date: "2026-05-29",
      sport: "football",
      mode: "quiz",
      score: 0,
      completed: false,
      forfeited: false,
      results: [],
      startedAt: Date.now() - 4_000,
      expiresAt: Date.now() + 60_000,
      currentQuestionStartedAt: Date.now() - 4_000,
      ...overrides,
    };
  }

  it("refuses submitAnswer on another user's attempt", async () => {
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => makeOtherAttempt(),
        patch,
      },
    };

    await expect(
      handlerOf(dailyChallenge.submitAnswer)(ctx, {
        attemptId: "attempt_1",
        answer: "A",
        questionIndex: 0,
      }),
    ).rejects.toThrow("Not authorized for this attempt");
    expect(patch).not.toHaveBeenCalled();
  });

  it("refuses forfeit on another user's attempt", async () => {
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => makeOtherAttempt(),
        patch,
      },
    };

    await expect(
      handlerOf(dailyChallenge.forfeit)(ctx, { attemptId: "attempt_1" }),
    ).rejects.toThrow("Not authorized for this attempt");
    expect(patch).not.toHaveBeenCalled();
  });

  it("refuses completeAttempt on another user's attempt", async () => {
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => makeOtherAttempt({
          results: Array.from({ length: 10 }, () => ({
            correct: true,
            timeTaken: 1,
            score: 100,
          })),
        }),
        patch,
      },
    };

    await expect(
      handlerOf(dailyChallenge.completeAttempt)(ctx, { attemptId: "attempt_1" }),
    ).rejects.toThrow("Not authorized for this attempt");
    expect(patch).not.toHaveBeenCalled();
  });

  it("ignores client timeTaken when scoring daily answers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:04.000Z"));
    const startedAt = Date.now() - 4_000;
    const patch = vi.fn();
    const attempt = {
      _id: "attempt_1",
      userId: "stub_user",
      date: "2026-05-29",
      sport: "football",
      mode: "quiz",
      score: 0,
      completed: false,
      forfeited: false,
      results: [],
      startedAt,
      expiresAt: Date.now() + 60_000,
      currentQuestionStartedAt: startedAt,
      questionStartedAts: [startedAt],
    };
    const challenge = {
      _id: "challenge_1",
      date: "2026-05-29",
      sport: "football",
      mode: "quiz",
      questionChecksums: ["checksum_1"],
      questionSnapshots: [
        {
          checksum: "checksum_1",
          question: "Question?",
          options: ["A", "B", "C", "D"],
          correctAnswer: "A",
          explanation: "Stored explanation",
          category: "football",
        },
      ],
      survivalInitials: [],
      createdAt: 1,
    };
    const ctx = {
      db: {
        get: async () => attempt,
        patch,
        query: makeDailyQuery(challenge),
      },
    };

    const result = (await handlerOf(dailyChallenge.submitAnswer)(ctx, {
      attemptId: "attempt_1",
      answer: "A",
      questionIndex: 0,
      timeTaken: 0.1,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: true,
      score: 67,
      totalScore: 67,
      timeTaken: 4,
    });
    expect(patch).toHaveBeenCalledWith(
      "attempt_1",
      expect.objectContaining({
        score: 67,
        currentQuestionStartedAt: Date.now(),
        questionStartedAts: [startedAt, Date.now()],
      }),
    );
  });
});

describe("backward-compatible public arg schemas", () => {
  it("keeps legacy client args while server handlers ignore them", () => {
    expect(argsOf(quizSessions.checkAnswer)).toEqual(
      expect.objectContaining({
        sessionId: expect.anything(),
        answer: expect.anything(),
        correctAnswer: expect.anything(),
        timeTaken: expect.anything(),
      }),
    );
    expect(argsOf(blitz.submitAnswer)).toEqual(
      expect.objectContaining({
        sessionId: expect.anything(),
        answer: expect.anything(),
        checksum: expect.anything(),
        correctAnswer: expect.anything(),
      }),
    );
    expect(argsOf(dailyChallenge.submitAnswer)).toEqual(
      expect.objectContaining({
        attemptId: expect.anything(),
        answer: expect.anything(),
        questionIndex: expect.anything(),
        correctAnswer: expect.anything(),
        timeTaken: expect.anything(),
      }),
    );
    expect(argsOf(games.completeQuiz)).toEqual(
      expect.objectContaining({
        sessionId: expect.anything(),
        score: expect.anything(),
        accuracy: expect.anything(),
        averageTime: expect.anything(),
      }),
    );
    expect(argsOf(games.completeSurvival)).toEqual(
      expect.objectContaining({
        sessionId: expect.anything(),
        score: expect.anything(),
        durationSeconds: expect.anything(),
        performanceBonus: expect.anything(),
      }),
    );
  });
});
