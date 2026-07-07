import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

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

import * as duels from "../../convex/duels";
import * as quizSessions from "../../convex/quizSessions";
import * as blitz from "../../convex/blitz";
import * as challengeArenas from "../../convex/challengeArenas";
import {
  ARENA_CIE_SPORT,
  arenaCieSeedPlan,
} from "../../convex/challengeArenaCieContent";

type Args = { [key: string]: unknown };
type Row = Record<string, unknown> & { _id: string };

type RegisteredFunction = {
  exportArgs?: () => string;
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

  gte(field: string, value: string | number) {
    this.predicates.push(
      (row) =>
        (typeof row[field] === "string" || typeof row[field] === "number") &&
        (row[field] as string | number) >= value,
    );
    return this;
  }

  gt(field: string, value: string | number) {
    this.predicates.push(
      (row) =>
        (typeof row[field] === "string" || typeof row[field] === "number") &&
        (row[field] as string | number) > value,
    );
    return this;
  }

  lt(field: string, value: string | number) {
    this.predicates.push(
      (row) =>
        (typeof row[field] === "string" || typeof row[field] === "number") &&
        (row[field] as string | number) < value,
    );
    return this;
  }

  lte(field: string, value: string | number) {
    this.predicates.push(
      (row) =>
        (typeof row[field] === "string" || typeof row[field] === "number") &&
        (row[field] as string | number) <= value,
    );
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
    return new FakeQuery(direction === "desc" ? [...this.rows].reverse() : this.rows);
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
  patchedIds: string[] = [];

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
    this.patchedIds.push(id);
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
    storage: {
      getUrl: async () => null,
    },
    scheduler: {
      runAfter: async () => {},
    },
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

function seedKnowledgeQuestions(
  db: FakeDb,
  {
    count,
    category,
    difficulty,
  }: { count: number; category: string; difficulty: "easy" | "intermediate" },
) {
  for (let i = 0; i < count; i += 1) {
    const suffix = String(i).padStart(2, "0");
    const correctAnswer = `Fixture answer ${suffix}`;
    db.seed("quizQuestions", `fixture_${category}_${suffix}`, {
      sport: "knowledge",
      category,
      question: `Fixture ${category} question ${suffix}?`,
      options: [
        correctAnswer,
        `Fixture wrong A ${suffix}`,
        `Fixture wrong B ${suffix}`,
        `Fixture wrong C ${suffix}`,
      ],
      correctAnswer,
      difficulty,
      bucket: `knowledge_${difficulty}_${category}`,
      checksum: `fixture_${category}_${difficulty}_${suffix}`,
      difficultyVotes: 0,
      difficultyScore: 0,
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    });
  }
}

async function runFullCieSeed(db: FakeDb) {
  const seedHandler = handlerOf(challengeArenas.seedCieContent);
  let cursor: number | null = 0;
  const totals = {
    inserted: 0,
    skippedExisting: 0,
    skippedLiveDuplicates: 0,
  };
  while (cursor !== null) {
    const page = (await seedHandler(makeCtx(db), {
      cursor,
      limit: 500,
    })) as {
      inserted: number;
      skippedExisting: number;
      skippedLiveDuplicates: number;
      nextCursor: number | null;
    };
    totals.inserted += page.inserted;
    totals.skippedExisting += page.skippedExisting;
    totals.skippedLiveDuplicates += page.skippedLiveDuplicates;
    cursor = page.nextCursor;
  }
  return totals;
}

const plan = arenaCieSeedPlan();
const planChecksums = new Set(plan.rows.map((row) => row.seed.checksum));

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Arena CIE sport gate", () => {
  it("uses a sport value no product mode offers", () => {
    expect(["football", "basketball", "tennis", "knowledge"]).not.toContain(
      ARENA_CIE_SPORT,
    );
  });

  it("seeds every planned row under the dedicated sport, additively and idempotently", async () => {
    const db = new FakeDb();
    const first = await runFullCieSeed(db);
    expect(first.inserted).toBe(plan.rows.length);
    expect(first.skippedExisting).toBe(0);
    expect(first.skippedLiveDuplicates).toBe(0);

    const rows = db.all("quizQuestions");
    expect(rows).toHaveLength(plan.rows.length);
    for (const row of rows) {
      expect(row.sport).toBe(ARENA_CIE_SPORT);
      expect(row.provenance).toBeTruthy();
    }

    const before = db.all("quizQuestions");
    db.patchedIds = [];
    const second = await runFullCieSeed(db);
    expect(second.inserted).toBe(0);
    expect(second.skippedExisting).toBe(plan.rows.length);
    expect(db.patchedIds).toEqual([]);
    expect(db.all("quizQuestions")).toEqual(before);
  });

  it("never patches a pre-existing row that already owns a planned checksum", async () => {
    const db = new FakeDb();
    const hijacked = plan.rows[0].seed.checksum;
    db.seed("quizQuestions", "preexisting_row", {
      sport: "knowledge",
      category: "common_knowledge",
      question: "Pre-existing row that must not change?",
      options: ["Yes", "No"],
      correctAnswer: "Yes",
      difficulty: "easy",
      bucket: "knowledge_easy_common_knowledge",
      checksum: hijacked,
      difficultyVotes: 0,
      difficultyScore: 0,
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    });
    const before = await db.get("preexisting_row");

    const totals = await runFullCieSeed(db);
    expect(totals.skippedExisting).toBe(1);
    expect(totals.inserted).toBe(plan.rows.length - 1);
    expect(await db.get("preexisting_row")).toEqual(before);
  });

  it("excludes rows whose normalized prompt+answer already exists live", async () => {
    const db = new FakeDb();
    const target = plan.rows[0].seed;
    db.seed("quizQuestions", "live_duplicate_row", {
      sport: "knowledge",
      category: target.category,
      question: target.question,
      options: [...target.options],
      correctAnswer: target.correctAnswer,
      difficulty: target.difficulty,
      bucket: target.bucket,
      checksum: "live_duplicate_other_checksum",
      difficultyVotes: 0,
      difficultyScore: 0,
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    });

    const totals = await runFullCieSeed(db);
    expect(totals.skippedLiveDuplicates).toBe(1);
    expect(totals.inserted).toBe(plan.rows.length - 1);
    const seeded = db
      .all("quizQuestions")
      .map((row) => row.checksum as string);
    expect(seeded).not.toContain(target.checksum);
  });
});

describe("Arena-only reachability of seeded CIE rows", () => {
  it("knowledge duels (with and without category) never select CIE checksums", async () => {
    const db = new FakeDb();
    seedAccounts(db);
    seedKnowledgeQuestions(db, {
      count: 12,
      category: "capital_cities",
      difficulty: "easy",
    });
    await runFullCieSeed(db);

    setAuth("user_a");
    const withCategory = (await handlerOf(duels.create)(makeCtx(db), {
      type: "knowledge",
      category: "capital_cities",
      difficulty: "easy",
      mode: "quiz",
      opponentUserId: "user_b",
    })) as { duelId: string };
    const duelA = (await db.get(withCategory.duelId)) as Row & {
      questionChecksums: string[];
    };
    expect(duelA.questionChecksums).toHaveLength(10);
    for (const checksum of duelA.questionChecksums) {
      expect(checksum.startsWith("fixture_")).toBe(true);
      expect(planChecksums.has(checksum)).toBe(false);
    }

    const withoutCategory = (await handlerOf(duels.create)(makeCtx(db), {
      type: "knowledge",
      difficulty: "easy",
      mode: "quiz",
      opponentUserId: "user_b",
    })) as { duelId: string };
    const duelB = (await db.get(withoutCategory.duelId)) as Row & {
      questionChecksums: string[];
    };
    for (const checksum of duelB.questionChecksums) {
      expect(planChecksums.has(checksum)).toBe(false);
    }
  });

  it("knowledge duel creation fails when CIE rows are the only content", async () => {
    const db = new FakeDb();
    seedAccounts(db);
    await runFullCieSeed(db);

    setAuth("user_a");
    await expect(
      handlerOf(duels.create)(makeCtx(db), {
        type: "knowledge",
        difficulty: "easy",
        mode: "quiz",
        opponentUserId: "user_b",
      }),
    ).rejects.toThrow(/Not enough duel questions/);
  });

  it("solo quiz selection cannot see CIE rows even when they are the only content", async () => {
    const db = new FakeDb();
    seedAccounts(db);
    await runFullCieSeed(db);

    setAuth("user_a");
    const session = (await handlerOf(quizSessions.createSession)(makeCtx(db), {
      sport: "knowledge",
      difficulty: "easy",
    })) as { sessionId: string };
    await expect(
      handlerOf(quizSessions.getQuestion)(makeCtx(db), {
        sessionId: session.sessionId,
      }),
    ).rejects.toThrow(/No questions available/);
  });

  it("blitz selection cannot see CIE rows even when they are the only content", async () => {
    const db = new FakeDb();
    seedAccounts(db);
    await runFullCieSeed(db);

    setAuth("user_a");
    const session = (await handlerOf(blitz.start)(makeCtx(db), {
      sport: "knowledge",
    })) as { sessionId: string };
    await expect(
      handlerOf(blitz.getQuestion)(makeCtx(db), {
        sessionId: session.sessionId,
      }),
    ).rejects.toThrow(/No more questions/);
  });

  it("challenge arena content status DOES see the seeded CIE pool", async () => {
    const db = new FakeDb();
    await runFullCieSeed(db);

    const status = (await handlerOf(challengeArenas.contentStatus)(
      makeCtx(db),
      {},
    )) as {
      cieTotal: number;
      cieCapitalCities: number;
      cieGeneralKnowledge: number;
      cieWhichCameFirst: number;
      generalKnowledge: number;
      capitalCities: number;
      plannedCieSeeds: number;
    };
    expect(status.cieTotal).toBe(plan.rows.length);
    expect(status.plannedCieSeeds).toBe(plan.rows.length);
    expect(status.cieCapitalCities).toBeGreaterThan(0);
    expect(status.cieGeneralKnowledge).toBeGreaterThan(0);
    expect(status.cieCapitalCities + status.cieGeneralKnowledge + status.cieWhichCameFirst).toBe(
      plan.rows.length,
    );
    // The knowledge-sport counters stay zero: CIE rows do not inflate them.
    expect(status.generalKnowledge).toBe(0);
    expect(status.capitalCities).toBe(0);
  });
});

describe("Arena-only gating at the source level", () => {
  const convexDir = path.resolve(__dirname, "../../convex");
  // liveMatches.ts left this list 2026-07 when the subsystem was purged.
  const nonArenaModules = [
    "quizSessions.ts",
    "blitz.ts",
    "dailyChallenge.ts",
    "duels.ts",
  ];

  it("no non-arena selection module references the CIE sport or content module", () => {
    for (const module of nonArenaModules) {
      const source = readFileSync(path.join(convexDir, module), "utf8");
      expect(source).not.toMatch(/arena_knowledge/);
      expect(source).not.toMatch(/ARENA_CIE_SPORT/);
      expect(source).not.toMatch(/challengeArenaCieContent/);
    }
  });

  it("challenge arena round selection includes the CIE sport scopes", () => {
    const source = readFileSync(
      path.join(convexDir, "challengeArenas.ts"),
      "utf8",
    );
    const scopeUses = source.match(/sport: ARENA_CIE_SPORT/g) ?? [];
    expect(scopeUses.length).toBeGreaterThanOrEqual(3);
  });
});
