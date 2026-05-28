import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("user_1");
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
        rungId: expect.any(String),
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

  it("checks a submitted rung on the server and returns the chosen distractor reveal", async () => {
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
      rungId: rung.checksum,
      chosenOption: wrong.text,
    })) as Record<string, unknown>;

    expect(result).toEqual({
      correct: false,
      correctAnswer: rung.correctAnswer,
      reveal: wrong.reveal,
    });
    expect(patch).toHaveBeenCalledWith(
      "learn_session_1",
      expect.objectContaining({
        rungResults: [
          expect.objectContaining({
            rungId: rung.checksum,
            chosenOption: wrong.text,
            correct: false,
            firstTry: true,
          }),
        ],
      }),
    );
  });
});
