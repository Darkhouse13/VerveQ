import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCountdown } from "@/hooks/useCountdown";
import { Calendar, Lock } from "lucide-react";

function getMidnightUTC(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).getTime();
}

export function DailyBanner() {
  const navigate = useNavigate();
  const { hours, minutes, seconds } = useCountdown(getMidnightUTC());

  const quizStatus = useQuery(api.dailyChallenge.getAttemptStatus, {
    sport: "football",
    mode: "quiz",
  });

  const hasPlayed = quizStatus?.completed || quizStatus?.forfeited;

  const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <NeoCard shadow="lg" className="bg-hot-pink text-hot-pink-foreground mb-5">
      <div className="flex items-center gap-3">
        <div className="neo-border rounded-xl bg-background p-2.5">
          {hasPlayed ? (
            <Lock size={24} strokeWidth={2.5} className="text-foreground" />
          ) : (
            <Calendar size={24} strokeWidth={2.5} className="text-foreground" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-lg">Daily Challenge</p>
          {hasPlayed ? (
            <p className="text-xs opacity-90">
              Score: {quizStatus?.score} | Resets in {timeStr}
            </p>
          ) : (
            <p className="text-xs opacity-90">New challenge available!</p>
          )}
        </div>
        {hasPlayed ? (
          <p className="font-mono font-bold text-sm">{timeStr}</p>
        ) : (
          <NeoButton
            variant="secondary"
            size="sm"
            onClick={() => navigate("/daily-quiz?sport=football")}
          >
            Play
          </NeoButton>
        )}
      </div>
    </NeoCard>
  );
}
