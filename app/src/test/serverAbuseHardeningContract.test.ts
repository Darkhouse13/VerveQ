import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server-side abuse hardening contract:
//  1. Every public entry point that takes a client-supplied sport rejects the
//     arena-only CIE sport and any garbage string (fail closed), while the
//     legitimate client-facing subjects keep working.
//  2. quizSessions.submitFeedback counts at most one difficulty vote per user
//     per question (first vote wins).

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

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

import * as quizSessions from "../../convex/quizSessions";
import * as blitz from "../../convex/blitz";
import * as dailyChallenge from "../../convex/dailyChallenge";
import * as duels from "../../convex/duels";
import { CLIENT_SPORTS, isClientSport } from "../../convex/lib/sports";
import { ARENA_CIE_SPORT } from "../../convex/challengeArenaCieContent";

type Row = Record<string, unknown> & { _id: string };

type RegisteredFunction = {
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
};

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return structuredClone(value);
}

class IndexPredicateBuilder {
  private predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] === value);
    return this;
  }

  matches(row: Row) {
    return this.predicates.every((predicate) => predicate(row));
  }
}

class FakeQuery {
  constructor(private rows: Row[]) {}

  withIndex(
    _indexName: string,
    select?: (q: IndexPredicateBuilder) => IndexPredicateBuilder,
  ) {
    if (!select) return new FakeQuery(this.rows);
    const builder = new IndexPredicateBuilder();
    select(builder);
    return new FakeQuery(this.rows.filter((row) => builder.matches(row)));
  }

  order(direction: "asc" | "desc") {
    return new FakeQuery(
      direction === "desc" ? [...this.rows].reverse() : this.rows,
    );
  }

  async collect() {
    return cloneValue(this.rows);
  }

  async first() {
    return cloneValue(this.rows[0] ?? null);
  }

  async take(limit: number) {
    return cloneValue(this.rows.slice(0, limit));
  }
}

class FakeDb {
  private tables = new Map<string, Map<string, Row>>();
  private seq = 0;

  seed(table: string, id: string, doc: Record<string, unknown>) {
    this.table(table).set(id, cloneValue({ _id: id, ...doc }));
  }

  async insert(table: string, doc: Record<string, unknown>) {
    const id = `${table}_${++this.seq}`;
    this.seed(table, id, doc);
    return id;
  }

  async get(id: string) {
    return cloneValue(this.find(id) ?? null);
  }

  async patch(id: string, patch: Record<string, unknown>) {
    const row = this.find(id);
    if (!row) throw new Error(`Missing row ${id}`);
    Object.assign(row, cloneValue(patch));
  }

  async delete(id: string) {
    for (const table of this.tables.values()) {
      if (table.delete(id)) return;
    }
  }

  query(table: string) {
    return new FakeQuery([...this.table(table).values()]);
  }

  all<T extends Row>(table: string): T[] {
    return cloneValue([...this.table(table).values()]) as T[];
  }

  private table(name: string) {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  private find(id: string) {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) return row;
    }
    return null;
  }
}

function setAuth(userId: string | null) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

function makeCtx(db: FakeDb) {
  return {
    db,
    storage: { getUrl: async () => null },
    scheduler: { runAfter: async () => {} },
  };
}

function seedAccounts(db: FakeDb) {
  for (const [id, username, displayName] of [
    ["user_a", "alpha", "Alpha"],
    ["user_b", "bravo", "Bravo"],
  ] as const) {
    db.seed("users", id, {
      username,
      displayName,
      isGuest: false,
      isAnonymous: false,
    });
  }
}

function seedFootballPool(db: FakeDb, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const suffix = String(i).padStart(2, "0");
    const correctAnswer = `Answer ${suffix}`;
    db.seed("quizQuestions", `football_${suffix}`, {
      sport: "football",
      category: "general_knowledge",
      question: `Football question ${suffix}?`,
      options: [correctAnswer, `Wrong A ${suffix}`, `Wrong B ${suffix}`, `Wrong C ${suffix}`],
      correctAnswer,
      difficulty: "intermediate",
      bucket: "football_intermediate_general_knowledge",
      checksum: `football_intermediate_${suffix}`,
      difficultyVotes: 0,
      difficultyScore: 0,
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    });
  }
}

function makeSeededDb() {
  const db = new FakeDb();
  seedAccounts(db);
  return db;
}

// Each entry point, normalized to "give it a sport, get a promise". Pre-checks
// (auth/account) are satisfied by seeded accounts + setAuth("user_a").
const ENTRY_POINTS: Array<{
  name: string;
  call: (db: FakeDb, sport: string) => Promise<unknown>;
}> = [
  {
    name: "quizSessions.createSession",
    call: (db, sport) =>
      handlerOf(quizSessions.createSession)(makeCtx(db), {
        sport,
        difficulty: "intermediate",
      }),
  },
  {
    name: "blitz.start",
    call: (db, sport) => handlerOf(blitz.start)(makeCtx(db), { sport }),
  },
  {
    name: "dailyChallenge.getOrCreateChallenge",
    call: (db, sport) =>
      handlerOf(dailyChallenge.getOrCreateChallenge)(makeCtx(db), {
        sport,
        mode: "quiz",
      }),
  },
  {
    name: "dailyChallenge.startAttempt",
    call: (db, sport) =>
      handlerOf(dailyChallenge.startAttempt)(makeCtx(db), {
        sport,
        mode: "quiz",
      }),
  },
  {
    name: "duels.create",
    call: (db, sport) =>
      handlerOf(duels.create)(makeCtx(db), {
        type: "sports",
        sport,
        difficulty: "intermediate",
        mode: "quiz",
        opponentUserId: "user_b",
      }),
  },
];

const REJECTED_SPORTS = [
  ARENA_CIE_SPORT, // the arena-only CIE sport — must never be client-reachable
  "totally_made_up",
  "FOOTBALL", // allowlist is case-sensitive
  "knowledge ", // trailing whitespace is not the real value
];

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  setAuth("user_a");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("client sport allowlist constant", () => {
  it("lists exactly the client-facing subjects and excludes the arena CIE sport", () => {
    expect([...CLIENT_SPORTS].sort()).toEqual([
      "basketball",
      "football",
      "knowledge",
      "tennis",
    ]);
    expect(isClientSport(ARENA_CIE_SPORT)).toBe(false);
  });
});

describe("sport allowlist — every entry point fails closed", () => {
  for (const entry of ENTRY_POINTS) {
    for (const sport of REJECTED_SPORTS) {
      it(`${entry.name} rejects ${JSON.stringify(sport)}`, async () => {
        const db = makeSeededDb();
        await expect(entry.call(db, sport)).rejects.toThrow(/Unsupported sport/);
      });
    }

    // An empty sport is also rejected everywhere — for duels it trips the
    // pre-existing "Sport is required" guard before the allowlist, which is
    // still fail-closed, so here we only require that it rejects.
    it(`${entry.name} rejects an empty sport`, async () => {
      const db = makeSeededDb();
      await expect(entry.call(db, "")).rejects.toThrow();
    });
  }
});

describe("sport allowlist — legitimate subjects unaffected", () => {
  it("quizSessions.createSession accepts football and knowledge", async () => {
    for (const sport of ["football", "knowledge"]) {
      const db = makeSeededDb();
      const result = (await handlerOf(quizSessions.createSession)(makeCtx(db), {
        sport,
        difficulty: "intermediate",
      })) as { sessionId: string };
      expect(result.sessionId).toBeTruthy();
    }
  });

  it("blitz.start accepts basketball and tennis", async () => {
    for (const sport of ["basketball", "tennis"]) {
      const db = makeSeededDb();
      const result = (await handlerOf(blitz.start)(makeCtx(db), { sport })) as {
        sessionId: string;
      };
      expect(result.sessionId).toBeTruthy();
    }
  });

  it("duels.create builds a real football duel (gate passes through to content)", async () => {
    const db = makeSeededDb();
    seedFootballPool(db);
    const result = (await handlerOf(duels.create)(makeCtx(db), {
      type: "sports",
      sport: "football",
      difficulty: "intermediate",
      mode: "quiz",
      opponentUserId: "user_b",
    })) as { duelId: string };
    const duel = (await db.get(result.duelId)) as Row & {
      questionChecksums: string[];
    };
    expect(duel.questionChecksums).toHaveLength(10);
  });

  it("dailyChallenge.getOrCreateChallenge builds a real football challenge", async () => {
    const db = makeSeededDb();
    seedFootballPool(db);
    const challenge = (await handlerOf(dailyChallenge.getOrCreateChallenge)(
      makeCtx(db),
      { sport: "football", mode: "quiz" },
    )) as { questionChecksums: string[] } | null;
    expect(challenge?.questionChecksums).toHaveLength(10);
  });

});

describe("submitFeedback — one difficulty vote per user per question", () => {
  function seedQuestion(db: FakeDb, checksum: string) {
    db.seed("quizQuestions", `q_${checksum}`, {
      sport: "knowledge",
      category: "general_knowledge",
      question: "How hard is this?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      difficulty: "intermediate",
      bucket: "knowledge_intermediate_general_knowledge",
      checksum,
      difficultyVotes: 0,
      difficultyScore: 0,
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    });
  }

  const submit = (db: FakeDb, checksum: string, votedDifficulty: string) =>
    handlerOf(quizSessions.submitFeedback)(makeCtx(db), {
      checksum,
      votedDifficulty,
    });

  it("requires an authenticated identity", async () => {
    const db = new FakeDb();
    seedQuestion(db, "cs1");
    setAuth(null);
    await expect(submit(db, "cs1", "hard")).rejects.toThrow(/Not authenticated/);
  });

  it("collapses a user's repeat votes to their first vote", async () => {
    const db = new FakeDb();
    seedQuestion(db, "cs1");

    setAuth("user_a");
    await submit(db, "cs1", "hard");
    let question = (await db.get("q_cs1")) as Row & {
      difficultyVotes: number;
      difficultyScore: number;
    };
    expect(question.difficultyVotes).toBe(1);
    expect(question.difficultyScore).toBe(3);

    // Same user votes again with a different difficulty — must be a no-op.
    await submit(db, "cs1", "easy");
    question = (await db.get("q_cs1")) as Row & {
      difficultyVotes: number;
      difficultyScore: number;
    };
    expect(question.difficultyVotes).toBe(1);
    expect(question.difficultyScore).toBe(3);
    expect(db.all("questionFeedbackVotes")).toHaveLength(1);
  });

  it("counts distinct users independently", async () => {
    const db = new FakeDb();
    seedQuestion(db, "cs1");

    setAuth("user_a");
    await submit(db, "cs1", "hard"); // 3
    setAuth("user_b");
    await submit(db, "cs1", "easy"); // 1

    const question = (await db.get("q_cs1")) as Row & {
      difficultyVotes: number;
      difficultyScore: number;
    };
    expect(question.difficultyVotes).toBe(2);
    expect(question.difficultyScore).toBe(2); // (3*1 + 1) / 2
    expect(db.all("questionFeedbackVotes")).toHaveLength(2);
  });
});
