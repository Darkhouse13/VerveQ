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
const SET_FORMATION = getFunctionName(api.fantasySquads.setFormation);

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

  it("offers the formation preset chips when there is a board but no squad yet", async () => {
    renderScreen();
    expect(await screen.findByText("Start building")).toBeInTheDocument();
    // D3: shapes, not steppers — all seven chips, 4-4-2 pre-selected.
    for (const label of ["4-4-2", "4-3-3", "3-5-2", "3-4-3", "5-3-2", "4-5-1", "5-4-1"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("4-4-2").closest("button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByLabelText("MID +")).not.toBeInTheDocument();
  });
});

/** A full 13-slot 4-4-2 squad (XI + MID/ATT finishers). */
function fullSquad(filled: number[] = [], locked: number[] = []) {
  const roles = [
    "GK",
    "DEF",
    "DEF",
    "DEF",
    "DEF",
    "MID",
    "MID",
    "MID",
    "MID",
    "ATT",
    "ATT",
  ];
  const slots = roles.map((role, i) =>
    slot({
      slotIndex: i,
      slotRole: role,
      playerId: filled.includes(i) ? `p${i}` : null,
      playerName: filled.includes(i) ? `Player ${i}` : null,
      playerPrice: filled.includes(i) ? 5 : null,
      locked: locked.includes(i),
    }),
  );
  slots.push(slot({ slotIndex: 11, slotRole: "MID", isFinisher: true }));
  slots.push(slot({ slotIndex: 12, slotRole: "ATT", isFinisher: true }));
  return squadWith(slots);
}

describe("budget squad screen — formation editable after confirmation (FW-POLISH O1)", () => {
  it("switches shape from the squad screen in one tap when nobody is displaced", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([1, 2, 3]);
    renderScreen();
    // The persistent entry point: chips ON the squad screen, current shape named.
    expect(await screen.findByText("Shape — 4-4-2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("3-5-2"));
    await waitFor(() => expect(queryMock.mutations[SET_FORMATION]).toHaveBeenCalled());
    const payload = queryMock.mutations[SET_FORMATION].mock.calls[0][0] as {
      slots: Array<{ slotRole: string; isFinisher: boolean }>;
    };
    expect(payload.slots).toHaveLength(13);
    expect(
      payload.slots.filter((s) => !s.isFinisher && s.slotRole === "MID"),
    ).toHaveLength(5);
    // Nobody displaced — no slot was cleared.
    expect(queryMock.mutations[SET_SLOT]).not.toHaveBeenCalled();
  });

  it("asks before displacing a pick, then clears him into the visible tray", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([1, 2, 3, 4]);
    // Convex reactivity, simulated: a clear updates the squad payload (the
    // tray only shows players who are genuinely out of the squad).
    queryMock.mutations[SET_SLOT] = vi.fn(async (args: { slotIndex: number }) => {
      const prev = queryMock.results[SQUAD_QUERY] as {
        slots: Array<{ slotIndex: number } & Record<string, unknown>>;
      };
      queryMock.results[SQUAD_QUERY] = {
        ...prev,
        slots: prev.slots.map((s) =>
          s.slotIndex === args.slotIndex
            ? { ...s, playerId: null, playerName: null, playerPrice: null }
            : s,
        ),
      };
      return { ok: true };
    });
    renderScreen();
    fireEvent.click(await screen.findByText("3-5-2"));
    // The confirm names the pick; nothing has been sent yet.
    expect(await screen.findByText(/no room for Player 4/)).toBeInTheDocument();
    expect(queryMock.mutations[SET_FORMATION]).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Switch shape"));
    await waitFor(() => expect(queryMock.mutations[SET_FORMATION]).toHaveBeenCalled());
    await waitFor(() =>
      expect(queryMock.mutations[SET_SLOT]).toHaveBeenCalledWith(
        expect.objectContaining({ slotIndex: 4, playerId: null }),
      ),
    );
    // D3: never silently dropped — he waits in the tray.
    expect(await screen.findByTestId("displaced-tray")).toBeInTheDocument();
    expect(screen.getByText("Player 4")).toBeInTheDocument();
  });

  it("asks each slot's question in football, not database (O4)", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad();
    renderScreen();
    // Empty GK chip → the picker asks the position's question.
    fireEvent.click(await screen.findByTestId("pitch-slot-0"));
    expect(await screen.findByText("Who starts between the sticks?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // Empty finisher chip → the finisher's question.
    fireEvent.click(screen.getByTestId("pitch-slot-11"));
    expect(await screen.findByText("Who changes the game late?")).toBeInTheDocument();
  });

  it("disables shapes the locked arrangement cannot reach", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([9, 10], [9, 10]);
    renderScreen();
    // Two locked ATT → the one-ATT shapes are unreachable, the rest live.
    expect((await screen.findByText("4-5-1")).closest("button")).toBeDisabled();
    expect(screen.getByText("5-4-1").closest("button")).toBeDisabled();
    expect(screen.getByText("3-5-2").closest("button")).not.toBeDisabled();
  });
});

describe("budget squad screen — awaiting vs zero (O1e, on the pitch)", () => {
  it("renders awaiting without a number, the honest zero as a labelled 0.0, never alike", async () => {
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

    // The awaiting chip carries NO number — "…" only (FW-4R N5).
    const awaitingChip = await screen.findByTestId("pitch-slot-0");
    expect(awaitingChip).toHaveAttribute("data-chip-state", "awaiting");
    expect(awaitingChip.textContent).toContain("…");
    expect(awaitingChip.textContent).not.toContain("0.0");
    // The honest zero renders AS 0.0, with its DNP marker on the chip.
    const zeroChip = screen.getByTestId("pitch-slot-1");
    expect(zeroChip.textContent).toContain("0.0");
    expect(zeroChip.textContent).toContain("DNP");
    // The total is labelled provisional, from the stamp the server read (N2).
    expect(screen.getByText(/provisional/)).toBeInTheDocument();

    // The detail sheet carries the full FW-4 vocabulary, verbatim.
    fireEvent.click(zeroChip);
    expect(await screen.findByText("did not appear")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(awaitingChip);
    expect(await screen.findByText("awaiting data")).toBeInTheDocument();
  });

  it("renders the remaining chip states: empty as a position, mismatch, few votes", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith([
      slot({ slotIndex: 0, slotRole: "GK" }),
      slot({
        slotIndex: 1,
        slotRole: "DEF",
        playerId: "p1",
        playerName: "Marker Mark",
        playerPrice: 6,
        locked: true,
      }),
      slot({
        slotIndex: 2,
        slotRole: "MID",
        playerId: "p2",
        playerName: "Quiet Quinn",
        playerPrice: 6,
        locked: true,
      }),
    ]);
    queryMock.results[SCORE_QUERY] = scoreWith([
      scoreSlot({ slotIndex: 1, points: 4.5, mismatch: true, rowState: "final", version: 2 }),
      scoreSlot({
        slotIndex: 2,
        points: 3,
        rowState: "final",
        version: 2,
        crowdFactor: 0,
        crowdVotes: 1,
      }),
    ]);
    renderScreen();
    // An empty slot reads as a position to fill — never a zero-score warning.
    const empty = await screen.findByTestId("pitch-slot-0");
    expect(empty).toHaveAttribute("data-chip-state", "empty");
    expect(empty.textContent).toContain("GK");
    expect(empty.textContent).not.toMatch(/scores 0/i);
    expect(screen.getByTestId("pitch-slot-1").textContent).toContain("×0.75");
    expect(screen.getByTestId("pitch-slot-2").textContent).toContain("few votes");
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
    // Chip → sheet → Clear: the server's answer surfaces as the toast.
    fireEvent.click(await screen.findByTestId("pitch-slot-0"));
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
    // The locked chip states itself, and his sheet offers no Move/Clear.
    const lockedChip = await screen.findByTestId("pitch-slot-0");
    expect(lockedChip).toHaveAttribute("data-chip-state", "locked");
    fireEvent.click(lockedChip);
    expect(await screen.findByText("Locked")).toBeInTheDocument();
    expect(screen.queryByLabelText("Clear")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Move")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // Free Frank's sheet offers both.
    fireEvent.click(screen.getByTestId("pitch-slot-1"));
    expect(await screen.findByLabelText("Move")).toBeInTheDocument();
    expect(screen.getByLabelText("Clear")).toBeInTheDocument();
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
