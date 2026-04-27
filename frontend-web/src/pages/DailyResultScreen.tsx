import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DailyResultState {
  score: number;
  total: number;
  correctCount: number;
  sport: string;
  shareString?: string;
  mode: "daily-quiz" | "daily-survival";
  eloChange?: number | null;
  newElo?: number | null;
  scoreBreakdown?: Array<{
    correct: boolean;
    timeTaken: number;
    score: number;
  }>;
}

export default function DailyResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as DailyResultState | null;
  const [copied, setCopied] = useState(false);

  if (!state) {
    navigate("/home", { replace: true });
    return null;
  }

  const isQuiz = state.mode === "daily-quiz";
  const dateStr = new Date().toISOString().slice(0, 10);

  const shareText = isQuiz
    ? `VerveQ Daily ${state.sport.charAt(0).toUpperCase() + state.sport.slice(1)} Quiz [${dateStr}] | Score: ${state.score}/1000 | ${state.shareString || ""}`
    : `VerveQ Daily ${state.sport.charAt(0).toUpperCase() + state.sport.slice(1)} Survival [${dateStr}] | Score: ${state.score} | Rounds: ${state.total}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const stats = isQuiz
    ? [
        { label: "Correct", value: `${state.correctCount}/${state.total}`, color: "success" as const },
        { label: "Score", value: `${state.score}`, color: "primary" as const },
        { label: "Sport", value: state.sport, color: "blue" as const },
        { label: "Mode", value: "Daily Quiz", color: "pink" as const },
      ]
    : [
        { label: "Score", value: `${state.score}`, color: "primary" as const },
        { label: "Rounds", value: `${state.total}`, color: "success" as const },
        { label: "Sport", value: state.sport, color: "blue" as const },
        { label: "Mode", value: "Daily Survival", color: "pink" as const },
      ];

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-6">
        <Calendar size={36} strokeWidth={2.5} className="mx-auto mb-3 text-hot-pink" />
        <p className="font-mono font-bold text-5xl">
          {isQuiz ? `${state.correctCount}/${state.total}` : state.score}
        </p>
        <p className="font-heading text-sm text-muted-foreground mt-2">
          Daily Challenge Complete
        </p>
      </NeoCard>

      <div className="mb-4">
        <NeoBadge color="pink" rotated size="md" className="text-lg px-5 py-1.5">
          {dateStr}
        </NeoBadge>
      </div>

      {state.shareString && (
        <NeoCard className="w-full text-center py-4 mb-4">
          <p className="text-2xl tracking-widest mb-3">{state.shareString}</p>
          <NeoButton
            variant="secondary"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <><Check size={14} className="mr-1" /> Copied</>
            ) : (
              <><Copy size={14} className="mr-1" /> Share Result</>
            )}
          </NeoButton>
        </NeoCard>
      )}

      <div className="grid grid-cols-2 gap-2.5 w-full mb-8">
        {stats.map((s) => (
          <NeoCard key={s.label} color={s.color} className="text-center py-3">
            <p className="font-mono font-bold text-lg capitalize">{s.value}</p>
            <p className="text-[10px] font-heading uppercase opacity-80">
              {s.label}
            </p>
          </NeoCard>
        ))}
      </div>

      {isQuiz && state.scoreBreakdown && state.scoreBreakdown.length > 0 && (
        <NeoCard className="w-full mb-8 py-4">
          <p className="font-heading font-bold text-sm text-center mb-3">
            Score Breakdown
          </p>
          <div className="grid grid-cols-5 gap-2">
            {state.scoreBreakdown.map((item, index) => (
              <div
                key={index}
                className={`neo-border rounded-md px-2 py-2 text-center ${
                  item.correct ? "bg-success text-success-foreground" : "bg-muted"
                }`}
              >
                <p className="font-mono font-bold text-xs">Q{index + 1}</p>
                <p className="font-mono font-bold text-sm">{item.score}</p>
                <p className="text-[9px] opacity-80">
                  {item.timeTaken.toFixed(1)}s
                </p>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      <div className="w-full space-y-3">
        <NeoButton
          variant="primary"
          size="full"
          onClick={() => navigate("/home")}
        >
          Back to Home
        </NeoButton>
      </div>
    </div>
  );
}
