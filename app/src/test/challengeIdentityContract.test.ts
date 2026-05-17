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
});
