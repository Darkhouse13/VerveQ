import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string; name?: string; names?: string }) =>
      options?.defaultValue?.replace("{{name}}", options.name ?? "").replace("{{names}}", options.names ?? "") ?? _key,
  }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { CrewCompetitionPanel } from "@/pages/shell/weekend/CrewCompetitionPanel";
import {
  LobbyView,
  ShortlistPanel,
  type DraftPool,
  type DraftRoom,
} from "@/pages/shell/weekend/DraftRoomScreen";

const baseRoom = {
  roomId: "room1",
  status: "lobby",
  crew: { code: "CREW01", name: "Big Crew" },
  crewMembers: [
    { userId: "u1", name: "alice" },
    { userId: "u2", name: "bob" },
    { userId: "u3", name: "cara" },
  ],
  gameweek: { gwNumber: 4, season: "2026-2027", status: "upcoming" },
  createdBy: "u1",
  scheduledFor: null,
  mySeatIndex: null,
  seats: [
    { userId: "u1", name: "alice", ready: false, bankMs: 390_000, favoriteClubAtArm: null },
    { userId: "u2", name: "bob", ready: false, bankMs: 390_000, favoriteClubAtArm: null },
  ],
  seed: null,
  snakeOrder: null,
  orderRevealedAt: null,
  orderRevealMs: 5_000,
  currentPickIndex: null,
  turnSeatIndex: null,
  turnStartedAt: null,
  turnBankRemainingMs: null,
  totalPicks: 26,
  completedAt: null,
  expiresAt: Date.now() + 3_600_000,
  sheetsMaterializedAt: null,
  stuckAt: null,
  picks: [],
  serverNow: Date.now(),
} as unknown as DraftRoom;

describe("Crew upgrade UI", () => {
  it("lets a large-crew member claim one of the eight weekly seats", () => {
    const onClaim = vi.fn();
    render(<LobbyView room={baseRoom} busy={false} onReady={vi.fn()} onArm={vi.fn()} onClaim={onClaim} />);
    fireEvent.click(screen.getByText("Claim a draft seat"));
    expect(onClaim).toHaveBeenCalledOnce();
    expect(screen.getByText(/13 rounds · 6:30/)).toBeInTheDocument();
  });

  it("gives the host scheduling and seat replacement controls", () => {
    const onSchedule = vi.fn();
    const onReplace = vi.fn();
    const room = { ...baseRoom, mySeatIndex: 0 } as DraftRoom;
    render(
      <LobbyView
        room={room}
        busy={false}
        onReady={vi.fn()}
        onArm={vi.fn()}
        onSchedule={onSchedule}
        onReplace={onReplace}
      />,
    );
    fireEvent.change(screen.getByLabelText("Replace bob"), { target: { value: "u3" } });
    expect(onReplace).toHaveBeenCalledWith("u2", "u3");
    fireEvent.click(screen.getByText("Save"));
    expect(onSchedule).toHaveBeenCalledWith(null);
  });

  it("keeps a private ordered shortlist simple to edit", () => {
    const pool = [
      { playerId: "p1", name: "Alpha", clubId: "a", clubName: "A", position: "MID", price: 10, active: true, pool: "topfive", proxy: 1, hasFixture: true, kickoffAt: Date.now() + 1_000 },
      { playerId: "p2", name: "Beta", clubId: "b", clubName: "B", position: "ATT", price: 9, active: true, pool: "topfive", proxy: 1, hasFixture: true, kickoffAt: Date.now() + 1_000 },
    ] as unknown as DraftPool;
    const onChange = vi.fn();
    render(<ShortlistPanel pool={pool} queuedIds={["p1"]} onChange={onChange} />);
    expect(screen.getByText(/Your order is private/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search to add players…"), { target: { value: "Beta" } });
    fireEvent.click(screen.getByText(/Beta · B/));
    expect(onChange).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("shows the season race, rewards, rivalries, recap and weekly table", () => {
    const row = {
      userId: "u1",
      isYou: true,
      name: "alice",
      rank: 2,
      tied: false,
      total: 42,
      appearances: 2,
      average: 21,
      provisional: false,
      movement: 1,
      weeklyWins: 1,
      podiums: 2,
      bestFinish: 1,
      topHalfStreak: 2,
      seasonTitles: 0,
    };
    const scope = {
      rows: [row],
      weeks: [{ roomId: "r1", gameweekId: "g1", gwNumber: 4, season: "2026-2027", state: "final", rows: [{ userId: "u1", name: "alice", points: 22, rank: 1, tied: false }] }],
      me: { rank: 2, total: 42, appearances: 2, average: 21, gapAbove: 3, gapBelow: 4, movement: 1 },
    };
    const dashboard = {
      crewId: "c1",
      code: "CREW01",
      name: "Big Crew",
      currentSeason: "2026-2027",
      seasons: ["2026-2027"],
      season: scope,
      allTime: scope,
      rivalries: [{ userId: "u2", name: "bob", wins: 3, losses: 1, draws: 0, streak: { result: "win", length: 2 } }],
      recap: { gwNumber: 4, season: "2026-2027", podium: [{ rank: 1, name: "alice", points: 22 }], biggestClimb: { name: "alice", places: 1 }, mvp: { playerName: "Star", ownerName: "alice", points: 8 } },
    };
    render(<CrewCompetitionPanel dashboard={dashboard as never} />);
    expect(screen.getByText("Your crew race")).toBeInTheDocument();
    expect(screen.getByText("Trophy cabinet")).toBeInTheDocument();
    expect(screen.getByText("Your rivalries")).toBeInTheDocument();
    expect(screen.getByText("Weekend wrapped")).toBeInTheDocument();
    expect(screen.getByText("Weekly results")).toBeInTheDocument();
  });
});
