/**
 * Ranks segments contract (VerveQ ONE decision 10).
 *
 * "The Ranks", "The ladder" and "Leaderboard" were three names on three
 * surfaces for one idea. Now Ranks is ONE screen with a Ladder | Leaderboard
 * Segmented control, and both old URLs keep working:
 *  - `/ranks` opens the Ladder segment, `/leaderboard` the Leaderboard;
 *  - switching segments moves to the other URL (replace — a toggle, not a
 *    page), so a refresh or a shared link reopens the same segment;
 *  - THE WEEKEND's gameweek table is one tap away from either segment, and
 *    the tap reports the Weekend entry funnel event.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const trackMock = vi.hoisted(() => ({ calls: [] as Array<[string, unknown]> }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: {} }),
}));
vi.mock("convex/react", () => ({ useQuery: () => undefined }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isFullAccount: false, isUsernameOnly: false, accountState: "loggedOut" }),
}));
vi.mock("@/lib/analytics", () => ({
  track: (event: string, props: unknown) => trackMock.calls.push([event, props]),
}));

import RanksScreen from "@/pages/shell/RanksScreen";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={SHELL_ROUTES.ranks} element={<RanksScreen />} />
        <Route path={SHELL_ROUTES.leaderboard} element={<RanksScreen />} />
        <Route path="*" element={<div data-testid="elsewhere" />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const tab = (name: string) => screen.getByRole("tab", { name });

beforeEach(() => {
  trackMock.calls.length = 0;
});

describe("Ranks — one screen, two segments", () => {
  it("/ranks opens the Ladder", () => {
    renderAt(SHELL_ROUTES.ranks);
    expect(tab("ranks.segments.ladder").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("ranks-ladder")).toBeTruthy();
    expect(screen.queryByTestId("ranks-leaderboard")).toBeNull();
  });

  it("/leaderboard opens the Leaderboard", () => {
    renderAt(SHELL_ROUTES.leaderboard);
    expect(tab("ranks.segments.leaderboard").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("ranks-leaderboard")).toBeTruthy();
    expect(screen.queryByTestId("ranks-ladder")).toBeNull();
  });

  it("switching segments moves to the segment's own URL", async () => {
    renderAt(SHELL_ROUTES.ranks);
    await act(async () => tab("ranks.segments.leaderboard").click());
    expect(screen.getByTestId("where").textContent).toBe(SHELL_ROUTES.leaderboard);
    expect(screen.getByTestId("ranks-leaderboard")).toBeTruthy();
    await act(async () => tab("ranks.segments.ladder").click());
    expect(screen.getByTestId("where").textContent).toBe(SHELL_ROUTES.ranks);
  });

  it("links THE WEEKEND's table and reports the entry", async () => {
    renderAt(SHELL_ROUTES.leaderboard);
    await act(async () => screen.getByTestId("ranks-weekend-table").click());
    expect(screen.getByTestId("where").textContent).toBe(SHELL_ROUTES.weekendLeaderboard);
    expect(trackMock.calls).toEqual([
      ["weekend_entry_clicked", { source: "ranks", placement: "ranks_table" }],
    ]);
  });
});
