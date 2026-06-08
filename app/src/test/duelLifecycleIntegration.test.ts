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

import * as duels from "../../convex/duels";

type Args = { [key: string]: unknown };
type Row = Record<string, unknown> & { _id: string };

type DuelRow = Row & {
  challengerId: string;
  opponentId?: string;
  opponentGuestTokenHash?: string;
  type: "sports" | "knowledge";
  category?: string;
  sport?: string;
  difficulty: "easy" | "intermediate" | "hard";
  mode: string;
  seed: string;
  questionChecksums: string[];
  challengerResult?: DuelResult;
  opponentResult?: DuelResult;
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  winnerId?: string;
  rematchOfDuelId?: string;
  expiresAt: number;
  rivalryAppliedAt?: number;
};

type DuelResult = {
  score: number;
  perQuestion: Array<{
    questionIndex: number;
    checksum: string;
    answer: string;
    correct: boolean;
    score: number;
    timeTaken: number;
    servedAt: number;
    answeredAt: number;
  }>;
  completedAt?: number;
};

type QuestionRow = Row & {
  sport: string;
  category: string;
  difficulty: "easy" | "intermediate" | "hard";
  checksum: string;
  question: string;
  options: string[];
  correctAnswer: string;
  usageCount: number;
  timesAnswered: number;
  timesCorrect: number;
};

type RivalryRow = Row & {
  pairKey: string;
  userAId: string;
  userBId: string;
  aWins: number;
  bWins: number;
  draws: number;
  currentStreakHolderId?: string;
  currentStreakLen: number;
  lastDuelId?: string;
  updatedAt: number;
};

type DuelView = {
  duelId: string;
  role: "challenger" | "opponent";
  status: string;
  questionChecksums: string[];
  seed: string | null;
  currentQuestion: { checksum: string } | null;
  myResult: {
    score: number;
    completedAt: number | null;
    perQuestion: Array<{ answer: string; checksum: string }>;
  };
  opponentResult: Record<string, unknown>;
};

type ListMineResult = {
  yourTurn: unknown[];
  awaiting: unknown[];
  resolved: unknown[];
};

type DuelStatus = {
  duelId: string;
  role: "challenger" | "opponent";
  status: string;
  myScore: number;
  myAnsweredCount: number;
  myCompleted: boolean;
  opponentScore: number;
  opponentAnsweredCount: number;
  opponentCompleted: boolean;
  winnerId: string | null;
  bucket: "your_turn" | "awaiting_opponent" | "resolved";
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

  lte(field: string, value: number) {
    this.predicates.push(
      (row) => typeof row[field] === "number" && row[field] <= value,
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
    for (const table of [
      "users",
      "duels",
      "quizQuestions",
      "rivalries",
      "challengeNotifications",
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

let now = 1_000_000;

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
  db.seed("users", "user_a", {
    username: "alpha",
    displayName: "Alpha",
    isGuest: false,
    isAnonymous: false,
  });
  db.seed("users", "user_b", {
    username: "bravo",
    displayName: "Bravo",
    isGuest: false,
    isAnonymous: false,
  });
  db.seed("users", "user_c", {
    username: "charlie",
    displayName: "Charlie",
    isGuest: false,
    isAnonymous: false,
  });
}

function seedKnowledgeQuestions(db: FakeDb) {
  for (let i = 0; i < 10; i += 1) {
    const suffix = String(i).padStart(2, "0");
    const correctAnswer = `Correct ${suffix}`;
    db.seed("quizQuestions", `question_${suffix}`, {
      sport: "knowledge",
      category: "science",
      question: `Science question ${suffix}?`,
      options: [correctAnswer, `Wrong A ${suffix}`, `Wrong B ${suffix}`, `Wrong C ${suffix}`],
      correctAnswer,
      explanation: `Because ${suffix}.`,
      difficulty: "easy",
      bucket: "knowledge_science_easy",
      checksum: `knowledge_science_easy_${suffix}`,
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
  seedKnowledgeQuestions(db);
  return db;
}

function questionByChecksum(db: FakeDb, checksum: string) {
  const question = db
    .all<QuestionRow>("quizQuestions")
    .find((row) => row.checksum === checksum);
  if (!question) throw new Error(`Missing question ${checksum}`);
  return question;
}

function wrongAnswer(question: QuestionRow, salt: string) {
  return (
    question.options.find((option) => option !== question.correctAnswer) ??
    `Wrong ${salt}`
  );
}

async function createKnowledgeDuel(db: FakeDb, opponentUserId = "user_b") {
  setAuth("user_a");
  const result = (await handlerOf(duels.create)(makeCtx(db), {
    type: "knowledge",
    category: "science",
    difficulty: "easy",
    mode: "quiz",
    opponentUserId,
  })) as { duelId: string; linkCode: string | null };
  return result.duelId;
}

async function getDuelStatus(
  db: FakeDb,
  duelId: string,
  userId: string | null,
  guestToken?: string,
) {
  setAuth(userId);
  return (await handlerOf(duels.getDuelStatus)(makeCtx(db), {
    duelId,
    guestToken,
  })) as DuelStatus;
}

async function answerAll(
  db: FakeDb,
  duelId: string,
  userId: string | null,
  answerFor: (question: QuestionRow, index: number) => string,
  guestToken?: string,
) {
  setAuth(userId);
  const duel = db.row<DuelRow>(duelId);

  for (let index = 0; index < duel.questionChecksums.length; index += 1) {
    const view = (await handlerOf(duels.getMyDuel)(makeCtx(db), {
      duelId,
      guestToken,
    })) as DuelView;
    expect(view.status).toBe("awaiting_opponent");
    expect(view.questionChecksums).toEqual([]);
    expect(view.seed).toBeNull();
    expect(view.currentQuestion?.checksum).toBe(duel.questionChecksums[index]);

    const question = questionByChecksum(db, duel.questionChecksums[index]);
    await handlerOf(duels.submitAnswer)(makeCtx(db), {
      duelId,
      questionIndex: index,
      answer: answerFor(question, index),
      guestToken,
    });
  }
}

beforeEach(() => {
  now = 1_000_000;
  authMock.getAuthUserId.mockReset();
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("duel lifecycle integration", () => {
  it("resolves a targeted two-account duel once, writes the rivalry ledger, and creates a parameter-matched rematch", async () => {
    const db = makeSeededDb();
    const duelId = await createKnowledgeDuel(db);
    const initial = db.row<DuelRow>(duelId);

    expect(initial.opponentId).toBe("user_b");
    expect(initial.questionChecksums).toHaveLength(10);
    expect(new Set(initial.questionChecksums).size).toBe(10);

    const initialStatus = await getDuelStatus(db, duelId, "user_a");
    expect(initialStatus).toMatchObject({
      role: "challenger",
      status: "awaiting_opponent",
      myScore: 0,
      myAnsweredCount: 0,
      myCompleted: false,
      opponentScore: 0,
      opponentAnsweredCount: 0,
      opponentCompleted: false,
      winnerId: null,
      bucket: "your_turn",
    });
    expect(db.row<DuelRow>(duelId).challengerServedAt).toEqual([]);

    await answerAll(db, duelId, "user_a", (question) => question.correctAnswer);
    const challengerComplete = (await handlerOf(duels.complete)(makeCtx(db), {
      duelId,
    })) as { status: string; winnerId: string | null };
    expect(challengerComplete).toEqual({
      status: "awaiting_opponent",
      winnerId: null,
    });

    const challengerWaitingStatus = await getDuelStatus(db, duelId, "user_a");
    expect(challengerWaitingStatus).toMatchObject({
      role: "challenger",
      status: "awaiting_opponent",
      myCompleted: true,
      opponentCompleted: false,
      opponentAnsweredCount: 0,
      winnerId: null,
      bucket: "awaiting_opponent",
    });
    const opponentTurnStatus = await getDuelStatus(db, duelId, "user_b");
    expect(opponentTurnStatus).toMatchObject({
      role: "opponent",
      status: "awaiting_opponent",
      myCompleted: false,
      opponentCompleted: true,
      opponentAnsweredCount: 10,
      winnerId: null,
      bucket: "your_turn",
    });

    await answerAll(db, duelId, "user_b", (question, index) =>
      wrongAnswer(question, `targeted-${index}`),
    );
    const resolved = (await handlerOf(duels.complete)(makeCtx(db), {
      duelId,
    })) as { status: string; winnerId: string | null };

    expect(resolved).toEqual({ status: "resolved", winnerId: "user_a" });
    const resolvedDuel = db.row<DuelRow>(duelId);
    expect(resolvedDuel.status).toBe("resolved");
    expect(resolvedDuel.rivalryAppliedAt).toEqual(expect.any(Number));

    const challengerResolvedStatus = await getDuelStatus(db, duelId, "user_a");
    expect(challengerResolvedStatus).toMatchObject({
      role: "challenger",
      status: "resolved",
      myScore: resolvedDuel.challengerResult?.score,
      myCompleted: true,
      opponentScore: resolvedDuel.opponentResult?.score,
      opponentCompleted: true,
      winnerId: "user_a",
      bucket: "resolved",
    });
    const opponentResolvedStatus = await getDuelStatus(db, duelId, "user_b");
    expect(opponentResolvedStatus).toMatchObject({
      role: "opponent",
      status: "resolved",
      myScore: resolvedDuel.opponentResult?.score,
      myCompleted: true,
      opponentScore: resolvedDuel.challengerResult?.score,
      opponentCompleted: true,
      winnerId: "user_a",
      bucket: "resolved",
    });
    expect(JSON.stringify(challengerResolvedStatus)).not.toContain("Wrong A");

    const rivalry = db.all<RivalryRow>("rivalries");
    expect(rivalry).toHaveLength(1);
    expect(rivalry[0]).toMatchObject({
      pairKey: "user_a|user_b",
      userAId: "user_a",
      userBId: "user_b",
      aWins: 1,
      bWins: 0,
      draws: 0,
      currentStreakHolderId: "user_a",
      currentStreakLen: 1,
      lastDuelId: duelId,
    });

    const appliedAt = resolvedDuel.rivalryAppliedAt;
    await Promise.all([
      handlerOf(duels.complete)(makeCtx(db), { duelId }),
      handlerOf(duels.complete)(makeCtx(db), { duelId }),
    ]);

    expect(db.row<DuelRow>(duelId).rivalryAppliedAt).toBe(appliedAt);
    expect(db.all<RivalryRow>("rivalries")).toHaveLength(1);
    expect(db.all<RivalryRow>("rivalries")[0]).toMatchObject({
      aWins: 1,
      bWins: 0,
      draws: 0,
      currentStreakLen: 1,
    });

    setAuth("user_b");
    const rematch = (await handlerOf(duels.rematch)(makeCtx(db), {
      duelId,
    })) as { duelId: string; linkCode: string | null };
    const rematchDuel = db.row<DuelRow>(rematch.duelId);

    expect(rematch.linkCode).toBeNull();
    expect(rematchDuel).toMatchObject({
      challengerId: "user_b",
      opponentId: "user_a",
      rematchOfDuelId: duelId,
      type: initial.type,
      sport: initial.sport,
      category: initial.category,
      difficulty: initial.difficulty,
      mode: initial.mode,
      status: "awaiting_opponent",
    });
    expect(rematchDuel.seed).not.toBe(initial.seed);
    expect(rematchDuel.questionChecksums).toHaveLength(10);
  });

  it("defers a link guest rivalry until the guest result is attached to an account", async () => {
    const db = makeSeededDb();
    const guestToken = "guest-token-1234567890";

    setAuth("user_a");
    const created = (await handlerOf(duels.create)(makeCtx(db), {
      type: "knowledge",
      category: "science",
      difficulty: "easy",
      mode: "quiz",
      viaLink: true,
    })) as { duelId: string; linkCode: string | null };
    expect(created.linkCode).toEqual(expect.any(String));

    setAuth(null);
    const linkView = (await handlerOf(duels.getByLinkCode)(makeCtx(db), {
      linkCode: created.linkCode,
      guestToken,
    })) as DuelView;
    const linkDuel = db.row<DuelRow>(created.duelId);
    expect(linkView.role).toBe("opponent");
    expect(linkView.currentQuestion?.checksum).toBe(linkDuel.questionChecksums[0]);
    expect(linkDuel.opponentGuestTokenHash).toEqual(expect.any(String));
    expect(linkDuel.opponentId).toBeUndefined();

    const guestInitialStatus = await getDuelStatus(
      db,
      created.duelId,
      null,
      guestToken,
    );
    expect(guestInitialStatus).toMatchObject({
      role: "opponent",
      status: "awaiting_opponent",
      myCompleted: false,
      opponentCompleted: false,
      winnerId: null,
      bucket: "your_turn",
    });

    await answerAll(db, created.duelId, "user_a", (question) => question.correctAnswer);
    setAuth("user_a");
    await handlerOf(duels.complete)(makeCtx(db), { duelId: created.duelId });

    const guestAwaitingStatus = await getDuelStatus(
      db,
      created.duelId,
      null,
      guestToken,
    );
    expect(guestAwaitingStatus).toMatchObject({
      role: "opponent",
      status: "awaiting_opponent",
      myCompleted: false,
      opponentCompleted: true,
      opponentAnsweredCount: 10,
      winnerId: null,
    });

    await answerAll(db, created.duelId, null, (question, index) =>
      wrongAnswer(question, `guest-${index}`),
      guestToken,
    );
    setAuth(null);
    const guestComplete = (await handlerOf(duels.complete)(makeCtx(db), {
      duelId: created.duelId,
      guestToken,
    })) as { status: string; winnerId: string | null };

    expect(guestComplete).toEqual({ status: "resolved", winnerId: "user_a" });
    const guestResolvedStatus = await getDuelStatus(
      db,
      created.duelId,
      null,
      guestToken,
    );
    expect(guestResolvedStatus).toMatchObject({
      role: "opponent",
      status: "resolved",
      myCompleted: true,
      opponentCompleted: true,
      winnerId: "user_a",
      bucket: "resolved",
    });
    expect(db.row<DuelRow>(created.duelId).rivalryAppliedAt).toBeUndefined();
    expect(db.all<RivalryRow>("rivalries")).toHaveLength(0);

    setAuth("user_c");
    await handlerOf(duels.attachGuestResult)(makeCtx(db), {
      duelId: created.duelId,
      guestToken,
    });
    const attached = db.row<DuelRow>(created.duelId);
    const attachedAt = attached.rivalryAppliedAt;

    expect(attached.opponentId).toBe("user_c");
    expect(attached.rivalryAppliedAt).toEqual(expect.any(Number));
    expect(db.all<RivalryRow>("rivalries")).toHaveLength(1);
    expect(db.all<RivalryRow>("rivalries")[0]).toMatchObject({
      pairKey: "user_a|user_c",
      aWins: 1,
      bWins: 0,
      draws: 0,
      currentStreakHolderId: "user_a",
      currentStreakLen: 1,
      lastDuelId: created.duelId,
    });

    await handlerOf(duels.attachGuestResult)(makeCtx(db), {
      duelId: created.duelId,
      guestToken,
    });
    expect(db.row<DuelRow>(created.duelId).rivalryAppliedAt).toBe(attachedAt);
    expect(db.all<RivalryRow>("rivalries")[0]).toMatchObject({
      aWins: 1,
      bWins: 0,
      draws: 0,
    });
  });

  it("allows username-only users to create link duels but not direct account duels", async () => {
    const db = makeSeededDb();
    db.seed("users", "anon_user", {
      username: "anon_user",
      displayName: "Anon User",
      isGuest: false,
      isAnonymous: true,
    });

    setAuth("anon_user");
    const created = (await handlerOf(duels.create)(makeCtx(db), {
      type: "knowledge",
      category: "science",
      difficulty: "easy",
      mode: "quiz",
      viaLink: true,
    })) as { duelId: string; linkCode: string | null };

    expect(created.linkCode).toEqual(expect.any(String));
    expect(db.row<DuelRow>(created.duelId)).toMatchObject({
      challengerId: "anon_user",
      opponentId: undefined,
      status: "awaiting_opponent",
    });

    await expect(
      handlerOf(duels.create)(makeCtx(db), {
        type: "knowledge",
        category: "science",
        difficulty: "easy",
        mode: "quiz",
        opponentUserId: "user_b",
      }),
    ).rejects.toThrow(/registered account/i);
  });

  it("expires a half-finished duel using the stored score rule", async () => {
    const db = makeSeededDb();
    const duelId = await createKnowledgeDuel(db);
    const duel = db.row<DuelRow>(duelId);

    await answerAll(db, duelId, "user_a", (question, index) =>
      index === 0 ? question.correctAnswer : wrongAnswer(question, `expire-${index}`),
    );

    setAuth("user_a");
    await handlerOf(duels.complete)(makeCtx(db), { duelId });
    await db.patch(duelId, { expiresAt: now - 1 });

    const expired = (await handlerOf(duels.expireStaleDuels)(makeCtx(db), {
      limit: 10,
    })) as { resolved: number; nudged: number };
    const expiredDuel = db.row<DuelRow>(duelId);

    expect(expired).toEqual({ resolved: 1, nudged: 0 });
    expect(expiredDuel.status).toBe("expired");
    expect(expiredDuel.winnerId).toBe("user_a");
    expect(expiredDuel.challengerResult?.score).toBeGreaterThan(
      expiredDuel.opponentResult?.score ?? 0,
    );
    expect(db.all<RivalryRow>("rivalries")[0]).toMatchObject({
      pairKey: "user_a|user_b",
      aWins: 1,
      bWins: 0,
      draws: 0,
      lastDuelId: duel._id,
    });
  });

  it("locks the abuse contract for order, public args, and opponent answer privacy", async () => {
    const db = makeSeededDb();
    const duelId = await createKnowledgeDuel(db);
    const duel = db.row<DuelRow>(duelId);

    setAuth("user_a");
    await handlerOf(duels.getMyDuel)(makeCtx(db), { duelId });
    const firstQuestion = questionByChecksum(db, duel.questionChecksums[0]);
    await expect(
      handlerOf(duels.submitAnswer)(makeCtx(db), {
        duelId,
        questionIndex: 1,
        answer: firstQuestion.correctAnswer,
      }),
    ).rejects.toThrow(/out of order/i);

    const submitArgs = argsOf(duels.submitAnswer);
    expect(Object.keys(submitArgs).sort()).toEqual([
      "answer",
      "duelId",
      "guestToken",
      "questionIndex",
    ]);
    expect(submitArgs).not.toHaveProperty("correctAnswer");
    expect(submitArgs).not.toHaveProperty("score");
    expect(submitArgs).not.toHaveProperty("checksum");
    expect(submitArgs).not.toHaveProperty("timeTaken");

    const secretOpponentAnswer = "OpponentSecretWrongAnswer";
    setAuth("user_b");
    await handlerOf(duels.getMyDuel)(makeCtx(db), { duelId });
    await handlerOf(duels.submitAnswer)(makeCtx(db), {
      duelId,
      questionIndex: 0,
      answer: secretOpponentAnswer,
    });

    setAuth("user_a");
    const challengerView = (await handlerOf(duels.getMyDuel)(makeCtx(db), {
      duelId,
    })) as DuelView;
    expect(challengerView.opponentResult).toMatchObject({
      score: 0,
      completedAt: null,
      answeredCount: 1,
    });
    expect(challengerView.opponentResult).not.toHaveProperty("perQuestion");
    expect(JSON.stringify(challengerView)).not.toContain(secretOpponentAnswer);

    const listMine = (await handlerOf(duels.listMine)(makeCtx(db), {})) as ListMineResult;
    expect(listMine.yourTurn).toHaveLength(1);
    expect(listMine.awaiting).toHaveLength(0);
    expect(listMine.resolved).toHaveLength(0);
    expect(JSON.stringify(listMine)).not.toContain(secretOpponentAnswer);
  });
});
