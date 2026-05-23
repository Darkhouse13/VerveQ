import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCountdown } from "@/hooks/useCountdown";
import { Calendar, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function getMidnightUTC(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).getTime();
}

export function DailyBanner() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();

  const quizStatus = useQuery(
    api.dailyChallenge.getAttemptStatus,
    isGuest ? "skip" : { sport: "football", mode: "quiz" },
  );

  const statusLoading = !isGuest && quizStatus === undefined;
  const hasPlayed = !isGuest && quizStatus !== null && quizStatus !== undefined;
  const resetAt = quizStatus?.resetAt ?? getMidnightUTC();
  const { hours, minutes, seconds } = useCountdown(resetAt);

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
          {statusLoading ? (
            <p className="text-xs opacity-90">Checking today's challenge...</p>
          ) : hasPlayed ? (
            <p className="text-xs opacity-90">
              {quizStatus?.completed ? `Score: ${quizStatus.score} | ` : "Attempt used | "}Resets in {timeStr}
            </p>
          ) : isGuest ? (
            <p className="text-xs opacity-90">Create a username to play daily challenges.</p>
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
            disabled={statusLoading}
            className={statusLoading ? "opacity-70 cursor-wait" : undefined}
            onClick={() => navigate(isGuest ? "/?mode=signup&from=guest" : "/daily-quiz?sport=football")}
          >
            {statusLoading ? "Checking" : isGuest ? "Create Account" : "Play"}
          </NeoButton>
        )}
      </div>
    </NeoCard>
  );
}
