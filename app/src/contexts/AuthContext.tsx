import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import {
  validatePassword,
  describePasswordReason,
} from "../../convex/lib/passwordPolicy";

interface AuthUser {
  _id: string;
  username: string;
  displayName?: string;
  isGuest: boolean;
  totalGames: number;
  avatarUrl?: string;
}

export type AuthErrorCode =
  | "invalid_email"
  | "legacy_email"
  | "weak_password"
  | "invalid_username"
  | "username_taken"
  | "password_mismatch"
  | "invalid_credentials"
  | "invalid_code"
  | "reset_unavailable"
  | "email_taken"
  | "upgrade_unavailable"
  | "rate_limited"
  | "unknown";

/**
 * Server-authoritative account state for the low-friction (username-only)
 * onboarding model. Derived ONLY from the `users.me` document (never guessed
 * client-side):
 *
 *  - `loading`        — the `me` query has not resolved yet.
 *  - `loggedOut`      — no Convex session at all.
 *  - `needsUsername`  — signed in (anonymous or password) but no usable username
 *                       yet (e.g. just after `signIn("anonymous")`).
 *  - `usernameOnly`   — anonymous session WITH a username: plays the
 *                       username-only mode set, excluded from ranked.
 *  - `fullAccount`    — non-anonymous account with a username: ranked-eligible.
 */
export type AccountState =
  | "loading"
  | "loggedOut"
  | "needsUsername"
  | "usernameOnly"
  | "fullAccount";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  // ── Server-authoritative low-friction onboarding model ──
  // All derived from the `users.me` doc on the server; never client-guessed.
  /** Coarse account state for the v2 username-only onboarding flow. */
  accountState: AccountState;
  /** The server says this is a Convex anonymous session (ranked-excluded). */
  isAnonymous: boolean;
  /** The user has a usable, server-validated username. */
  hasUsername: boolean;
  /** Anonymous session that has claimed a username (the username-only tier). */
  isUsernameOnly: boolean;
  /** Non-anonymous account with a username — eligible for ranked/full-account modes. */
  isFullAccount: boolean;
  /** The server-stored username (normalized), or null. */
  username: string | null;
  /** Start a real Convex anonymous session (replaces the tab-local guest for v2). */
  startAnonymousSession: () => Promise<void>;
  /**
   * Claim a username for the current anonymous session (no password). Rejects
   * duplicates with no auto-suffixing. Passes a persisted device nonce and the
   * optional invite code for server-side rate limiting / scoping.
   */
  claimUsername: (
    username: string,
    opts?: { inviteCode?: string },
  ) => Promise<void>;
  /**
   * Upgrade an anonymous + username user to a full (password) account, keeping
   * the same user doc + username and casual progress. Ranked starts after this.
   */
  upgradeAccount: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    username: string,
    displayName?: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  signOutToGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Email format — intentionally permissive. We only reject obviously invalid
// shapes; real verification happens on the server + via the OTP email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isLegacyVerveqEmail(email: string): boolean {
  return normalizeEmail(email).endsWith("@verveq.local");
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
const GUEST_SESSION_KEY = "verveq_guest_session";
const LOCAL_GUEST_USER: AuthUser = {
  _id: "guest_tab",
  username: "",
  displayName: "Guest",
  isGuest: true,
  totalGames: 0,
};

// A durable per-browser nonce passed to the username-only claim mutation so the
// server can rate-limit anonymous onboarding per device. Persisted in
// localStorage (survives reloads, unlike the tab-local guest flag).
const DEVICE_NONCE_KEY = "verveq_device_nonce";
const ANONYMOUS_ONBOARDING_IP_PERMIT_PARAM =
  "anonymousOnboardingIpPermit";

function generateDeviceNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dn_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getDeviceNonce(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let nonce = window.localStorage.getItem(DEVICE_NONCE_KEY);
    if (!nonce) {
      nonce = generateDeviceNonce();
      window.localStorage.setItem(DEVICE_NONCE_KEY, nonce);
    }
    return nonce;
  } catch {
    // Private-mode / storage-disabled: fall back to a session-only nonce.
    return generateDeviceNonce();
  }
}

function readTabGuestSession(): boolean {
  return typeof window !== "undefined" && window.sessionStorage.getItem(GUEST_SESSION_KEY) === "1";
}

function setTabGuestSession(active: boolean) {
  if (typeof window === "undefined") return;
  if (active) {
    window.sessionStorage.setItem(GUEST_SESSION_KEY, "1");
  } else {
    window.sessionStorage.removeItem(GUEST_SESSION_KEY);
  }
}

function normalizeUsernameInput(username: string): string {
  return username.trim().toLowerCase();
}

function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}


function isTransientAuthPropagationError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase().includes("not authenticated");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getConvexSiteUrl(): string {
  const configured = import.meta.env.VITE_CONVEX_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not configured.");
  }
  if (convexUrl.includes(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site").replace(/\/$/, "");
  }
  return convexUrl.replace(/\/$/, "");
}

async function requestAnonymousOnboardingIpPermit(): Promise<string> {
  const response = await fetch(
    `${getConvexSiteUrl()}/anonymous-onboarding/ip-permit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  let body: { permitToken?: unknown; error?: unknown } | null = null;
  try {
    body = (await response.json()) as { permitToken?: unknown; error?: unknown };
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : "Could not verify your network. Try again later.";
    throw new Error(message);
  }
  if (!body || typeof body.permitToken !== "string" || !body.permitToken.trim()) {
    throw new Error("Could not verify your network. Try again later.");
  }
  return body.permitToken;
}

// How long claimUsername will wait for the anonymous session to propagate to
// the reactive `users.me` doc before giving up, and how often it re-checks.
// This replaces a fixed-delay retry of the mutation itself: we wait on the
// real auth state (the signal both claimUsernameOnly guards depend on) instead
// of firing the mutation speculatively into the propagation window.
const ANON_PROPAGATION_TIMEOUT_MS = 15000;
const ANON_PROPAGATION_POLL_MS = 100;

function mapAuthError(err: unknown, fallbackCode: AuthErrorCode): AuthError {
  if (err instanceof AuthError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("invalid credentials")) {
    return new AuthError(
      "invalid_credentials",
      "That email and password combination does not match any account.",
    );
  }
  if (lower.includes("invalid code")) {
    return new AuthError(
      "invalid_code",
      "That reset code is invalid or has expired. Please request a new one.",
    );
  }
  if (lower.includes("password reset is not enabled")) {
    return new AuthError(
      "reset_unavailable",
      "Password reset is temporarily unavailable. Please try again later.",
    );
  }
  if (
    lower.includes("username is already taken") ||
    lower.includes("username claim is ambiguous") ||
    lower.includes("username claim could not be made safely")
  ) {
    return new AuthError(
      "username_taken",
      "Username is already taken. Choose another one.",
    );
  }
  if (lower.includes("username must")) {
    return new AuthError("invalid_username", message);
  }
  if (lower.includes("email is already linked")) {
    return new AuthError(
      "email_taken",
      "That email is already linked to an account. Sign in instead.",
    );
  }
  if (lower.includes("too many")) {
    return new AuthError("rate_limited", message);
  }
  if (
    lower.includes("password must be") ||
    lower.includes("too common") ||
    lower.includes("invalid password")
  ) {
    return new AuthError("weak_password", message);
  }
  return new AuthError(fallbackCode, message || "Authentication failed.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const user = useQuery(api.users.me);
  // Live mirror of the reactive `users.me` doc so async flows (claimUsername)
  // can await auth propagation without capturing a stale closure value.
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const ensureProfile = useMutation(api.users.ensureProfile);
  const claimUsernameOnly = useMutation(api.users.claimUsernameOnly);
  const upgradeUsernameOnly = useMutation(api.users.upgradeUsernameOnly);
  const [localGuestActive, setLocalGuestActive] = useState(readTabGuestSession);

  // Auth is still SETTLING (not "logged out") while: the `me` query hasn't
  // resolved; the token handshake is in flight (queries run unauthenticated
  // until the stored token is validated, so `me` transiently resolves null on
  // every reload of a signed-in session); or the token is validated but the
  // user doc hasn't propagated to the reactive query yet. Treating any of
  // these as logged out flashed SIGN IN at onboarded users and bounced
  // guarded deep links to "/" before the session appeared.
  const { isLoading: convexAuthInFlight, isAuthenticated: convexAuthed } =
    useConvexAuth();
  const authSettling =
    user === undefined || (!user && (convexAuthInFlight || convexAuthed));

  const isLoading = !localGuestActive && authSettling;
  const isAuthenticated = !!user || localGuestActive;
  const isGuest = localGuestActive || !!(user?.isGuest ?? user?.isAnonymous);

  // ── Server-authoritative low-friction onboarding state ──
  // These mirror the backend's `lib/authz.ts` predicates exactly so the FE
  // never admits a user the server would reject (and vice-versa). They read the
  // raw `users.me` doc, NOT the narrowed `authUser`, and ignore the tab-local
  // guest entirely (that v1 path has no server identity).
  const serverUsername =
    typeof user?.username === "string" &&
    isValidUsername(user.username.trim().toLowerCase())
      ? user.username.trim().toLowerCase()
      : null;
  const hasUsername = !!user && user.isGuest !== true && serverUsername !== null;
  const isAnonymous = user?.isAnonymous === true;
  const isUsernameOnly = !!user && isAnonymous && hasUsername;
  const isFullAccount = !!user && !isAnonymous && hasUsername;
  const accountState: AccountState = !user
    ? localGuestActive
      ? // Tab-local guests have no server identity — for the v2 onboarding
        // model they are logged out (matches the previous behavior).
        "loggedOut"
      : authSettling
        ? "loading"
        : "loggedOut"
    : isFullAccount
      ? "fullAccount"
      : isUsernameOnly
        ? "usernameOnly"
        : "needsUsername";

  const ensureProfileAfterAuth = useCallback(
    async (args: { username: string; displayName?: string; isGuest: boolean }) => {
      const delays = [1000, 2000, 4000, 7000];
      let lastError: unknown;
      for (const delay of delays) {
        if (delay > 0) await wait(delay);
        try {
          await ensureProfile(args);
          return;
        } catch (err) {
          lastError = err;
          if (!isTransientAuthPropagationError(err)) throw err;
        }
      }
      throw lastError;
    },
    [ensureProfile],
  );

  // Start a real Convex anonymous session (replaces the tab-local guest for the
  // v2 onboarding). Clears any stale tab-guest flag first.
  const startAnonymousSession = useCallback(async () => {
    setTabGuestSession(false);
    setLocalGuestActive(false);
    try {
      const permitToken = await requestAnonymousOnboardingIpPermit();
      await convexSignIn("anonymous", {
        [ANONYMOUS_ONBOARDING_IP_PERMIT_PARAM]: permitToken,
      });
    } catch (err) {
      throw mapAuthError(err, "unknown");
    }
  }, [convexSignIn]);

  // Block until the anonymous session has actually propagated to the reactive
  // `users.me` doc — the exact state both claimUsernameOnly guards depend on
  // (authenticated + isAnonymous). Resolves true once that doc is visible,
  // false if some other identity is present (server will reject) or the
  // propagation window elapses. Polls the live ref so it observes query
  // updates that land while this promise is pending.
  const waitForAnonymousSession = useCallback(async (): Promise<boolean> => {
    const deadline = Date.now() + ANON_PROPAGATION_TIMEOUT_MS;
    for (;;) {
      const current = userRef.current;
      // Auth has propagated to queries: either it's the anonymous session we
      // expect, or another identity that no amount of waiting will change.
      if (current != null) return current.isAnonymous === true;
      if (Date.now() >= deadline) return false;
      await wait(ANON_PROPAGATION_POLL_MS);
    }
  }, []);

  // Claim a username for the current anonymous session. Right after
  // signIn("anonymous") the server may not yet see the anonymous identity, so
  // we wait on the reactive auth state (users.me) to propagate FIRST rather
  // than firing the mutation on a fixed-delay timer. Waiting on the real
  // propagation signal — instead of a speculative immediate attempt — is what
  // keeps the noisy "not authenticated" console error (the asap bugfix) gone.
  const claimUsername = useCallback(
    async (rawUsername: string, opts?: { inviteCode?: string }) => {
      const normalizedUsername = normalizeUsernameInput(rawUsername);
      if (!isValidUsername(normalizedUsername)) {
        throw new AuthError(
          "invalid_username",
          "Username must be 3-24 lowercase letters, numbers, or underscores.",
        );
      }
      const propagated = await waitForAnonymousSession();
      if (!propagated) {
        throw new AuthError(
          "unknown",
          "Could not establish a guest session. Please try again.",
        );
      }
      try {
        await claimUsernameOnly({
          username: normalizedUsername,
          deviceNonce: getDeviceNonce(),
          inviteCode: opts?.inviteCode?.trim() || undefined,
        });
      } catch (err) {
        throw mapAuthError(err, "unknown");
      }
    },
    [claimUsernameOnly, waitForAnonymousSession],
  );

  // Upgrade an anonymous + username user to a full password account. The server
  // links the credential to the SAME user doc, preserving username + casual
  // progress; ranked starts only after this completes.
  const upgradeAccount = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const normalized = normalizeEmail(email);
      if (!EMAIL_RE.test(normalized)) {
        throw new AuthError("invalid_email", "Please enter a valid email address.");
      }
      if (isLegacyVerveqEmail(normalized)) {
        throw new AuthError(
          "legacy_email",
          "That email domain is reserved. Please use your real email address.",
        );
      }
      const pwResult = validatePassword(password);
      if (!pwResult.ok && pwResult.reason) {
        throw new AuthError("weak_password", describePasswordReason(pwResult.reason));
      }
      try {
        await upgradeUsernameOnly({
          email: normalized,
          password,
          displayName: displayName?.trim() || undefined,
        });
      } catch (err) {
        throw mapAuthError(err, "upgrade_unavailable");
      }
    },
    [upgradeUsernameOnly],
  );

  const signUp = useCallback(
    async (email: string, password: string, username: string, displayName?: string) => {
      const normalized = normalizeEmail(email);
      const normalizedUsername = normalizeUsernameInput(username);
      if (!EMAIL_RE.test(normalized)) {
        throw new AuthError("invalid_email", "Please enter a valid email address.");
      }
      if (isLegacyVerveqEmail(normalized)) {
        throw new AuthError(
          "legacy_email",
          "That email domain is reserved. Please use your real email address.",
        );
      }
      if (!isValidUsername(normalizedUsername)) {
        throw new AuthError(
          "invalid_username",
          "Username must be 3-24 lowercase letters, numbers, or underscores.",
        );
      }
      const pwResult = validatePassword(password);
      if (!pwResult.ok && pwResult.reason) {
        throw new AuthError("weak_password", describePasswordReason(pwResult.reason));
      }
      setTabGuestSession(false);
      setLocalGuestActive(false);
      try {
        await convexSignIn("password", {
          email: normalized,
          password,
          flow: "signUp",
          ...(displayName ? { displayName } : {}),
        });
      } catch (err) {
        throw mapAuthError(err, "unknown");
      }
      try {
        await ensureProfileAfterAuth({
          username: normalizedUsername,
          displayName: displayName?.trim() || undefined,
          isGuest: false,
        });
      } catch (err) {
        throw mapAuthError(err, "unknown");
      }
    },
    [convexSignIn, ensureProfileAfterAuth],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const normalized = normalizeEmail(email);
      if (!EMAIL_RE.test(normalized)) {
        throw new AuthError("invalid_email", "Please enter a valid email address.");
      }
      if (isLegacyVerveqEmail(normalized)) {
        throw new AuthError(
          "legacy_email",
          "That email domain is no longer supported. Please create a new account with your real email address.",
        );
      }
      setTabGuestSession(false);
      setLocalGuestActive(false);
      try {
        await convexSignIn("password", {
          email: normalized,
          password,
          flow: "signIn",
        });
      } catch (err) {
        throw mapAuthError(err, "invalid_credentials");
      }
    },
    [convexSignIn],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const normalized = normalizeEmail(email);
      if (!EMAIL_RE.test(normalized)) {
        throw new AuthError("invalid_email", "Please enter a valid email address.");
      }
      if (isLegacyVerveqEmail(normalized)) {
        throw new AuthError(
          "legacy_email",
          "That email domain is not valid for password reset.",
        );
      }
      try {
        await convexSignIn("password", {
          email: normalized,
          flow: "reset",
        });
      } catch (err) {
        throw mapAuthError(err, "unknown");
      }
    },
    [convexSignIn],
  );

  const confirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      const normalized = normalizeEmail(email);
      if (!EMAIL_RE.test(normalized)) {
        throw new AuthError("invalid_email", "Please enter a valid email address.");
      }
      const trimmedCode = code.trim();
      if (trimmedCode.length === 0) {
        throw new AuthError("invalid_code", "Please enter the reset code from your email.");
      }
      const pwResult = validatePassword(newPassword);
      if (!pwResult.ok && pwResult.reason) {
        throw new AuthError("weak_password", describePasswordReason(pwResult.reason));
      }
      try {
        await convexSignIn("password", {
          email: normalized,
          code: trimmedCode,
          newPassword,
          flow: "reset-verification",
        });
      } catch (err) {
        throw mapAuthError(err, "invalid_code");
      }
    },
    [convexSignIn],
  );

  const loginAsGuest = useCallback(async () => {
    if (user) {
      await convexSignOut();
    }
    setTabGuestSession(true);
    setLocalGuestActive(true);
  }, [convexSignOut, user]);

  const logout = useCallback(async () => {
    setTabGuestSession(false);
    setLocalGuestActive(false);
    await convexSignOut();
  }, [convexSignOut]);

  const signOutToGuest = useCallback(async () => {
    await convexSignOut();
    setTabGuestSession(true);
    setLocalGuestActive(true);
  }, [convexSignOut]);

  const authUser: AuthUser | null = localGuestActive && !user
    ? LOCAL_GUEST_USER
    : user
      ? {
          _id: user._id,
          username: user.username ?? "",
          displayName: user.displayName,
          isGuest: user.isGuest ?? user.isAnonymous ?? false,
          totalGames: user.totalGames ?? 0,
          avatarUrl: user.avatarUrl,
        }
      : null;

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        isAuthenticated,
        isGuest,
        isLoading,
        accountState,
        isAnonymous,
        hasUsername,
        isUsernameOnly,
        isFullAccount,
        username: serverUsername,
        startAnonymousSession,
        claimUsername,
        upgradeAccount,
        signUp,
        signIn,
        requestPasswordReset,
        confirmPasswordReset,
        loginAsGuest,
        logout,
        signOutToGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
