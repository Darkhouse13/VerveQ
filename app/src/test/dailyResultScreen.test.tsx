/**
 * The dailies' result screen (VerveQ ONE P2.2): owner decision 7 (the
 * standing line only at ≥ 50%, the streak in its place — on screen and on the
 * story PNG), the "Next today" target, and exactly one primary button.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { renderStoryImage, storyStatus, visibleStandingPct, type StoryInput } from "@/lib/dailyShare";
import { nextTodayTarget } from "@/components/shell/play/result/nextToday";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

// ── Convex + app context, mocked for the full-screen renders ──────────────

const backend = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  mutations: {} as Record<string, (args: unknown) => Promise<unknown>>,
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown, args: unknown) =>
    args === "skip" ? undefined : backend.queries[getFunctionName(ref as never)],
  useMutation: (ref: unknown) =>
    backend.mutations[getFunctionName(ref as never)] ?? (async () => ({})),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ accountState: "anonymous" }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/gameAnalytics", () => ({
  startRun: vi.fn(),
  noteQuestionAnswered: vi.fn(),
  completeRun: vi.fn(),
  abandonRun: vi.fn(),
}));
vi.mock("@/hooks/useStreakLinkClaim", () => ({ useStreakLinkClaim: () => true }));
vi.mock("@/hooks/useAntiCheat", () => ({ useAntiCheat: () => undefined }));

import WhosOlderPlayScreen from "@/pages/shell/play/WhosOlderPlayScreen";
import MissingLettersPlayScreen from "@/pages/shell/play/MissingLettersPlayScreen";

const DATE = "2026-10-22";
const verdicts = [true, false, false, false, true, false, true, false, false, true];

function olderSession() {
  return {
    sessionId: "s-older",
    kind: "daily",
    status: "completed",
    dateKey: DATE,
    edition: 24,
    score: 4,
    totalRounds: 10,
    roundIndex: 10,
    pending: null,
    history: verdicts.map((correct, i) => ({
      a: { name: `Older ${i}`, dob: "1980-01-01" },
      b: { name: `Younger ${i}`, dob: "1990-01-01" },
      older: "a",
      guess: correct ? "a" : "b",
      correct,
      gapDays: 3650,
    })),
  };
}

function lettersSession() {
  return {
    sessionId: "s-letters",
    kind: "daily",
    status: "completed",
    dateKey: DATE,
    edition: 10,
    score: 4,
    totalRounds: 10,
    roundIndex: 10,
    pending: null,
    history: verdicts.map((correct, i) => ({
      name: `Player ${i}`,
      nation: "Hungary",
      tier: "easy",
      hidden: [1],
      guess: correct ? "A" : "B",
      forfeit: null,
      correct,
    })),
  };
}

function today(standing: { below: number; finishers: number } | null, done = true) {
  return {
    dateKey: DATE,
    edition: 24,
    daily: done ? { status: "completed" } : null,
    standing,
    bestEndless: null,
    streak: { current: 3, best: 3, playedToday: true },
    reminder: { state: "none", email: null },
    challenges: [],
  };
}

function setup(game: "older" | "letters", opts: { standing: { below: number; finishers: number } | null; otherDone: boolean }) {
  const own = game === "older" ? "whosOlder" : "missingLetters";
  const other = game === "older" ? "missingLetters" : "whosOlder";
  backend.queries = {
    [`${own}:getToday`]: today(opts.standing),
    [`${other}:getToday`]: today(null, opts.otherDone),
  };
  const session = game === "older" ? olderSession() : lettersSession();
  backend.mutations = {
    [`${own}:startDaily`]: async () => ({ created: false, session }),
  };
  const Screen = game === "older" ? WhosOlderPlayScreen : MissingLettersPlayScreen;
  render(
    <MemoryRouter initialEntries={[game === "older" ? "/v2/whos-older" : "/v2/missing-letters"]}>
      <Screen />
    </MemoryRouter>,
  );
  return game === "older" ? "whos-older" : "missing-letters";
}

afterEach(cleanup);

describe("visibleStandingPct (decision 7)", () => {
  it("hides the standing below 50% and with too few finishers", () => {
    expect(visibleStandingPct({ below: 4, finishers: 10 })).toBeNull();
    expect(visibleStandingPct({ below: 0, finishers: 13 })).toBeNull();
    expect(visibleStandingPct({ below: 4, finishers: 4 })).toBeNull();
    expect(visibleStandingPct(null)).toBeNull();
  });

  it("shows it from 50% up", () => {
    expect(visibleStandingPct({ below: 5, finishers: 10 })).toBe(50);
    expect(visibleStandingPct({ below: 8, finishers: 13 })).toBe(62);
  });
});

describe("nextTodayTarget", () => {
  it("points each daily at the other one", () => {
    expect(nextTodayTarget("older", false)).toEqual({ kind: "game", game: "letters", route: SHELL_ROUTES.missingLettersPlay });
    expect(nextTodayTarget("letters", false)).toEqual({ kind: "game", game: "older", route: SHELL_ROUTES.whosOlderPlay });
  });

  it("points at the other daily while its state is unknown", () => {
    expect(nextTodayTarget("older", undefined)).toMatchObject({ kind: "game", game: "letters" });
  });

  it("points at Home's Today row once both are done", () => {
    expect(nextTodayTarget("older", true)).toEqual({ kind: "home", route: SHELL_ROUTES.home });
    expect(nextTodayTarget("letters", true)).toEqual({ kind: "home", route: SHELL_ROUTES.home });
  });
});

describe("story PNG status line (decision 7)", () => {
  const base: StoryInput = {
    game: "older",
    title: "Who's Older?",
    edition: 24,
    score: 4,
    total: 10,
    history: verdicts.map((correct) => ({ correct })),
    standing: null,
    streak: null,
    cta: "Can you beat it?",
  };

  /** A recording 2D context: every fillText lands in `texts`. */
  let texts: string[];
  beforeEach(() => {
    texts = [];
    const ctx = new Proxy(
      {
        fillText: (text: string) => texts.push(text),
        measureText: (text: string) => ({ width: text.length * 20 }),
      } as Record<string, unknown>,
      {
        get: (target, key: string) => (key in target ? target[key] : () => undefined),
        set: () => true,
      },
    );
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag !== "canvas") return realCreate(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toBlob: (cb: (b: Blob) => void) => cb(new Blob(["png"])),
      } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
  });
  afterEach(() => vi.restoreAllMocks());

  it("draws the streak, not the standing, below 50%", async () => {
    await renderStoryImage({
      ...base,
      standing: { pct: 31, text: "Better than 31% of today's players" },
      streak: { days: 3, text: "3-day streak" },
    });
    expect(texts).toContain("3-day streak");
    expect(texts.some((t) => t.startsWith("Better than"))).toBe(false);
  });

  it("draws the standing from 50% up", async () => {
    await renderStoryImage({
      ...base,
      standing: { pct: 62, text: "Better than 62% of today's players" },
      streak: { days: 3, text: "3-day streak" },
    });
    expect(texts).toContain("Better than 62% of today's players");
    expect(texts).not.toContain("3-day streak");
  });

  it("draws neither when there is nothing to brag about", () => {
    expect(storyStatus({ standing: { pct: 10, text: "x" }, streak: null })).toBeNull();
    expect(storyStatus({ standing: null, streak: { days: 0, text: "0-day streak" } })).toBeNull();
  });
});

describe.each(["older", "letters"] as const)("%s result screen", (game) => {
  it("hides the standing line below 50%", async () => {
    const tid = setup(game, { standing: { below: 3, finishers: 10 }, otherDone: false });
    await screen.findByTestId(`${tid}-result`);
    expect(screen.queryByTestId(`${tid}-standing`)).toBeNull();
    // The streak is there in its place.
    expect(screen.getByTestId(`${tid}-streak`)).toBeInTheDocument();
  });

  it("shows the standing line from 50% up", async () => {
    const tid = setup(game, { standing: { below: 7, finishers: 10 }, otherDone: false });
    await screen.findByTestId(`${tid}-result`);
    expect(screen.getByTestId(`${tid}-standing`)).toBeInTheDocument();
  });

  it("has exactly one primary button — Share — and no other lime", async () => {
    const tid = setup(game, { standing: { below: 7, finishers: 10 }, otherDone: false });
    const result = await screen.findByTestId(`${tid}-result`);
    const primaries = result.querySelectorAll("button.bg-primary");
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toHaveAttribute("data-testid", `${tid}-challenge-share`);
    expect(result.querySelectorAll(".bg-accent, .bg-action, .bg-lime")).toHaveLength(0);
  });

  it("links Next today to the other daily, then to Home once both are done", async () => {
    const tid = setup(game, { standing: null, otherDone: false });
    const next = await screen.findByTestId(`${tid}-next-today`);
    expect(next).toHaveAttribute(
      "href",
      game === "older" ? SHELL_ROUTES.missingLettersPlay : SHELL_ROUTES.whosOlderPlay,
    );
    cleanup();
    setup(game, { standing: null, otherDone: true });
    expect(await screen.findByTestId(`${tid}-next-today`)).toHaveAttribute("href", SHELL_ROUTES.home);
  });
});
