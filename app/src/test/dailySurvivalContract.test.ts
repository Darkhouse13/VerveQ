import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const authState = vi.hoisted(() => ({ userId: "user_1" }));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => authState.userId),
}));

import * as survivalSessions from "../../convex/survivalSessions";
import * as games from "../../convex/games";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return registered._handler;
}

/**
 * Minimal stateful fake db for the daily-survival flows. Tables are keyed by
 * generated ids; get() returns CLONES so a handler reading a doc after
 * patching it can't be corrupted by shared references (see repo test lore).
 */
function makeFakeDb(seed: Record<string, Record<string, unknown>> = {}) {
  const docs = new Map<string, Record<string, unknown>>();
  const tableOf = new Map<string, string>();
  let counter = 0;
  for (const [id, doc] of Object.entries(seed)) {
    docs.set(id, { ...doc, _id: id });
    tableOf.set(id, String(doc._table));
  }
  const rowsIn = (table: string) =>
    [...docs.entries()]
      .filter(([id]) => tableOf.get(id) === table)
      .map(([, doc]) => ({ ...doc }));
  return {
    docs,
    db: {
      get: async (id: string) => {
        const doc = docs.get(id);
        return doc ? { ...doc } : null;
      },
      insert: async (table: string, doc: Record<string, unknown>) => {
        counter += 1;
        const id = `${table}_${counter}`;
        docs.set(id, { ...doc, _id: id });
        tableOf.set(id, table);
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const doc = docs.get(id);
        if (!doc) throw new Error(`patch: missing ${id}`);
        docs.set(id, { ...doc, ...patch });
      },
      delete: async (id: string) => {
        docs.delete(id);
        tableOf.delete(id);
      },
      query: (table: string) => ({
        withIndex: (
          _index: string,
          select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
        ) => {
          const filters: Record<string, unknown> = {};
          const builder = {
            eq(field: string, value: unknown) {
              filters[field] = value;
              return builder;
            },
          };
          select(builder);
          const matches = () =>
            rowsIn(table).filter((row) =>
              Object.entries(filters).every(([field, value]) => row[field] === value),
            );
          return {
            collect: async () => matches(),
            first: async () => matches()[0] ?? null,
          };
        },
      }),
    },
  };
}

const FULL_USER = {
  _table: "users",
  username: "user_1",
  isAnonymous: true,
  isGuest: false,
};

describe("Daily Survival contract", () => {
  it("is actually rendered on the Compete grid, not just present in tile data", () => {
    // Regression pin: the tile existed in COMPETE_MODE_TILES while the screen
    // rendered from its own key lists, so the mode shipped with no visible
    // entry point. The screen must look the tile up AND print its copy.
    const screen = readFileSync(
      "src/pages/shell/CompeteModeGridScreen.tsx",
      "utf8",
    );
    expect(screen).toContain('key === "dailySurvival"');
    expect(screen).toContain("modes.dailySurvival.name");
  });

  it("rejects identities without a username", async () => {
    authState.userId = "bare_user";
    const fake = makeFakeDb({
      bare_user: { _table: "users", isAnonymous: true },
    });

    await expect(
      handlerOf(survivalSessions.startDailyGame)({ db: fake.db }, {}),
    ).rejects.toThrow(/username required/i);
  });

  it("serves every player the same frozen run and enforces one attempt per day", async () => {
    authState.userId = "user_1";
    const fake = makeFakeDb({
      user_1: FULL_USER,
      user_2: { ...FULL_USER, username: "user_2" },
    });

    const first = (await handlerOf(survivalSessions.startDailyGame)(
      { db: fake.db },
      {},
    )) as { challenge: { initials: string }; resumed: boolean };
    expect(first.resumed).toBe(false);
    expect(first.challenge.initials.length).toBeGreaterThanOrEqual(2);

    // The generated queue is frozen on ONE dailyChallenges row with 10 rounds.
    const rows = [...fake.docs.values()].filter(
      (d) => d.mode === "survival" && Array.isArray(d.survivalChallenges),
    );
    expect(rows).toHaveLength(1);
    const queue = rows[0].survivalChallenges as Array<{ initials: string }>;
    expect(queue).toHaveLength(10);
    expect(first.challenge.initials).toBe(queue[0].initials);

    // A second player faces the exact same round 1.
    authState.userId = "user_2";
    const second = (await handlerOf(survivalSessions.startDailyGame)(
      { db: fake.db },
      {},
    )) as { challenge: { initials: string } };
    expect(second.challenge.initials).toBe(queue[0].initials);

    // user_2 finished their session (simulate gameOver) — replay is refused.
    const session2 = [...fake.docs.entries()].find(
      ([, d]) => d._table === undefined && d.dailyDate && d.userId === "user_2",
    );
    // (sessions were inserted by the handler; find via dailyAttemptId link)
    const attempt2 = [...fake.docs.values()].find(
      (d) => d.userId === "user_2" && d.mode === "survival" && "completed" in d,
    )!;
    await fake.db.patch(String(attempt2._id), { completed: true });
    await expect(
      handlerOf(survivalSessions.startDailyGame)({ db: fake.db }, {}),
    ).rejects.toThrow(/already attempted/i);
    void session2;
  });

  it("a death BANKS the score into the attempt; the run completes, never forfeits", async () => {
    authState.userId = "user_1";
    const fake = makeFakeDb({ user_1: FULL_USER });
    const start = (await handlerOf(survivalSessions.startDailyGame)(
      { db: fake.db },
      {},
    )) as { sessionId: string };

    // Drop to the last life with banked points, then commit a wrong guess.
    await fake.db.patch(start.sessionId, { lives: 1, score: 240 });
    const res = (await handlerOf(survivalSessions.submitGuess)(
      { db: fake.db },
      { sessionId: start.sessionId, guess: "Zzz Qqq Xxx" },
    )) as { correct: boolean; gameOver: boolean };
    expect(res.correct).toBe(false);
    expect(res.gameOver).toBe(true);

    const attempt = [...fake.docs.values()].find(
      (d) => d.mode === "survival" && "completed" in d,
    )!;
    expect(attempt.completed).toBe(true);
    expect(attempt.forfeited).toBe(false);
    expect(attempt.score).toBe(240);
  });

  it("tab-switching forfeits the daily run to zero", async () => {
    authState.userId = "user_1";
    const fake = makeFakeDb({ user_1: FULL_USER });
    const start = (await handlerOf(survivalSessions.startDailyGame)(
      { db: fake.db },
      {},
    )) as { sessionId: string };
    await fake.db.patch(start.sessionId, { score: 180 });

    const res = (await handlerOf(survivalSessions.penalizeTabSwitch)(
      { db: fake.db },
      { sessionId: start.sessionId, currentRound: 1 },
    )) as { dailyForfeit?: boolean; gameOver: boolean };
    expect(res.dailyForfeit).toBe(true);
    expect(res.gameOver).toBe(true);

    const attempt = [...fake.docs.values()].find(
      (d) => d.mode === "survival" && "completed" in d,
    )!;
    expect(attempt.forfeited).toBe(true);
    expect(attempt.score).toBe(0);
  });

  it("completeSurvival refuses daily sessions — no ELO from the daily", async () => {
    authState.userId = "user_1";
    const fake = makeFakeDb({
      user_1: { ...FULL_USER, isAnonymous: false },
      session_daily: {
        _table: "survivalSessions",
        userId: "user_1",
        sport: "football",
        score: 300,
        round: 4,
        gameOver: true,
        expiresAt: Date.now() + 60_000,
        dailyDate: "2026-07-07",
      },
    });

    await expect(
      handlerOf(games.completeSurvival)(
        { db: fake.db },
        { sessionId: "session_daily" },
      ),
    ).rejects.toThrow(/not ranked/i);
  });

  it("cash-out (endRun) completes the daily attempt with the banked score", async () => {
    authState.userId = "user_1";
    const fake = makeFakeDb({ user_1: FULL_USER });
    const start = (await handlerOf(survivalSessions.startDailyGame)(
      { db: fake.db },
      {},
    )) as { sessionId: string };
    await fake.db.patch(start.sessionId, { score: 120 });

    const res = (await handlerOf(survivalSessions.endRun)(
      { db: fake.db },
      { sessionId: start.sessionId },
    )) as { gameOver: boolean; score: number };
    expect(res.gameOver).toBe(true);
    expect(res.score).toBe(120);

    const attempt = [...fake.docs.values()].find(
      (d) => d.mode === "survival" && "completed" in d,
    )!;
    expect(attempt.completed).toBe(true);
    expect(attempt.forfeited).toBe(false);
    expect(attempt.score).toBe(120);
  });
});
