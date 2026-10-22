/**
 * `/account` — the account chooser for logged-out visitors who hit a gated
 * shell surface (profile tab, casual modes, Learn, ranked CTAs).
 *
 * Three explicit paths: sign in to an existing account, create a full account,
 * or continue as a guest (the username-only flow). The bare username ask
 * (`/welcome`) is intentionally NOT the default any more — it is reserved
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/BrandMark";
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
      <ShellLayout hideNav center>
        <div className="flex justify-center">
          <Loader2 className="animate-spin" size={28} strokeWidth={2.5} aria-label={t("common.loading")} />
        </div>
      </ShellLayout>
    );
  }

  // Anyone with a server identity has already chosen — continue on.
  if (hasUsername) return <Navigate to={next} replace />;

  return (
    <ShellLayout hideNav back onBack={() => navigate(SHELL_ROUTES.home)}>
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center py-2">
        <Card elevation="lifted" padding="lg">
          <div className="flex justify-center mb-4">
            <BrandMark variant="mark" size="md" />
          </div>
          <h1 className="mb-2 text-center font-heading text-title font-bold">
            {t("account.title")}
          </h1>
          <p className="mb-6 text-center text-body-sm text-muted-foreground">
            {t("account.body")}
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              block
              onClick={() => navigate(`/?mode=signup&next=${encodedNext}`)}
            >
              <UserPlus size={18} strokeWidth={2.5} aria-hidden="true" />
              {t("account.create")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              block
              onClick={() => navigate(`/?mode=signin&next=${encodedNext}`)}
            >
              <LogIn size={18} strokeWidth={2.5} aria-hidden="true" />
              {t("account.signIn")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              block
              onClick={() =>
                navigate(`${SHELL_ROUTES.welcome}?next=${encodedNext}`)
              }
            >
              <Zap size={18} strokeWidth={2.5} aria-hidden="true" />
              {t("account.guest")}
            </Button>
          </div>
          <p className="mt-4 text-center text-meta text-muted-foreground">
            {t("account.guestNote")}
          </p>
        </Card>
      </div>
    </ShellLayout>
  );
}
