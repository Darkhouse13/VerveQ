import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => "user_1"),
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

import * as learn from "../../convex/learn";
import { buildLadder } from "../../convex/learnLadderBuilder";

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

function makeLearnMasteryQuery(rows: unknown[] = []) {
  return {
    withIndex: (
      _indexName: string,
      select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
    ) => {
      const builder = {
        eq() {
          return builder;
        },
      };
      select(builder);
      return {
        collect: async () => rows,
      };
    },
  };
}

function makeLearnRungReviewQuery(rows: unknown[] = []) {
  return {
    withIndex: (
      _indexName: string,
      select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
    ) => {
      const builder = {
        eq() {
          return builder;
        },
      };
      select(builder);
      return {
        collect: async () => rows,
      };
    },
  };
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("user_1");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("learn Convex contract", () => {
  it("starts a Learn session and returns only sanitized ladder rungs", async () => {
    const inserted: Array<{ table: string; value: Record<string, unknown> }> = [];
    const ctx = {
      db: {
        query: (table: string) => {
          if (table !== "learnMastery") {
            throw new Error(`Unexpected query table: ${table}`);
          }
          return makeLearnMasteryQuery([]);
        },
        insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
          inserted.push({ table, value });
          return table === "learnSessions" ? "learn_session_1" : "learn_mastery_1";
        }),
        patch: vi.fn(),
      },
    };

    const result = (await handlerOf(learn.getLearnLadder)(ctx, {
      nodeId: "geo.capitals.nonobvious",
    })) as {
      nodeId: string;
      sessionId: string;
      rungs: Array<Record<string, unknown>>;
    };

    expect(result.nodeId).toBe("geo.capitals.nonobvious");
    expect(result.sessionId).toBe("learn_session_1");
    expect(result.rungs.length).toBeGreaterThan(0);
    for (const rung of result.rungs) {
      expect(rung).toEqual({
        questionId: expect.any(String),
        type: "mcq",
        stem: expect.any(String),
        options: expect.any(Array),
      });
      expect(rung).not.toHaveProperty("correctAnswer");
      expect(rung).not.toHaveProperty("reveal");
      expect(rung).not.toHaveProperty("correctReveal");
      expect(rung).not.toHaveProperty("distractors");
    }

    expect(inserted).toContainEqual({
      table: "learnMastery",
      value: expect.objectContaining({
        userId: "user_1",
        nodeId: "geo.capitals.nonobvious",
        state: "learning",
      }),
    });
    expect(inserted).toContainEqual({
      table: "learnSessions",
      value: expect.objectContaining({
        userId: "user_1",
        nodeId: "geo.capitals.nonobvious",
        rungResults: [],
      }),
    });
  });

  it("exposes the pipeline-proof mixed ladder without leaking grading metadata", async () => {
    const ctx = {
      db: {
        query: (table: string) => {
          if (table !== "learnMastery") {
            throw new Error(`Unexpected query table: ${table}`);
          }
          return makeLearnMasteryQuery([]);
        },
        insert: vi.fn(async (table: string) =>
          table === "learnSessions" ? "learn_session_1" : "learn_mastery_1",
        ),
        patch: vi.fn(),
      },
    };

    const result = (await handlerOf(learn.getLearnLadder)(ctx, {
      nodeId: "geo.pipeline.proof",
    })) as {
      rungs: Array<Record<string, unknown>>;
    };

    expect(result.rungs.map((rung) => rung.type)).toEqual([
      "mcq",
      "text",
      "text",
      "text",
      "numeric",
      "numeric",
      "numeric",
      "order",
      "order",
      "order",
    ]);

    const numeric = result.rungs.find((rung) => rung.type === "numeric");
    expect(numeric).toMatchObject({
      unit: expect.any(String),
      tolerance: expect.any(Number),
    });
    const order = result.rungs.find((rung) => rung.type === "order");
    expect(order).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), text: expect.any(String) }),
      ]),
    });

    for (const rung of result.rungs) {
      expect(rung).not.toHaveProperty("correctAnswer");
      expect(rung).not.toHaveProperty("acceptedAnswers");
      expect(rung).not.toHaveProperty("acceptedUnits");
      expect(rung).not.toHaveProperty("numericAnswer");
      expect(rung).not.toHaveProperty("correctOrder");
      expect(rung).not.toHaveProperty("correctReveal");
      expect(rung).not.toHaveProperty("distractors");
    }
  });

  it("checks a submitted rung on the server and returns the chosen distractor teach", async () => {
    const ladder = buildLadder("geo.capitals.nonobvious");
    const rung = ladder.questions[0];
    const wrong = rung.distractors[0];
    const patch = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "learn_session_1",
          userId: "user_1",
          nodeId: "geo.capitals.nonobvious",
          subject: "geography",
          rungIds: ladder.questions.map((question) => question.checksum),
          rungResults: [],
          startedAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        })),
        patch,
      },
    };

    const result = (await handlerOf(learn.submitLearnRung)(ctx, {
      sessionId: "learn_session_1",
      questionId: rung.checksum,
      answer: wrong.text,
    })) as Record<string, unknown>;

    expect(result).toEqual({
      correct: false,
      branchId: wrong.text,
      teach: wrong.reveal,
    });
    expect(result).not.toHaveProperty("correctAnswer");
    expect(result).not.toHaveProperty("reveal");
    expect(patch).toHaveBeenCalledWith(
      "learn_session_1",
      expect.objectContaining({
        rungResults: [
          expect.objectContaining({
            rungId: rung.checksum,
            answer: wrong.text,
            branchId: wrong.text,
            correct: false,
            firstTry: true,
          }),
        ],
      }),
    );
  });

  it("grades proof text, numeric, and order rungs through submitLearnRung", async () => {
    const ladder = buildLadder("geo.pipeline.proof");
    const text = ladder.questions.find(
      (question) => question.type === "text",
    );
    const numeric = ladder.questions.find(
      (question) => question.type === "numeric",
    );
    const order = ladder.questions.find(
      (question) => question.type === "order",
    );
    if (!text || !numeric || !order) throw new Error("proof ladder missing types");

    const patch = vi.fn();
    const session = {
      _id: "learn_session_1",
      userId: "user_1",
      nodeId: "geo.pipeline.proof",
      subject: "geography",
      rungIds: ladder.questions.map((question) => question.checksum),
      rungResults: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };
    const ctx = {
      db: {
        get: vi.fn(async () => session),
        patch,
      },
    };

    await expect(
      handlerOf(learn.submitLearnRung)(ctx, {
        sessionId: "learn_session_1",
        questionId: text.checksum,
        answer: text.acceptedAnswers?.[0],
      }),
    ).resolves.toMatchObject({ correct: true, teach: text.correctReveal });

    await expect(
      handlerOf(learn.submitLearnRung)(ctx, {
        sessionId: "learn_session_1",
        questionId: numeric.checksum,
        answer: { value: numeric.numericAnswer, unit: numeric.numericUnit },
      }),
    ).resolves.toMatchObject({ correct: true, teach: numeric.correctReveal });

    await expect(
      handlerOf(learn.submitLearnRung)(ctx, {
        sessionId: "learn_session_1",
        questionId: order.checksum,
        answer: order.correctOrder,
      }),
    ).resolves.toMatchObject({ correct: true, teach: order.correctReveal });
  });

  it("persists rating-derived next interval and review state from the server outcome", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const ladder = buildLadder("geo.pipeline.proof");
    const rung = ladder.questions[1];
    const answeredAt = Date.now() - 1_000;
    const insert = vi.fn(async () => "learn_rung_review_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "learn_session_1",
          userId: "user_1",
          nodeId: "geo.pipeline.proof",
          subject: "geography",
          rungIds: ladder.questions.map((question) => question.checksum),
          rungResults: [
            {
              rungId: rung.checksum,
              answer: "Paris",
              correct: true,
              firstTry: true,
              answeredAt,
            },
          ],
          startedAt: Date.now() - 5_000,
          updatedAt: Date.now() - 1_000,
          expiresAt: Date.now() + 60_000,
        })),
        query: (table: string) => {
          if (table !== "learnRungReviews") {
            throw new Error(`Unexpected query table: ${table}`);
          }
          return makeLearnRungReviewQuery([]);
        },
        insert,
      },
    };

    const result = (await handlerOf(learn.rateLearnRung)(ctx, {
      sessionId: "learn_session_1",
      questionId: rung.checksum,
      rating: "good",
    })) as Record<string, unknown>;

    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(result).toEqual({
      reviewState: "locked_in",
      nextReview: Date.now() + oneDayMs,
      intervalMs: oneDayMs,
      masteryDelta: 0.15,
    });
    expect(insert).toHaveBeenCalledWith(
      "learnRungReviews",
      expect.objectContaining({
        userId: "user_1",
        nodeId: "geo.pipeline.proof",
        rungId: rung.checksum,
        reviewState: "locked_in",
        dueAt: Date.now() + oneDayMs,
        intervalMs: oneDayMs,
        repetitions: 1,
        lastRating: "good",
        lastCorrect: true,
        lastAnsweredAt: answeredAt,
      }),
    );
  });

  it("persists the felt learning/test signal per answered rung", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const ladder = buildLadder("geo.pipeline.proof");
    const rung = ladder.questions[1];
    const insert = vi.fn(async () => "learn_rung_review_1");
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "learn_session_1",
          userId: "user_1",
          nodeId: "geo.pipeline.proof",
          subject: "geography",
          rungIds: ladder.questions.map((question) => question.checksum),
          rungResults: [
            {
              rungId: rung.checksum,
              answer: "Paris",
              correct: true,
              firstTry: true,
              answeredAt: Date.now() - 1_000,
            },
          ],
          startedAt: Date.now() - 5_000,
          updatedAt: Date.now() - 1_000,
          expiresAt: Date.now() + 60_000,
        })),
        query: (table: string) => {
          if (table !== "learnRungReviews") {
            throw new Error(`Unexpected query table: ${table}`);
          }
          return makeLearnRungReviewQuery([]);
        },
        insert,
      },
    };

    await expect(
      handlerOf(learn.recordLearnRungFelt)(ctx, {
        sessionId: "learn_session_1",
        questionId: rung.checksum,
        felt: "test",
      }),
    ).resolves.toEqual({ felt: "test", recordedAt: Date.now() });

    expect(insert).toHaveBeenCalledWith(
      "learnRungReviews",
      expect.objectContaining({
        userId: "user_1",
        rungId: rung.checksum,
        reviewState: "learning",
        lastFelt: "test",
        lastCorrect: true,
      }),
    );
  });

  it("ignores forged client correctness and teaching fields on Learn submit", async () => {
    const ladder = buildLadder("geo.capitals.nonobvious");
    const rung = ladder.questions[0];
    const wrong = rung.distractors[0];
    const patch = vi.fn();
    const ctx = {
      db: {
        get: vi.fn(async () => ({
          _id: "learn_session_1",
          userId: "user_1",
          nodeId: "geo.capitals.nonobvious",
          subject: "geography",
          rungIds: ladder.questions.map((question) => question.checksum),
          rungResults: [],
          startedAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        })),
        patch,
      },
    };

    const result = (await handlerOf(learn.submitLearnRung)(ctx, {
      sessionId: "learn_session_1",
      questionId: rung.checksum,
      answer: wrong.text,
      correct: true,
      correctAnswer: wrong.text,
      teach: "Forged teach.",
      reveal: "Forged reveal.",
      masteryDelta: 999,
      nextReview: 1,
    })) as Record<string, unknown>;

    expect(result).toEqual({
      correct: false,
      branchId: wrong.text,
      teach: wrong.reveal,
    });
    expect(patch).toHaveBeenCalledWith(
      "learn_session_1",
      expect.objectContaining({
        rungResults: [
          expect.objectContaining({
            answer: wrong.text,
            correct: false,
          }),
        ],
      }),
    );
  });
});
