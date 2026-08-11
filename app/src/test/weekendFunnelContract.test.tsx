/**
 * WKND-FUNNEL contract — FW-GO revision.
 *
 * The pre-launch funnel (waitlist teaser + `waitlist_card_viewed`) retired
 * with the launch; its contract lives in git history. What this suite locks
 * now:
 *
 *  1. `/weekend` lands on the WEEKEND HUB (`/v2/weekend`) carrying
 *     attribution — reel traffic promised the fantasy mode gets the mode
 *     itself, not a Home card. Bare hits are tagged `ref=weekend` so
 *     short-link traffic is never bucketed as direct; incoming utm_* params
 *     survive untouched.
 *
 *  2. Old `?w=1` links still reorder Home (WEEKEND card first) — the param
 *     outlives the link that minted it, so nothing breaks for pre-launch
 *     captions that shipped with `/v2?w=1`.
 *
 *  3. The Home entry card renders in both orders without any server read —
 *     the launched mode's entry point cannot be gated off by a backend
 *     hiccup.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName, type FunctionReference } from "convex/server";

import {
  weekendShortLinkTarget,
  isWeekendTopRequested,
  WEEKEND_SHORT_LINK_DEFAULT_REF,
} from "@/lib/weekendDeepLink";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

// ---------------------------------------------------------------------------
// 1. The deep link
// ---------------------------------------------------------------------------

describe("/weekend short link (FW-GO: the hub is the destination)", () => {
  it("lands on the WEEKEND hub", () => {
    const target = weekendShortLinkTarget("");
    expect(target.startsWith(`${SHELL_ROUTES.weekend}?`)).toBe(true);
  });

  it("tags bare hits so short-link traffic is never bucketed as direct", () => {
    const params = new URLSearchParams(
      new URL(weekendShortLinkTarget(""), "https://x").search,
    );
    expect(params.get("ref")).toBe(WEEKEND_SHORT_LINK_DEFAULT_REF);
  });

  it("preserves incoming attribution instead of overwriting it", () => {
    const params = new URLSearchParams(
      new URL(
        weekendShortLinkTarget("?utm_source=ig&utm_medium=social"),
        "https://x",
      ).search,
    );
    expect(params.get("utm_source")).toBe("ig");
    expect(params.get("utm_medium")).toBe("social");
    expect(params.get("ref")).toBeNull();
  });

  it("no longer mints the ?w=1 Home-reorder param — the hub needs no pin", () => {
    const params = new URLSearchParams(
      new URL(weekendShortLinkTarget(""), "https://x").search,
    );
    expect(params.get("w")).toBeNull();
  });

  it("still honours ?w=1 for Home visits from old links", () => {
    expect(isWeekendTopRequested("?w=1")).toBe(true);
    expect(isWeekendTopRequested("")).toBe(false);
    expect(isWeekendTopRequested("?ref=ig")).toBe(false);
    expect(isWeekendTopRequested("?w=0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. The Home reorder old ?w=1 links still produce
// ---------------------------------------------------------------------------

const authMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const convexMock = vi.hoisted(() => ({
  client: {
    query: vi.fn<(ref: unknown, args: unknown) => Promise<unknown>>(),
    mutation: vi.fn<(ref: unknown, args: unknown) => Promise<unknown>>(),
  },
}));
const trackMock = vi.hoisted(() => ({
  calls: [] as Array<[string, Record<string, unknown> | undefined]>,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authMock.value }));
vi.mock("convex/react", () => ({
  useConvex: () => convexMock.client,
  // Home's own numbers are honesty-gated on undefined; this contract cares
  // only about card ORDER, so serving nothing is the right fixture.
  useQuery: () => undefined,
}));
vi.mock("@/lib/flags", () => ({
  V2_SHELL_ENABLED: true,
  LEARN_ENABLED: false,
  // The Draw card must be present for "which card comes first" to mean
  // anything — with it gated off there is nothing to reorder against.
  DRAW_ENABLED: true,
  ANONYMOUS_FIRST_ENABLED: true,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: {} }),
}));
vi.mock("@/lib/analytics", () => ({
  track: (event: string, properties?: Record<string, unknown>) => {
    trackMock.calls.push([event, properties]);
  },
}));
vi.mock("@/lib/coldSession", () => ({ readColdSource: () => undefined }));

import ShellHomeScreen from "@/pages/shell/ShellHomeScreen";

/** Minimal server-shaped Draw payload — just enough for the card to render,
 *  so there are two hero cards whose ORDER can be asserted. The Draw card's
 *  own states are locked by homeDrawCardContract. */
const DRAW_TODAY = {
  dateKey: "2026-07-18",
  boardNumber: 18,
  nextBoardAt: Date.UTC(2026, 6, 19, 6, 30, 0),
  streak: 0,
  boardReady: true as const,
  fixtures: [
    { index: 0, archetypeId: "ARCH_WALL", modifiers: [], threshold: 220, isBoss: false },
  ],
  rules: {
    rows: 6,
    offersPerRow: 3,
    fixtureCount: 5,
    synergyTable: [1, 1.25, 1.6, 2.1],
    bustKeep: 0.25,
    fullClearBonus: 1.5,
    formSpread: 0.2,
    maxSynergyFamilies: 2,
  },
  playState: "unplayed" as const,
  run: null,
};

beforeEach(() => {
  convexMock.client.query.mockReset();
  convexMock.client.mutation.mockReset();
  // Route by function NAME: the generated api is a proxy that mints a fresh
  // reference per access, so identity comparison never matches.
  convexMock.client.query.mockImplementation(async (ref: unknown) => {
    const name = getFunctionName(
      ref as FunctionReference<"query" | "mutation">,
    );
    if (name.startsWith("draw:getToday")) return DRAW_TODAY;
    if (name.startsWith("draw:getLeaderboard")) return { me: null };
    return null;
  });
  trackMock.calls.length = 0;
  authMock.value = { hasUsername: true, accountState: "usernameOnly" };
  window.history.replaceState({}, "", "/v2");
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("Home card order", () => {
  /** DOM position of the two hero cards, or -1 when a card is absent. */
  async function renderHomeAt(path: string) {
    const { container } = render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/v2" element={<ShellHomeScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    await act(async () => {});
    const html = container.innerHTML;
    return {
      weekend: html.indexOf('data-testid="home-weekend-card"'),
      draw: html.indexOf('data-testid="home-draw-card"'),
    };
  }

  it("leads with the WEEKEND card on a ?w=1 visit (old links keep working)", async () => {
    const { weekend, draw } = await renderHomeAt("/v2?w=1");
    expect(weekend).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(weekend).toBeLessThan(draw);
  });

  it("keeps the original Draw-first order for an ordinary visit", async () => {
    const { weekend, draw } = await renderHomeAt("/v2");
    expect(weekend).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(draw).toBeLessThan(weekend);
  });

  it("renders the WEEKEND entry card with no server read behind it", async () => {
    // Every query resolves null (see the mock) — the launched mode's entry
    // point must render regardless.
    const { weekend } = await renderHomeAt("/v2");
    expect(weekend).toBeGreaterThanOrEqual(0);
  });
});
