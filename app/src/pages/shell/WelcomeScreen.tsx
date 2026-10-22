/**
 * `/welcome` — the standalone username-only onboarding route.
 *
 * Renders the shared {@link UsernameOnlyOnboarding} card with no nav chrome and
 * routes the visitor onward once they have a username. `?next=` carries the
 * post-onboarding destination (e.g. the gated mode route that sent them here);
 * `?code=` carries an Arena invite code so a claim made here is scoped to it.
 *
 * `next` is validated to be an internal, single-slash path to avoid open
 * redirects; anything else falls back to the shell home.
 */
import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { Button } from "@/components/ui/button";
import { UsernameOnlyOnboarding } from "@/components/shell/onboarding/UsernameOnlyOnboarding";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";

function safeInternalPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return SHELL_ROUTES.home;
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { accountState } = useAuth();
  const [params] = useSearchParams();
  const next = safeInternalPath(params.get("next"));
  const code = params.get("code")?.trim() || undefined;

  const onComplete = useCallback(() => {
    navigate(next, { replace: true });
  }, [navigate, next]);

  return (
    <ShellLayout
      hideNav
      back
      // A cold invite link has no in-app history to go back to: offer the
      // account chooser instead of leaving the site.
      onBack={() =>
        (window.history.state?.idx ?? 0) > 0
          ? navigate(-1)
          : navigate(`${SHELL_ROUTES.account}?next=${encodeURIComponent(next)}`)
      }
    >
      {/* Centered when it fits; scrolls from the top when the on-screen
          keyboard leaves less room (ShellLayout's `center` would clip). */}
      <div className="flex min-h-full flex-col justify-center py-2">
        <UsernameOnlyOnboarding inviteCode={code} onComplete={onComplete} />
        {/* Returning users with a password account skip the username flow.
            Only shown with no session — an in-progress anonymous session has
            nothing to sign in to. */}
        {accountState === "loggedOut" && (
          <p className="mt-4 flex items-center justify-center gap-1 text-body-sm text-muted-foreground">
            {t("auth.haveAccount")}
            <Button
              variant="ghost"
              size="sm"
              className="px-2 underline underline-offset-4"
              onClick={() => navigate("/?mode=signin")}
            >
              {t("auth.signIn")}
            </Button>
          </p>
        )}
      </div>
    </ShellLayout>
  );
}
