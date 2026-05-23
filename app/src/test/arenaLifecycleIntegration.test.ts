import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import * as challengeArenas from "../../convex/challengeArenas";
import { challengeArenaCapitalCityQuestions } from "../../convex/challengeArenaContent";

type Args = { [key: string]: unknown };
type Row = Record<string, unknown> & { _id: string };
type ArenaMode = "1v1" | "2v2" | "ffa3" | "ffa4" | "ffa5";
type ArenaStatus =
  | "lobby"
  | "countdown"
  | "active"
  | "round_break"
  | "final"
  | "abandoned";
type ArenaPhase =
  | "lobby"
  | "countdown"
  | "question"
  | "reveal"
  | "round_break"
  | "final"
  | "abandoned";

type ArenaPlayer = {
  userId: string;
  nameSnapshot: string;
  team?: "A" | "B";
  ready: boolean;
  joinedAt: number;
  lastSeenAt: number;
  left: boolean;
  totalScore: number;
};

type ArenaRow = Row & {
  code: string;
  hostId: string;
  mode: ArenaMode;
  status: ArenaStatus;
  players: ArenaPlayer[];
  config: {
    rounds: number;
    perRound: number;
    categories: string[];
  };
  currentRound: number;
  currentQuestionIndex: number;
  phase: ArenaPhase;
  questionStartedAt?: number;
  questionWindowMs: number;
  roundChecksums: string[][];
  createdAt: number;
  expiresAt: number;
};

type QuestionRow = Row & {
  sport: string;
  category: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: "easy" | "intermediate" | "hard";
  bucket: string;
  checksum: string;
  imageId?: string;
  difficultyVotes: number;
  difficultyScore: number;
  timesAnswered: number;
  timesCorrect: number;
  usageCount: number;
};

type AnswerRow = Row & {
  arenaId: string;
  round: number;
  questionIndex: number;
  userId: string;
  answer: string;
  serverTimeMs: number;
  correct: boolean;
  points: number;
};

type RoomView = {
  phase: ArenaPhase;
  status: ArenaStatus;
  config: { categories: string[] };
  currentQuestion: Record<string, unknown> | null;
  revealAnswers: Array<{
    userId: string;
    answer: string;
    correct: boolean;
    points: number;
    serverTimeMs: number;
  }>;
  roundLeaderboard: Array<{ id: string; score: number }> | null;
  finalPodium: Array<{ id: string; score: number }> | null;
  players: Array<{
    userId: string;
    team: "A" | "B" | null;
    left: boolean;
    totalScore: number;
  }>;
};

type RegisteredFunction = {
  exportArgs?: () => string;
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
};

function argsOf(fn: unknown): Args {
  const registered = fn as RegisteredFunction;
  if (typeof registered.exportArgs !== "function") {
    throw new Error("not a Convex registered function");
  }
  const raw = JSON.parse(registered.exportArgs());
  return (raw.value ?? raw) as Args;
}

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return async (ctx, args) => {
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      return await registered._handler!(ctx, args);
    } finally {
      dateSpy.mockRestore();
    }
  };
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
    select: (q: IndexPredicateBuilder) => IndexPredicateBuilder,
  ) {
    const builder = new IndexPredicateBuilder();
    select(builder);
    return new FakeQuery(this.rows.filter((row) => builder.matches(row)));
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

  constructor() {
    for (const table of ["users", "arenas", "arenaAnswers", "quizQuestions"]) {
      this.tables.set(table, new Map());
    }
  }

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

  query(table: string) {
    return new FakeQuery([...this.table(table).values()]);
  }

  all<T extends Row>(table: string): T[] {
    return cloneValue([...this.table(table).values()]) as T[];
  }

  row<T extends Row>(id: string): T {
    const row = this.find(id);
    if (!row) throw new Error(`Missing row ${id}`);
    return cloneValue(row) as T;
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

class FakeScheduler {
  jobs: Array<{ delayMs: number; args: Record<string, unknown> }> = [];

  async runAfter(delayMs: number, _fn: unknown, args: Record<string, unknown>) {
    this.jobs.push({ delayMs, args: cloneValue(args) });
  }
}

let now = 1_000_000;

function setAuth(userId: string | null) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

function makeCtx(db: FakeDb, scheduler = new FakeScheduler()) {
  return {
    db,
    scheduler,
    storage: {
      getUrl: async (id: string) => `https://assets.test/${id}.png`,
    },
  };
}

function seedUsers(db: FakeDb, ids = ["user_a", "user_b", "user_c", "user_d"]) {
  ids.forEach((id, index) => {
    db.seed("users", id, {
      username: `user${index + 1}`,
      displayName: `Player ${index + 1}`,
      isGuest: false,
      isAnonymous: false,
    });
  });
}

function seedQuestion(
  db: FakeDb,
  id: string,
  partial: {
    sport: string;
    category: string;
    checksum: string;
    correctAnswer: string;
    difficulty?: "easy" | "intermediate" | "hard";
    imageId?: string;
  },
) {
  db.seed("quizQuestions", id, {
    sport: partial.sport,
    category: partial.category,
    question: `${partial.category} ${partial.checksum}?`,
    options: [
      partial.correctAnswer,
      `${partial.correctAnswer} wrong A`,
      `${partial.correctAnswer} wrong B`,
      `${partial.correctAnswer} wrong C`,
    ],
    correctAnswer: partial.correctAnswer,
    explanation: `Because ${partial.correctAnswer}.`,
    difficulty: partial.difficulty ?? "intermediate",
    bucket: `${partial.sport}_${partial.category}`,
    checksum: partial.checksum,
    imageId: partial.imageId,
    difficultyVotes: 0,
    difficultyScore: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    usageCount: 0,
  });
}

function seedArenaQuestionPool(db: FakeDb, includeLogos = true) {
  for (let i = 0; i < 20; i += 1) {
    const suffix = String(i).padStart(2, "0");
    seedQuestion(db, `football_${suffix}`, {
      sport: "football",
      category: "premier_league",
      checksum: `football_quiz_${suffix}`,
      correctAnswer: `Football Correct ${suffix}`,
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const suffix = String(i).padStart(2, "0");
    seedQuestion(db, `knowledge_${suffix}`, {
      sport: "knowledge",
      category: "common_knowledge",
      checksum: `knowledge_general_${suffix}`,
      correctAnswer: `Knowledge Correct ${suffix}`,
    });
    seedQuestion(db, `geography_${suffix}`, {
      sport: "knowledge",
      category: "geography",
      checksum: `knowledge_geography_${suffix}`,
      correctAnswer: `Geography Correct ${suffix}`,
    });
    seedQuestion(db, `came_first_${suffix}`, {
      sport: "knowledge",
      category: "which_came_first",
      checksum: `knowledge_came_first_${suffix}`,
      correctAnswer: `Earlier Event ${suffix}`,
    });
  }

  if (includeLogos) {
    for (let i = 0; i < 12; i += 1) {
      const suffix = String(i).padStart(2, "0");
      seedQuestion(db, `logo_${suffix}`, {
        sport: "football",
        category: "badge_identification",
        checksum: `logo_badge_${suffix}`,
        correctAnswer: `Club Badge ${suffix}`,
        difficulty: "easy",
        imageId: `logo_${suffix}`,
      });
    }
  }
}

function makeSeededDb(includeLogos = true) {
  const db = new FakeDb();
  seedUsers(db);
  seedArenaQuestionPool(db, includeLogos);
  return db;
}

function questionByChecksum(db: FakeDb, checksum: string) {
  const question = db
    .all<QuestionRow>("quizQuestions")
    .find((row) => row.checksum === checksum);
  if (!question) throw new Error(`Missing question ${checksum}`);
  return question;
}

async function createJoinedArena(db: FakeDb, mode: ArenaMode, users: string[]) {
  setAuth(users[0]);
  const created = (await handlerOf(challengeArenas.create)(makeCtx(db), {
    mode,
  })) as { arenaId: string; code: string };
  for (const userId of users.slice(1)) {
    setAuth(userId);
    await handlerOf(challengeArenas.join)(makeCtx(db), { code: created.code });
  }
  return created;
}

async function readyUsers(db: FakeDb, arenaId: string, users: string[]) {
  for (const userId of users) {
    setAuth(userId);
    await handlerOf(challengeArenas.setReady)(makeCtx(db), { arenaId });
  }
}

async function openFromCountdown(db: FakeDb, arenaId: string) {
  await handlerOf(challengeArenas.advanceRound)(makeCtx(db), {
    arenaId,
    expectedPhase: "countdown",
  });
}

async function scheduledStep(db: FakeDb, arenaId: string) {
  const arena = db.row<ArenaRow>(arenaId);
  if (arena.phase === "question") {
    now = (arena.questionStartedAt ?? now) + arena.questionWindowMs;
    await handlerOf(challengeArenas.closeQuestion)(makeCtx(db), {
      arenaId,
      round: arena.currentRound,
      questionIndex: arena.currentQuestionIndex,
    });
    return;
  }
  if (
    arena.phase === "reveal" ||
    arena.phase === "round_break" ||
    arena.phase === "countdown"
  ) {
    await handlerOf(challengeArenas.advanceRound)(makeCtx(db), { arenaId });
  }
}

async function runToFinal(db: FakeDb, arenaId: string, maxSteps = 160) {
  for (let i = 0; i < maxSteps; i += 1) {
    const arena = db.row<ArenaRow>(arenaId);
    if (arena.phase === "final" || arena.phase === "abandoned") return arena;
    await scheduledStep(db, arenaId);
  }
  throw new Error("Arena did not finish");
}

beforeEach(() => {
  now = 1_000_000;
  authMock.getAuthUserId.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("challenge arena lifecycle integration", () => {
  it("runs a 3-player FFA with locked sets, server scoring, sanitized views, leaving, and scheduler-only completion", async () => {
    const db = makeSeededDb();
    const { arenaId } = await createJoinedArena(db, "ffa3", [
      "user_a",
      "user_b",
      "user_c",
    ]);
    await readyUsers(db, arenaId, ["user_a", "user_b", "user_c"]);

    setAuth("user_a");
    const startResult = (await handlerOf(challengeArenas.start)(makeCtx(db), {
      arenaId,
    })) as { questionSetSizes: number[]; categories: string[] };
    expect(startResult.questionSetSizes).toEqual([10, 10, 10, 10, 10]);
    expect(startResult.categories).toEqual([
      "football_quiz",
      "general_knowledge",
      "which_came_first",
      "name_the_logo",
      "capital_cities",
    ]);

    let arena = db.row<ArenaRow>(arenaId);
    expect(arena.roundChecksums).toHaveLength(5);
    expect(new Set(arena.roundChecksums.flat()).size).toBe(50);
    expect(
      db
        .all<QuestionRow>("quizQuestions")
        .filter((q) => q.category === "capital_cities"),
    ).toHaveLength(challengeArenaCapitalCityQuestions.length);

    await openFromCountdown(db, arenaId);
    arena = db.row<ArenaRow>(arenaId);
    const firstQuestion = questionByChecksum(db, arena.roundChecksums[0][0]);

    setAuth("user_a");
    const activeRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(activeRoom.phase).toBe("question");
    expect(activeRoom.currentQuestion).not.toHaveProperty("correctAnswer");
    expect(activeRoom.currentQuestion).not.toHaveProperty("checksum");
    expect(activeRoom.revealAnswers).toEqual([]);

    now = arena.questionStartedAt! + 1_000;
    await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: firstQuestion.correctAnswer,
    });
    now = arena.questionStartedAt! + 3_000;
    setAuth("user_b");
    await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: firstQuestion.correctAnswer,
    });
    now = arena.questionStartedAt! + 2_000;
    setAuth("user_c");
    await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: "Definitely wrong",
    });

    arena = db.row<ArenaRow>(arenaId);
    expect(arena.phase).toBe("reveal");
    const scored = db.all<AnswerRow>("arenaAnswers");
    expect(scored.find((answer) => answer.userId === "user_a")?.points).toBe(240);
    expect(scored.find((answer) => answer.userId === "user_b")?.points).toBe(200);
    expect(scored.find((answer) => answer.userId === "user_c")?.points).toBe(0);

    setAuth("user_a");
    const revealRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(revealRoom.currentQuestion).toHaveProperty("correctAnswer");
    expect(revealRoom.revealAnswers).toHaveLength(3);

    setAuth("user_c");
    await handlerOf(challengeArenas.leave)(makeCtx(db), { arenaId });
    expect(
      db.row<ArenaRow>(arenaId).players.find((player) => player.userId === "user_c"),
    ).toMatchObject({ left: true, totalScore: 0 });

    const final = await runToFinal(db, arenaId);
    expect(final.phase).toBe("final");
    expect(final.status).toBe("final");
    expect(final.players.find((player) => player.userId === "user_c")?.totalScore).toBe(0);

    setAuth("user_a");
    const finalRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(finalRoom.finalPodium?.[0]).toMatchObject({
      id: "user_a",
      score: 240,
    });
  });

  it("scores 2v2 teams as member sums and treats wrong or missed answers as zero", async () => {
    const db = makeSeededDb();
    const { arenaId } = await createJoinedArena(db, "2v2", [
      "user_a",
      "user_b",
      "user_c",
      "user_d",
    ]);

    for (const [userId, team] of [
      ["user_a", "A"],
      ["user_b", "B"],
      ["user_c", "A"],
      ["user_d", "B"],
    ]) {
      setAuth(userId);
      await handlerOf(challengeArenas.setTeam)(makeCtx(db), { arenaId, team });
    }
    await readyUsers(db, arenaId, ["user_a", "user_b", "user_c", "user_d"]);

    setAuth("user_a");
    await handlerOf(challengeArenas.start)(makeCtx(db), { arenaId });
    await openFromCountdown(db, arenaId);
    const arena = db.row<ArenaRow>(arenaId);
    const firstQuestion = questionByChecksum(db, arena.roundChecksums[0][0]);

    for (const [userId, offsetMs, answer] of [
      ["user_a", 1_000, firstQuestion.correctAnswer],
      ["user_b", 2_000, firstQuestion.correctAnswer],
      ["user_c", 3_000, firstQuestion.correctAnswer],
    ]) {
      setAuth(userId);
      now = arena.questionStartedAt! + Number(offsetMs);
      await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
        arenaId,
        answer,
      });
    }

    await handlerOf(challengeArenas.closeQuestion)(makeCtx(db), {
      arenaId,
      round: 0,
      questionIndex: 0,
    });
    await runToFinal(db, arenaId);

    setAuth("user_a");
    const room = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    const teamA = room.finalPodium?.find((row) => row.id === "A");
    const teamB = room.finalPodium?.find((row) => row.id === "B");
    expect(teamA?.score).toBe(430);
    expect(teamB?.score).toBe(210);
    expect(
      db
        .all<AnswerRow>("arenaAnswers")
        .filter((answer) => answer.userId === "user_d"),
    ).toHaveLength(0);
  });

  it("enforces force-start grace and the abuse contract", async () => {
    const submitArgs = argsOf(challengeArenas.submitAnswer);
    expect(JSON.stringify(submitArgs)).not.toContain("correctAnswer");
    expect(JSON.stringify(submitArgs)).not.toContain("checksum");
    expect(JSON.stringify(submitArgs)).not.toContain("score");
    expect(JSON.stringify(submitArgs)).not.toContain("time");

    const db = makeSeededDb(false);
    const { arenaId } = await createJoinedArena(db, "ffa3", [
      "user_a",
      "user_b",
      "user_c",
    ]);
    await readyUsers(db, arenaId, ["user_a", "user_b"]);

    setAuth("user_a");
    await expect(
      handlerOf(challengeArenas.start)(makeCtx(db), { arenaId, force: true }),
    ).rejects.toThrow(/ready/);

    now = db.row<ArenaRow>(arenaId).createdAt + 15_001;
    const forced = (await handlerOf(challengeArenas.start)(makeCtx(db), {
      arenaId,
      force: true,
    })) as { categories: string[] };
    expect(forced.categories).toContain("geography_fallback_for_logo");
    expect(
      db.row<ArenaRow>(arenaId).players.find((player) => player.userId === "user_c"),
    ).toMatchObject({ left: true });

    await openFromCountdown(db, arenaId);
    const arena = db.row<ArenaRow>(arenaId);
    const firstQuestion = questionByChecksum(db, arena.roundChecksums[0][0]);

    setAuth("user_a");
    now = arena.questionStartedAt! + 1_000;
    await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: firstQuestion.correctAnswer,
    });
    await expect(
      handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
        arenaId,
        answer: firstQuestion.correctAnswer,
      }),
    ).rejects.toThrow(/Already answered/);

    setAuth("user_b");
    now = arena.questionStartedAt! + 2_000;
    await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: firstQuestion.correctAnswer,
    });
    expect(db.row<ArenaRow>(arenaId).phase).toBe("reveal");

    await expect(
      handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
        arenaId,
        answer: firstQuestion.correctAnswer,
      }),
    ).rejects.toThrow(/not accepting/);

    const room = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(room.revealAnswers).toHaveLength(2);
  });
});
