/**
 * Onboarded-home contract: after username-only onboarding the v2 home must
 * read the session — greet the user by name, load their real stats, show an
 * honest "—" (not a baseline 1200) for ranked standing, and never show the
 * SIGN IN affordance.
 *
 * The QA bug had two roots, both locked here:
 *  - the stats query keyed off the guest flag, so anonymous+username users
 *    (and their casual plays) never loaded — now keyed off `hasUsername`;
 *  - `profile.get` returned the 1200 ELO baseline for ranked-INELIGIBLE users,
 *    which the home rendered as a ranked standing.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const flagMock = vi.hoisted(() => ({ enabled: true }));
const authMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const queryMock = vi.hoisted(() => ({
  value: undefined as unknown,
  calls: [] as unknown[][],
}));

vi.mock("@/lib/flags", () => ({
  get V2_SHELL_ENABLED() {
    return flagMock.enabled;
  },
  get LEARN_ENABLED() {
    return false;
  },
}));

// Passthrough i18n that keeps interpolation visible: t("home.greeting",
// {name:"zara"}) → "home.greeting:zara" so the greeting's NAME is assertable.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { name?: string }) =>
      opts?.name ? `${k}:${opts.name}` : k,
    i18n: {},
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    queryMock.calls.push(args);
    return queryMock.value;
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock.value,
}));

import ShellHomeScreen from "@/pages/shell/ShellHomeScreen";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/v2"]}>
      <ShellHomeScreen />
    </MemoryRouter>,
  );
}

const usernameOnlyAuth = {
  user: { _id: "u1", username: "zara" },
  hasUsername: true,
  accountState: "usernameOnly",
};

const usernameOnlyProfile = {
  userId: "u1",
  username: "zara",
  eloRating: 1200, // baseline — must NOT render as a ranked standing
  rankedEligible: false,
  totalPlays: 7,
  stats: { totalGames: 0, totalWins: 0, winRate: 0, currentStreak: 0, bestStreak: 0, favoriteSport: null },
};

describe("onboarded home (username-only session)", () => {
  beforeEach(() => {
    flagMock.enabled = true;
    queryMock.value = undefined;
    queryMock.calls = [];
  });

  it("greets the user, hides SIGN IN, and loads their stats query", () => {
    authMock.value = usernameOnlyAuth;
    queryMock.value = usernameOnlyProfile;
    renderHome();

    // Greeting carries the onboarded username; no sign-in affordance.
    expect(screen.getByText(/home\.greeting:zara/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "auth.signIn" })).toBeNull();

    // The stats query runs FOR this user (not skipped as it was for guests).
    expect(queryMock.calls.some(([, args]) =>
      typeof args === "object" && args !== null && (args as { userId?: string }).userId === "u1",
    )).toBe(true);

    // Real plays show; ranked standing stays honest ("—", not baseline 1200).
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("1200")).toBeNull();
  });

  it("shows the ranked ELO for a ranked-eligible full account", () => {
    authMock.value = {
      user: { _id: "u2", username: "ada" },
      hasUsername: true,
      accountState: "fullAccount",
    };
    queryMock.value = {
      ...usernameOnlyProfile,
      userId: "u2",
      username: "ada",
      eloRating: 1542,
      rankedEligible: true,
      totalPlays: 31,
      stats: { ...usernameOnlyProfile.stats, totalGames: 20 },
    };
    renderHome();

    expect(screen.getByText("1542")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
    expect(screen.getByText("31")).toBeTruthy();
  });

  it("skips the stats query and shows SIGN IN only when logged out", () => {
    authMock.value = { user: null, hasUsername: false, accountState: "loggedOut" };
    renderHome();

    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
    expect(queryMock.calls.every(([, args]) => args === "skip")).toBe(true);
  });
});
