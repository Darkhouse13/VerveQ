import { describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "anon_user" }));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => authState.userId),
}));

import * as dailyChallenge from "../../convex/dailyChallenge";
import * as games from "../../convex/games";
import * as leaderboards from "../../convex/leaderboards";

function handlerOf<T>(mutation: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const fn = mutation as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof fn._handler !== "function") {
    throw new Error("not a Convex function with an accessible handler");
  }
  return fn._handler;
}

function rankedSession(userId: string) {
  return {
    _id: "session_1",
    userId,
    sport: "football",
    mode: "quiz",
    difficulty: "intermediate",
    completed: false,
    expiresAt: Date.now() + 60_000,
    totalAnswers: 1,
    correctCount: 1,
    sumAnswerTimeMs: 2_000,
    score: 100,
  };
}

describe("ranked eligibility guardrail", () => {
  it("rejects anonymous ranked quiz completion before rating writes", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async (id: string) =>
          id === "anon_user" ? { _id: "anon_user", isAnonymous: true } : rankedSession("anon_user"),
        ),
        insert,
      },
    };

    await expect(
      handlerOf(games.completeQuiz)(ctx, { sessionId: "session_1" }),
    ).rejects.toThrow(/full account required/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("keeps full-account ranked quiz completion writing ELO", async () => {
    authState.userId = "full_user";
    const insert = vi.fn(async () => "inserted_id");
    const patch = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => {
          if (id === "full_user") {
            return {
              _id: "full_user",
              username: "full_user",
              isAnonymous: false,
              totalGames: 0,
            };
          }
          return rankedSession("full_user");
        }),
        query: (table: string) => ({
          withIndex: () => ({
            first: async () => null,
            collect: async () => (table === "decayNotifications" ? [] : []),
          }),
        }),
        insert,
        patch,
      },
    };

    const result = (await handlerOf(games.completeQuiz)(ctx, {
      sessionId: "session_1",
    })) as { newElo: number };

    expect(result.newElo).toBeGreaterThan(1200);
    expect(insert).toHaveBeenCalledWith(
      "userRatings",
      expect.objectContaining({ userId: "full_user", gamesPlayed: 1 }),
    );
    expect(insert).toHaveBeenCalledWith(
      "gameSessions",
      expect.objectContaining({ userId: "full_user", sessionType: "game" }),
    );
  });

  it("excludes anonymous ratings from the global leaderboard", async () => {
    const ratings = [
      {
        _id: "rating_anon",
        userId: "anon_user",
        sport: "football",
        mode: "quiz",
        eloRating: 1800,
        bestScore: 10,
        gamesPlayed: 5,
        wins: 5,
      },
      {
        _id: "rating_full",
        userId: "full_user",
        sport: "football",
        mode: "quiz",
        eloRating: 1400,
        bestScore: 8,
        gamesPlayed: 5,
        wins: 3,
      },
    ];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({
            order: () => ({ collect: async () => ratings }),
          }),
          collect: async () => ratings,
        }),
        get: vi.fn(async (id: string) =>
          id === "anon_user"
            ? { _id: "anon_user", username: "anon", isAnonymous: true }
            : { _id: "full_user", username: "full_user", isAnonymous: false },
        ),
      },
    };

    const result = (await handlerOf(leaderboards.getLeaderboard)(ctx, {
      sport: "football",
      mode: "quiz",
      limit: 20,
    })) as { entries: Array<{ userId: string }> };

    expect(result.entries.map((entry) => entry.userId)).toEqual(["full_user"]);
  });

  // DELIBERATE contract flip (2026-07): the Daily is the habit loop, never
  // writes ELO, and keys attempts/streaks off the server identity — so it
  // admits any user with a username, anonymous included. The gate that
  // remains is username-tier, not full-account.
  it("admits username-only (anonymous) users to the official Daily", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn(async () => "attempt_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "anon_user",
          username: "guest_martin",
          isAnonymous: true,
        })),
        query: () => ({
          withIndex: () => ({ first: async () => null }),
        }),
        insert,
      },
    };

    const result = (await handlerOf(dailyChallenge.startAttempt)(ctx, {
      sport: "football",
      mode: "quiz",
    })) as { attemptId: string };

    expect(result.attemptId).toBe("attempt_1");
    expect(insert).toHaveBeenCalledWith(
      "dailyAttempts",
      expect.objectContaining({ userId: "anon_user", mode: "quiz" }),
    );
  });

  it("still rejects Daily attempts from identities without a username", async () => {
    authState.userId = "bare_user";
    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "bare_user", isAnonymous: true })),
      },
    };

    await expect(
      handlerOf(dailyChallenge.startAttempt)(ctx, {
        sport: "football",
        mode: "quiz",
      }),
    ).rejects.toThrow(/username required/i);
  });
});
