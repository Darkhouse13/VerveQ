/**
 * Ticket H — Home hero card for THE DRAW (homeDrawCardContract).
 *
 * Locks:
 *  - the three render states: UNPLAYED (board # + gauntlet strip + PLAY CTA),
 *    IN-PROGRESS (RESUME RUN + rounds progress), PLAYED (outcome + score +
 *    rank + streak chip + countdown);
 *  - the double gate: build flag off ⇒ the card doesn't exist (no query is
 *    even fired); server gate throw ⇒ the card hides SILENTLY, no error state;
 *  - no layout shift for non-draw users: with the card absent, Home is
 *    byte-identical to the pre-ticket Home (snapshot + cross-render DOM
 *    equality);
 *  - the countdown reads the SERVER-served nextBoardAt and ticks live — never
 *    client clock math (proven with a target next-UTC-midnight math can't
 *    produce).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import { DRAW_DISABLED_MESSAGE } from "../../convex/lib/drawMessages";
import { api } from "../../convex/_generated/api";
import type { RoundBreakdown } from "@/lib/drawEngine";

const flagsMock = vi.hoisted(() => ({ draw: true }));
vi.mock("@/lib/flags", () => ({
  get DRAW_ENABLED() {
    return flagsMock.draw;
  },
  get V2_SHELL_ENABLED() {
    return true;
  },
  get LEARN_ENABLED() {
    return false;
  },
}));

const authMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock.value,
}));

// A STABLE client object, like the real ConvexReactClient held in context —
// a fresh object per render would re-fire the card's load effect.
const convexMock = vi.hoisted(() => ({
  client: { query: vi.fn(), mutation: vi.fn() },
  useQueryValue: undefined as unknown,
}));
vi.mock("convex/react", () => ({
  useConvex: () => convexMock.client,
  useQuery: () => convexMock.useQueryValue,
}));

// Passthrough i18n (key echo) — same pattern as onboardedHomeContract, and it
// keeps the Home snapshot free of the wall-clock countdown interpolation.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { name?: string }) =>
      opts?.name ? `${k}:${opts.name}` : k,
    i18n: {},
  }),
}));

import { HomeDrawCard, HomeDrawCardView } from "@/components/draw/HomeDrawCard";
import ShellHomeScreen from "@/pages/shell/ShellHomeScreen";

type ReadyToday = Extract<
  FunctionReturnType<typeof api.draw.getToday>,
  { boardReady: true }
>;
type ServerRun = NonNullable<ReadyToday["run"]>;
type ServerLeaderboard = FunctionReturnType<typeof api.draw.getLeaderboard>;

// The generated api is an anyApi proxy: each access mints a fresh reference
// object, so routing is by function NAME (getFunctionName) — the same pattern
// as test/support/drawFakeConvex.ts.
const nameOf = (ref: unknown): string =>
  getFunctionName(ref as FunctionReference<"query" | "mutation">);

// ── server-shaped fixtures (mirrors convex/draw.ts payloads) ──

const FIXTURES: ReadyToday["fixtures"] = [
  { index: 0, archetypeId: "ARCH_WALL", modifiers: [], threshold: 220, isBoss: false },
  { index: 1, archetypeId: "ARCH_BLITZ", modifiers: [], threshold: 260, isBoss: false },
  { index: 2, archetypeId: "ARCH_ENGINE", modifiers: [], threshold: 300, isBoss: false },
  { index: 3, archetypeId: "ARCH_THROWBACK", modifiers: [], threshold: 340, isBoss: false },
  { index: 4, archetypeId: "ARCH_FORTRESS_KEEPER", modifiers: [], threshold: 420, isBoss: true },
];

const RULES: ReadyToday["rules"] = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  synergyTable: [1, 1.25, 1.6, 2.1],
  bustKeep: 0.25,
  fullClearBonus: 1.5,
  formSpread: 0.2,
  maxSynergyFamilies: 2,
};

function round(fixtureIndex: number, cleared: boolean): RoundBreakdown {
  return {
    fixtureIndex,
    threshold: FIXTURES[fixtureIndex].threshold,
    benchedCardId: "c-bench",
    baseSum: 500,
    synergies: [],
    synergyMult: 1,
    score: 512.5,
    cleared,
    cards: [],
  };
}

function todayWith(overrides: Partial<ReadyToday>): ReadyToday {
  return {
    dateKey: "2026-07-18",
    boardNumber: 18,
    nextBoardAt: Date.UTC(2026, 6, 19, 6, 30, 0),
    streak: 3,
    boardReady: true,
    fixtures: FIXTURES,
    rules: RULES,
    playState: "unplayed",
    run: null,
    ...overrides,
  };
}

function runWith(overrides: Partial<ServerRun>): ServerRun {
  return {
    dateKey: "2026-07-18",
    boardNumber: 18,
    status: "running",
    phase: "bench",
    rowIndex: 6,
    fixtureIndex: 1,
    cumulative: 444.29,
    squad: [],
    offers: null,
    fixtures: FIXTURES,
    rounds: [round(0, true)],
    outcome: null,
    finalScore: null,
    draftLineHash: "021102",
    completedAt: null,
    boardReveal: null,
    hints: null,
    shareSlug: null,
    choiceLog: [],
    ...overrides,
  };
}

const UNPLAYED = todayWith({ playState: "unplayed", run: null });
const IN_PROGRESS = todayWith({
  playState: "in_progress",
  run: runWith({}),
});
const PLAYED = todayWith({
  playState: "done",
  run: runWith({
    status: "banked",
    phase: "done",
    fixtureIndex: 2,
    cumulative: 12430.7,
    rounds: [round(0, true), round(1, true), round(2, true)],
    outcome: "banked",
    finalScore: 12430.7,
    completedAt: Date.UTC(2026, 6, 18, 9, 0, 0),
    boardReveal: { rows: [] },
  }),
});
const LEADERBOARD: ServerLeaderboard = {
  dateKey: "2026-07-18",
  total: 41,
  entries: [],
  me: { rank: 4, score: 12431 },
};

const authed = {
  user: { _id: "u1", username: "zara" },
  hasUsername: true,
  accountState: "usernameOnly",
};

// ── render helpers ──

function renderView(today: ReadyToday, rank: number | null = null, now = Date.now()) {
  const onOpen = vi.fn();
  render(
    <MemoryRouter>
      <HomeDrawCardView today={today} rank={rank} now={now} onOpen={onOpen} />
    </MemoryRouter>,
  );
  return onOpen;
}

function renderCardRoute() {
  return render(
    <MemoryRouter initialEntries={["/v2"]}>
      <Routes>
        <Route path="/v2" element={<HomeDrawCard />} />
        <Route path="/draw" element={<div data-testid="draw-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/v2"]}>
      <ShellHomeScreen />
    </MemoryRouter>,
  );
}

const flush = () => act(async () => {});

// ── tests ──

describe("HomeDrawCard — three states", () => {
  it("UNPLAYED: board number, the 5-fixture gauntlet (names + thresholds), PLAY CTA", () => {
    const onOpen = renderView(UNPLAYED);

    expect(screen.getByText("Today's board #18")).toBeTruthy();
    const strip = screen.getByTestId("home-draw-strip");
    const labels = ["WALL", "BLITZ", "ENGINE", "THROWBACK", "FORTRESS"];
    const thresholds = ["220", "260", "300", "340", "420"];
    for (let i = 0; i < 5; i++) {
      const chip = within(strip).getByTestId(`home-draw-fixture-${i}`);
      expect(within(chip).getByText(labels[i])).toBeTruthy();
      expect(within(chip).getByText(thresholds[i])).toBeTruthy();
    }

    const cta = screen.getByTestId("home-draw-cta");
    expect(cta.textContent).toBe("Play today's board");
    fireEvent.click(cta);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("IN-PROGRESS: RESUME RUN + rounds progress (round, banked pts, pips)", () => {
    renderView(IN_PROGRESS);

    expect(screen.getByText("Run in progress")).toBeTruthy();
    expect(screen.getByTestId("home-draw-cta").textContent).toBe("Resume run");
    const progress = screen.getByTestId("home-draw-progress");
    expect(progress.textContent).toContain("Round 2 of 5");
    expect(progress.textContent).toContain("444 pts");
  });

  it("IN-PROGRESS during the draft reports draft progress, not a round", () => {
    renderView(
      todayWith({
        playState: "in_progress",
        run: runWith({ phase: "draft", rowIndex: 1, fixtureIndex: 0, rounds: [] }),
      }),
    );

    expect(screen.getByTestId("home-draw-progress").textContent).toContain(
      "Draft row 2 of 6",
    );
  });

  it("PLAYED: outcome + score + rank + streak chip + countdown", () => {
    renderView(PLAYED, 4, Date.UTC(2026, 6, 18, 10, 0, 0));

    expect(screen.getByTestId("home-draw-outcome").textContent).toBe("BANKED");
    expect(screen.getByTestId("home-draw-score").textContent).toContain("12,431");
    expect(screen.getByTestId("home-draw-rank").textContent).toContain("Rank #4");
    expect(screen.getByTestId("home-draw-streak").textContent).toContain("3");
    expect(screen.getByTestId("home-draw-countdown").textContent).toContain(
      "20:30:00",
    );
    expect(screen.getByTestId("home-draw-cta").textContent).toBe("See result");
  });
});

describe("HomeDrawCard — container + gating", () => {
  beforeEach(() => {
    flagsMock.draw = true;
    authMock.value = authed;
    convexMock.client.query.mockReset();
    convexMock.client.mutation.mockReset();
    convexMock.client.query.mockImplementation(async (ref: unknown) => {
      const name = nameOf(ref);
      if (name === "draw:getToday") return UNPLAYED;
      if (name === "draw:getLeaderboard") return LEADERBOARD;
      throw new Error(`unexpected query "${name}"`);
    });
  });

  it("flag off: the card does not exist — no query is even fired", async () => {
    flagsMock.draw = false;
    renderCardRoute();
    await flush();

    expect(screen.queryByTestId("home-draw-card")).toBeNull();
    expect(convexMock.client.query).not.toHaveBeenCalled();
  });

  it("logged-out visitor: no query, no card, no error state", async () => {
    authMock.value = { user: null, hasUsername: false, accountState: "loggedOut" };
    renderCardRoute();
    await flush();

    expect(screen.queryByTestId("home-draw-card")).toBeNull();
    expect(convexMock.client.query).not.toHaveBeenCalled();
  });

  it("server gate throw hides the card silently (flag off / not a tester)", async () => {
    convexMock.client.query.mockRejectedValue(new Error(DRAW_DISABLED_MESSAGE));
    renderCardRoute();
    await flush();

    expect(screen.queryByTestId("home-draw-card")).toBeNull();
  });

  it("flag on + getToday succeeds: the card renders and the CTA routes to /draw", async () => {
    renderCardRoute();
    await flush();

    expect(screen.getByTestId("home-draw-card")).toBeTruthy();
    fireEvent.click(screen.getByTestId("home-draw-cta"));
    expect(screen.getByTestId("draw-route")).toBeTruthy();
  });

  it("lazily ensures the day's board when getToday reports boardReady: false", async () => {
    let reads = 0;
    convexMock.client.query.mockImplementation(async (ref: unknown) => {
      const name = nameOf(ref);
      if (name === "draw:getToday") {
        reads += 1;
        return reads === 1
          ? { ...UNPLAYED, boardReady: false as const, fixtures: null, rules: null, run: null }
          : UNPLAYED;
      }
      if (name === "draw:getLeaderboard") return LEADERBOARD;
      throw new Error(`unexpected query "${name}"`);
    });
    renderCardRoute();
    await flush();

    expect(convexMock.client.mutation).toHaveBeenCalledTimes(1);
    expect(nameOf(convexMock.client.mutation.mock.calls[0][0])).toBe("draw:ensureToday");
    expect(reads).toBe(2);
    expect(screen.getByTestId("home-draw-card")).toBeTruthy();
  });

  it("PLAYED: rank comes from getLeaderboard's caller row; its failure only drops the chip", async () => {
    convexMock.client.query.mockImplementation(async (ref: unknown) => {
      const name = nameOf(ref);
      if (name === "draw:getToday") return PLAYED;
      if (name === "draw:getLeaderboard") throw new Error("leaderboard down");
      throw new Error(`unexpected query "${name}"`);
    });
    renderCardRoute();
    await flush();

    expect(screen.getByTestId("home-draw-outcome").textContent).toBe("BANKED");
    expect(screen.queryByTestId("home-draw-rank")).toBeNull();
  });
});

describe("HomeDrawCard — countdown uses server time", () => {
  beforeEach(() => {
    flagsMock.draw = true;
    authMock.value = authed;
    convexMock.client.query.mockReset();
    convexMock.client.mutation.mockReset();
    convexMock.client.query.mockImplementation(async (ref: unknown) => {
      const name = nameOf(ref);
      if (name === "draw:getToday") return PLAYED;
      if (name === "draw:getLeaderboard") return LEADERBOARD;
      throw new Error(`unexpected query "${name}"`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down live from the server-served nextBoardAt (no client clock math)", async () => {
    // Client clock: 2026-07-18T10:00:00Z. Client-side midnight math would say
    // 14:00:00 to the next UTC day — the server instead serves nextBoardAt
    // 2026-07-19T06:30:00Z, and the card must render THAT target verbatim.
    vi.useFakeTimers({ now: new Date("2026-07-18T10:00:00Z") });
    renderCardRoute();
    await flush();

    const countdown = screen.getByTestId("home-draw-countdown");
    expect(countdown.textContent).toContain("Next board 20:30:00");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(countdown.textContent).toContain("Next board 20:29:58");
  });
});

describe("HomeDrawCard — no layout shift for non-draw users", () => {
  const homeAuth = {
    user: { _id: "u1", username: "zara" },
    hasUsername: true,
    accountState: "usernameOnly",
  };
  const homeProfile = {
    userId: "u1",
    username: "zara",
    eloRating: 1200,
    rankedEligible: false,
    totalPlays: 7,
    stats: {
      totalGames: 0,
      totalWins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      favoriteSport: null,
    },
  };

  beforeEach(() => {
    authMock.value = homeAuth;
    convexMock.useQueryValue = homeProfile;
    convexMock.client.query.mockReset();
    convexMock.client.mutation.mockReset();
  });

  it("flag off: Home renders unchanged (snapshot) and fires no draw query", async () => {
    flagsMock.draw = false;
    const { container } = renderHome();
    await flush();

    expect(screen.queryByTestId("home-draw-card")).toBeNull();
    expect(convexMock.client.query).not.toHaveBeenCalled();
    expect(container).toMatchSnapshot();
  });

  it("flag on + gate throw: Home DOM is byte-identical to the flag-off Home", async () => {
    flagsMock.draw = false;
    const plain = renderHome();
    const plainHtml = plain.container.innerHTML;
    plain.unmount();

    flagsMock.draw = true;
    convexMock.client.query.mockRejectedValue(new Error(DRAW_DISABLED_MESSAGE));
    const gated = renderHome();
    await flush();

    expect(within(gated.container).queryByTestId("home-draw-card")).toBeNull();
    expect(gated.container.innerHTML).toBe(plainHtml);
    gated.unmount();
  });
});
