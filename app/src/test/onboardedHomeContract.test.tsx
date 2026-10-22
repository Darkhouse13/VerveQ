/**
 * Onboarded-home contract: after username-only onboarding the PLAY tab (the
 * v2 home; VerveQ ONE decision 10 merged Home and Compete into it) must read
 * the session — carry the user's identity (avatar), load their real stats,
 * never render a baseline 1200 as a ranked standing, and never show the SIGN
 * IN affordance.
 *
 * The QA bug had two roots, both locked here:
 *  - the stats query keyed off the guest flag, so anonymous+username users
 *    (and their casual plays) never loaded — now keyed off `hasUsername`;
 *  - `profile.get` returned the 1200 ELO baseline for ranked-INELIGIBLE users,
 *    which the home rendered as a ranked standing. Decision 10 moved the
 *    ladder card off Play altogether (the standing lives on the Ranks tab,
 *    whose own locked state carries the honesty rule now), so Play renders no
 *    ELO for anyone.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const authMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const queryMock = vi.hoisted(() => ({
  value: undefined as unknown,
  calls: [] as unknown[][],
}));

vi.mock("@/lib/flags", () => ({
  // THE DRAW home card (Ticket H) stays dark here: flag off ⇒ it renders
  // nothing and fires no query.
  get DRAW_ENABLED() {
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
  // The WEEKEND teaser's status read rejects ⇒ the card hides itself and this
  // contract sees the onboarded Home exactly as before.
  useConvex: () => ({
    query: () => Promise.reject(new Error("no backend in this contract")),
    mutation: () => Promise.reject(new Error("no backend in this contract")),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock.value,
}));

import ShellHomeScreen from "@/pages/shell/ShellHomeScreen";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
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
    queryMock.value = undefined;
    queryMock.calls = [];
  });

  it("carries the user's identity, hides SIGN IN, and loads their stats query", () => {
    authMock.value = usernameOnlyAuth;
    queryMock.value = usernameOnlyProfile;
    renderHome();

    // The avatar carries the onboarded username; no sign-in affordance.
    expect(screen.getByRole("button", { name: "zara" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "auth.signIn" })).toBeNull();

    // The stats query runs FOR this user (not skipped as it was for guests).
    expect(queryMock.calls.some(([, args]) =>
      typeof args === "object" && args !== null && (args as { userId?: string }).userId === "u1",
    )).toBe(true);

    // No ranked standing on Play (decision 10: the ladder card moved to the
    // Ranks tab), so the baseline 1200 has nowhere to masquerade as one.
    expect(screen.queryByText("1200")).toBeNull();
    expect(screen.queryByText("ranks.locked.title")).toBeNull();
  });

  it("a full account's ELO stays on Ranks; Play carries the streak", () => {
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
      stats: { ...usernameOnlyProfile.stats, totalGames: 20, currentStreak: 4 },
    };
    renderHome();

    // Decision 10: one place for the ladder (the Ranks tab), so Play shows
    // neither the ELO nor the tier progress — only the server-read streak.
    expect(screen.queryByText("1542")).toBeNull();
    expect(screen.queryByText("ranks.progressTo")).toBeNull();
    expect(screen.getByTitle("home.stats.streak").textContent).toContain("4");
  });

  it("skips the stats query and shows SIGN IN only when logged out", () => {
    authMock.value = { user: null, hasUsername: false, accountState: "loggedOut" };
    renderHome();

    expect(screen.getByRole("button", { name: "auth.signIn" })).toBeTruthy();
    expect(queryMock.calls.every(([, args]) => args === "skip")).toBe(true);
  });

  // VerveQ ONE P2.5: the header tells the truth. A silently minted anonymous
  // session with no username used to get a "P" avatar for a "Player" that
  // does not exist; Settings says "You're not signed in" for the same state.
  it("shows a Guest chip (not an avatar, not SIGN IN) for a session without a username", () => {
    authMock.value = { user: { _id: "u9" }, hasUsername: false, accountState: "needsUsername" };
    renderHome();

    expect(screen.getByTestId("home-guest-chip").textContent).toContain("home.guestChip");
    expect(screen.queryByRole("button", { name: "Player" })).toBeNull();
    expect(screen.queryByRole("button", { name: "auth.signIn" })).toBeNull();
    // Today's state is read for ANY session: a reel visitor plays Who's Older
    // with no username, and the tile must still show it.
    expect(queryMock.calls.some(([, args]) => typeof args === "object" && args !== null)).toBe(true);
  });

  // Decision 10: Today · Featured · With friends · More games, in that
  // order. THE WEEKEND card left Play for its own tab.
  it("puts TODAY first, then Featured, With friends and More games", () => {
    authMock.value = usernameOnlyAuth;
    const { container } = renderHome();
    const html = container.innerHTML;
    const at = (id: string) => html.indexOf(`data-testid="${id}"`);
    const today = [
      "home-whos-older-card",
      "home-missing-letters-card",
      "home-daily-card",
      "home-daily-survival-card",
    ].map(at);
    const order = ["home-career-path-card", "home-friends-card", "home-more-toggle"].map(at);
    expect(today.every((i) => i >= 0 && i < order[0])).toBe(true);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(at("home-weekend-card")).toBe(-1);
    // More games is collapsed until asked for.
    expect(at("home-more-games")).toBe(-1);
  });
});
