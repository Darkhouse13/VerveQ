import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Deep-link alias for a legacy (v1) URL or a spelling variant like /vervegrid:
 * forwards to the shell surface for that mode, so shared/bookmarked links land
 * in the mode — never on the home shell or a 404.
 *
 * `to` may carry default query params (e.g. `?sport=football`); params on the
 * incoming URL are preserved and win over the defaults, so in-flow navigations
 * like `/quiz?sport=…&difficulty=…` keep their intent across the redirect.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const [path, defaults] = to.split("?");
  const params = new URLSearchParams(defaults ?? "");
  new URLSearchParams(location.search).forEach((value, key) => params.set(key, value));
  const search = params.toString();
  return <Navigate to={search ? `${path}?${search}` : path} replace />;
}

/** Legacy arena invite links: `/arena/:code` carries its lobby code into the
 * shell room (`/v2/arena/:code`, which onboards inline without dropping it). */
export function LegacyArenaCodeRedirect() {
  const { code = "" } = useParams<{ code: string }>();
  return <Navigate to={`/v2/arena/${code}`} replace />;
}

/** Legacy rival pages: `/rivals/:opponentUserId` lands on the shell rival
 * page (`/v2/rivals/:opponentUserId`), keeping the opponent id. */
export function LegacyRivalRedirect() {
  const { opponentUserId = "" } = useParams<{ opponentUserId: string }>();
  return <Navigate to={`/v2/rivals/${opponentUserId}`} replace />;
}
