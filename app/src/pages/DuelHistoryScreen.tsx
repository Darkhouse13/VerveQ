import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Trophy } from "lucide-react";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { BottomNav } from "@/components/neo/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import {
  formatModeLabel,
  formatRelativeTime,
  duelSummaryHeadline,
  duelStatusBadge,
  duelOpponentLabel,
  type DuelOutcomeForMe,
} from "@/lib/duel";

type Filter = "all" | "wins" | "losses" | "draws";

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: "all", labelKey: "duelHistory.filterAll" },
  { key: "wins", labelKey: "duelHistory.filterWins" },
  { key: "losses", labelKey: "duelHistory.filterLosses" },
  { key: "draws", labelKey: "duelHistory.filterDraws" },
];

export default function DuelHistoryScreen({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation("screens");
  const { user, isGuest } = useAuth();
  const duelsPath = embedded ? SHELL_ROUTES.duels : "/challenge";
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery(api.duels.listMine, !isGuest && user ? {} : "skip");
  const loading = list === undefined;
  const resolved = useMemo(() => list?.resolved ?? [], [list]);

  const outcomeFor = (d: (typeof resolved)[number]): DuelOutcomeForMe =>
    d.status === "resolved"
      ? d.winnerId
        ? d.winnerId === user?._id
        : "draw"
      : null;

  const tally = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const d of resolved) {
      const outcome = outcomeFor(d);
      if (outcome === true) wins += 1;
      else if (outcome === false) losses += 1;
      else if (outcome === "draw") draws += 1;
    }
    return { wins, losses, draws };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, user?._id]);

  const shown = useMemo(() => {
    if (filter === "all") return resolved;
    return resolved.filter((d) => {
      const outcome = outcomeFor(d);
      if (filter === "wins") return outcome === true;
      if (filter === "losses") return outcome === false;
      return outcome === "draw";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, filter, user?._id]);

  return (
    <div className={embedded ? "" : "min-h-screen bg-background pb-24"}>
      <div className="px-5 pt-6 space-y-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(duelsPath)}
            className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-heading font-bold uppercase">{t("duelHistory.title")}</h1>
          <div className="w-9" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <NeoCard color="success" className="text-center py-2.5">
            <p className="font-mono font-bold text-lg leading-none">{tally.wins}</p>
            <p className="text-[10px] font-heading uppercase opacity-80 mt-1">{t("duelHistory.statWins")}</p>
          </NeoCard>
          <NeoCard color="destructive" className="text-center py-2.5">
            <p className="font-mono font-bold text-lg leading-none">{tally.losses}</p>
            <p className="text-[10px] font-heading uppercase opacity-80 mt-1">{t("duelHistory.statLosses")}</p>
          </NeoCard>
          <NeoCard color="blue" className="text-center py-2.5">
            <p className="font-mono font-bold text-lg leading-none">{tally.draws}</p>
            <p className="text-[10px] font-heading uppercase opacity-80 mt-1">{t("duelHistory.statDraws")}</p>
          </NeoCard>
        </div>

        <div className="flex gap-2">
          {FILTERS.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`neo-border rounded-full px-3 py-1 text-[11px] font-heading font-bold uppercase cursor-pointer transition-all ${
                filter === key
                  ? "bg-primary text-primary-foreground neo-shadow"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <NeoCard className="text-center py-8">
            <Trophy size={24} strokeWidth={2.5} className="mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {loading
                ? t("duelHistory.loading")
                : filter === "all"
                  ? t("duelHistory.emptyAll")
                  : t("duelHistory.emptyFilter")}
            </p>
          </NeoCard>
        ) : (
          <div className="space-y-2">
            {shown.map((d) => {
              const badge = duelStatusBadge(d.status, outcomeFor(d), t);
              return (
                <NeoCard
                  key={d.duelId}
                  onClick={() => navigate(`/duel/result/${d.duelId}`)}
                  className="space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm truncate">
                        {duelOpponentLabel(d.opponent.username, t)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize truncate">
                        {duelSummaryHeadline(d, t)} · {formatModeLabel(d.mode, t)} ·{" "}
                        {d.difficulty}
                      </p>
                    </div>
                    <NeoBadge color={badge.color} size="sm">
                      {badge.label}
                    </NeoBadge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span>
                      {t("duelHistory.scoreYou")}{" "}
                      <span className="font-bold">{d.myScore}</span> —{" "}
                      <span className="font-bold">{d.opponentScore}</span>{" "}
                      {t("duelHistory.scoreThem")}
                    </span>
                    <span className="text-muted-foreground">
                      {d.resolvedAt ? formatRelativeTime(d.resolvedAt, t) : ""}
                    </span>
                  </div>
                </NeoCard>
              );
            })}
            <p className="text-center text-[10px] text-muted-foreground pt-1">
              {t("duelHistory.showingCount", { count: resolved.length })}
            </p>
          </div>
        )}
      </div>
      {!embedded && <BottomNav />}
    </div>
  );
}
