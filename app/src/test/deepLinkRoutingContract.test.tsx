/**
 * Deep-link routing contract for the v2-default rollout.
 *
 * QA hit shared/bookmarkable URLs directly and found them landing on the home
 * shell or a 404 instead of the surface they name. This locks the fix:
 *
 *  1. `V2Redirect` behavior — flag ON forwards to the v2 surface (preserving
 *     incoming query params over defaults); flag OFF renders children
 *     untouched (the v1 route, or NotFound for pure aliases) so the flag-off
 *     app stays byte-for-byte v1.
 *  2. `V2ArenaCodeRedirect` — v1 arena invite links keep their lobby code.
 *  3. The App.tsx wiring — every deep link QA exercised (plus its spelling
 *     variants) is wrapped to the expected v2 target. Asserted at the source
 *     level so removing or retargeting a single alias fails this test.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Route the path through a variable: a literal inside `new URL(..., import.meta.url)`
// gets statically rewritten by Vite to a non-file asset URL, which breaks
// fileURLToPath at collection time.
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const flagMock = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/lib/flags", () => ({
  get V2_SHELL_ENABLED() {
    return flagMock.enabled;
  },
}));

import { V2Redirect, V2ArenaCodeRedirect } from "@/components/V2Redirect";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{`${loc.pathname}${loc.search}`}</div>;
}

function renderAlias(entry: string, path: string, to: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path={path}
          element={
            <V2Redirect to={to}>
              <div data-testid="flag-off-children" />
            </V2Redirect>
          }
        />
        <Route path="*" element={<div data-testid="destination" />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("V2Redirect behavior", () => {
  beforeEach(() => {
    flagMock.enabled = true;
  });

  it("flag ON: forwards to the v2 surface with default params", () => {
    renderAlias("/daily", "/daily", "/v2/daily?sport=football");
    expect(screen.getByTestId("destination")).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe(
      "/v2/daily?sport=football",
    );
  });

  it("flag ON: incoming query params survive and win over defaults", () => {
    renderAlias(
      "/quiz?sport=football&difficulty=hard",
      "/quiz",
      "/v2/quiz?sport=football",
    );
    const dest = screen.getByTestId("pathname").textContent!;
    expect(dest.startsWith("/v2/quiz?")).toBe(true);
    expect(dest).toContain("difficulty=hard");
    expect(dest).toContain("sport=football");
  });

  it("flag OFF: renders children unchanged (byte-for-byte v1)", () => {
    flagMock.enabled = false;
    renderAlias("/daily", "/daily", "/v2/daily?sport=football");
    expect(screen.getByTestId("flag-off-children")).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe("/daily");
  });

  it("flag ON: v1 arena invite links keep their lobby code", () => {
    render(
      <MemoryRouter initialEntries={["/arena/E8M8JF"]}>
        <Routes>
          <Route
            path="/arena/:code"
            element={
              <V2ArenaCodeRedirect>
                <div data-testid="v1-arena" />
              </V2ArenaCodeRedirect>
            }
          />
          <Route path="*" element={<div data-testid="destination" />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("pathname").textContent).toBe("/v2/arena/E8M8JF");
  });

  it("flag OFF: v1 arena route renders untouched", () => {
    flagMock.enabled = false;
    render(
      <MemoryRouter initialEntries={["/arena/E8M8JF"]}>
        <Routes>
          <Route
            path="/arena/:code"
            element={
              <V2ArenaCodeRedirect>
                <div data-testid="v1-arena" />
              </V2ArenaCodeRedirect>
            }
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("v1-arena")).toBeTruthy();
  });
});

/**
 * Every deep link → v2 surface pair App.tsx must wire via V2Redirect. The
 * surfaces are the ones the v2 UI itself exposes (compete tiles, shell nav) —
 * see competeModeTiles.ts and shellRoutes.ts.
 */
const EXPECTED_ALIASES: Array<[path: string, target: string]> = [
  ["/leaderboard", "/v2/leaderboard"],
  ["/ranks", "/v2/ranks"],
  ["/profile", "/v2/profile"],
  ["/quiz", "/v2/quiz?sport=football"],
  ["/survival", "/v2/survival?sport=football"],
  ["/challenge", "/v2/duels"],
  ["/duel", "/v2/duels"],
  ["/duels", "/v2/duels"],
  ["/arena", "/v2/arena"],
  ["/rivals", "/v2/rivals"],
  ["/daily-quiz", "/v2/daily?sport=football"],
  ["/daily", "/v2/daily?sport=football"],
  ["/blitz", "/v2/blitz?sport=football"],
  ["/live-match", "/v2/live-match"],
  ["/forge", "/v2/forge"],
  ["/higher-lower", "/v2/higher-lower?sport=football"],
  ["/higherlower", "/v2/higher-lower?sport=football"],
  ["/verve-grid", "/v2/verve-grid?sport=football"],
  ["/vervegrid", "/v2/verve-grid?sport=football"],
  ["/who-am-i", "/v2/who-am-i?sport=football"],
  ["/whoami", "/v2/who-am-i?sport=football"],
  ["/learn", "/v2/learn"],
];

describe("App.tsx deep-link wiring (source contract)", () => {
  const appSource = read("../App.tsx");

  it.each(EXPECTED_ALIASES)("wires %s → %s", (path, target) => {
    // The Route for `path` must mount a V2Redirect to `target` (within the
    // same route element — JSX formatting puts them within a few lines).
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const re = new RegExp(
      `path="${escapedPath}"[\\s\\S]{0,200}?<V2Redirect to="${escapedTarget}"`,
    );
    expect(appSource).toMatch(re);
  });

  it("wires /arena/:code through the code-preserving redirect", () => {
    expect(appSource).toMatch(
      /path="\/arena\/:code"[\s\S]{0,200}?<V2ArenaCodeRedirect>/,
    );
  });

  it("registers the v2 arena hub and legal pages", () => {
    expect(appSource).toContain('path="/v2/arena"');
    expect(appSource).toContain('path="/privacy"');
    expect(appSource).toContain('path="/terms"');
  });
});
