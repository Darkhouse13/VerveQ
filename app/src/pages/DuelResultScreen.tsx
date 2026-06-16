import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Swords, Share2, Copy } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { buildShareUrl, formatModeLabel, formatCategoryLabel } from "@/lib/duel";

type DuelView = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  type: "sports" | "knowledge";
  category: string | null;
  sport: string | null;
  difficulty: string;
  mode: string;
  challenger: { id: Id<"users">; username: string; displayName: string };
  opponent: { id: Id<"users"> | null; username: string; displayName: string };
  myResult: { score: number; completedAt: number | null; perQuestion: Array<{ correct: boolean; score: number }> };
  opponentResult: { score: number; completedAt: number | null; answeredCount: number };
  winnerId: Id<"users"> | null;
  linkCode: string | null;
};

type DuelStatus = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  resolvedAt: number | null;
  questionCount: number;
  myScore: number;
  myAnsweredCount: number;
  myCompleted: boolean;
  opponentScore: number;
  opponentAnsweredCount: number;
  opponentCompleted: boolean;
  winnerId: Id<"users"> | null;
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  bucket: "your_turn" | "awaiting_opponent" | "resolved";
};

function topicLabel(view: DuelView): string {
  if (view.mode === "came_first") return "Which Came First";
  if (view.type === "knowledge") {
    return view.category ? formatCategoryLabel(view.category) : "Knowledge";
  }
  const sport = view.sport ?? "Trivia";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

export default function DuelResultScreen() {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const getMyDuel = useMutation(api.duels.getMyDuel);
  const rematchMut = useMutation(api.duels.rematch);
  const declineMut = useMutation(api.duels.decline);
  const markSharedMut = useMutation(api.duels.markShared);
  const [view, setView] = useState<DuelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematching, setRematching] = useState(false);
  const [declining, setDeclining] = useState(false);
  const liveStatus = useQuery(
    api.duels.getDuelStatus,
    view ? { duelId: view.duelId } : "skip",
  ) as DuelStatus | undefined;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/?from=duel", { replace: true });
      return;
    }
    if (!duelId) return;
    (async () => {
      try {
        const v = (await getMyDuel({ duelId: duelId as Id<"duels"> })) as DuelView;
        setView(v);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load duel");
      }
    })();
  }, [duelId, getMyDuel, isAuthenticated, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center justify-center">
        <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
          <p className="font-heading font-bold text-lg mb-2">Could not load result</p>
          <p className="text-xs text-muted-foreground mb-4 break-words">{error}</p>
          <NeoButton variant="primary" size="full" onClick={() => navigate("/challenge")}>
            Back to duels
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  const myId = user?._id;
  const status = liveStatus?.status ?? view.status;
  const winnerId = liveStatus?.winnerId ?? view.winnerId;
  const myScore = liveStatus?.myScore ?? view.myResult.score;
  const opponentScore = liveStatus?.opponentScore ?? view.opponentResult.score;
  const myWon = !!winnerId && myId === winnerId;
  const myLost = !!winnerId && myId !== winnerId;
  const isDraw = status === "resolved" && !winnerId;
  const stillOpen = status === "awaiting_opponent";
  const justResolved = view.status === "awaiting_opponent" && status !== "awaiting_opponent";
  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const totalQ = view.myResult.perQuestion.length;
  const correctQ = view.myResult.perQuestion.filter((q) => q.correct).length;

  const headlineColor: "success" | "destructive" | "blue" | "muted" = myWon
    ? "success"
    : myLost
      ? "destructive"
      : isDraw
        ? "blue"
        : "muted";
  const headlineText = stillOpen
    ? view.opponent.id === null
      ? "Invite an opponent"
      : "Waiting for opponent"
    : myWon
      ? "You won"
      : myLost
        ? "You lost"
        : isDraw
          ? "Draw"
          : status === "expired"
            ? "Expired"
            : "Declined";

  const shareCardText =
    myWon || stillOpen
      ? `I scored ${myScore}/${totalQ * 100} on a VerveQ duel — beat me`
      : `Final ${myScore} vs ${opponentScore} — rematch?`;

  const shareUrl = view.linkCode ? buildShareUrl(view.linkCode) : null;
  // The challenger sharing a link duel is the real "challenge issued" moment —
  // record it (once, server-side) whenever they share or copy.
  const canInvite = view.role === "challenger" && !!shareUrl;
  const awaitingInvite = stillOpen && canInvite && view.opponent.id === null;
  const markShared = () => {
    if (canInvite) markSharedMut({ duelId: view.duelId }).catch(() => {});
  };

  const handleShare = async () => {
    markShared();
    const payload = { title: "VerveQ duel", text: shareCardText, url: shareUrl ?? window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(`${shareCardText} ${payload.url}`);
        toast.success("Result copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleCopy = async () => {
    markShared();
    try {
      await navigator.clipboard.writeText(`${shareCardText} ${shareUrl ?? ""}`);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const openRematch = liveStatus?.openRematch ?? null;

  const handleRematch = async () => {
    // An open rematch already exists (sent by either side) — just enter it.
    if (openRematch) {
      navigate(`/duel/play/${openRematch.duelId}`);
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: view.duelId });
      if (result.existing) {
        toast.success("Rematch already open — joining it");
      } else if (result.linkCode) {
        // It's now a link rematch (e.g. former guest); send to play screen.
        toast.success("Rematch ready — share the link");
      } else {
        toast.success("Rematch sent");
      }
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rematch failed");
    } finally {
      setRematching(false);
    }
  };

  const handleDeclineRematch = async () => {
    if (!openRematch || openRematch.byMe) return;
    setDeclining(true);
    try {
      await declineMut({ duelId: openRematch.duelId });
      toast.success("Rematch declined");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decline");
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6 pb-24">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => navigate("/challenge")}
          className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <p className="font-heading font-bold text-sm uppercase">Duel result</p>
        <div className="w-9" />
      </div>

      {/* Live rematch state — appears in place the moment the other player
          (or this one, from another surface) sends a rematch. */}
      {openRematch && !openRematch.byMe && (
        <NeoCard color="accent" shadow="lg" className="mb-5 space-y-2">
          <p className="font-heading font-bold text-sm inline-flex items-center gap-1.5">
            <Swords size={14} strokeWidth={3} /> @{opponentName} wants a rematch!
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton
              variant="primary"
              size="md"
              onClick={() => navigate(`/duel/play/${openRematch.duelId}`)}
            >
              Accept
            </NeoButton>
            <NeoButton
              variant="ghost"
              size="md"
              disabled={declining}
              onClick={handleDeclineRematch}
            >
              {declining ? "Declining…" : "Decline"}
            </NeoButton>
          </div>
        </NeoCard>
      )}
      {openRematch?.byMe && (
        <NeoCard className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading font-bold text-sm">Rematch sent</p>
            <p className="text-xs text-muted-foreground truncate">
              Waiting for @{opponentName} to play.
            </p>
          </div>
          <NeoButton
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/duel/play/${openRematch.duelId}`)}
          >
            Open
          </NeoButton>
        </NeoCard>
      )}

      {/* Share card */}
      <NeoCard shadow="lg" color={myWon ? "primary" : "default"} className="mb-5 text-center py-6">
        <p className="text-xs font-heading uppercase opacity-80">
          {topicLabel(view)} · {formatModeLabel(view.mode)} · {view.difficulty}
        </p>
        <NeoBadge color={headlineColor} rotated size="md" className="mt-3 text-xl px-6 py-2">
          {headlineText}
        </NeoBadge>
        {justResolved && (
          <p className="text-xs font-heading uppercase opacity-80 mt-3">
            @{opponentName} just finished
          </p>
        )}
        <p className="font-mono font-bold text-5xl mt-4">
          {myScore}
          <span className="text-muted-foreground mx-3">vs</span>
          {opponentScore}
        </p>
        <p className="text-xs mt-2 opacity-80">
          You {myScore} — @{opponentName} {opponentScore}
        </p>
        <p className="text-[10px] mt-3 font-mono opacity-70">
          {correctQ}/{totalQ} correct
        </p>
      </NeoCard>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <NeoCard color="success" className="text-center py-3">
          <p className="font-mono font-bold text-lg">{correctQ}</p>
          <p className="text-[10px] font-heading uppercase opacity-80">Correct</p>
        </NeoCard>
        <NeoCard color="blue" className="text-center py-3">
          <p className="font-mono font-bold text-lg">
            {totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0}%
          </p>
          <p className="text-[10px] font-heading uppercase opacity-80">Accuracy</p>
        </NeoCard>
      </div>

      <div className="space-y-2.5">
        {!stillOpen && (
          <NeoButton variant="primary" size="full" disabled={rematching} onClick={handleRematch}>
            <Swords size={16} strokeWidth={3} />
            {rematching
              ? "Sending…"
              : openRematch
                ? openRematch.byMe
                  ? "Open your rematch"
                  : "Accept the rematch"
                : myLost
                  ? "Get revenge"
                  : myWon
                    ? "Defend your win"
                    : "Run it back"}
          </NeoButton>
        )}
        <NeoButton
          variant={awaitingInvite ? "primary" : "secondary"}
          size="full"
          onClick={handleShare}
        >
          <Share2 size={16} strokeWidth={3} />{" "}
          {awaitingInvite ? "Invite a friend to beat your score" : "Share result"}
        </NeoButton>
        {shareUrl && (
          <NeoButton variant="ghost" size="full" onClick={handleCopy}>
            <Copy size={14} strokeWidth={3} /> Copy link
          </NeoButton>
        )}
        <button
          type="button"
          onClick={() => navigate("/challenge")}
          className="w-full text-center text-sm text-muted-foreground font-heading underline underline-offset-4 cursor-pointer"
        >
          Back to duels
        </button>
      </div>
    </div>
  );
}
