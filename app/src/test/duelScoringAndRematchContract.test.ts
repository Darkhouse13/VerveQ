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
import {
  calculateDuelTimeScore,
  DUEL_GRACE_SEC,
  DUEL_FULL_SCORE_WINDOW_SEC,
  DUEL_MIN_SCORE_RATIO,
} from "../../convex/lib/scoring";

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

describe("duel scoring fairness", () => {
  it("excludes the serve-side dead time (reveal + round-trips) via the grace window", () => {
    // Up to grace + full window of raw elapsed time still earns full points,
    // so the 1000 ceiling is reachable by a fast human, not only by a bot.
    expect(calculateDuelTimeScore(100, 0)).toBe(100);
    expect(calculateDuelTimeScore(100, DUEL_GRACE_SEC)).toBe(100);
    expect(
      calculateDuelTimeScore(100, DUEL_GRACE_SEC + DUEL_FULL_SCORE_WINDOW_SEC),
    ).toBe(100);
  });

  it("decays after the full-score window but never below the floor for a correct answer", () => {
    const justPast = calculateDuelTimeScore(
      100,
      DUEL_GRACE_SEC + DUEL_FULL_SCORE_WINDOW_SEC + 0.1,
    );
    expect(justPast).toBeLessThan(100);
    expect(justPast).toBeGreaterThanOrEqual(95);

    const floor = Math.round(100 * DUEL_MIN_SCORE_RATIO);
    expect(calculateDuelTimeScore(100, 60)).toBe(floor);
    expect(calculateDuelTimeScore(100, 1000)).toBe(floor);

    let prev = Infinity;
    for (let t = 0; t <= 30; t += 0.5) {
      const score = calculateDuelTimeScore(100, t);
      expect(score).toBeLessThanOrEqual(prev);
      expect(score).toBeGreaterThanOrEqual(floor);
      prev = score;
    }
  });

  it("submitAnswer scores with the duel curve: a ~5s round-trip-inclusive answer earns full points", async () => {
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
    const ctx = {
      db: {
        get: async () => duel,
        patch: async () => {},
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
      answer: "Correct Answer",
    })) as { correct: boolean; score: number; timeTaken: number };

    expect(result.correct).toBe(true);
    expect(result.timeTaken).toBe(5);
    expect(result.score).toBe(100);
  });
});

describe("duel invite dedupe and rematch coalescing", () => {
  it("reuses an open duel between the same pair with the same settings instead of stacking invites", () => {
    const source = readFileSync("convex/duels.ts", "utf8");
    expect(source).toContain("findOpenDuelBetween");
    expect(source).toContain("existing: true");
    expect(source).toContain("existing: false");
  });

  it("points the original duel at its rematch so both players land in the same new duel", () => {
    const source = readFileSync("convex/duels.ts", "utf8");
    const schema = readFileSync("convex/schema.ts", "utf8");
    expect(schema).toContain("rematchDuelId");
    expect(source).toContain("rematchDuelId: newDuelId");
    expect(source).toContain("getOpenRematch");
  });

  it("rematch joins the already-open rematch duel without creating a duplicate", async () => {
    authMock.getAuthUserId.mockResolvedValue("challenger");

    const rematchDuel = {
      _id: "duel_2",
      challengerId: "opponent",
      opponentId: "challenger",
      status: "awaiting_opponent",
    };
    const duel = {
      _id: "duel_1",
      challengerId: "challenger",
      opponentId: "opponent",
      rematchDuelId: "duel_2",
      status: "resolved",
    };
    const ctx = {
      db: {
        get: async (id: string) => {
          if (id === "duel_1") return duel;
          if (id === "duel_2") return rematchDuel;
          return null;
        },
        insert: async () => {
          throw new Error("must not create a duplicate rematch");
        },
        patch: async () => {
          throw new Error("must not write when joining an open rematch");
        },
      },
      scheduler: { runAfter: async () => {} },
    };

    const result = (await handlerOf(duels.rematch)(ctx, {
      duelId: "duel_1",
    })) as { duelId: string; linkCode: string | null; existing: boolean };

    expect(result).toMatchObject({
      duelId: "duel_2",
      linkCode: null,
      existing: true,
    });
  });

  it("exposes the open rematch on duel status so finished-duel screens can show it live", async () => {
    authMock.getAuthUserId.mockResolvedValue("challenger");

    const rematchDuel = {
      _id: "duel_2",
      challengerId: "opponent",
      opponentId: "challenger",
      status: "awaiting_opponent",
    };
    const duel = {
      _id: "duel_1",
      challengerId: "challenger",
      opponentId: "opponent",
      rematchDuelId: "duel_2",
      type: "knowledge",
      sport: "knowledge",
      difficulty: "easy",
      mode: "quiz",
      seed: "seed",
      questionChecksums: ["c1"],
      challengerResult: { score: 100, completedAt: 1000, perQuestion: [] },
      opponentResult: { score: 50, completedAt: 1500, perQuestion: [] },
      status: "resolved",
      winnerId: "challenger",
      createdAt: 1,
      expiresAt: 20_000,
    };
    const ctx = {
      db: {
        get: async (id: string) => {
          if (id === "duel_1") return duel;
          if (id === "duel_2") return rematchDuel;
          if (id === "opponent") return { _id: "opponent", username: "opponent" };
          return null;
        },
      },
    };

    const status = (await handlerOf(duels.getDuelStatus)(ctx, {
      duelId: "duel_1",
    })) as { openRematch: { duelId: string; byMe: boolean } | null };

    // The rematch was issued by the opponent, so for this viewer byMe=false —
    // exactly the case the result screen turns into an "Accept rematch" prompt.
    expect(status.openRematch).toEqual({ duelId: "duel_2", byMe: false });
  });
});
