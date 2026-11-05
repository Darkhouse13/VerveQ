import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Perf/security loop round 6 (2026-11-05): quitting a ranked run before its
// first answer can no longer reroll the first question. The served question is
// parked per (user, sport, mode, difficulty) with its ORIGINAL serve time; the
// next ranked run serves it first on that clock, and a carried-over question
// answered after its window counts as a miss. Round 9 (owner ruling): that
// window is the same 15 s ranked limit every question has.

const authMock = vi.hoisted(() => ({ getAuthUserId: vi.fn(async () => "user_1") }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({ auth: {}, signIn: () => {}, signOut: () => {}, store: {}, isAuthenticated: () => false }),
}));

import * as quizSessions from "../../convex/quizSessions";
import * as maintenance from "../../convex/maintenance";
import { CARRIED_QUESTION_WINDOW_SEC, carriedAnswerCounts } from "../../convex/lib/rankedPending";
import {
  QUIZ_SERVE_GRACE_SEC,
  RANKED_ANSWER_LIMIT_SEC,
  calculateTimeScore,
  rankedAnswerInTime,
} from "../../convex/lib/scoring";

type Row = Record<string, unknown> & { _id: string };

/** Minimal in-memory Convex db: eq() and range ops filter on withIndex. */
function makeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {};
  for (const [t, rows] of Object.entries(seed)) tables[t] = rows.map((r) => ({ ...r }));
  let n = 0;
  const all = () => Object.values(tables).flat();
  const queried: string[] = [];
  const db = {
    get: async (id: string) => all().find((r) => r._id === id) ?? null,
    insert: async (table: string, doc: Record<string, unknown>) => {
      const _id = `${table}_${++n}`;
      (tables[table] ??= []).push({ ...doc, _id, _creationTime: Date.now() });
      return _id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const row = all().find((r) => r._id === id);
      if (!row) throw new Error(`no row ${id}`);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete row[k];
        else row[k] = v;
      }
    },
    delete: async (id: string) => {
      for (const t of Object.keys(tables)) tables[t] = tables[t].filter((r) => r._id !== id);
    },
    query: (table: string) => {
      queried.push(table);
      const filters: ((r: Row) => boolean)[] = [];
      const cmp = (op: (a: number, b: number) => boolean) => (f: string, v: unknown) =>
        (filters.push((r) => op(r[f] as number, v as number)), q);
      const q = {
        eq: (f: string, v: unknown) => (filters.push((r) => r[f] === v), q),
        lte: cmp((a, b) => a <= b),
        gte: cmp((a, b) => a >= b),
        lt: cmp((a, b) => a < b),
        gt: cmp((a, b) => a > b),
      };
      const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const chain = {
        withIndex: (_name: string, sel?: (qq: typeof q) => unknown) => (sel?.(q), chain),
        order: () => chain,
        first: async () => rows()[0] ?? null,
        collect: async () => rows(),
        take: async (k: number) => rows().slice(0, k),
      };
      return chain;
    },
  };
  return { db, tables, queried };
}

function handlerOf(fn: unknown): (ctx: unknown, args: unknown) => Promise<unknown> {
  const h = (fn as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
  if (typeof h !== "function") throw new Error("not a registered Convex function");
  return h;
}

const fullUser = { _id: "user_1", isAnonymous: false, username: "hmz", totalGames: 0 };
function q(i: number) {
  return {
    _id: `q_${i}`,
    checksum: `ck_${i}`,
    sport: "football",
    difficulty: "intermediate",
    category: "football_general",
    question: `Question ${i}?`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    usageCount: 0,
    timesAnswered: 0,
    timesCorrect: 0,
  };
}
const pool = Array.from({ length: 30 }, (_, i) => q(i));

async function start(db: unknown) {
  return (await handlerOf(quizSessions.createSession)({ db }, {
    sport: "football",
    mode: "quiz",
    difficulty: "intermediate",
    withFirstQuestion: true,
  })) as { sessionId: string; firstQuestion: { checksum: string } | null };
}

beforeEach(() => {
  authMock.getAuthUserId.mockResolvedValue("user_1");
});
afterEach(() => vi.useRealTimers());

describe("ranked first question cannot be rerolled by quitting", () => {
  it("quitting before the first answer serves the same question next run, on its original clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const first = await start(db);
    const firstChecksum = first.firstQuestion!.checksum;
    const servedAt = Date.now();

    vi.setSystemTime(new Date("2026-11-05T12:00:20.000Z"));
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: first.sessionId });
    expect(tables.rankedPendingQuestions).toHaveLength(1);

    vi.setSystemTime(new Date("2026-11-05T12:05:00.000Z"));
    const second = await start(db);
    expect(second.firstQuestion!.checksum).toBe(firstChecksum);
    const row = tables.quizSessions.find((r) => r._id === second.sessionId)!;
    expect(row.questionStartedAt).toBe(servedAt);
    expect(row.carriedOver).toBe(true);
    // Consumed: a third run would draw normally.
    expect(tables.rankedPendingQuestions ?? []).toHaveLength(0);
  });

  it("a carried question answered after its window is a miss, even when right", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const first = await start(db);
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: first.sessionId });
    vi.setSystemTime(new Date("2026-11-05T12:05:00.000Z"));
    const second = await start(db);
    const res = (await handlerOf(quizSessions.checkAnswer)({ db }, { sessionId: second.sessionId, answer: "A" })) as {
      correct: boolean;
      score: number;
    };
    expect(res).toMatchObject({ correct: false, score: 0 });
    const row = tables.quizSessions.find((r) => r._id === second.sessionId)!;
    expect(row.correctCount).toBe(0);
    expect(row.carriedOver).toBeUndefined();
  });

  it("fresh and carried questions share the one 15 s ranked window", () => {
    expect(CARRIED_QUESTION_WINDOW_SEC).toBe(15);
    for (const carried of [undefined, false, true]) {
      expect(carriedAnswerCounts(CARRIED_QUESTION_WINDOW_SEC, carried)).toBe(true);
      expect(carriedAnswerCounts(CARRIED_QUESTION_WINDOW_SEC + 0.1, carried)).toBe(false);
      expect(carriedAnswerCounts(60, carried)).toBe(false);
    }
  });

  it("a run that expires with its first question unanswered is parked by the cleanup", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const first = await start(db);
    vi.setSystemTime(new Date("2026-11-05T12:40:00.000Z"));
    await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {});
    expect(tables.rankedPendingQuestions).toHaveLength(1);
    expect(tables.rankedPendingQuestions[0].checksum).toBe(first.firstQuestion!.checksum);
  });

  it("a different difficulty is a different queue", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const hardPool = pool.map((p) => ({ ...p, _id: `h${p._id}`, checksum: `h${p.checksum}`, difficulty: "hard" }));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: [...pool, ...hardPool] });
    const first = await start(db);
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: first.sessionId });
    const hard = (await handlerOf(quizSessions.createSession)({ db }, {
      sport: "football",
      mode: "quiz",
      difficulty: "hard",
      withFirstQuestion: true,
    })) as { firstQuestion: { checksum: string } };
    expect(hard.firstQuestion.checksum.startsWith("h")).toBe(true);
    expect(tables.rankedPendingQuestions).toHaveLength(1);
  });
});

// Owner ruling 2026-11-05 (loop round 9): every ranked question has a 15 s
// answer window on the server clock (after the serve grace). Late = wrong,
// 0 points; inside it, points fall linearly from 100 to 0.
describe("ranked 15 s answer window, linear points", () => {
  it("calculateTimeScore is linear from full at 0 s to 0 at 15 s", () => {
    expect(RANKED_ANSWER_LIMIT_SEC).toBe(15);
    expect(calculateTimeScore(100, 0)).toBe(100);
    expect(calculateTimeScore(100, 3)).toBe(80);
    expect(calculateTimeScore(100, 7.5)).toBe(50);
    expect(calculateTimeScore(100, 12)).toBe(20);
    expect(calculateTimeScore(100, 15)).toBe(0);
    expect(calculateTimeScore(100, 30)).toBe(0);
    // Strictly decreasing across the window: every second costs the same.
    const pts = [0, 1, 2, 3, 4, 5].map((s) => calculateTimeScore(100, s * 2));
    for (let i = 1; i < pts.length; i++) expect(pts[i - 1] - pts[i]).toBeGreaterThanOrEqual(13);
  });

  it("rankedAnswerInTime: inside the window counts, past it does not", () => {
    expect(rankedAnswerInTime(0)).toBe(true);
    expect(rankedAnswerInTime(15)).toBe(true);
    expect(rankedAnswerInTime(15.01)).toBe(false);
  });

  async function answerAfter(seconds: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const run = await start(db);
    vi.setSystemTime(new Date(Date.parse("2026-11-05T12:00:00.000Z") + seconds * 1000));
    const res = (await handlerOf(quizSessions.checkAnswer)({ db }, { sessionId: run.sessionId, answer: "A" })) as {
      correct: boolean;
      score: number;
    };
    return { res, row: tables.quizSessions.find((r) => r._id === run.sessionId)! };
  }

  it("a right answer inside the window scores linearly (grace written off first)", async () => {
    const fast = await answerAfter(QUIZ_SERVE_GRACE_SEC + 3);
    expect(fast.res).toMatchObject({ correct: true, score: 80 });
    const slow = await answerAfter(QUIZ_SERVE_GRACE_SEC + 12);
    expect(slow.res).toMatchObject({ correct: true, score: 20 });
  });

  it("a right answer after the window is wrong with 0 points (server-enforced)", async () => {
    const late = await answerAfter(QUIZ_SERVE_GRACE_SEC + 15.5);
    expect(late.res).toMatchObject({ correct: false, score: 0 });
    expect(late.row.correctCount).toBe(0);
  });

  it("a timeout submit (empty answer) is graded wrong in one call", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const run = await start(db);
    vi.setSystemTime(new Date("2026-11-05T12:00:17.000Z"));
    const res = (await handlerOf(quizSessions.checkAnswer)({ db }, { sessionId: run.sessionId, answer: "" })) as {
      correct: boolean;
      score: number;
      correctAnswer: string;
    };
    expect(res).toMatchObject({ correct: false, score: 0, correctAnswer: "A" });
  });

  it("questions carry the window so clients can count down from the server clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const run = (await start(db)) as unknown as { firstQuestion: Record<string, unknown> };
    expect(run.firstQuestion).toMatchObject({
      answerLimitMs: 15_000,
      graceMs: QUIZ_SERVE_GRACE_SEC * 1000,
      elapsedMs: 0,
    });
  });
});
