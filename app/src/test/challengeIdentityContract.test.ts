import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "challenger_user"),
}));

import * as challenges from "../../convex/challenges";

function handlerOf<T>(mutation: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const fn = mutation as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof fn._handler !== "function") {
    throw new Error("not a Convex mutation with an accessible handler");
  }
  return fn._handler;
}

describe("challenge identity lookup", () => {
  it("can create a challenge using the target profile display name when the internal username differs", async () => {
    const challengedUser = {
      _id: "challenged_user",
      username: "darkhouse13",
      displayName: "DarkHouse13",
    };
    const inserted = vi.fn(async () => "challenge_1");

    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "challenger_user", username: "challenger", isGuest: false })),
        query: (table: string) => {
          expect(table).toBe("users");
          return {
            withIndex: (_indexName: string, _builder: unknown) => ({
              first: async () => null,
            }),
            collect: async () => [challengedUser],
          };
        },
        insert: inserted,
      },
    };

    const result = await handlerOf(challenges.create)(ctx, {
      challengedUsername: "DarkHouse13",
      sport: "football",
      mode: "quiz",
    });

    expect(result).toEqual({ challengeId: "challenge_1" });
    expect(inserted).toHaveBeenCalledWith("challenges", {
      challengerId: "challenger_user",
      challengedId: "challenged_user",
      sport: "football",
      mode: "quiz",
      status: "pending",
    });
  });

  it("rejects ambiguous display-name challenge targets instead of silently sending to the wrong duplicate", async () => {
    const duplicateTargets = [
      { _id: "target_old", username: "darkhouse13", displayName: "DarkHouse13" },
      { _id: "target_current", username: "hamza", displayName: "DarkHouse13" },
    ];
    const inserted = vi.fn(async () => "challenge_1");

    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "challenger_user", username: "challenger", isGuest: false })),
        query: (table: string) => {
          expect(table).toBe("users");
          return {
            withIndex: (_indexName: string, _builder: unknown) => ({
              first: async () => null,
            }),
            collect: async () => duplicateTargets,
          };
        },
        insert: inserted,
      },
    };

    await expect(
      handlerOf(challenges.create)(ctx, {
        challengedUsername: "DarkHouse13",
        sport: "football",
        mode: "quiz",
      }),
    ).rejects.toThrow(/multiple users match/i);
    expect(inserted).not.toHaveBeenCalled();
  });

  it("prefers an exact username over duplicate display-name matches", async () => {
    const exactUsernameTarget = {
      _id: "target_exact",
      username: "darkhouse13",
      displayName: "Old Display",
    };
    const inserted = vi.fn(async () => "challenge_1");

    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "challenger_user", username: "challenger", isGuest: false })),
        query: (table: string) => {
          expect(table).toBe("users");
          return {
            withIndex: (_indexName: string, _builder: unknown) => ({
              first: async () => exactUsernameTarget,
            }),
            collect: async () => {
              throw new Error("should not scan display names after exact username match");
            },
          };
        },
        insert: inserted,
      },
    };

    await expect(
      handlerOf(challenges.create)(ctx, {
        challengedUsername: "DarkHouse13",
        sport: "football",
        mode: "quiz",
      }),
    ).resolves.toEqual({ challengeId: "challenge_1" });
    expect(inserted).toHaveBeenCalledWith(
      "challenges",
      expect.objectContaining({ challengedId: "target_exact" }),
    );
  });

  it("rejects challenge creation when the challenger has no permanent username", async () => {
    const inserted = vi.fn(async () => "challenge_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "challenger_user", isGuest: true })),
        query: () => ({
          withIndex: () => ({ first: async () => null }),
          collect: async () => [{ _id: "target", username: "target_user", displayName: "Target" }],
        }),
        insert: inserted,
      },
    };

    await expect(
      handlerOf(challenges.create)(ctx, {
        challengedUsername: "target_user",
        sport: "football",
        mode: "quiz",
      }),
    ).rejects.toThrow(/username.*required|create an account/i);
    expect(inserted).not.toHaveBeenCalled();
  });

  it("rejects challenge targets that do not have a permanent username", async () => {
    const inserted = vi.fn(async () => "challenge_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "challenger_user", username: "challenger", isGuest: false })),
        query: () => ({
          withIndex: () => ({ first: async () => null }),
          collect: async () => [{ _id: "guest_target", username: "", displayName: "Guest", isGuest: true }],
        }),
        insert: inserted,
      },
    };

    await expect(
      handlerOf(challenges.create)(ctx, {
        challengedUsername: "Guest",
        sport: "football",
        mode: "quiz",
      }),
    ).rejects.toThrow(/username.*required|registered account/i);
    expect(inserted).not.toHaveBeenCalled();
  });

});
