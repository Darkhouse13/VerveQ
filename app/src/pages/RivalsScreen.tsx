import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "convex/react";
import { ArrowLeft, Swords, Flame } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

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
  const { t } = useTranslation("screens");
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
          <p className="font-heading font-bold text-lg">{t("rivals.needAccountTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("rivals.needAccountDescription")}
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
          <h1 className="text-2xl font-heading font-bold">{t("rivals.title")}</h1>
          <div className="w-9" />
        </div>

        {loading ? (
          <NeoCard className="text-center py-6 text-sm text-muted-foreground">
            {t("rivals.loading")}
          </NeoCard>
        ) : rivalries.length === 0 ? (
          <NeoCard className="text-center py-6">
            <Swords size={28} strokeWidth={2.5} className="mx-auto mb-2" />
            <p className="font-heading font-bold">{t("rivals.emptyTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("rivals.emptyDescription")}
            </p>
            <NeoButton
              variant="primary"
              size="md"
              className="mt-4"
              onClick={() => navigate(duelsPath)}
            >
              {t("rivals.sendDuel")}
            </NeoButton>
          </NeoCard>
        ) : (
          <div className="space-y-2.5">
            {rivalries.map((r) => {
              const lead =
                r.wins > r.losses
                  ? t("rivals.youLead", { wins: r.wins, losses: r.losses })
                  : r.wins < r.losses
                    ? t("rivals.youTrail", { wins: r.wins, losses: r.losses })
                    : t("rivals.tied", { wins: r.wins, losses: r.losses });
              const streakLine =
                r.currentStreakLen > 0
                  ? r.currentStreakHolderId === user?._id
                    ? t("rivals.streakYou", { count: r.currentStreakLen })
                    : t("rivals.streakVsYou", { count: r.currentStreakLen })
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
                      {t("rivals.lastDuel", { time: formatRelativeTime(r.updatedAt) })}
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
  const { t } = useTranslation("screens");
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
        <p className="font-heading font-bold">{t("rivals.signInToView")}</p>
      </div>
    );
  }

  if (!opponentUserId) {
    return null;
  }

  if (rivalry === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">{t("rivals.loading")}</p>
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
          <p className="font-heading font-bold">{t("rivals.noRecordTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("rivals.noRecordDescription")}
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
        ? t("rivals.detailStreakMine", { count: rivalry.currentStreakLen })
        : t("rivals.detailStreakVsYou", { count: rivalry.currentStreakLen })
      : t("rivals.noActiveStreak");

  const handleRematch = async () => {
    if (!rivalry.lastDuelId) {
      toast.error(t("rivals.noPreviousDuel"));
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: rivalry.lastDuelId });
      toast.success(t("rivals.rematchSent"));
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      toast.error(friendlyError(e, t("rivals.rematchFailed")));
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
            @{rivalry.opponent?.username ?? t("rivals.rivalFallback")}
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
            {rivalry.draws ? t("rivals.scoreLabelWithDraws") : t("rivals.scoreLabel")}
          </p>
          <NeoBadge
            color={isLeading ? "success" : isTied ? "blue" : "destructive"}
            rotated
            size="md"
            className="mt-4 text-base px-5 py-1.5"
          >
            {isLeading ? t("rivals.leading") : isTied ? t("rivals.tiedBadge") : t("rivals.trailing")}
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
              {t("rivals.lastDuelShort", { time: formatRelativeTime(rivalry.updatedAt) })}
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
          {rematching ? t("rivals.sending") : t("rivals.rematch")}
        </NeoButton>

        <NeoButton variant="secondary" size="full" onClick={() => navigate(duelsPath)}>
          {t("rivals.newCustomDuel")}
        </NeoButton>
      </div>
    </div>
  );
}
