/**
 * ProtectedRoute contract.
 *
 * The wrapper is the fix for the post-logout "Loading profile..." hang:
 * after signOut, any previously-authenticated screen would sit waiting
 * on a Convex query that never resolves without a session. ProtectedRoute
 * intercepts that state and redirects to the login screen.
 *
 * Three states to lock in:
 *   1. isLoading → render a loading shell, do NOT redirect.
 *   2. !isAuthenticated && !isLoading → redirect to "/".
 *   3. isAuthenticated → render children (regardless of isGuest).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const useAuthMock = useAuth as unknown as Mock;

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="pathname">{loc.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div data-testid="login">LOGIN</div>} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <div data-testid="profile-body">PROFILE</div>
            </ProtectedRoute>
          }
        />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("renders a loading shell when isLoading and does not redirect", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });
    renderAt("/profile");
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByTestId("profile-body")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
    expect(screen.getByTestId("pathname").textContent).toBe("/profile");
  });

  it("redirects to / when not authenticated and not loading", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });
    renderAt("/profile");
    expect(screen.getByTestId("login")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-body")).not.toBeInTheDocument();
    expect(screen.getByTestId("pathname").textContent).toBe("/");
  });

  it("renders children when authenticated", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isGuest: false,
    });
    renderAt("/profile");
    expect(screen.getByTestId("profile-body")).toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
    expect(screen.getByTestId("pathname").textContent).toBe("/profile");
  });

  it("lets authenticated guests through (does not gate on isGuest)", () => {
    useAuthMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      isGuest: true,
    });
    renderAt("/profile");
    expect(screen.getByTestId("profile-body")).toBeInTheDocument();
  });
});
