import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { ArrowLeft, Swords, Flame } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { BottomNav } from "@/components/neo/BottomNav";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { formatRelativeTime } from "@/lib/duel";

export default function RivalsListScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const data = useQuery(api.rivalries.listMine, isGuest || !user ? "skip" : {});
  // In the shell, cross-screen links resolve to contained shell routes.
  const duelsPath = embedded ? SHELL_ROUTES.duels : "/challenge";
  const rivalDetailPath = (id: string) =>
    embedded ? SHELL_ROUTES.rivalDetail(id) : `/rivals/${id}`;

  if (isGuest) {
    return (
      <div className={embedded ? "px-5 pt-6" : "min-h-screen bg-background pb-20 px-5 pt-6"}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <NeoCard shadow="lg" className="text-center py-8">
          <p className="font-heading font-bold text-lg">Rivals need an account</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sign up to track head-to-head records.
          </p>
        </NeoCard>
        {!embedded && <BottomNav />}
      </div>
    );
  }

  const rivalries = data?.rivalries ?? [];
  const loading = data === undefined;

  return (
    <div className={embedded ? "" : "min-h-screen bg-background pb-24"}>
      <div className="px-5 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-heading font-bold">Rivals</h1>
          <div className="w-9" />
        </div>

        {loading ? (
          <NeoCard className="text-center py-6 text-sm text-muted-foreground">
            Loading…
          </NeoCard>
        ) : rivalries.length === 0 ? (
          <NeoCard className="text-center py-6">
            <Swords size={28} strokeWidth={2.5} className="mx-auto mb-2" />
            <p className="font-heading font-bold">No rivals yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send a duel to start a head-to-head record.
            </p>
            <NeoButton
              variant="primary"
              size="md"
              className="mt-4"
              onClick={() => navigate(duelsPath)}
            >
              Send a duel
            </NeoButton>
          </NeoCard>
        ) : (
          <div className="space-y-2.5">
            {rivalries.map((r) => {
              const lead =
                r.wins > r.losses
                  ? `You lead ${r.wins}-${r.losses}`
                  : r.wins < r.losses
                    ? `You trail ${r.wins}-${r.losses}`
                    : `Tied ${r.wins}-${r.losses}`;
              const streakLine =
                r.currentStreakLen > 0
                  ? r.currentStreakHolderId === user?._id
                    ? `🔥 ${r.currentStreakLen} streak (you)`
                    : `🔥 ${r.currentStreakLen} streak vs you`
                  : null;
              return (
                <NeoCard
                  key={r.opponent.userId}
                  onClick={() => navigate(rivalDetailPath(r.opponent.userId))}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-sm">
                      @{r.opponent.username}
                    </p>
                    <NeoBadge
                      color={
                        r.wins > r.losses
                          ? "success"
                          : r.wins < r.losses
                            ? "destructive"
                            : "blue"
                      }
                      size="sm"
                    >
                      {r.wins}-{r.losses}
                      {r.draws ? `-${r.draws}` : ""}
                    </NeoBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">{lead}</p>
                  {streakLine && (
                    <p className="text-xs font-mono">{streakLine}</p>
                  )}
                  {r.updatedAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Last duel {formatRelativeTime(r.updatedAt)}
                    </p>
                  )}
                </NeoCard>
              );
            })}
          </div>
        )}
      </div>
      {!embedded && <BottomNav />}
    </div>
  );
}

export function RivalDetailScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { opponentUserId } = useParams<{ opponentUserId: string }>();
  const duelsPath = embedded ? SHELL_ROUTES.duels : "/challenge";
  const rivalry = useQuery(
    api.rivalries.get,
    !isGuest && user && opponentUserId
      ? { opponentUserId: opponentUserId as Id<"users"> }
      : "skip",
  );
  const rematchMut = useMutation(api.duels.rematch);
  const [rematching, setRematching] = useState(false);

  if (isGuest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold">Sign in to view rivals.</p>
      </div>
    );
  }

  if (!opponentUserId) {
    return null;
  }

  if (rivalry === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!rivalry) {
    return (
      <div className="min-h-screen bg-background px-5 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <NeoCard className="text-center py-8">
          <p className="font-heading font-bold">No record</p>
          <p className="text-sm text-muted-foreground mt-1">
            You haven&apos;t finished a duel with this player yet.
          </p>
        </NeoCard>
      </div>
    );
  }

  const isLeading = rivalry.wins > rivalry.losses;
  const isTied = rivalry.wins === rivalry.losses;
  const streakHolderIsMe = rivalry.currentStreakHolderId === user?._id;
  const streakLine =
    rivalry.currentStreakLen > 0
      ? streakHolderIsMe
        ? `🔥 ${rivalry.currentStreakLen} streak`
        : `${rivalry.currentStreakLen} vs you`
      : "No active streak";

  const handleRematch = async () => {
    if (!rivalry.lastDuelId) {
      toast.error("No previous duel to rematch");
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: rivalry.lastDuelId });
      toast.success("Rematch sent");
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rematch failed");
    } finally {
      setRematching(false);
    }
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-background pb-24"}>
      <div className="px-5 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-xl font-heading font-bold truncate">
            @{rivalry.opponent?.username ?? "Rival"}
          </h1>
          <div className="w-9" />
        </div>

        <NeoCard shadow="lg" className="text-center py-7">
          <p className="font-mono font-bold text-5xl">
            {rivalry.wins}
            <span className="text-muted-foreground mx-2">—</span>
            {rivalry.losses}
            {rivalry.draws ? (
              <span className="text-muted-foreground text-3xl ml-2">
                ({rivalry.draws})
              </span>
            ) : null}
          </p>
          <p className="text-xs font-heading uppercase text-muted-foreground mt-2">
            You · Them {rivalry.draws ? "· Draws" : ""}
          </p>
          <NeoBadge
            color={isLeading ? "success" : isTied ? "blue" : "destructive"}
            rotated
            size="md"
            className="mt-4 text-base px-5 py-1.5"
          >
            {isLeading ? "Leading" : isTied ? "Tied" : "Trailing"}
          </NeoBadge>
        </NeoCard>

        <NeoCard className="flex items-center justify-between py-3">
          <div className="inline-flex items-center gap-2">
            <Flame
              size={20}
              strokeWidth={2.5}
              className={streakHolderIsMe ? "text-primary" : "text-destructive"}
            />
            <p className="font-heading font-bold text-sm">{streakLine}</p>
          </div>
          {rivalry.updatedAt && (
            <p className="text-xs font-mono text-muted-foreground">
              Last {formatRelativeTime(rivalry.updatedAt)}
            </p>
          )}
        </NeoCard>

        <NeoButton
          variant="primary"
          size="full"
          disabled={rematching || !rivalry.lastDuelId}
          onClick={handleRematch}
        >
          <Swords size={16} strokeWidth={3} />
          {rematching ? "Sending…" : "Rematch"}
        </NeoButton>

        <NeoButton variant="secondary" size="full" onClick={() => navigate(duelsPath)}>
          New custom duel
        </NeoButton>
      </div>
    </div>
  );
}
