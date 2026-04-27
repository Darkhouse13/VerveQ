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
import * as dailyChallenge from "../../convex/dailyChallenge";
import * as eloDecay from "../../convex/eloDecay";
import * as liveMatches from "../../convex/liveMatches";
import * as profile from "../../convex/profile";
import * as seasonManager from "../../convex/seasonManager";
import * as users from "../../convex/users";

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

describe("weekend stabilization daily challenge", () => {
  const snapshot = {
    checksum: "checksum_1",
    question: "Snapshot question?",
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    explanation: "Snapshot explanation",
    category: "history",
  };

  function makeDailyQuery(challenges: Array<Record<string, unknown>>) {
    return (table: string) => {
      if (table !== "dailyChallenges") {
        throw new Error(`unexpected table query: ${table}`);
      }
      return {
        withIndex: () => ({
          collect: async () => challenges,
        }),
      };
    };
  }

  it("returns the canonical daily challenge and deletes duplicates", async () => {
    const canonical = {
      _id: "challenge_old",
      date: "2026-04-26",
      sport: "football",
      mode: "quiz",
      questionChecksums: ["checksum_1"],
      questionSnapshots: [snapshot],
      survivalInitials: [],
      createdAt: 1,
    };
    const duplicate = {
      ...canonical,
      _id: "challenge_new",
      createdAt: 2,
    };
    const deleteDoc = vi.fn();
    const insert = vi.fn();
    const ctx = {
      db: {
        query: makeDailyQuery([duplicate, canonical]),
        delete: deleteDoc,
        insert,
      },
    };

    const result = await handlerOf(dailyChallenge.getOrCreateChallenge)(ctx, {
      sport: "football",
      mode: "quiz",
    });

    expect(result).toEqual(canonical);
    expect(deleteDoc).toHaveBeenCalledWith("challenge_new");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects the declared-but-unwired daily survival mode", async () => {
    await expect(
      handlerOf(dailyChallenge.getOrCreateChallenge)({}, {
        sport: "football",
        mode: "survival",
      }),
    ).rejects.toThrow("Daily survival is not implemented yet");
  });

  it("serves daily questions from the frozen challenge snapshot", async () => {
    const startedAt = Date.now() - 4_000;
    const attempt = {
      _id: "attempt_1",
      userId: "stub_user",
      date: "2026-04-26",
      sport: "football",
      mode: "quiz",
      completed: false,
      forfeited: false,
      startedAt,
      expiresAt: Date.now() + 60_000,
      currentQuestionStartedAt: startedAt,
    };
    const challenge = {
      _id: "challenge_1",
      date: "2026-04-26",
      sport: "football",
      mode: "quiz",
      questionChecksums: ["checksum_1"],
      questionSnapshots: [snapshot],
      survivalInitials: [],
      createdAt: 1,
    };
    const ctx = {
      db: {
        get: async () => attempt,
        query: makeDailyQuery([challenge]),
      },
      storage: {
        getUrl: vi.fn(),
      },
    };

    const result = (await handlerOf(dailyChallenge.getQuestion)(ctx, {
      attemptId: "attempt_1",
      questionIndex: 0,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      question: "Snapshot question?",
      options: ["A", "B", "C", "D"],
      checksum: "checksum_1",
      category: "history",
      imageUrl: null,
      questionStartedAt: startedAt,
    });
    expect(result).not.toHaveProperty("correctAnswer");
  });

  it("scores daily answers against the frozen challenge snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T00:00:04.000Z"));
    try {
      const attempt = {
        _id: "attempt_1",
        userId: "stub_user",
        date: "2026-04-26",
        sport: "football",
        mode: "quiz",
        score: 0,
        completed: false,
        forfeited: false,
        results: [],
        startedAt: Date.now() - 4_000,
        expiresAt: Date.now() + 60_000,
        currentQuestionStartedAt: Date.now() - 4_000,
      };
      const challenge = {
        _id: "challenge_1",
        date: "2026-04-26",
        sport: "football",
        mode: "quiz",
        questionChecksums: ["checksum_1"],
        questionSnapshots: [snapshot],
        survivalInitials: [],
        createdAt: 1,
      };
      const patch = vi.fn();
      const ctx = {
        db: {
          get: async () => attempt,
          query: makeDailyQuery([challenge]),
          patch,
        },
      };

      const result = (await handlerOf(dailyChallenge.submitAnswer)(ctx, {
        attemptId: "attempt_1",
        answer: "A",
        questionIndex: 0,
      })) as Record<string, unknown>;

      expect(result).toMatchObject({
        correct: true,
        totalScore: 67,
        correctAnswer: "A",
        explanation: "Snapshot explanation",
        timeTaken: 4,
      });
      expect(patch).toHaveBeenCalledWith(
        "attempt_1",
        expect.objectContaining({
          score: 67,
          results: [{ correct: true, timeTaken: 4, score: 67 }],
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("weekend stabilization profile", () => {
  it("shows the actual ranked ELO after a first-game loss", async () => {
    const ctx = {
      db: {
        get: async () => ({
          _id: "user_1",
          username: "darkhouse13",
          displayName: "DarkHouse13",
          _creationTime: Date.UTC(2026, 3, 1),
        }),
        query: (table: string) => {
          if (table === "userRatings") {
            return {
              withIndex: () => ({
                collect: async () => [
                  {
                    _id: "rating_1",
                    userId: "user_1",
                    sport: "football",
                    mode: "quiz",
                    eloRating: 1188.1,
                    gamesPlayed: 1,
                    wins: 0,
                  },
                ],
              }),
            };
          }
          if (table === "gameSessions") {
            return {
              withIndex: () => ({
                order: () => ({
                  take: async () => [
                    {
                      _id: "game_1",
                      sport: "football",
                      mode: "quiz",
                      score: 377,
                      eloChange: -12,
                      endedAt: Date.UTC(2026, 3, 27),
                      _creationTime: Date.UTC(2026, 3, 27),
                    },
                  ],
                }),
              }),
            };
          }
          throw new Error(`unexpected table query: ${table}`);
        },
      },
    };

    const result = (await handlerOf(profile.get)(ctx, {
      userId: "user_1",
    })) as {
      eloRating: number;
      stats: { totalGames: number; totalWins: number; winRate: number };
      recentGames: Array<{ eloChange?: number }>;
    };

    expect(result.eloRating).toBe(1188);
    expect(result.stats).toMatchObject({
      totalGames: 1,
      totalWins: 0,
      winRate: 0,
    });
    expect(result.recentGames[0].eloChange).toBe(-12);
  });
});

describe("weekend stabilization user profiles", () => {
  it("repairs existing anonymous profiles that already have a username but no isGuest flag", async () => {
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => ({
          _id: "stub_user",
          username: "guest_123",
          isAnonymous: true,
          _creationTime: Date.UTC(2026, 3, 27),
        }),
        query: () => ({
          withIndex: () => ({
            first: async () => null,
          }),
        }),
        patch,
      },
    };

    const result = await handlerOf(users.ensureProfile)(ctx, {
      username: "guest_456",
      displayName: "Guest",
      isGuest: true,
    });

    expect(result).toBe("stub_user");
    expect(patch).toHaveBeenCalledWith("stub_user", {
      displayName: "Guest",
      isGuest: true,
      totalGames: 0,
    });
  });
});

describe("weekend stabilization season and decay jobs", () => {
  const now = new Date("2026-04-26T00:05:00.000Z").getTime();
  const expiredSeason = {
    _id: "season_1",
    seasonNumber: 3,
    startDate: now - 91 * 24 * 60 * 60 * 1000,
    endDate: now - 60_000,
    isActive: true,
  };

  function seasonQuery(activeSeasons: Array<Record<string, unknown>>) {
    return (table: string) => {
      if (table !== "seasons") {
        throw new Error(`unexpected table query: ${table}`);
      }
      return {
        withIndex: () => ({
          collect: async () => activeSeasons,
        }),
        collect: async () => activeSeasons,
      };
    };
  }

  it("checkSeason marks an expired season and schedules reset work once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const patch = vi.fn();
      const runAfter = vi.fn();
      const ctx = {
        db: {
          query: seasonQuery([expiredSeason]),
          patch,
          insert: vi.fn(),
        },
        scheduler: { runAfter },
      };

      const result = await handlerOf(seasonManager.checkSeason)(ctx, {});

      expect(result).toEqual({ status: "reset_scheduled" });
      expect(patch).toHaveBeenCalledWith("season_1", {
        resetStartedAt: now,
      });
      expect(runAfter).toHaveBeenCalledOnce();
      expect(runAfter.mock.calls[0][0]).toBe(0);
      expect(runAfter.mock.calls[0][2]).toEqual({ seasonId: "season_1" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("checkSeason does not double-schedule a fresh in-progress reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const patch = vi.fn();
      const runAfter = vi.fn();
      const ctx = {
        db: {
          query: seasonQuery([
            { ...expiredSeason, resetStartedAt: now - 1_000 },
          ]),
          patch,
          insert: vi.fn(),
        },
        scheduler: { runAfter },
      };

      const result = await handlerOf(seasonManager.checkSeason)(ctx, {});

      expect(result).toEqual({ status: "reset_in_progress" });
      expect(patch).not.toHaveBeenCalled();
      expect(runAfter).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runDecay skips while a season boundary is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const ctx = {
        db: {
          query: (table: string) => {
            if (table === "userRatings") {
              throw new Error("decay should not read ratings during reset");
            }
            return {
              withIndex: () => ({
                collect: async () => [expiredSeason],
              }),
            };
          },
        },
      };

      const result = await handlerOf(eloDecay.runDecay)(ctx, {});

      expect(result).toEqual({ status: "season_reset_pending" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("runSeasonReset still applies rating reset after a partial history insert", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const rating = {
        _id: "rating_1",
        userId: "user_1",
        sport: "football",
        mode: "quiz",
        eloRating: 1900,
        gamesPlayed: 20,
        wins: 12,
      };
      const nextSeason = {
        _id: "season_4",
        seasonNumber: 4,
        startDate: now,
        endDate: now + 90 * 24 * 60 * 60 * 1000,
        isActive: true,
      };
      const patch = vi.fn();
      const insert = vi.fn();
      const ctx = {
        db: {
          get: async () => expiredSeason,
          query: (table: string) => {
            if (table === "userRatings") {
              return { collect: async () => [rating] };
            }
            if (table === "seasonHistory") {
              return {
                withIndex: () => ({
                  first: async () => ({
                    _id: "history_1",
                    finalElo: 1900,
                    tier: "Gold",
                  }),
                }),
              };
            }
            if (table === "seasons") {
              return {
                withIndex: () => ({
                  first: async () => nextSeason,
                }),
              };
            }
            throw new Error(`unexpected table query: ${table}`);
          },
          patch,
          insert,
        },
      };

      const result = await handlerOf(seasonManager.runSeasonReset)(ctx, {
        seasonId: "season_1",
      });

      expect(result).toEqual({ status: "completed", seasonNumber: 3 });
      expect(patch).toHaveBeenCalledWith("rating_1", {
        eloRating: 1550,
        seasonResetAppliedFor: 3,
      });
      expect(insert).toHaveBeenCalledWith(
        "gameSessions",
        expect.objectContaining({
          eloBefore: 1900,
          eloAfter: 1550,
          eloChange: -350,
          sessionType: "seasonReset",
          details: { seasonNumber: 3 },
        }),
      );
      expect(patch).toHaveBeenCalledWith(
        "season_1",
        expect.objectContaining({ isActive: false, resetCompletedAt: now }),
      );
      expect(patch).toHaveBeenCalledWith("season_4", { isActive: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("runSeasonReset does not apply ELO twice once a rating is marked", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const rating = {
        _id: "rating_1",
        userId: "user_1",
        sport: "football",
        mode: "quiz",
        eloRating: 1550,
        seasonResetAppliedFor: 3,
        gamesPlayed: 20,
        wins: 12,
      };
      const nextSeason = {
        _id: "season_4",
        seasonNumber: 4,
        startDate: now,
        endDate: now + 90 * 24 * 60 * 60 * 1000,
        isActive: true,
      };
      const patch = vi.fn();
      const insert = vi.fn();
      const ctx = {
        db: {
          get: async () => expiredSeason,
          query: (table: string) => {
            if (table === "userRatings") {
              return { collect: async () => [rating] };
            }
            if (table === "seasonHistory") {
              return {
                withIndex: () => ({
                  first: async () => ({
                    _id: "history_1",
                    finalElo: 1900,
                    tier: "Gold",
                  }),
                }),
              };
            }
            if (table === "seasons") {
              return {
                withIndex: () => ({
                  first: async () => nextSeason,
                }),
              };
            }
            throw new Error(`unexpected table query: ${table}`);
          },
          patch,
          insert,
        },
      };

      const result = await handlerOf(seasonManager.runSeasonReset)(ctx, {
        seasonId: "season_1",
      });

      expect(result).toEqual({ status: "completed", seasonNumber: 3 });
      expect(insert).not.toHaveBeenCalled();
      expect(patch).not.toHaveBeenCalledWith(
        "rating_1",
        expect.any(Object),
      );
      expect(patch).toHaveBeenCalledWith(
        "season_1",
        expect.objectContaining({ isActive: false, resetCompletedAt: now }),
      );
      expect(patch).toHaveBeenCalledWith("season_4", { isActive: true });
    } finally {
      vi.useRealTimers();
    }
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

  it("does not leak opponent correctness while the question is live", async () => {
    const match = makeMatch("question", 0);
    match.player2Answers = [
      {
        answer: "B",
        correct: false,
        score: 0,
        timeTaken: 1.2,
        answeredAt: Date.now(),
      },
    ];

    const result = (await handlerOf(liveMatches.getMatch)(makeCtx(match), {
      matchId: "match_1",
    })) as { opponentStatus: string; roundAnswers: unknown };

    expect(result.opponentStatus).toBe("lockedIn");
    expect(result.roundAnswers).toBeNull();
  });

  it("reveals sanitized scores for both players during round results", async () => {
    const match = makeMatch("roundResult", 0);
    match.player1Answers = [
      {
        answer: "A",
        correct: true,
        score: 180,
        timeTaken: 2,
        answeredAt: Date.now(),
      },
    ];
    match.player2Answers = [
      {
        answer: "B",
        correct: false,
        score: 0,
        timeTaken: 3,
        answeredAt: Date.now(),
      },
    ];

    const result = (await handlerOf(liveMatches.getMatch)(makeCtx(match), {
      matchId: "match_1",
    })) as { roundAnswers: { player1: Record<string, unknown>; player2: Record<string, unknown> } };

    expect(result.roundAnswers.player1).toEqual({
      correct: true,
      score: 180,
      timeTaken: 2,
    });
    expect(result.roundAnswers.player1).not.toHaveProperty("answer");
    expect(result.roundAnswers.player2).toEqual({
      correct: false,
      score: 0,
      timeTaken: 3,
    });
  });

  it("scores both-correct rounds by answer time, not mutation order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T00:00:02.000Z"));
    try {
      const match = makeMatch("question", 0);
      match.questionStartedAt = Date.now() - 2000;
      match.player2Answers = [
        {
          answer: "A",
          correct: true,
          score: 0,
          timeTaken: 1,
          answeredAt: Date.now() - 1000,
        },
      ];
      const patch = vi.fn();
      const runAfter = vi.fn();
      const ctx = {
        db: {
          get: async () => match,
          patch,
        },
        scheduler: { runAfter },
      };

      const result = (await handlerOf(liveMatches.submitAnswer)(ctx, {
        matchId: "match_1",
        answer: "A",
      })) as { score: number; pendingScore: boolean };

      const patchPayload = patch.mock.calls[0][1];
      expect(patchPayload.player1Answers[0].score).toBe(130);
      expect(patchPayload.player2Answers[0].score).toBe(190);
      expect(patchPayload.player1Score).toBe(130);
      expect(patchPayload.player2Score).toBe(190);
      expect(result).toMatchObject({ score: 130, pendingScore: false });
      expect(runAfter).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores duplicate advance jobs after the match has already left roundResult", async () => {
    const match = makeMatch("question", 0);
    const patch = vi.fn();
    const runAfter = vi.fn();
    const ctx = {
      db: {
        get: async () => match,
        patch,
      },
      scheduler: { runAfter },
    };

    await handlerOf(liveMatches.advanceQuestion)(ctx, { matchId: "match_1" });

    expect(patch).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();
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
