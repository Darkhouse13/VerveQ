/**
 * `/v2/account` — the account chooser for logged-out visitors who hit a gated
 * shell surface (profile tab, casual modes, Learn, ranked CTAs).
 *
 * Three explicit paths: sign in to an existing account, create a full account,
 * or continue as a guest (the username-only flow). The bare username ask
 * (`/v2/welcome`) is intentionally NOT the default any more — it is reserved
 * for the guest choice here and for invite flows (Arena codes, duel links),
 * where the inline join must stay one-field fast.
 *
 * `?next=` carries the destination the visitor was headed to; it is validated
 * to an internal single-slash path (no open redirects) and threaded through
 * whichever path they pick. Visitors who already have a username are bounced
 * straight to `next`.
 */
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, LogIn, UserPlus, Zap } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoLogo } from "@/components/neo/NeoLogo";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";

function safeInternalPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return SHELL_ROUTES.home;
}

export default function AccountChoiceScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("shell");
  const { accountState, hasUsername } = useAuth();
  const [params] = useSearchParams();
  const next = safeInternalPath(params.get("next"));
  const encodedNext = encodeURIComponent(next);

  if (accountState === "loading") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} strokeWidth={2.5} />
      </div>
    );
  }

  // Anyone with a server identity has already chosen — continue on.
  if (hasUsername) return <Navigate to={next} replace />;

  return (
    <ShellLayout hideNav center back onBack={() => navigate(SHELL_ROUTES.home)}>
      <div className="w-full max-w-sm mx-auto">
        <NeoCard shadow="lg" className="p-6">
          <div className="flex justify-center mb-4">
            <NeoLogo size="sm" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-center mb-2">
            {t("account.title")}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {t("account.body")}
          </p>
          <div className="flex flex-col gap-3">
            <NeoButton
              variant="primary"
              size="full"
              onClick={() => navigate(`/?mode=signup&next=${encodedNext}`)}
            >
              <UserPlus size={18} strokeWidth={2.5} className="mr-2" />
              {t("account.create")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="full"
              onClick={() => navigate(`/?mode=signin&next=${encodedNext}`)}
            >
              <LogIn size={18} strokeWidth={2.5} className="mr-2" />
              {t("account.signIn")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="full"
              onClick={() =>
                navigate(`${SHELL_ROUTES.welcome}?next=${encodedNext}`)
              }
            >
              <Zap size={18} strokeWidth={2.5} className="mr-2" />
              {t("account.guest")}
            </NeoButton>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("account.guestNote")}
          </p>
        </NeoCard>
      </div>
    </ShellLayout>
  );
}
