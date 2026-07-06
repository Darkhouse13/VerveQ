import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { friendlyError } from "@/lib/errors";
import i18n from "@/i18n";

// The boundary must never crash itself: translate through the raw i18n
// instance (hooks are unavailable in a class component) and fall back to
// English if the screens namespace isn't loaded when the crash happens.
function tSafe(key: string, fallback: string): string {
  try {
    const value = i18n.t(key, { ns: "screens", defaultValue: fallback });
    return typeof value === "string" && value ? value : fallback;
  } catch {
    return fallback;
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route ErrorBoundary caught", error, info.componentStack);
    // No-op unless initSentry() ran (prod build with a DSN).
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center justify-center">
        <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
          <h1 className="text-2xl font-heading font-bold mb-2">
            {tSafe("errorBoundary.title", "Something went off-script")}
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            {tSafe(
              "errorBoundary.body",
              "We hit an unexpected error while drawing this screen. Try again — or reload if it sticks.",
            )}
          </p>
          {this.state.error?.message && (
            <p className="text-xs font-mono text-destructive break-words mb-5">
              {friendlyError(this.state.error)}
            </p>
          )}
          <div className="space-y-2.5">
            <NeoButton variant="primary" size="full" onClick={this.handleReset}>
              {tSafe("errorBoundary.tryAgain", "Try again")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="full"
              onClick={this.handleReload}
            >
              {tSafe("errorBoundary.reload", "Reload page")}
            </NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  }
}
