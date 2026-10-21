import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "stub_user"),
}));

import * as survivalSessions from "../../convex/survivalSessions";
import * as dailyChallenge from "../../convex/dailyChallenge";
import * as blitz from "../../convex/blitz";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return registered._handler;
}

const read = (path: string) => readFileSync(path, "utf8");

describe("ASAP bugfix contracts", () => {
  it("daily quiz keeps the revealed check result when submitAnswer updates the attempt timer", () => {
    const source = read("src/hooks/useDailyQuiz.ts");

    expect(source).toContain("lastDailyQuestionKey");
    expect(source).toContain("dailyQuestion.checksum");
    expect(source).toContain("questionNum");
  });

  it("regular and daily quiz submit immediately on option tap with no confirm button", () => {
    const quizSource = read("src/hooks/useSoloQuiz.ts");
    const dailySource = read("src/hooks/useDailyQuiz.ts");
    const viewSource = read("src/components/shell/play/QuizPlayView.tsx");

    for (const source of [quizSource, dailySource]) {
      expect(source).toContain("void handleCheck(idx)");
    }
    expect(viewSource).not.toContain(">Check Answer<");
  });


  it("regular and daily quiz suppress duplicate same-render answer submits on the client", () => {
    const quizSource = read("src/hooks/useSoloQuiz.ts");
    const dailySource = read("src/hooks/useDailyQuiz.ts");

    for (const source of [quizSource, dailySource]) {
      expect(source).toContain("answerSubmitInFlight");
      expect(source).toContain("answerSubmitInFlight.current");
      expect(source).toContain("answerSubmitInFlight.current = true");
      expect(source).toContain("answerSubmitInFlight.current = false");
    }
  });

  it("daily submitAnswer is idempotent for duplicate submissions of an already answered question", async () => {
    const attempt = {
      _id: "attempt_1",
      userId: "stub_user",
      date: "2026-05-18",
      sport: "football",
      mode: "quiz",
      score: 67,
      completed: false,
      forfeited: false,
      results: [{ correct: true, timeTaken: 4, score: 67 }],
      startedAt: Date.now() - 4_000,
      expiresAt: Date.now() + 60_000,
      currentQuestionStartedAt: Date.now() - 500,
    };
    const challenge = {
      _id: "challenge_1",
      date: "2026-05-18",
      sport: "football",
      mode: "quiz",
      questionChecksums: ["checksum_1"],
      questionSnapshots: [{
        checksum: "checksum_1",
        question: "Who won?",
        options: ["A", "B", "C", "D"],
        correctAnswer: "A",
        explanation: "Because A won",
        category: "football",
      }],
      createdAt: 1,
    };
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async (id: string) =>
          id === "stub_user"
            ? { _id: "stub_user", username: "stub_user", isAnonymous: false }
            : attempt,
        patch,
        query: () => ({
          withIndex: () => ({
            collect: async () => [challenge],
          }),
        }),
      },
    };

    const result = (await handlerOf(dailyChallenge.submitAnswer)(ctx, {
      attemptId: "attempt_1",
      answer: "A",
      questionIndex: 0,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: true,
      score: 67,
      totalScore: 67,
      timeTaken: 4,
      correctAnswer: "A",
      explanation: "Because A won",
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it("survival accepts any known player with the shown initials, not only the generated headline answer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T10:00:00.000Z"));
    try {
      const session = {
        _id: "session_1",
        userId: "stub_user",
        sport: "football",
        round: 1,
        score: 0,
        lives: 3,
        usedInitials: ["MK"],
        gameOver: false,
        expiresAt: Date.now() + 60_000,
        currentChallenge: {
          initials: "MK",
          round: 1,
          difficulty: "Easy",
          validPlayers: ["Miroslav Klose"],
          maskedName: "________ _____",
          primaryPlayer: "Miroslav Klose",
        },
        speedStreak: 0,
        lastAnswerAt: 0,
        performanceBonus: 0,
        closeCallRound: 1,
        closeCallCount: 0,
        currentHintStage: 0,
      };
      const patch = vi.fn();
      const ctx = {
        db: {
          get: async () => session,
          patch,
        },
      };

      const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
        sessionId: "session_1",
        guess: "Mark Kerr",
      })) as Record<string, unknown>;

      expect(result).toMatchObject({
        correct: true,
        correctAnswer: "Mark Kerr",
        isHiddenAnswer: true,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("VerveGrid does not search and suggest players after only two letters", () => {
    const source = read("src/hooks/useVerveGrid.ts");

    expect(source).toContain("GRID_SEARCH_MIN_CHARS = 3");
    expect(source).not.toContain("debouncedQuery.length >= 2");
  });

  it("VerveGrid treats any answered cell as locked, including wrong guesses", () => {
    const clientSource = read("src/hooks/useVerveGrid.ts");
    const serverSource = read("convex/verveGrid.ts");

    expect(clientSource).toContain("cells[cellIndex]?.correct !== undefined");
    expect(serverSource).toContain("cell.correct !== undefined");
    expect(serverSource).toContain("Cell already answered");
  });

  it("Career Path updates the visible score after close-call penalties", () => {
    const source = read("src/pages/shell/play/CareerPathClassicGame.tsx");

    expect(source).toContain("if (res.closeCall)");
    expect(source).toContain("setScore(res.score)");
  });

  it("survival ends cleanly when no next challenge is available after a miss or skip", () => {
    const source = read("convex/survivalSessions.ts");

    expect(source.match(/const isGameOver = newLives <= 0 \|\| !next/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("10-question modes fail fast instead of starting with too few questions", () => {
    const dailySource = read("convex/dailyChallenge.ts");

    // Live-match creation (and its fail-fast) was removed with the dormant
    // challenge subsystem; daily remains the guarded 10-question mode here.
    expect(dailySource.match(/selected.length < DAILY_QUIZ_COUNT/g)?.length).toBeGreaterThanOrEqual(2);
  });


  it("regular and daily quiz auto-advance two seconds after the tap-submitted reveal", () => {
    const quizSource = read("src/hooks/useSoloQuiz.ts");
    const dailySource = read("src/hooks/useDailyQuiz.ts");

    for (const source of [quizSource, dailySource]) {
      expect(source).not.toContain("handleRevealedScreenTap");
      expect(source).not.toContain("onPointerDownCapture={handleRevealedScreenTap}");
      expect(source).not.toContain("data-continue-control");
      expect(source).not.toContain(">Continue<");
      expect(source).not.toContain(">Check Answer<");
      expect(source).not.toContain(">Next question loading...<");
      expect(source).toContain("AUTO_ADVANCE_DELAY_MS = 2000");
      expect(source).toContain("autoAdvanceTimeoutRef");
      expect(source).toContain("window.setTimeout(() => {");
      expect(source).toContain("void advanceAfterReveal()");
    }
  });


  it("guest profile creation waits briefly before the first retry to avoid noisy auth propagation console errors", () => {
    const source = read("src/contexts/AuthContext.tsx");

    expect(source).toContain("const delays = [1000, 2000, 4000, 7000]");
    expect(source).not.toContain("const delays = [0,");
  });


  it("quiz auto-advance does not expose manual continue or confirm tap targets", () => {
    const quizSource = read("src/hooks/useSoloQuiz.ts");
    const dailySource = read("src/hooks/useDailyQuiz.ts");
    const viewSource = read("src/components/shell/play/QuizPlayView.tsx");

    for (const source of [quizSource, dailySource, viewSource]) {
      expect(source).not.toContain("React.PointerEvent<HTMLDivElement>");
      expect(source).not.toContain("continueInFlight");
      expect(source).not.toContain("void handleContinue()");
      expect(source).not.toContain("disabled={selected === null || checking || revealed}");
      expect(source).not.toContain('Next question loading...');
      expect(source).not.toContain(">Check Answer<");
    }
  });

  it("NeoButton defaults to type button so auth and game CTAs do not submit phantom forms", () => {
    // NeoButton is an alias over the ui Button since VerveQ ONE P1.3; the
    // default lives there (rendered check: uiButtonContract.test.tsx).
    const source = read("src/components/ui/button.tsx");

    expect(source).toContain('type = "button"');
    expect(source).toContain('type={type}');
  });

  it("quiz answer controls fire submission directly on tap with no confirm button", () => {
    const quizSource = read("src/hooks/useSoloQuiz.ts");
    const dailySource = read("src/hooks/useDailyQuiz.ts");
    const viewSource = read("src/components/shell/play/QuizPlayView.tsx");

    for (const source of [quizSource, dailySource]) {
      expect(source).toContain("void handleCheck(idx)");
    }
    expect(viewSource).toContain("disabled={q.revealed || q.checking}");
    expect(viewSource).not.toContain("selected === null || checking || revealed");
  });

  it("blitz endGame finalizes a run at the buzzer despite minor client/server clock skew", async () => {
    const now = Date.now();
    // The client's countdown fired, but the server clock is still ~1s short of
    // the deadline and the session was never marked gameOver server-side.
    const session = {
      _id: "blitz_1",
      userId: "stub_user",
      sport: "football",
      score: 700,
      correctCount: 7,
      wrongCount: 1,
      usedChecksums: [],
      gameOver: false,
      startedAt: now - 59_000,
      endTimeMs: now + 1_000,
    };
    const user = { _id: "stub_user", isAnonymous: true };
    const patch = vi.fn();
    const insert = vi.fn();
    const ctx = {
      db: {
        get: async (id: string) => (id === "stub_user" ? user : session),
        patch,
        insert,
      },
    };

    const res = (await handlerOf(blitz.endGame)(ctx, {
      sessionId: "blitz_1",
    })) as Record<string, unknown>;

    expect(res).toMatchObject({ score: 700, correctCount: 7, wrongCount: 1 });
    // FR-1B: the run is recorded for an anonymous player too. Persistence and
    // publication are separate — `getHighScores` decides who is LISTED, and
    // gating the insert here would have thrown the score away, leaving a later
    // name claim with nothing to reveal.
    expect(insert).toHaveBeenCalledWith(
      "blitzScores",
      expect.objectContaining({ userId: "stub_user", score: 700 }),
    );
  });

  it("blitz endGame still refuses to bank a run with real time left on the clock", async () => {
    const now = Date.now();
    const session = {
      _id: "blitz_1",
      userId: "stub_user",
      sport: "football",
      score: 300,
      correctCount: 3,
      wrongCount: 0,
      usedChecksums: [],
      gameOver: false,
      startedAt: now,
      endTimeMs: now + 30_000, // 30s left — well beyond the skew grace
    };
    const ctx = {
      db: {
        get: async () => session,
        patch: vi.fn(),
        insert: vi.fn(),
      },
    };

    await expect(
      handlerOf(blitz.endGame)(ctx, { sessionId: "blitz_1" }),
    ).rejects.toThrow(/unfinished/i);
  });

  it("blitz endGame accepts a clock-skew grace window so the buzzer reaches the results screen", () => {
    const source = read("convex/blitz.ts");

    expect(source).toContain("FINALIZE_GRACE_MS");
    expect(source).toContain("now >= session.endTimeMs - FINALIZE_GRACE_MS");
  });

  it("blitz finish retries endGame once before falling back to the home page", () => {
    const source = read("src/hooks/useSoloBlitz.ts");

    // The retry must sit between the first finalize and the home fallback.
    const firstEnd = source.indexOf("await endGameMut({ sessionId: sid })");
    const home = source.indexOf('navigate("/home")');
    expect(firstEnd).toBeGreaterThan(-1);
    expect(home).toBeGreaterThan(firstEnd);
    // Two finalize attempts wrapped in nested try/catch, one delayed retry.
    expect(source.match(/endGameMut\(\{ sessionId: sid \}\)/g)?.length).toBe(2);
    expect(source).toContain("setTimeout(r, 1200)");
  });

  it("blitz reveals the server verdict before flipping `revealed`, so a correct pick never flashes red first", () => {
    const source = read("src/hooks/useSoloBlitz.ts");

    const answerSet = source.indexOf("setRevealedAnswer(res.correctAnswer)");
    const revealSet = source.indexOf("setRevealed(true)");
    expect(answerSet).toBeGreaterThan(-1);
    expect(revealSet).toBeGreaterThan(-1);
    // The correct answer is known BEFORE the reveal flips on.
    expect(answerSet).toBeLessThan(revealSet);
    // A double-tap guard replaces the old "reveal immediately" lock.
    expect(source).toContain("answerSubmitInFlight.current");
    expect(source).toContain("setChecking(true)");
    expect(source).toContain("setChecking(false)");
  });

  it("blitz options show a neutral 'pending' state while checking, never red before grading", () => {
    const v2Source = read("src/pages/shell/play/BlitzPlayScreen.tsx");
    const state = read("src/components/shell/play/answerState.ts");
    const option = read("src/components/shell/play/AnswerOption.tsx");

    // Before the reveal the pick is "pending" — never the wrong state — and
    // pending is flat and uncolored, so it reads as neither a verdict nor a
    // lit button (VerveQ ONE P3.1).
    expect(v2Source).toContain("state={answerState(idx, b)}");
    expect(state).toContain('if (!revealed) return selected === idx ? "pending" : "idle";');
    const pending = option.match(/pending: "([^"]+)"/)?.[1] ?? "";
    expect(pending).toContain("shadow-none");
    expect(pending).not.toMatch(/bg-(primary|action|lime|accent|destructive|verdict)/);
    expect(v2Source).toContain("disabled={b.revealed || b.checking}");
  });

});


it("Forge lock formats fractional ELO values as whole numbers", () => {
  const source = read("src/pages/ForgeScreen.tsx");

  expect(source).toContain("const displayElo = Math.round(currentElo);");
  expect(source).toContain("{displayElo.toLocaleString()}");
  expect(source).toContain("Math.max(1500 - displayElo, 0).toLocaleString()");
});
