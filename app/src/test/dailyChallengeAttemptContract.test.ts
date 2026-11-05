import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => "user_1"),
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

import * as dailyChallenge from "../../convex/dailyChallenge";

type RegisteredFunction = {
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
};

type DailyAttemptRow = {
  _id: string;
  userId: string;
  date: string;
  sport: string;
  mode: "quiz";
  score: number;
  completed: boolean;
  forfeited: boolean;
  results: unknown;
  startedAt: number;
  expiresAt?: number;
  currentQuestionStartedAt?: number;
  completedAt?: number;
};

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

function makeAttempt(overrides: Partial<DailyAttemptRow> = {}): DailyAttemptRow {
  const now = Date.now();
  return {
    _id: "attempt_1",
    userId: "user_1",
    date: "2026-05-23",
    sport: "football",
    mode: "quiz",
    score: 0,
    completed: false,
    forfeited: false,
    results: [],
    startedAt: now - 60_000,
    expiresAt: now + 60_000,
    currentQuestionStartedAt: now - 60_000,
    ...overrides,
  };
}

function makeDailyAttemptsQuery(attempts: DailyAttemptRow[]) {
  return (table: string) => {
    if (table !== "dailyAttempts") {
      throw new Error(`Unexpected table query: ${table}`);
    }
    return {
      withIndex: (_indexName: string, select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
        const filters: Record<string, unknown> = {};
        const builder = {
          eq(field: string, value: unknown) {
            filters[field] = value;
            return builder;
          },
        };
        select(builder);
        return {
          first: async () =>
            attempts.find((attempt) =>
              Object.entries(filters).every(
                ([field, value]) => attempt[field as keyof DailyAttemptRow] === value,
              ),
            ) ?? null,
        };
      },
    };
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("daily challenge attempt gating", () => {
  it("does not count an unanswered active attempt as already played", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    const attempt = makeAttempt();
    const ctx = {
      db: {
        get: async () => ({ _id: "user_1", username: "user_1", isAnonymous: false }),
        query: makeDailyAttemptsQuery([attempt]),
      },
    };

    const result = await handlerOf(dailyChallenge.getAttemptStatus)(ctx, {
      sport: "football",
      mode: "quiz",
    });

    expect(result).toBeNull();
  });

  it("returns a stable reset timestamp once the attempt has been used", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    const attempt = makeAttempt({
      score: 75,
      results: [{ correct: true, score: 75, timeTaken: 3 }],
    });
    const ctx = {
      db: {
        get: async () => ({ _id: "user_1", username: "user_1", isAnonymous: false }),
        query: makeDailyAttemptsQuery([attempt]),
      },
    };

    const result = (await handlerOf(dailyChallenge.getAttemptStatus)(ctx, {
      sport: "football",
      mode: "quiz",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      attemptId: "attempt_1",
      score: 75,
      completed: false,
      forfeited: false,
      answeredCount: 1,
      resetAt: Date.parse("2026-05-24T00:00:00.000Z"),
    });
  });

  function startCtx(attempt: DailyAttemptRow) {
    const patch = vi.fn();
    const insert = vi.fn();
    const ctx = {
      db: {
        get: async () => ({ _id: "user_1", username: "user_1", isAnonymous: false }),
        query: makeDailyAttemptsQuery([attempt]),
        patch,
        insert,
      },
    };
    return { ctx, patch, insert };
  }

  it("resumes a live unanswered attempt with its original clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    const now = Date.now();
    const attempt = makeAttempt({
      startedAt: now - 5 * 60_000,
      expiresAt: now + 25 * 60_000,
      currentQuestionStartedAt: now - 5 * 60_000,
    });
    const { ctx, patch, insert } = startCtx(attempt);

    const result = await handlerOf(dailyChallenge.startAttempt)(ctx, {
      sport: "football",
      mode: "quiz",
    });

    expect(result).toEqual({ attemptId: "attempt_1", resumeAt: 0, results: [], score: 0 });
    expect(insert).not.toHaveBeenCalled();
    // Resetting the clock would let a player read question 1, restart, and
    // answer it on a fresh timer.
    expect(patch).not.toHaveBeenCalled();
  });

  it("an expired unanswered attempt records question 1 as a timeout and continues at question 2", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    const now = Date.now();
    const attempt = makeAttempt({
      startedAt: now - 40 * 60_000,
      expiresAt: now - 10 * 60_000,
      currentQuestionStartedAt: now - 40 * 60_000,
    });
    const { ctx, patch } = startCtx(attempt);

    const result = await handlerOf(dailyChallenge.startAttempt)(ctx, {
      sport: "football",
      mode: "quiz",
    });

    const timedOut = { correct: false, timeTaken: 10, score: 0, timedOut: true };
    // Question 1 was served when the attempt started; a fresh clock on it
    // would be free thinking time, so it is spent as a timeout.
    expect(result).toEqual({ attemptId: "attempt_1", resumeAt: 1, results: [timedOut], score: 0 });
    expect(patch).toHaveBeenCalledWith(
      "attempt_1",
      expect.objectContaining({
        results: [timedOut],
        currentQuestionStartedAt: now,
        questionStartedAts: [now - 40 * 60_000, now],
        expiresAt: now + 30 * 60 * 1000,
      }),
    );
    // The original start is kept, never reset.
    expect(patch.mock.calls[0][1]).not.toHaveProperty("startedAt");
  });

  it("resumes (never restarts) today's expired attempt that has answers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    const now = Date.now();
    const attempt = makeAttempt({
      startedAt: now - 40 * 60_000,
      expiresAt: now - 10 * 60_000,
      score: 100,
      results: [{ correct: true, score: 100, timeTaken: 1 }],
    });
    const { ctx, patch, insert } = startCtx(attempt);

    const result = await handlerOf(dailyChallenge.startAttempt)(ctx, { sport: "football", mode: "quiz" });
    // Continue at question 2; nothing reset or re-revealed.
    expect(result).toMatchObject({ attemptId: "attempt_1", resumeAt: 1, score: 100 });
    expect(patch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();

    const status = await handlerOf(dailyChallenge.getAttemptStatus)(ctx, {
      sport: "football",
      mode: "quiz",
    });
    expect(status).toMatchObject({ attemptId: "attempt_1", answeredCount: 1, resumable: true });
  });

  it("a finished attempt is still refused", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
    const attempt = makeAttempt({
      completed: true,
      results: [{ correct: true, score: 100, timeTaken: 1 }],
    });
    const { ctx, patch } = startCtx(attempt);
    await expect(
      handlerOf(dailyChallenge.startAttempt)(ctx, { sport: "football", mode: "quiz" }),
    ).rejects.toThrow();
    expect(patch).not.toHaveBeenCalled();
    const status = await handlerOf(dailyChallenge.getAttemptStatus)(ctx, {
      sport: "football",
      mode: "quiz",
    });
    expect(status).toMatchObject({ resumable: false });
  });
});
