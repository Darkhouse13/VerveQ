/**
 * `/v2/welcome` — the standalone username-only onboarding route.
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
import { ShellLayout } from "@/components/shell/ShellLayout";
import { UsernameOnlyOnboarding } from "@/components/shell/onboarding/UsernameOnlyOnboarding";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

function safeInternalPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return SHELL_ROUTES.home;
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeInternalPath(params.get("next"));
  const code = params.get("code")?.trim() || undefined;

  const onComplete = useCallback(() => {
    navigate(next, { replace: true });
  }, [navigate, next]);

  return (
    <ShellLayout hideNav center>
      <UsernameOnlyOnboarding inviteCode={code} onComplete={onComplete} />
    </ShellLayout>
  );
}
