/**
 * Top-level entry routing for the v2-default rollout.
 *
 * These two thin wrappers are the ONLY place the app decides between the v1 and
 * v2 landing experiences, and they are fully gated on `VITE_V2_SHELL_ENABLED`:
 *
 *  - Flag OFF → render the exact v1 screens (`LoginScreen` at `/`, `HomeScreen`
 *    at `/home`). Nothing about the live app changes, so the dark bundle stays a
 *    clean rollback.
 *  - Flag ON → a normal visit resolves by session: anyone with a server
 *    identity lands in the v2 unified shell (`/home` — the post-login +
 *    post-game destination every screen navigates to — redirects there too),
 *    while a SIGNED-OUT visitor on a bare `/` (the cold marketing entry) gets
 *    the orientation landing with an instant, account-free taste round and a
 *    username ask deferred to after they've played (`ColdEntryScreen`).
 *
 * The password auth flow is preserved when the flag is on: every explicit auth
 * surface reaches `/` WITH a query param — sign in/up/reset (`?mode=`), the
 * guest-upgrade CTA (`?mode=signup&from=guest`), and the duel attach
 * (`?from=duel`). Those keep rendering the v1 `LoginScreen` at `/`; only a
 * param-less visit (the "normal visitor") is routed into the shell. From the
 * shell, gated surfaces send an account-less visitor to the account chooser
 * (`/v2/account` — sign in / create account / play as guest) via the shell
 * route guards; the bare username ask stays for guest play and invite flows.
 */
import { lazy, Suspense } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { V2_SHELL_ENABLED } from "@/lib/flags";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { playShortLinkTarget } from "@/lib/playShortLink";
import { useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/pages/LoginScreen";
import HomeScreen from "@/pages/HomeScreen";

// Cold-entry landing for signed-out, context-free visitors. Lazy so the
// signed-in path never pays for it.
const ColdEntryScreen = lazy(() => import("@/pages/shell/ColdEntryScreen"));

/** Neutral splash while auth settles / the cold-entry chunk loads — never
 * flash the cold-entry at a signed-in user or vice versa. */
function EntrySettling() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <Loader2 className="animate-spin" size={28} strokeWidth={2.5} />
    </div>
  );
}

/** `/` — v1 login when the flag is off; with the flag on, a param-less visit
 * resolves by account state: signed-out cold visitors get the orientation
 * landing (instant taste round, deferred username ask), anyone with a session
 * goes to the v2 shell home exactly as before. */
export function EntryRoute() {
  const [params] = useSearchParams();
  const { accountState, isAuthenticated } = useAuth();
  if (!V2_SHELL_ENABLED) return <LoginScreen />;
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

/** `/home` — v1 Home when the flag is off; redirect to the v2 Home when on. */
export function HomeRoute() {
  if (V2_SHELL_ENABLED) return <Navigate to={SHELL_ROUTES.home} replace />;
  return <HomeScreen />;
}

/** `/play` — the off-platform short link (promo endcards, social bios).
 * Redirects into Career Path, the guest-playable marketed mode, preserving
 * attribution params; see lib/playShortLink.ts for the why. */
export function PlayShortLinkRoute() {
  const { search } = useLocation();
  return <Navigate to={playShortLinkTarget(search)} replace />;
}
