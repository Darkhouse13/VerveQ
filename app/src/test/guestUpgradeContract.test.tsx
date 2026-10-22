/**
 * Guest ↔ account UX contract.
 *
 * Surfaces:
 *   - LoginScreen — honors `?mode=signup|signin` in the URL on first mount
 *      and renders the "Guest progress is not carried over." notice only
 *      when arriving via the guest-upgrade path (`?from=guest`). It also
 *      tolerates an existing anonymous (guest) session without redirecting
 *      to /home automatically — only a real password session is
 *      auto-redirected. Guest users still get an explicit "Play as Guest"
 *      route back into the app.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Shared mocks ────────────────────────────────────────────────────────────
const navigateSpy = vi.fn();
const logoutSpy = vi.fn(async () => {});
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

// LoginScreen's placeholders come from the screens i18n namespace; passthrough
// i18n (labels are raw keys) keeps the placeholder queries deterministic.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    users: { me: "users.me", ensureProfile: "users.ensureProfile" },
    notifications: { unreadCount: "notifications.unreadCount" },
  },
}));

afterEach(() => {
  cleanup();
});

// ─── LoginScreen mode override ───────────────────────────────────────────────
describe("LoginScreen — mode override + guest notice", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    logoutSpy.mockReset();
    authContextMock.useAuth.mockReset();
  });

  async function renderLogin(
    initialEntry: string,
    auth: {
      isAuthenticated?: boolean;
      isGuest?: boolean;
      isLoading?: boolean;
    } = {},
  ) {
    const {
      isAuthenticated = false,
      isGuest = false,
      isLoading = false,
    } = auth;
    authContextMock.useAuth.mockReturnValue({
      signIn: vi.fn(),
      signUp: vi.fn(),
      requestPasswordReset: vi.fn(),
      confirmPasswordReset: vi.fn(),
      loginAsGuest: vi.fn(),
      isAuthenticated,
      isGuest,
      isLoading,
    });
    const { default: LoginScreen } = await import("../pages/LoginScreen");
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <LoginScreen />
      </MemoryRouter>,
    );
  }

  it("defaults to signin mode when no mode query param is present", async () => {
    await renderLogin("/");
    expect(
      await screen.findByRole("button", { name: "login.signIn" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("guest-upgrade-notice")).not.toBeInTheDocument();
  });

  it("renders signup fields on first mount when ?mode=signup", async () => {
    await renderLogin("/?mode=signup");
    expect(
      await screen.findByRole("button", { name: "login.createAccount" }),
    ).toBeInTheDocument();
    // Signup-only fields (raw i18n keys — react-i18next is passthrough-mocked)
    expect(
      screen.getByPlaceholderText("login.usernamePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("login.displayNamePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("login.confirmPasswordPlaceholder"),
    ).toBeInTheDocument();
  });

  it("shows the guest-upgrade notice only when arriving with from=guest", async () => {
    await renderLogin("/?mode=signup&from=guest");
    expect(
      await screen.findByTestId("guest-upgrade-notice"),
    ).toHaveTextContent("login.guestNotice");
  });

  it("does not show the guest-upgrade notice on a plain signup visit", async () => {
    await renderLogin("/?mode=signup");
    await screen.findByRole("button", { name: "login.createAccount" });
    expect(
      screen.queryByTestId("guest-upgrade-notice"),
    ).not.toBeInTheDocument();
  });

  it("ignores unknown mode values and falls back to signin", async () => {
    await renderLogin("/?mode=not-a-mode");
    expect(
      await screen.findByRole("button", { name: "login.signIn" }),
    ).toBeInTheDocument();
  });

  it("stays on the login screen when the user is already signed in as a guest", async () => {
    await renderLogin("/?mode=signin", {
      isAuthenticated: true,
      isGuest: true,
    });
    expect(
      await screen.findByRole("button", { name: "login.signIn" }),
    ).toBeInTheDocument();
    // No redirect was issued.
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("still shows 'Play as Guest' when the user is already a guest", async () => {
    await renderLogin("/?mode=signin", {
      isAuthenticated: true,
      isGuest: true,
    });
    await screen.findByRole("button", { name: "login.signIn" });
    expect(
      screen.getByRole("button", { name: "login.playAsGuest" }),
    ).toBeInTheDocument();
  });

  it("still shows 'Play as Guest' for a plain unauthenticated visit", async () => {
    await renderLogin("/?mode=signin");
    expect(
      await screen.findByRole("button", { name: "login.playAsGuest" }),
    ).toBeInTheDocument();
  });

  it("redirects to /home when the user is authenticated with a password session", async () => {
    await renderLogin("/?mode=signin", {
      isAuthenticated: true,
      isGuest: false,
    });
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/home", { replace: true }),
    );
  });
});


describe("Guest account-required route contracts", () => {
  it("exports a UsernameRequiredRoute gate that renders the username-required guest CTA", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(`${process.cwd()}/src/components/ProtectedRoute.tsx`, "utf8"),
    );

    expect(source).toContain("export function UsernameRequiredRoute");
    expect(source).toContain("gate.usernameTitle");
    expect(source).toContain("/?mode=signup&from=guest");
    expect(source).toContain("isGuest");
  });

  it("wraps direct session-writing game routes so guests cannot hit backend mutations directly", async () => {
    const appSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(`${process.cwd()}/src/App.tsx`, "utf8"),
    );

    // WaitingRoomScreen/LiveMatchScreen left this list 2026-07 when the dead
    // Live Match surface was removed outright (routes deleted, not un-guarded).
    //
    // DifficultyScreen left it 2026-08 (FR-1A) because it never belonged: the
    // invariant here is "session-writing game routes", and the picker writes
    // nothing — it imports no Convex client, runs no mutation or query, and
    // only reads query params and navigates. Its guard's logged-out branch is a
    // bare `Navigate to="/"` with no ?next=, so keeping it bought no backend
    // protection and cost cold visitors their intent on five Compete tiles
    // (FR-0 Part 2.2). The screens below all DO provision or write sessions, so
    // they stay guarded.
    //
    // DailyResultScreen/BlitzResultScreen left it 2026-08 (FR-1B) for the same
    // reason as DifficultyScreen: they provision nothing. Both render a result
    // handed to them in `location.state` — no start mutation, no session write.
    // Their run was already played, under a guard, on the route that DID write
    // it. They moved DOWN to SessionRoute (still guarded, at the identity tier)
    // because the v1 username gate turned an anonymous player's finish line
    // into a wall, and because the post-run claim prompt lives on these two
    // screens and could never render above that tier. They are asserted at
    // their new tier in anonymousFirstIdentityContract.test.ts.
    //
    // The v1 mode screens (Quiz, Survival, Challenge, DailyQuiz, Blitz, Forge,
    // HigherLower, VerveGrid) left it 2026-10 when the v2 shell became the only
    // shell: their URLs are now pure redirects to /v2 routes, which carry
    // their own guards.
    for (const screen of ["DuelPlayScreen", "DuelResultScreen"]) {
      expect(appSource).toMatch(
        new RegExp(
          `<UsernameRequiredRoute>\\s*<${screen} />\\s*</UsernameRequiredRoute>`,
        ),
      );
    }
  });
});
