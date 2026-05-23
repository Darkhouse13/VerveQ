import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { ArrowLeft, Copy, Swords, Users } from "lucide-react";
import { toast } from "sonner";

const formats = [
  { value: "1v1", label: "1v1", note: "Classic live duel" },
  { value: "2v2", label: "2v2", note: "Two teams of two" },
  { value: "1v1v1", label: "3 players", note: "Everyone for himself" },
  { value: "1v1v1v1", label: "4 players", note: "Free-for-all" },
  { value: "1v1v1v1v1", label: "5 players", note: "Full arena" },
];

export default function MultiplayerLobbyScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const matchId = params.get("matchId") as Id<"multiplayerMatches"> | null;
  const [format, setFormat] = useState("1v1v1");
  const [joinCode, setJoinCode] = useState("");

  const createLobby = useMutation(api.multiplayerMatches.createLobby);
  const joinByCode = useMutation(api.multiplayerMatches.joinByCode);
  const setReady = useMutation(api.multiplayerMatches.setReady);
  const match = useQuery(api.multiplayerMatches.getMatch, matchId ? { matchId } : "skip");
  const activeMatchId = useQuery(api.multiplayerMatches.getActiveMatch, {});

  useEffect(() => {
    if (!matchId && activeMatchId) setParams({ matchId: activeMatchId });
  }, [activeMatchId, matchId, setParams]);

  useEffect(() => {
    if (match?.status === "question" || match?.status === "roundBreak" || match?.status === "completed") {
      navigate(`/challenge/arena/play?matchId=${match.matchId}`, { replace: true });
    }
  }, [match?.status, match?.matchId, navigate]);

  async function handleCreate() {
    const res = await createLobby({ format });
    setParams({ matchId: res.matchId });
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    const res = await joinByCode({ joinCode: joinCode.trim() });
    setParams({ matchId: res.matchId });
  }

  if (matchId && !match) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-heading font-bold">Loading arena…</div>;
  }

  if (match) {
    const myPlayer = match.players.find((p) => match.readyUserIds.includes(p.id));
    return (
      <div className="min-h-screen bg-background px-5 py-6 space-y-5">
        <button type="button" onClick={() => navigate("/challenge")} className="font-heading font-bold text-xs uppercase flex items-center gap-1">
          <ArrowLeft size={15} strokeWidth={3} /> Duels
        </button>
        <div>
          <NeoBadge color="primary" size="sm">Arena Beta</NeoBadge>
          <h1 className="text-2xl font-heading font-bold mt-2">Join code {match.joinCode}</h1>
          <p className="text-xs text-muted-foreground">{match.format} · {match.players.length}/{match.maxPlayers} players · 5 rounds × 10 questions</p>
        </div>
        <NeoCard className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold text-sm">Join code</p>
            <button type="button" onClick={() => { navigator.clipboard.writeText(match.joinCode).catch(() => {}); toast.success("Join code copied"); }} className="font-heading font-bold text-xs uppercase text-primary flex gap-1 items-center">
              <Copy size={13} strokeWidth={3} /> Copy
            </button>
          </div>
          <p className="font-mono text-4xl font-bold tracking-widest text-center">{match.joinCode}</p>
        </NeoCard>
        <div className="grid grid-cols-2 gap-3">
          {match.players.map((p) => (
            <NeoCard key={p.id} className="text-center py-4">
              <NeoAvatar name={p.username} size="md" />
              <p className="font-heading font-bold text-sm mt-2 truncate">@{p.username}</p>
              <p className="text-[11px] text-muted-foreground">{p.team ? `Team ${p.team}` : "Solo"} · {p.ready ? "Ready" : "Not ready"}</p>
            </NeoCard>
          ))}
        </div>
        <NeoButton variant="primary" size="full" onClick={() => setReady({ matchId })} disabled={!!myPlayer}>
          {myPlayer ? "Waiting for everyone…" : "I'm Ready"}
        </NeoButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6 space-y-5">
      <button type="button" onClick={() => navigate("/challenge")} className="font-heading font-bold text-xs uppercase flex items-center gap-1">
        <ArrowLeft size={15} strokeWidth={3} /> Back
      </button>
      <div>
        <NeoBadge color="primary" size="sm">Arena Beta</NeoBadge>
        <h1 className="text-2xl font-heading font-bold mt-2">Multiplayer Challenge</h1>
        <p className="text-xs text-muted-foreground">1v1, 2v2, or 3-5 player free-for-all battle royale.</p>
      </div>
      <NeoCard className="space-y-3">
        <p className="font-heading font-bold text-sm flex items-center gap-2"><Swords size={16} /> Create arena</p>
        <div className="grid grid-cols-1 gap-2">
          {formats.map((f) => (
            <button key={f.value} type="button" onClick={() => setFormat(f.value)} className={`neo-border rounded-lg p-3 text-left ${format === f.value ? "bg-primary text-primary-foreground" : "bg-card"}`}>
              <p className="font-heading font-bold text-sm">{f.label}</p>
              <p className="text-[11px] opacity-80">{f.note}</p>
            </button>
          ))}
        </div>
        <NeoButton variant="primary" size="full" onClick={handleCreate}>Create arena</NeoButton>
      </NeoCard>
      <NeoCard className="space-y-3">
        <p className="font-heading font-bold text-sm flex items-center gap-2"><Users size={16} /> Join arena</p>
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Join code" className="w-full neo-border rounded-lg bg-background p-3 font-mono font-bold uppercase tracking-widest" />
        <NeoButton variant="secondary" size="full" onClick={handleJoin}>Join code</NeoButton>
      </NeoCard>
    </div>
  );
}
