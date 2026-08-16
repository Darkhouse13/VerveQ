/**
 * Weekend Fantasy FW-4 — the crew table's LAST layer: the screen (P6, R7).
 *
 * The pipeline can be perfectly honest and the product still lie, if the screen
 * renders a missing number as 0.0. This suite renders the real CrewScreen against
 * a stubbed query payload and asserts the two things the ruling actually cares
 * about:
 *
 *   R7  a member with nothing scored reads "awaiting data" — and the page
 *       contains no zero anywhere, because an honest zero and a data failure must
 *       never render alike.
 *   R3  a total that can still move is LABELLED provisional.
 *
 * Only convex/react, i18n and the toaster are mocked; the router is real, so the
 * screen mounts through its actual shell chrome.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName } from "convex/server";

const queryMock = vi.hoisted(() => ({
  results: {} as Record<string, unknown>,
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => queryMock.results[getFunctionName(ref as never)],
  useMutation: () => vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: {},
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { api } from "../../convex/_generated/api";
import CrewScreen from "@/pages/shell/weekend/CrewScreen";

const CREW_QUERY = getFunctionName(api.fantasyDraftRooms.getCrew);
const TABLE_QUERY = getFunctionName(api.fantasyScores.getCrewTable);
const DASHBOARD_QUERY = getFunctionName(api.fantasyCrewDashboard.getDashboard);

const CREW = {
  crewId: "crew1",
  code: "CREW01",
  name: "Test Crew",
  createdBy: "u1",
  isMe: "u1",
  members: [
    { userId: "u1", name: "alice", joinedAt: 1 },
    { userId: "u2", name: "bob", joinedAt: 2 },
  ],
  rooms: [
    {
      roomId: "room1",
      status: "completed",
      createdBy: "u1",
      seatCount: 2,
      seated: true,
      completedAt: 10,
      gameweek: { gwNumber: 3, season: "2026-2027", status: "live" },
    },
  ],
};

function tableWith(rows: unknown[]) {
  const normalized = rows as Array<{
    userId: string;
    name: string;
    cumulativePoints: number | null;
    scoredWeekends: number;
    awaitingWeekends: number;
    provisional: boolean;
    rank: number;
    tied: boolean;
  }>;
  const scopeRows = normalized.map((row) => ({
    userId: row.userId,
    isYou: row.userId === "u1",
    name: row.name,
    rank: row.rank,
    tied: row.tied,
    total: row.cumulativePoints,
    appearances: row.scoredWeekends,
    average:
      row.cumulativePoints === null || row.scoredWeekends === 0
        ? null
        : row.cumulativePoints / row.scoredWeekends,
    provisional: row.provisional,
    movement: null,
    weeklyWins: 0,
    podiums: 0,
    bestFinish: null,
    topHalfStreak: 0,
    seasonTitles: 0,
  }));
  const meRow = scopeRows.find((row) => row.isYou) ?? null;
  const scope = {
    rows: scopeRows,
    weeks: [],
    me:
      meRow === null
        ? null
        : {
            rank: meRow.rank,
            total: meRow.total,
            appearances: meRow.appearances,
            average: meRow.average,
            gapAbove: null,
            gapBelow: null,
            movement: null,
          },
  };
  queryMock.results[DASHBOARD_QUERY] = {
    crewId: "crew1",
    code: "CREW01",
    name: "Test Crew",
    currentSeason: "2026-2027",
    seasons: ["2026-2027"],
    season: scope,
    allTime: scope,
    rivalries: [],
    recap: null,
  };
  return {
    crewId: "crew1",
    code: "CREW01",
    name: "Test Crew",
    rows,
    weekends: [
      {
        roomId: "room1",
        gameweekId: "gw3",
        gwNumber: 3,
        season: "2026-2027",
        state: "provisional",
        anyScored: true,
      },
    ],
    tieBreaksApplied: false,
  };
}

function renderCrew() {
  return render(
    <MemoryRouter initialEntries={["/weekend/crew/CREW01"]}>
      <Routes>
        <Route path="/weekend/crew/:code" element={<CrewScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  queryMock.results = { [CREW_QUERY]: CREW, [TABLE_QUERY]: undefined, [DASHBOARD_QUERY]: undefined };
});

describe("crew table — the screen", () => {
  it("shows a scoreless member as awaiting data and never as a zero", () => {
    queryMock.results[TABLE_QUERY] = tableWith([
      {
        userId: "u1",
        name: "alice",
        cumulativePoints: 16.85,
        scoredWeekends: 1,
        awaitingWeekends: 0,
        provisional: true,
        rank: 1,
        tied: false,
        weekends: [
          {
            roomId: "room1",
            gameweekId: "gw3",
            gwNumber: 3,
            season: "2026-2027",
            points: 16.85,
            state: "provisional",
            scoredSlots: 4,
            awaitingSlots: 9,
            settled: false,
          },
        ],
      },
      {
        userId: "u2",
        name: "bob",
        cumulativePoints: null,
        scoredWeekends: 0,
        awaitingWeekends: 1,
        provisional: true,
        rank: 2,
        tied: false,
        weekends: [
          {
            roomId: "room1",
            gameweekId: "gw3",
            gwNumber: 3,
            season: "2026-2027",
            points: null,
            state: "provisional",
            scoredSlots: 0,
            awaitingSlots: 13,
            settled: false,
          },
        ],
      },
    ]);

    const { container } = renderCrew();

    // alice's real total, rendered through the engine's own 1 dp rule.
    expect(screen.getByText("16.9")).toBeInTheDocument();
    // bob has no total. The word, not a number.
    expect(screen.getAllByText("awaiting data").length).toBeGreaterThan(0);
    // And the page carries no zero at all — not "0", not "0.0". This is the
    // assertion that would have failed on `points ?? 0`.
    expect(container.textContent).not.toMatch(/\b0(\.0)?\b/);
    // The provisional label is present (R3).
    expect(screen.getAllByText("provisional").length).toBeGreaterThan(0);
    // The old placeholder is gone.
    expect(container.textContent).not.toMatch(/awaits scoring pipeline/);
  });

  it("labels a settled weekend without the provisional caveat", () => {
    queryMock.results[TABLE_QUERY] = tableWith([
      {
        userId: "u1",
        name: "alice",
        cumulativePoints: 41.5,
        scoredWeekends: 1,
        awaitingWeekends: 0,
        provisional: false,
        rank: 1,
        tied: false,
        weekends: [
          {
            roomId: "room1",
            gameweekId: "gw3",
            gwNumber: 3,
            season: "2026-2027",
            points: 41.5,
            state: "final",
            scoredSlots: 13,
            awaitingSlots: 0,
            settled: true,
          },
        ],
      },
    ]);

    const { container } = renderCrew();
    expect(screen.getByText("41.5")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/provisional/);
  });

  it("shows a tie as tied rather than inventing an order", () => {
    const tiedRow = (userId: string, name: string) => ({
      userId,
      name,
      cumulativePoints: 30,
      scoredWeekends: 1,
      awaitingWeekends: 0,
      provisional: false,
      rank: 1,
      tied: true,
      weekends: [],
    });
    queryMock.results[TABLE_QUERY] = tableWith([tiedRow("u1", "alice"), tiedRow("u2", "bob")]);

    renderCrew();
    // Both rows carry the same shared rank, marked as a tie (DRAFT_ROOM_SPEC
    // v1.2.0 rules the ladders and defers them).
    expect(screen.getAllByText("T1")).toHaveLength(2);
  });

  it("reads 'no drafts yet' for a member with no drafted weekend — never 'awaiting data' (P2 copy law)", () => {
    // FW-RECEIPT P2: "awaiting data" is reserved for drafted weekends whose
    // fixtures are unscored. A member with zero entries has nothing to await.
    queryMock.results[TABLE_QUERY] = tableWith([
      {
        userId: "u1",
        name: "alice",
        cumulativePoints: null,
        scoredWeekends: 0,
        awaitingWeekends: 0,
        provisional: false,
        rank: 1,
        tied: false,
        weekends: [],
      },
      {
        userId: "u2",
        name: "bob",
        cumulativePoints: null,
        scoredWeekends: 0,
        awaitingWeekends: 1,
        provisional: true,
        rank: 1,
        tied: false,
        weekends: [
          {
            roomId: "room1",
            gameweekId: "gw3",
            gwNumber: 3,
            season: "2026-2027",
            points: null,
            state: "provisional",
            scoredSlots: 0,
            awaitingSlots: 13,
            settled: false,
          },
        ],
      },
    ]);

    const { container } = renderCrew();
    // alice never drafted: the standings column says so in draft language.
    expect(screen.getByText("no drafts yet")).toBeInTheDocument();
    // bob drafted and awaits scores: the scoring word stays his.
    expect(screen.getAllByText("awaiting data")).toHaveLength(1);
    // And still no invented zero anywhere.
    expect(container.textContent).not.toMatch(/\b0(\.0)?\b/);
  });

  it("says so plainly when there is nothing to stand yet", () => {
    queryMock.results[TABLE_QUERY] = tableWith([]);
    const { container } = renderCrew();
    expect(container.textContent).toMatch(/Standings appear once a weekend/);
  });
});
