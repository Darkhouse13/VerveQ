/**
 * THE WEEKEND home entry card contract (FW-GO).
 *
 * Supersedes the FW-P1 teaser contract (homeWeekendTeaserContract): the mode
 * is live, the waitlist is retired. Locks:
 *  - the card renders unconditionally — no server gate, no query, no auth
 *    dependency (the surfaces behind it carry the fail-closed states);
 *  - PLAY NOW navigates to the WEEKEND hub route;
 *  - `weekend_entry_clicked` fires on the tap with utm-derived source, and no
 *    retired `waitlist_*` / `teaser_*` event is ever emitted;
 *  - no waitlist UI (email input, count line, COUNT ME IN) exists.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const navigateMock = vi.hoisted(() => ({
  calls: [] as string[],
}));
const trackMock = vi.hoisted(() => ({
  calls: [] as Array<[string, Record<string, unknown> | undefined]>,
}));
const coldSourceMock = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => (to: string) => {
    navigateMock.calls.push(to);
  },
}));
vi.mock("@/lib/analytics", () => ({
  track: (event: string, properties?: Record<string, unknown>) => {
    trackMock.calls.push([event, properties]);
  },
}));
vi.mock("@/lib/coldSession", () => ({
  readColdSource: () => coldSourceMock.value,
}));

import { HomeWeekendCard } from "@/components/weekend/HomeWeekendCard";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

beforeEach(() => {
  navigateMock.calls.length = 0;
  trackMock.calls.length = 0;
  coldSourceMock.value = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("unconditional entry card", () => {
  it("renders with no server read and no auth dependency", () => {
    render(<HomeWeekendCard />);
    expect(screen.getByTestId("home-weekend-card")).toBeTruthy();
    expect(screen.getByTestId("weekend-cta-play")).toBeTruthy();
    // Rendering alone emits nothing — events are actions, not route views.
    expect(trackMock.calls).toHaveLength(0);
  });

  it("carries no waitlist UI — the FW-P1 surface is retired", () => {
    render(<HomeWeekendCard />);
    expect(screen.queryByTestId("weekend-email-input")).toBeNull();
    expect(screen.queryByTestId("weekend-cta-user")).toBeNull();
    expect(screen.queryByTestId("weekend-cta-email")).toBeNull();
    expect(screen.queryByTestId("weekend-count")).toBeNull();
    expect(screen.queryByText(/count me in/i)).toBeNull();
    expect(screen.queryByText(/email/i)).toBeNull();
  });
});

describe("PLAY NOW", () => {
  it("navigates to the WEEKEND hub and fires weekend_entry_clicked", () => {
    render(<HomeWeekendCard />);
    fireEvent.click(screen.getByTestId("weekend-cta-play"));
    expect(navigateMock.calls).toEqual([SHELL_ROUTES.weekend]);
    expect(trackMock.calls).toEqual([
      ["weekend_entry_clicked", { source: "home_card", placement: "home_card" }],
    ]);
  });

  it("attributes the tap to the utm-derived source when one exists", () => {
    coldSourceMock.value = "ig_bio";
    render(<HomeWeekendCard />);
    fireEvent.click(screen.getByTestId("weekend-cta-play"));
    expect(trackMock.calls).toEqual([
      ["weekend_entry_clicked", { source: "ig_bio", placement: "home_card" }],
    ]);
  });

  it("never emits a retired waitlist_* or teaser_* event", () => {
    render(<HomeWeekendCard />);
    fireEvent.click(screen.getByTestId("weekend-cta-play"));
    for (const [event] of trackMock.calls) {
      expect(event.startsWith("waitlist_")).toBe(false);
      expect(event.startsWith("teaser_")).toBe(false);
    }
  });
});
