/**
 * v2-default entry routing contract.
 *
 * Locks in the flag-gated landing behavior added for the "make v2 the default"
 * rollout. The decision lives entirely in `EntryRoute` / `HomeRoute` (for `/`
 * and `/home`) and `ShellGate` (for `/v2/*`), all keyed off `V2_SHELL_ENABLED`:
 *
 *   Flag ON  — a normal (param-less) visit to `/` and any visit to `/home`
 *              reach the v2 shell home; explicit auth deep-links (`?mode=`,
 *              `?from=`) still render the v1 LoginScreen at `/`.
 *   Flag OFF — `/` is the v1 LoginScreen, `/home` is the v1 HomeScreen, and the
 *              whole `/v2/*` surface redirects to `/home` (clean rollback).
 *
 * The flag is mocked via a hoisted mutable so both states are exercised in one
 * file; the leaf screens are stubbed to markers so the test asserts the routing
 * decision, not screen internals (which need a live Convex session).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const flagMock = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/flags", () => ({
  get V2_SHELL_ENABLED() {
    return flagMock.enabled;
  },
  get LEARN_ENABLED() {
    return false;
  },
}));

// Stub the leaf screens to lightweight markers — they pull in Convex/auth and
// are irrelevant to the routing decision under test.
vi.mock("@/pages/LoginScreen", () => ({
  default: () => <div data-testid="v1-login">LOGIN</div>,
}));
vi.mock("@/pages/HomeScreen", () => ({
  default: () => <div data-testid="v1-home">V1 HOME</div>,
}));

import { EntryRoute, HomeRoute } from "@/components/EntryRoutes";
import { ShellGate } from "@/components/shell/ShellGate";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{`${loc.pathname}${loc.search}`}</div>;
}

/** Mirror the App.tsx route table for the routes this rollout touches. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<EntryRoute />} />
        <Route path="/home" element={<HomeRoute />} />
        <Route
          path="/v2"
          element={
            <ShellGate>
              <div data-testid="v2-home">V2 SHELL HOME</div>
            </ShellGate>
          }
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const pathname = () => screen.getByTestId("pathname").textContent;

describe("v2-default entry routing — flag ON", () => {
  beforeEach(() => {
    flagMock.enabled = true;
  });

  it("a bare visit to / lands in the v2 shell home", () => {
    renderAt("/");
    expect(screen.getByTestId("v2-home")).toBeTruthy();
    expect(screen.queryByTestId("v1-login")).toBeNull();
    expect(pathname()).toBe("/v2");
  });

  it("/home redirects to the v2 shell home (post-login + post-game landing)", () => {
    renderAt("/home");
    expect(screen.getByTestId("v2-home")).toBeTruthy();
    expect(screen.queryByTestId("v1-home")).toBeNull();
    expect(pathname()).toBe("/v2");
  });

  it("keeps the password LoginScreen reachable at / for ?mode= auth intents", () => {
    renderAt("/?mode=signin");
    expect(screen.getByTestId("v1-login")).toBeTruthy();
    expect(screen.queryByTestId("v2-home")).toBeNull();
  });

  it("keeps the guest-upgrade and duel deep-links on the LoginScreen", () => {
    renderAt("/?mode=signup&from=guest");
    expect(screen.getByTestId("v1-login")).toBeTruthy();

    renderAt("/?from=duel");
    expect(screen.getAllByTestId("v1-login").length).toBeGreaterThan(0);
  });
});

describe("v2-default entry routing — flag OFF (rollback)", () => {
  beforeEach(() => {
    flagMock.enabled = false;
  });

  it("/ is the v1 LoginScreen", () => {
    renderAt("/");
    expect(screen.getByTestId("v1-login")).toBeTruthy();
    expect(screen.queryByTestId("v2-home")).toBeNull();
  });

  it("/home is the v1 HomeScreen", () => {
    renderAt("/home");
    expect(screen.getByTestId("v1-home")).toBeTruthy();
    expect(screen.queryByTestId("v2-home")).toBeNull();
  });

  it("the v2 surface (/v2/*) redirects to /home", () => {
    renderAt("/v2");
    expect(screen.getByTestId("v1-home")).toBeTruthy();
    expect(screen.queryByTestId("v2-home")).toBeNull();
    expect(pathname()).toBe("/home");
  });
});
