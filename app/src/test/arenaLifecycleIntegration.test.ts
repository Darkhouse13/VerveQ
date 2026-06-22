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
  challengeArenaGeneralKnowledgeQuestions,
  challengeArenaWhichCameFirstQuestions,
  type ChallengeArenaQuestionSeed,
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
  rematchArenaId?: string;
  rematchArenaCode?: string;
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

type RecentlySeenRow = Row & {
  userId: string;
  checksum: string;
  seenAt: number;
};

type RoomView = {
  arenaId: string;
  code: string;
  phase: ArenaPhase;
  status: ArenaStatus;
  rematchArenaId: string | null;
  rematchArenaCode: string | null;
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
    ready: boolean;
    left: boolean;
    totalScore: number;
  }>;
};

type SeedContentGapsResult = {
  insertedCapitalCities: number;
  insertedGeneralKnowledge: number;
  insertedWhichCameFirst: number;
  insertedEnterpriseLogos: number;
  capitalCities: number;
  generalKnowledge: number;
  whichCameFirst: number;
  enterpriseLogos: number;
  bundledCapitalSeeds: number;
  bundledGeneralKnowledgeSeeds: number;
  bundledEnterpriseLogoSeeds: number;
};

type SeedContentGapsBatchResult = SeedContentGapsResult & {
  processed: number;
  batchLimit: number;
  nextCursor: string | null;
  isDone: boolean;
};

type ArenaSummary = {
  arenaId: string;
  mode: ArenaMode;
  totalQuestions: number;
  isTeamMode: boolean;
  rematchArenaId: string | null;
  rematchArenaCode: string | null;
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

  gte(field: string, value: unknown) {
    this.predicates.push((row) => compareIndexValue(row[field], value) >= 0);
    return this;
  }

  gt(field: string, value: unknown) {
    this.predicates.push((row) => compareIndexValue(row[field], value) > 0);
    return this;
  }

  lte(field: string, value: unknown) {
    this.predicates.push((row) => compareIndexValue(row[field], value) <= 0);
    return this;
  }

  lt(field: string, value: unknown) {
    this.predicates.push((row) => compareIndexValue(row[field], value) < 0);
    return this;
  }

  matches(row: Row) {
    return this.predicates.every((predicate) => predicate(row));
  }
}

const INDEX_FIELDS: Record<string, string[]> = {
  by_code: ["code"],
  by_status: ["status"],
  by_arena_round_question: ["arenaId", "round", "questionIndex"],
  by_user_seen_at: ["userId", "seenAt"],
  by_user_checksum: ["userId", "checksum"],
  by_sport_difficulty: ["sport", "difficulty"],
  by_sport_checksum: ["sport", "checksum"],
  by_sport_category_checksum: ["sport", "category", "checksum"],
  by_sport_imageId_imageUrl_checksum: [
    "sport",
    "imageId",
    "imageUrl",
    "checksum",
  ],
  by_checksum: ["checksum"],
};

function compareIndexValue(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function compareRowsByIndex(fields: string[]) {
  return (a: Row, b: Row) => {
    for (const field of fields) {
      const compared = compareIndexValue(a[field], b[field]);
      if (compared !== 0) return compared;
    }
    return String(a._id).localeCompare(String(b._id));
  };
}

class FakeQuery {
  constructor(
    private rows: Row[],
    private recordReads: (count: number) => void,
  ) {}

  withIndex(
    indexName: string,
    select: (q: IndexPredicateBuilder) => IndexPredicateBuilder,
  ) {
    const builder = new IndexPredicateBuilder();
    select(builder);
    const fields = INDEX_FIELDS[indexName] ?? ["_id"];
    return new FakeQuery(
      this.rows.filter((row) => builder.matches(row)).sort(compareRowsByIndex(fields)),
      this.recordReads,
    );
  }

  order(direction: "asc" | "desc") {
    return new FakeQuery(
      direction === "desc" ? [...this.rows].reverse() : [...this.rows],
      this.recordReads,
    );
  }

  async collect() {
    this.recordReads(this.rows.length);
    return cloneValue(this.rows);
  }

  async first() {
    const row = this.rows[0] ?? null;
    this.recordReads(row ? 1 : 0);
    return cloneValue(row);
  }

  async take(limit: number) {
    const rows = this.rows.slice(0, limit);
    this.recordReads(rows.length);
    return cloneValue(rows);
  }
}

class FakeDb {
  private tables = new Map<string, Map<string, Row>>();
  private seq = 0;
  readCount = 0;

  constructor() {
    for (const table of [
      "users",
      "arenas",
      "arenaAnswers",
      "arenaRecentlySeenQuestions",
      "quizQuestions",
    ]) {
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
    const row = this.find(id) ?? null;
    this.readCount += row ? 1 : 0;
    return cloneValue(row);
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
    throw new Error(`Missing row ${id}`);
  }

  query(table: string) {
    return new FakeQuery([...this.table(table).values()], (count) => {
      this.readCount += count;
    });
  }

  resetReadCount() {
    this.readCount = 0;
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
    imageUrl?: string;
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
    imageUrl: partial.imageUrl,
    difficultyVotes: 0,
    difficultyScore: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    usageCount: 0,
  });
}

function seedChallengeArenaQuestion(
  db: FakeDb,
  id: string,
  seed: ChallengeArenaQuestionSeed,
) {
  db.seed("quizQuestions", id, {
    sport: seed.sport,
    category: seed.category,
    question: seed.question,
    options: seed.options,
    correctAnswer: seed.correctAnswer,
    ...(seed.acceptedAliases ? { acceptedAliases: seed.acceptedAliases } : {}),
    ...(seed.explanation ? { explanation: seed.explanation } : {}),
    ...(seed.questionKind ? { questionKind: seed.questionKind } : {}),
    difficulty: seed.difficulty,
    bucket: seed.bucket,
    checksum: seed.checksum,
    ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
    difficultyVotes: 0,
    difficultyScore: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    usageCount: 0,
  });
}

function seedChallengeArenaQuestions(
  db: FakeDb,
  prefix: string,
  seeds: ChallengeArenaQuestionSeed[],
) {
  seeds.forEach((seed, index) => {
    seedChallengeArenaQuestion(db, `${prefix}_${index}`, seed);
  });
}

function questionCountByCategory(db: FakeDb, category: string) {
  return db
    .all<QuestionRow>("quizQuestions")
    .filter((question) => question.category === category).length;
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
  seedChallengeArenaQuestions(
    db,
    "arena_seed_capital",
    challengeArenaCapitalCityQuestions,
  );
  seedChallengeArenaQuestions(
    db,
    "arena_seed_general",
    challengeArenaGeneralKnowledgeQuestions,
  );
  seedChallengeArenaQuestions(
    db,
    "arena_seed_came_first",
    challengeArenaWhichCameFirstQuestions,
  );
  seedChallengeArenaQuestions(
    db,
    "arena_seed_logo",
    challengeArenaEnterpriseLogoQuestions,
  );
  return db;
}

function seedLargeArenaScaleContent(
  db: FakeDb,
  generalCount = 2_200,
  footballTextCount = 900,
  footballImageCount = 0,
) {
  for (let i = 0; i < generalCount; i += 1) {
    const suffix = String(i).padStart(4, "0");
    seedQuestion(db, `scale_general_${suffix}`, {
      sport: "knowledge",
      category: "scale_general",
      checksum: `scale_general_${suffix}`,
      correctAnswer: `Scale General ${suffix}`,
    });
  }

  for (let i = 0; i < footballImageCount; i += 1) {
    const suffix = String(i).padStart(4, "0");
    seedQuestion(db, `scale_football_image_${suffix}`, {
      sport: "football",
      category: "scale_football",
      checksum: `football_image_scale_${suffix}`,
      correctAnswer: `Scale Football Image ${suffix}`,
      imageId: `football_image_scale_${suffix}`,
    });
  }

  for (let i = 0; i < footballTextCount; i += 1) {
    const suffix = String(i).padStart(4, "0");
    seedQuestion(db, `scale_football_${suffix}`, {
      sport: "football",
      category: "scale_football",
      checksum: `football_scale_${suffix}`,
      correctAnswer: `Scale Football ${suffix}`,
    });
  }
}

function seedMajorityImageFootballContent(
  db: FakeDb,
  imageCount = 1_846,
  textCount = 450,
) {
  for (let i = 0; i < imageCount; i += 1) {
    const suffix = String(i).padStart(4, "0");
    seedQuestion(db, `majority_football_image_${suffix}`, {
      sport: "football",
      category: "premier_league",
      checksum: `football_image_majority_${suffix}`,
      correctAnswer: `Majority Football Image ${suffix}`,
      imageId: `majority_football_image_${suffix}`,
    });
  }

  for (let i = 0; i < textCount; i += 1) {
    const suffix = String(i).padStart(4, "0");
    seedQuestion(db, `majority_football_text_${suffix}`, {
      sport: "football",
      category: "premier_league",
      checksum: `football_text_majority_${suffix}`,
      correctAnswer: `Majority Football Text ${suffix}`,
    });
  }
}

async function seedAllContentGaps(db: FakeDb, limit = 250) {
  const totals: SeedContentGapsResult = {
    insertedCapitalCities: 0,
    insertedGeneralKnowledge: 0,
    insertedWhichCameFirst: 0,
    insertedEnterpriseLogos: 0,
    capitalCities: 0,
    generalKnowledge: 0,
    whichCameFirst: 0,
    enterpriseLogos: 0,
    bundledCapitalSeeds: 0,
    bundledGeneralKnowledgeSeeds: 0,
    bundledEnterpriseLogoSeeds: 0,
  };
  let cursor: string | undefined;
  for (let i = 0; i < 20; i += 1) {
    const result = (await handlerOf(challengeArenas.seedContentGaps)(
      makeCtx(db),
      { cursor, limit },
    )) as SeedContentGapsBatchResult;
    totals.insertedCapitalCities += result.insertedCapitalCities;
    totals.insertedGeneralKnowledge += result.insertedGeneralKnowledge;
    totals.insertedWhichCameFirst += result.insertedWhichCameFirst;
    totals.insertedEnterpriseLogos += result.insertedEnterpriseLogos;
    totals.bundledCapitalSeeds = result.bundledCapitalSeeds;
    totals.bundledGeneralKnowledgeSeeds = result.bundledGeneralKnowledgeSeeds;
    totals.bundledEnterpriseLogoSeeds = result.bundledEnterpriseLogoSeeds;
    if (result.isDone) break;
    cursor = result.nextCursor ?? undefined;
  }

  const status = (await handlerOf(challengeArenas.contentStatus)(
    makeCtx(db),
    {},
  )) as SeedContentGapsResult;
  return { ...totals, ...status };
}

function questionByChecksum(db: FakeDb, checksum: string) {
  const question = db
    .all<QuestionRow>("quizQuestions")
    .find((row) => row.checksum === checksum);
  if (!question) throw new Error(`Missing question ${checksum}`);
  return question;
}

function hasQuestionImage(question: QuestionRow) {
  return !!question.imageId || !!question.imageUrl;
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

function seedReadyArena(
  db: FakeDb,
  arenaId: string,
  mode: ArenaMode,
  users: string[],
) {
  db.seed("arenas", arenaId, {
    code: arenaId.toUpperCase(),
    hostId: users[0],
    mode,
    status: "lobby",
    players: users.map((userId, index) => ({
      userId,
      nameSnapshot: `Player ${index + 1}`,
      team:
        mode === "2v2"
          ? index % 2 === 0
            ? "A"
            : "B"
          : undefined,
      ready: true,
      joinedAt: now,
      lastSeenAt: now,
      left: false,
      totalScore: 0,
    })),
    config: {
      rounds: 5,
      perRound: 10,
      categories: [
        "football_quiz",
        "general_knowledge",
        "which_came_first",
        "enterprise_logos",
        "capital_cities",
      ],
    },
    currentRound: 0,
    currentQuestionIndex: 0,
    phase: "lobby",
    questionWindowMs: 10_000,
    roundChecksums: [],
    createdAt: now,
    expiresAt: now + 60_000,
  });
}

function seedRecentlySeen(
  db: FakeDb,
  id: string,
  userId: string,
  checksum: string,
  seenAt: number,
) {
  db.seed("arenaRecentlySeenQuestions", id, {
    userId,
    checksum,
    seenAt,
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

async function startReadyArena(
  db: FakeDb,
  arenaId: string,
  users: string[] = ["user_a", "user_b", "user_c"],
) {
  seedReadyArena(db, arenaId, "ffa3", users);
  setAuth(users[0]);
  return await handlerOf(challengeArenas.start)(makeCtx(db), { arenaId });
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
    ] as Array<[string, number, string]>) {
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

  it("caps football image questions at two per locked football round", async () => {
    const db = makeSeededDb();
    for (let i = 0; i < 14; i += 1) {
      const suffix = String(i).padStart(2, "0");
      seedQuestion(db, `football_image_${suffix}`, {
        sport: "football",
        category: "premier_league",
        checksum: `football_image_quiz_${suffix}`,
        correctAnswer: `Football Image Correct ${suffix}`,
        imageId: `football_image_${suffix}`,
      });
    }

    const { arenaId } = await createJoinedArena(db, "ffa3", [
      "user_a",
      "user_b",
      "user_c",
    ]);
    await readyUsers(db, arenaId, ["user_a", "user_b", "user_c"]);

    setAuth("user_a");
    await handlerOf(challengeArenas.start)(makeCtx(db), { arenaId });

    const footballRound = db.row<ArenaRow>(arenaId).roundChecksums[0];
    const imageQuestions = footballRound
      .map((checksum) => questionByChecksum(db, checksum))
      .filter((question) => !!question.imageId || !!question.imageUrl);
    expect(footballRound).toHaveLength(10);
    expect(imageQuestions.length).toBeLessThanOrEqual(2);
    expect(footballRound.length - imageQuestions.length).toBeGreaterThanOrEqual(8);
  });

  it("excludes recently seen checksums within the arena novelty window", async () => {
    const db = makeSeededDb();
    const recent = Array.from(
      { length: 10 },
      (_, i) => `football_quiz_${String(i).padStart(2, "0")}`,
    );
    recent.forEach((checksum, index) =>
      seedRecentlySeen(db, `recent_a_${index}`, "user_a", checksum, now - 1_000),
    );

    await startReadyArena(db, "arena_recent_window");

    const footballRound = db.row<ArenaRow>("arena_recent_window").roundChecksums[0];
    expect(footballRound).toHaveLength(10);
    expect(footballRound.some((checksum) => recent.includes(checksum))).toBe(false);
    expect(new Set(footballRound).size).toBe(10);
    expect(
      db
        .all<RecentlySeenRow>("arenaRecentlySeenQuestions")
        .filter((row) => row.userId === "user_a").length,
    ).toBeLessThanOrEqual(100);
  });

  it("excludes the crew union of recently seen checksums", async () => {
    const db = makeSeededDb();
    const userARecent = Array.from(
      { length: 5 },
      (_, i) => `football_quiz_${String(i).padStart(2, "0")}`,
    );
    const userBRecent = Array.from(
      { length: 5 },
      (_, i) => `football_quiz_${String(i + 5).padStart(2, "0")}`,
    );
    userARecent.forEach((checksum, index) =>
      seedRecentlySeen(db, `recent_union_a_${index}`, "user_a", checksum, now - 1_000),
    );
    userBRecent.forEach((checksum, index) =>
      seedRecentlySeen(db, `recent_union_b_${index}`, "user_b", checksum, now - 1_000),
    );

    await startReadyArena(db, "arena_recent_union");

    const footballRound = db.row<ArenaRow>("arena_recent_union").roundChecksums[0];
    const crewRecent = new Set([...userARecent, ...userBRecent]);
    expect(footballRound).toHaveLength(10);
    expect(footballRound.some((checksum) => crewRecent.has(checksum))).toBe(false);
  });

  it("fails open on recently seen exhaustion while keeping locked checksums unique", async () => {
    const db = makeSeededDb();
    const recent = Array.from(
      { length: 15 },
      (_, i) => `football_quiz_${String(i).padStart(2, "0")}`,
    );
    recent.forEach((checksum, index) =>
      seedRecentlySeen(
        db,
        `recent_exhaustion_${index}`,
        "user_a",
        checksum,
        now - 10_000 + index,
      ),
    );

    await startReadyArena(db, "arena_recent_exhaustion");

    const arena = db.row<ArenaRow>("arena_recent_exhaustion");
    const footballRound = arena.roundChecksums[0];
    expect(footballRound).toHaveLength(10);
    expect(new Set(footballRound).size).toBe(10);
    expect(new Set(arena.roundChecksums.flat()).size).toBe(50);
    expect(footballRound.filter((checksum) => recent.includes(checksum))).toHaveLength(5);
  });

  it("relaxes recently seen exclusions oldest-seen-first deterministically", async () => {
    const db = makeSeededDb();
    const recentByAge = [
      ["football_quiz_00", now - 100],
      ["football_quiz_01", now - 1_000],
      ["football_quiz_02", now - 200],
      ["football_quiz_03", now - 900],
      ["football_quiz_04", now - 300],
      ["football_quiz_05", now - 800],
      ["football_quiz_06", now - 400],
      ["football_quiz_07", now - 700],
      ["football_quiz_08", now - 500],
      ["football_quiz_09", now - 600],
      ["football_quiz_10", now - 50],
      ["football_quiz_11", now - 60],
      ["football_quiz_12", now - 70],
      ["football_quiz_13", now - 80],
      ["football_quiz_14", now - 90],
    ] as const;
    recentByAge.forEach(([checksum, seenAt], index) =>
      seedRecentlySeen(db, `recent_order_${index}`, "user_a", checksum, seenAt),
    );

    await startReadyArena(db, "arena_recent_order");

    const footballRound = new Set(
      db.row<ArenaRow>("arena_recent_order").roundChecksums[0],
    );
    for (const checksum of [
      "football_quiz_01",
      "football_quiz_03",
      "football_quiz_05",
      "football_quiz_07",
      "football_quiz_09",
    ]) {
      expect(footballRound.has(checksum)).toBe(true);
    }
    for (const checksum of [
      "football_quiz_00",
      "football_quiz_02",
      "football_quiz_04",
      "football_quiz_06",
      "football_quiz_08",
      "football_quiz_10",
      "football_quiz_11",
      "football_quiz_12",
      "football_quiz_13",
      "football_quiz_14",
    ]) {
      expect(footballRound.has(checksum)).toBe(false);
    }
  });

  it("keeps the football image cap after recently seen exclusion and fallback", async () => {
    const db = makeSeededDb();
    for (let i = 0; i < 14; i += 1) {
      const suffix = String(i).padStart(2, "0");
      seedQuestion(db, `football_recent_image_${suffix}`, {
        sport: "football",
        category: "premier_league",
        checksum: `football_recent_image_quiz_${suffix}`,
        correctAnswer: `Football Image Correct ${suffix}`,
        imageId: `football_recent_image_${suffix}`,
      });
    }
    for (let i = 0; i < 14; i += 1) {
      const checksum = `football_quiz_${String(i).padStart(2, "0")}`;
      seedRecentlySeen(db, `recent_image_cap_${i}`, "user_a", checksum, now - 1_000 + i);
    }

    await startReadyArena(db, "arena_recent_image_cap");

    const footballRound = db.row<ArenaRow>("arena_recent_image_cap").roundChecksums[0];
    const imageQuestions = footballRound
      .map((checksum) => questionByChecksum(db, checksum))
      .filter((question) => !!question.imageId || !!question.imageUrl);
    expect(footballRound).toHaveLength(10);
    expect(new Set(footballRound).size).toBe(10);
    expect(imageQuestions.length).toBeLessThanOrEqual(2);
  });

  it("continues sampling across the full eligible football pool after exclusion", async () => {
    const db = makeSeededDb();
    for (let i = 0; i < 20; i += 1) {
      const suffix = String(i).padStart(2, "0");
      seedQuestion(db, `football_alt_${suffix}`, {
        sport: "football",
        category: "champions_league",
        checksum: `football_alt_quiz_${suffix}`,
        correctAnswer: `Alt Football Correct ${suffix}`,
      });
    }
    for (let i = 0; i < 5; i += 1) {
      seedRecentlySeen(
        db,
        `recent_distribution_a_${i}`,
        "user_a",
        `football_quiz_${String(i).padStart(2, "0")}`,
        now - 1_000 + i,
      );
      seedRecentlySeen(
        db,
        `recent_distribution_b_${i}`,
        "user_b",
        `football_alt_quiz_${String(i).padStart(2, "0")}`,
        now - 1_000 + i,
      );
    }

    const selected = new Set<string>();
    for (let i = 0; i < 16; i += 1) {
      now += 1_000;
      const arenaId = `arena_distribution_${i}`;
      await startReadyArena(db, arenaId);
      for (const checksum of db.row<ArenaRow>(arenaId).roundChecksums[0]) {
        selected.add(checksum);
      }
    }

    const baseCount = [...selected].filter((checksum) =>
      checksum.startsWith("football_quiz_"),
    ).length;
    const altCount = [...selected].filter((checksum) =>
      checksum.startsWith("football_alt_quiz_"),
    ).length;
    expect(selected.size).toBeGreaterThan(28);
    expect(baseCount).toBeGreaterThan(10);
    expect(altCount).toBeGreaterThan(10);
  }, 30_000);

  it("samples expanded general-knowledge and capital pools across arena seeds", async () => {
    const db = makeSeededDb();

    const generalSeen = new Set<string>();
    const capitalSeen = new Set<string>();
    for (let i = 0; i < 24; i += 1) {
      const { arenaId } = await createJoinedArena(db, "ffa3", [
        "user_a",
        "user_b",
        "user_c",
      ]);
      await readyUsers(db, arenaId, ["user_a", "user_b", "user_c"]);
      setAuth("user_a");
      await handlerOf(challengeArenas.start)(makeCtx(db), { arenaId });
      const arena = db.row<ArenaRow>(arenaId);
      for (const checksum of arena.roundChecksums[1]) generalSeen.add(checksum);
      for (const checksum of arena.roundChecksums[4]) capitalSeen.add(checksum);
    }

    expect(generalSeen.size).toBeGreaterThan(80);
    expect(capitalSeen.size).toBeGreaterThan(70);
    expect(
      [...capitalSeen].filter((checksum) =>
        checksum.startsWith("challenge_arena_capitals_v2_"),
      ).length,
    ).toBeGreaterThan(40);
  }, 30_000);

  it("starts with bounded reads under large arena content scale", async () => {
    const db = makeSeededDb();
    seedUsers(db, ["user_e"]);
    seedLargeArenaScaleContent(db);
    const users = ["user_a", "user_b", "user_c", "user_d", "user_e"];
    for (const userId of users) {
      for (let i = 0; i < 100; i += 1) {
        seedRecentlySeen(
          db,
          `scale_recent_${userId}_${i}`,
          userId,
          `football_scale_${String(i).padStart(4, "0")}`,
          now - i,
        );
      }
    }

    const { arenaId } = await createJoinedArena(db, "ffa5", users);
    await readyUsers(db, arenaId, users);

    db.resetReadCount();
    setAuth("user_a");
    const result = (await handlerOf(challengeArenas.start)(makeCtx(db), {
      arenaId,
    })) as { questionSetSizes: number[] };
    const arena = db.row<ArenaRow>(arenaId);

    expect(result.questionSetSizes).toEqual([10, 10, 10, 10, 10]);
    expect(arena.roundChecksums).toHaveLength(5);
    expect(new Set(arena.roundChecksums.flat()).size).toBe(50);
    expect(db.readCount).toBeLessThan(1_800);
  }, 30_000);

  it("locks every arena round under budget when football content is majority image", async () => {
    const db = makeSeededDb();
    seedMajorityImageFootballContent(db);
    const users = ["user_a", "user_b", "user_c"];
    const arenaId = "arena_majority_image";

    seedReadyArena(db, arenaId, "ffa3", users);

    db.resetReadCount();
    setAuth("user_a");
    const result = (await handlerOf(challengeArenas.start)(makeCtx(db), {
      arenaId,
    })) as { questionSetSizes: number[] };
    const arena = db.row<ArenaRow>(arenaId);
    const rounds = arena.roundChecksums.map((round) =>
      round.map((checksum) => questionByChecksum(db, checksum)),
    );

    expect(result.questionSetSizes).toEqual([10, 10, 10, 10, 10]);
    expect(arena.roundChecksums).toHaveLength(5);
    for (const round of arena.roundChecksums) {
      expect(round).toHaveLength(10);
    }
    expect(new Set(arena.roundChecksums.flat()).size).toBe(50);

    const footballText = rounds[0].filter((question) => !hasQuestionImage(question));
    const footballImages = rounds[0].filter(hasQuestionImage);
    expect(footballText).toHaveLength(8);
    expect(footballImages).toHaveLength(2);
    expect(
      rounds[0].every(
        (question) =>
          question.sport === "football" &&
          question.category !== "which_came_first" &&
          question.category !== "badge_identification",
      ),
    ).toBe(true);
    expect(
      rounds[1].every(
        (question) =>
          question.sport === "knowledge" &&
          question.category !== "which_came_first" &&
          question.category !== "enterprise_logos" &&
          question.category !== "capital_cities",
      ),
    ).toBe(true);
    expect(rounds[2].every((question) => question.category === "which_came_first")).toBe(
      true,
    );
    expect(rounds[3].every((question) => question.category === "enterprise_logos")).toBe(
      true,
    );
    expect(rounds[4].every((question) => question.category === "capital_cities")).toBe(
      true,
    );
    expect(db.readCount).toBeLessThan(1_800);
  }, 30_000);

  it("paginates seedContentGaps without scanning large existing content", async () => {
    const db = makeSeededDb();
    seedLargeArenaScaleContent(db);

    db.resetReadCount();
    const first = (await handlerOf(challengeArenas.seedContentGaps)(
      makeCtx(db),
      { limit: 75 },
    )) as SeedContentGapsBatchResult;
    expect(first.processed).toBe(75);
    expect(first.isDone).toBe(false);
    expect(first.nextCursor).toBeTruthy();
    expect(db.readCount).toBeLessThanOrEqual(75);

    db.resetReadCount();
    const second = (await handlerOf(challengeArenas.seedContentGaps)(
      makeCtx(db),
      { cursor: first.nextCursor ?? undefined, limit: 75 },
    )) as SeedContentGapsBatchResult;
    expect(second.processed).toBe(75);
    expect(second.isDone).toBe(false);
    expect(db.readCount).toBeLessThanOrEqual(75);
  }, 30_000);

  it("creates one shared rematch lobby per finished arena and propagates ready state there", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const arenaId = "arena_rematch_source";
    seedSummaryArena(db, arenaId, "ffa3", [
      { userId: "user_a", nameSnapshot: "Alice" },
      { userId: "user_b", nameSnapshot: "Blake" },
      { userId: "user_c", nameSnapshot: "Casey" },
    ]);

    setAuth("user_a");
    const first = (await handlerOf(challengeArenas.rematch)(makeCtx(db), {
      arenaId,
    })) as { arenaId: string; code: string };
    setAuth("user_b");
    const second = (await handlerOf(challengeArenas.rematch)(makeCtx(db), {
      arenaId,
    })) as { arenaId: string; code: string };
    setAuth("user_c");
    const third = (await handlerOf(challengeArenas.rematch)(makeCtx(db), {
      arenaId,
    })) as { arenaId: string; code: string };

    expect(new Set([first.arenaId, second.arenaId, third.arenaId]).size).toBe(1);
    expect(new Set([first.code, second.code, third.code]).size).toBe(1);
    expect(
      db.all<ArenaRow>("arenas").filter((arena) => arena._id !== arenaId),
    ).toHaveLength(1);
    expect(db.row<ArenaRow>(arenaId)).toMatchObject({
      rematchArenaId: first.arenaId,
      rematchArenaCode: first.code,
    });

    for (const userId of ["user_a", "user_b", "user_c"]) {
      setAuth(userId);
      const joined = (await handlerOf(challengeArenas.join)(makeCtx(db), {
        code: first.code,
      })) as { arenaId: string; code: string };
      expect(joined).toEqual(first);
    }

    setAuth("user_a");
    await handlerOf(challengeArenas.setReady)(makeCtx(db), {
      arenaId: first.arenaId,
      ready: true,
    });

    setAuth("user_b");
    const rematchRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      code: first.code,
    })) as RoomView;
    expect(rematchRoom.arenaId).toBe(first.arenaId);
    expect(
      rematchRoom.players.find((player) => player.userId === "user_a"),
    ).toMatchObject({ ready: true });
    expect(
      rematchRoom.players.find((player) => player.userId === "user_b"),
    ).toMatchObject({ ready: false });

    const oldRoom = (await handlerOf(challengeArenas.getRoom)(makeCtx(db), {
      arenaId,
    })) as RoomView;
    expect(oldRoom.rematchArenaId).toBe(first.arenaId);
    expect(oldRoom.rematchArenaCode).toBe(first.code);

    const oldSummary = (await handlerOf(challengeArenas.getArenaSummary)(
      makeCtx(db),
      { arenaId },
    )) as ArenaSummary | null;
    expect(oldSummary).toMatchObject({
      rematchArenaId: first.arenaId,
      rematchArenaCode: first.code,
    });
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
    const seeded = (await seedAllContentGaps(db)) as {
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
    });
    const activeLogoUrl = String(activeRoom.currentQuestion?.imageUrl ?? "");
    expect(activeLogoUrl).toMatch(/^\/arena-logos\/opaque\/[a-f0-9]{20}\.svg$/);
    expect(activeLogoUrl.toLowerCase()).not.toContain("google");
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
    });
    const revealLogoUrl = String(revealRoom.currentQuestion?.imageUrl ?? "");
    expect(revealLogoUrl).toBe(activeLogoUrl);
    expect(revealLogoUrl.toLowerCase()).not.toContain("google");
    expect(revealRoom.currentQuestion).not.toHaveProperty("acceptedAliases");
    expect(revealRoom.revealAnswers).toHaveLength(2);
  });

  it("closes logo text questions on timer with misses scored as zero", async () => {
    const db = new FakeDb();
    seedUsers(db);
    await seedAllContentGaps(db);
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

  it("seeds which-came-first rows into an empty store idempotently", async () => {
    const db = new FakeDb();
    seedUsers(db);

    const first = await seedAllContentGaps(db);
    const second = await seedAllContentGaps(db);

    expect(first.insertedWhichCameFirst).toBe(
      challengeArenaWhichCameFirstQuestions.length,
    );
    expect(first.whichCameFirst).toBe(challengeArenaWhichCameFirstQuestions.length);
    expect(questionCountByCategory(db, "which_came_first")).toBe(
      challengeArenaWhichCameFirstQuestions.length,
    );
    expect(second.insertedWhichCameFirst).toBe(0);
    expect(second.whichCameFirst).toBe(challengeArenaWhichCameFirstQuestions.length);
  });

  it("adds which-came-first rows without changing existing dedicated seed counts", async () => {
    const db = new FakeDb();
    seedUsers(db);
    seedChallengeArenaQuestions(
      db,
      "existing_capital",
      challengeArenaCapitalCityQuestions,
    );
    seedChallengeArenaQuestions(
      db,
      "existing_general",
      challengeArenaGeneralKnowledgeQuestions,
    );
    seedChallengeArenaQuestions(
      db,
      "existing_logo",
      challengeArenaEnterpriseLogoQuestions,
    );

    const seeded = await seedAllContentGaps(db);

    expect(seeded.insertedCapitalCities).toBe(0);
    expect(seeded.insertedGeneralKnowledge).toBe(0);
    expect(seeded.insertedEnterpriseLogos).toBe(0);
    expect(seeded.insertedWhichCameFirst).toBe(
      challengeArenaWhichCameFirstQuestions.length,
    );
    expect(seeded.capitalCities).toBe(challengeArenaCapitalCityQuestions.length);
    expect(seeded.generalKnowledge).toBe(
      challengeArenaGeneralKnowledgeQuestions.length,
    );
    expect(seeded.enterpriseLogos).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );
    expect(seeded.whichCameFirst).toBe(challengeArenaWhichCameFirstQuestions.length);
  });

  it("backfills only v2 which-came-first rows when v1 rows already exist", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const v1 = challengeArenaWhichCameFirstQuestions.filter((question) =>
      question.checksum.startsWith("knowledge_came_first_v1_"),
    );
    const v2 = challengeArenaWhichCameFirstQuestions.filter((question) =>
      question.checksum.startsWith("knowledge_came_first_v2_"),
    );
    seedChallengeArenaQuestions(db, "existing_came_first_v1", v1);

    const seeded = await seedAllContentGaps(db);

    expect(v1).toHaveLength(250);
    expect(v2).toHaveLength(300);
    expect(seeded.insertedWhichCameFirst).toBe(v2.length);
    expect(seeded.whichCameFirst).toBe(challengeArenaWhichCameFirstQuestions.length);
    expect(questionCountByCategory(db, "which_came_first")).toBe(
      challengeArenaWhichCameFirstQuestions.length,
    );
  });

  it("reports seeded challenge arena content counts idempotently", async () => {
    const db = new FakeDb();
    seedUsers(db);

    const first = (await seedAllContentGaps(db)) as {
      insertedCapitalCities: number;
      insertedGeneralKnowledge: number;
      insertedEnterpriseLogos: number;
      capitalCities: number;
      generalKnowledge: number;
      enterpriseLogos: number;
      bundledCapitalSeeds: number;
      bundledGeneralKnowledgeSeeds: number;
      bundledEnterpriseLogoSeeds: number;
    };
    const second = (await seedAllContentGaps(db)) as {
      insertedCapitalCities: number;
      insertedGeneralKnowledge: number;
      insertedEnterpriseLogos: number;
      capitalCities: number;
      generalKnowledge: number;
      enterpriseLogos: number;
      bundledCapitalSeeds: number;
      bundledGeneralKnowledgeSeeds: number;
      bundledEnterpriseLogoSeeds: number;
    };
    const status = (await handlerOf(challengeArenas.contentStatus)(
      makeCtx(db),
      {},
    )) as {
      capitalCities: number;
      generalKnowledge: number;
      enterpriseLogos: number;
      bundledCapitalSeeds: number;
      bundledGeneralKnowledgeSeeds: number;
      bundledEnterpriseLogoSeeds: number;
    };

    expect(first.insertedCapitalCities).toBe(
      challengeArenaCapitalCityQuestions.length,
    );
    expect(first.insertedGeneralKnowledge).toBe(
      challengeArenaGeneralKnowledgeQuestions.length,
    );
    expect(first.insertedEnterpriseLogos).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );
    expect(first.capitalCities).toBe(challengeArenaCapitalCityQuestions.length);
    expect(first.generalKnowledge).toBe(
      challengeArenaGeneralKnowledgeQuestions.length,
    );
    expect(second.insertedEnterpriseLogos).toBe(0);
    expect(second.insertedCapitalCities).toBe(0);
    expect(second.insertedGeneralKnowledge).toBe(0);
    expect(status.capitalCities).toBe(challengeArenaCapitalCityQuestions.length);
    expect(status.generalKnowledge).toBe(
      challengeArenaGeneralKnowledgeQuestions.length,
    );
    expect(status.enterpriseLogos).toBe(challengeArenaEnterpriseLogoQuestions.length);
    expect(status.bundledCapitalSeeds).toBe(
      challengeArenaCapitalCityQuestions.length,
    );
    expect(status.bundledGeneralKnowledgeSeeds).toBe(
      challengeArenaGeneralKnowledgeQuestions.length,
    );
    expect(status.bundledEnterpriseLogoSeeds).toBe(
      challengeArenaEnterpriseLogoQuestions.length,
    );

    const google = logoQuestionByAnswer(db, "Google");
    expect(google.imageUrl).toMatch(/^\/arena-logos\/opaque\/[a-f0-9]{20}\.svg$/);
    expect(google.imageUrl?.toLowerCase()).not.toContain("google");
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

  it("locks a custom rounds/perRound/categories config end to end", async () => {
    const db = makeSeededDb();
    setAuth("user_a");
    const created = (await handlerOf(challengeArenas.create)(makeCtx(db), {
      mode: "ffa3",
      rounds: 3,
      perRound: 6,
      categories: ["football_quiz", "general_knowledge", "capital_cities"],
    })) as { arenaId: string; code: string };
    for (const userId of ["user_b", "user_c"]) {
      setAuth(userId);
      await handlerOf(challengeArenas.join)(makeCtx(db), { code: created.code });
    }
    await readyUsers(db, created.arenaId, ["user_a", "user_b", "user_c"]);

    setAuth("user_a");
    const startResult = (await handlerOf(challengeArenas.start)(makeCtx(db), {
      arenaId: created.arenaId,
    })) as { questionSetSizes: number[]; categories: string[] };
    expect(startResult.questionSetSizes).toEqual([6, 6, 6]);
    expect(startResult.categories).toEqual([
      "football_quiz",
      "general_knowledge",
      "capital_cities",
    ]);

    const arena = db.row<ArenaRow>(created.arenaId);
    expect(arena.config).toMatchObject({ rounds: 3, perRound: 6 });
    expect(arena.roundChecksums).toHaveLength(3);
    for (const round of arena.roundChecksums) expect(round).toHaveLength(6);
    expect(new Set(arena.roundChecksums.flat()).size).toBe(18);

    const rounds = arena.roundChecksums.map((round) =>
      round.map((checksum) => questionByChecksum(db, checksum)),
    );
    expect(rounds[0].every((question) => question.sport === "football")).toBe(true);
    expect(
      rounds[2].every((question) => question.category === "capital_cities"),
    ).toBe(true);
  });

  it("repeats one subject across rounds with a distinct question set each round", async () => {
    const db = makeSeededDb();
    setAuth("user_a");
    const created = (await handlerOf(challengeArenas.create)(makeCtx(db), {
      mode: "1v1",
      rounds: 2,
      perRound: 5,
      categories: ["which_came_first", "which_came_first"],
    })) as { arenaId: string; code: string };
    setAuth("user_b");
    await handlerOf(challengeArenas.join)(makeCtx(db), { code: created.code });
    await readyUsers(db, created.arenaId, ["user_a", "user_b"]);

    setAuth("user_a");
    const startResult = (await handlerOf(challengeArenas.start)(makeCtx(db), {
      arenaId: created.arenaId,
    })) as { questionSetSizes: number[] };
    expect(startResult.questionSetSizes).toEqual([5, 5]);

    const arena = db.row<ArenaRow>(created.arenaId);
    expect(arena.roundChecksums).toHaveLength(2);
    // No overlap between the two same-subject rounds.
    expect(new Set(arena.roundChecksums.flat()).size).toBe(10);
    const questions = arena.roundChecksums
      .flat()
      .map((checksum) => questionByChecksum(db, checksum));
    expect(
      questions.every((question) => question.category === "which_came_first"),
    ).toBe(true);
  });

  it("rejects out-of-bounds or inconsistent custom configs", async () => {
    const db = makeSeededDb();
    setAuth("user_a");
    const badConfigs = [
      { rounds: 0, perRound: 10, categories: [] },
      { rounds: 9, perRound: 5, categories: Array(9).fill("football_quiz") },
      { rounds: 2, perRound: 3, categories: ["football_quiz", "general_knowledge"] },
      { rounds: 2, perRound: 16, categories: ["football_quiz", "general_knowledge"] },
      { rounds: 8, perRound: 15, categories: Array(8).fill("football_quiz") },
      { rounds: 3, perRound: 6, categories: ["football_quiz", "general_knowledge"] },
      { rounds: 1, perRound: 6, categories: ["arena_knowledge"] },
    ];
    for (const config of badConfigs) {
      await expect(
        handlerOf(challengeArenas.create)(makeCtx(db), { mode: "1v1", ...config }),
      ).rejects.toThrow();
    }
    // No arenas were created by the rejected calls.
    expect(db.all<ArenaRow>("arenas")).toHaveLength(0);
  });

  it("rematch carries the finished arena's custom config into the new lobby", async () => {
    const db = new FakeDb();
    seedUsers(db);
    const arenaId = "arena_custom_rematch";
    const customConfig = {
      rounds: 3,
      perRound: 7,
      categories: ["capital_cities", "football_quiz", "general_knowledge"],
    };
    db.seed("arenas", arenaId, {
      code: "CUSTOMR",
      hostId: "user_a",
      mode: "ffa3",
      status: "final",
      players: ["user_a", "user_b", "user_c"].map((userId, index) => ({
        userId,
        nameSnapshot: `Player ${index + 1}`,
        ready: false,
        joinedAt: now,
        lastSeenAt: now,
        left: false,
        totalScore: 0,
      })),
      config: customConfig,
      currentRound: 2,
      currentQuestionIndex: 6,
      phase: "final",
      questionWindowMs: 10_000,
      roundChecksums: [],
      createdAt: now,
      expiresAt: now + 60_000,
    });

    setAuth("user_a");
    const rematched = (await handlerOf(challengeArenas.rematch)(makeCtx(db), {
      arenaId,
    })) as { arenaId: string; code: string };
    const lobby = db.row<ArenaRow>(rematched.arenaId);
    expect(lobby.status).toBe("lobby");
    expect(lobby.config).toEqual(customConfig);
  });
});
