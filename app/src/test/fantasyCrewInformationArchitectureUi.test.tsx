import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName } from "convex/server";

const queryMock = vi.hoisted(() => ({ results: {} as Record<string, unknown> }));

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => queryMock.results[getFunctionName(ref as never)],
  useMutation: () => vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from "../../convex/_generated/api";
import CrewCommandScreen from "@/pages/shell/weekend/CrewCommandScreen";

const CREW_QUERY = getFunctionName(api.fantasyDraftRooms.getCrew);
const ALERTS_QUERY = getFunctionName(api.fantasyDraftRooms.getCrewAlerts);

const creatorCrew = {
  crewId: "crew1",
  code: "CREW01",
  name: "Simple Crew",
  createdBy: "u1",
  isMe: "u1",
  canDelete: true,
  members: [
    { userId: "u1", name: "alice", joinedAt: 1, isCreator: true },
    { userId: "u2", name: "bob", joinedAt: 2, isCreator: false },
  ],
  rooms: [],
};

function renderCommand() {
  return render(
    <MemoryRouter initialEntries={["/weekend/crew/CREW01/command"]}>
      <Routes>
        <Route path="/weekend/crew/:code/command" element={<CrewCommandScreen />} />
        <Route path="/weekend/crew/:code" element={<div>competition</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  queryMock.results = {
    [CREW_QUERY]: creatorCrew,
    [ALERTS_QUERY]: { unread: 0, alerts: [] },
  };
});

describe("crew information architecture", () => {
  it("keeps creator controls in Crew Command and explains them behind the info icon", () => {
    renderCommand();

    expect(screen.getByText("Open the draft room")).toBeInTheDocument();
    expect(screen.getByText("Invite")).toBeInTheDocument();
    expect(screen.getByText("Members · 2")).toBeInTheDocument();
    expect(screen.queryByText("Trophy cabinet")).not.toBeInTheDocument();
    expect(screen.queryByText("This season")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("How Crew Command works"));
    expect(screen.getByText("How Crew Command works")).toBeInTheDocument();
    expect(screen.getByText(/open the weekly room/)).toBeInTheDocument();
  });

  it("does not expose Crew Command to a regular member", () => {
    queryMock.results[CREW_QUERY] = { ...creatorCrew, isMe: "u2" };
    renderCommand();

    expect(screen.getByText("Creator access only")).toBeInTheDocument();
    expect(screen.queryByText("Open the draft room")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove bob")).not.toBeInTheDocument();
  });
});
