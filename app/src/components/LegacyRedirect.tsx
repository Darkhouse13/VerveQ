import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Deep-link alias for a legacy (v1) URL or a spelling variant like /vervegrid:
 * forwards to the shell surface for that mode, so shared/bookmarked links land
 * in the mode — never on the home shell or a 404.
 *
 * `to` may carry default query params (e.g. `?sport=football`); params on the
 * incoming URL are preserved and win over the defaults, so in-flow navigations
 * like `/quiz?sport=…&difficulty=…` keep their intent across the redirect.
 *
 * `to` may also carry a default `#anchor`; an anchor on the incoming URL wins
 * over it, the same rule as the params (decision 10: `/compete#x` → `/v2#x`).
 */
export function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const [beforeHash, defaultHash] = to.split("#");
  const [path, defaults] = beforeHash.split("?");
  const params = new URLSearchParams(defaults ?? "");
  new URLSearchParams(location.search).forEach((value, key) => params.set(key, value));
  const search = params.toString();
  const hash = location.hash || (defaultHash ? `#${defaultHash}` : "");
  return <Navigate to={`${path}${search ? `?${search}` : ""}${hash}`} replace />;
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
