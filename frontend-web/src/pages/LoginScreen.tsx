import { NeoLogo } from "@/components/neo/NeoLogo";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { login, loginAsGuest, isAuthenticated, isLoading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate("/home", { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const handleLogin = async () => {
    if (!name.trim()) { toast.error("Please enter a display name"); return; }
    setLoading(true);
    try {
      await login(name.trim());
      navigate("/onboarding");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      await loginAsGuest();
      navigate("/onboarding");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not start guest session");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStart = async () => {
    setLoading(true);
    try {
      await loginAsGuest();
      navigate("/home");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><NeoLogo size="lg" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm animate-slide-up">
        <NeoLogo size="lg" />
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold tracking-tight">VerveQ</h1>
          <p className="text-muted-foreground font-heading text-lg mt-1">Prove Your Sports IQ</p>
        </div>
        <div className="w-full space-y-3 mt-4">
          <NeoInput
            placeholder="Enter display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>
        <div className="w-full space-y-3 mt-2">
          <NeoButton variant="primary" size="full" onClick={handleLogin} disabled={loading}>
            {loading ? "Loading..." : "Create Account"}
          </NeoButton>
          <NeoButton variant="secondary" size="full" onClick={handleGuest} disabled={loading}>
            Play as Guest
          </NeoButton>
        </div>
        <button
          className="text-sm text-muted-foreground font-heading underline underline-offset-4 hover:text-foreground transition-colors cursor-pointer"
          onClick={handleQuickStart}
          disabled={loading}
        >
          Quick Start
        </button>
      </div>
    </div>
  );
}
