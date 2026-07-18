/**
 * v2 sign-in affordance contract.
 *
 * Once v2 is the default landing, a logged-out returning visitor lands in the
 * shell Home with no session. This locks in the affordance that closes that
 * gap: a "Sign in" control shown ONLY when logged out that routes to the
 * existing v1 password login at `/?mode=signin` (no new sign-in form is built).
 *
 *  - logged out  → the control is visible and reaches `/?mode=signin`, which
 *    (flag on) `EntryRoute` resolves to the v1 LoginScreen.
 *  - signed in   → the control is absent (the avatar shows instead).
 *
 * Heavy deps (Convex query, i18n, the real auth context) are mocked so the test
 * asserts the affordance + routing, not screen internals.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const flagMock = vi.hoisted(() => ({ enabled: true }));
const authMock = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock("@/lib/flags", () => ({
  get V2_SHELL_ENABLED() {
    return flagMock.enabled;
  },
  get LEARN_ENABLED() {
    return false;
  },
  // THE DRAW home card (Ticket H) stays dark here: flag off ⇒ it renders
  // nothing and fires no query.
  get DRAW_ENABLED() {
    return false;
  },
}));

// Passthrough i18n: the button label is the raw key, which is all we assert on.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: {} }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock.value,
}));

vi.mock("@/pages/LoginScreen", () => ({
  default: () => <div data-testid="v1-login">LOGIN</div>,
}));
vi.mock("@/pages/HomeScreen", () => ({
  default: () => <div data-testid="v1-home">V1 HOME</div>,
}));

import ShellHomeScreen from "@/pages/shell/ShellHomeScreen";
import { EntryRoute } from "@/components/EntryRoutes";

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{`${loc.pathname}${loc.search}`}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/v2"]}>
      <Routes>
        <Route path="/" element={<EntryRoute />} />
        <Route path="/v2" element={<ShellHomeScreen />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const loggedOut = {
  user: null,
  isGuest: false,
  accountState: "loggedOut",
};
const fullAccount = {
  user: { _id: "u1", username: "ada" },
  isGuest: false,
  accountState: "fullAccount",
};

describe("v2 sign-in affordance — ShellHomeScreen", () => {
  beforeEach(() => {
    flagMock.enabled = true;
  });

  it("shows Sign in when logged out and reaches /?mode=signin → v1 LoginScreen", () => {
    authMock.value = loggedOut;
    renderHome();

    const signIn = screen.getByRole("button", { name: "auth.signIn" });
    expect(signIn).toBeTruthy();

    fireEvent.click(signIn);

    expect(screen.getByTestId("v1-login")).toBeTruthy();
    expect(screen.getByTestId("pathname").textContent).toBe("/?mode=signin");
  });

  it("hides Sign in for a signed-in account", () => {
    authMock.value = fullAccount;
    renderHome();

    expect(screen.queryByRole("button", { name: "auth.signIn" })).toBeNull();
  });
});
