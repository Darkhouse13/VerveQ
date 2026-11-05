import { beforeEach, describe, expect, it, vi } from "vitest";

// Perf/security loop round 2 (2026-11-05): question content is served only at
// the player's progress, never ahead of it, and an unanswered question can't be
// swapped for a fresh one. Also pins that ranked completion reports its
// achievement unlocks in the same round trip.

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
import * as quizSessions from "../../convex/quizSessions";
import { assertDailyQuestionReadable } from "../../convex/lib/dailyQuestionGate";

type RegisteredFunction = {
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
};

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("user_1");
});

describe("daily quiz read gate", () => {
  it("allows answered questions and the current one only", () => {
    expect(() => assertDailyQuestionReadable([], 0)).not.toThrow();
    expect(() => assertDailyQuestionReadable([{}], 0)).not.toThrow();
    expect(() => assertDailyQuestionReadable([{}], 1)).not.toThrow();
    expect(() => assertDailyQuestionReadable([], 1)).toThrow("Question not available yet");
    expect(() => assertDailyQuestionReadable([{}, {}], 5)).toThrow("Question not available yet");
    expect(() => assertDailyQuestionReadable(undefined, 0)).not.toThrow();
  });

  it("rejects bad indexes", () => {
    expect(() => assertDailyQuestionReadable([], -1)).toThrow("Question index out of range");
    expect(() => assertDailyQuestionReadable([], 0.5)).toThrow("Question index out of range");
  });

  it("dailyChallenge.getQuestion refuses an index ahead of progress before reading content", async () => {
    const attempt = {
      _id: "attempt_1",
      userId: "user_1",
      date: "2026-11-05",
      sport: "football",
      mode: "quiz",
      completed: false,
      forfeited: false,
      results: [],
      startedAt: Date.now() - 1_000,
      expiresAt: Date.now() + 60_000,
    };
    const challengeLookups = vi.fn();
    const ctx = {
      db: {
        get: async (id: string) =>
          id === "user_1" ? { _id: "user_1", username: "u", isAnonymous: false } : attempt,
        query: (table: string) => {
          challengeLookups(table);
          return { withIndex: () => ({ collect: async () => [] }) };
        },
      },
      storage: { getUrl: vi.fn() },
    };

    await expect(
      handlerOf(dailyChallenge.getQuestion)(ctx, { attemptId: "attempt_1", questionIndex: 4 }),
    ).rejects.toThrow("Question not available yet");
  });
});

describe("ranked quiz reroll guard", () => {
  it("re-serves the unanswered question and keeps its clock", async () => {
    const current = {
      _id: "q_current",
      sport: "football",
      category: "clubs",
      difficulty: "intermediate",
      question: "Current question?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      checksum: "chk_current",
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    };
    const other = { ...current, _id: "q_other", question: "Other?", checksum: "chk_other" };
    const session = {
      _id: "session_1",
      userId: "user_1",
      sport: "football",
      mode: "quiz",
      difficulty: "intermediate",
      usedChecksums: ["chk_current"],
      plannedChecksums: ["chk_current", "chk_other"],
      currentChecksum: "chk_current",
      questionStartedAt: 1_000,
      completed: false,
      expiresAt: Date.now() + 60_000,
    };
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => session,
        query: (table: string) => {
          if (table !== "quizQuestions") throw new Error(`Unexpected table query: ${table}`);
          return {
            withIndex: (_i: string, select: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) => {
              let wanted: unknown;
              const b = {
                eq(_f: string, v: unknown) {
                  wanted = v;
                  return b;
                },
              };
              select(b);
              const rows = [current, other].filter((r) => r.checksum === wanted);
              return { first: async () => rows[0] ?? null, collect: async () => rows };
            },
          };
        },
        patch,
      },
      storage: { getUrl: vi.fn() },
    };

    const result = (await handlerOf(quizSessions.getQuestion)(ctx, {
      sessionId: "session_1",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ question: "Current question?", checksum: "chk_current" });
    expect(result).not.toHaveProperty("correctAnswer");
    // No new draw, no clock reset.
    expect(patch).not.toHaveBeenCalled();
  });
});

describe("ranked completion reports unlocks", () => {
  it("completeQuiz and completeSurvival share the unlock helper with checkAndUnlock", async () => {
    const { readFileSync } = await import("node:fs");
    const games = readFileSync("convex/games.ts", "utf8");
    const achievements = readFileSync("convex/achievements.ts", "utf8");
    // completeQuiz passes the just-finished game (Quiz Master without a history scan).
    expect(games.match(/await unlockAchievements\(ctx, userId[,)]/g)?.length).toBe(2);
    expect(games.match(/newlyUnlocked,/g)?.length).toBe(2);
    expect(achievements).toContain("return await unlockAchievements(ctx, userId);");
  });
});
