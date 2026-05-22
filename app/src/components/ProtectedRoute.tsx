import type { ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { NeoButton } from "@/components/neo/NeoButton";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

function UsernameRequiredScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <div className="neo-border neo-shadow rounded-2xl bg-card p-6 text-center mt-20">
        <Lock size={34} strokeWidth={2.5} className="mx-auto mb-3" />
        <h1 className="text-2xl font-heading font-bold mb-2">Username required</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Guest play is temporary and tab-local. Create a username account before entering modes that write sessions, ELO, daily attempts, challenges, or Forge progress.
        </p>
        <NeoButton variant="primary" size="full" onClick={() => navigate("/?mode=signup&from=guest")}>
          Create Account
        </NeoButton>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function UsernameRequiredRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isGuest } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isGuest) {
    return <UsernameRequiredScreen />;
  }

  return <>{children}</>;
}
