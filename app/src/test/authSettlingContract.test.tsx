/**
 * Auth-settling contract.
 *
 * On a reload of a signed-in session, Convex queries run UNAUTHENTICATED until
 * the stored token is validated, so `users.me` transiently resolves `null`.
 * Deriving "loggedOut" from that null flashed SIGN IN at onboarded users and
 * bounced guarded deep links to "/" (the home shell) before the session
 * appeared — both observed by QA. This locks the fix: while the handshake is
 * in flight (or the token is validated but the user doc hasn't propagated),
 * `accountState` is "loading", never "loggedOut".
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const convexMock = vi.hoisted(() => ({
  me: undefined as unknown,
  auth: { isLoading: false, isAuthenticated: false },
}));

vi.mock("convex/react", () => ({
  useQuery: () => convexMock.me,
  useMutation: () => vi.fn(),
  useConvexAuth: () => convexMock.auth,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    users: {
      me: "users.me",
      ensureProfile: "users.ensureProfile",
      claimUsernameOnly: "users.claimUsernameOnly",
      upgradeUsernameOnly: "users.upgradeUsernameOnly",
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function StateProbe() {
  const { accountState, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="account-state">{accountState}</div>
      <div data-testid="is-loading">{String(isLoading)}</div>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <StateProbe />
    </AuthProvider>,
  );
}

describe("accountState during the auth handshake", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    convexMock.me = undefined;
    convexMock.auth = { isLoading: false, isAuthenticated: false };
  });

  it("me unresolved → loading", () => {
    renderProbe();
    expect(screen.getByTestId("account-state").textContent).toBe("loading");
  });

  it("me=null while the token handshake is in flight → loading (NOT loggedOut)", () => {
    convexMock.me = null;
    convexMock.auth = { isLoading: true, isAuthenticated: false };
    renderProbe();
    expect(screen.getByTestId("account-state").textContent).toBe("loading");
    expect(screen.getByTestId("is-loading").textContent).toBe("true");
  });

  it("me=null but token already validated (doc propagating) → loading", () => {
    convexMock.me = null;
    convexMock.auth = { isLoading: false, isAuthenticated: true };
    renderProbe();
    expect(screen.getByTestId("account-state").textContent).toBe("loading");
  });

  it("me=null with the handshake settled and no session → loggedOut", () => {
    convexMock.me = null;
    renderProbe();
    expect(screen.getByTestId("account-state").textContent).toBe("loggedOut");
  });

  it("anonymous session with a username → usernameOnly", () => {
    convexMock.me = { _id: "u1", username: "zara", isAnonymous: true, isGuest: false };
    convexMock.auth = { isLoading: false, isAuthenticated: true };
    renderProbe();
    expect(screen.getByTestId("account-state").textContent).toBe("usernameOnly");
  });

  it("full account → fullAccount", () => {
    convexMock.me = { _id: "u2", username: "ada", isAnonymous: false, isGuest: false };
    convexMock.auth = { isLoading: false, isAuthenticated: true };
    renderProbe();
    expect(screen.getByTestId("account-state").textContent).toBe("fullAccount");
  });
});
