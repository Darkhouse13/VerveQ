import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";

const queryMock = vi.hoisted(() => ({ results: {} as Record<string, unknown> }));

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => queryMock.results[getFunctionName(ref as never)],
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: Record<string, unknown>) => {
      let value = String(opts?.defaultValue ?? _key);
      for (const [key, replacement] of Object.entries(opts ?? {})) {
        if (key !== "defaultValue") value = value.replace(`{{${key}}}`, String(replacement));
      }
      return value;
    },
  }),
}));

import { api } from "../../convex/_generated/api";
import WeekendLeaderboardScreen from "@/pages/shell/weekend/WeekendLeaderboardScreen";

const GAMEWEEK_QUERY = getFunctionName(api.fantasyMarket.getOpenGameweek);
const BOARD_QUERY = getFunctionName(api.fantasyScores.getWeekendLeaderboard);
const SEASON_QUERY = getFunctionName(api.fantasyScores.getWeekendSeasonLeaderboard);

beforeEach(() => {
  window.localStorage.clear();
  queryMock.results = {
    [GAMEWEEK_QUERY]: {
      gameweekId: "gw3",
      season: "2026-2027",
      gwNumber: 3,
      status: "live",
      finalityAt: 123,
    },
    [BOARD_QUERY]: {
      gameweekId: "gw3",
      season: "2026-2027",
      gwNumber: 3,
      state: "provisional",
      participants: 7,
      ranked: 6,
      rows: [
        {
          rank: 1,
          name: "bob",
          total: 20,
          scoredSlots: 7,
          awaitingSlots: 6,
          emptySlots: 0,
          tied: false,
          isYou: false,
        },
        {
          rank: 2,
          name: "alice",
          total: 16.85,
          scoredSlots: 6,
          awaitingSlots: 7,
          emptySlots: 0,
          tied: false,
          isYou: true,
        },
        { rank: 3, name: "cara", total: 12, scoredSlots: 5, awaitingSlots: 8, emptySlots: 0, tied: false, isYou: false },
        { rank: 4, name: "dan", total: 9, scoredSlots: 5, awaitingSlots: 8, emptySlots: 0, tied: false, isYou: false },
        { rank: 5, name: "eve", total: 7, scoredSlots: 4, awaitingSlots: 9, emptySlots: 0, tied: false, isYou: false },
        { rank: 6, name: "fox", total: 4, scoredSlots: 3, awaitingSlots: 10, emptySlots: 0, tied: false, isYou: false },
      ],
    },
    [SEASON_QUERY]: {
      season: "2026-2027",
      state: "provisional",
      participants: 3,
      ranked: 3,
      rows: [
        { rank: 1, name: "alice", total: 40, playedWeekends: 2, provisional: true, tied: false, isYou: true },
        { rank: 2, name: "bob", total: 35, playedWeekends: 2, provisional: true, tied: false, isYou: false },
        { rank: 3, name: "cara", total: 14, playedWeekends: 1, provisional: false, tied: false, isYou: false },
      ],
      weeks: [
        {
          gwNumber: 2,
          podium: [
            { rank: 1, name: "alice", total: 30 },
            { rank: 2, name: "bob", total: 20 },
          ],
          mostImproved: { name: "alice", places: 3 },
        },
      ],
      me: {
        rank: 1,
        total: 40,
        playedWeekends: 2,
        bestRank: 1,
        topHalfStreak: 2,
        topTenPercentFinishes: 1,
        changeFromPrevious: 3,
        history: [
          { gwNumber: 2, total: 30, rank: 1, population: 3, percentile: 34 },
          { gwNumber: 1, total: 10, rank: 4, population: 10, percentile: 40 },
        ],
      },
    },
  };
});

describe("the global weekend leaderboard screen", () => {
  it("renders live provisional standings and identifies the caller", () => {
    window.localStorage.setItem("verveq:weekend-rank:gw3", "5");
    render(
      <MemoryRouter>
        <WeekendLeaderboardScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText("Live standings")).toBeInTheDocument();
    expect(screen.getByTestId("weekend-your-race")).toHaveTextContent("#2");
    expect(screen.getByTestId("weekend-your-race")).toHaveTextContent("Top 34%");
    expect(screen.getByTestId("weekend-your-race")).toHaveTextContent("3.1 pts to #1");
    expect(screen.getByTestId("weekend-your-race")).toHaveTextContent("6/13 scored");
    expect(screen.getByTestId("weekend-around-you")).toBeInTheDocument();
    expect(screen.getByTestId("weekend-rank-movement")).toHaveTextContent(
      "You climbed 3 places",
    );
    expect(screen.getAllByText("alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("You").length).toBeGreaterThan(0);
    expect(screen.getByTestId("weekend-leaderboard")).toBeInTheDocument();
  });

  it("switches to cumulative standings, personal history, and weekly awards", () => {
    render(
      <MemoryRouter>
        <WeekendLeaderboardScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Season" }));

    expect(screen.getByTestId("weekend-season-summary")).toHaveTextContent("Best #1");
    expect(screen.getByTestId("weekend-season-summary")).toHaveTextContent("Top-half streak 2");
    expect(screen.getByTestId("weekend-season-summary")).toHaveTextContent("Top 10% ×1");
    expect(screen.getByTestId("weekend-season-summary")).toHaveTextContent("+3 places");
    expect(screen.getByTestId("weekend-season-leaderboard")).toBeInTheDocument();
    expect(screen.getByTestId("weekend-history")).toHaveTextContent("GW 2");
    expect(screen.getByTestId("weekend-podium-archive")).toHaveTextContent(
      "Most improved: alice +3",
    );
  });

  it("does not invent zero-point rows before any score has landed", () => {
    queryMock.results[BOARD_QUERY] = {
      ...(queryMock.results[BOARD_QUERY] as Record<string, unknown>),
      ranked: 0,
      rows: [],
    };

    render(
      <MemoryRouter>
        <WeekendLeaderboardScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText("Waiting for the first points")).toBeInTheDocument();
    expect(screen.getByTestId("weekend-leaderboard-empty")).toBeInTheDocument();
  });
});
