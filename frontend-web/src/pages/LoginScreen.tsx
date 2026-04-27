import { NeoLogo } from "@/components/neo/NeoLogo";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth, AuthError } from "@/contexts/AuthContext";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validatePassword,
  describePasswordReason,
} from "../../convex/lib/passwordPolicy";
import { toast } from "sonner";

type Mode = "signin" | "signup" | "reset-request" | "reset-confirm";

const MODES: readonly Mode[] = [
  "signin",
  "signup",
  "reset-request",
  "reset-confirm",
];

function isMode(value: string | null): value is Mode {
  return !!value && (MODES as readonly string[]).includes(value);
}

export default function LoginScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    signIn,
    signUp,
    requestPasswordReset,
    confirmPasswordReset,
    loginAsGuest,
    isAuthenticated,
    isGuest,
    isLoading: authLoading,
  } = useAuth();

  const modeParam = searchParams.get("mode");
  const fromGuestUpgrade = searchParams.get("from") === "guest";

  const [mode, setMode] = useState<Mode>(
    isMode(modeParam) ? modeParam : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isGuest) {
      navigate("/home", { replace: true });
    }
  }, [authLoading, isAuthenticated, isGuest, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPwd("");
    setCode("");
  };

  const reportError = (e: unknown) => {
    if (e instanceof AuthError) {
      setError(e.message);
    } else if (e instanceof Error) {
      setError(e.message);
    } else {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleSignIn = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/home");
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    const pw = validatePassword(password);
    if (!pw.ok && pw.reason) {
      setError(describePasswordReason(pw.reason));
      return;
    }
    if (password !== confirmPwd) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, displayName.trim() || undefined);
      navigate("/onboarding");
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    setError(null);
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      toast.success("If that email is registered, a reset code is on its way.");
      switchMode("reset-confirm");
      setEmail(email); // preserve email into next step
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setError(null);
    if (!code.trim()) {
      setError("Please enter the reset code from your email.");
      return;
    }
    const pw = validatePassword(password);
    if (!pw.ok && pw.reason) {
      setError(describePasswordReason(pw.reason));
      return;
    }
    if (password !== confirmPwd) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(email, code, password);
      toast.success("Password updated. You're signed in.");
      navigate("/home");
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    if (isAuthenticated && isGuest) {
      navigate("/home");
      return;
    }
    setLoading(true);
    try {
      await loginAsGuest();
      navigate("/onboarding");
    } catch (e: unknown) {
      reportError(e);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <NeoLogo size="lg" />
      </div>
    );
  }

  const passwordHint =
    mode === "signup" || mode === "reset-confirm"
      ? `At least ${PASSWORD_MIN_LENGTH} characters. Up to ${PASSWORD_MAX_LENGTH}.`
      : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm animate-slide-up">
        <NeoLogo size="lg" />
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold tracking-tight">VerveQ</h1>
          <p className="text-muted-foreground font-heading text-lg mt-1">
            Prove Your Sports IQ
          </p>
        </div>

        {mode === "signin" && (
          <>
            <div className="w-full space-y-3 mt-2">
              <NeoInput
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <NeoInput
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
              />
              {error && (
                <div
                  role="alert"
                  className="text-sm text-destructive font-heading text-center"
                >
                  {error}
                </div>
              )}
              <NeoButton
                variant="primary"
                size="full"
                onClick={handleSignIn}
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </NeoButton>
              <div className="flex items-center justify-between text-sm font-heading">
                <button
                  className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                  onClick={() => switchMode("signup")}
                  disabled={loading}
                >
                  Create account
                </button>
                <button
                  className="underline underline-offset-4 text-muted-foreground hover:text-foreground"
                  onClick={() => switchMode("reset-request")}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
              <NeoButton
                variant="secondary"
                size="full"
                onClick={handleGuest}
                disabled={loading}
              >
                Play as Guest
              </NeoButton>
            </div>
          </>
        )}

        {mode === "signup" && (
          <div className="w-full space-y-3 mt-2">
            {fromGuestUpgrade && (
              <p
                data-testid="guest-upgrade-notice"
                className="text-xs text-muted-foreground font-heading text-center"
              >
                Guest progress is not carried over.
              </p>
            )}
            <NeoInput
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <NeoInput
              type="text"
              autoComplete="nickname"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <NeoInput
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <NeoInput
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
            />
            {passwordHint && (
              <p className="text-xs text-muted-foreground font-heading text-center">
                {passwordHint}
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="text-sm text-destructive font-heading text-center"
              >
                {error}
              </div>
            )}
            <NeoButton
              variant="primary"
              size="full"
              onClick={handleSignUp}
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </NeoButton>
            <button
              className="w-full text-sm text-muted-foreground font-heading underline underline-offset-4 hover:text-foreground"
              onClick={() => switchMode("signin")}
              disabled={loading}
            >
              Back to sign in
            </button>
          </div>
        )}

        {mode === "reset-request" && (
          <div className="w-full space-y-3 mt-2">
            <NeoInput
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRequestReset()}
            />
            <p className="text-xs text-muted-foreground font-heading text-center">
              We'll email you a 6-digit code valid for 10 minutes.
            </p>
            {error && (
              <div
                role="alert"
                className="text-sm text-destructive font-heading text-center"
              >
                {error}
              </div>
            )}
            <NeoButton
              variant="primary"
              size="full"
              onClick={handleRequestReset}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </NeoButton>
            <button
              className="w-full text-sm text-muted-foreground font-heading underline underline-offset-4 hover:text-foreground"
              onClick={() => switchMode("signin")}
              disabled={loading}
            >
              Back to sign in
            </button>
          </div>
        )}

        {mode === "reset-confirm" && (
          <div className="w-full space-y-3 mt-2">
            <NeoInput
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <NeoInput
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <NeoInput
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmReset()}
            />
            {passwordHint && (
              <p className="text-xs text-muted-foreground font-heading text-center">
                {passwordHint}
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="text-sm text-destructive font-heading text-center"
              >
                {error}
              </div>
            )}
            <NeoButton
              variant="primary"
              size="full"
              onClick={handleConfirmReset}
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </NeoButton>
            <button
              className="w-full text-sm text-muted-foreground font-heading underline underline-offset-4 hover:text-foreground"
              onClick={() => switchMode("reset-request")}
              disabled={loading}
            >
              Request a new code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
