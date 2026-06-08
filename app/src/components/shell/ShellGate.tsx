import { Suspense, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { V2_SHELL_ENABLED } from "@/lib/flags";

/**
 * Flag guard for every v2-shell route. When `VITE_V2_SHELL_ENABLED` is OFF the
 * new routes redirect to the current live `/home`, so the shell is invisible
 * until explicitly enabled. When ON, children render inside a local Suspense
 * boundary so a screen suspending on its lazy i18n namespace shows the shell
 * fallback rather than blanking the whole app.
 */
function ShellFallback() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <p className="font-heading font-bold uppercase tracking-wide animate-pulse">
        Loading…
      </p>
    </div>
  );
}

export function ShellGate({ children }: { children: ReactNode }) {
  if (!V2_SHELL_ENABLED) {
    return <Navigate to="/home" replace />;
  }
  return <Suspense fallback={<ShellFallback />}>{children}</Suspense>;
}
