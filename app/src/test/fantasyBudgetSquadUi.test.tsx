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
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
import { fitCap, resetPickerMemory } from "@/lib/weekendPickerMemory";

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

function screenTree(path = "/weekend/squad") {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/weekend/squad" element={<BudgetSquadScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderScreen(path?: string) {
  return render(screenTree(path));
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
  toastMock.success.mockClear();
  // The picker's remembered filters live for the tab session; one test's
  // league choice must not narrow the next test's picker.
  resetPickerMemory();
  // The R2 display-formation memory is keyed by squadId and every test uses
  // "squad1" — clear it so a prior test's choice can't leak into a label.
  localStorage.clear();
});

describe("budget squad screen — availability gate", () => {
  it("fails closed to the quiet card when the backend cannot answer", async () => {
    queryMock.gateRejects = true;
    renderScreen();
    expect(await screen.findByText(/No board is open right now/)).toBeInTheDocument();
    // No error surface — fail closed and SILENT (HomeWeekendTeaser precedent).
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("offers the full famous-formation chooser when there is a board but no squad yet", async () => {
    renderScreen();
    expect(await screen.findByText("Start building")).toBeInTheDocument();
    // R2: the whole catalogue — named formations, never a stepper. Spot-pin
    // one name per band group plus the restored 5-2-3.
    for (const name of [
      "4-4-2",
      "4-1-2-1-2",
      "4-3-3",
      "4-2-3-1",
      "3-1-4-2",
      "3-4-2-1",
      "5-3-2",
      "5-4-1",
      "5-2-3",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("4-4-2").closest("button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByLabelText("MID +")).not.toBeInTheDocument();
    // R1: the setup page carries the finisher section too — one chooser.
    expect(screen.getByText("Your finishers")).toBeInTheDocument();
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

describe("budget squad screen — the ONE chooser behind the shape label (FW-POLISH-2 R1)", () => {
  it("has no inline chips; the tappable SHAPE label opens the sheet", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([1, 2, 3]);
    renderScreen();
    const label = await screen.findByTestId("shape-label");
    expect(label).toHaveTextContent("Shape — 4-4-2");
    // R1: the chip rows are gone from the pitch screen until the sheet opens.
    expect(screen.queryByTestId("formation-chips")).not.toBeInTheDocument();
    fireEvent.click(label);
    expect(await screen.findByTestId("formation-chips")).toBeInTheDocument();
    // The sheet is the SAME chooser: shape section AND finisher section.
    expect(screen.getByText("Your finishers")).toBeInTheDocument();
  });

  it("switches band from the sheet in one tap when nobody is displaced", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([1, 2, 3]);
    renderScreen();
    fireEvent.click(await screen.findByTestId("shape-label"));
    fireEvent.click(await screen.findByText("3-5-2"));
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

  it("re-lays out a same-band formation with NO mutation, and remembers it", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([1, 2, 3]);
    renderScreen();
    fireEvent.click(await screen.findByTestId("shape-label"));
    // 4-1-2-1-2 shares the 4/4/2 band with the current shape: pure re-layout.
    fireEvent.click(await screen.findByText("4-1-2-1-2"));
    await waitFor(() =>
      expect(screen.getByTestId("shape-label")).toHaveTextContent(
        "Shape — 4-1-2-1-2",
      ),
    );
    expect(queryMock.mutations[SET_FORMATION]).not.toHaveBeenCalled();
    expect(queryMock.mutations[SET_SLOT]).not.toHaveBeenCalled();
    // The pitch renders the diamond's SIX rows (GK/4/1/2/1/2), not role rows.
    const pitch = screen.getByTestId("weekend-pitch");
    const grid = pitch.querySelector(".grid") as HTMLElement;
    expect(grid.children).toHaveLength(6);
    expect(
      [...grid.children].map((row) => row.querySelectorAll("button").length),
    ).toEqual([1, 4, 1, 2, 1, 2]);
  });

  it("changes a finisher's role from the sheet via setFormation", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad();
    renderScreen();
    fireEvent.click(await screen.findByTestId("shape-label"));
    // Finisher slot 11 is MID today; retag him DEF.
    const finisherRows = await screen.findByText("Your finishers");
    const section = finisherRows.parentElement as HTMLElement;
    const defButtons = within(section).getAllByRole("button", { name: "DEF" });
    fireEvent.click(defButtons[0]);
    await waitFor(() => expect(queryMock.mutations[SET_FORMATION]).toHaveBeenCalled());
    const payload = queryMock.mutations[SET_FORMATION].mock.calls[0][0] as {
      slots: Array<{ slotIndex: number; slotRole: string; isFinisher: boolean }>;
    };
    expect(payload.slots.find((s) => s.slotIndex === 11)).toEqual({
      slotIndex: 11,
      slotRole: "DEF",
      isFinisher: true,
    });
    // Every other slot rides through untouched.
    expect(payload.slots.filter((s) => s.isFinisher)).toHaveLength(2);
    expect(payload.slots.find((s) => s.slotIndex === 12)?.slotRole).toBe("ATT");
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
    fireEvent.click(await screen.findByTestId("shape-label"));
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

  it("disables formations the locked arrangement cannot reach", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad([9, 10], [9, 10]);
    renderScreen();
    fireEvent.click(await screen.findByTestId("shape-label"));
    // Two locked ATT → every one-ATT formation is unreachable, the rest live.
    for (const name of ["4-2-3-1", "4-5-1", "4-1-4-1", "4-3-2-1", "5-4-1"]) {
      expect((await screen.findByText(name)).closest("button"), name).toBeDisabled();
    }
    expect(screen.getByText("3-5-2").closest("button")).not.toBeDisabled();
    expect(screen.getByText("4-4-1-1").closest("button")).not.toBeDisabled();
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
    await screen.findByText(/£30\.0m locked in/);
    expect(container.textContent).toContain("£71.5m / £91.0m");
    expect(screen.getByText(/£19\.5m left/)).toBeInTheDocument();
  });
});

// ── FW-POLISH-3 O3+O4: slot-context picker, league/club filters, leagues line ──

const WEEKEND_LEAGUES_QUERY = getFunctionName(api.fantasyMarket.getWeekendLeagues);

const FUTURE_KICKOFF = 4102444800000;

function marketPlayer(overrides: Record<string, unknown>) {
  return {
    playerId: "mp1",
    name: "Keeper One",
    clubId: "getafe",
    leagueId: 140,
    clubName: "Getafe",
    position: "GK",
    price: 5,
    kickoffAt: FUTURE_KICKOFF,
    opponentName: "Sevilla",
    isHome: true,
    ...overrides,
  };
}

function pickerMarket() {
  return {
    ...GATE,
    players: [
      marketPlayer({}),
      marketPlayer({
        playerId: "mp2",
        name: "Keeper Two",
        clubId: "ajax",
        leagueId: 88,
        clubName: "Ajax",
        opponentName: "Heerenveen",
      }),
      marketPlayer({
        playerId: "mp3",
        name: "Mid Man",
        clubId: "getafe",
        leagueId: 140,
        clubName: "Getafe",
        position: "MID",
      }),
    ],
  };
}

async function openGkPicker() {
  queryMock.results[SQUAD_QUERY] = fullSquad();
  queryMock.results[MARKET_QUERY] = pickerMarket();
  renderScreen();
  fireEvent.click(await screen.findByTestId("pitch-slot-0"));
  return within(await screen.findByRole("dialog"));
}

describe("budget squad screen — slot-context picker (FW-POLISH-3 O3)", () => {
  it("pre-filters to the slot's position with NO tab row", async () => {
    const dialog = await openGkPicker();
    expect(await dialog.findByText("Keeper One")).toBeInTheDocument();
    // The MID is filtered out by slot context, not by a tab the user set.
    expect(dialog.queryByText("Mid Man")).toBeNull();
    // The old ALL/GK/DEF/MID/ATT row is gone.
    expect(dialog.queryByRole("button", { name: "ALL" })).toBeNull();
    expect(dialog.queryByRole("button", { name: "GK" })).toBeNull();
    expect(dialog.queryByRole("button", { name: "ATT" })).toBeNull();
  });

  it("drills league → club: a chosen league scopes results and the club sheet", async () => {
    const dialog = await openGkPicker();
    fireEvent.click(dialog.getByTestId("picker-league-chip"));
    const sheet = within(await screen.findByTestId("picker-filter-sheet"));
    fireEvent.click(sheet.getByText("La Liga"));
    // League filter applied: the Eredivisie keeper is out.
    expect(await dialog.findByText("Keeper One")).toBeInTheDocument();
    expect(dialog.queryByText("Keeper Two")).toBeNull();

    // The club sheet is scoped to the chosen league and searchable.
    fireEvent.click(dialog.getByTestId("picker-club-chip"));
    const clubSheet = within(await screen.findByTestId("picker-filter-sheet"));
    expect(clubSheet.getByText("Getafe")).toBeInTheDocument();
    expect(clubSheet.queryByText("Ajax")).toBeNull();
    fireEvent.change(clubSheet.getByTestId("picker-club-search"), {
      target: { value: "zzz" },
    });
    expect(clubSheet.queryByText("Getafe")).toBeNull();
    fireEvent.change(clubSheet.getByTestId("picker-club-search"), {
      target: { value: "geta" },
    });
    fireEvent.click(clubSheet.getByText("Getafe"));
    expect(await dialog.findByText("Keeper One")).toBeInTheDocument();
  });

  it("keeps FW-1's deliberate mismatch pick reachable through ONE affordance", async () => {
    const dialog = await openGkPicker();
    expect(dialog.queryByText("Mid Man")).toBeNull();
    fireEvent.click(dialog.getByTestId("picker-league-chip"));
    const sheet = within(await screen.findByTestId("picker-filter-sheet"));
    fireEvent.click(sheet.getByTestId("picker-all-positions"));
    // Position pre-filter cleared: the out-of-position pick is on the board.
    expect(await dialog.findByText("Mid Man")).toBeInTheDocument();
    // And the state is visible (and clearable) in the filter row.
    expect(dialog.getByTestId("picker-all-positions-chip")).toBeInTheDocument();
  });

  it("carries no THIS WEEKEND line any more (O4 relocation)", async () => {
    queryMock.results[WEEKEND_LEAGUES_QUERY] = {
      gameweekId: "gw1",
      gwNumber: 3,
      leagues: [{ leagueId: 140, fixtureCount: 6 }],
    };
    const dialog = await openGkPicker();
    expect(dialog.queryByText(/This weekend:/)).toBeNull();
  });
});

describe("budget squad screen — the leagues strip (FW-POLISH-3 O4)", () => {
  it("renders inline at ≤3 leagues", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad();
    queryMock.results[WEEKEND_LEAGUES_QUERY] = {
      gameweekId: "gw1",
      gwNumber: 3,
      leagues: [
        { leagueId: 88, fixtureCount: 9 },
        { leagueId: 94, fixtureCount: 9 },
      ],
    };
    renderScreen();
    const strip = await screen.findByTestId("squad-leagues-strip");
    expect(strip.textContent).toContain("This gameweek: Eredivisie + Liga Portugal");
  });

  it("collapses to a count at 4+ and expands on tap to list all", async () => {
    queryMock.results[SQUAD_QUERY] = fullSquad();
    queryMock.results[WEEKEND_LEAGUES_QUERY] = {
      gameweekId: "gw1",
      gwNumber: 3,
      leagues: [
        { leagueId: 40, fixtureCount: 12 },
        { leagueId: 88, fixtureCount: 9 },
        { leagueId: 94, fixtureCount: 9 },
        { leagueId: 140, fixtureCount: 6 },
      ],
    };
    renderScreen();
    const strip = await screen.findByTestId("squad-leagues-strip");
    expect(strip.textContent).toContain("This gameweek: 4 leagues");
    expect(strip.textContent).not.toContain("Championship");
    fireEvent.click(strip);
    expect(strip.textContent).toContain(
      "This gameweek: Championship + Eredivisie + Liga Portugal + La Liga",
    );
  });
});

// ── W4 onboarding: paid entry, budget-aware picker, full-squad moment ──

const CREATE_SQUAD = getFunctionName(api.fantasySquads.createSquad);

describe("budget squad screen — first-time paid entry (W4)", () => {
  it("shows a paid-link visitor what the game is, then builds on one tap", async () => {
    renderScreen("/weekend/squad?entry=builder&ref=weekend");
    expect(await screen.findByTestId("weekend-intro")).toBeInTheDocument();
    expect(screen.getByText(/real matches/)).toBeInTheDocument();
    // The setup page waits behind the explainer.
    expect(screen.queryByTestId("start-building")).toBeNull();

    fireEvent.click(screen.getByTestId("weekend-intro-start"));
    await waitFor(() => expect(queryMock.mutations[CREATE_SQUAD]).toHaveBeenCalled());
    // Straight onto the pitch with the default shape: 4-4-2, MID + ATT finishers.
    expect(queryMock.mutations[CREATE_SQUAD].mock.calls[0][0]).toMatchObject({
      context: "budget",
      formation: { GK: 1, DEF: 4, MID: 4, ATT: 2 },
      finisherRoles: ["MID", "ATT"],
    });
  });

  it("a hub visitor goes straight to the setup, its action at the top", async () => {
    renderScreen();
    expect(await screen.findByTestId("start-building")).toBeInTheDocument();
    expect(screen.queryByTestId("weekend-intro")).toBeNull();
    // Nothing sticky floats over the chooser any more.
    expect(screen.getByTestId("start-building").closest(".sticky")).toBeNull();
  });
});

describe("budget squad screen — budget-aware picker (W4)", () => {
  it("prices a pick against completing the 13", () => {
    // 20.0 left, this pick plus 2 more open slots at the 4.0 floor.
    expect(fitCap(20, 3, 4)).toBe(12);
    expect(fitCap(20, 1, 4)).toBe(20);
    expect(fitCap(5, 4, 4)).toBe(0);
  });

  async function openTightGkPicker() {
    // Ten of 13 filled for 71.0: 20.0 left for 3 open slots, so the GK may
    // cost at most 12.0 (two more players at the 4.0 floor).
    const squad = fullSquad([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    queryMock.results[SQUAD_QUERY] = {
      ...squad,
      budget: { committed: 0, live: 71, total: 71, limit: 91 },
    };
    queryMock.results[MARKET_QUERY] = {
      ...GATE,
      players: [
        marketPlayer({}),
        marketPlayer({
          playerId: "mp9",
          name: "Pricey Keeper",
          clubId: "rm",
          clubName: "Real Madrid",
          price: 13,
        }),
      ],
    };
    renderScreen();
    fireEvent.click(await screen.findByTestId("pitch-slot-0"));
    return within(await screen.findByRole("dialog"));
  }

  it("hides players the rest of the 13 can't afford, says how many fit, and lets you see all", async () => {
    const dialog = await openTightGkPicker();
    expect(await dialog.findByText("Keeper One")).toBeInTheDocument();
    expect(dialog.queryByText("Pricey Keeper")).toBeNull();
    expect(dialog.getByTestId("picker-count").textContent).toBe("Fit your budget: 1");
    expect(dialog.getByTestId("picker-fits-chip").textContent).toContain("12.0");

    fireEvent.click(dialog.getByTestId("picker-fits-chip"));
    expect(await dialog.findByText("Pricey Keeper")).toBeInTheDocument();
    expect(dialog.getByTestId("picker-count").textContent).toBe("Players: 2");
  });

  it("sorts cheapest first on request", async () => {
    const dialog = await openTightGkPicker();
    fireEvent.click(dialog.getByTestId("picker-fits-chip"));
    const order = () =>
      dialog.getAllByTestId("picker-row-body").map((row) => row.textContent ?? "");
    await waitFor(() => expect(order()[0]).toContain("Pricey Keeper"));
    fireEvent.click(dialog.getByTestId("picker-sort-chip"));
    await waitFor(() => expect(order()[0]).toContain("Keeper One"));
  });

  it("remembers the league between picker opens", async () => {
    const dialog = await openGkPicker();
    fireEvent.click(dialog.getByTestId("picker-league-chip"));
    const sheet = within(await screen.findByTestId("picker-filter-sheet"));
    fireEvent.click(sheet.getByText("La Liga"));
    expect(await dialog.findByText("Keeper One")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByTestId("pitch-slot-0"));
    const again = within(await screen.findByRole("dialog"));
    expect(await again.findByText("Keeper One")).toBeInTheDocument();
    expect(again.queryByText("Keeper Two")).toBeNull();
    expect(again.getByTestId("picker-league-chip").textContent).toContain("La Liga");
  });

  it("wraps the filter row instead of hiding chips off the edge", async () => {
    const dialog = await openGkPicker();
    const row = dialog.getByTestId("picker-filter-row");
    expect(row.className).toContain("flex-wrap");
    expect(row.className).not.toContain("overflow-x-auto");
  });
});

describe("budget squad screen — the full 13 (W4)", () => {
  function squadOf(filled: number) {
    const squad = fullSquad([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const slots = [...squad.slots];
    if (filled >= 12) {
      slots[11] = slot({
        slotIndex: 11,
        slotRole: "MID",
        isFinisher: true,
        playerId: "p11",
        playerName: "Player 11",
        playerPrice: 5,
      });
    }
    if (filled >= 13) {
      slots[12] = slot({
        slotIndex: 12,
        slotRole: "ATT",
        isFinisher: true,
        playerId: "p12",
        playerName: "Player 12",
        playerPrice: 5,
      });
    }
    return { ...squad, slots };
  }

  it("confirms the squad once, when the 13th player lands", async () => {
    queryMock.results[SQUAD_QUERY] = squadOf(12);
    const view = renderScreen();
    await screen.findByTestId("pitch-slot-12");
    expect(toastMock.success).not.toHaveBeenCalled();

    queryMock.results[SQUAD_QUERY] = squadOf(13);
    view.rerender(screenTree());
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
    expect(toastMock.success.mock.calls[0][0]).toBe(
      "You're in for GW 3. Points land after each match.",
    );

    // Another render of the same full squad says nothing more.
    view.rerender(screenTree());
    expect(toastMock.success).toHaveBeenCalledTimes(1);
  });

  it("says nothing when an already-full squad loads", async () => {
    queryMock.results[SQUAD_QUERY] = squadOf(13);
    renderScreen();
    await screen.findByTestId("pitch-slot-12");
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("keeps a player's price on his plate until his match starts", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith([
      slot({
        slotIndex: 0,
        playerId: "p1",
        playerName: "Early Bird",
        playerPrice: 6.5,
        locked: false,
      }),
    ]);
    queryMock.results[SCORE_QUERY] = scoreWith([
      scoreSlot({ slotIndex: 0, state: "awaiting", points: null, locked: false }),
    ]);
    renderScreen();
    const chip = await screen.findByTestId("pitch-slot-0");
    expect(chip).toHaveAttribute("data-chip-state", "filled");
    expect(chip.textContent).toContain("6.5");
    expect(chip.textContent).not.toContain("…");
  });
});
