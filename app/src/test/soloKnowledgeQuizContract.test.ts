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

import * as quizSessions from "../../convex/quizSessions";

type RegisteredFunction = {
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
};

type QuestionRow = {
  _id: string;
  sport: string;
  category: string;
  difficulty: "easy" | "intermediate" | "hard";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  checksum: string;
  usageCount: number;
  timesAnswered: number;
  timesCorrect: number;
};

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

function makeQuestion(overrides: Partial<QuestionRow>): QuestionRow {
  return {
    _id: "question_1",
    sport: "knowledge",
    category: "science",
    difficulty: "easy",
    question: "What is tested?",
    options: ["Correct", "Wrong A", "Wrong B", "Wrong C"],
    correctAnswer: "Correct",
    explanation: "Because.",
    checksum: "knowledge_v1_test",
    usageCount: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    ...overrides,
  };
}

function makeQuestionQuery(questions: QuestionRow[], queried: Array<Record<string, unknown>>) {
  return (table: string) => {
    if (table !== "quizQuestions") {
      throw new Error(`Unexpected table query: ${table}`);
    }
    return {
      withIndex: (_indexName: string, select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
        const filters: Record<string, unknown> = {};
        const builder = {
          eq(field: string, value: unknown) {
            filters[field] = value;
            return builder;
          },
        };
        select(builder);
        queried.push(filters);
        return {
          collect: async () =>
            questions.filter((question) =>
              Object.entries(filters).every(
                ([field, value]) => question[field as keyof QuestionRow] === value,
              ),
            ),
        };
      },
    };
  };
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("user_1");
});

describe("solo Knowledge quiz question loading", () => {
  it("loads Knowledge Mode questions through the runtime handler without leaking the answer", async () => {
    const session = {
      _id: "session_1",
      userId: "user_1",
      sport: "knowledge",
      mode: "quiz",
      difficulty: "easy",
      usedChecksums: [],
      completed: false,
      expiresAt: Date.now() + 60_000,
    };
    const queried: Array<Record<string, unknown>> = [];
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => session,
        query: makeQuestionQuery(
          [
            makeQuestion({ checksum: "knowledge_v1_science" }),
            makeQuestion({
              _id: "came_first_1",
              category: "which_came_first",
              options: ["Older", "Newer"],
              correctAnswer: "Older",
              checksum: "knowledge_came_first_v1_001",
            }),
          ],
          queried,
        ),
        patch,
      },
      storage: { getUrl: vi.fn() },
    };

    const result = (await handlerOf(quizSessions.getQuestion)(ctx, {
      sessionId: "session_1",
    })) as Record<string, unknown>;

    expect(queried).toContainEqual({
      sport: "knowledge",
      difficulty: "easy",
    });
    expect(result).toMatchObject({
      question: "What is tested?",
      checksum: "knowledge_v1_science",
      category: "science",
      imageUrl: null,
    });
    expect(result).not.toHaveProperty("correctAnswer");
    expect(result).not.toHaveProperty("explanation");
    expect(patch).toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({
        currentChecksum: "knowledge_v1_science",
      }),
    );
  });

  it("normalizes Which Came First sessions to the seeded intermediate pool", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "session_1";
        },
      },
    };

    await handlerOf(quizSessions.createSession)(ctx, {
      sport: "knowledge",
      mode: "came_first",
      difficulty: "hard",
    });

    expect(inserts[0]).toMatchObject({
      sport: "knowledge",
      mode: "came_first",
      difficulty: "intermediate",
    });
  });

  it("loads Which Came First questions even when an old hard/easy session exists", async () => {
    const session = {
      _id: "session_1",
      userId: "user_1",
      sport: "knowledge",
      mode: "came_first",
      difficulty: "hard",
      usedChecksums: [],
      completed: false,
      expiresAt: Date.now() + 60_000,
    };
    const queried: Array<Record<string, unknown>> = [];
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => session,
        query: makeQuestionQuery(
          [
            makeQuestion({
              _id: "came_first_1",
              category: "which_came_first",
              difficulty: "intermediate",
              question: "Which came first?",
              options: ["Older", "Newer"],
              correctAnswer: "Older",
              checksum: "knowledge_came_first_v1_001",
            }),
          ],
          queried,
        ),
        patch,
      },
      storage: { getUrl: vi.fn() },
    };

    const result = (await handlerOf(quizSessions.getQuestion)(ctx, {
      sessionId: "session_1",
    })) as Record<string, unknown>;

    expect(queried).toContainEqual({
      sport: "knowledge",
      difficulty: "intermediate",
    });
    expect(result).toMatchObject({
      question: "Which came first?",
      checksum: "knowledge_came_first_v1_001",
      category: "which_came_first",
      imageUrl: null,
    });
    expect(result).not.toHaveProperty("correctAnswer");
    expect(result).not.toHaveProperty("explanation");
    expect(patch).toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({
        currentChecksum: "knowledge_came_first_v1_001",
      }),
    );
  });
});
