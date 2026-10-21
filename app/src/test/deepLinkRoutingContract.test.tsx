/**
 * Deep-link routing contract for legacy URLs.
 *
 * QA hit shared/bookmarkable URLs directly and found them landing on the home
 * shell or a 404 instead of the surface they name. This locks the fix:
 *
 *  1. `LegacyRedirect` behavior — forwards to the shell surface, preserving
 *     incoming query params over defaults.
 *  2. `LegacyArenaCodeRedirect` — v1 arena invite links keep their lobby code.
 *  3. The App.tsx wiring — every deep link QA exercised (plus its spelling
 *     variants) redirects to the expected shell target. Asserted at the source
 *     level so removing or retargeting a single alias fails this test.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Route the path through a variable: a literal inside `new URL(..., import.meta.url)`
// gets statically rewritten by Vite to a non-file asset URL, which breaks
// fileURLToPath at collection time.
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

import { LegacyRedirect, LegacyArenaCodeRedirect } from "@/components/LegacyRedirect";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{`${loc.pathname}${loc.search}`}</div>;
}

function renderAlias(entry: string, path: string, to: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={<LegacyRedirect to={to} />} />
        <Route path="*" element={<div data-testid="destination" />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("LegacyRedirect behavior", () => {
  it("forwards to the v2 surface with default params", () => {
    renderAlias("/daily", "/daily", "/v2/daily?sport=football");
    expect(screen.getByTestId("destination")).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe(
      "/v2/daily?sport=football",
    );
  });

  it("incoming query params survive and win over defaults", () => {
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

  it("v1 arena invite links keep their lobby code", () => {
    render(
      <MemoryRouter initialEntries={["/arena/E8M8JF"]}>
        <Routes>
          <Route path="/arena/:code" element={<LegacyArenaCodeRedirect />} />
          <Route path="*" element={<div data-testid="destination" />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("pathname").textContent).toBe("/v2/arena/E8M8JF");
  });
});

/**
 * Every deep link → shell surface pair App.tsx must wire via LegacyRedirect. The
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
  // /live-match left this table 2026-07: the dead Live Match surface was
  // removed outright, so the old URL now 404s instead of aliasing.
  ["/forge", "/v2/forge"],
  ["/higher-lower", "/v2/higher-lower?sport=football"],
  ["/higherlower", "/v2/higher-lower?sport=football"],
  ["/verve-grid", "/v2/verve-grid?sport=football"],
  ["/vervegrid", "/v2/verve-grid?sport=football"],
  ["/learn", "/v2/learn"],
  ["/learn/geography", "/v2/learn"],
  ["/learn/geography/:nodeId", "/v2/learn"],
  ["/learn/prototype", "/v2/learn"],
  ["/sport-select", "/compete"],
  ["/duels/history", "/v2/duels/history"],
];

describe("App.tsx deep-link wiring (source contract)", () => {
  const appSource = read("../App.tsx");

  it.each(EXPECTED_ALIASES)("wires %s → %s", (path, target) => {
    // The Route for `path` must mount a LegacyRedirect to `target`.
    const escapedPath = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    const re = new RegExp(
      `path="${escapedPath}" element=\\{<LegacyRedirect to="${escapedTarget}" />\\}`,
    );
    expect(appSource).toMatch(re);
  });

  it("wires /arena/:code through the code-preserving redirect", () => {
    expect(appSource).toMatch(
      /path="\/arena\/:code" element=\{<LegacyArenaCodeRedirect \/>\}/,
    );
  });

  it("registers the v2 arena hub and legal pages", () => {
    expect(appSource).toContain('path="/v2/arena"');
    expect(appSource).toContain('path="/privacy"');
    expect(appSource).toContain('path="/terms"');
  });
});
