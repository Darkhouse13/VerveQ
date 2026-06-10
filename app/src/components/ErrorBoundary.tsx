import { Component, type ErrorInfo, type ReactNode } from "react";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { humanizeServerError } from "@/lib/errors";

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
            Something went off-script
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            We hit an unexpected error while drawing this screen. Try again — or
            reload if it sticks.
          </p>
          {this.state.error?.message && (
            <p className="text-xs font-mono text-destructive break-words mb-5">
              {humanizeServerError(this.state.error)}
            </p>
          )}
          <div className="space-y-2.5">
            <NeoButton variant="primary" size="full" onClick={this.handleReset}>
              Try again
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="full"
              onClick={this.handleReload}
            >
              Reload page
            </NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  }
}
