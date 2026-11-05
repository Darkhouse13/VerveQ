import { beforeEach, describe, expect, it, vi } from "vitest";

// Perf/security loop round 4 (2026-11-05): ranked ratings settle on the full
// run (unanswered = wrong, quitting after ≥1 answer = loss, expired runs are
// settled by the hourly cleanup), the ranked quiz no longer previews the next
// question's image, a daily attempt that expired after ≥1 answer resumes the
// same day, Quiz Master no longer rescans history every game, and the daily
// twins' standing reads one histogram doc.

const authMock = vi.hoisted(() => ({ getAuthUserId: vi.fn(async () => "user_1") }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({ auth: {}, signIn: () => {}, signOut: () => {}, store: {}, isAuthenticated: () => false }),
}));

import * as games from "../../convex/games";
import * as quizSessions from "../../convex/quizSessions";
import * as maintenance from "../../convex/maintenance";
import { isResumableExpiredAttempt } from "../../convex/dailyChallenge";
import { abandonQuizSession, rankedQuizRunLength } from "../../convex/lib/rankedSettle";
import { unlockAchievements } from "../../convex/lib/achievementUnlock";
import { readDailyStanding, recordDailyFinish } from "../../convex/lib/dailyScoreHistogram";
import { getTodayUTC } from "../../convex/lib/daily";

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

function quizSessions_unfinished(expiresAt: number): Row {
  return quizSession({ _id: "old_open", completed: false, expiresAt });
}

function quizSession(extra: Record<string, unknown> = {}): Row {
  return {
    _id: "qs_1",
    userId: "user_1",
    sport: "football",
    mode: "quiz",
    difficulty: "intermediate",
    plannedChecksums: Array.from({ length: 10 }, (_, i) => `c${i}`),
    usedChecksums: ["c0", "c1", "c2"],
    score: 300,
    correctCount: 3,
    totalAnswers: 3,
    sumAnswerTimeMs: 6000,
    completed: false,
    expiresAt: Date.now() + 60_000,
    ...extra,
  };
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("user_1");
});

describe("ranked quiz settles on the full run", () => {
  it("judges on the planned 10 questions, never fewer than answered", () => {
    expect(rankedQuizRunLength(quizSession() as never)).toBe(10);
    expect(rankedQuizRunLength(quizSession({ plannedChecksums: ["a", "b", "c", "d"], totalAnswers: 3 }) as never)).toBe(4);
    expect(rankedQuizRunLength(quizSession({ plannedChecksums: undefined }) as never)).toBe(10);
  });

  it("completeQuiz after 3/3 answered scores 3/10, not 100%, and is no win", async () => {
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [quizSession()] });
    const res = (await handlerOf(games.completeQuiz)({ db }, { sessionId: "qs_1" })) as {
      accuracy: number;
      eloChange: number;
    };
    expect(res.accuracy).toBeCloseTo(0.3);
    const rating = tables.userRatings[0];
    expect(rating.wins).toBe(0);
    expect(rating.losses).toBe(1);
    expect(tables.gameSessions[0].totalQuestions).toBe(10);
    expect(res.eloChange).toBeLessThan(0);
  });

  it("quitting (endSession) after ≥1 answer settles as a loss", async () => {
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [quizSession({ correctCount: 3 })] });
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: "qs_1" });
    expect(tables.userRatings?.[0]?.losses).toBe(1);
    expect(tables.userRatings?.[0]?.wins).toBe(0);
    expect(tables.quizSessions[0].completed).toBe(true);
    expect(tables.quizSessions[0].abandonedAt).toBeTypeOf("number");
  });

  it("a perfect start abandoned is still a loss", async () => {
    const session = quizSession({ correctCount: 9, totalAnswers: 9, score: 900 });
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [session] });
    await abandonQuizSession({ db } as never, session as never);
    expect(tables.userRatings[0].losses).toBe(1);
  });

  it("tab-switch penalty with ≥1 answer settles as a loss", async () => {
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [quizSession()] });
    const res = (await handlerOf(quizSessions.penalizeTabSwitch)({ db }, { sessionId: "qs_1" })) as { penalized: boolean };
    expect(res.penalized).toBe(true);
    expect(tables.userRatings[0].losses).toBe(1);
  });

  it("quitting before any answer writes no rating", async () => {
    const { db, tables } = makeDb({
      users: [fullUser],
      quizSessions: [quizSession({ totalAnswers: 0, correctCount: 0, currentChecksum: "c0" })],
    });
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: "qs_1" });
    expect(tables.userRatings ?? []).toHaveLength(0);
  });

  it("ending an already completed run is a no-op", async () => {
    const { db, tables } = makeDb({ users: [fullUser], quizSessions: [quizSession({ completed: true })] });
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: "qs_1" });
    expect(tables.userRatings ?? []).toHaveLength(0);
  });

  it("an anonymous session's abandon never touches ratings", async () => {
    const { db, tables } = makeDb({
      users: [{ _id: "user_1", isAnonymous: true }],
      quizSessions: [quizSession()],
    });
    await handlerOf(quizSessions.endSession)({ db }, { sessionId: "qs_1" });
    expect(tables.userRatings ?? []).toHaveLength(0);
    expect(tables.quizSessions[0].completed).toBe(true);
  });
});

describe("hourly cleanup settles expired ranked runs", () => {
  it("settles an expired quiz with answers as a loss, and keeps it until retention", async () => {
    const { db, tables } = makeDb({
      users: [fullUser],
      quizSessions: [quizSession({ expiresAt: Date.now() - 1000 })],
      dailyAttempts: [],
      survivalSessions: [],
      higherLowerSessions: [],
      verveGridSessions: [],
      careerPathSessions: [],
      blitzSessions: [],
    });
    const res = (await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {})) as { settled: number };
    expect(res.settled).toBe(1);
    expect(tables.userRatings[0].losses).toBe(1);
    // Kept (marked completed) until the 7-day retention — and never re-settled.
    expect(tables.quizSessions).toHaveLength(1);
    expect(tables.quizSessions[0].completed).toBe(true);
    const again = (await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {})) as { settled: number };
    expect(again.settled).toBe(0);
    expect(tables.userRatings[0].losses).toBe(1);
  });

  it("deletes quiz sessions 7 days after expiry, keeps younger ones (owner ruling)", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const { db, tables } = makeDb({
      users: [fullUser],
      quizSessions: [
        quizSession({ _id: "old_done", completed: true, expiresAt: Date.now() - 8 * DAY }),
        quizSessions_unfinished(Date.now() - 9 * DAY),
        quizSession({ _id: "young_done", completed: true, expiresAt: Date.now() - 6 * DAY }),
      ],
      dailyAttempts: [],
      survivalSessions: [],
      higherLowerSessions: [],
      verveGridSessions: [],
      careerPathSessions: [],
      blitzSessions: [],
    });
    await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {});
    expect(tables.quizSessions.map((r) => r._id)).toEqual(["young_done"]);
    // Retention never rates anything: past the 48h settle window, no settle.
    expect(tables.userRatings ?? []).toHaveLength(0);
  });

  it("settles an expired ranked survival run on its banked score, never a daily one", async () => {
    const base = {
      userId: "user_1",
      sport: "football",
      round: 4,
      score: 250,
      lives: 1,
      hintUsed: false,
      usedInitials: [],
      gameOver: false,
      expiresAt: Date.now() - 1000,
      startedAt: Date.now() - 40 * 60_000,
    };
    const { db, tables } = makeDb({
      users: [fullUser],
      quizSessions: [],
      dailyAttempts: [],
      survivalSessions: [
        { _id: "sv_1", ...base },
        { _id: "sv_2", ...base, dailyDate: "2026-11-05" },
      ],
      higherLowerSessions: [],
      verveGridSessions: [],
      careerPathSessions: [],
      blitzSessions: [],
    });
    const res = (await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {})) as { settled: number };
    expect(res.settled).toBe(1);
    expect(tables.userRatings).toHaveLength(1);
    expect(tables.userRatings[0].mode).toBe("survival");
    expect(tables.survivalSessions.find((s) => s._id === "sv_1")?.completedAt).toBeTypeOf("number");
    expect(tables.survivalSessions.find((s) => s._id === "sv_2")?.completedAt).toBeUndefined();
  });

  it("never rates runs that expired before the settlement lookback (no retroactive settle)", async () => {
    const stale = {
      userId: "user_1",
      sport: "football",
      round: 4,
      score: 250,
      lives: 1,
      hintUsed: false,
      usedInitials: [],
      gameOver: true,
      expiresAt: Date.now() - 20 * 24 * 60 * 60_000,
      startedAt: Date.now() - 20 * 24 * 60 * 60_000 - 60_000,
    };
    const { db, tables } = makeDb({
      users: [fullUser],
      quizSessions: [],
      dailyAttempts: [],
      survivalSessions: [{ _id: "sv_old", ...stale }],
      higherLowerSessions: [],
      verveGridSessions: [],
      careerPathSessions: [],
      blitzSessions: [],
    });
    const res = (await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {})) as { settled: number };
    expect(res.settled).toBe(0);
    expect(tables.userRatings ?? []).toHaveLength(0);
  });

  it("keeps today's expired daily attempts open, closes past days", async () => {
    const today = getTodayUTC();
    const { db, tables } = makeDb({
      quizSessions: [],
      dailyAttempts: [
        { _id: "da_today", date: today, startedAt: 0, expiresAt: Date.now() - 1000, completed: false, results: [{}] },
        { _id: "da_old", date: "2000-01-01", startedAt: 0, expiresAt: Date.now() - 1000, completed: false, results: [{}] },
      ],
      survivalSessions: [],
      higherLowerSessions: [],
      verveGridSessions: [],
      careerPathSessions: [],
      blitzSessions: [],
    });
    await handlerOf(maintenance.cleanupExpiredSessions)({ db }, {});
    expect(tables.dailyAttempts.find((a) => a._id === "da_today")?.forfeited).toBeUndefined();
    expect(tables.dailyAttempts.find((a) => a._id === "da_old")?.forfeited).toBe(true);
  });
});

describe("daily attempt resume after expiry", () => {
  const today = getTodayUTC();
  it("is resumable only with ≥1 answer, on today's daily, still open", () => {
    expect(isResumableExpiredAttempt({ date: today, results: [{}] }, today)).toBe(true);
    expect(isResumableExpiredAttempt({ date: today, results: [] }, today)).toBe(false);
    expect(isResumableExpiredAttempt({ date: "2000-01-01", results: [{}] }, today)).toBe(false);
    expect(isResumableExpiredAttempt({ date: today, results: [{}], completed: true }, today)).toBe(false);
    expect(isResumableExpiredAttempt({ date: today, results: [{}], forfeited: true }, today)).toBe(false);
  });
});

describe("ranked quiz: no next-question preview", () => {
  it("re-serving the current question carries no nextImageUrl", async () => {
    const session = quizSession({ currentChecksum: "c3" });
    const { db } = makeDb({
      users: [fullUser],
      quizSessions: [session],
      quizQuestions: [
        { _id: "q3", checksum: "c3", question: "Q?", options: ["a", "b", "c", "d"], correctAnswer: "a", category: "x", sport: "football" },
        { _id: "q4", checksum: "c4", question: "Next", options: ["a", "b", "c", "d"], correctAnswer: "a", category: "x", sport: "football", imageUrl: "https://img/next.png" },
      ],
    });
    const payload = (await handlerOf(quizSessions.getQuestion)({ db, storage: { getUrl: async () => null } }, { sessionId: "qs_1" })) as {
      nextImageUrl: unknown;
    };
    expect(payload.nextImageUrl ?? null).toBeNull();
  });
});

describe("achievement and standing reads stay O(1)", () => {
  it("Quiz Master from the just-finished game skips the history scan; later games never rescan", async () => {
    const { db, queried } = makeDb({ users: [{ ...fullUser }], userAchievements: [], userRatings: [], gameSessions: [] });
    const r1 = await unlockAchievements({ db } as never, "user_1" as never, {
      mode: "quiz",
      totalQuestions: 10,
      correctAnswers: 10,
      accuracy: 1,
    });
    expect(r1.newlyUnlocked).toContain("quiz_master");
    expect(queried).not.toContain("gameSessions");

    const { db: db2, queried: q2 } = makeDb({ users: [{ ...fullUser }], userAchievements: [], userRatings: [], gameSessions: [] });
    await unlockAchievements({ db: db2 } as never, "user_1" as never);
    expect(q2.filter((t) => t === "gameSessions")).toHaveLength(1); // one-time backfill
    q2.length = 0;
    await unlockAchievements({ db: db2 } as never, "user_1" as never);
    expect(q2).not.toContain("gameSessions");
  });

  it("standing histogram seeds once from a scan, then increments", async () => {
    const { db, tables } = makeDb({ dailyScoreHistograms: [] });
    const scan = vi.fn(async () => [{ score: 7 }, { score: 4 }]);
    await recordDailyFinish({ db } as never, "older", "2026-11-05", 7, scan);
    expect(scan).toHaveBeenCalledTimes(1);
    await recordDailyFinish({ db } as never, "older", "2026-11-05", 9, scan);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(tables.dailyScoreHistograms).toHaveLength(1);
    const standing = await readDailyStanding({ db } as never, "older", "2026-11-05", 9, scan);
    expect(standing).toEqual({ finishers: 3, below: 2 });
    expect(scan).toHaveBeenCalledTimes(1);
  });
});
