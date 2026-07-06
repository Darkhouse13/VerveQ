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
import * as blitz from "../../convex/blitz";
import * as dailyChallenge from "../../convex/dailyChallenge";

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
  imageId?: string;
  imageUrl?: string;
  questionKind?: "mcq" | "which_came_first" | "logo_text";
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
        const filtered = () =>
          questions.filter((question) =>
            Object.entries(filters).every(
              ([field, value]) => question[field as keyof QuestionRow] === value,
            ),
          );
        return {
          collect: async () => filtered(),
          first: async () => filtered()[0] ?? null,
          take: async (limit: number) => filtered().slice(0, limit),
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
      usedChecksums: [] as string[],
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

  it("filters arena-only logo and Which Came First rows out of Knowledge quiz selection", async () => {
    const session = {
      _id: "session_1",
      userId: "user_1",
      sport: "knowledge",
      mode: "quiz",
      difficulty: "intermediate",
      usedChecksums: [] as string[],
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
              _id: "logo_1",
              category: "enterprise_logos",
              question: "Name this company logo.",
              options: [],
              correctAnswer: "Apple",
              checksum: "challenge_arena_enterprise_logos_v1_001",
              imageUrl: "/arena-logos/opaque/apple.svg",
              questionKind: "logo_text",
            }),
            makeQuestion({
              _id: "came_first_1",
              category: "which_came_first",
              question: "Which came first?",
              options: ["Older", "Newer"],
              correctAnswer: "Older",
              checksum: "knowledge_came_first_v1_001",
              questionKind: "which_came_first",
            }),
            makeQuestion({
              _id: "capital_1",
              category: "capital_cities",
              difficulty: "intermediate",
              question: "What is the capital of Morocco?",
              options: ["Rabat", "Casablanca", "Marrakesh", "Fes"],
              correctAnswer: "Rabat",
              checksum: "knowledge_capital_cities_v1_001",
            }),
            makeQuestion({
              _id: "science_1",
              category: "science",
              difficulty: "intermediate",
              question: "What force keeps planets in orbit?",
              options: ["Gravity", "Friction", "Magnetism", "Buoyancy"],
              correctAnswer: "Gravity",
              checksum: "knowledge_science_v1_001",
            }),
          ],
          queried,
        ),
        patch,
      },
      storage: { getUrl: vi.fn() },
    };

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const capitalResult = (await handlerOf(quizSessions.getQuestion)(ctx, {
        sessionId: "session_1",
      })) as Record<string, unknown>;

      expect(capitalResult).toMatchObject({
        checksum: "knowledge_capital_cities_v1_001",
        category: "capital_cities",
      });
      expect(capitalResult.options).toHaveLength(4);

      session.usedChecksums = ["knowledge_capital_cities_v1_001"];
      const scienceResult = (await handlerOf(quizSessions.getQuestion)(ctx, {
        sessionId: "session_1",
      })) as Record<string, unknown>;

      expect(scienceResult).toMatchObject({
        checksum: "knowledge_science_v1_001",
        category: "science",
      });
      expect(scienceResult.options).toHaveLength(4);
    } finally {
      randomSpy.mockRestore();
    }

    expect(patch).not.toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({
        currentChecksum: "challenge_arena_enterprise_logos_v1_001",
      }),
    );
    expect(patch).not.toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({
        currentChecksum: "knowledge_came_first_v1_001",
      }),
    );
  });

  it("fails closed instead of returning empty-option logo_text questions to the MCQ UI", async () => {
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
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => session,
        query: makeQuestionQuery(
          [
            makeQuestion({
              _id: "logo_1",
              category: "enterprise_logos",
              question: "Name this company logo.",
              options: [],
              correctAnswer: "Apple",
              checksum: "challenge_arena_enterprise_logos_v1_001",
              imageUrl: "/arena-logos/opaque/apple.svg",
              questionKind: "logo_text",
            }),
            makeQuestion({
              _id: "empty_1",
              category: "science",
              question: "What is empty?",
              options: [],
              correctAnswer: "Nothing",
              checksum: "knowledge_bad_empty_options_v1_001",
              questionKind: "mcq",
            }),
          ],
          [],
        ),
        patch,
      },
      storage: { getUrl: vi.fn() },
    };

    await expect(
      handlerOf(quizSessions.getQuestion)(ctx, { sessionId: "session_1" }),
    ).rejects.toThrow("No questions available");
    expect(patch).not.toHaveBeenCalled();
  });

  it("serves pre-planned sessions by checksum in plan order", async () => {
    const session = {
      _id: "session_1",
      userId: "user_1",
      sport: "knowledge",
      mode: "quiz",
      difficulty: "easy",
      plannedChecksums: ["knowledge_v1_planned_b", "knowledge_v1_planned_a"],
      usedChecksums: ["knowledge_v1_planned_b"] as string[],
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
            makeQuestion({ checksum: "knowledge_v1_planned_a" }),
            makeQuestion({ _id: "question_2", checksum: "knowledge_v1_planned_b" }),
            makeQuestion({ _id: "question_3", checksum: "knowledge_v1_unplanned" }),
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

    // The next unused planned question is served via a checksum lookup — the
    // handler never re-collects the sport+difficulty slice.
    expect(result.checksum).toBe("knowledge_v1_planned_a");
    expect(queried).toContainEqual({ checksum: "knowledge_v1_planned_a" });
    expect(queried).not.toContainEqual({
      sport: "knowledge",
      difficulty: "easy",
    });
  });

  it("normalizes Which Came First sessions to the seeded intermediate pool", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const queried: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        get: async () => ({
          _id: "user_1",
          username: "user_1",
          isGuest: false,
          isAnonymous: false,
        }),
        // createSession now plans the question sequence up front, so it
        // queries the pool; an empty pool still creates the session.
        query: makeQuestionQuery([], queried),
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

describe("Knowledge blitz and daily quiz MCQ eligibility", () => {
  function makeIntermediateKnowledgePool() {
    const standardMcqs = Array.from({ length: 10 }, (_, index) =>
      makeQuestion({
        _id: `mcq_${index}`,
        category: index % 2 === 0 ? "capital_cities" : "science",
        difficulty: "intermediate",
        question: `Standard MCQ ${index}?`,
        options: ["Correct", "Wrong A", "Wrong B", "Wrong C"],
        correctAnswer: "Correct",
        checksum: `knowledge_standard_mcq_${index}`,
      }),
    );

    return [
      makeQuestion({
        _id: "logo_1",
        category: "enterprise_logos",
        difficulty: "intermediate",
        question: "Name this company logo.",
        options: [],
        correctAnswer: "Apple",
        checksum: "challenge_arena_enterprise_logos_v1_001",
        imageUrl: "/arena-logos/opaque/apple.svg",
        questionKind: "logo_text",
      }),
      makeQuestion({
        _id: "came_first_1",
        category: "which_came_first",
        difficulty: "intermediate",
        question: "Which came first?",
        options: ["Older", "Newer"],
        correctAnswer: "Older",
        checksum: "knowledge_came_first_v1_001",
        questionKind: "which_came_first",
      }),
      ...standardMcqs,
    ];
  }

  it("filters arena-only Knowledge rows out of blitz questions", async () => {
    const session = {
      _id: "session_1",
      userId: "user_1",
      sport: "knowledge",
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      usedChecksums: [] as string[],
      gameOver: false,
      startedAt: Date.now(),
      endTimeMs: Date.now() + 60_000,
    };
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => session,
        query: makeQuestionQuery(makeIntermediateKnowledgePool(), []),
        patch,
      },
      storage: { getUrl: vi.fn() },
    };

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const result = (await handlerOf(blitz.getQuestion)(ctx, {
        sessionId: "session_1",
      })) as Record<string, unknown>;

      expect(result.checksum).toBe("knowledge_standard_mcq_0");
      expect(result.options).toHaveLength(4);
      expect(result.checksum).not.toBe("challenge_arena_enterprise_logos_v1_001");
      expect(result.checksum).not.toBe("knowledge_came_first_v1_001");
    } finally {
      randomSpy.mockRestore();
    }

    expect(patch).toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({
        currentChecksum: "knowledge_standard_mcq_0",
      }),
    );
  });

  it("filters arena-only Knowledge rows out of daily quiz challenge creation", async () => {
    const challenges: Array<Record<string, unknown>> = [];
    const inserted = vi.fn();
    const deleted = vi.fn();
    const quizQuestions = makeQuestionQuery(makeIntermediateKnowledgePool(), []);
    const ctx = {
      db: {
        get: async (id: string) =>
          challenges.find((challenge) => challenge._id === id) ?? null,
        insert: async (_table: string, doc: Record<string, unknown>) => {
          const challenge = { _id: "challenge_1", ...doc };
          challenges.push(challenge);
          inserted(challenge);
          return "challenge_1";
        },
        delete: deleted,
        query: (table: string) => {
          if (table === "quizQuestions") return quizQuestions(table);
          if (table !== "dailyChallenges") {
            throw new Error(`Unexpected table query: ${table}`);
          }
          return {
            withIndex: (
              _indexName: string,
              select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
            ) => {
              const filters: Record<string, unknown> = {};
              const builder = {
                eq(field: string, value: unknown) {
                  filters[field] = value;
                  return builder;
                },
              };
              select(builder);
              return {
                collect: async () =>
                  challenges.filter((challenge) =>
                    Object.entries(filters).every(
                      ([field, value]) => challenge[field] === value,
                    ),
                  ),
              };
            },
          };
        },
      },
    };

    const result = (await handlerOf(dailyChallenge.getOrCreateChallenge)(ctx, {
      sport: "knowledge",
      mode: "quiz",
    })) as Record<string, unknown>;

    expect(inserted).toHaveBeenCalledTimes(1);
    expect(deleted).not.toHaveBeenCalled();
    expect(result.questionChecksums).toHaveLength(10);
    expect(result.questionChecksums).not.toContain(
      "challenge_arena_enterprise_logos_v1_001",
    );
    expect(result.questionChecksums).not.toContain("knowledge_came_first_v1_001");
    expect(result.questionChecksums).toEqual(
      expect.arrayContaining([
        "knowledge_standard_mcq_0",
        "knowledge_standard_mcq_1",
      ]),
    );
  });

  it("daily getQuestion fails closed on legacy empty-option logo snapshots", async () => {
    const startedAt = Date.now() - 1_000;
    const attempt = {
      _id: "attempt_1",
      userId: "user_1",
      date: "2026-05-24",
      sport: "knowledge",
      mode: "quiz",
      completed: false,
      forfeited: false,
      startedAt,
      expiresAt: Date.now() + 60_000,
      currentQuestionStartedAt: startedAt,
    };
    const challenge = {
      _id: "challenge_1",
      date: "2026-05-24",
      sport: "knowledge",
      mode: "quiz",
      questionChecksums: ["challenge_arena_enterprise_logos_v1_001"],
      questionSnapshots: [
        {
          checksum: "challenge_arena_enterprise_logos_v1_001",
          question: "Name this company logo.",
          options: [],
          correctAnswer: "Apple",
          category: "enterprise_logos",
        },
      ],
      createdAt: 1,
    };
    const ctx = {
      db: {
        get: async () => attempt,
        query: (table: string) => {
          if (table !== "dailyChallenges") {
            throw new Error(`Unexpected table query: ${table}`);
          }
          return {
            withIndex: () => ({
              collect: async () => [challenge],
            }),
          };
        },
      },
      storage: { getUrl: vi.fn() },
    };

    await expect(
      handlerOf(dailyChallenge.getQuestion)(ctx, {
        attemptId: "attempt_1",
        questionIndex: 0,
      }),
    ).rejects.toThrow("Question is not renderable in MCQ quiz");
  });
});
