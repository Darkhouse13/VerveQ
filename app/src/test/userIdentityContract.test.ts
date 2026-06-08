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

function makeProfileCtx(options?: {
  existingUser?: Record<string, unknown>;
  users?: Array<Record<string, unknown>>;
  claims?: Array<Record<string, unknown>>;
  patch?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
}) {
  const patch = options?.patch ?? vi.fn(async () => undefined);
  const claims = [...(options?.claims ?? [])];
  const usersTable = options?.users ?? [];
  const existingUser = options?.existingUser ?? { _id: "new_user" };
  const insert = options?.insert ?? vi.fn(async (_table: string, row: Record<string, unknown>) => {
    const id = `claim_${claims.length + 1}`;
    claims.push({ _id: id, ...row });
    return id;
  });

  return {
    db: {
      get: vi.fn(async () => existingUser),
      patch,
      insert,
      query: (table: string) => ({
        withIndex: (
          _indexName: string,
          builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
        ) => {
          let field = "";
          let value: unknown;
          builder({
            eq: (nextField, nextValue) => {
              field = nextField;
              value = nextValue;
              return {};
            },
          });
          const rows = table === "usernameClaims" ? claims : usersTable;
          const filtered = rows.filter((row) => row[field] === value);
          return {
            first: async () => filtered[0] ?? null,
            collect: async () => filtered,
          };
        },
        collect: async () => (table === "usernameClaims" ? claims : usersTable),
      }),
    },
    claims,
    patch,
    insert,
  };
}

describe("user identity uniqueness", () => {
  it("normalizes new usernames to lowercase safe handles before saving", async () => {
    const ctx = makeProfileCtx();

    await handlerOf(users.ensureProfile)(ctx, {
      username: " DarkHouse13!! ",
      displayName: "DarkHouse13",
      isGuest: false,
    });

    expect(ctx.patch).toHaveBeenCalledWith(
      "new_user",
      expect.objectContaining({ username: "darkhouse13" }),
    );
    expect(ctx.claims).toHaveLength(1);
    expect(ctx.claims[0]).toMatchObject({
      key: "darkhouse13",
      username: "darkhouse13",
      userId: "new_user",
    });
  });

  it("rejects a case-insensitive duplicate username instead of auto-suffixing", async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = makeProfileCtx({
      patch,
      users: [{ _id: "existing_user", username: "darkhouse13" }],
    });

    await expect(
      handlerOf(users.ensureProfile)(ctx, {
        username: "DarkHouse13",
        displayName: "DarkHouse13",
        isGuest: false,
      }),
    ).rejects.toThrow(/username is already taken/i);
    expect(patch).not.toHaveBeenCalled();
  });

  it("replaces an auth-provider email-local username with the explicit signup username", async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = makeProfileCtx({
      patch,
      existingUser: {
          _id: "new_user",
          email: "mail.prefix@example.com",
          username: "mailprefix",
          displayName: "Mail Prefix",
          isGuest: false,
      },
      users: [{ _id: "new_user", username: "mailprefix" }],
    });

    await handlerOf(users.ensureProfile)(ctx, {
      username: "chosen_handle",
      displayName: "Chosen Handle",
      isGuest: false,
    });

    expect(patch).toHaveBeenCalledWith(
      "new_user",
      expect.objectContaining({ username: "chosen_handle" }),
    );
  });

  it("rejects backend guest profile writes because guests are tab-local only", async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = makeProfileCtx({ patch });

    await expect(
      handlerOf(users.ensureProfile)(ctx, {
        username: "guest_123",
        displayName: "Guest",
        isGuest: true,
      }),
    ).rejects.toThrow(/guest sessions are temporary/i);
    expect(patch).not.toHaveBeenCalled();
  });

});
