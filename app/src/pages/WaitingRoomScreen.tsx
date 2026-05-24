import { useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { ExitGameButton } from "@/components/ExitGameButton";
import type { Id } from "../../convex/_generated/dataModel";

export default function WaitingRoomScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get("matchId") as Id<"liveMatches"> | null;

  const match = useQuery(
    api.liveMatches.getMatch,
    matchId ? { matchId } : "skip",
  );
  const matchStatus = match?.status;

  const setReadyMut = useMutation(api.liveMatches.setReady);
  const heartbeatMut = useMutation(api.liveMatches.heartbeat);
  const abandonWaitingMut = useMutation(api.liveMatches.abandonWaitingMatch);
  const forfeitMut = useMutation(api.liveMatches.forfeit);

  // Heartbeat every 5s
  useEffect(() => {
    if (!matchId) return;
    if (matchStatus === "completed" || matchStatus === "forfeited") return;
    const id = setInterval(() => {
      heartbeatMut({ matchId });
    }, 5000);
    return () => clearInterval(id);
  }, [matchId, matchStatus, heartbeatMut]);

  // Auto-navigate when match transitions
  useEffect(() => {
    if (!matchStatus) return;
    if (
      matchStatus === "countdown" ||
      matchStatus === "question" ||
      matchStatus === "roundResult"
    ) {
      navigate(`/live-match?matchId=${matchId}`, { replace: true });
    }
    if (matchStatus === "completed" || matchStatus === "forfeited") {
      navigate("/home", { replace: true });
    }
  }, [matchStatus, matchId, navigate]);

  const handleReady = useCallback(async () => {
    if (!matchId) return;
    await setReadyMut({ matchId });
  }, [matchId, setReadyMut]);

  const handleLeave = useCallback(async () => {
    if (!matchId) return;
    if (matchStatus === "completed" || matchStatus === "forfeited") return;
    if (matchStatus === "waiting") {
      await abandonWaitingMut({ matchId });
      return;
    }
    await forfeitMut({ matchId });
  }, [abandonWaitingMut, forfeitMut, matchId, matchStatus]);

  if (!matchId) {
    navigate("/home", { replace: true });
    return null;
  }

  if (match === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Loading match...
        </p>
      </div>
    );
  }

  if (match === null) {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex items-center justify-center">
        <NeoCard shadow="lg" className="w-full text-center py-6">
          <p className="font-heading font-bold text-lg">Match unavailable</p>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            This legacy Live Match is no longer active.
          </p>
          <NeoButton variant="primary" size="full" onClick={() => navigate("/home")}>
            Back to Home
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  const myReady = match.isPlayer1 ? match.player1Ready : match.player2Ready;
  const opponentReady = match.isPlayer1 ? match.player2Ready : match.player1Ready;
  const opponent = match.isPlayer1 ? match.player2 : match.player1;
  const me = match.isPlayer1 ? match.player1 : match.player2;

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center justify-center">
      <div className="w-full mb-6">
        <ExitGameButton
          title="Leave waiting room?"
          description="Leaving will abandon this legacy Live Match and return you home."
          onConfirm={handleLeave}
        />
      </div>
      <h1 className="font-heading font-bold text-2xl mb-8">Waiting Room</h1>

      <div className="flex items-center gap-8 mb-8">
        {/* Me */}
        <div className="text-center">
          <NeoAvatar name={me.username} size="lg" />
          <p className="font-heading font-bold text-sm mt-2">{me.username}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {myReady ? "Ready!" : "Not ready"}
          </p>
        </div>

        <p className="font-heading font-bold text-2xl text-muted-foreground">
          VS
        </p>

        {/* Opponent */}
        <div className="text-center">
          <NeoAvatar name={opponent.username} size="lg" />
          <p className="font-heading font-bold text-sm mt-2">
            {opponent.username}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {opponentReady ? "Ready!" : "Waiting..."}
          </p>
        </div>
      </div>

      <NeoCard className="w-full text-center py-4 mb-6">
        <p className="font-heading font-bold text-sm capitalize">
          {match.sport} · {match.totalQuestions} Questions
        </p>
      </NeoCard>

      {!myReady ? (
        <NeoButton variant="primary" size="full" onClick={handleReady}>
          I'm Ready!
        </NeoButton>
      ) : (
        <p className="font-heading font-bold text-sm animate-pulse">
          Waiting for opponent...
        </p>
      )}
    </div>
  );
}
