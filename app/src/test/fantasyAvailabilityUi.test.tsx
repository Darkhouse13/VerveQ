/**
 * Weekend Fantasy FW-AVAIL — the availability surfaces.
 *
 * Renders the real BudgetSquadScreen against stubbed payloads and pins the
 * rulings the feature was built under:
 *
 *   - a flagged player stays PICKABLE. The owner ruling is inform-only, and
 *     the easiest way for this feature to regress into a gate is for someone
 *     to "helpfully" grey the row out. This suite fails if they do.
 *   - the badge and the feed's own reason both reach the row.
 *   - "Hide flagged" is opt-in and reversible, and hides nothing by default.
 *   - a squad carrying flagged players says so once, at squad level.
 *   - nothing renders for an unflagged player: silence is not an all-clear,
 *     and there is no "Available" badge to mistake for one.
 *
 * FW-NAMES rides along here too: the picker's search folds accents, so the
 * repaired spellings are still findable from a plain keyboard.
 */

import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName } from "convex/server";

const queryMock = vi.hoisted(() => ({
  results: {} as Record<string, unknown>,
  gate: null as unknown,
  mutations: {} as Record<string, Mock>,
}));

vi.mock("convex/react", () => {
  const convexClient = { query: () => Promise.resolve(queryMock.gate) };
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { api } from "../../convex/_generated/api";
import BudgetSquadScreen from "@/pages/shell/weekend/BudgetSquadScreen";

const SQUAD_QUERY = getFunctionName(api.fantasySquads.getSquad);
const MARKET_QUERY = getFunctionName(api.fantasyMarket.getMarket);
const SCORE_QUERY = getFunctionName(api.fantasyScores.getSquadScore);

const FUTURE_KICKOFF = 4102444800000;
const GATE = {
  gameweekId: "gw1",
  season: "2026-2027",
  gwNumber: 3,
  status: "live",
  finalityAt: FUTURE_KICKOFF,
};

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
    availability: null,
    ...overrides,
  };
}

function slot(overrides: Record<string, unknown>) {
  return {
    slotIndex: 0,
    slotRole: "GK",
    isFinisher: false,
    playerId: null,
    playerName: null,
    playerClubId: null,
    playerPrice: null,
    locked: false,
    committedPrice: null,
    availability: null,
    ...overrides,
  };
}

const ROLES = [
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
  "DEF",
  "ATT",
] as const;

/** Thirteen slots, empty unless the caller replaces one by index. */
function squadWith(replacements: Record<number, Record<string, unknown>> = {}) {
  return {
    squadId: "squad1",
    context: "budget",
    favoriteClubAtBuild: null,
    arrangedByUser: null,
    budget: { committed: 0, live: 21, total: 21, limit: 91 },
    slots: ROLES.map((slotRole, slotIndex) =>
      slot({
        slotIndex,
        slotRole,
        isFinisher: slotIndex >= 11,
        ...(replacements[slotIndex] ?? {}),
      }),
    ),
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

/** Opens the GK slot's picker over a market the caller supplies. */
async function openPicker(players: unknown[]) {
  queryMock.results[SQUAD_QUERY] = squadWith();
  queryMock.results[MARKET_QUERY] = { ...GATE, players };
  renderScreen();
  fireEvent.click(await screen.findByTestId("pitch-slot-0"));
  return within(await screen.findByRole("dialog"));
}

beforeEach(() => {
  queryMock.gate = GATE;
  queryMock.mutations = {};
  queryMock.results = {
    [SQUAD_QUERY]: null,
    [MARKET_QUERY]: { ...GATE, players: [] },
    [SCORE_QUERY]: null,
  };
  localStorage.clear();
});

describe("FW-AVAIL — the picker row", () => {
  const FLAGGED = [
    marketPlayer({
      playerId: "out1",
      name: "Out Keeper",
      availability: { status: "out", category: "injury", reason: "Back Injury" },
    }),
    marketPlayer({
      playerId: "doubt1",
      name: "Doubt Keeper",
      availability: { status: "doubtful", category: "injury", reason: "Knock" },
    }),
    marketPlayer({ playerId: "fit1", name: "Fit Keeper" }),
  ];

  it("badges both statuses and quotes the feed's own reason", async () => {
    const dialog = await openPicker(FLAGGED);
    expect(await dialog.findByText("Out Keeper")).toBeInTheDocument();

    // Rows sort by price then name, so: Doubt Keeper, Fit Keeper, Out Keeper.
    const rows = dialog.getAllByTestId("picker-row");
    const rowFor = (name: string) => {
      const row = rows.find((r) => r.textContent?.includes(name));
      if (row === undefined) throw new Error(`no picker row for ${name}`);
      return within(row);
    };

    expect(rowFor("Out Keeper").getByTestId("picker-availability-badge").textContent).toBe(
      "Out",
    );
    expect(rowFor("Out Keeper").getByTestId("picker-availability-reason").textContent).toBe(
      " · Back Injury",
    );
    expect(rowFor("Doubt Keeper").getByTestId("picker-availability-badge").textContent).toBe(
      "Doubt",
    );
    expect(
      rowFor("Doubt Keeper").getByTestId("picker-availability-reason").textContent,
    ).toBe(" · Knock");
    expect(rowFor("Fit Keeper").queryByTestId("picker-availability-badge")).toBeNull();
  });

  it("keeps a flagged player PICKABLE — the inform-only ruling", async () => {
    const dialog = await openPicker(FLAGGED);
    await dialog.findByText("Out Keeper");
    // One Pick button per row, flagged or not: three rows, three buttons.
    expect(dialog.getAllByRole("button", { name: "Pick" })).toHaveLength(3);
    // And the row is not greyed: opacity-45 is reserved for un-pickable rows
    // (started, taken, unpriced, no fixture).
    const rows = dialog.getAllByTestId("picker-row");
    for (const row of rows) expect(row.className).not.toContain("opacity-45");
  });

  it("renders NOTHING for an unflagged player — silence is not an all-clear", async () => {
    const dialog = await openPicker([marketPlayer({ playerId: "fit1", name: "Fit Keeper" })]);
    await dialog.findByText("Fit Keeper");
    expect(dialog.queryByTestId("picker-availability-badge")).toBeNull();
    expect(dialog.queryByTestId("picker-availability-reason")).toBeNull();
    expect(dialog.queryByText(/available/i)).toBeNull();
  });

  it("hides nothing by default and hides only the flagged when asked", async () => {
    const dialog = await openPicker(FLAGGED);
    expect(dialog.getAllByTestId("picker-row")).toHaveLength(3);

    fireEvent.click(dialog.getByTestId("picker-hide-flagged"));
    expect(dialog.getAllByTestId("picker-row")).toHaveLength(1);
    expect(dialog.getByText("Fit Keeper")).toBeInTheDocument();
    expect(dialog.queryByText("Out Keeper")).toBeNull();

    // Reversible — a filter, never a rule.
    fireEvent.click(dialog.getByTestId("picker-hide-flagged"));
    expect(dialog.getAllByTestId("picker-row")).toHaveLength(3);
  });

  it("tolerates a backend that predates the field", async () => {
    // CI ships the frontend on its own; Convex is deployed by hand.
    const dialog = await openPicker([{ ...marketPlayer({}), availability: undefined }]);
    await dialog.findByText("Keeper One");
    expect(dialog.queryByTestId("picker-availability-badge")).toBeNull();
  });
});

describe("FW-NAMES — the picker's search folds accents", () => {
  const ACCENTED = [
    marketPlayer({ playerId: "a1", name: "M. Ljubičić" }),
    marketPlayer({ playerId: "a2", name: "O. Højlund" }),
    marketPlayer({ playerId: "a3", name: "J. O'Brien" }),
  ];

  it.each([
    ["ljubicic", "M. Ljubičić"],
    ["hojlund", "O. Højlund"],
    ["obrien", "J. O'Brien"],
  ])("typing %j finds %j", async (needle, expected) => {
    const dialog = await openPicker(ACCENTED);
    await dialog.findByText(expected);
    fireEvent.change(dialog.getByPlaceholderText("Search name or club…"), {
      target: { value: needle },
    });
    const rows = dialog.getAllByTestId("picker-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain(expected);
  });

  it("still matches when the query carries the accents", async () => {
    const dialog = await openPicker(ACCENTED);
    fireEvent.change(dialog.getByPlaceholderText("Search name or club…"), {
      target: { value: "Ljubičić" },
    });
    expect(dialog.getAllByTestId("picker-row")).toHaveLength(1);
  });
});

describe("FW-AVAIL — the squad notice", () => {
  it("says nothing when nothing is flagged", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith();
    renderScreen();
    await screen.findByTestId("pitch-slot-0");
    expect(screen.queryByTestId("squad-availability-notice")).toBeNull();
  });

  it("counts the men flagged OUT and names everyone flagged", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith({
      0: {
        playerId: "p1",
        playerName: "Out Keeper",
        playerPrice: 5,
        availability: { status: "out", category: "injury", reason: "Back Injury" },
      },
      5: {
        playerId: "p2",
        playerName: "Doubt Mid",
        playerPrice: 6,
        availability: { status: "doubtful", category: "other", reason: "Inactive" },
      },
    });
    renderScreen();
    const notice = within(await screen.findByTestId("squad-availability-notice"));
    expect(notice.getByText("1 of your squad are flagged to miss this weekend.")).toBeInTheDocument();
    expect(notice.getByText("Out Keeper, Doubt Mid")).toBeInTheDocument();
  });

  it("reads as a doubt, not a miss, when nobody is ruled out", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith({
      0: {
        playerId: "p1",
        playerName: "Doubt Keeper",
        playerPrice: 5,
        availability: { status: "doubtful", category: "injury", reason: "Knock" },
      },
    });
    renderScreen();
    const notice = within(await screen.findByTestId("squad-availability-notice"));
    expect(notice.getByText("1 of your squad are doubtful this weekend.")).toBeInTheDocument();
  });

  it("still flags a LOCKED slot — he can't be changed, but the zero has a reason", async () => {
    queryMock.results[SQUAD_QUERY] = squadWith({
      0: {
        playerId: "p1",
        playerName: "Locked Keeper",
        playerPrice: 5,
        locked: true,
        committedPrice: 5,
        availability: { status: "out", category: "suspension", reason: "Red Card" },
      },
    });
    renderScreen();
    const notice = within(await screen.findByTestId("squad-availability-notice"));
    expect(notice.getByText(/flagged to miss this weekend/)).toBeInTheDocument();
  });
});
