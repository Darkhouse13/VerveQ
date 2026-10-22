/**
 * Deep-link routing contract for legacy URLs.
 *
 * QA hit shared/bookmarkable URLs directly and found them landing on the home
 * shell or a 404 instead of the surface they name. This locks the fix:
 *
 *  1. `LegacyRedirect` behavior — forwards to the shell surface, preserving
 *     incoming query params over defaults.
 *  2. `DropV2Redirect` — the shell's old `/v2/...` URLs land on the same page
 *     without the prefix (`/v2` itself → `/home`), query and hash kept.
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

import { LegacyRedirect, DropV2Redirect } from "@/components/LegacyRedirect";

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

function FullProbe() {
  const loc = useLocation();
  return <div data-testid="full">{`${loc.pathname}${loc.search}${loc.hash}`}</div>;
}

function renderAliasFull(entry: string, path: string, to: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={<LegacyRedirect to={to} />} />
        <Route path="*" element={<div data-testid="destination" />} />
      </Routes>
      <FullProbe />
    </MemoryRouter>,
  );
}

describe("LegacyRedirect behavior", () => {
  it("forwards to the mode's page with default params", () => {
    renderAlias("/daily-quiz", "/daily-quiz", "/daily?sport=football");
    expect(screen.getByTestId("destination")).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe(
      "/daily?sport=football",
    );
  });

  it("incoming query params survive and win over defaults", () => {
    renderAlias(
      "/quiz?sport=football&difficulty=hard",
      "/quiz",
      "/quiz?sport=football",
    );
    const dest = screen.getByTestId("pathname").textContent!;
    expect(dest.startsWith("/quiz?")).toBe(true);
    expect(dest).toContain("difficulty=hard");
    expect(dest).toContain("sport=football");
  });

  // Decision 10: `/compete#x` → `/home#x` — an incoming anchor survives and
  // wins over the alias's default one.
  it("carries the anchor: the incoming one wins, else the alias's default", () => {
    const { unmount } = renderAliasFull("/compete#today", "/compete", "/home#more");
    expect(screen.getByTestId("full").textContent).toBe("/home#today");
    unmount();
    renderAliasFull("/compete?ref=seo", "/compete", "/home#more");
    expect(screen.getByTestId("full").textContent).toBe("/home?ref=seo#more");
  });

  it.each([
    ["/v2", "/home"],
    ["/v2/", "/home"],
    ["/v2?w=1#more", "/home?w=1#more"],
    ["/v2/arena/E8M8JF", "/arena/E8M8JF"],
    ["/v2/weekend/squad?entry=builder&ref=weekend", "/weekend/squad?entry=builder&ref=weekend"],
    ["/v2/whos-older?ref=older", "/whos-older?ref=older"],
  ])("drops the old /v2 prefix: %s → %s", (from, to) => {
    render(
      <MemoryRouter initialEntries={[from]}>
        <Routes>
          <Route path="/v2" element={<DropV2Redirect />} />
          <Route path="/v2/*" element={<DropV2Redirect />} />
          <Route path="*" element={<div data-testid="destination" />} />
        </Routes>
        <FullProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("destination")).toBeTruthy();
    expect(screen.getByTestId("full").textContent).toBe(to);
  });
});

/**
 * Every deep link → shell surface pair App.tsx must wire via LegacyRedirect. The
 * surfaces are the ones the v2 UI itself exposes (compete tiles, shell nav) —
 * see competeModeTiles.ts and shellRoutes.ts.
 */
const EXPECTED_ALIASES: Array<[path: string, target: string]> = [
  ["/challenge", "/duels"],
  ["/duel", "/duels"],
  ["/daily-quiz", "/daily?sport=football"],
  // /live-match left this table 2026-07: the dead Live Match surface was
  // removed outright, so the old URL now 404s instead of aliasing.
  ["/higherlower", "/higher-lower?sport=football"],
  ["/vervegrid", "/verve-grid?sport=football"],
  ["/learn/geography", "/learn"],
  ["/learn/geography/:nodeId", "/learn"],
  ["/learn/prototype", "/learn"],
  // Decision 10: Compete merged into Play; the catalogue opens on #more.
  ["/sport-select", "/home#more"],
  ["/compete", "/home#more"],
  ["/compete/sport", "/home#more"],
  ["/compete/sport/:sport", "/home#more"],
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

  // The shell's own pages sit at the top level now (the /v2 prefix is gone),
  // so these paths are the pages themselves, never a redirect.
  it.each([
    "/leaderboard", "/ranks", "/profile", "/quiz", "/survival", "/duels",
    "/duels/history", "/arena", "/rivals", "/daily", "/blitz", "/forge",
    "/higher-lower", "/verve-grid", "/learn",
  ])("serves %s as a page, not a redirect", (path) => {
    const escaped = path.replace(/\//g, "\\/");
    expect(appSource).toMatch(new RegExp(`path="${escaped}"\\s+element=\\{\\s*<ShellGate>`));
    expect(appSource).not.toContain(`path="${path}" element={<LegacyRedirect`);
  });

  it("keeps the arena lobby code in the URL", () => {
    expect(appSource).toContain('path="/arena/:code" element={<ShellGate><ArenaPlayScreen />');
  });

  it("redirects every old /v2 URL", () => {
    expect(appSource).toContain('<Route path="/v2" element={<DropV2Redirect />} />');
    expect(appSource).toContain('<Route path="/v2/*" element={<DropV2Redirect />} />');
  });

  // Decision 10: Ranks is one screen with a Ladder | Leaderboard segment;
  // both URLs stay and open it on the right segment.
  it("routes /ranks and /leaderboard to the one Ranks screen", () => {
    expect(appSource).toContain('path="/ranks" element={<ShellGate><RanksScreen /></ShellGate>}');
    expect(appSource).toContain('path="/leaderboard" element={<ShellGate><RanksScreen /></ShellGate>}');
    expect(appSource).not.toContain("ShellLeaderboardScreen");
  });

  it("serves the rival page at /rivals/:opponentUserId", () => {
    expect(appSource).toMatch(/path="\/rivals\/:opponentUserId"\s+element=\{\s*<ShellGate>/);
  });

  it("registers the arena hub and legal pages", () => {
    expect(appSource).toContain('path="/arena"');
    expect(appSource).toContain('path="/privacy"');
    expect(appSource).toContain('path="/terms"');
  });
});
