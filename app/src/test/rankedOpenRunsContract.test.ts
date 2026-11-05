import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Perf/security loop round 8 (2026-11-05):
// 1. One live ranked run per player — starting a ranked quiz/survival run closes
//    the player's other live ones (settle / park), so parallel runs can't pick
//    a first question or keep only the good run.
// 2. Quiz planning reads a per-slice catalog doc instead of the whole slice.
// 3. A carried-over question tells the client how long it's been on the clock.

const authMock = vi.hoisted(() => ({ getAuthUserId: vi.fn(async () => "user_1") }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({ auth: {}, signIn: () => {}, signOut: () => {}, store: {}, isAuthenticated: () => false }),
}));

import * as quizSessions from "../../convex/quizSessions";
import * as survivalSessions from "../../convex/survivalSessions";
import * as questionCatalog from "../../convex/questionCatalog";
import { parkUnansweredQuestion } from "../../convex/lib/rankedPending";

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


async function start(db: unknown, difficulty = "intermediate") {
  return (await handlerOf(quizSessions.createSession)({ db }, {
    sport: "football",
    mode: "quiz",
    difficulty,
    withFirstQuestion: true,
  })) as { sessionId: string; firstQuestion: { checksum: string; elapsedMs: number } | null };
}

beforeEach(() => {
  authMock.getAuthUserId.mockResolvedValue("user_1");
});
afterEach(() => vi.useRealTimers());

describe("one live ranked quiz run per player", () => {
  it("a second run closes the first: its unanswered question is served again, on its original clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const a = await start(db);
    const servedAt = Date.now();
    vi.setSystemTime(new Date("2026-11-05T12:00:30.000Z"));
    const b = await start(db);
    const rowA = tables.quizSessions.find((r) => r._id === a.sessionId)!;
    expect(rowA.completed).toBe(true);
    expect(b.firstQuestion!.checksum).toBe(a.firstQuestion!.checksum);
    const rowB = tables.quizSessions.find((r) => r._id === b.sessionId)!;
    expect(rowB.questionStartedAt).toBe(servedAt);
    expect(b.firstQuestion!.elapsedMs).toBe(30_000);
  });

  it("a second run settles a first run that already has an answer as a loss", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const a = await start(db);
    await handlerOf(quizSessions.checkAnswer)({ db }, { sessionId: a.sessionId, answer: "A" });
    await start(db);
    const rowA = tables.quizSessions.find((r) => r._id === a.sessionId)!;
    expect(rowA.completed).toBe(true);
    expect((tables.userRatings ?? []).length).toBe(1);
    expect(tables.gameSessions?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("expired runs are left to the cleanup, not settled at the next start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const a = await start(db);
    vi.setSystemTime(new Date("2026-11-05T13:00:00.000Z"));
    await start(db);
    const rowA = tables.quizSessions.find((r) => r._id === a.sessionId)!;
    expect(rowA.completed).toBe(false);
  });

  it("parking keeps the OLDEST served question for a key", async () => {
    const { db, tables } = makeDb({ users: [fullUser], rankedPendingQuestions: [] });
    const ctx = { db } as never;
    const base = { userId: "user_1", sport: "football", mode: "quiz", difficulty: "intermediate", totalAnswers: 0, completed: false };
    await parkUnansweredQuestion(ctx, { ...base, _id: "s1", currentChecksum: "old", questionStartedAt: 1000 } as never);
    await parkUnansweredQuestion(ctx, { ...base, _id: "s2", currentChecksum: "new", questionStartedAt: 2000 } as never);
    expect(tables.rankedPendingQuestions).toHaveLength(1);
    expect(tables.rankedPendingQuestions[0].checksum).toBe("old");
  });
});

describe("one live ranked survival run per player", () => {
  it("starting again closes the previous live run", async () => {
    const { db, tables } = makeDb({ users: [fullUser], survivalSessions: [] });
    const first = (await handlerOf(survivalSessions.startGame)({ db }, { sport: "football" })) as { sessionId: string };
    await handlerOf(survivalSessions.startGame)({ db }, { sport: "football" });
    const row = tables.survivalSessions.find((r) => r._id === first.sessionId)!;
    expect(row.gameOver).toBe(true);
    expect(row.completedAt).toBeUndefined(); // no progress → no rating
  });

  it("a previous run with progress settles on its banked score", async () => {
    const { db, tables } = makeDb({ users: [fullUser], survivalSessions: [] });
    const first = (await handlerOf(survivalSessions.startGame)({ db }, { sport: "football" })) as { sessionId: string };
    await db.patch(first.sessionId, { round: 3, score: 40 });
    await handlerOf(survivalSessions.startGame)({ db }, { sport: "football" });
    const row = tables.survivalSessions.find((r) => r._id === first.sessionId)!;
    expect(row.gameOver).toBe(true);
    expect(typeof row.completedAt).toBe("number");
    expect((tables.userRatings ?? []).length).toBe(1);
  });
});

describe("quiz planning from the slice catalog", () => {
  it("rebuildSlice keeps exactly the mode-playable questions with their image flag", async () => {
    const cf = { ...q(99), checksum: "cf_1", category: "which_came_first" };
    const img = { ...q(98), checksum: "img_1", imageUrl: "https://x/y.png" };
    const { db, tables } = makeDb({ quizQuestions: [...pool, cf, img], quizQuestionCatalogs: [] });
    await handlerOf(questionCatalog.rebuildSlice)({ db }, { sport: "football", mode: "quiz", difficulty: "intermediate" });
    const cat = tables.quizQuestionCatalogs[0];
    const entries = cat.entries as { c: string; i: boolean }[];
    expect(entries.some((e) => e.c === "cf_1")).toBe(false);
    expect(entries.find((e) => e.c === "img_1")).toEqual({ c: "img_1", i: true });
    expect(entries).toHaveLength(pool.length + 1);
  });

  it("createSession plans from the catalog without collecting the slice, obeying the image rules", async () => {
    const images = Array.from({ length: 12 }, (_, i) => ({ ...q(200 + i), checksum: `im_${i}`, imageUrl: "https://x/i.png" }));
    const all = [...pool, ...images];
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: all, quizQuestionCatalogs: [] });
    await handlerOf(questionCatalog.rebuildSlice)({ db }, { sport: "football", mode: "quiz", difficulty: "intermediate" });
    // Prove the slice isn't collected: make collect() on quizQuestions explode.
    const realQuery = db.query;
    db.query = ((table: string) => {
      const chain = realQuery(table);
      if (table === "quizQuestions") chain.collect = async () => { throw new Error("slice collected"); };
      return chain;
    }) as typeof db.query;
    for (let run = 0; run < 20; run++) {
      const s = await start(db);
      const row = tables.quizSessions.find((r) => r._id === s.sessionId)!;
      const plan = row.plannedChecksums as string[];
      expect(plan).toHaveLength(10);
      expect(new Set(plan).size).toBe(10);
      const isImg = plan.map((c) => c.startsWith("im_"));
      expect(isImg.filter(Boolean).length).toBeLessThanOrEqual(2);
      for (let k = 1; k < isImg.length; k++) expect(isImg[k] && isImg[k - 1]).toBe(false);
      await db.patch(s.sessionId, { completed: true });
    }
  });

  it("without a catalog the original full collect still plans the run", async () => {
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const s = await start(db);
    expect(s.firstQuestion).not.toBeNull();
    const row = tables.quizSessions.find((r) => r._id === s.sessionId)!;
    expect((row.plannedChecksums as string[]).length).toBe(10);
  });
});

describe("served questions report their elapsed clock", () => {
  it("a fresh first question reports 0 and a re-serve reports time on the clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
    const { db } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const s = await start(db);
    expect(s.firstQuestion!.elapsedMs).toBe(0);
    vi.setSystemTime(new Date("2026-11-05T12:00:04.000Z"));
    const again = (await handlerOf(quizSessions.getQuestion)({ db }, { sessionId: s.sessionId })) as { checksum: string; elapsedMs: number };
    expect(again.checksum).toBe(s.firstQuestion!.checksum);
    expect(again.elapsedMs).toBe(4000);
  });
});

// Round 10 (2026-11-05): a ranked quiz can't be stretched past its run length,
// and slice catalogs refresh on demand instead of by an hourly all-slice cron.
describe("ranked quiz run length is capped server-side", () => {
  it("getQuestion refuses an 11th question", async () => {
    const { db } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const s = await start(db);
    await handlerOf(quizSessions.checkAnswer)({ db }, { sessionId: s.sessionId, answer: "A" });
    for (let k = 1; k < 10; k++) {
      await handlerOf(quizSessions.getQuestion)({ db }, { sessionId: s.sessionId });
      await handlerOf(quizSessions.checkAnswer)({ db }, { sessionId: s.sessionId, answer: "A" });
    }
    await expect(
      handlerOf(quizSessions.getQuestion)({ db }, { sessionId: s.sessionId }),
    ).rejects.toThrow("Quiz already has all its questions");
  });
});

describe("slice catalog refreshes on demand", () => {
  it("a missing catalog is written from the fallback collect, with no scheduled rebuild", async () => {
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool });
    const runAfter = vi.fn();
    await handlerOf(quizSessions.createSession)({ db, scheduler: { runAfter } }, {
      sport: "football", mode: "quiz", difficulty: "intermediate", withFirstQuestion: true,
    });
    expect(tables.quizQuestionCatalogs).toHaveLength(1);
    expect((tables.quizQuestionCatalogs[0].entries as unknown[]).length).toBe(pool.length);
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("a stale catalog still plans the run and schedules one slice rebuild", async () => {
    const entries = pool.map((r) => ({ c: r.checksum, i: false }));
    const catalogRow = { _id: "cat_1", sport: "football", mode: "quiz", difficulty: "intermediate", entries, builtAt: Date.now() - 2 * 60 * 60 * 1000 };
    const { db } = makeDb({ users: [fullUser], quizSessions: [], quizQuestions: pool, quizQuestionCatalogs: [catalogRow] });
    const runAfter = vi.fn();
    const res = (await handlerOf(quizSessions.createSession)({ db, scheduler: { runAfter } }, {
      sport: "football", mode: "quiz", difficulty: "intermediate", withFirstQuestion: true,
    })) as { firstQuestion: unknown };
    expect(res.firstQuestion).not.toBeNull();
    expect(runAfter).toHaveBeenCalledTimes(1);
    expect(runAfter.mock.calls[0][2]).toEqual({ sport: "football", mode: "quiz", difficulty: "intermediate" });
  });

  it("rebuilding an unchanged slice only moves the freshness stamp", async () => {
    const { db, tables } = makeDb({ quizQuestions: pool, quizQuestionCatalogs: [] });
    await handlerOf(questionCatalog.rebuildSlice)({ db }, { sport: "football", mode: "quiz", difficulty: "intermediate" });
    const before = tables.quizQuestionCatalogs[0].entries;
    const res = (await handlerOf(questionCatalog.rebuildSlice)({ db }, { sport: "football", mode: "quiz", difficulty: "intermediate" })) as { written: boolean };
    expect(res.written).toBe(false);
    expect(tables.quizQuestionCatalogs[0].entries).toBe(before);
  });
});
