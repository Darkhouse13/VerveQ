/**
 * Claiming a username says it worked. The claim used to be silent: the next
 * screen was just Home, so a first-timer never knew their name was saved
 * (onboarding walkthrough 2026-10-22, path A step 9).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const auth = {
  accountState: "loggedOut",
  hasUsername: false,
  ensureSession: vi.fn().mockResolvedValue(true),
  claimUsername: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth,
  AuthError: class AuthError extends Error {},
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { handle?: string }) =>
      opts?.handle !== undefined ? `${key}:${opts.handle}` : key,
    i18n: {},
  }),
}));

const success = vi.fn();
vi.mock("@/lib/notify", () => ({ notify: { success: (...a: unknown[]) => success(...a) } }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { UsernameOnlyOnboarding } from "@/components/shell/onboarding/UsernameOnlyOnboarding";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  auth.hasUsername = false;
});

describe("username claim confirmation", () => {
  it("confirms a successful claim with the new handle, then continues", async () => {
    const onComplete = vi.fn();
    render(<UsernameOnlyOnboarding onComplete={onComplete} />);
    fireEvent.change(screen.getByPlaceholderText("usernameOnboard.usernamePlaceholder"), {
      target: { value: "kingkenny" },
    });
    fireEvent.click(screen.getByText("usernameOnboard.submit"));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(auth.claimUsername).toHaveBeenCalledWith("kingkenny", { inviteCode: undefined });
    expect(success).toHaveBeenCalledWith("usernameOnboard.claimed:kingkenny");
  });

  it("says nothing to a visitor who already had a name (an arrival, not a claim)", async () => {
    auth.hasUsername = true;
    const onComplete = vi.fn();
    render(<UsernameOnlyOnboarding onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(success).not.toHaveBeenCalled();
  });
});
