/**
 * WKND-FUNNEL contract — the waitlist deep link and the viewport-qualified
 * "card was actually seen" event.
 *
 * Two things are locked here, and both exist because of what the 30-day
 * PostHog read showed:
 *
 *  1. `/weekend` lands on Home with the teaser FIRST. Reel traffic was
 *     previously sent to `/play`, which redirects into Career Path and never
 *     renders the WEEKEND card at all; a bare `/` is worse still for the
 *     target audience, since a signed-out visitor gets the cold-entry taste
 *     round (also no card). The short link must therefore go straight to the
 *     shell Home — which has no session guard — carrying attribution.
 *
 *  2. `waitlist_card_viewed` fires on genuine visibility, NOT on mount.
 *     `teaser_viewed` fires when the gate query resolves, so it counted 111
 *     events from 17 people, including people who never scrolled to the card.
 *     The new event mirrors the SEO funnel's `landing_cta_shown` rule
 *     (>=50% in viewport AND the tab foregrounded) and carries `placement`,
 *     so tap-rate above the fold can be compared with tap-rate below it.
 *
 * The existing three events are deliberately UNTOUCHED — aliasing them would
 * double-count every conversion already captured.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getFunctionName, type FunctionReference } from "convex/server";

import {
  weekendShortLinkTarget,
  isWeekendTopRequested,
  WEEKEND_SHORT_LINK_DEFAULT_REF,
} from "@/lib/weekendDeepLink";

// ---------------------------------------------------------------------------
// 1. The deep link
// ---------------------------------------------------------------------------

describe("/weekend short link", () => {
  it("lands on the shell Home with the teaser pinned to the top", () => {
    const target = weekendShortLinkTarget("");
    expect(target.startsWith("/v2?")).toBe(true);
    expect(isWeekendTopRequested(new URL(target, "https://x").search)).toBe(true);
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
    // The whole point of the bio link: utm_source must survive to the teaser,
    // which reads `utm_source ?? ref` for its own `source` property.
    expect(params.get("utm_source")).toBe("ig");
    expect(params.get("utm_medium")).toBe("social");
    expect(params.get("ref")).toBeNull();
  });

  it("does not claim the top slot for an ordinary Home visit", () => {
    expect(isWeekendTopRequested("")).toBe(false);
    expect(isWeekendTopRequested("?ref=ig")).toBe(false);
    expect(isWeekendTopRequested("?w=0")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. The viewport-qualified event
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
  // Home's own numbers are honesty-gated on undefined; the funnel contract
  // cares only about card ORDER, so serving nothing is the right fixture.
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

import { HomeWeekendTeaser } from "@/components/weekend/HomeWeekendTeaser";
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

/** Controllable IntersectionObserver — jsdom ships none. */
const observers: Array<{
  cb: IntersectionObserverCallback;
  el: Element | null;
  disconnected: boolean;
}> = [];

function installObserver() {
  observers.length = 0;
  class FakeIO {
    cb: IntersectionObserverCallback;
    entry: { cb: IntersectionObserverCallback; el: Element | null; disconnected: boolean };
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      this.entry = { cb, el: null, disconnected: false };
      observers.push(this.entry);
    }
    observe(el: Element) {
      this.entry.el = el;
    }
    disconnect() {
      this.entry.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO as unknown as typeof IntersectionObserver);
}

/** Drive the observer as the browser would. */
function scrollIntoView(isIntersecting = true) {
  act(() => {
    for (const o of observers) {
      if (o.disconnected) continue;
      o.cb(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    }
  });
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

async function renderTeaser() {
  const utils = render(<HomeWeekendTeaser />);
  await act(async () => {});
  return utils;
}

const viewedCalls = () =>
  trackMock.calls.filter(([e]) => e === "waitlist_card_viewed");

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
    return { member: false, count: 0 };
  });
  convexMock.client.mutation.mockResolvedValue({ ok: true, joined: true });
  trackMock.calls.length = 0;
  authMock.value = { hasUsername: true, accountState: "usernameOnly" };
  installObserver();
  setVisibility("visible");
  window.history.replaceState({}, "", "/v2");
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("waitlist_card_viewed", () => {
  it("does NOT fire on mount — mounting is not seeing", async () => {
    await renderTeaser();
    // The card is rendered and the gate resolved...
    expect(screen.getByTestId("home-weekend-teaser")).toBeInTheDocument();
    expect(trackMock.calls.some(([e]) => e === "teaser_viewed")).toBe(true);
    // ...but nobody has scrolled to it.
    expect(viewedCalls()).toHaveLength(0);
  });

  it("fires once the card is genuinely on screen", async () => {
    await renderTeaser();
    scrollIntoView();
    expect(viewedCalls()).toHaveLength(1);
  });

  it("never fires twice, however much the card scrolls in and out", async () => {
    await renderTeaser();
    scrollIntoView();
    scrollIntoView(false);
    scrollIntoView();
    expect(viewedCalls()).toHaveLength(1);
  });

  it("does not count a backgrounded tab as seen", async () => {
    setVisibility("hidden");
    await renderTeaser();
    scrollIntoView();
    expect(viewedCalls()).toHaveLength(0);
  });

  it("reports when a backgrounded tab with the card in view is returned to", async () => {
    setVisibility("hidden");
    await renderTeaser();
    scrollIntoView();
    expect(viewedCalls()).toHaveLength(0);
    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(viewedCalls()).toHaveLength(1);
  });

  it("reports nothing at all when IntersectionObserver is absent", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    await renderTeaser();
    // A missing step is honest; a fabricated one corrupts the funnel.
    expect(viewedCalls()).toHaveLength(0);
  });

  it("carries placement so above-fold tap-rate is measurable", async () => {
    window.history.replaceState({}, "", "/v2?w=1");
    await renderTeaser();
    scrollIntoView();
    expect(viewedCalls()[0][1]).toMatchObject({ placement: "top" });
  });

  it("marks an ordinary Home visit as the default placement", async () => {
    await renderTeaser();
    scrollIntoView();
    expect(viewedCalls()[0][1]).toMatchObject({ placement: "default" });
  });

  it("never carries an email address", async () => {
    window.history.replaceState({}, "", "/v2?w=1&utm_source=ig");
    await renderTeaser();
    scrollIntoView();
    const props = JSON.stringify(viewedCalls()[0][1]);
    expect(props).not.toContain("@");
  });

  it("leaves the three existing events untouched (no double-counting)", async () => {
    await renderTeaser();
    scrollIntoView();
    // teaser_viewed still fires exactly once, on the gate resolving.
    expect(trackMock.calls.filter(([e]) => e === "teaser_viewed")).toHaveLength(1);
    // And no alias of the tap/submit events was introduced.
    const names = trackMock.calls.map(([e]) => e);
    expect(names).not.toContain("waitlist_cta_tapped");
    expect(names).not.toContain("waitlist_submitted");
  });
});

// ---------------------------------------------------------------------------
// 3. The Home reorder the deep link exists to produce
// ---------------------------------------------------------------------------

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
      weekend: html.indexOf('data-testid="home-weekend-teaser"'),
      draw: html.indexOf('data-testid="home-draw-card"'),
    };
  }

  it("leads with the WEEKEND card on a ?w=1 visit", async () => {
    const { weekend, draw } = await renderHomeAt("/v2?w=1");
    expect(weekend).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThanOrEqual(0);
    // The lime CTA is what a reel visitor was promised — it comes first.
    expect(weekend).toBeLessThan(draw);
  });

  it("keeps the original Draw-first order for an ordinary visit", async () => {
    const { weekend, draw } = await renderHomeAt("/v2");
    expect(weekend).toBeGreaterThanOrEqual(0);
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(draw).toBeLessThan(weekend);
  });
});
