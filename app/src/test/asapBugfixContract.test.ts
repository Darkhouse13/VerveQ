import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "stub_user"),
}));

import * as survivalSessions from "../../convex/survivalSessions";
import * as dailyChallenge from "../../convex/dailyChallenge";

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
    const source = read("src/pages/DailyQuizScreen.tsx");

    expect(source).toContain("lastDailyQuestionKey");
    expect(source).toContain("dailyQuestion.checksum");
    expect(source).toContain("questionNum");
  });

  it("regular and daily quiz submit immediately on option tap with no confirm button", () => {
    const quizSource = read("src/pages/QuizScreen.tsx");
    const dailySource = read("src/pages/DailyQuizScreen.tsx");

    for (const source of [quizSource, dailySource]) {
      expect(source).toContain("const handleOptionClick = (idx: number) => {");
      expect(source).toContain("void handleCheck(idx)");
      expect(source).toContain("onClick={() => handleOptionClick(idx)}");
      expect(source).not.toContain("onClick={() => handleCheck()}");
      expect(source).not.toContain(">Check Answer<");
    }
  });


  it("regular and daily quiz suppress duplicate same-render answer submits on the client", () => {
    const quizSource = read("src/pages/QuizScreen.tsx");
    const dailySource = read("src/pages/DailyQuizScreen.tsx");

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
      survivalInitials: [],
      createdAt: 1,
    };
    const patch = vi.fn();
    const ctx = {
      db: {
        get: async () => attempt,
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
    const source = read("src/pages/VerveGridScreen.tsx");

    expect(source).toContain("GRID_SEARCH_MIN_CHARS = 3");
    expect(source).not.toContain("debouncedQuery.length >= 2");
    expect(source).toContain("Type at least {GRID_SEARCH_MIN_CHARS} characters");
  });

  it("daily quit confirms the promised forfeit mutation before leaving", () => {
    const source = read("src/pages/DailyQuizScreen.tsx");

    expect(source).toContain("onConfirm={async () =>");
    expect(source).toContain("await forfeitMut({ attemptId })");
    expect(source).toContain("setForfeited(true)");
  });

  it("home game cards do not nest real buttons inside clickable cards", () => {
    const source = read("src/pages/HomeScreen.tsx");

    expect(source).not.toContain("<NeoButton variant=\"primary\" size=\"sm\">");
    expect(source).not.toContain("<NeoButton variant=\"accent\" size=\"sm\">");
    expect(source).toContain("<span className=\"neo-border font-heading font-bold uppercase");
  });

  it("VerveGrid treats any answered cell as locked, including wrong guesses", () => {
    const clientSource = read("src/pages/VerveGridScreen.tsx");
    const serverSource = read("convex/verveGrid.ts");

    expect(clientSource).toContain("cells[cellIndex]?.correct !== undefined");
    expect(serverSource).toContain("cell.correct !== undefined");
    expect(serverSource).toContain("Cell already answered");
  });

  it("Who Am I updates the visible score after close-call penalties", () => {
    const source = read("src/pages/WhoAmIScreen.tsx");

    expect(source).toContain("if (res.closeCall)");
    expect(source).toContain("setScore(res.score)");
  });

  it("survival ends cleanly when no next challenge is available after a miss or skip", () => {
    const source = read("convex/survivalSessions.ts");

    expect(source.match(/const isGameOver = newLives <= 0 \|\| !next/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("10-question modes fail fast instead of starting with too few questions", () => {
    const dailySource = read("convex/dailyChallenge.ts");
    const liveMatchSource = read("convex/liveMatches.ts");

    expect(dailySource.match(/selected.length < DAILY_QUIZ_COUNT/g)?.length).toBeGreaterThanOrEqual(2);
    expect(liveMatchSource).toContain("pickedQuestions.length < TOTAL_QUESTIONS");
  });


  it("regular and daily quiz auto-advance two seconds after the tap-submitted reveal", () => {
    const quizSource = read("src/pages/QuizScreen.tsx");
    const dailySource = read("src/pages/DailyQuizScreen.tsx");

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


  it("home Daily Quiz routes to the daily quiz flow instead of regular quiz mode", () => {
    const homeSource = read("src/pages/HomeScreen.tsx");
    const sportSelectSource = read("src/pages/SportSelectScreen.tsx");

    expect(homeSource).toContain('navigate("/sport-select?mode=daily-quiz")');
    expect(sportSelectSource).toContain('mode === "daily-quiz"');
    expect(sportSelectSource).toContain('navigate(`/daily-quiz?sport=${selected}`)');
  });


  it("quiz auto-advance does not expose manual continue or confirm tap targets", () => {
    const quizSource = read("src/pages/QuizScreen.tsx");
    const dailySource = read("src/pages/DailyQuizScreen.tsx");

    for (const source of [quizSource, dailySource]) {
      expect(source).not.toContain("React.PointerEvent<HTMLDivElement>");
      expect(source).not.toContain("continueInFlight");
      expect(source).not.toContain("void handleContinue()");
      expect(source).not.toContain("disabled={selected === null || checking || revealed}");
      expect(source).not.toContain('Next question loading...');
      expect(source).not.toContain(">Check Answer<");
    }
  });

  it("NeoButton defaults to type button so auth and game CTAs do not submit phantom forms", () => {
    const source = read("src/components/neo/NeoButton.tsx");

    expect(source).toContain('type = "button"');
    expect(source).toContain('type={type}');
  });

  it("quiz answer controls fire submission directly on tap with no confirm button", () => {
    const quizSource = read("src/pages/QuizScreen.tsx");
    const dailySource = read("src/pages/DailyQuizScreen.tsx");

    for (const source of [quizSource, dailySource]) {
      expect(source).toContain("handleOptionClick(idx)");
      expect(source).toContain("void handleCheck(idx)");
      expect(source).toContain("disabled={revealed || checking}");
      expect(source).not.toContain("selected === null || checking || revealed");
    }
  });

});


it("Forge lock formats fractional ELO values as whole numbers", () => {
  const source = read("src/pages/ForgeScreen.tsx");

  expect(source).toContain("const displayElo = Math.round(currentElo);");
  expect(source).toContain("{displayElo.toLocaleString()}");
  expect(source).toContain("Math.max(1500 - displayElo, 0).toLocaleString()");
});
