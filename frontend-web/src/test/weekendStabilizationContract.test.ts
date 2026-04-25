import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "stub_user"),
  convexAuth: () => ({
    auth: {},
    signIn: () => {},
    signOut: () => {},
    store: {},
    isAuthenticated: () => false,
  }),
}));

import * as blitz from "../../convex/blitz";
import * as liveMatches from "../../convex/liveMatches";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return registered._handler;
}

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("weekend stabilization admin surface", () => {
  it("seed/admin writers are internal Convex functions", () => {
    const seedSportsData = readRepoFile("frontend-web/convex/seedSportsData.ts");
    const seedQuestions = readRepoFile("frontend-web/convex/seedQuestions.ts");
    const seedAchievements = readRepoFile("frontend-web/convex/seedAchievements.ts");

    const publicAdminPatterns = [
      /export const seed[A-Za-z0-9_]* = mutation\(/,
      /export const clear[A-Za-z0-9_]* = mutation\(/,
      /export const store[A-Za-z0-9_]* = mutation\(/,
      /export const fix[A-Za-z0-9_]* = mutation\(/,
      /export const seed[A-Za-z0-9_]* = action\(/,
    ];

    for (const source of [seedSportsData, seedQuestions, seedAchievements]) {
      for (const pattern of publicAdminPatterns) {
        expect(source).not.toMatch(pattern);
      }
    }

    expect(seedSportsData).toContain("internalMutation");
    expect(seedQuestions).toContain("internalMutation");
    expect(seedQuestions).toContain("internalAction");
    expect(seedAchievements).toContain("internalMutation");
  });
});

describe("weekend stabilization live matches", () => {
  const questions = [
    {
      question: "Who won the final?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: "Hidden explanation",
    },
    {
      question: "Who scored first?",
      options: ["W", "X", "Y", "Z"],
      correctAnswer: "Z",
      explanation: "Hidden future explanation",
    },
  ];

  function makeMatch(status: string, currentQuestion = 0) {
    return {
      _id: "match_1",
      player1Id: "stub_user",
      player2Id: "opponent_user",
      sport: "football",
      status,
      currentQuestion,
      totalQuestions: questions.length,
      questions,
      player1Score: 0,
      player2Score: 0,
      player1Ready: true,
      player2Ready: true,
      player1Answers: [],
      player2Answers: [],
      winnerId: undefined,
      questionStartedAt: Date.now(),
      roundResultUntil: undefined,
    };
  }

  function makeCtx(match: Record<string, unknown>) {
    return {
      db: {
        get: async (id: string) => {
          if (id === "match_1") return match;
          if (id === "stub_user") return { username: "p1", displayName: "P1" };
          if (id === "opponent_user") return { username: "p2", displayName: "P2" };
          return null;
        },
      },
    };
  }

  it("does not return question data during waiting states", async () => {
    const result = (await handlerOf(liveMatches.getMatch)(makeCtx(makeMatch("waiting")), {
      matchId: "match_1",
    })) as { questions: unknown[] };

    expect(result.questions).toEqual([null, null]);
  });

  it("sanitizes active and past questions and hides future questions", async () => {
    const result = (await handlerOf(liveMatches.getMatch)(
      makeCtx(makeMatch("question", 1)),
      { matchId: "match_1" },
    )) as { questions: Array<Record<string, unknown> | null> };

    expect(result.questions[0]).toEqual({
      question: "Who won the final?",
      options: ["A", "B", "C", "D"],
    });
    expect(result.questions[1]).toEqual({
      question: "Who scored first?",
      options: ["W", "X", "Y", "Z"],
    });
    for (const question of result.questions.filter(Boolean)) {
      expect(question).not.toHaveProperty("correctAnswer");
      expect(question).not.toHaveProperty("explanation");
    }
  });
});

describe("weekend stabilization blitz", () => {
  const activeSession = {
    _id: "session_1",
    userId: "stub_user",
    sport: "football",
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    usedChecksums: ["checksum_1"],
    currentChecksum: "checksum_1",
    gameOver: false,
    startedAt: Date.now(),
    endTimeMs: Date.now() + 60_000,
  };

  it("refuses to fetch a second question while one is unanswered", async () => {
    const ctx = { db: { get: async () => activeSession } };

    await expect(
      handlerOf(blitz.getQuestion)(ctx, { sessionId: "session_1" }),
    ).rejects.toThrow("Answer the current question before requesting another");
  });

  it("scores only the current checksum and clears it after answer submission", async () => {
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => activeSession,
        patch,
        query: () => ({
          withIndex: () => ({
            first: async () => ({
              checksum: "checksum_1",
              correctAnswer: "A",
              explanation: "revealed after answer",
            }),
          }),
        }),
      },
    };

    const result = (await handlerOf(blitz.submitAnswer)(ctx, {
      sessionId: "session_1",
      answer: "A",
      checksum: "checksum_1",
    })) as { correct: boolean; score: number };

    expect(result.correct).toBe(true);
    expect(result.score).toBe(100);
    expect(patch).toHaveBeenCalledWith(
      "session_1",
      expect.objectContaining({ currentChecksum: undefined, score: 100 }),
    );
  });

  it("rejects replayed or stale checksums", async () => {
    const ctx = { db: { get: async () => ({ ...activeSession, currentChecksum: undefined }) } };

    await expect(
      handlerOf(blitz.submitAnswer)(ctx, {
        sessionId: "session_1",
        answer: "A",
        checksum: "checksum_1",
      }),
    ).rejects.toThrow("No active question for this session");
  });

  it("makes endGame idempotent after the score is saved", async () => {
    const insert = vi.fn();
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => ({ ...activeSession, gameOver: true, scoreSavedAt: Date.now() }),
        insert,
        patch,
      },
    };

    const result = (await handlerOf(blitz.endGame)(ctx, {
      sessionId: "session_1",
    })) as { score: number; correctCount: number; wrongCount: number };

    expect(result).toEqual({ score: 0, correctCount: 0, wrongCount: 0 });
    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});

describe("weekend stabilization deploy assets", () => {
  it("tracks Convex runtime assets required by a clean checkout", () => {
    const requiredFiles = [
      "frontend-web/convex/data/football_player_metadata.json",
      "frontend-web/convex/data/football_survival_index.json",
      "frontend-web/convex/data/nba_player_metadata.json",
      "frontend-web/convex/data/nba_survival_data.json",
      "frontend-web/convex/data/survival_initials_map.json",
      "frontend-web/convex/data/survival_initials_map_tennis.json",
      "frontend-web/convex/data/tennis_player_metadata.json",
      "frontend-web/convex/lib/daily.ts",
      "frontend-web/convex/lib/elo.ts",
      "frontend-web/convex/lib/fuzzy.ts",
      "frontend-web/convex/lib/scoring.ts",
    ];

    const tracked = new Set(
      execFileSync("git", ["ls-files", ...requiredFiles], {
        cwd: repoRoot,
        encoding: "utf8",
      })
        .split(/\r?\n/)
        .filter(Boolean),
    );

    expect([...tracked].sort()).toEqual(requiredFiles.sort());
  });
});
