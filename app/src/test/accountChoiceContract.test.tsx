/**
 * Account-chooser contract.
 *
 * A logged-out visitor who hits a gated shell surface (Profile tab, casual
 * modes, Learn) must be offered an explicit choice — sign in, create an
 * account, or play as a guest — instead of being dropped straight onto the
 * bare username ask. The username-only ask stays reserved for the guest
 * choice and invite flows (Arena codes preserve their inline onboarding).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const navigateSpy = vi.fn();
const authContextMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: authContextMock.useAuth,
  AuthError: class AuthError extends Error {},
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
  }),
}));

import AccountChoiceScreen from "@/pages/shell/AccountChoiceScreen";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/v2/account" element={<AccountChoiceScreen />} />
        <Route path="/v2/profile" element={<div>PROFILE_TARGET</div>} />
        <Route path="/v2" element={<div>HOME_TARGET</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountChoiceScreen", () => {
  it("offers sign-in, create-account, and guest paths with next threaded", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "loggedOut",
      hasUsername: false,
    });
    renderAt("/v2/account?next=%2Fv2%2Fprofile");

    fireEvent.click(screen.getByText("account.create"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/?mode=signup&next=%2Fv2%2Fprofile",
    );

    fireEvent.click(screen.getByText("account.signIn"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/?mode=signin&next=%2Fv2%2Fprofile",
    );

    fireEvent.click(screen.getByText("account.guest"));
    expect(navigateSpy).toHaveBeenLastCalledWith(
      "/v2/welcome?next=%2Fv2%2Fprofile",
    );
  });

  it("bounces visitors who already have a username straight to next", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "usernameOnly",
      hasUsername: true,
    });
    renderAt("/v2/account?next=%2Fv2%2Fprofile");
    expect(screen.getByText("PROFILE_TARGET")).toBeInTheDocument();
  });

  it("rejects external next targets (open redirect)", () => {
    authContextMock.useAuth.mockReturnValue({
      accountState: "usernameOnly",
      hasUsername: true,
    });
    renderAt("/v2/account?next=%2F%2Fevil.example");
    expect(screen.getByText("HOME_TARGET")).toBeInTheDocument();
  });
});

describe("gating routes through the chooser (source contract)", () => {
  const guards = read("../components/shell/ShellRouteGuards.tsx");
  const app = read("../App.tsx");

  it("UsernameOnlyRoute sends logged-out visitors to the account chooser, not the username ask", () => {
    expect(guards).toMatch(
      /UsernameOnlyRoute[\s\S]{0,400}accountChoiceUrl\(next\)/,
    );
    expect(guards).not.toContain("welcomeUrl");
  });

  it("registers /v2/account inside the shell without a username gate", () => {
    const line = app.split("\n").find((l) => l.includes('path="/v2/account"'));
    expect(line).toBeTruthy();
    expect(line).toContain("ShellGate");
    expect(line).not.toContain("UsernameOnlyRoute");
  });

  it("keeps the inline username-only ask for Arena invites", () => {
    const arena = read("../pages/shell/play/ArenaPlayScreen.tsx");
    expect(arena).toContain("UsernameOnlyOnboarding");
  });

  it("LoginScreen honors a validated internal ?next= after sign-in", () => {
    const login = read("../pages/LoginScreen.tsx");
    expect(login).toMatch(/nextParam\.startsWith\("\/"\)/);
    expect(login).toMatch(/!nextParam\.startsWith\("\/\/"\)/);
    expect(login).toMatch(/signIn\(email, password\);\s*navigate\(nextPath \?\? "\/home"\)/);
  });
});
