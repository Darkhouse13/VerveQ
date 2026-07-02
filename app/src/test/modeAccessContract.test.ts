import { describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ userId: "anon_user" as string | null }));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => authState.userId),
}));

import * as blitz from "../../convex/blitz";
import * as challengeArenas from "../../convex/challengeArenas";
import * as quizSessions from "../../convex/quizSessions";
import * as survivalSessions from "../../convex/survivalSessions";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

function usernameOnlyUser() {
  return {
    _id: "anon_user",
    username: "anon_user",
    displayName: "Anon User",
    isGuest: false,
    isAnonymous: true,
  };
}

describe("mode access gates", () => {
  it("allows username-only users to create Arena lobbies", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn(async () => "arena_1");
    const ctx = {
      db: {
        get: vi.fn(async () => usernameOnlyUser()),
        query: () => ({
          withIndex: () => ({
            first: async () => null,
          }),
        }),
        insert,
      },
    };

    const result = (await handlerOf(challengeArenas.create)(ctx, {
      mode: "1v1",
    })) as { arenaId: string; code: string };

    expect(result.arenaId).toBe("arena_1");
    expect(insert).toHaveBeenCalledWith(
      "arenas",
      expect.objectContaining({
        hostId: "anon_user",
        players: [
          expect.objectContaining({
            userId: "anon_user",
            nameSnapshot: "Anon User",
          }),
        ],
      }),
    );
  });

  it("rejects anonymous users without a username before Arena creation", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "anon_user",
          isGuest: false,
          isAnonymous: true,
        })),
        insert,
      },
    };

    await expect(
      handlerOf(challengeArenas.create)(ctx, { mode: "1v1" }),
    ).rejects.toThrow(/username required/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("allows username-only users to start casual Blitz sessions", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn(async () => "blitz_1");
    const ctx = {
      db: {
        get: vi.fn(async () => usernameOnlyUser()),
        // blitz.start now plans the run's question sequence up front, so it
        // queries the pool; an empty pool still creates the session.
        query: vi.fn(() => ({
          withIndex: () => ({ collect: async () => [] }),
        })),
        insert,
      },
    };

    await expect(
      handlerOf(blitz.start)(ctx, { sport: "football" }),
    ).resolves.toMatchObject({ sessionId: "blitz_1" });
    expect(insert).toHaveBeenCalledWith(
      "blitzSessions",
      expect.objectContaining({ userId: "anon_user" }),
    );
  });

  it("rejects username-only users before ranked quiz session creation", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async () => usernameOnlyUser()),
        insert,
      },
    };

    await expect(
      handlerOf(quizSessions.createSession)(ctx, {
        sport: "knowledge",
        mode: "quiz",
      }),
    ).rejects.toThrow(/full account required/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects username-only users before ranked Survival creation", async () => {
    authState.userId = "anon_user";
    const insert = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async () => usernameOnlyUser()),
        insert,
      },
    };

    await expect(
      handlerOf(survivalSessions.startGame)(ctx, { sport: "football" }),
    ).rejects.toThrow(/full account required/i);
    expect(insert).not.toHaveBeenCalled();
  });
});
