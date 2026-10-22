/**
 * The solo modes' endings on the shared ResultScreen (VerveQ ONE P3.1): Quiz,
 * Survival, the Daily Quiz, Daily Survival and Blitz used to leave the shell
 * for the v1 /results, /daily-results and /blitz-results pages. Each now ends
 * in place, the same way: exactly one primary (Share), a Next-today card, and
 * — where the mode can be replayed — Play again as a secondary.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { readFileSync } from "node:fs";
// The screens read real copy: initialize i18next (no primitive does it as a side effect).
import "@/i18n";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { nextTodayFrom } from "@/components/shell/play/result/nextToday";
import { answerState } from "@/components/shell/play/answerState";

const backend = vi.hoisted(() => ({ queries: {} as Record<string, unknown> }));
const analytics = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown, args: unknown) =>
    args === "skip" ? undefined : backend.queries[getFunctionName(ref as never)],
  useMutation: () => async () => ({ newlyUnlocked: [] }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ accountState: "fullAccount", hasUsername: true }),
  AuthError: class extends Error {},
}));
vi.mock("@/lib/analytics", () => analytics);

import {
  BlitzResult,
  DailyQuizResult,
  DailySurvivalResult,
  QuizResult,
  SurvivalResult,
} from "@/components/shell/play/result/ModeResults";

const rows = [true, false, true, true, false, true, true, true, false, true].map((correct, i) => ({
  correct,
  timeTaken: 2 + i * 0.5,
  score: correct ? 80 : 0,
}));
const rating = { eloChange: 12.4, newElo: 1512.2, kFactor: 40, kFactorLabel: "Placement Match" };

type Case = {
  name: string;
  testId: string;
  replayable: boolean;
  shareRef: string;
  render: (onPlayAgain: () => void) => JSX.Element;
};

const CASES: Case[] = [
  {
    name: "Quiz",
    testId: "quiz-result",
    replayable: true,
    shareRef: "ref=quiz_share",
    render: (onPlayAgain) => (
      <QuizResult
        result={{ score: 560, correctCount: 7, total: 10, avgTime: 4.2, sport: "football", isCameFirst: false, breakdown: rows, ...rating }}
        onPlayAgain={onPlayAgain}
        onExit={() => {}}
      />
    ),
  },
  {
    name: "Survival",
    testId: "survival-result",
    replayable: true,
    shareRef: "ref=survival_share",
    render: (onPlayAgain) => (
      <SurvivalResult
        result={{ score: 900, rounds: 6, correctCount: 5, sport: "football", ...rating }}
        onPlayAgain={onPlayAgain}
        onExit={() => {}}
      />
    ),
  },
  {
    name: "Daily Quiz",
    testId: "daily-quiz-result",
    replayable: false,
    shareRef: "ref=daily_share",
    render: () => (
      <DailyQuizResult
        result={{ score: 560, correctCount: 7, total: 10, sport: "football", breakdown: rows }}
        onExit={() => {}}
      />
    ),
  },
  {
    name: "Daily Survival",
    testId: "daily-survival-result",
    replayable: false,
    shareRef: "ref=daily_share",
    render: () => (
      <DailySurvivalResult result={{ score: 700, rounds: 10, correctCount: 6, shareString: "🟩🟨🟥⬜" }} onExit={() => {}} />
    ),
  },
  {
    name: "Blitz",
    testId: "blitz-result",
    replayable: true,
    shareRef: "ref=blitz_share",
    render: (onPlayAgain) => (
      <BlitzResult
        result={{ score: 1100, correctCount: 11, wrongCount: 2, sport: "football" }}
        onPlayAgain={onPlayAgain}
        onExit={() => {}}
      />
    ),
  },
];

let writeText: Mock<(text: string) => Promise<void>>;
beforeEach(() => {
  backend.queries = {};
  analytics.track.mockClear();
  writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
});
afterEach(cleanup);

describe.each(CASES)("$name result screen", (c) => {
  function setup() {
    const onPlayAgain = vi.fn();
    render(<MemoryRouter>{c.render(onPlayAgain)}</MemoryRouter>);
    return { onPlayAgain, result: screen.getByTestId(c.testId) };
  }

  it("renders inside the shell's StageFrame, on the mode accent", () => {
    setup();
    expect(screen.getByTestId("stage-exit")).toBeInTheDocument();
    expect(document.querySelector("[data-mode]")).not.toBeNull();
  });

  it("has exactly one primary button — Share — and no other lime", () => {
    const { result } = setup();
    const primaries = result.querySelectorAll("button.bg-primary");
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toHaveAttribute("data-testid", "result-share");
    expect(result.querySelectorAll(".bg-accent, .bg-action, .bg-lime")).toHaveLength(0);
  });

  it("shares a result line with the mode's tracked link", async () => {
    setup();
    fireEvent.click(screen.getByTestId("result-share"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain(c.shareRef);
    expect(analytics.track).toHaveBeenCalledWith("result_share_pressed", expect.any(Object));
    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith("result_share_sent", expect.objectContaining({ method: "clipboard" })),
    );
  });

  it("offers a next game", () => {
    setup();
    expect(screen.getByTestId("result-next-today")).toHaveAttribute("href");
  });

  it(c.replayable ? "offers Play again as a secondary" : "has no Play again (one attempt a day)", () => {
    const { onPlayAgain } = setup();
    const again = screen.queryByTestId("result-play-again");
    if (!c.replayable) {
      expect(again).toBeNull();
      return;
    }
    expect(again).not.toHaveClass("bg-primary");
    fireEvent.click(again!);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it("folds the run's details away", () => {
    setup();
    expect(screen.getByTestId("result-details").tagName).toBe("DETAILS");
  });
});

describe("result status lines", () => {
  it("states a ranked run's rating change in plain words", () => {
    render(<MemoryRouter>{CASES[0].render(() => {})}</MemoryRouter>);
    expect(screen.getByTestId("result-rating")).toHaveTextContent("Rating +12");
  });

  it("gives the dailies the countdown to the next edition", () => {
    render(<MemoryRouter>{CASES[2].render(() => {})}</MemoryRouter>);
    expect(screen.getByTestId("next-daily-countdown")).toHaveTextContent(/Next daily in \d+:\d\d:\d\d/);
  });

  it("titles Daily Survival as Daily Survival, not the quiz's heading", () => {
    render(<MemoryRouter>{CASES[3].render(() => {})}</MemoryRouter>);
    expect(screen.getByTestId("daily-survival-result")).not.toHaveTextContent(/Daily Challenge Complete/i);
    expect(screen.getByTestId("daily-survival-result")).toHaveTextContent(/Daily Survival/);
  });
});

describe("Next today across the four dailies", () => {
  it("walks Home's Today row from the daily just played", () => {
    expect(nextTodayFrom("quiz", { survival: false })).toEqual({ kind: "game", game: "survival", route: "/v2/daily-survival" });
    expect(nextTodayFrom("survival", { older: true, letters: false })).toMatchObject({ kind: "game", game: "letters" });
    expect(nextTodayFrom("quiz", { survival: true, older: true, letters: true })).toEqual({
      kind: "home",
      route: SHELL_ROUTES.home,
    });
  });

  it("points the solo modes at the first unfinished daily", () => {
    expect(nextTodayFrom(null, { older: true, letters: true, quiz: false, survival: false })).toEqual({
      kind: "game",
      game: "quiz",
      route: SHELL_ROUTES.dailyPlay,
    });
  });

  it("does not skip a daily whose state is still loading", () => {
    expect(nextTodayFrom("quiz", { survival: undefined })).toMatchObject({ game: "survival" });
  });

  it("links the Daily Quiz result to Daily Survival when it is unplayed", () => {
    backend.queries = {
      "dailyChallenge:getAttemptStatus": null,
      "whosOlder:getToday": { daily: null },
      "missingLetters:getToday": { daily: null },
    };
    render(<MemoryRouter>{CASES[2].render(() => {})}</MemoryRouter>);
    expect(screen.getByTestId("result-next-today")).toHaveAttribute("href", "/v2/daily-survival");
  });
});

describe("in-play verdict pattern (source contracts)", () => {
  it("MCQ options: pending while grading, then the right answer green and a wrong pick red", () => {
    const view = { selected: 2, revealed: false, correctIdx: -1 };
    expect([0, 1, 2, 3].map((i) => answerState(i, view))).toEqual(["idle", "idle", "pending", "idle"]);
    const wrong = { selected: 2, revealed: true, correctIdx: 0 };
    expect([0, 1, 2, 3].map((i) => answerState(i, wrong))).toEqual(["right", "dim", "wrong", "dim"]);
    const right = { selected: 1, revealed: true, correctIdx: 1 };
    expect([0, 1, 2, 3].map((i) => answerState(i, right))).toEqual(["dim", "right", "dim", "dim"]);
  });

  it("Survival puts every verdict in one slot — no banner, no verdict toasts — and keeps lime for Submit", () => {
    const source = readFileSync("src/pages/shell/play/SurvivalPlayScreen.tsx", "utf8");
    expect(source).toContain("<SurvivalVerdict verdict={verdict} />");
    expect(source).toMatch(/<VerdictSlot[^>]*testId="survival-verdict"/);
    expect(source).not.toContain("setFeedback");
    for (const key of ["surnameAccepted", "typoAccepted", "hiddenAnswerFound", "plusOneLife", "closeCheckSpelling"]) {
      expect(source, key).not.toMatch(new RegExp(`notify\\.\\w+\\(\\s*t\\("survival\\.${key}`));
    }
    // Cash out is a secondary; no lime fills on the initials or letters.
    expect(source).toMatch(/variant="secondary"[\s\S]{0,200}setConfirmCashOut\(true\)/);
    expect(source).not.toContain('variant="accent"');
    expect(source).not.toContain("bg-primary");
  });

  it("Blitz runs one countdown — the shared StageTimer, no second timer bar", () => {
    const source = readFileSync("src/pages/shell/play/BlitzPlayScreen.tsx", "utf8");
    const clock = readFileSync("src/components/BlitzClock.tsx", "utf8");
    expect(source).toContain("<BlitzClock");
    expect(clock).toContain("<StageTimer");
    expect(source).not.toContain("timeFraction");
    expect(source).not.toContain("AmbientStrip");
  });

  it("no mode navigates to a retired v1 result page", () => {
    for (const file of [
      "src/hooks/useSoloQuiz.ts",
      "src/hooks/useDailyQuiz.ts",
      "src/hooks/useSoloBlitz.ts",
      "src/pages/shell/play/SurvivalPlayScreen.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/navigate\("\/(results|daily-results|blitz-results)"/);
    }
  });
});
