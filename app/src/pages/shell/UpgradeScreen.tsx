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
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("shell");

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
        <div className="flex justify-center">
          <Loader2 className="animate-spin" size={28} strokeWidth={2.5} aria-label={t("common.loading")} />
        </div>
      </ShellLayout>
    );
  }

  // No identity to upgrade yet — offer the account chooser instead of the
  // bare username ask (a visitor here likely wants the create-account path).
  if (accountState !== "usernameOnly") {
    return (
      <Navigate
        to={`${SHELL_ROUTES.account}?next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  return (
    <ShellLayout hideNav back onBack={() => navigate(next)}>
      {/* Centered when it fits; scrolls from the top when the form is taller
          than the screen (ShellLayout's `center` would clip its head). */}
      <div className="flex min-h-full flex-col justify-center py-2">
        <UpgradeAccountForm onSuccess={onSuccess} />
      </div>
    </ShellLayout>
  );
}
