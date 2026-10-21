/**
 * The password account screen — sign in, create an account, reset a
 * password. Reached at `/` with `?mode=` (and `?from=guest|duel`, `?next=`).
 *
 * VerveQ ONE P3.4: a centered shell screen — the brand, one card holding the
 * current form with its one lime submit, quiet ghost links between modes, and
 * "Play as guest" as the secondary way in.
 */
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, AuthError } from "@/contexts/AuthContext";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  validatePassword,
  describePasswordReason,
} from "../../convex/lib/passwordPolicy";
import { notify } from "@/lib/notify";
import { friendlyError } from "@/lib/errors";

type Mode = "signin" | "signup" | "reset-request" | "reset-confirm";

const MODES: readonly Mode[] = [
  "signin",
  "signup",
  "reset-request",
  "reset-confirm",
];

const HEADINGS: Record<Mode, string> = {
  signin: "Welcome back",
  signup: "Create your account",
  "reset-request": "Reset your password",
  "reset-confirm": "Check your email",
};

function isMode(value: string | null): value is Mode {
  return !!value && (MODES as readonly string[]).includes(value);
}

export default function LoginScreen() {
  const { t } = useTranslation("screens");
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
  const fromDuel = searchParams.get("from") === "duel";
  // Optional post-auth destination (e.g. the v2 account chooser sends the
  // gated route the visitor was headed to). Internal single-slash paths only.
  const nextParam = searchParams.get("next");
  const nextPath =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : null;

  const [mode, setMode] = useState<Mode>(
    isMode(modeParam) ? modeParam : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isGuest) {
      if (fromDuel) {
        try {
          const raw = window.localStorage.getItem("verveq_pending_duel_attach");
          if (raw) {
            const pending = JSON.parse(raw) as { linkCode?: string };
            if (pending?.linkCode) {
              navigate(`/duel/${pending.linkCode}`, { replace: true });
              return;
            }
          }
        } catch {
          /* ignore */
        }
      }
      navigate(nextPath ?? "/home", { replace: true });
    }
  }, [authLoading, isAuthenticated, isGuest, navigate, fromDuel, nextPath]);

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
      setError(friendlyError(e, "Something went wrong. Please try again."));
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
      navigate(nextPath ?? "/home");
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
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setError("Username must be 3-24 lowercase letters, numbers, or underscores.");
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
      await signUp(
        email,
        password,
        normalizedUsername,
        displayName.trim() || undefined,
      );
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
      notify.success("If that email is registered, a reset code is on its way.");
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
      notify.success("Password updated. You're signed in.");
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
      <ShellLayout hideNav center>
        <div className="flex justify-center">
          <BrandMark variant="mark" size="lg" />
        </div>
      </ShellLayout>
    );
  }

  const passwordHint =
    mode === "signup" || mode === "reset-confirm"
      ? `At least ${PASSWORD_MIN_LENGTH} characters. Up to ${PASSWORD_MAX_LENGTH}.`
      : null;

  const submit =
    mode === "signin"
      ? handleSignIn
      : mode === "signup"
        ? handleSignUp
        : mode === "reset-request"
          ? handleRequestReset
          : handleConfirmReset;

  const errorLine = error && (
    <p role="alert" className="text-center text-body-sm font-bold text-destructive">
      {error}
    </p>
  );
  const hint = (text: string) => <p className="text-center text-meta text-muted-foreground">{text}</p>;

  return (
    <ShellLayout
      hideNav
      back
      // A cold deep link has no in-app history to go back to: land on Home.
      onBack={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate(SHELL_ROUTES.home))}
    >
      {/* min-h-full + justify-center (not ShellLayout's `center`): centered
          when it fits, and when the sign-up form is taller than the screen it
          scrolls from the top instead of clipping the brand off. */}
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-5 py-2" data-testid="login-screen">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandMark variant="mark" size="md" />
          <h1>
            <BrandMark variant="wordmark" size="lg" />
          </h1>
          <p className="font-heading text-body text-muted-foreground">Prove your football IQ</p>
        </div>

        <Card padding="lg" elevation="lifted">
          <h2 className="mb-4 font-heading text-title-sm font-bold">{HEADINGS[mode]}</h2>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {mode === "signin" && (
              <>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t("login.emailPlaceholder")}
                  aria-label={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("login.passwordPlaceholder")}
                  aria-label={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {errorLine}
                <Button type="submit" variant="primary" size="lg" block loading={loading}>
                  Sign in
                </Button>
                <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" className="px-2" onClick={() => switchMode("signup")} disabled={loading}>
                    Create account
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-muted-foreground"
                    onClick={() => switchMode("reset-request")}
                    disabled={loading}
                  >
                    Forgot password?
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && (
              <>
                {fromGuestUpgrade && (
                  <p data-testid="guest-upgrade-notice" className="text-center text-meta text-muted-foreground">
                    Guest progress is not carried over.
                  </p>
                )}
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t("login.emailPlaceholder")}
                  aria-label={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="flex flex-col gap-1">
                  <Input
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={t("login.usernamePlaceholder")}
                    aria-label={t("login.usernamePlaceholder")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  />
                  {hint(`Your challenge handle: @${username.trim().toLowerCase() || "username"}`)}
                </div>
                <Input
                  type="text"
                  autoComplete="nickname"
                  placeholder={t("login.displayNamePlaceholder")}
                  aria-label={t("login.displayNamePlaceholder")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("login.passwordPlaceholder")}
                  aria-label={t("login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("login.confirmPasswordPlaceholder")}
                  aria-label={t("login.confirmPasswordPlaceholder")}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
                {passwordHint && hint(passwordHint)}
                {errorLine}
                <Button type="submit" variant="primary" size="lg" block loading={loading}>
                  Create account
                </Button>
                <Button variant="ghost" size="sm" block onClick={() => switchMode("signin")} disabled={loading}>
                  Back to sign in
                </Button>
              </>
            )}

            {mode === "reset-request" && (
              <>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t("login.emailPlaceholder")}
                  aria-label={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {hint("We'll email you a 6-digit code valid for 10 minutes.")}
                {errorLine}
                <Button type="submit" variant="primary" size="lg" block loading={loading}>
                  Send reset code
                </Button>
                <Button variant="ghost" size="sm" block onClick={() => switchMode("signin")} disabled={loading}>
                  Back to sign in
                </Button>
              </>
            )}

            {mode === "reset-confirm" && (
              <>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  placeholder={t("login.otpPlaceholder")}
                  aria-label={t("login.otpPlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("login.newPasswordPlaceholder")}
                  aria-label={t("login.newPasswordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t("login.confirmNewPasswordPlaceholder")}
                  aria-label={t("login.confirmNewPasswordPlaceholder")}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                />
                {passwordHint && hint(passwordHint)}
                {errorLine}
                <Button type="submit" variant="primary" size="lg" block loading={loading}>
                  Reset password
                </Button>
                <Button variant="ghost" size="sm" block onClick={() => switchMode("reset-request")} disabled={loading}>
                  Request a new code
                </Button>
              </>
            )}
          </form>
        </Card>

        {mode === "signin" && (
          <Button variant="secondary" size="md" block onClick={handleGuest} disabled={loading}>
            Play as guest
          </Button>
        )}
      </div>
    </ShellLayout>
  );
}
