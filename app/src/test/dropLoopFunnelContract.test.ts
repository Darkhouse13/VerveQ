import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

// funnel.ts / duels.ts import getAuthUserId at module load; drive it per test.
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

import * as funnel from "../../convex/funnel";
import { recordGuestPlayStarted, recordLinkOpened } from "../../convex/funnel";
import * as duels from "../../convex/duels";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordGuestPlayStarted", () => {
  const DUEL = {
    _id: "duel_1",
    challengerId: "user_challenger",
    linkCode: "DQTESTLINK01",
  };

  it("fires once per actor (a retried first answer does not double-count)", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const makeCtx = (existing: unknown) => ({
      db: {
        query: () => ({ withIndex: () => ({ first: async () => existing }) }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "event_1";
        },
      },
    });

    const first = await recordGuestPlayStarted(makeCtx(null) as never, {
      actor: "guest:deadbeefdeadbeef",
      duel: DUEL as never,
      side: "opponent",
      now: 5000,
    });
    expect(first).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      type: "guest_play_started",
      actor: "guest:deadbeefdeadbeef",
      refLinkCode: "DQTESTLINK01",
      refChallengerId: "user_challenger",
    });

    const second = await recordGuestPlayStarted(makeCtx(inserts[0]) as never, {
      actor: "guest:deadbeefdeadbeef",
      duel: DUEL as never,
      side: "opponent",
      now: 6000,
    });
    expect(second).toBe(false);
    expect(inserts).toHaveLength(1);
  });
});

describe("recordLinkOpened", () => {
  const DUEL = {
    _id: "duel_1",
    challengerId: "user_challenger",
    linkCode: "DQTESTLINK01",
  };

  it("dedupes per (actor, linkCode) so a refresh does not inflate opens", async () => {
    const rows: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ collect: async () => [...rows] }),
        }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          rows.push(doc);
          return "event_1";
        },
      },
    };

    const first = await recordLinkOpened(ctx as never, {
      actor: "guest:deadbeefdeadbeef",
      duel: DUEL as never,
      now: 5000,
    });
    expect(first).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "link_opened",
      actor: "guest:deadbeefdeadbeef",
      refLinkCode: "DQTESTLINK01",
      refChallengerId: "user_challenger",
    });

    // Same opener, same link (a page refresh) — no new row.
    const refresh = await recordLinkOpened(ctx as never, {
      actor: "guest:deadbeefdeadbeef",
      duel: DUEL as never,
      now: 6000,
    });
    expect(refresh).toBe(false);
    expect(rows).toHaveLength(1);

    // Same opener, a DIFFERENT link — counts.
    const otherLink = await recordLinkOpened(ctx as never, {
      actor: "guest:deadbeefdeadbeef",
      duel: { ...DUEL, _id: "duel_2", linkCode: "DQTESTLINK02" } as never,
      now: 7000,
    });
    expect(otherLink).toBe(true);
    expect(rows).toHaveLength(2);
  });
});

describe("duels.getByLinkCode open-stage captain self-exclusion", () => {
  const baseDuel = {
    _id: "duel_open",
    challengerId: "user_captain",
    status: "awaiting_opponent",
    expiresAt: 9_999_999_999_999,
    questionChecksums: ["cs_0", "cs_1"],
    challengerServedAt: [],
    opponentServedAt: [],
    challengerResult: { score: 0, perQuestion: [] },
    opponentResult: { score: 0, perQuestion: [] },
    linkCode: "DQLINKOPEN01",
  };

  it("does NOT log an open when the challenger opens their own link", async () => {
    authMock.getAuthUserId.mockResolvedValue("user_captain");
    const inserts: Array<{ table: string; doc: Record<string, unknown> }> = [];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ first: async () => baseDuel }),
        }),
        insert: async (table: string, doc: Record<string, unknown>) => {
          inserts.push({ table, doc });
          return "row_1";
        },
        patch: async () => {},
        get: async () => null,
      },
    };

    await expect(
      handlerOf(duels.getByLinkCode)(ctx, { linkCode: "DQLINKOPEN01" }),
    ).rejects.toThrow(/Challenger cannot claim their own link/);
    // The self path threw before any logging — nothing recorded.
    expect(inserts).toHaveLength(0);
  });

  it("logs exactly one link_opened for a guest recipient", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    const funnelRows: Array<Record<string, unknown>> = [];
    const inserts: Array<{ table: string; doc: Record<string, unknown> }> = [];
    const question = {
      _id: "q_0",
      checksum: "cs_0",
      question: "Capital of France?",
      options: ["Paris", "London", "Rome", "Berlin"],
      correctAnswer: "Paris",
      category: "geography",
      difficulty: "easy",
    };
    const ctx = {
      db: {
        query: (table: string) => {
          if (table === "duels") {
            return { withIndex: () => ({ first: async () => baseDuel }) };
          }
          if (table === "quizQuestions") {
            return { withIndex: () => ({ first: async () => question }) };
          }
          if (table === "funnelEvents") {
            return { withIndex: () => ({ collect: async () => [...funnelRows] }) };
          }
          return {
            withIndex: () => ({ first: async () => null, collect: async () => [] }),
          };
        },
        get: async (id: string) =>
          id === "user_captain"
            ? { _id: "user_captain", username: "hamza", displayName: "Hamza" }
            : null,
        patch: async () => {},
        insert: async (table: string, doc: Record<string, unknown>) => {
          inserts.push({ table, doc });
          if (table === "funnelEvents") funnelRows.push(doc);
          return "row_1";
        },
      },
      storage: { getUrl: async () => null },
    };

    await handlerOf(duels.getByLinkCode)(ctx, {
      linkCode: "DQLINKOPEN01",
      guestToken: "guesttoken-abcdef-1234567890",
    });

    const openEvents = inserts.filter((i) => i.doc.type === "link_opened");
    expect(openEvents).toHaveLength(1);
    expect(openEvents[0].table).toBe("funnelEvents");
    expect(openEvents[0].doc).toMatchObject({
      type: "link_opened",
      refLinkCode: "DQLINKOPEN01",
      refChallengerId: "user_captain",
    });
    expect(String(openEvents[0].doc.actor)).toMatch(/^guest:/);
  });
});

describe("funnel.dropLoopMetrics", () => {
  // Mirrors the duelShareFunnelContract mock db: take() returns the whole
  // table, withIndex() applies eq/gte/lt constraints in-memory.
  function makeDb(
    users: Array<Record<string, unknown>>,
    events: Array<Record<string, unknown>>,
  ) {
    const tableRows = (table: string) =>
      table === "users" ? users : table === "funnelEvents" ? events : [];
    return {
      query: (table: string) => ({
        take: async () => tableRows(table),
        withIndex: (
          _name: string,
          qb: (q: Record<string, unknown>) => unknown,
        ) => {
          const constraints: Array<{
            op: "eq" | "gte" | "lt";
            field: string;
            value: unknown;
          }> = [];
          const q = {
            eq: (field: string, value: unknown) => {
              constraints.push({ op: "eq", field, value });
              return q;
            },
            gte: (field: string, value: unknown) => {
              constraints.push({ op: "gte", field, value });
              return q;
            },
            lt: (field: string, value: unknown) => {
              constraints.push({ op: "lt", field, value });
              return q;
            },
          };
          qb(q as never);
          const rows = tableRows(table).filter((row) =>
            constraints.every(({ op, field, value }) => {
              const actual = (row as Record<string, unknown>)[field] as never;
              if (op === "eq") return actual === value;
              if (op === "gte") return actual >= (value as never);
              return actual < (value as never);
            }),
          );
          return { take: async () => rows };
        },
      }),
    };
  }

  it("computes M1–M4 = 1.0 for a full single-chain loop", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000_000);
    const users = [
      { _id: "user_captain", username: "hamza", _creationTime: 1000 },
      { _id: "user_recipient", username: "realplayer", _creationTime: 1500 },
      { _id: "user_qa", username: "qa_mobile_2", _creationTime: 1000 },
    ];
    const events = [
      // S0 seed — organic captain link.
      {
        type: "challenge_issued",
        actor: "user:user_captain",
        refLinkCode: "DQSEED000001",
        ts: 2000,
        meta: { viaLink: true },
      },
      // S1 open — auth-aware link_opened, plus a duplicate that must NOT inflate.
      {
        type: "link_opened",
        actor: "guest:deadbeefdeadbeef",
        refLinkCode: "DQSEED000001",
        refChallengerId: "user_captain",
        ts: 2100,
      },
      {
        type: "link_opened",
        actor: "guest:deadbeefdeadbeef",
        refLinkCode: "DQSEED000001",
        refChallengerId: "user_captain",
        ts: 2150,
      },
      // S2 play — recipient submitted Q0.
      {
        type: "guest_play_started",
        actor: "guest:deadbeefdeadbeef",
        refLinkCode: "DQSEED000001",
        refChallengerId: "user_captain",
        ts: 2200,
        meta: { side: "opponent" },
      },
      // S3 complete — recipient finished.
      {
        type: "first_match_complete",
        actor: "guest:deadbeefdeadbeef",
        refLinkCode: "DQSEED000001",
        refChallengerId: "user_captain",
        ts: 2300,
        meta: { side: "opponent" },
      },
      // S5 loop — the recipient created + shared their OWN link, recruited by
      // the captain (refChallengerId set), so it is a gen-2 loop link, never a
      // seed.
      {
        type: "challenge_issued",
        actor: "user:user_recipient",
        refLinkCode: "DQLOOP000001",
        refChallengerId: "user_captain",
        ts: 2400,
        meta: { viaLink: true },
      },
      // Synthetic QA seed — must be excluded from every count.
      {
        type: "challenge_issued",
        actor: "user:user_qa",
        refLinkCode: "DQQA00000001",
        ts: 2000,
        meta: { viaLink: true },
      },
    ];

    const metrics = (await handlerOf(funnel.dropLoopMetrics)(
      { db: makeDb(users, events) },
      {},
    )) as Record<string, number>;

    expect(metrics.excludedSyntheticActors).toBe(1);
    expect(metrics).toMatchObject({
      seeds: 1,
      opens: 1,
      plays: 1,
      completions: 1,
      loopLinks: 1,
      M1_openRate: 1,
      M2_playRate: 1,
      M3_completionRate: 1,
      M4_loopRate: 1,
    });
  });

  it("excludes a captain self-open from M1 (no link_opened logged for them)", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000_000);
    const users = [
      { _id: "user_captain", username: "hamza", _creationTime: 1000 },
    ];
    // A seed link with NO link_opened event — the captain's self-open never
    // produced one upstream, so the link counts as seeded-but-unopened.
    const events = [
      {
        type: "challenge_issued",
        actor: "user:user_captain",
        refLinkCode: "DQSEED000001",
        ts: 2000,
        meta: { viaLink: true },
      },
    ];
    const metrics = (await handlerOf(funnel.dropLoopMetrics)(
      { db: makeDb(users, events) },
      {},
    )) as Record<string, number>;
    expect(metrics.seeds).toBe(1);
    expect(metrics.opens).toBe(0);
    expect(metrics.M1_openRate).toBe(0);
  });

  it("returns guarded null ratios when denominators are zero", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000_000);
    const metrics = (await handlerOf(funnel.dropLoopMetrics)(
      { db: makeDb([], []) },
      {},
    )) as Record<string, number | null>;
    expect(metrics).toMatchObject({
      seeds: 0,
      opens: 0,
      plays: 0,
      completions: 0,
      loopLinks: 0,
      M1_openRate: null,
      M2_playRate: null,
      M3_completionRate: null,
      M4_loopRate: null,
    });
  });
});
