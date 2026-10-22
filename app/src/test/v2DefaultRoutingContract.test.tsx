/**
 * Entry routing contract.
 *
 * The decision lives entirely in `EntryRoute` / `HomeRoute` (for `/` and
 * `/home`), keyed off account state: a normal (param-less) visit to `/`
 * resolves by session — anyone with a server identity reaches the shell home; a
 * SIGNED-OUT visitor gets the cold-entry landing (orientation + instant taste
 * round, username ask deferred); while auth settles neither renders (neutral
 * splash). Explicit auth deep-links (`?mode=`, `?from=`) still render the v1
 * LoginScreen at `/`, and `/home` always reaches the shell home.
 *
 * Auth state is mocked via hoisted mutables so all states are exercised in one
 * file; the leaf screens are stubbed to markers so the test
 * asserts the routing decision, not screen internals (which need a live
 * Convex session).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const authMock = vi.hoisted(() => ({
  accountState: "loggedOut" as string,
  isAuthenticated: false,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    accountState: authMock.accountState,
    isAuthenticated: authMock.isAuthenticated,
  }),
}));

// Stub the leaf screens to lightweight markers — they pull in Convex/auth/i18n
// and are irrelevant to the routing decision under test.
vi.mock("@/pages/LoginScreen", () => ({
  default: () => <div data-testid="v1-login">LOGIN</div>,
}));
vi.mock("@/pages/shell/ColdEntryScreen", () => ({
  default: () => <div data-testid="cold-entry">COLD ENTRY</div>,
}));

import { EntryRoute } from "@/components/EntryRoutes";
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
        <Route
          path="/home"
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

const signedIn = () => {
  authMock.accountState = "fullAccount";
  authMock.isAuthenticated = true;
};
const signedOut = () => {
  authMock.accountState = "loggedOut";
  authMock.isAuthenticated = false;
};

describe("entry routing", () => {
  beforeEach(() => {
    signedOut();
  });

  it("a bare visit to / with a session lands in the v2 shell home", () => {
    signedIn();
    renderAt("/");
    expect(screen.getByTestId("v2-home")).toBeTruthy();
    expect(screen.queryByTestId("v1-login")).toBeNull();
    expect(screen.queryByTestId("cold-entry")).toBeNull();
    expect(pathname()).toBe("/home");
  });

  it("a username-only (guest) session also lands in the v2 shell home", () => {
    authMock.accountState = "usernameOnly";
    authMock.isAuthenticated = true;
    renderAt("/");
    expect(screen.getByTestId("v2-home")).toBeTruthy();
    expect(screen.queryByTestId("cold-entry")).toBeNull();
  });

  it("a bare SIGNED-OUT visit to / gets the cold-entry landing, staying at /", async () => {
    renderAt("/");
    expect(await screen.findByTestId("cold-entry")).toBeTruthy();
    expect(screen.queryByTestId("v2-home")).toBeNull();
    expect(screen.queryByTestId("v1-login")).toBeNull();
    expect(pathname()).toBe("/");
  });

  it("never flashes the cold-entry while auth is settling", () => {
    authMock.accountState = "loading";
    authMock.isAuthenticated = false;
    renderAt("/");
    expect(screen.queryByTestId("cold-entry")).toBeNull();
    expect(screen.queryByTestId("v2-home")).toBeNull();
    expect(screen.queryByTestId("v1-login")).toBeNull();
  });

  it("keeps the legacy tab-local guest (mid-session) on the v2 shell home", () => {
    authMock.accountState = "loggedOut";
    authMock.isAuthenticated = true; // tab-local guest: no server identity, but mid-session
    renderAt("/");
    expect(screen.getByTestId("v2-home")).toBeTruthy();
    expect(screen.queryByTestId("cold-entry")).toBeNull();
  });

  it("/home is the shell home (post-login + post-game landing)", () => {
    renderAt("/home");
    expect(screen.getByTestId("v2-home")).toBeTruthy();
    expect(pathname()).toBe("/home");
  });

  it("keeps the password LoginScreen reachable at / for ?mode= auth intents", () => {
    renderAt("/?mode=signin");
    expect(screen.getByTestId("v1-login")).toBeTruthy();
    expect(screen.queryByTestId("v2-home")).toBeNull();
    expect(screen.queryByTestId("cold-entry")).toBeNull();
  });

  it("keeps the guest-upgrade and duel deep-links on the LoginScreen", () => {
    renderAt("/?mode=signup&from=guest");
    expect(screen.getByTestId("v1-login")).toBeTruthy();

    renderAt("/?from=duel");
    expect(screen.getAllByTestId("v1-login").length).toBeGreaterThan(0);
  });
});
