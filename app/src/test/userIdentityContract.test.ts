import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "new_user"),
}));

import * as users from "../../convex/users";

function handlerOf<T>(mutation: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const fn = mutation as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof fn._handler !== "function") {
    throw new Error("not a Convex mutation with an accessible handler");
  }
  return fn._handler;
}

describe("user identity uniqueness", () => {
  it("normalizes new usernames to lowercase safe handles before saving", async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "new_user" })),
        patch,
        query: () => ({
          withIndex: () => ({ first: async () => null }),
        }),
      },
    };

    await handlerOf(users.ensureProfile)(ctx, {
      username: " DarkHouse13!! ",
      displayName: "DarkHouse13",
      isGuest: false,
    });

    expect(patch).toHaveBeenCalledWith(
      "new_user",
      expect.objectContaining({ username: "darkhouse13" }),
    );
  });

  it("does not allow a case-insensitive duplicate username to keep the same handle", async () => {
    const patch = vi.fn(async () => undefined);
    let attemptedUsername = "";
    const ctx = {
      db: {
        get: vi.fn(async () => ({ _id: "new_user" })),
        patch,
        query: () => ({
          withIndex: (_indexName: string, builder: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
            builder({ eq: (_field, value) => { attemptedUsername = value; return {}; } });
            return {
              first: async () =>
                attemptedUsername === "darkhouse13"
                  ? { _id: "existing_user", username: "darkhouse13" }
                  : null,
            };
          },
        }),
      },
    };

    await handlerOf(users.ensureProfile)(ctx, {
      username: "DarkHouse13",
      displayName: "DarkHouse13",
      isGuest: false,
    });

    const saved = patch.mock.calls[0]?.[1] as { username?: string };
    expect(saved.username).toMatch(/^darkhouse13_[a-z0-9]{4}$/);
    expect(saved.username).not.toBe("darkhouse13");
  });
});
