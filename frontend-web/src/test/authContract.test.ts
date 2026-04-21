/**
 * BLOCKER-1 regression suite.
 *
 * Three concerns are locked in here:
 *   1. The shared password policy (length 12..72, common-list rejection,
 *      case-insensitive) that both the Convex Password provider
 *      (`validatePasswordRequirements` hook in convex/auth.ts) and the
 *      frontend LoginScreen use.
 *   2. The AuthContext flow helpers route each flow through the Convex
 *      `signIn("password", ...)` action with the correct `flow` arg, derive
 *      the right profile username, and surface discriminable errors as
 *      AuthError with a stable `code`.
 *   3. Legacy @verveq.local emails are rejected as defense-in-depth on the
 *      client — the invalidateLegacyAuth migration covers the server side.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import {
  validatePassword,
  describePasswordReason,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  COMMON_PASSWORDS,
} from "@/lib/password";

// Hoisted mocks for the Convex Auth + Convex React hooks consumed by
// AuthContext. We wire them before importing AuthContext so the module
// picks up the mocks at import time.
const authMock = vi.hoisted(() => ({
  signIn: vi.fn(async (..._args: unknown[]) => ({ signingIn: true })),
  signOut: vi.fn(async () => {}),
  useQuery: vi.fn((..._args: unknown[]) => null as unknown),
  useMutation: vi.fn((..._args: unknown[]) => vi.fn(async () => "user_id")),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: authMock.signIn,
    signOut: authMock.signOut,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => authMock.useQuery(...args),
  useMutation: (...args: unknown[]) => authMock.useMutation(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { users: { me: "users.me", ensureProfile: "users.ensureProfile" } },
}));

import {
  AuthProvider,
  AuthError,
  useAuth,
  normalizeEmail,
  isLegacyVerveqEmail,
} from "@/contexts/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Password policy
// ─────────────────────────────────────────────────────────────────────────────
describe("validatePassword", () => {
  it("rejects a password shorter than the minimum length", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(short).toHaveLength(11);
    const result = validatePassword(short);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too-short");
  });

  it("accepts a password exactly at the minimum length that is not common", () => {
    const pw = "Zq7$mnPkL9#r"; // 12 chars, unlikely to appear in any leaked list
    expect(pw).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(validatePassword(pw)).toEqual({ ok: true, reason: null });
  });

  it("rejects a password longer than the maximum length", () => {
    const long = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    const result = validatePassword(long);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too-long");
  });

  it("accepts a password exactly at the maximum length", () => {
    const pw = "Zq7$mnPkL9#r" + "a".repeat(PASSWORD_MAX_LENGTH - 12);
    expect(pw).toHaveLength(PASSWORD_MAX_LENGTH);
    expect(validatePassword(pw)).toEqual({ ok: true, reason: null });
  });

  it("rejects a password that is in the bundled common-password list", () => {
    const common = COMMON_PASSWORDS[0];
    expect(common.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    const result = validatePassword(common);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too-common");
  });

  it("is case-insensitive when checking the common-password list", () => {
    const common = COMMON_PASSWORDS[0];
    const mixed = common.toUpperCase();
    const result = validatePassword(mixed);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too-common");
  });

  it("describePasswordReason produces user-facing text for each reason", () => {
    expect(describePasswordReason("too-short")).toMatch(/at least/i);
    expect(describePasswordReason("too-long")).toMatch(/characters or fewer/i);
    expect(describePasswordReason("too-common")).toMatch(/too common/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. AuthContext flows
// ─────────────────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

beforeEach(() => {
  authMock.signIn.mockReset();
  authMock.signIn.mockResolvedValue({ signingIn: true });
  authMock.signOut.mockReset();
  authMock.useQuery.mockReset();
  authMock.useQuery.mockReturnValue(null);
  authMock.useMutation.mockReset();
  authMock.useMutation.mockReturnValue(vi.fn(async () => "user_id"));
});

describe("AuthContext — isLegacyVerveqEmail", () => {
  it("flags @verveq.local emails case-insensitively", () => {
    expect(isLegacyVerveqEmail("Alice@VerveQ.Local")).toBe(true);
    expect(isLegacyVerveqEmail("alice@verveq.local")).toBe(true);
    expect(isLegacyVerveqEmail("alice@example.com")).toBe(false);
  });

  it("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail("  Alice@EXAMPLE.com ")).toBe("alice@example.com");
  });
});

describe("AuthContext.signUp", () => {
  it("calls convex signIn with flow=signUp and ensureProfile afterwards", async () => {
    const ensureProfile = vi.fn(async () => "user_id");
    authMock.useMutation.mockReturnValue(ensureProfile);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signUp(
        "alice@example.com",
        "Zq7$mnPkL9#r",
        "Alice",
      );
    });

    expect(authMock.signIn).toHaveBeenCalledTimes(1);
    expect(authMock.signIn.mock.calls[0][0]).toBe("password");
    const params = authMock.signIn.mock.calls[0][1] as Record<string, unknown>;
    expect(params.flow).toBe("signUp");
    expect(params.email).toBe("alice@example.com");
    expect(params.password).toBe("Zq7$mnPkL9#r");
    expect(params.displayName).toBe("Alice");

    expect(ensureProfile).toHaveBeenCalledWith({
      username: "alice",
      displayName: "Alice",
      isGuest: false,
    });
  });

  it("throws AuthError(weak_password) when password is too short", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.signUp("alice@example.com", "shortpw", "Alice"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "weak_password",
    });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("throws AuthError(weak_password) when password is in the common list", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    const common = COMMON_PASSWORDS[0];
    await expect(
      result.current.signUp("alice@example.com", common, "Alice"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "weak_password",
    });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("rejects legacy @verveq.local emails as defense-in-depth on signUp", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.signUp("alice@verveq.local", "Zq7$mnPkL9#r", "Alice"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "legacy_email",
    });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("rejects malformed emails", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.signUp("not-an-email", "Zq7$mnPkL9#r"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "invalid_email",
    });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("maps a Convex 'Invalid password' error into AuthError(weak_password)", async () => {
    authMock.signIn.mockRejectedValueOnce(new Error("Invalid password"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.signUp("alice@example.com", "Zq7$mnPkL9#r"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "weak_password",
    });
  });
});

describe("AuthContext.signIn", () => {
  it("calls convex signIn with flow=signIn", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signIn("alice@example.com", "Zq7$mnPkL9#r");
    });
    const params = authMock.signIn.mock.calls[0][1] as Record<string, unknown>;
    expect(params.flow).toBe("signIn");
    expect(params.email).toBe("alice@example.com");
  });

  it("maps Convex 'Invalid credentials' into AuthError(invalid_credentials)", async () => {
    authMock.signIn.mockRejectedValueOnce(new Error("Invalid credentials"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.signIn("alice@example.com", "Zq7$mnPkL9#r"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "invalid_credentials",
    });
  });

  it("rejects legacy @verveq.local emails at signIn", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.signIn("alice@verveq.local", "Zq7$mnPkL9#r"),
    ).rejects.toMatchObject({
      name: "AuthError",
      code: "legacy_email",
    });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });
});

describe("AuthContext.requestPasswordReset", () => {
  it("calls convex signIn with flow=reset and no password", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.requestPasswordReset("alice@example.com");
    });
    const params = authMock.signIn.mock.calls[0][1] as Record<string, unknown>;
    expect(params.flow).toBe("reset");
    expect(params).not.toHaveProperty("password");
    expect(params.email).toBe("alice@example.com");
  });

  it("rejects malformed email without calling signIn", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.requestPasswordReset("nope"),
    ).rejects.toMatchObject({ code: "invalid_email" });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });
});

describe("AuthContext.confirmPasswordReset", () => {
  it("calls convex signIn with flow=reset-verification and the code+newPassword", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.confirmPasswordReset(
        "alice@example.com",
        "123456",
        "Zq7$mnPkL9#r",
      );
    });
    const params = authMock.signIn.mock.calls[0][1] as Record<string, unknown>;
    expect(params.flow).toBe("reset-verification");
    expect(params.code).toBe("123456");
    expect(params.newPassword).toBe("Zq7$mnPkL9#r");
    expect(params.email).toBe("alice@example.com");
  });

  it("rejects a weak newPassword before calling convex", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.confirmPasswordReset("alice@example.com", "123456", "short"),
    ).rejects.toMatchObject({ code: "weak_password" });
    expect(authMock.signIn).not.toHaveBeenCalled();
  });

  it("maps Convex 'Invalid code' into AuthError(invalid_code)", async () => {
    authMock.signIn.mockRejectedValueOnce(new Error("Invalid code"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      result.current.confirmPasswordReset(
        "alice@example.com",
        "000000",
        "Zq7$mnPkL9#r",
      ),
    ).rejects.toMatchObject({ code: "invalid_code" });
  });
});

describe("AuthError", () => {
  it("is a named Error subclass with a code property", () => {
    const err = new AuthError("invalid_email", "bad email");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AuthError");
    expect(err.code).toBe("invalid_email");
    expect(err.message).toBe("bad email");
  });
});
