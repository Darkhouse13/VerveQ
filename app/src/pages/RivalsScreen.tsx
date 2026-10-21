/**
 * Rivals (`/v2/rivals`, `/v2/rivals/:opponentUserId`) — the head-to-head
 * ledger and one rivalry's record. Shell-native (VerveQ ONE P3.3): both sit in
 * ShellLayout with the shell nav; the v1 BottomNav is gone.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "convex/react";
import { Swords, Flame } from "lucide-react";
import { notify } from "@/lib/notify";
import { friendlyError } from "@/lib/errors";

import { ShellLayout } from "@/components/shell/ShellLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DuelRow, LoadingLine } from "@/components/shell/duels/DuelParts";
import { DUEL_ACCENT } from "@/components/shell/duels/duelTheme";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { formatRelativeTime } from "@/lib/duel";

export default function RivalsListScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("screens");
  const { user, isGuest } = useAuth();
  const data = useQuery(api.rivalries.listMine, isGuest || !user ? "skip" : {});
  const back = () => navigate(SHELL_ROUTES.duels);

  if (isGuest) {
    return (
      <ShellLayout title={t("rivals.title")} back onBack={back}>
        <Card elevation="lifted" padding="lg" className="mt-2 text-center">
          <p className="font-heading text-title-sm font-bold">{t("rivals.needAccountTitle")}</p>
          <p className="mt-1 text-body-sm text-muted-foreground">{t("rivals.needAccountDescription")}</p>
        </Card>
      </ShellLayout>
    );
  }

  const rivalries = data?.rivalries ?? [];
  const loading = data === undefined;

  return (
    <ShellLayout title={t("rivals.title")} back onBack={back}>
      <div className="flex flex-col gap-2.5 py-1 md:mx-auto md:max-w-xl" data-testid="rivals-list">
        {loading ? (
          <LoadingLine>{t("rivals.loading")}</LoadingLine>
        ) : rivalries.length === 0 ? (
          <Card elevation="lifted" padding="lg" className="text-center">
            <Swords size={28} strokeWidth={2.5} className="mx-auto mb-2" aria-hidden="true" />
            <p className="font-heading text-title-sm font-bold">{t("rivals.emptyTitle")}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">{t("rivals.emptyDescription")}</p>
            <Button variant="primary" size="lg" block className="mt-5" onClick={back}>
              {t("rivals.sendDuel")}
            </Button>
          </Card>
        ) : (
          rivalries.map((r) => {
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
              <DuelRow
                key={r.opponent.userId}
                to={SHELL_ROUTES.rivalDetail(r.opponent.userId)}
                title={`@${r.opponent.username}`}
                meta={streakLine ? `${lead} · ${streakLine}` : lead}
                footer={r.updatedAt ? t("rivals.lastDuel", { time: formatRelativeTime(r.updatedAt, t) }) : undefined}
                aside={
                  <Badge tone={r.wins > r.losses ? "right" : r.wins < r.losses ? "wrong" : "neutral"}>
                    {r.wins}-{r.losses}
                    {r.draws ? `-${r.draws}` : ""}
                  </Badge>
                }
              />
            );
          })
        )}
      </div>
    </ShellLayout>
  );
}

export function RivalDetailScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("screens");
  const { user, isGuest } = useAuth();
  const { opponentUserId } = useParams<{ opponentUserId: string }>();
  const rivalry = useQuery(
    api.rivalries.get,
    !isGuest && user && opponentUserId ? { opponentUserId: opponentUserId as Id<"users"> } : "skip",
  );
  const rematchMut = useMutation(api.duels.rematch);
  const [rematching, setRematching] = useState(false);
  const back = () => navigate(SHELL_ROUTES.rivals);

  if (!opponentUserId) {
    return null;
  }

  if (isGuest) {
    return (
      <ShellLayout title={t("rivals.title")} back onBack={back}>
        <Card elevation="flat" padding="lg" className="mt-2 text-center">
          <p className="font-heading font-bold">{t("rivals.signInToView")}</p>
        </Card>
      </ShellLayout>
    );
  }

  if (rivalry === undefined) {
    return (
      <ShellLayout title={t("rivals.title")} back onBack={back}>
        <LoadingLine>{t("rivals.loading")}</LoadingLine>
      </ShellLayout>
    );
  }

  if (!rivalry) {
    return (
      <ShellLayout title={t("rivals.title")} back onBack={back}>
        <Card elevation="flat" padding="lg" className="mt-2 text-center" data-testid="rival-no-record">
          <p className="font-heading text-title-sm font-bold">{t("rivals.noRecordTitle")}</p>
          <p className="mt-1 text-body-sm text-muted-foreground">{t("rivals.noRecordDescription")}</p>
        </Card>
      </ShellLayout>
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
      notify.error(t("rivals.noPreviousDuel"));
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: rivalry.lastDuelId });
      notify.success(t("rivals.rematchSent"));
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      notify.error(friendlyError(e, t("rivals.rematchFailed")));
    } finally {
      setRematching(false);
    }
  };

  return (
    <ShellLayout title={`@${rivalry.opponent?.username ?? t("rivals.rivalFallback")}`} back onBack={back}>
      <div className="flex flex-col gap-3 py-1 md:mx-auto md:max-w-md" style={DUEL_ACCENT} data-testid="rival-detail">
        <Card tone="mode" elevation="lifted" padding="lg" className="text-center">
          <Badge tone="neutral" size="md" shape="tag" stamp className="bg-ink text-cream">
            {isLeading ? t("rivals.leading") : isTied ? t("rivals.tiedBadge") : t("rivals.trailing")}
          </Badge>
          <p className="mt-3 font-mono text-score font-bold tabular-nums">
            {rivalry.wins}
            <span className="mx-2 text-ink/70" aria-hidden="true">–</span>
            {rivalry.losses}
            {rivalry.draws ? <span className="ml-2 text-title-lg text-ink/70">({rivalry.draws})</span> : null}
          </p>
          <p className="mt-2 font-mono text-eyebrow font-bold uppercase">
            {rivalry.draws ? t("rivals.scoreLabelWithDraws") : t("rivals.scoreLabel")}
          </p>
        </Card>

        <Card elevation="flat" padding="sm" className="flex min-h-12 items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 font-heading text-body-sm font-bold">
            <Flame size={20} strokeWidth={2.5} className="text-mode-accent" aria-hidden="true" />
            {streakLine}
          </p>
          {rivalry.updatedAt && (
            <p className="font-mono text-meta text-muted-foreground">
              {t("rivals.lastDuelShort", { time: formatRelativeTime(rivalry.updatedAt, t) })}
            </p>
          )}
        </Card>

        <div className="mt-1 flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            block
            loading={rematching}
            disabled={!rivalry.lastDuelId}
            onClick={handleRematch}
            data-testid="rival-rematch"
          >
            <Swords size={18} strokeWidth={3} aria-hidden="true" />
            {t("rivals.rematch")}
          </Button>
          <Button variant="secondary" size="md" block onClick={() => navigate(SHELL_ROUTES.duels)}>
            {t("rivals.newCustomDuel")}
          </Button>
        </div>
      </div>
    </ShellLayout>
  );
}
