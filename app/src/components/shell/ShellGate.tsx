import { Suspense, type ReactNode } from "react";

/**
 * Wraps every shell route in a local Suspense boundary, so a screen suspending
 * on its lazy i18n namespace shows the shell fallback rather than blanking the
 * whole app.
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
  return <Suspense fallback={<ShellFallback />}>{children}</Suspense>;
}
