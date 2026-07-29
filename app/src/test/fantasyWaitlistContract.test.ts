/**
 * THE WEEKEND waitlist backend contract (Ticket FW-P1).
 *
 * Locks the fantasyWaitlist.ts invariants:
 *  - exactly one identity per row (userId XOR email, each mutation writes
 *    only its own field);
 *  - idempotent joins (same identity twice = one row, reported as success);
 *  - server-side email normalization (trim + lowercase) and format rejection;
 *  - the global sliding-window rate limit on anonymous email joins, and that
 *    idempotent re-joins bypass it;
 *  - getTeaserStatus serves a boolean and a count and NOTHING else (the
 *    emails-never-leave-the-server rule).
 *
 * Handler-level tests over a fake ctx, per the dropLoopFunnelContract /
 * anonymousOnboardingIpContract pattern.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

// fantasyWaitlist.ts imports getAuthUserId at module load; drive it per test.
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

import {
  FANTASY_WAITLIST_RATE_LIMITS,
  getTeaserStatus,
  joinWaitlistAsUser,
  joinWaitlistWithEmail,
} from "../../convex/fantasyWaitlist";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

type Row = Record<string, unknown>;

/**
 * In-memory fantasyWaitlist with just enough index emulation for the module:
 * by_userId / by_email (eq) and the built-in by_creation_time (gte).
 */
function makeWaitlistCtx(seed: Row[] = []) {
  let nextId = 0;
  const rows: Row[] = seed.map((r) => ({
    _id: `row_${nextId++}`,
    _creationTime: r._creationTime ?? Date.now(),
    ...r,
  }));
  const db = {
    query: (table: string) => {
      if (table !== "fantasyWaitlist") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        withIndex: (_index: string, range: (q: unknown) => unknown) => {
          let matched = [...rows];
          const q = {
            eq(field: string, value: unknown) {
              matched = matched.filter((r) => r[field] === value);
              return q;
            },
            gte(field: string, value: number) {
              matched = matched.filter((r) => (r[field] as number) >= value);
              return q;
            },
          };
          range(q);
          return {
            first: async () => matched[0] ?? null,
            collect: async () => matched,
          };
        },
        collect: async () => [...rows],
      };
    },
    insert: async (_table: string, doc: Row) => {
      const row = { _id: `row_${nextId++}`, _creationTime: Date.now(), ...doc };
      rows.push(row);
      return row._id;
    },
  };
  return { ctx: { db }, rows };
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("joinWaitlistAsUser", () => {
  it("rejects unauthenticated callers without writing", async () => {
    const { ctx, rows } = makeWaitlistCtx();
    const result = await handlerOf(joinWaitlistAsUser)(ctx as never, {});
    expect(result).toEqual({ ok: false, code: "not_authenticated" });
    expect(rows).toHaveLength(0);
  });

  it("writes exactly one identity (userId, never email) and is idempotent", async () => {
    authMock.getAuthUserId.mockResolvedValue("user_1");
    const { ctx, rows } = makeWaitlistCtx();

    const first = await handlerOf(joinWaitlistAsUser)(ctx as never, {
      source: "home_teaser",
    });
    expect(first).toEqual({ ok: true, joined: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user_1");
    expect(rows[0].email).toBeUndefined();
    expect(rows[0].source).toBe("home_teaser");
    expect(typeof rows[0].createdAt).toBe("number");

    // Same identity again: success, no visible error, still one row.
    const second = await handlerOf(joinWaitlistAsUser)(ctx as never, {});
    expect(second).toEqual({ ok: true, joined: false });
    expect(rows).toHaveLength(1);
  });
});

describe("joinWaitlistWithEmail", () => {
  it("normalizes (trim + lowercase) and writes exactly one identity (email, never userId)", async () => {
    const { ctx, rows } = makeWaitlistCtx();
    const result = await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: "  Drafter@Example.COM ",
      source: "x_promo",
    });
    expect(result).toEqual({ ok: true, joined: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("drafter@example.com");
    expect(rows[0].userId).toBeUndefined();
    expect(rows[0].source).toBe("x_promo");
  });

  it("is idempotent on the NORMALIZED email", async () => {
    const { ctx, rows } = makeWaitlistCtx();
    await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: "drafter@example.com",
    });
    const again = await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: "  DRAFTER@example.com",
    });
    expect(again).toEqual({ ok: true, joined: false });
    expect(rows).toHaveLength(1);
  });

  it.each([
    "",
    "   ",
    "plainaddress",
    "missing-domain@",
    "@missing-local.com",
    "no-tld@domain",
    "two words@example.com",
    "double@@example.com",
    `${"a".repeat(250)}@example.com`, // over the 254-char ceiling
  ])("rejects %j without writing", async (bad) => {
    const { ctx, rows } = makeWaitlistCtx();
    const result = await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: bad,
    });
    expect(result).toEqual({ ok: false, code: "invalid_email" });
    expect(rows).toHaveLength(0);
  });

  it("rate-limits new joins on the global window but still answers idempotent re-joins", async () => {
    const { max } = FANTASY_WAITLIST_RATE_LIMITS.globalJoinsTenMinutes;
    const now = Date.now();
    const { ctx, rows } = makeWaitlistCtx(
      Array.from({ length: max }, (_, i) => ({
        email: `bulk${i}@example.com`,
        createdAt: now,
        _creationTime: now,
      })),
    );

    const blocked = await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: "fresh@example.com",
    });
    expect(blocked).toEqual({ ok: false, code: "rate_limited" });
    expect(rows).toHaveLength(max);

    // Already-joined identity: success even while the window is saturated.
    const rejoin = await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: "BULK0@example.com ",
    });
    expect(rejoin).toEqual({ ok: true, joined: false });
    expect(rows).toHaveLength(max);
  });

  it("admits new joins again once the window has drained", async () => {
    const { max, windowMs } = FANTASY_WAITLIST_RATE_LIMITS.globalJoinsTenMinutes;
    const stale = Date.now() - windowMs - 1000;
    const { ctx, rows } = makeWaitlistCtx(
      Array.from({ length: max }, (_, i) => ({
        email: `old${i}@example.com`,
        createdAt: stale,
        _creationTime: stale,
      })),
    );
    const result = await handlerOf(joinWaitlistWithEmail)(ctx as never, {
      email: "fresh@example.com",
    });
    expect(result).toEqual({ ok: true, joined: true });
    expect(rows).toHaveLength(max + 1);
  });
});

describe("getTeaserStatus", () => {
  it("serves member + count for a signed-in member — and nothing else", async () => {
    authMock.getAuthUserId.mockResolvedValue("user_1");
    const { ctx } = makeWaitlistCtx([
      { userId: "user_1", createdAt: 1 },
      { email: "drafter@example.com", createdAt: 2 },
    ]);
    const result = (await handlerOf(getTeaserStatus)(ctx as never, {})) as Row;
    expect(result).toEqual({ member: true, count: 2 });
    // The privacy contract: exactly these two keys, no emails, no rows.
    expect(Object.keys(result).sort()).toEqual(["count", "member"]);
  });

  it("reports member: false for anonymous callers and non-members", async () => {
    const { ctx } = makeWaitlistCtx([{ email: "drafter@example.com", createdAt: 1 }]);
    const anon = await handlerOf(getTeaserStatus)(ctx as never, {});
    expect(anon).toEqual({ member: false, count: 1 });

    authMock.getAuthUserId.mockResolvedValue("user_2");
    const nonMember = await handlerOf(getTeaserStatus)(ctx as never, {});
    expect(nonMember).toEqual({ member: false, count: 1 });
  });
});
