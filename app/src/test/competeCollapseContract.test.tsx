/**
 * Compete-collapse routing contract.
 *
 * With Sport the only live category and Football the only live sport, the
 * Compete drill (category step → sport step → mode grid) is collapsed: the
 * COMPETE nav tab / Home pillar lands DIRECTLY on the mode grid in ONE step,
 * and the old step URLs redirect to it so deep links keep working. The step
 * screens stay parked in pages/shell/ for cheap reintroduction.
 *
 * Two layers are locked in:
 *  1. Routing — mirrors the App.tsx route table for /compete/*; the grid screen
 *     is stubbed to a marker (it needs i18n + Convex-adjacent chrome).
 *  2. Tile targets — the REAL grid config (COMPETE_MODE_TILES) must keep Arena
 *     and Duels reachable from the landing screen (they were the collapsed
 *     category step's tiles) and route every tile to an existing deep link.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

const flagMock = vi.hoisted(() => ({ enabled: true }));

vi.mock("@/lib/flags", () => ({
  get V2_SHELL_ENABLED() {
    return flagMock.enabled;
  },
  get LEARN_ENABLED() {
    return false;
  },
}));

// Stub the grid screen for the routing layer — the routing decision under test
// lives in the route table, not the screen.
vi.mock("@/pages/shell/CompeteModeGridScreen", () => ({
  default: () => <div data-testid="mode-grid">MODE GRID</div>,
}));

import { ShellGate } from "@/components/shell/ShellGate";
import CompeteModeGridScreen from "@/pages/shell/CompeteModeGridScreen";
import { COMPETE_MODE_TILES } from "@/pages/shell/competeModeTiles";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{loc.pathname}</div>;
}

/** Mirror the App.tsx route table for the compete surface. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/home" element={<div data-testid="v1-home">V1 HOME</div>} />
        <Route path="/compete" element={<ShellGate><CompeteModeGridScreen /></ShellGate>} />
        <Route path="/compete/sport" element={<ShellGate><Navigate to="/compete" replace /></ShellGate>} />
        <Route path="/compete/sport/:sport" element={<ShellGate><Navigate to="/compete" replace /></ShellGate>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const pathname = () => screen.getByTestId("pathname").textContent;

describe("compete collapse — flag ON", () => {
  beforeEach(() => {
    flagMock.enabled = true;
  });

  it("/compete lands directly on the mode grid (ONE step)", () => {
    renderAt("/compete");
    expect(screen.getByTestId("mode-grid")).toBeTruthy();
    expect(pathname()).toBe("/compete");
  });

  it("the old sport-step URL redirects to the grid", () => {
    renderAt("/compete/sport");
    expect(screen.getByTestId("mode-grid")).toBeTruthy();
    expect(pathname()).toBe("/compete");
  });

  it("old per-sport grid URLs redirect to the grid", () => {
    for (const path of ["/compete/sport/football", "/compete/sport/basketball"]) {
      const { unmount } = renderAt(path);
      expect(screen.getByTestId("mode-grid")).toBeTruthy();
      expect(pathname()).toBe("/compete");
      unmount();
    }
  });
});

describe("compete collapse — flag OFF (rollback)", () => {
  beforeEach(() => {
    flagMock.enabled = false;
  });

  it("the whole /compete surface redirects to /home", () => {
    for (const path of ["/compete", "/compete/sport", "/compete/sport/football"]) {
      const { unmount } = renderAt(path);
      expect(screen.getByTestId("v1-home")).toBeTruthy();
      expect(screen.queryByTestId("mode-grid")).toBeNull();
      expect(pathname()).toBe("/home");
      unmount();
    }
  });
});

describe("compete grid tile targets (real config)", () => {
  const tileTarget = (key: string) => {
    const tile = COMPETE_MODE_TILES.find((t) => t.key === key);
    expect(tile, `tile "${key}" must stay on the Compete landing grid`).toBeTruthy();
    return tile!.to("football");
  };

  it("keeps Arena and Duels reachable — and DISTINCT (arena hub vs duels hub)", () => {
    expect(tileTarget("arena")).toBe(SHELL_ROUTES.arena);
    expect(tileTarget("duel")).toBe(SHELL_ROUTES.duels);
    expect(SHELL_ROUTES.arena).not.toBe(SHELL_ROUTES.duels);
  });

  it("routes every tile to a concrete path (no dead tiles)", () => {
    for (const tile of COMPETE_MODE_TILES) {
      expect(tile.to("football")).toMatch(/^\//);
    }
  });
});
