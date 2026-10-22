import { Suspense, type ReactNode } from "react";
import { InkLoader } from "@/components/shell/InkLoader";

/**
 * Wraps every shell route in a local Suspense boundary, so a screen suspending
 * on its lazy i18n namespace shows the shell fallback rather than blanking the
 * whole app.
 */
function ShellFallback() {
  return <InkLoader />;
}

export function ShellGate({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ShellFallback />}>{children}</Suspense>;
}
