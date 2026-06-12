/**
 * Top-level entry routing for the v2-default rollout.
 *
 * These two thin wrappers are the ONLY place the app decides between the v1 and
 * v2 landing experiences, and they are fully gated on `VITE_V2_SHELL_ENABLED`:
 *
 *  - Flag OFF → render the exact v1 screens (`LoginScreen` at `/`, `HomeScreen`
 *    at `/home`). Nothing about the live app changes, so the dark bundle stays a
 *    clean rollback.
 *  - Flag ON → a normal visit lands in the v2 unified shell. `/home` (the
 *    post-login + post-game destination that every screen already navigates to)
 *    redirects to the v2 two-pillar Home, and a bare `/` does the same so a
 *    first-time visitor to verveq.com lands in v2.
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
import { Navigate, useSearchParams } from "react-router-dom";
import { V2_SHELL_ENABLED } from "@/lib/flags";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import LoginScreen from "@/pages/LoginScreen";
import HomeScreen from "@/pages/HomeScreen";

/** `/` — v1 login when the flag is off; v2 shell landing (default) when on. */
export function EntryRoute() {
  const [params] = useSearchParams();
  if (!V2_SHELL_ENABLED) return <LoginScreen />;
  // Explicit auth/deep-link intents keep the password screen reachable at "/".
  const hasAuthIntent = params.has("mode") || params.has("from");
  if (hasAuthIntent) return <LoginScreen />;
  return <Navigate to={SHELL_ROUTES.home} replace />;
}

/** `/home` — v1 Home when the flag is off; redirect to the v2 Home when on. */
export function HomeRoute() {
  if (V2_SHELL_ENABLED) return <Navigate to={SHELL_ROUTES.home} replace />;
  return <HomeScreen />;
}
