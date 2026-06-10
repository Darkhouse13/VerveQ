import { Navigate, useLocation, useParams } from "react-router-dom";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

function withSearch(path: string, search: string) {
  return `${path}${search || ""}`;
}

export function V2AliasRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={withSearch(to, search)} replace />;
}

export function ArenaInviteRedirect() {
  const { code = "" } = useParams();
  const { search } = useLocation();
  const safeCode = encodeURIComponent(code.trim());
  return <Navigate to={withSearch(`/v2/arena/${safeCode}`, search)} replace />;
}

export function LegacyDailyRedirect() {
  return <V2AliasRedirect to={SHELL_ROUTES.dailyPlay} />;
}

export function LegacyHigherLowerRedirect() {
  return <V2AliasRedirect to={SHELL_ROUTES.higherLowerPlay} />;
}

export function LegacyVerveGridRedirect() {
  return <V2AliasRedirect to={SHELL_ROUTES.verveGridPlay} />;
}

export function LegacyWhoAmIRedirect() {
  return <V2AliasRedirect to={SHELL_ROUTES.whoAmIPlay} />;
}
