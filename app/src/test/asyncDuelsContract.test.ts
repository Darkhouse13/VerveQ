import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

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
import * as rivalries from "../../convex/rivalries";
import * as notifications from "../../convex/notifications";

type Args = { [key: string]: unknown };

function argsOf(fn: unknown): Args {
  const registered = fn as { exportArgs?: () => string };
  if (typeof registered.exportArgs !== "function") {
    throw new Error("not a Convex registered function");
  }
  const raw = JSON.parse(registered.exportArgs());
  return (raw.value ?? raw) as Args;
}

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("async duels server-authoritative contract", () => {
  it("does not accept client-supplied correctAnswer, score, checksum, or timeTaken", () => {
    const args = argsOf(duels.submitAnswer);

    expect(args).toHaveProperty("duelId");
    expect(args).toHaveProperty("questionIndex");
    expect(args).toHaveProperty("answer");
    expect(args).not.toHaveProperty("correctAnswer");
    expect(args).not.toHaveProperty("score");
    expect(args).not.toHaveProperty("checksum");
    expect(args).not.toHaveProperty("timeTaken");
  });

  it("scores a wrong answer from the stored checksum even when the caller cannot supply timing", async () => {
    authMock.getAuthUserId.mockResolvedValue("challenger");
    vi.spyOn(Date, "now").mockReturnValue(10_000);

    const duel = {
      _id: "duel_1",
      challengerId: "challenger",
      opponentId: "opponent",
      type: "knowledge",
      sport: "knowledge",
      difficulty: "easy",
      mode: "quiz",
      seed: "seed",
      questionChecksums: ["question_checksum"],
      challengerServedAt: [5_000],
      opponentServedAt: [],
      challengerResult: { score: 0, perQuestion: [] },
      opponentResult: { score: 0, perQuestion: [] },
      status: "awaiting_opponent",
      createdAt: 1,
      expiresAt: 20_000,
    };
    const question = {
      _id: "question_1",
      checksum: "question_checksum",
      correctAnswer: "Correct Answer",
      explanation: "Because.",
      usageCount: 0,
      timesAnswered: 0,
      timesCorrect: 0,
    };
    const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const ctx = {
      db: {
        get: async () => duel,
        patch: async (id: string, patch: Record<string, unknown>) => {
          patches.push({ id, patch });
        },
        query: () => ({
          withIndex: () => ({
            first: async () => question,
          }),
        }),
      },
      scheduler: { runAfter: async () => {} },
    };

    const result = (await handlerOf(duels.submitAnswer)(ctx, {
      duelId: "duel_1",
      questionIndex: 0,
      answer: "Wrong Answer",
    })) as { correct: boolean; score: number; timeTaken: number };

    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.timeTaken).toBe(5);
    expect(
      patches.some(
        ({ patch }) =>
          "challengerResult" in patch &&
          (patch.challengerResult as { perQuestion: Array<{ correct: boolean }> })
            .perQuestion[0].correct === false,
      ),
    ).toBe(true);
  });

  it("stores one locked checksum set for both players and derives each current question from it", () => {
    const source = readFileSync("convex/duels.ts", "utf8");
    const schema = readFileSync("convex/schema.ts", "utf8");

    expect(schema).toContain("duels: defineTable");
    expect(schema).toContain("questionChecksums: v.array(v.string())");
    expect(source).toContain("seededShuffle(stable, args.seed)");
    expect(source).toContain("return picked.map((question) => question.checksum)");
    expect(source).toContain("questionChecksums,");
    expect(source).toContain("duel.questionChecksums[nextIndex]");
  });

  it("guards rivalry application with a re-read and an idempotency marker", () => {
    const source = readFileSync("convex/duels.ts", "utf8");
    const schema = readFileSync("convex/schema.ts", "utf8");

    expect(schema).toContain("rivalryAppliedAt");
    expect(source).toContain("resolveDuelIfReady");
    expect(source).toContain("const duel = await ctx.db.get(duelId)");
    expect(source).toContain("if (duel.rivalryAppliedAt || !duel.opponentId) return false");
    expect(source).toContain("applyRivalryOnce");
  });

  it("exposes read-only aggregate duel status without opponent answers or question truth", async () => {
    authMock.getAuthUserId.mockResolvedValue("challenger");
    const args = argsOf(duels.getDuelStatus);
    expect(Object.keys(args).sort()).toEqual(["duelId", "guestToken"]);

    const secretOpponentAnswer = "OpponentSecretAnswer";
    const secretChecksum = "secret_checksum";
    const secretCorrectAnswer = "Secret Correct";
    const duel = {
      _id: "duel_1",
      challengerId: "challenger",
      opponentId: "opponent",
      type: "knowledge",
      sport: "knowledge",
      difficulty: "easy",
      mode: "quiz",
      seed: "seed",
      questionChecksums: [secretChecksum],
      challengerResult: {
        score: 100,
        completedAt: 1000,
        perQuestion: [
          {
            questionIndex: 0,
            checksum: secretChecksum,
            answer: secretCorrectAnswer,
            correct: true,
            score: 100,
            timeTaken: 1,
            servedAt: 1,
            answeredAt: 2,
          },
        ],
      },
      opponentResult: {
        score: 0,
        perQuestion: [
          {
            questionIndex: 0,
            checksum: secretChecksum,
            answer: secretOpponentAnswer,
            correct: false,
            score: 0,
            timeTaken: 2,
            servedAt: 3,
            answeredAt: 4,
          },
        ],
      },
      status: "awaiting_opponent",
      createdAt: 1,
      expiresAt: 20_000,
    };
    const writes = {
      patch: vi.fn(async () => {
        throw new Error("getDuelStatus must not write");
      }),
      insert: vi.fn(async () => {
        throw new Error("getDuelStatus must not write");
      }),
    };
    const ctx = {
      db: {
        get: async (id: string) => {
          if (id === "duel_1") return duel;
          if (id === "opponent") {
            return { _id: "opponent", username: "opponent" };
          }
          return null;
        },
        ...writes,
      },
    };

    const status = (await handlerOf(duels.getDuelStatus)(ctx, {
      duelId: "duel_1",
    })) as Record<string, unknown>;

    expect(status).toMatchObject({
      duelId: "duel_1",
      role: "challenger",
      status: "awaiting_opponent",
      myScore: 100,
      myCompleted: true,
      opponentScore: 0,
      opponentAnsweredCount: 1,
      opponentCompleted: false,
      winnerId: null,
    });
    expect(status).not.toHaveProperty("currentQuestion");
    expect(status).not.toHaveProperty("questionChecksums");
    expect(status).not.toHaveProperty("seed");
    expect(status).not.toHaveProperty("myResult");
    expect(status).not.toHaveProperty("opponentResult");
    expect(JSON.stringify(status)).not.toContain(secretOpponentAnswer);
    expect(JSON.stringify(status)).not.toContain(secretChecksum);
    expect(JSON.stringify(status)).not.toContain(secretCorrectAnswer);
    expect(writes.patch).not.toHaveBeenCalled();
    expect(writes.insert).not.toHaveBeenCalled();
  });
});

describe("async duel link, expiry, and inbox contracts", () => {
  it("supports guest link play through an ephemeral token and explicit post-signup attach", () => {
    const source = readFileSync("convex/duels.ts", "utf8");

    expect(source).toContain("opponentGuestTokenHash");
    expect(source).toContain("guestTokenHash(guestToken)");
    expect(source).toContain("attachGuestResult");
    expect(source).toContain("No guest result is pending for this duel");
    expect(source).not.toContain("create account");
  });

  it("expires stale duels from the hourly cron and resolves half-finished rows", () => {
    const source = readFileSync("convex/duels.ts", "utf8");
    const crons = readFileSync("convex/crons.ts", "utf8");

    expect(crons).toContain("async-duel-expiry");
    expect(crons).toContain("internal.duels.expireStaleDuels");
    expect(source).toContain("expireStaleDuels");
    expect(source).toContain("resolveDuelIfReady(ctx, duel._id, now, true)");
    expect(source).toContain("winnerId");
  });

  it("exposes the rivalry ledger and unread challenge inbox count", () => {
    expect(argsOf(rivalries.get)).toHaveProperty("opponentUserId");
    expect(argsOf(rivalries.listMine)).toEqual({});
    expect(argsOf(notifications.unreadCount)).toEqual({});

    const schema = readFileSync("convex/schema.ts", "utf8");
    expect(schema).toContain("rivalries: defineTable");
    expect(schema).toContain('index("by_pair"');
    expect(schema).toContain("challengeNotifications");
  });
});
