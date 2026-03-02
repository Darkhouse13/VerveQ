import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { useNavigate, useLocation } from "react-router-dom";
import { Zap } from "lucide-react";

interface BlitzResultState {
  score: number;
  correctCount: number;
  wrongCount: number;
  sport: string;
  mode: "blitz";
}

export default function BlitzResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as BlitzResultState | null;

  if (!state) {
    navigate("/home", { replace: true });
    return null;
  }

  const stats = [
    { label: "Score", value: `${state.score}`, color: "primary" as const },
    { label: "Correct", value: `${state.correctCount}`, color: "success" as const },
    { label: "Wrong", value: `${state.wrongCount}`, color: "destructive" as const },
    { label: "Sport", value: state.sport, color: "blue" as const },
  ];

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-6">
        <Zap size={40} strokeWidth={2.5} className="mx-auto mb-3 text-hot-pink" />
        <p className="font-mono font-bold text-6xl">{state.score}</p>
        <p className="font-heading text-sm text-muted-foreground mt-2">
          Blitz Score
        </p>
      </NeoCard>

      {state.score >= 500 && (
        <NeoCard color="primary" className="w-full text-center py-3 mb-6">
          <p className="font-heading font-bold text-lg">New High Score!</p>
        </NeoCard>
      )}

      <div className="grid grid-cols-2 gap-2.5 w-full mb-8">
        {stats.map((s) => (
          <NeoCard key={s.label} color={s.color} className="text-center py-3">
            <p className="font-mono font-bold text-lg">{s.value}</p>
            <p className="text-[10px] font-heading uppercase opacity-80">
              {s.label}
            </p>
          </NeoCard>
        ))}
      </div>

      <div className="w-full space-y-3">
        <NeoButton
          variant="primary"
          size="full"
          onClick={() => navigate(`/blitz?sport=${state.sport}`)}
        >
          Play Again
        </NeoButton>
        <NeoButton
          variant="secondary"
          size="full"
          onClick={() => navigate("/home")}
        >
          Back to Home
        </NeoButton>
      </div>
    </div>
  );
}
