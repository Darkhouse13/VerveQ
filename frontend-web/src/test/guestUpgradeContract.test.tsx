/**
 * Guest ↔ account UX contract.
 *
 * Two surfaces:
 *   1. ProfileScreen — button matrix
 *        non-guest: "Sign Out" → signOutToGuest (stay on page, no navigate)
 *        guest:     "Sign In"  → navigate("/?mode=signin") (no auth call)
 *                   plus a separate "Create an account" CTA card.
 *   2. LoginScreen — honors `?mode=signup|signin` in the URL on first mount
 *      and renders the "Guest progress is not carried over." notice only
 *      when arriving via the guest-upgrade path (`?from=guest`). It also
 *      tolerates an existing anonymous (guest) session without redirecting
 *      to /home — only a real password session is auto-redirected.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Shared mocks ────────────────────────────────────────────────────────────
const navigateSpy = vi.fn();
const logoutSpy = vi.fn(async () => {});
const signOutToGuestSpy = vi.fn(async () => {});

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

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    profile: { get: "profile.get" },
    achievements: {
      list: "achievements.list",
      userAchievements: "achievements.userAchievements",
    },
    seasonManager: {
      getUserSeasonHistory: "seasonManager.getUserSeasonHistory",
    },
    users: { me: "users.me", ensureProfile: "users.ensureProfile" },
  },
}));

// Profile fixture — enough to get past the "Loading profile..." guard.
const profileFixture = {
  username: "guestplayer",
  displayName: "Guest Player",
  createdAt: Date.UTC(2026, 0, 1),
  eloRating: 1100,
  stats: {
    totalGames: 0,
    winRate: 0,
    bestStreak: 0,
    favoriteSport: null,
  },
  recentGames: [],
};

function mockProfileQueries(convexReact: {
  useQuery: Mock;
}) {
  convexReact.useQuery.mockImplementation((name: string) => {
    switch (name) {
      case "profile.get":
        return profileFixture;
      case "achievements.list":
        return [];
      case "achievements.userAchievements":
        return [];
      case "seasonManager.getUserSeasonHistory":
        return [];
      default:
        return null;
    }
  });
}

// ─── 1. ProfileScreen ────────────────────────────────────────────────────────
describe("ProfileScreen — sign-in/sign-out button matrix", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    logoutSpy.mockReset();
    logoutSpy.mockResolvedValue(undefined);
    signOutToGuestSpy.mockReset();
    signOutToGuestSpy.mockResolvedValue(undefined);
    vi.resetModules();
  });

  async function renderProfile(isGuest: boolean) {
    vi.doMock("@/contexts/AuthContext", () => ({
      useAuth: () => ({
        user: { _id: "u1", username: "guestplayer", isGuest, totalGames: 0 },
        isGuest,
        logout: logoutSpy,
        signOutToGuest: signOutToGuestSpy,
      }),
    }));
    const convexReact = await import("convex/react");
    mockProfileQueries(
      convexReact as unknown as { useQuery: Mock },
    );
    const { default: ProfileScreen } = await import(
      "../pages/ProfileScreen"
    );
    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>,
    );
  }

  it("renders the Create Account CTA for guest users", async () => {
    await renderProfile(true);
    expect(await screen.findByTestId("guest-upgrade-cta")).toBeInTheDocument();
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /save your elo, achievements, and compete on the leaderboard\./i,
      ),
    ).toBeInTheDocument();
  });

  it("does NOT render the CTA for non-guest users", async () => {
    await renderProfile(false);
    await screen.findByText(/current elo/i);
    expect(screen.queryByTestId("guest-upgrade-cta")).not.toBeInTheDocument();
  });

  it("renders 'Sign Out' for non-guest users", async () => {
    await renderProfile(false);
    expect(
      await screen.findByRole("button", { name: /^sign out$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^sign in$/i }),
    ).not.toBeInTheDocument();
  });

  it("renders 'Sign In' for guest users (instead of 'Sign Out')", async () => {
    await renderProfile(true);
    expect(
      await screen.findByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^sign out$/i }),
    ).not.toBeInTheDocument();
  });

  it("clicking the CTA logs the guest out and navigates to /?mode=signup&from=guest", async () => {
    await renderProfile(true);
    const button = await screen.findByRole("button", {
      name: /^create account$/i,
    });
    fireEvent.click(button);

    await waitFor(() => expect(logoutSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith("/?mode=signup&from=guest");
  });

  it("clicking 'Sign Out' (non-guest) downgrades to a guest and does NOT navigate", async () => {
    await renderProfile(false);
    const signOut = await screen.findByRole("button", {
      name: /^sign out$/i,
    });
    fireEvent.click(signOut);

    await waitFor(() => expect(signOutToGuestSpy).toHaveBeenCalledTimes(1));
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("clicking 'Sign In' (guest) navigates to /?mode=signin with no auth calls", async () => {
    await renderProfile(true);
    const signIn = await screen.findByRole("button", {
      name: /^sign in$/i,
    });
    fireEvent.click(signIn);

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith("/?mode=signin");
    expect(signOutToGuestSpy).not.toHaveBeenCalled();
    expect(logoutSpy).not.toHaveBeenCalled();
  });
});

// ─── 2. LoginScreen mode override ────────────────────────────────────────────
describe("LoginScreen — mode override + guest notice", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    logoutSpy.mockReset();
    vi.resetModules();
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
    vi.doMock("@/contexts/AuthContext", () => ({
      useAuth: () => ({
        signIn: vi.fn(),
        signUp: vi.fn(),
        requestPasswordReset: vi.fn(),
        confirmPasswordReset: vi.fn(),
        loginAsGuest: vi.fn(),
        isAuthenticated,
        isGuest,
        isLoading,
      }),
      AuthError: class AuthError extends Error {},
    }));
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
      await screen.findByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("guest-upgrade-notice")).not.toBeInTheDocument();
  });

  it("renders signup fields on first mount when ?mode=signup", async () => {
    await renderLogin("/?mode=signup");
    expect(
      await screen.findByRole("button", { name: /^create account$/i }),
    ).toBeInTheDocument();
    // Signup-only fields
    expect(
      screen.getByPlaceholderText(/display name/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/confirm password/i),
    ).toBeInTheDocument();
  });

  it("shows the guest-upgrade notice only when arriving with from=guest", async () => {
    await renderLogin("/?mode=signup&from=guest");
    expect(
      await screen.findByTestId("guest-upgrade-notice"),
    ).toHaveTextContent(/guest progress is not carried over/i);
  });

  it("does not show the guest-upgrade notice on a plain signup visit", async () => {
    await renderLogin("/?mode=signup");
    await screen.findByRole("button", { name: /^create account$/i });
    expect(
      screen.queryByTestId("guest-upgrade-notice"),
    ).not.toBeInTheDocument();
  });

  it("ignores unknown mode values and falls back to signin", async () => {
    await renderLogin("/?mode=not-a-mode");
    expect(
      await screen.findByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
  });

  it("stays on the login screen when the user is already signed in as a guest", async () => {
    await renderLogin("/?mode=signin", {
      isAuthenticated: true,
      isGuest: true,
    });
    expect(
      await screen.findByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
    // No redirect was issued.
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("hides 'Play as Guest' when the user is already a guest", async () => {
    await renderLogin("/?mode=signin", {
      isAuthenticated: true,
      isGuest: true,
    });
    await screen.findByRole("button", { name: /^sign in$/i });
    expect(
      screen.queryByRole("button", { name: /play as guest/i }),
    ).not.toBeInTheDocument();
  });

  it("still shows 'Play as Guest' for a plain unauthenticated visit", async () => {
    await renderLogin("/?mode=signin");
    expect(
      await screen.findByRole("button", { name: /play as guest/i }),
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
