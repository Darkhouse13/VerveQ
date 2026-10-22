import { Navigate, useLocation } from "react-router-dom";
import { COLD_LANDING_STATE } from "@/lib/coldLanding";

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
 * over it, the same rule as the params (decision 10: `/compete#x` → `/home#x`).
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

/**
 * The shell lived under `/v2` until 2026-10. `/v2` → `/home`, `/v2/x` → `/x`,
 * query and hash kept. nginx 301s these before the app loads; this covers the
 * visits nginx never sees (an installed PWA serves the shell from its cache).
 */
export function DropV2Redirect() {
  const { pathname, search, hash, key } = useLocation();
  const rest = pathname.replace(/^\/v2(?=\/|$)/, "");
  const to = rest === "" || rest === "/" ? "/home" : rest;
  // A cold landing stays one across the hop, so the page's short link still
  // tags it (see ShortLink in EntryRoutes).
  const state = key === "default" ? COLD_LANDING_STATE : undefined;
  return <Navigate to={`${to}${search}${hash}`} replace state={state} />;
}
