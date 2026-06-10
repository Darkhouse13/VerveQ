import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { V2_SHELL_ENABLED } from "@/lib/flags";

/**
 * Flag-gated deep-link alias: when the v2 shell is the live default, a v1 mode
 * URL (or a spelling variant like /vervegrid) forwards to the surface the v2
 * shell actually exposes for that mode, so shared/bookmarked links land in the
 * mode — never on the home shell or a 404. With the flag OFF this renders its
 * children untouched (the original v1 route, or NotFound for pure aliases), so
 * the flag-off experience stays byte-for-byte v1.
 *
 * `to` may carry default query params (e.g. `?sport=football`); params on the
 * incoming URL are preserved and win over the defaults, so in-flow navigations
 * like `/quiz?sport=…&difficulty=…` keep their intent across the redirect.
 */
export function V2Redirect({ to, children }: { to: string; children: ReactNode }) {
  const location = useLocation();
  if (!V2_SHELL_ENABLED) return <>{children}</>;
  const [path, defaults] = to.split("?");
  const params = new URLSearchParams(defaults ?? "");
  new URLSearchParams(location.search).forEach((value, key) => params.set(key, value));
  const search = params.toString();
  return <Navigate to={search ? `${path}?${search}` : path} replace />;
}

/**
 * Param-preserving alias for v1 arena invite links: `/arena/:code` carries its
 * lobby code into the v2 room (`/v2/arena/:code`, which onboards inline without
 * dropping the code). Flag-off renders the v1 screen unchanged.
 */
export function V2ArenaCodeRedirect({ children }: { children: ReactNode }) {
  const { code = "" } = useParams<{ code: string }>();
  if (!V2_SHELL_ENABLED) return <>{children}</>;
  return <Navigate to={`/v2/arena/${code}`} replace />;
}
