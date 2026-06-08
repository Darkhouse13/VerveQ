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
  authAccounts?: Array<Record<string, unknown>>;
  onboardingAttempts?: Array<Record<string, unknown>>;
  patch?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
}) {
  const patch = options?.patch ?? vi.fn(async () => undefined);
  const claims = [...(options?.claims ?? [])];
  const authAccounts = [...(options?.authAccounts ?? [])];
  const onboardingAttempts = [...(options?.onboardingAttempts ?? [])];
  const usersTable = options?.users ?? [];
  const existingUser = options?.existingUser ?? { _id: "new_user" };
  const insert = options?.insert ?? vi.fn(async (_table: string, row: Record<string, unknown>) => {
    const rows =
      _table === "authAccounts"
        ? authAccounts
        : _table === "anonymousOnboardingAttempts"
          ? onboardingAttempts
          : claims;
    const id =
      _table === "authAccounts"
        ? `account_${authAccounts.length + 1}`
        : _table === "anonymousOnboardingAttempts"
          ? `attempt_${onboardingAttempts.length + 1}`
          : `claim_${claims.length + 1}`;
    rows.push({ _id: id, ...row });
    return id;
  });
  const deleteFn = options?.delete ?? vi.fn(async (id: string) => {
    const index = authAccounts.findIndex((row) => row._id === id);
    if (index >= 0) authAccounts.splice(index, 1);
  });

  return {
    db: {
      get: vi.fn(async () => existingUser),
      patch,
      insert,
      delete: deleteFn,
      query: (table: string) => ({
        withIndex: (
          _indexName: string,
          builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
        ) => {
          const filters: Record<string, unknown> = {};
          const q = {
            eq: (nextField, nextValue) => {
              filters[nextField] = nextValue;
              return q;
            },
          };
          builder(q);
          const rows =
            table === "usernameClaims"
              ? claims
              : table === "authAccounts"
                ? authAccounts
                : table === "anonymousOnboardingAttempts"
                  ? onboardingAttempts
                  : usersTable;
          const filtered = rows.filter((row) =>
            Object.entries(filters).every(([field, value]) => row[field] === value),
          );
          return {
            first: async () => filtered[0] ?? null,
            collect: async () => filtered,
            unique: async () => {
              if (filtered.length > 1) throw new Error("not unique");
              return filtered[0] ?? null;
            },
          };
        },
        collect: async () =>
          table === "usernameClaims"
            ? claims
            : table === "authAccounts"
              ? authAccounts
              : table === "anonymousOnboardingAttempts"
                ? onboardingAttempts
                : usersTable,
      }),
    },
    claims,
    authAccounts,
    onboardingAttempts,
    patch,
    insert,
    delete: deleteFn,
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

  it("attaches a username to a real anonymous user while keeping ranked-exclusion identity", async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = makeProfileCtx({
      patch,
      existingUser: { _id: "new_user", isAnonymous: true },
    });

    const result = await handlerOf(users.claimUsernameOnly)(ctx, {
      username: " ArenaGuest ",
      displayName: "Arena Guest",
      deviceNonce: " device-1 ",
      inviteCode: " abc123 ",
    });

    expect(result).toMatchObject({
      userId: "new_user",
      username: "arenaguest",
      isAnonymous: true,
      isGuest: false,
    });
    expect(patch).toHaveBeenCalledWith(
      "new_user",
      expect.objectContaining({
        username: "arenaguest",
        displayName: "Arena Guest",
        isGuest: false,
        totalGames: 0,
      }),
    );
    expect(ctx.onboardingAttempts).toHaveLength(1);
    expect(ctx.onboardingAttempts[0]).toMatchObject({
      userId: "new_user",
      deviceNonce: "device-1",
      inviteCode: "ABC123",
      kind: "username_claim",
    });
  });

  it("rejects username-only attach without an anonymous Convex identity", async () => {
    const ctx = makeProfileCtx({
      existingUser: { _id: "new_user", isAnonymous: false },
    });

    await expect(
      handlerOf(users.claimUsernameOnly)(ctx, {
        username: "fulluser",
      }),
    ).rejects.toThrow(/anonymous session/i);
  });

  it("rate-limits username-only claims per anonymous user before username writes", async () => {
    const patch = vi.fn(async () => undefined);
    const now = Date.now();
    const ctx = makeProfileCtx({
      patch,
      existingUser: { _id: "new_user", isAnonymous: true },
      onboardingAttempts: Array.from({ length: 5 }, (_, index) => ({
        _id: `attempt_${index}`,
        userId: "new_user",
        kind: "username_claim",
        attemptedAt: now - 60_000,
      })),
    });

    await expect(
      handlerOf(users.claimUsernameOnly)(ctx, {
        username: "arenaguest",
      }),
    ).rejects.toThrow(/too many username attempts/i);
    expect(ctx.claims).toHaveLength(0);
    expect(patch).not.toHaveBeenCalled();
  });

  it("rate-limits username-only claims per browser nonce across anonymous users", async () => {
    const patch = vi.fn(async () => undefined);
    const now = Date.now();
    const ctx = makeProfileCtx({
      patch,
      existingUser: { _id: "new_user", isAnonymous: true },
      onboardingAttempts: Array.from({ length: 8 }, (_, index) => ({
        _id: `attempt_${index}`,
        userId: `other_user_${index}`,
        deviceNonce: "device-1",
        kind: "username_claim",
        attemptedAt: now - 60_000,
      })),
    });

    await expect(
      handlerOf(users.claimUsernameOnly)(ctx, {
        username: "arenaguest",
        deviceNonce: "device-1",
      }),
    ).rejects.toThrow(/this device/i);
    expect(ctx.claims).toHaveLength(0);
    expect(patch).not.toHaveBeenCalled();
  });

  it("rate-limits username-only claims per invite code after a friend-group burst", async () => {
    const patch = vi.fn(async () => undefined);
    const now = Date.now();
    const ctx = makeProfileCtx({
      patch,
      existingUser: { _id: "new_user", isAnonymous: true },
      onboardingAttempts: Array.from({ length: 25 }, (_, index) => ({
        _id: `attempt_${index}`,
        userId: `other_user_${index}`,
        inviteCode: "ARENA42",
        kind: "username_claim",
        attemptedAt: now - 60_000,
      })),
    });

    await expect(
      handlerOf(users.claimUsernameOnly)(ctx, {
        username: "arenaguest",
        inviteCode: "arena42",
      }),
    ).rejects.toThrow(/this invite/i);
    expect(ctx.claims).toHaveLength(0);
    expect(patch).not.toHaveBeenCalled();
  });

  it("upgrades a username-only anonymous user by linking a password account to the same user id", async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = makeProfileCtx({
      patch,
      existingUser: {
        _id: "new_user",
        username: "arenaguest",
        displayName: "Arena Guest",
        isGuest: false,
        isAnonymous: true,
        totalGames: 3,
      },
    });

    const result = await handlerOf(users.upgradeUsernameOnly)(ctx, {
      email: " ArenaGuest@Example.COM ",
      password: "Zq7$mnPkL9#r",
      displayName: "Arena Guest Pro",
    });

    expect(result).toMatchObject({
      userId: "new_user",
      email: "arenaguest@example.com",
      username: "arenaguest",
      isAnonymous: false,
      isGuest: false,
    });
    expect(ctx.authAccounts).toHaveLength(1);
    expect(ctx.authAccounts[0]).toMatchObject({
      userId: "new_user",
      provider: "password",
      providerAccountId: "arenaguest@example.com",
    });
    expect(ctx.authAccounts[0].secret).toEqual(expect.any(String));
    expect(ctx.authAccounts[0].secret).not.toBe("Zq7$mnPkL9#r");
    expect(patch).toHaveBeenCalledWith(
      "new_user",
      expect.objectContaining({
        email: "arenaguest@example.com",
        displayName: "Arena Guest Pro",
        isGuest: false,
        isAnonymous: false,
        totalGames: 3,
      }),
    );
  });

  it("rejects username-only upgrade when the email is already linked", async () => {
    const patch = vi.fn(async () => undefined);
    const insert = vi.fn();
    const ctx = makeProfileCtx({
      patch,
      insert,
      existingUser: {
        _id: "new_user",
        username: "arenaguest",
        isGuest: false,
        isAnonymous: true,
      },
      authAccounts: [
        {
          _id: "account_existing",
          userId: "other_user",
          provider: "password",
          providerAccountId: "taken@example.com",
        },
      ],
    });

    await expect(
      handlerOf(users.upgradeUsernameOnly)(ctx, {
        email: "taken@example.com",
        password: "Zq7$mnPkL9#r",
      }),
    ).rejects.toThrow(/already linked/i);
    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("rejects username-only upgrade for non-anonymous accounts", async () => {
    const ctx = makeProfileCtx({
      existingUser: {
        _id: "new_user",
        username: "fulluser",
        isGuest: false,
        isAnonymous: false,
      },
    });

    await expect(
      handlerOf(users.upgradeUsernameOnly)(ctx, {
        email: "full@example.com",
        password: "Zq7$mnPkL9#r",
      }),
    ).rejects.toThrow(/anonymous user with a username/i);
  });

});
