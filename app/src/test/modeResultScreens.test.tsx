/**
 * End-screen contract for the Phase 3 modes (VerveQ ONE P3.2): Career Path
 * (both modes), VerveGrid, Higher or Lower and the Arena final all end on the
 * shared ResultScreen with exactly ONE primary (lime) button — Share — and no
 * other lime on the screen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
// The screens read real copy: initialize i18next (no primitive does it as a side effect).
import "@/i18n";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const summary = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("convex/react", () => ({
  useQuery: () => summary.value,
  useMutation: () => async () => ({}),
}));

import { CareerPathClassicResult, CareerPathLadderResult } from "@/components/shell/play/careerPath/CareerPathParts";
import { GridResult } from "@/components/shell/play/grid/GridResult";
import { HigherLowerResult } from "@/pages/shell/play/HigherLowerPlayScreen";
import { FinalView } from "@/pages/arena/ArenaRoomViews";
import { gridEmojiBoard, buildGridSharePayload, buildHigherLowerSharePayload } from "@/lib/gameShare";

afterEach(cleanup);

function renderIn(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

/** One lime button, and it is the share. */
function expectSinglePrimaryShare(root: HTMLElement, shareTestId: string) {
  const primaries = root.querySelectorAll("button.bg-primary");
  expect(primaries).toHaveLength(1);
  expect(primaries[0]).toHaveAttribute("data-testid", shareTestId);
  expect(root.querySelectorAll(".bg-accent, .bg-action, .bg-lime")).toHaveLength(0);
}

const noop = () => {};

describe("Career Path result screens", () => {
  it("classic: one primary — Share — and the answer revealed with the verdict", () => {
    const onShare = vi.fn();
    renderIn(
      <CareerPathClassicResult correct={false} answerName="Geremi" score={0} onShare={onShare} onNext={noop} onAccount={noop} />,
    );
    const root = screen.getByTestId("career-path-result");
    expectSinglePrimaryShare(root, "career-path-share");
    expect(screen.getByTestId("career-path-verdict")).toHaveAttribute("data-verdict", "wrong");
    expect(root.textContent).toContain("Geremi");
    expect(screen.getByTestId("career-path-next")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("career-path-share"));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("10 Path: one primary — Share — then Play again, answers folded", () => {
    renderIn(
      <CareerPathLadderResult
        results={Array.from({ length: 10 }, (_, i) => ({
          correct: i % 3 !== 0,
          answerName: `Player ${i}`,
          score: 1000,
          resolution: i === 3 ? ("skipped" as const) : ("guessed" as const),
        }))}
        rounds={10}
        totalScore={6000}
        onShare={noop}
        onPlayAgain={noop}
        onChangeMode={noop}
      />,
    );
    const root = screen.getByTestId("career-path-ladder-result");
    expectSinglePrimaryShare(root, "career-path-share");
    expect(screen.getByTestId("career-path-play-again")).toBeInTheDocument();
    expect(screen.getByTestId("career-path-ladder-answers").tagName).toBe("DETAILS");
  });
});

describe("VerveGrid result screen", () => {
  it("one primary — Share — then a new grid and the board review", () => {
    renderIn(
      <GridResult
        allSolved={false}
        correctCount={6}
        totalCells={9}
        points={14}
        cells={[true, false, true, true, true, true, false, true, undefined]}
        onShare={noop}
        onNewGrid={noop}
        onReview={noop}
      />,
    );
    const root = screen.getByTestId("grid-result");
    expectSinglePrimaryShare(root, "grid-share");
    expect(screen.getByTestId("grid-new")).toBeInTheDocument();
    expect(screen.getByTestId("grid-review")).toBeInTheDocument();
  });

  it("shares the board as emoji rows with a link back to the mode", () => {
    expect(gridEmojiBoard([true, false, undefined, true, true, true, false, false, false])).toBe(
      "🟩🟥⬜\n🟩🟩🟩\n🟥🟥🟥",
    );
    expect(buildGridSharePayload("x").url).toMatch(/\/games\/football-grid\/\?ref=grid_share$/);
  });
});

describe("Higher or Lower result screen", () => {
  it("one primary — Share — then Play again", () => {
    renderIn(<HigherLowerResult score={7} poolExhausted={false} onShare={noop} onPlayAgain={noop} />);
    const root = screen.getByTestId("higher-lower-result");
    expectSinglePrimaryShare(root, "higher-lower-share");
    expect(screen.getByTestId("higher-lower-play-again")).toBeInTheDocument();
    expect(buildHigherLowerSharePayload("x").url).toMatch(/\/games\/higher-or-lower\/\?ref=higher_lower_share$/);
  });
});

describe("Arena final", () => {
  const room = {
    arenaId: "a1",
    code: "ABCDEF",
    config: { rounds: 2, perRound: 5 },
    rematchArenaCode: null,
  };
  const player = (id: string, name: string, totalScore: number) => ({
    userId: id,
    nameSnapshot: name,
    team: undefined,
    totalScore,
    questionsAnswered: 10,
    accuracy: 0.6,
    avgCorrectMs: 2400,
    longestStreak: 3,
    left: false,
  });

  it("is a ResultScreen: your score + place, one primary — Share — and the rematch", () => {
    summary.value = {
      arenaId: "a1",
      mode: "ffa",
      totalQuestions: 10,
      isTeamMode: false,
      players: [player("u1", "ana", 900), player("u2", "bo", 700)],
      rankings: {
        players: [
          { rank: 1, userId: "u1", nameSnapshot: "ana", totalScore: 900, left: false },
          { rank: 2, userId: "u2", nameSnapshot: "bo", totalScore: 700, left: false },
        ],
        teams: [],
      },
      superlatives: { fastest: [], sharpshooter: [], hotStreak: [] },
    };
    renderIn(<FinalView room={room as never} userId={"u2" as never} rematching={false} onRematch={noop} />);
    const root = screen.getByTestId("arena-result");
    expectSinglePrimaryShare(root, "arena-share");
    expect(screen.getByTestId("result-score")).toHaveTextContent("700");
    expect(screen.getByTestId("arena-result-rank")).toHaveTextContent("#2 of 2");
    expect(screen.getByTestId("arena-result-winner")).toHaveTextContent("ana wins with 900");
    expect(screen.getByTestId("arena-rematch")).toBeInTheDocument();
    expect(screen.getByTestId("arena-result-standings").tagName).toBe("DETAILS");
  });
});
