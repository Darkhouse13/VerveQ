/**
 * Duel history (`/duels/history`) — every finished duel, filterable by
 * outcome. Shell-native (VerveQ ONE P3.3): ShellLayout with a back to Duels,
 * the W/L/D record, a Segmented filter, then the rows.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";

import { ShellLayout } from "@/components/shell/ShellLayout";
import { Segmented } from "@/components/ui/segmented";
import { Card } from "@/components/ui/card";
import { DuelBadge, DuelRow, RecordStrip } from "@/components/shell/duels/DuelParts";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import {
  formatModeLabel,
  formatRelativeTime,
  duelMetaLine,
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

export default function DuelHistoryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("screens");
  const { user, isGuest } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useQuery(api.duels.listMine, !isGuest && user ? {} : "skip");
  const loading = list === undefined;
  const resolved = useMemo(() => list?.resolved ?? [], [list]);

  const outcomeFor = (d: (typeof resolved)[number]): DuelOutcomeForMe =>
    d.status === "resolved" ? (d.winnerId ? d.winnerId === user?._id : "draw") : null;

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
    <ShellLayout title={t("duelHistory.title")} back onBack={() => navigate(SHELL_ROUTES.duels)}>
      <div className="flex flex-col gap-4 py-1 md:mx-auto md:max-w-xl" data-testid="duel-history">
        <RecordStrip
          wins={tally.wins}
          losses={tally.losses}
          draws={tally.draws}
          labels={{
            wins: t("duelHistory.statWins"),
            losses: t("duelHistory.statLosses"),
            draws: t("duelHistory.statDraws"),
          }}
        />

        <Segmented<Filter>
          aria-label={t("duelHistory.title")}
          block
          value={filter}
          onChange={setFilter}
          options={FILTERS.map(({ key, labelKey }) => ({ value: key, label: t(labelKey) }))}
          className="[&>button]:px-2"
        />

        {shown.length === 0 ? (
          <Card elevation="flat" padding="lg" className="text-center">
            <Trophy size={24} strokeWidth={2.5} className="mx-auto mb-2" aria-hidden="true" />
            <p className="text-body-sm text-muted-foreground">
              {loading
                ? t("duelHistory.loading")
                : filter === "all"
                  ? t("duelHistory.emptyAll")
                  : t("duelHistory.emptyFilter")}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {shown.map((d) => {
              const badge = duelStatusBadge(d.status, outcomeFor(d), t);
              return (
                <DuelRow
                  key={d.duelId}
                  to={`/duel/result/${d.duelId}`}
                  title={duelOpponentLabel(d.opponent.username, t)}
                  meta={duelMetaLine(d, formatModeLabel(d.mode, t), t)}
                  footer={
                    <span className="flex items-center justify-between gap-2 font-mono">
                      <span>
                        {t("duelHistory.scoreYou")} <span className="font-bold text-foreground">{d.myScore}</span> —{" "}
                        <span className="font-bold text-foreground">{d.opponentScore}</span> {t("duelHistory.scoreThem")}
                      </span>
                      <span>{d.resolvedAt ? formatRelativeTime(d.resolvedAt, t) : ""}</span>
                    </span>
                  }
                  aside={<DuelBadge label={badge.label} color={badge.color} />}
                />
              );
            })}
            <p className="pt-1 text-center text-meta text-muted-foreground">
              {t("duelHistory.showingCount", { count: resolved.length })}
            </p>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
