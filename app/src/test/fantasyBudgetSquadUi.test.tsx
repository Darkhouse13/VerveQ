/**
 * Weekend Fantasy FW-LAUNCH O1 — the budget squad screen.
 *
 * Renders the real BudgetSquadScreen against stubbed query payloads and
 * asserts the mission's O1e surface rules:
 *
 *   - awaiting-vs-zero: a slot with no data reads "awaiting data" and never
 *     0.0; the FW-4R "did not appear" honest zero renders AS a zero, with its
 *     reason — the two must never look alike.
 *   - a server rejection (locked slot, budget, cap — the server's wording)
 *     is surfaced to the user as a toast, not swallowed.
 *   - a locked slot offers no edit affordances and carries the Locked badge.
 *   - the budget bar renders the server's breakdown, never a client sum.
 *
 * Only convex/react, i18n and the toaster are mocked; the router is real.
 */

import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName } from "convex/server";

const queryMock = vi.hoisted(() => ({
  results: {} as Record<string, unknown>,
  gate: null as unknown,
  gateRejects: false,
  mutations: {} as Record<string, Mock>,
}));
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("convex/react", () => {
  // A STABLE client object — the screen's gate effect depends on the client's
  // identity (as the real useConvex guarantees); a fresh object per render
  // would re-fire the effect forever.
  const convexClient = {
    query: () =>
      queryMock.gateRejects
        ? Promise.reject(new Error("Server Error: function not found"))
        : Promise.resolve(queryMock.gate),
  };
  return {
    useQuery: (ref: unknown, args: unknown) =>
      args === "skip" ? undefined : queryMock.results[getFunctionName(ref as never)],
    useMutation: (ref: unknown) => {
      const name = getFunctionName(ref as never);
      queryMock.mutations[name] ??= vi.fn(async () => ({ ok: true }));
      return queryMock.mutations[name];
    },
    useConvex: () => convexClient,
  };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string } & Record<string, unknown>) => {
      let out = opts?.defaultValue ?? key;
      for (const [k, val] of Object.entries(opts ?? {})) {
        out = out.replace(`{{${k}}}`, String(val));
      }
      return out;
    },
    i18n: {},
  }),
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { api } from "../../convex/_generated/api";
import BudgetSquadScreen from "@/pages/shell/weekend/BudgetSquadScreen";

const SQUAD_QUERY = getFunctionName(api.fantasySquads.getSquad);
const MARKET_QUERY = getFunctionName(api.fantasyMarket.getMarket);
const SCORE_QUERY = getFunctionName(api.fantasyScores.getSquadScore);
const SET_SLOT = getFunctionName(api.fantasySquads.setSlot);

const GATE = {
  gameweekId: "gw1",
  season: "2026-2027",
  gwNumber: 3,
  status: "live",
  finalityAt: 4102444800000,
};

function slot(overrides: Record<string, unknown>) {
  return {
    slotIndex: 0,
    slotRole: "MID",
    isFinisher: false,
    playerId: null,
    playerName: null,
    playerClubId: null,
    playerPrice: null,
    locked: false,
    committedPrice: null,
    ...overrides,
  };
}

/** A minimal legal-shaped squad: we only render it, the server validated it. */
function squadWith(slots: unknown[], budget = { committed: 0, live: 21, total: 21, limit: 91 }) {
  return {
    squadId: "squad1",
    context: "budget",
    favoriteClubAtBuild: null,
    arrangedByUser: null,
    budget,
    slots,
  };
}

function scoreWith(slots: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    squadId: "squad1",
    userId: "u1",
    context: "budget",
    gameweekId: "gw1",
    season: "2026-2027",
    gwNumber: 3,
    state: "provisional",
    finalityAt: GATE.finalityAt,
    finalizedAt: null,
    total: 7.25,
    scoredSlots: 1,
    awaitingSlots: 1,
    emptySlots: 11,
    awaiting: true,
    slots,
    ...overrides,
  };
}

function scoreSlot(overrides: Record<string, unknown>) {
  return {
    slotIndex: 0,
    slotRole: "MID",
    isFinisher: false,
    playerId: "p1",
    playerName: "Player",
    clubId: "club1",
    locked: true,
    state: "scored",
    awaitingReason: null,
    zeroReason: null,
    points: null,
    baseScore: null,
    crowdFactor: null,
    verdictPosition: null,
    mismatch: false,
    version: 1,
    rowState: "provisional",
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/v2/weekend/squad"]}>
      <Routes>
        <Route path="/v2/weekend/squad" element={<BudgetSquadScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  queryMock.gate = GATE;
  queryMock.gateRejects = false;
  queryMock.mutations = {};
  queryMock.results = {
    [SQUAD_QUERY]: null,
    [MARKET_QUERY]: { ...GATE, players: [] },
    [SCORE_QUERY]: null,
  };
  toastMock.error.mockClear();
});

describe("budget squad screen — availability gate", () => {
  it("fails closed to the quiet card when the backend cannot answer", async () => {
    queryMock.gateRejects = true;
    renderScreen();
    expect(await screen.findByText(/No board is open right now/)).toBeInTheDocument();
    // No error surface — fail closed and SILENT (HomeWeekendTeaser precedent).
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("offers the formation picker when there is a board but no squad yet", async () => {
    renderScreen();
    expect(await screen.findByText("Start building")).toBeInTheDocument();
    expect(screen.getByText("XI: 11 of 11")).toBeInTheDocument();
  });
});

describe("budget squad screen — awaiting vs zero (O1e)", () => {
  it("renders awaiting as words, the honest zero as a labelled 0.0, never alike", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith([
      slot({
        slotIndex: 0,
        playerId: "p1",
        playerName: "Waiting Winger",
        playerPrice: 10.5,
        locked: true,
      }),
      slot({
        slotIndex: 1,
        playerId: "p2",
        playerName: "Benched Bob",
        playerPrice: 10.5,
        locked: true,
      }),
    ]);
    queryMock.results[SCORE_QUERY] = scoreWith([
      scoreSlot({ slotIndex: 0, state: "awaiting", points: null, awaitingReason: "match not scored yet" }),
      scoreSlot({ slotIndex: 1, state: "scored", points: 0, zeroReason: "did not appear" }),
    ]);

    renderScreen();

    // The awaiting slot renders the words.
    expect(await screen.findByText("awaiting data")).toBeInTheDocument();
    // The honest zero renders AS 0.0, with its reason attached (FW-4R N5).
    expect(screen.getByText("0.0")).toBeInTheDocument();
    expect(screen.getByText("did not appear")).toBeInTheDocument();
    // The total is labelled provisional, from the stamp the server read (N2).
    expect(screen.getByText(/provisional/)).toBeInTheDocument();
  });

  it("labels a fully settled squad as settled", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith([
      slot({ slotIndex: 0, playerId: "p1", playerName: "Done Dan", playerPrice: 8, locked: true }),
    ]);
    queryMock.results[SCORE_QUERY] = scoreWith(
      [scoreSlot({ slotIndex: 0, points: 12.75 })],
      { state: "final", awaitingSlots: 0, total: 12.75 },
    );

    renderScreen();
    expect(await screen.findByText("settled")).toBeInTheDocument();
    expect(screen.queryByText(/provisional/)).not.toBeInTheDocument();
  });
});

describe("budget squad screen — edits and locks", () => {
  it("surfaces a server rejection as a toast, in the server's words", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith([
      slot({ slotIndex: 0, playerId: "p1", playerName: "Costly Carl", playerPrice: 12 }),
    ]);
    queryMock.mutations[SET_SLOT] = vi.fn(() =>
      Promise.reject(
        new Error("That player's match has kicked off — his slot is locked for this gameweek."),
      ),
    );

    renderScreen();
    fireEvent.click(await screen.findByLabelText("Clear"));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(String(toastMock.error.mock.calls[0][0])).toMatch(/locked for this gameweek/);
  });

  it("gives a locked slot no edit affordances, only the badge", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith([
      slot({
        slotIndex: 0,
        playerId: "p1",
        playerName: "Frozen Fred",
        playerPrice: 9,
        locked: true,
        committedPrice: 9,
      }),
      slot({ slotIndex: 1, playerId: "p2", playerName: "Free Frank", playerPrice: 7 }),
    ]);

    renderScreen();
    expect(await screen.findByText("Frozen Fred")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
    // One Clear and one Move — Free Frank's only; Frozen Fred offers nothing.
    expect(screen.getAllByLabelText("Clear")).toHaveLength(1);
    expect(screen.getAllByLabelText("Move")).toHaveLength(1);
  });

  it("renders the server's budget breakdown, committed and remaining", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith(
      [slot({ slotIndex: 0, playerId: "p1", playerName: "Any", playerPrice: 30, locked: true, committedPrice: 30 })],
      { committed: 30, live: 41.5, total: 71.5, limit: 91 },
    );

    const { container } = renderScreen();
    await screen.findByText(/30\.0 locked in/);
    expect(container.textContent).toContain("71.5 / 91.0");
    expect(screen.getByText(/19\.5 left/)).toBeInTheDocument();
  });
});
