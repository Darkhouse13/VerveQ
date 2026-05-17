import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
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
  | "unknown";

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
  if (lower.includes("username is already taken")) {
    return new AuthError(
      "username_taken",
      "Username is already taken. Choose another one.",
    );
  }
  if (lower.includes("username must")) {
    return new AuthError("invalid_username", message);
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
  const ensureProfile = useMutation(api.users.ensureProfile);

  const isLoading = user === undefined;
  const isAuthenticated = !!user;
  const isGuest = !!(user?.isGuest ?? user?.isAnonymous);

  const ensureProfileAfterAuth = useCallback(
    async (args: { username: string; displayName?: string; isGuest: boolean }) => {
      const delays = [0, 150, 350, 750, 1500];
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
    await convexSignIn("anonymous");
    const guestId = `guest_${Date.now()}`;
    await ensureProfileAfterAuth({
      username: guestId,
      displayName: "Guest",
      isGuest: true,
    });
  }, [convexSignIn, ensureProfileAfterAuth]);

  const logout = useCallback(async () => {
    await convexSignOut();
  }, [convexSignOut]);

  const signOutToGuest = useCallback(async () => {
    await convexSignOut();
    await convexSignIn("anonymous");
    const guestId = `guest_${Date.now()}`;
    await ensureProfileAfterAuth({
      username: guestId,
      displayName: "Guest",
      isGuest: true,
    });
  }, [convexSignOut, convexSignIn, ensureProfileAfterAuth]);

  const authUser: AuthUser | null = user
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
