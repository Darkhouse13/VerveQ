import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Check, Crown, Medal, Trophy, X } from "lucide-react";

export default function MultiplayerArenaScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get("matchId") as Id<"multiplayerMatches"> | null;
  const match = useQuery(api.multiplayerMatches.getMatch, matchId ? { matchId } : "skip");
  const submitAnswer = useMutation(api.multiplayerMatches.submitAnswer);
  const setReady = useMutation(api.multiplayerMatches.setReady);
  const [pending, setPending] = useState(false);
  const [timer, setTimer] = useState(10);

  useEffect(() => {
    if (!matchId) navigate("/challenge/arena", { replace: true });
  }, [matchId, navigate]);

  useEffect(() => {
    if (!match?.questionStartedAt || match.status !== "question") return;
    const tick = () => setTimer(Math.max(0, Math.ceil(10 - (Date.now() - match.questionStartedAt!) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [match?.questionStartedAt, match?.status]);

  if (!matchId || !match) return <div className="min-h-screen bg-background flex items-center justify-center font-heading font-bold">Loading arena…</div>;

  const meAnswered = !!match.myAnswer;
  const currentPlayerCount = match.players.length;

  async function answer(option: string) {
    if (!matchId || pending || meAnswered) return;
    setPending(true);
    try { await submitAnswer({ matchId, answer: option }); } finally { setPending(false); }
  }

  if (match.status === "roundBreak") {
    const myReady = match.roundBreakReadyUserIds.some((id) => match.players.some((p) => p.id === id));
    return (
      <div className="min-h-screen bg-background px-5 py-6 space-y-5">
        <NeoBadge color="blue" size="sm">Round ranking</NeoBadge>
        <h1 className="font-heading font-bold text-2xl">Round {match.currentRoundIndex + 1} complete</h1>
        <Rankings rankings={match.rankings} />
        <NeoCard>
          <p className="font-heading font-bold text-sm">Next round</p>
          <p className="text-xs text-muted-foreground mt-1">Everyone checks ready, then the next 10-question category starts.</p>
        </NeoCard>
        <NeoButton variant="primary" size="full" onClick={() => setReady({ matchId })} disabled={myReady}>{myReady ? "Waiting for players…" : "Ready for next round"}</NeoButton>
      </div>
    );
  }

  if (match.status === "completed") {
    return (
      <div className="min-h-screen bg-background px-5 py-6 space-y-5">
        <NeoBadge color="success" size="sm"><Trophy size={12} /> Final ranking</NeoBadge>
        <h1 className="font-heading font-bold text-2xl">Arena complete</h1>
        <NeoCard shadow="lg" className="text-center space-y-4">
          <p className="font-heading font-bold text-lg">Top 3</p>
          <div className="grid grid-cols-3 gap-2 items-end">
            {match.podium.map((p, idx) => (
              <div key={p.userId} className={`${idx === 0 ? "order-2 scale-110" : idx === 1 ? "order-1" : "order-3"}`}>
                <div className={`neo-border rounded-lg p-3 ${idx === 0 ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                  {idx === 0 ? <Crown className="mx-auto" /> : <Medal className="mx-auto" />}
                  <p className="font-heading font-bold text-xs truncate mt-1">@{p.username}</p>
                  <p className="font-mono font-bold">{p.score}</p>
                </div>
              </div>
            ))}
          </div>
        </NeoCard>
        {match.bottomRankings.length > 0 && (
          <NeoCard>
            <p className="font-heading font-bold text-sm mb-2">Bottom table</p>
            <Rankings rankings={match.bottomRankings} compact />
          </NeoCard>
        )}
        <NeoButton variant="primary" size="full" onClick={() => navigate("/challenge/arena")}>Play another arena</NeoButton>
      </div>
    );
  }

  const q = match.question;
  if (!q) return <div className="min-h-screen bg-background flex items-center justify-center font-heading font-bold">Preparing question…</div>;

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <NeoBadge color="primary" size="sm">{q.roundLabel}</NeoBadge>
          <h1 className="font-heading font-bold text-lg mt-2">Q {match.currentQuestion + 1}/{match.totalQuestions}</h1>
        </div>
        <div className={`neo-border rounded-lg px-4 py-2 font-mono font-bold text-2xl ${timer <= 3 ? "bg-destructive text-destructive-foreground" : "bg-card"}`}>{timer}</div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {match.rankings.map((r) => <div key={r.userId} className="neo-border rounded-lg bg-card px-3 py-2 shrink-0"><p className="font-heading font-bold text-xs">#{r.rank} @{r.username}</p><p className="font-mono font-bold text-sm">{r.score}</p></div>)}
      </div>
      <NeoCard shadow="lg"><p className="font-heading font-bold text-xl leading-tight">{q.question}</p></NeoCard>
      <div className="space-y-2.5 flex-1">
        {q.options.map((opt, idx) => {
          const chosen = match.myAnswer?.answer === opt;
          const right = chosen && match.myAnswer?.correct;
          const wrong = chosen && match.myAnswer && !match.myAnswer.correct;
          return <button key={opt} type="button" disabled={meAnswered || pending} onClick={() => answer(opt)} className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left font-heading font-bold ${right ? "bg-success text-success-foreground" : wrong ? "bg-destructive text-destructive-foreground" : "bg-card"}`}>
            <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center bg-background text-foreground">{right ? <Check size={16} /> : wrong ? <X size={16} /> : String.fromCharCode(65 + idx)}</span>
            <span>{opt}</span>
          </button>;
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground font-heading font-bold uppercase">{match.answeredUserIds.length}/{currentPlayerCount} locked in</p>
    </div>
  );
}

function Rankings({ rankings, compact = false }: { rankings: Array<{ userId: string; rank: number; username: string; score: number; team?: number | null }>; compact?: boolean }) {
  return <div className="space-y-2">{rankings.map((r) => <div key={r.userId} className={`neo-border rounded-lg bg-card flex items-center justify-between ${compact ? "p-2" : "p-3"}`}><p className="font-heading font-bold text-sm">#{r.rank} @{r.username}{r.team ? ` · Team ${r.team}` : ""}</p><p className="font-mono font-bold">{r.score}</p></div>)}</div>;
}
