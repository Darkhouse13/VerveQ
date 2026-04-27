import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { useNavigate, useLocation } from "react-router-dom";
import { Star, ArrowUp, ArrowDown } from "lucide-react";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { GameResultState } from "@/types/api";

function getGrade(accuracy: number) {
  if (accuracy >= 0.9)
    return { letter: "A", color: "success" as const, stars: 3 };
  if (accuracy >= 0.7)
    return { letter: "B", color: "primary" as const, stars: 2 };
  if (accuracy >= 0.5)
    return { letter: "C", color: "accent" as const, stars: 1 };
  if (accuracy >= 0.3)
    return { letter: "D", color: "blue" as const, stars: 1 };
  return { letter: "F", color: "destructive" as const, stars: 0 };
}

function getKFactorExplanation(label?: string, k?: number) {
  if (!label || !k) return null;
  if (label === "Placement Match") {
    return `K=${k}: early games move faster while your rating settles.`;
  }
  if (label === "High-Tier Protection") {
    return `K=${k}: rating moves slower above 2000 ELO.`;
  }
  return `K=${k}: standard rating movement.`;
}

export default function ResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const checkAchievements = useMutation(api.achievements.checkAndUnlock);

  const state = location.state as GameResultState | null;

  useEffect(() => {
    if (!state) {
      navigate("/home", { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await checkAchievements();
        if (res.newlyUnlocked.length > 0) {
          toast.success(
            `Achievement unlocked! (${res.newlyUnlocked.length} new)`,
          );
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  const isQuiz = state.mode === "quiz";
  const accuracy = isQuiz
    ? state.correctCount / state.total
    : state.score / Math.max(state.total, 1);
  const grade = getGrade(accuracy);
  const eloChange = state.eloChange;
  const eloPositive = eloChange !== null && eloChange >= 0;
  const kFactorExplanation = getKFactorExplanation(
    state.kFactorLabel,
    state.kFactor,
  );

  const stats = isQuiz
    ? [
        { label: "Correct", value: `${state.correctCount}`, color: "success" as const },
        { label: "Avg Time", value: `${state.avgTime.toFixed(1)}s`, color: "blue" as const },
        { label: "Accuracy", value: `${Math.round(accuracy * 100)}%`, color: "accent" as const },
        { label: "Score", value: `${state.score}`, color: "primary" as const },
      ]
    : [
        { label: "Rounds", value: `${state.total}`, color: "success" as const },
        { label: "Score", value: `${state.score}`, color: "primary" as const },
        { label: "Sport", value: state.sport, color: "blue" as const },
        { label: "Mode", value: "Survival", color: "accent" as const },
      ];

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-6">
        <p className="font-mono font-bold text-6xl animate-pulse-score">
          {isQuiz ? `${state.correctCount}/${state.total}` : state.score}
        </p>
        <p className="font-heading text-sm text-muted-foreground mt-2">
          Final Score
        </p>
      </NeoCard>

      <div className="mb-4 animate-badge-land">
        <NeoBadge
          color={grade.color}
          rotated
          size="md"
          className="text-2xl px-6 py-2"
        >
          {grade.letter}
        </NeoBadge>
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <Star
            key={s}
            size={32}
            strokeWidth={2.5}
            className={`neo-border rounded ${s <= grade.stars ? "fill-primary text-primary" : "text-muted"}`}
          />
        ))}
      </div>

      {eloChange !== null && (
        <div className="flex items-center gap-2 mb-6">
          {eloPositive ? (
            <ArrowUp
              size={20}
              strokeWidth={3}
              className="text-success"
            />
          ) : (
            <ArrowDown
              size={20}
              strokeWidth={3}
              className="text-destructive"
            />
          )}
          <span
            className={`font-mono font-bold text-xl ${eloPositive ? "text-success" : "text-destructive"}`}
          >
            {eloPositive ? "+" : ""}
            {Math.round(eloChange)} ELO
          </span>
        </div>
      )}

      {state.kFactorLabel && state.kFactorLabel !== "Standard" && (
        <div className="mb-6 text-center">
          <NeoBadge
            color={state.kFactorLabel === "Placement Match" ? "blue" : "accent"}
            rotated
            size="md"
          >
            {state.kFactorLabel}
          </NeoBadge>
          {kFactorExplanation && (
            <p className="text-xs text-muted-foreground mt-3 max-w-xs">
              {kFactorExplanation}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 w-full mb-8">
        {stats.map((s) => (
          <NeoCard
            key={s.label}
            color={s.color}
            className="text-center py-3"
          >
            <p className="font-mono font-bold text-lg">{s.value}</p>
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
          onClick={() => navigate(`/sport-select?mode=${state.mode}`)}
        >
          Play Again
        </NeoButton>
        <NeoButton
          variant="secondary"
          size="full"
          onClick={() =>
            navigate(
              `/sport-select?mode=${isQuiz ? "survival" : "quiz"}`,
            )
          }
        >
          Try Other Mode
        </NeoButton>
        <button
          className="w-full text-center text-sm text-muted-foreground font-heading underline underline-offset-4 cursor-pointer"
          onClick={() => navigate("/home")}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
