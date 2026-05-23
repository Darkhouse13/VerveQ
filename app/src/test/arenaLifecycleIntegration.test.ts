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
import {
  challengeArenaCapitalCityQuestions,
  challengeArenaEnterpriseLogoQuestions,
} from "../../convex/challengeArenaContent";

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
  imageUrl?: string;
  acceptedAliases?: string[];
  questionKind?: "mcq" | "which_came_first" | "logo_text";
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

type ArenaSummary = {
  arenaId: string;
  mode: ArenaMode;
  totalQuestions: number;
  isTeamMode: boolean;
  players: Array<{
    userId: string;
    nameSnapshot: string;
    team: "A" | "B" | null;
    left: boolean;
    totalScore: number;
    questionsAnswered: number;
    correctAnswers: number;
    accuracy: number;
    avgCorrectMs: number | null;
    longestStreak: number;
  }>;
  rankings: {
    players: Array<{
      rank: number;
      userId: string;
      nameSnapshot: string;
      team: "A" | "B" | null;
      left: boolean;
      totalScore: number;
    }>;
    teams: Array<{
      rank: number;
      id: string;
      label: string;
      totalScore: number;
      playerIds: string[];
    }>;
  };
  superlatives: {
    fastest: Array<{
      userId: string;
      nameSnapshot: string;
      team: "A" | "B" | null;
      avgCorrectMs: number | null;
    }>;
    sharpshooter: Array<{
      userId: string;
      nameSnapshot: string;
      team: "A" | "B" | null;
      accuracy: number;
    }>;
    hotStreak: Array<{
      userId: string;
      nameSnapshot: string;
      team: "A" | "B" | null;
      longestStreak: number;
    }>;
  };
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

function logoQuestionByAnswer(db: FakeDb, answer: string) {
  const question = db
    .all<QuestionRow>("quizQuestions")
    .find(
      (row) =>
        row.category === "enterprise_logos" &&
        row.correctAnswer.toLowerCase() === answer.toLowerCase(),
    );
  if (!question) throw new Error(`Missing logo question ${answer}`);
  return question;
}

function seedActiveArena(
  db: FakeDb,
  arenaId: string,
  checksum: string,
  users: string[] = ["user_a", "user_b"],
) {
  db.seed("arenas", arenaId, {
    code: arenaId.toUpperCase(),
    hostId: users[0],
    mode: "1v1",
    status: "active",
    players: users.map((userId, index) => ({
      userId,
      nameSnapshot: `Player ${index + 1}`,
      ready: true,
      joinedAt: now,
      lastSeenAt: now,
      left: false,
      totalScore: 0,
    })),
    config: {
      rounds: 1,
      perRound: 1,
      categories: ["enterprise_logos"],
    },
    currentRound: 0,
    currentQuestionIndex: 0,
    phase: "question",
    questionStartedAt: now,
    questionWindowMs: 10_000,
    roundChecksums: [[checksum]],
    createdAt: now,
    expiresAt: now + 60_000,
  });
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

function seedSummaryArena(
  db: FakeDb,
  id: string,
  mode: ArenaMode,
  players: Array<{
    userId: string;
    nameSnapshot?: string;
    team?: "A" | "B";
    left?: boolean;
  }>,
  config = { rounds: 2, perRound: 3 },
) {
  db.seed("arenas", id, {
    code: id.toUpperCase(),
    hostId: players[0]?.userId ?? "user_a",
    mode,
    status: "final",
    players: players.map((player, index) => ({
      userId: player.userId,
      nameSnapshot: player.nameSnapshot ?? `Player ${index + 1}`,
      team: player.team,
      ready: true,
      joinedAt: now,
      lastSeenAt: now,
      left: player.left ?? false,
      totalScore: 999_999,
    })),
    config: {
      ...config,
      categories: Array.from({ length: config.rounds }, (_, index) => `round_${index}`),
    },
    currentRound: config.rounds - 1,
    currentQuestionIndex: config.perRound - 1,
    phase: "final",
    questionWindowMs: 10_000,
    roundChecksums: Array.from({ length: config.rounds }, (_, round) =>
      Array.from(
        { length: config.perRound },
        (_, questionIndex) => `summary_${round}_${questionIndex}`,
      ),
    ),
    createdAt: now,
    expiresAt: now + 60_000,
  });
}

function seedSummaryAnswer(
  db: FakeDb,
  id: string,
  answer: {
    arenaId: string;
    userId: string;
    round: number;
    questionIndex: number;
    serverTimeMs: number;
    correct: boolean;
    points: number;
  },
) {
  db.seed("arenaAnswers", id, {
    ...answer,
    answer: answer.correct ? "Correct" : "Wrong",
  });
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
      "enterprise_logos",
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
    expect(activeRoom.currentQuestion).toHaveProperty("kind", "mcq");
    expect(activeRoom.currentQuestion).not.toHaveProperty("correctAnswer");
    expect(activeRoom.currentQuestion).not.toHaveProperty("acceptedAliases");
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

  it("summarizes final solo stats from arena answers only", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const arenaId = "arena_summary_solo";
    seedSummaryArena(db, arenaId, "ffa3", [
      { userId: "user_a", nameSnapshot: "Alice" },
      { userId: "user_b", nameSnapshot: "Blake" },
      { userId: "user_c", nameSnapshot: "Casey" },
    ]);

    for (const [id, userId, round, questionIndex, serverTimeMs, correct, points] of [
      ["a0", "user_a", 0, 0, 1_000, true, 10],
      ["a1", "user_a", 0, 1, 9_000, false, 0],
      ["a2", "user_a", 0, 2, 3_000, true, 20],
      ["a3", "user_a", 1, 0, 2_000, true, 30],
      ["a4", "user_a", 1, 2, 1_000, true, 40],
      ["b0", "user_b", 0, 0, 500, true, 50],
      ["b1", "user_b", 0, 1, 1_500, true, 60],
      ["b2", "user_b", 1, 0, 3_000, false, 0],
      ["b3", "user_b", 1, 1, 2_000, true, 70],
      ["c0", "user_c", 0, 0, 800, false, 0],
    ] as const) {
      seedSummaryAnswer(db, id, {
        arenaId,
        userId,
        round,
        questionIndex,
        serverTimeMs,
        correct,
        points,
      });
    }

    setAuth("user_a");
    const summary = (await handlerOf(challengeArenas.getArenaSummary)(
      makeCtx(db),
      { arenaId },
    )) as ArenaSummary | null;

    expect(summary).not.toBeNull();
    if (!summary) throw new Error("summary should be available");
    expect(summary).toMatchObject({
      arenaId,
      mode: "ffa3",
      totalQuestions: 6,
      isTeamMode: false,
    });
    expect(summary.rankings.teams).toEqual([]);

    const alice = summary.players.find((player) => player.userId === "user_a");
    expect(alice).toMatchObject({
      totalScore: 100,
      questionsAnswered: 5,
      correctAnswers: 4,
      avgCorrectMs: 1_750,
      longestStreak: 2,
    });
    expect(alice?.accuracy).toBeCloseTo(0.8);

    const casey = summary.players.find((player) => player.userId === "user_c");
    expect(casey).toMatchObject({
      totalScore: 0,
      questionsAnswered: 1,
      correctAnswers: 0,
      accuracy: 0,
      avgCorrectMs: null,
      longestStreak: 0,
    });

    expect(
      summary.rankings.players.map((player) => [player.userId, player.totalScore]),
    ).toEqual([
      ["user_b", 180],
      ["user_a", 100],
      ["user_c", 0],
    ]);
    expect(summary.superlatives.fastest).toHaveLength(1);
    expect(summary.superlatives.fastest[0]).toMatchObject({ userId: "user_b" });
    expect(summary.superlatives.fastest[0]?.avgCorrectMs).toBeCloseTo(
      (500 + 1_500 + 2_000) / 3,
    );
    expect(summary.superlatives.sharpshooter).toEqual([
      { userId: "user_a", nameSnapshot: "Alice", team: null, accuracy: 0.8 },
    ]);
    expect(summary.superlatives.hotStreak.map((winner) => winner.userId)).toEqual([
      "user_a",
      "user_b",
    ]);
  });

  it("returns null averages and empty superlatives when no final answers are eligible", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const arenaId = "arena_summary_empty";
    seedSummaryArena(db, arenaId, "1v1", [
      { userId: "user_a", nameSnapshot: "Alice" },
      { userId: "user_b", nameSnapshot: "Blake" },
    ]);

    setAuth("user_a");
    const summary = (await handlerOf(challengeArenas.getArenaSummary)(
      makeCtx(db),
      { arenaId },
    )) as ArenaSummary | null;

    expect(summary).not.toBeNull();
    if (!summary) throw new Error("summary should be available");
    expect(summary.players).toHaveLength(2);
    for (const player of summary.players) {
      expect(player).toMatchObject({
        totalScore: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        accuracy: 0,
        avgCorrectMs: null,
        longestStreak: 0,
      });
    }
    expect(summary.superlatives).toEqual({
      fastest: [],
      sharpshooter: [],
      hotStreak: [],
    });

    const activeArenaId = "arena_summary_active";
    seedSummaryArena(db, activeArenaId, "1v1", [
      { userId: "user_a", nameSnapshot: "Alice" },
      { userId: "user_b", nameSnapshot: "Blake" },
    ]);
    await db.patch(activeArenaId, { status: "active", phase: "question" });
    await expect(
      handlerOf(challengeArenas.getArenaSummary)(makeCtx(db), {
        arenaId: activeArenaId,
      }),
    ).resolves.toBeNull();
  });

  it("summarizes final 2v2 player and team rankings", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const arenaId = "arena_summary_team";
    seedSummaryArena(db, arenaId, "2v2", [
      { userId: "user_a", nameSnapshot: "Alice", team: "A" },
      { userId: "user_b", nameSnapshot: "Blake", team: "B" },
      { userId: "user_c", nameSnapshot: "Casey", team: "A" },
      { userId: "user_d", nameSnapshot: "Devon", team: "B" },
    ]);

    for (const [id, userId, questionIndex, correct, points] of [
      ["ta", "user_a", 0, true, 100],
      ["tb", "user_b", 1, true, 200],
      ["tc", "user_c", 2, true, 50],
      ["td", "user_d", 0, false, 0],
    ] as const) {
      seedSummaryAnswer(db, id, {
        arenaId,
        userId,
        round: 0,
        questionIndex,
        serverTimeMs: 1_000,
        correct,
        points,
      });
    }

    setAuth("user_b");
    const summary = (await handlerOf(challengeArenas.getArenaSummary)(
      makeCtx(db),
      { arenaId },
    )) as ArenaSummary | null;

    expect(summary).not.toBeNull();
    if (!summary) throw new Error("summary should be available");
    expect(summary).toMatchObject({
      mode: "2v2",
      totalQuestions: 6,
      isTeamMode: true,
    });
    expect(
      summary.rankings.players.map((player) => [
        player.rank,
        player.userId,
        player.team,
        player.totalScore,
      ]),
    ).toEqual([
      [1, "user_b", "B", 200],
      [2, "user_a", "A", 100],
      [3, "user_c", "A", 50],
      [4, "user_d", "B", 0],
    ]);
    expect(summary.rankings.teams).toEqual([
      {
        rank: 1,
        id: "B",
        label: "Team B",
        totalScore: 200,
        playerIds: ["user_b", "user_d"],
      },
      {
        rank: 2,
        id: "A",
        label: "Team A",
        totalScore: 150,
        playerIds: ["user_a", "user_c"],
      },
    ]);
  });

  it("runs logo text questions with fuzzy guesses, aliases, close hints, sanitized views, and all-correct close", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const seeded = (await handlerOf(challengeArenas.seedContentGaps)(
      makeCtx(db),
      {},
    )) as {
      insertedEnterpriseLogos: number;
      enterpriseLogos: number;
      bundledEnterpriseLogoSeeds: number;
    };
    expect(seeded.insertedEnterpriseLogos).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );
    expect(seeded.enterpriseLogos).toBe(challengeArenaEnterpriseLogoQuestions.length);
    expect(seeded.bundledEnterpriseLogoSeeds).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );

    const question = logoQuestionByAnswer(db, "Google");
    const arenaId = "arena_logo_text";
    seedActiveArena(db, arenaId, question.checksum);

    setAuth("user_a");
    const activeRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(activeRoom.currentQuestion).toMatchObject({
      kind: "logo_text",
      category: "enterprise_logos",
      imageUrl: "/arena-logos/simple-icons/google.svg",
    });
    expect(activeRoom.currentQuestion).not.toHaveProperty("question");
    expect(activeRoom.currentQuestion).not.toHaveProperty("options");
    expect(activeRoom.currentQuestion).not.toHaveProperty("correctAnswer");
    expect(activeRoom.currentQuestion).not.toHaveProperty("acceptedAliases");

    now += 500;
    const closeWrong = (await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: "Gxoglee",
    })) as Record<string, unknown>;
    expect(closeWrong).toEqual({ result: "wrong", close: true });
    expect(JSON.stringify(closeWrong).toLowerCase()).not.toContain("google");
    expect(db.all<AnswerRow>("arenaAnswers")).toHaveLength(0);

    now += 500;
    const plainWrong = (await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: "Spotify",
    })) as Record<string, unknown>;
    expect(plainWrong).toEqual({ result: "wrong", close: false });
    expect(db.all<AnswerRow>("arenaAnswers")).toHaveLength(0);

    now = db.row<ArenaRow>(arenaId).questionStartedAt! + 2_000;
    const fuzzyCorrect = (await handlerOf(challengeArenas.submitAnswer)(
      makeCtx(db),
      {
        arenaId,
        answer: "Gogle",
      },
    )) as Record<string, unknown>;
    expect(fuzzyCorrect).toMatchObject({
      accepted: true,
      result: "correct",
      serverTimeMs: 2_000,
    });
    expect(db.row<ArenaRow>(arenaId).phase).toBe("question");

    setAuth("user_b");
    now = db.row<ArenaRow>(arenaId).questionStartedAt! + 4_000;
    const aliasCorrect = (await handlerOf(challengeArenas.submitAnswer)(
      makeCtx(db),
      {
        arenaId,
        answer: "Alphabet",
      },
    )) as Record<string, unknown>;
    expect(aliasCorrect).toMatchObject({
      accepted: true,
      result: "correct",
      serverTimeMs: 4_000,
    });
    expect(db.row<ArenaRow>(arenaId).phase).toBe("reveal");

    const answers = db.all<AnswerRow>("arenaAnswers");
    expect(answers).toHaveLength(2);
    expect(answers.find((answer) => answer.userId === "user_a")).toMatchObject({
      answer: "Gogle",
      correct: true,
      points: 230,
      serverTimeMs: 2_000,
    });
    expect(answers.find((answer) => answer.userId === "user_b")).toMatchObject({
      answer: "Alphabet",
      correct: true,
      points: 190,
      serverTimeMs: 4_000,
    });

    setAuth("user_a");
    const revealRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(revealRoom.currentQuestion).toMatchObject({
      kind: "logo_text",
      correctAnswer: "Google",
      imageUrl: "/arena-logos/simple-icons/google.svg",
    });
    expect(revealRoom.currentQuestion).not.toHaveProperty("acceptedAliases");
    expect(revealRoom.revealAnswers).toHaveLength(2);
  });

  it("closes logo text questions on timer with misses scored as zero", async () => {
    const db = new FakeDb();
    seedUsers(db);
    await handlerOf(challengeArenas.seedContentGaps)(makeCtx(db), {});
    const question = logoQuestionByAnswer(db, "Google");
    const arenaId = "arena_logo_timer";
    seedActiveArena(db, arenaId, question.checksum);

    setAuth("user_a");
    now = db.row<ArenaRow>(arenaId).questionStartedAt! + 1_000;
    await handlerOf(challengeArenas.submitAnswer)(makeCtx(db), {
      arenaId,
      answer: "Google",
    });
    expect(db.row<ArenaRow>(arenaId).phase).toBe("question");

    now = db.row<ArenaRow>(arenaId).questionStartedAt! + 10_000;
    await handlerOf(challengeArenas.closeQuestion)(makeCtx(db), {
      arenaId,
      round: 0,
      questionIndex: 0,
    });
    const arena = db.row<ArenaRow>(arenaId);
    expect(arena.phase).toBe("reveal");
    expect(arena.players.find((player) => player.userId === "user_a")?.totalScore).toBe(
      240,
    );
    expect(arena.players.find((player) => player.userId === "user_b")?.totalScore).toBe(
      0,
    );
    expect(db.all<AnswerRow>("arenaAnswers")).toHaveLength(1);
  });

  it("reports seeded logo content counts idempotently", async () => {
    const db = new FakeDb();
    seedUsers(db);

    const first = (await handlerOf(challengeArenas.seedContentGaps)(
      makeCtx(db),
      {},
    )) as {
      insertedEnterpriseLogos: number;
      enterpriseLogos: number;
      bundledEnterpriseLogoSeeds: number;
    };
    const second = (await handlerOf(challengeArenas.seedContentGaps)(
      makeCtx(db),
      {},
    )) as {
      insertedEnterpriseLogos: number;
      enterpriseLogos: number;
      bundledEnterpriseLogoSeeds: number;
    };
    const status = (await handlerOf(challengeArenas.contentStatus)(
      makeCtx(db),
      {},
    )) as {
      enterpriseLogos: number;
      bundledEnterpriseLogoSeeds: number;
    };

    expect(first.insertedEnterpriseLogos).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );
    expect(second.insertedEnterpriseLogos).toBe(0);
    expect(status.enterpriseLogos).toBe(challengeArenaEnterpriseLogoQuestions.length);
    expect(status.bundledEnterpriseLogoSeeds).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );
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
    expect(forced.categories).toContain("enterprise_logos");
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
