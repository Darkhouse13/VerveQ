/**
 * Top-level entry routing.
 *
 * A normal visit resolves by session: anyone with a server identity lands in
 * the shell Home (`/home` — the post-login + post-game destination every
 * screen navigates to), while a SIGNED-OUT visitor on a bare `/`
 * (the cold marketing entry) gets the orientation landing with an instant,
 * account-free taste round and a username ask deferred to after they've played
 * (`ColdEntryScreen`).
 *
 * The password auth flow is preserved: every explicit auth
 * surface reaches `/` WITH a query param — sign in/up/reset (`?mode=`), the
 * guest-upgrade CTA (`?mode=signup&from=guest`), and the duel attach
 * (`?from=duel`). Those keep rendering the v1 `LoginScreen` at `/`; only a
 * param-less visit (the "normal visitor") is routed into the shell. From the
 * shell, gated surfaces send an account-less visitor to the account chooser
 * (`/account` — sign in / create account / play as guest) via the shell
 * route guards; the bare username ask stays for guest play and invite flows.
 */
import { Suspense, type ReactNode } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { isColdLanding } from "@/lib/coldLanding";
import {
  missingLettersShortLinkTarget,
  playShortLinkTarget,
  whosOlderShortLinkTarget,
} from "@/lib/playShortLink";
import { hasWeekendStart, weekendShortLinkTarget } from "@/lib/weekendDeepLink";
import { useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/pages/LoginScreen";

// Cold-entry landing for signed-out, context-free visitors. Lazy so the
// signed-in path never pays for it.
const ColdEntryScreen = lazyWithRetry(() => import("@/pages/shell/ColdEntryScreen"));

/** Neutral splash while auth settles / the cold-entry chunk loads — never
 * flash the cold-entry at a signed-in user or vice versa. */
function EntrySettling() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <Loader2 className="animate-spin" size={28} strokeWidth={2.5} />
    </div>
  );
}

/** `/` — a param-less visit resolves by account state: signed-out cold
 * visitors get the orientation landing (instant taste round, deferred username
 * ask), anyone with a session goes to the shell home. */
export function EntryRoute() {
  const [params] = useSearchParams();
  const { accountState, isAuthenticated } = useAuth();
  // Explicit auth/deep-link intents keep the password screen reachable at "/".
  const hasAuthIntent = params.has("mode") || params.has("from");
  if (hasAuthIntent) return <LoginScreen />;
  if (accountState === "loading") return <EntrySettling />;
  // Cold marketing entry: signed out with no context. `isAuthenticated` also
  // excludes the legacy tab-local guest (who is mid-session, not cold).
  if (accountState === "loggedOut" && !isAuthenticated) {
    return (
      <Suspense fallback={<EntrySettling />}>
        <ColdEntryScreen />
      </Suspense>
    );
  }
  return <Navigate to={SHELL_ROUTES.home} replace />;
}

/** `/play` — the off-platform short link (promo endcards, social bios).
 * Redirects into Career Path, the guest-playable marketed mode, preserving
 * attribution params; see lib/playShortLink.ts for the why. */
export function PlayShortLinkRoute() {
  const { search } = useLocation();
  return <Navigate to={playShortLinkTarget(search)} replace />;
}

/**
 * A short link that is also (or points at) a real page.
 *
 * Without children (`/older`, `/letters`) it always redirects to `target`.
 * Wrapping the page it names (`/whos-older`, `/missing-letters`, `/weekend`)
 * it redirects only on a COLD landing — the document's first route, which
 * react-router keys "default", or a `/v2` hop from it — so a caption or bio
 * visitor still gets the `ref=` tag while an in-app tap on the same page
 * keeps a clean URL.
 * `force` redirects on any visit (WEEKEND's paid `?start=budget`).
 */
function ShortLink({
  target,
  force,
  children,
}: {
  target: (search: string) => string;
  force?: (search: string) => boolean;
  children?: ReactNode;
}) {
  const location = useLocation();
  const { pathname, search } = location;
  if (!children) return <Navigate to={target(search)} replace />;
  if (isColdLanding(location) || force?.(search)) {
    const to = target(search);
    if (to !== `${pathname}${search}`) return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}

/** `/older` (always) and `/whos-older` (cold landings) — the Who's Older
 * reel-caption links. Same attribution rule as /play: a bare hit gets ref=older. */
export function WhosOlderShortLinkRoute({ children }: { children?: ReactNode }) {
  return <ShortLink target={whosOlderShortLinkTarget}>{children}</ShortLink>;
}

/** `/letters` (always) and `/missing-letters` (cold landings) — the Missing
 * Letters reel-caption links. A bare hit gets ref=letters. */
export function MissingLettersShortLinkRoute({ children }: { children?: ReactNode }) {
  return <ShortLink target={missingLettersShortLinkTarget}>{children}</ShortLink>;
}

/** `/weekend` — the WEEKEND hub, and the short link for reel captions and the
 * bio link: a cold landing gets ref=weekend, and a paid `?start=budget` link
 * goes straight into the budget-squad builder. See lib/weekendDeepLink.ts. */
export function WeekendShortLinkRoute({ children }: { children?: ReactNode }) {
  return (
    <ShortLink target={weekendShortLinkTarget} force={hasWeekendStart}>
      {children}
    </ShortLink>
  );
}
