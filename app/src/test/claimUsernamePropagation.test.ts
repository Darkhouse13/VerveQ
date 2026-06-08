/**
 * Reactive auth-propagation contract for username-only onboarding.
 *
 * claimUsername() must wait on the REAL auth state (the reactive `users.me`
 * doc) propagating after signIn("anonymous"), rather than firing the
 * claimUsernameOnly mutation on a fixed-delay timer. The asap bugfix
 * (commit 6a82549) removed a `delays = [0, ...]` retry that fired the first
 * attempt immediately into the propagation window, producing noisy
 * "not authenticated" console errors; this suite locks in that the
 * replacement waits for propagation and never claims speculatively.
 *
 * Stands in for a live flag-on headless run (no Convex URL is available in
 * this environment) by simulating the `users.me` query transitioning across
 * the propagation window.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook } from "@testing-library/react";

const authMock = vi.hoisted(() => ({
  signIn: vi.fn(async (..._args: unknown[]) => ({ signingIn: true })),
  signOut: vi.fn(async () => {}),
  meValue: undefined as unknown,
  claimUsernameOnly: vi.fn(async (..._args: unknown[]) => "user_id"),
  ensureProfile: vi.fn(async (..._args: unknown[]) => "user_id"),
  upgradeUsernameOnly: vi.fn(async (..._args: unknown[]) => "user_id"),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: authMock.signIn,
    signOut: authMock.signOut,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => authMock.meValue,
  useMutation: (ref: string) => {
    if (ref === "users.claimUsernameOnly") return authMock.claimUsernameOnly;
    if (ref === "users.upgradeUsernameOnly") return authMock.upgradeUsernameOnly;
    return authMock.ensureProfile;
  },
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

import { AuthProvider, AuthError, useAuth } from "@/contexts/AuthContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

beforeEach(() => {
  authMock.signIn.mockReset();
  authMock.signIn.mockResolvedValue({ signingIn: true });
  authMock.signOut.mockReset();
  authMock.claimUsernameOnly.mockReset();
  authMock.claimUsernameOnly.mockResolvedValue("user_id");
  authMock.meValue = undefined;
  window.sessionStorage.clear();
});

describe("claimUsername — reactive auth propagation", () => {
  it("waits for the anonymous session to reach users.me, then claims exactly once", async () => {
    vi.useFakeTimers();
    try {
      // Just after signIn("anonymous"): me has not propagated yet.
      authMock.meValue = undefined;
      const { result, rerender } = renderHook(() => useAuth(), { wrapper });

      const claimPromise = result.current.claimUsername("newplayer");
      // Attach a no-op catch so an early rejection never surfaces as unhandled.
      const settled = claimPromise.then(
        () => ({ ok: true }) as const,
        (err: unknown) => ({ ok: false, err }) as const,
      );

      // Propagation window: no doc yet, so nothing is claimed speculatively.
      await vi.advanceTimersByTimeAsync(500);
      expect(authMock.claimUsernameOnly).not.toHaveBeenCalled();

      // The anonymous session now propagates to the reactive me query.
      authMock.meValue = { _id: "anon_1", isAnonymous: true };
      rerender();

      await vi.advanceTimersByTimeAsync(500);
      const outcome = await settled;

      expect(outcome).toEqual({ ok: true });
      expect(authMock.claimUsernameOnly).toHaveBeenCalledTimes(1);
      expect(authMock.claimUsernameOnly).toHaveBeenCalledWith(
        expect.objectContaining({ username: "newplayer" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("claims immediately when the anonymous session has already propagated", async () => {
    vi.useFakeTimers();
    try {
      authMock.meValue = { _id: "anon_1", isAnonymous: true };
      const { result } = renderHook(() => useAuth(), { wrapper });

      const claimPromise = result.current.claimUsername("newplayer");
      await vi.advanceTimersByTimeAsync(0);
      await claimPromise;

      expect(authMock.claimUsernameOnly).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates no account when no session ever propagates (me stays null)", async () => {
    vi.useFakeTimers();
    try {
      // No Convex session at all: me resolves to null, never an anon doc.
      authMock.meValue = null;
      const { result } = renderHook(() => useAuth(), { wrapper });

      const claimPromise = result.current.claimUsername("newplayer");
      const settled = claimPromise.then(
        () => ({ ok: true }) as const,
        (err: unknown) => ({ ok: false, err }) as const,
      );

      // Run out the full propagation window.
      await vi.advanceTimersByTimeAsync(16000);
      const outcome = await settled;

      expect(outcome.ok).toBe(false);
      const err = (outcome as { ok: false; err: unknown }).err;
      expect(err).toBeInstanceOf(AuthError);
      // Crucially: no claim mutation fired, so no account/user doc is created.
      expect(authMock.claimUsernameOnly).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry a non-transient server rejection (e.g. username taken)", async () => {
    vi.useFakeTimers();
    try {
      authMock.meValue = { _id: "anon_1", isAnonymous: true };
      authMock.claimUsernameOnly.mockRejectedValueOnce(
        new Error("Username is already taken."),
      );
      const { result } = renderHook(() => useAuth(), { wrapper });

      const claimPromise = result.current.claimUsername("takenname");
      const settled = claimPromise.then(
        () => ({ ok: true }) as const,
        (err: unknown) => ({ ok: false, err }) as const,
      );

      await vi.advanceTimersByTimeAsync(500);
      const outcome = await settled;

      expect(outcome.ok).toBe(false);
      const err = (outcome as { ok: false; err: unknown }).err as AuthError;
      expect(err).toBeInstanceOf(AuthError);
      expect(err.code).toBe("username_taken");
      // Mapped and surfaced after a single attempt — no speculative retry loop.
      expect(authMock.claimUsernameOnly).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
