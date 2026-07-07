/**
 * Route gating for the low-friction onboarding model on the v2 shell.
 *
 * These guards reflect the SERVER's eligibility rules (convex/lib/authz.ts) so
 * the FE shows the same gates the backend enforces — never a client guess:
 *
 *  - {@link UsernameOnlyRoute}: the casual / social set (Blitz, Higher-Lower,
 *    VerveGrid, Career Path) plus identity surfaces like Profile. Anyone with a
 *    username — anonymous OR full — may pass. Visitors without one land on the
 *    ACCOUNT CHOOSER (sign in / create account / play as guest), preserving
 *    where they were headed via `?next=`. The bare username ask is reserved
 *    for the guest choice and invite flows (Arena codes, duel links).
 *  - {@link FullAccountRoute}: the ranked / full-account set (ranked Quiz &
 *    Survival, official Daily, live-ranked). Only non-anonymous accounts with a
 *    username pass. Anonymous + username users get a clean "create a full
 *    account" upgrade CTA (mirroring the server's rejection); visitors with no
 *    username are routed through onboarding first.
 *
 * Both assume they render INSIDE `ShellGate`, so when the v2 flag is off these
 * routes never mount (the shell redirects to /home).
 */
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Lock } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth, type AccountState } from "@/contexts/AuthContext";

function ShellLoader() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <Loader2 className="animate-spin" size={28} strokeWidth={2.5} />
    </div>
  );
}

function currentTarget(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

function accountChoiceUrl(next: string): string {
  return `${SHELL_ROUTES.account}?next=${encodeURIComponent(next)}`;
}

function upgradeUrl(next: string): string {
  return `${SHELL_ROUTES.upgrade}?next=${encodeURIComponent(next)}`;
}

/** Casual/social modes: any user WITH a username (anonymous or full). */
export function UsernameOnlyRoute({ children }: { children: ReactNode }) {
  const { accountState, hasUsername } = useAuth();
  const location = useLocation();

  if (accountState === "loading") return <ShellLoader />;
  if (hasUsername) return <>{children}</>;

  const next = currentTarget(location.pathname, location.search);
  return <Navigate to={accountChoiceUrl(next)} replace />;
}

/** Ranked/full-account modes: only non-anonymous accounts with a username. */
export function FullAccountRoute({ children }: { children: ReactNode }) {
  const { accountState, isFullAccount } = useAuth();
  const location = useLocation();

  if (accountState === "loading") return <ShellLoader />;
  if (isFullAccount) return <>{children}</>;

  const next = currentTarget(location.pathname, location.search);
  return <FullAccountGate next={next} state={accountState} />;
}

function FullAccountGate({
  next,
  state,
}: {
  next: string;
  state: AccountState;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Anonymous + username: the headline upgrade path — keep username + casual
  // progress, unlock ranked. Otherwise (logged out / no username yet) the user
  // needs a username first, so route them through onboarding.
  const canUpgrade = state === "usernameOnly";

  return (
    <ShellLayout hideNav center back onBack={() => navigate(SHELL_ROUTES.home)}>
      <div className="w-full max-w-sm mx-auto">
        <NeoCard shadow="lg" className="p-6 text-center">
          <div className="neo-border rounded-xl bg-muted w-fit p-3 mx-auto mb-4">
            <Lock size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-heading font-bold mb-2">
            {t("gate.title", { defaultValue: "Full account required" })}
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            {canUpgrade
              ? t("gate.bodyUpgrade", {
                  defaultValue:
                    "You're playing username-only, so this run stays casual. Ranked modes and global leaderboards need a full account — upgrading keeps your username and casual progress.",
                })
              : t("gate.bodyCreate", {
                  defaultValue:
                    "Ranked modes and global leaderboards need a full account. Create one to start climbing.",
                })}
          </p>
          {canUpgrade ? (
            <NeoButton
              variant="primary"
              size="full"
              onClick={() => navigate(upgradeUrl(next))}
            >
              {t("gate.ctaUpgrade", { defaultValue: "Save my progress & go ranked" })}
            </NeoButton>
          ) : (
            <NeoButton
              variant="primary"
              size="full"
              onClick={() => navigate(accountChoiceUrl(next))}
            >
              {t("gate.ctaCreate", { defaultValue: "Get started" })}
            </NeoButton>
          )}
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.home)}
            className="w-full text-sm text-muted-foreground font-heading underline underline-offset-4 hover:text-foreground mt-3"
          >
            {t("gate.later", { defaultValue: "Maybe later" })}
          </button>
        </NeoCard>
      </div>
    </ShellLayout>
  );
}
