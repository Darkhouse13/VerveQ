import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

beforeEach(() => {
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
      participants: 2,
      ranked: 2,
      rows: [
        {
          rank: 1,
          name: "alice",
          total: 16.85,
          scoredSlots: 6,
          awaitingSlots: 7,
          emptySlots: 0,
          tied: false,
          isYou: true,
        },
        {
          rank: 2,
          name: "bob",
          total: 9,
          scoredSlots: 4,
          awaitingSlots: 9,
          emptySlots: 0,
          tied: false,
          isYou: false,
        },
      ],
    },
  };
});

describe("the global weekend leaderboard screen", () => {
  it("renders live provisional standings and identifies the caller", () => {
    render(
      <MemoryRouter>
        <WeekendLeaderboardScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText("Live standings")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("16.9")).toBeInTheDocument();
    expect(screen.getByText(/6\/13 scored/)).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByTestId("weekend-leaderboard")).toBeInTheDocument();
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
