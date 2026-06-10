/**
 * Shared frame for the public legal pages (/privacy, /terms).
 *
 * Deliberately standalone: no auth, no feature flag, no shell or v1 nav — these
 * pages are launch/app-store requirements and must render identically whatever
 * the rollout state. Plain document styling; the only navigation is back home
 * and the sibling legal page.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <div className="max-w-md mx-auto">
        <Link
          to="/"
          className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 inline-flex cursor-pointer active:neo-shadow-pressed transition-all"
          aria-label="Back to home"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </Link>

        <h1 className="text-3xl font-heading font-bold mb-1">{title}</h1>
        <p className="text-xs text-muted-foreground mb-6">
          Last updated: {lastUpdated}
        </p>

        <div className="space-y-5 text-sm leading-relaxed [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p+p]:mt-2">
          {children}
        </div>

        <div className="mt-8 pt-4 border-t-2 border-foreground/10 text-xs text-muted-foreground space-x-3">
          <Link to="/" className="underline underline-offset-4">
            Home
          </Link>
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          <Link to="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
