/**
 * Route gating for the low-friction onboarding model on the v2 shell.
 *
 * These guards reflect the SERVER's eligibility rules (convex/lib/authz.ts) so
 * the FE shows the same gates the backend enforces — never a client guess:
 *
 *  - {@link SessionRoute}: the solo/casual set (Daily, Daily Survival, Blitz,
 *    Higher-Lower, VerveGrid, Learn). ANY server identity passes, and a cold
 *    visitor gets one minted silently — no account screen before play. These
 *    surfaces key every write on `userId` and read no username, so this guard
 *    is exactly as strict as their handlers (`lib/authz.assertSessionUser`).
 *  - {@link UsernameOnlyRoute}: the SOCIAL set — surfaces where other humans
 *    see a name (Profile, Duels, Arena, Rivals, Crews). Anyone with a
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
 * Both render INSIDE `ShellGate`.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { Button } from "@/components/ui/button";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { ANONYMOUS_FIRST_ENABLED } from "@/lib/flags";
import { useAuth, type AccountState } from "@/contexts/AuthContext";
import { InkLoader } from "@/components/shell/InkLoader";

function ShellLoader() {
  return <InkLoader />;
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

/**
 * Rung 1 — ANY server identity, minted silently if the visitor has none.
 *
 * The happy path renders no account UI at all: a cold visitor lands on the
 * mode, an anonymous session is minted underneath them, and the children mount
 * the moment `users.me` resolves. The only thing shown in between is the same
 * spinner a returning user already sees while auth settles, because the mint
 * is a network round trip and the children would otherwise fire their
 * `startSession` mutation unauthenticated.
 *
 * Failure is never a dead end: if minting is refused (the IP permit gate) the
 * visitor falls through to the ACCOUNT CHOOSER with `?next=` intact, which is
 * exactly where {@link UsernameOnlyRoute} would have sent them anyway.
 *
 * Behind {@link ANONYMOUS_FIRST_ENABLED}. With the flag OFF this guard IS
 * `UsernameOnlyRoute` — same gate, same redirect — so the routes below can be
 * switched over in one commit and shipped to a backend that has not been
 * deployed yet (see flags.ts for why that window exists).
 */
export function SessionRoute({ children }: { children: ReactNode }) {
  const { accountState, hasUsername, ensureSession } = useAuth();
  const location = useLocation();
  const [mintFailed, setMintFailed] = useState(false);
  // One mint attempt per mount. Not state: flipping it must not re-render, and
  // it has to be readable synchronously by the effect that guards on it.
  const attemptedRef = useRef(false);

  const shouldMint =
    ANONYMOUS_FIRST_ENABLED && accountState === "loggedOut" && !mintFailed;

  useEffect(() => {
    if (!shouldMint || attemptedRef.current) return;
    attemptedRef.current = true;
    let cancelled = false;
    void ensureSession().then((ok) => {
      if (!ok && !cancelled) setMintFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [shouldMint, ensureSession]);

  const next = currentTarget(location.pathname, location.search);

  if (!ANONYMOUS_FIRST_ENABLED) {
    if (accountState === "loading") return <ShellLoader />;
    if (hasUsername) return <>{children}</>;
    return <Navigate to={accountChoiceUrl(next)} replace />;
  }

  if (accountState === "loading") return <ShellLoader />;
  // Any identity at all clears this gate — needsUsername (freshly minted
  // anonymous) included. That IS the point of the tier.
  if (accountState !== "loggedOut") return <>{children}</>;
  if (mintFailed) return <Navigate to={accountChoiceUrl(next)} replace />;
  return <ShellLoader />;
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

/**
 * What a visitor without an account can play instead of the ranked mode they
 * asked for: that game's free daily. The server refuses ranked Quiz/Survival
 * runs to guests (quizSessions.createSession and survivalSessions.startGame
 * assert a full account), so the gate must never promise a casual run.
 */
export function freeAlternative(next: string): { to: string; key: "altDaily" | "altSurvival" } | null {
  const url = new URL(next, "https://verveq.invalid");
  if (url.pathname === SHELL_ROUTES.quizPlay) {
    const sport = url.searchParams.get("sport") ?? "football";
    return { to: `${SHELL_ROUTES.dailyPlay}?sport=${encodeURIComponent(sport)}`, key: "altDaily" };
  }
  if (url.pathname === SHELL_ROUTES.survivalPlay) {
    return { to: SHELL_ROUTES.dailySurvival, key: "altSurvival" };
  }
  return null;
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
  // A guest (a name, no password) creates an account in place and keeps
  // everything. Anyone else goes through the chooser first.
  const canUpgrade = state === "usernameOnly";
  const alternative = freeAlternative(next);

  return (
    <ShellLayout hideNav center back onBack={() => navigate(SHELL_ROUTES.home)}>
      <div className="w-full max-w-sm mx-auto">
        <NeoCard shadow="lg" className="p-6 text-center">
          <div className="neo-border rounded-lg bg-muted w-fit p-3 mx-auto mb-4">
            <Lock size={28} strokeWidth={2.5} />
          </div>
          <h1 className="text-title font-heading font-bold mb-2">
            {alternative ? t("gate.title") : t("gate.titleOther")}
          </h1>
          <p className="text-body-sm text-muted-foreground mb-5">
            {canUpgrade ? t("gate.bodyUpgrade") : t("gate.bodyCreate")}
          </p>
          <NeoButton
            variant="primary"
            size="full"
            onClick={() => navigate(canUpgrade ? upgradeUrl(next) : accountChoiceUrl(next))}
          >
            {t("gate.cta")}
          </NeoButton>
          {alternative && (
            <NeoButton
              variant="secondary"
              size="full"
              className="mt-3"
              onClick={() => navigate(alternative.to)}
              data-testid="gate-free-alternative"
            >
              {alternative.key === "altDaily" ? t("gate.altDaily") : t("gate.altSurvival")}
            </NeoButton>
          )}
          <p className="text-body-sm text-muted-foreground font-heading mt-3">
            <Button variant="link" onClick={() => navigate(SHELL_ROUTES.home)}>
              {t("gate.later")}
            </Button>
          </p>
        </NeoCard>
      </div>
    </ShellLayout>
  );
}
