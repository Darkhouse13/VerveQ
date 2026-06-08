/**
 * `/v2/upgrade` — anonymous + username -> full account.
 *
 * Reached from the full-account gate's "save your progress" CTA (or any
 * upgrade prompt). Only meaningful for a username-only (anonymous) session:
 *  - already a full account  -> bounce to `?next=` (nothing to upgrade),
 *  - no username yet          -> route through onboarding first,
 *  - username-only            -> show the upgrade form.
 */
import { useCallback, useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { UpgradeAccountForm } from "@/components/shell/onboarding/UpgradeAccountForm";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";

function safeInternalPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return SHELL_ROUTES.home;
}

export default function UpgradeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeInternalPath(params.get("next"));
  const { accountState, isFullAccount } = useAuth();

  // Finished upgrading (or already full): continue to the original destination.
  useEffect(() => {
    if (isFullAccount) navigate(next, { replace: true });
  }, [isFullAccount, navigate, next]);

  const onSuccess = useCallback(() => {
    navigate(next, { replace: true });
  }, [navigate, next]);

  if (accountState === "loading" || isFullAccount) {
    return (
      <ShellLayout hideNav center>
        <p className="font-heading font-bold uppercase tracking-wide animate-pulse text-center">
          Loading…
        </p>
      </ShellLayout>
    );
  }

  // No username yet — get one first, then come back to upgrade.
  if (accountState !== "usernameOnly") {
    return (
      <Navigate
        to={`${SHELL_ROUTES.welcome}?next=${encodeURIComponent(
          `${SHELL_ROUTES.upgrade}?next=${encodeURIComponent(next)}`,
        )}`}
        replace
      />
    );
  }

  return (
    <ShellLayout hideNav center back onBack={() => navigate(next)}>
      <UpgradeAccountForm onSuccess={onSuccess} />
    </ShellLayout>
  );
}
