import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import {
  Swords,
  Clock,
  Trophy,
  Plus,
  Users,
  Bell,
  Gamepad2,
  Hash,
  History,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { BottomNav } from "@/components/neo/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { V2_SHELL_ENABLED } from "@/lib/flags";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import {
  formatModeLabel,
  formatRelativeTime,
  duelSummaryHeadline,
  duelStatusBadge,
  duelOpponentLabel,
} from "@/lib/duel";

/**
 * Arena deep link. When the v2 shell is enabled, create/join land in the new
 * shell Arena (prototype layout); otherwise the existing `/arena/:code` screen.
 * Same room, same server-authority — only the presentation differs.
 */
const arenaPath = (code: string) =>
  `${V2_SHELL_ENABLED ? "/v2/arena" : "/arena"}/${code}`;
import CreateDuelModal from "./challenge/CreateDuelModal";
import CreateArenaModal from "./arena/CreateArenaModal";
import JoinArenaModal from "./arena/JoinArenaModal";

const RECENT_RESULTS_SHOWN = 3;

export default function ChallengeScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation("screens");
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuth();
  // When embedded in the v2 shell, cross-screen links resolve to the contained
  // shell routes so the user never drops into the v1 app / v1 bottom nav.
  const rivalsPath = embedded ? SHELL_ROUTES.rivals : "/rivals";
  const rivalDetailPath = (id: string) =>
    embedded ? SHELL_ROUTES.rivalDetail(id) : `/rivals/${id}`;
  const historyPath = embedded ? SHELL_ROUTES.duelHistory : "/duels/history";
  const [showCreate, setShowCreate] = useState(false);
  const [showArenaCreate, setShowArenaCreate] = useState(false);
  const [showArenaJoin, setShowArenaJoin] = useState(false);

  const me = user;
  const list = useQuery(
    api.duels.listMine,
    !isGuest && me ? {} : "skip",
  );
  const rivalriesRes = useQuery(
    api.rivalries.listMine,
    !isGuest && me ? {} : "skip",
  );
  const unread = useQuery(
    api.notifications.unreadCount,
    !isGuest && me ? {} : "skip",
  );
  const markAllRead = useMutation(api.notifications.markAllRead);
  const activeMatchId = useQuery(api.liveMatches.getActiveMatch);

  useEffect(() => {
    if (activeMatchId) {
      navigate(`/waiting-room?matchId=${activeMatchId}`, { replace: true });
    }
  }, [activeMatchId, navigate]);

  useEffect(() => {
    if (!isGuest && me && unread && unread.count > 0) {
      // Mark all read when user opens the hub.
      markAllRead().catch(() => {});
    }
  }, [isGuest, me, unread, markAllRead]);

  const handleCreateAccount = async () => {
    await logout();
    navigate("/?mode=signup&from=guest");
  };

  const topRivals = useMemo(() => {
    const list = rivalriesRes?.rivalries ?? [];
    return list.slice(0, 6);
  }, [rivalriesRes]);

  // Lifetime head-to-head record, summed across the rivalry ledger.
  const record = useMemo(() => {
    const rows = rivalriesRes?.rivalries ?? [];
    return rows.reduce(
      (acc, r) => ({
        wins: acc.wins + r.wins,
        losses: acc.losses + r.losses,
        draws: acc.draws + r.draws,
      }),
      { wins: 0, losses: 0, draws: 0 },
    );
  }, [rivalriesRes]);

  if (isGuest) {
    return (
      <div className={embedded ? "" : "min-h-screen bg-background pb-20"}>
        <div className="px-5 pt-6 space-y-6">
          <h1 className="text-2xl font-heading font-bold">{t("challenge.title")}</h1>
          <NeoCard shadow="lg" className="text-center py-8">
            <Swords size={32} strokeWidth={2.5} className="mx-auto mb-3" />
            <p className="font-heading font-bold text-lg">{t("challenge.guestHeadline")}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {t("challenge.guestSubtitle")}
            </p>
            <NeoButton variant="primary" size="md" onClick={handleCreateAccount}>
              {t("challenge.createAccount")}
            </NeoButton>
          </NeoCard>
        </div>
        {!embedded && <BottomNav />}
      </div>
    );
  }

  const loading = list === undefined;
  const yourTurn = list?.yourTurn ?? [];
  const awaiting = list?.awaiting ?? [];
  const resolved = list?.resolved ?? [];
  const recent = resolved.slice(0, RECENT_RESULTS_SHOWN);
  const hasRecord = record.wins + record.losses + record.draws > 0;

  return (
    <div className={embedded ? "" : "min-h-screen bg-background pb-24"}>
      <div className="px-5 pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">{t("challenge.duelsTitle")}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("challenge.duelsSubtitle")}
            </p>
          </div>
          {(unread?.count ?? 0) > 0 && (
            <NeoBadge color="destructive" size="sm">
              <Bell size={11} strokeWidth={3} className="mr-1" />
              {t("challenge.unreadNew", { count: unread?.count ?? 0 })}
            </NeoBadge>
          )}
        </div>

        {hasRecord && (
          <div className="grid grid-cols-3 gap-2">
            <NeoCard className="text-center py-2.5">
              <p className="font-mono font-bold text-lg leading-none">{record.wins}</p>
              <p className="text-[10px] font-heading uppercase text-muted-foreground mt-1">
                {t("challenge.wins")}
              </p>
            </NeoCard>
            <NeoCard className="text-center py-2.5">
              <p className="font-mono font-bold text-lg leading-none">{record.losses}</p>
              <p className="text-[10px] font-heading uppercase text-muted-foreground mt-1">
                {t("challenge.losses")}
              </p>
            </NeoCard>
            <NeoCard className="text-center py-2.5">
              <p className="font-mono font-bold text-lg leading-none">{record.draws}</p>
              <p className="text-[10px] font-heading uppercase text-muted-foreground mt-1">
                {t("challenge.draws")}
              </p>
            </NeoCard>
          </div>
        )}

        <NeoCard color="accent" shadow="lg" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading font-bold text-base inline-flex items-center gap-1.5">
                <Gamepad2 size={16} strokeWidth={3} /> {t("challenge.arenaTitle")}
              </p>
              <p className="text-xs opacity-90">
                {t("challenge.arenaDescription")}
              </p>
            </div>
            <NeoBadge color="primary" size="sm">{t("challenge.newBadge")}</NeoBadge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton
              variant="primary"
              size="md"
              onClick={() => setShowArenaCreate(true)}
            >
              <Plus size={14} strokeWidth={3} /> {t("challenge.create")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="md"
              onClick={() => setShowArenaJoin(true)}
            >
              <Hash size={14} strokeWidth={3} /> {t("challenge.joinCode")}
            </NeoButton>
          </div>
        </NeoCard>

        <NeoButton
          variant="primary"
          size="full"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={18} strokeWidth={3} /> {t("challenge.newDuel")}
        </NeoButton>

        {/* Rivals strip */}
        {topRivals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-heading font-bold uppercase text-muted-foreground">
                {t("challenge.yourRivals")}
              </p>
              <button
                type="button"
                onClick={() => navigate(rivalsPath)}
                className="text-xs font-heading font-bold uppercase text-primary underline underline-offset-4 cursor-pointer"
              >
                {t("challenge.seeAll")}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {topRivals.map((r) => (
                <button
                  key={r.opponent.userId}
                  type="button"
                  onClick={() => navigate(rivalDetailPath(r.opponent.userId))}
                  className="neo-border neo-shadow rounded-lg bg-card px-3 py-2 text-left shrink-0 min-w-[140px] cursor-pointer active:neo-shadow-pressed"
                >
                  <p className="font-heading font-bold text-xs truncate">@{r.opponent.username}</p>
                  <p className="text-[10px] font-mono font-bold mt-1">
                    {r.wins}-{r.losses}
                    {r.draws ? `-${r.draws}` : ""}
                  </p>
                  {r.currentStreakLen > 0 && (
                    <p className="text-[10px] mt-0.5 text-muted-foreground">
                      {r.currentStreakHolderId === user?._id
                        ? `🔥 ${r.currentStreakLen}`
                        : `↳ ${r.currentStreakLen}`}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Your Turn */}
        <Section
          title={t("challenge.yourTurnTitle")}
          icon={<Swords size={16} strokeWidth={3} />}
          countLabel={t("challenge.duelsWaiting", { count: yourTurn.length })}
          empty={loading ? t("challenge.loading") : t("challenge.yourTurnEmpty")}
          accent="primary"
        >
          {yourTurn.map((d) => {
            const badge = d.rematchOfDuelId
              ? { label: t("challenge.rematch"), color: "yellow" as const }
              : duelStatusBadge(d.status, null, t);
            const expiresIn = formatRelativeTime(d.expiresAt, t);
            return (
              <NeoCard
                key={d.duelId}
                shadow="default"
                onClick={() => navigate(`/duel/play/${d.duelId}`)}
                className="space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">
                      {duelOpponentLabel(d.opponent.username, t)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {duelSummaryHeadline(d, t)} · {formatModeLabel(d.mode, t)} · {d.difficulty}
                    </p>
                  </div>
                  <NeoBadge color={badge.color} size="sm">
                    {badge.label}
                  </NeoBadge>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-muted-foreground">
                    {t("challenge.answeredCount", {
                      answered: d.myAnsweredCount,
                      total: d.questionCount,
                    })}
                  </span>
                  <span className="font-mono text-muted-foreground inline-flex items-center gap-1">
                    <Clock size={11} strokeWidth={3} /> {expiresIn}
                  </span>
                </div>
              </NeoCard>
            );
          })}
        </Section>

        {/* Waiting on them */}
        <Section
          title={t("challenge.waitingTitle")}
          icon={<Clock size={16} strokeWidth={3} />}
          countLabel={t("challenge.duelsOut", { count: awaiting.length })}
          empty={loading ? t("challenge.loading") : t("challenge.waitingEmpty")}
          accent="blue"
        >
          {awaiting.map((d) => {
            const badge = duelStatusBadge(d.status, null, t);
            return (
              <NeoCard
                key={d.duelId}
                onClick={() => navigate(`/duel/play/${d.duelId}`)}
                className="space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">
                      {duelOpponentLabel(d.opponent.username, t)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {duelSummaryHeadline(d, t)} · {formatModeLabel(d.mode, t)} · {d.difficulty}
                    </p>
                  </div>
                  <NeoBadge color={badge.color} size="sm">
                    {badge.label}
                  </NeoBadge>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono">
                    {t("challenge.youLabel")} <span className="font-bold">{d.myScore}</span>
                    {d.myCompleted ? " ✓" : ""}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {d.linkCode ? t("challenge.linkShare") : t("challenge.waitingForOpponent")}
                  </span>
                </div>
                {d.linkCode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/duel/${d.linkCode}`;
                      navigator.clipboard.writeText(url).catch(() => {});
                      toast.success(t("challenge.linkCopied"));
                    }}
                    className="text-[11px] font-heading font-bold uppercase underline underline-offset-2 text-primary cursor-pointer"
                  >
                    {t("challenge.copyShareLink")}
                  </button>
                )}
              </NeoCard>
            );
          })}
        </Section>

        {/* Recent results — the full list lives on the history page. */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-heading font-bold uppercase flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full neo-border bg-muted">
                <Trophy size={16} strokeWidth={3} />
              </span>
              {t("challenge.recentResults")}
            </p>
            {resolved.length > 0 && (
              <button
                type="button"
                onClick={() => navigate(historyPath)}
                className="text-xs font-heading font-bold uppercase text-primary underline underline-offset-4 cursor-pointer"
              >
                {t("challenge.history")}
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <NeoCard className="text-center py-5">
              <p className="text-xs text-muted-foreground">
                {loading ? t("challenge.loading") : t("challenge.noFinishedDuels")}
              </p>
            </NeoCard>
          ) : (
            <div className="space-y-2">
              {recent.map((d) => {
                const winnerForMe =
                  d.status === "resolved"
                    ? d.winnerId
                      ? d.winnerId === me?._id
                      : "draw"
                    : null;
                const badge = duelStatusBadge(d.status, winnerForMe, t);
                const rematchIncoming = d.openRematch && !d.openRematch.byMe;
                return (
                  <NeoCard
                    key={d.duelId}
                    onClick={() => navigate(`/duel/result/${d.duelId}`)}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <NeoBadge color={badge.color} size="sm" className="shrink-0">
                        {badge.label}
                      </NeoBadge>
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-xs truncate">
                          {duelOpponentLabel(d.opponent.username, t)}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize truncate">
                          {duelSummaryHeadline(d, t)}
                          {d.resolvedAt
                            ? ` · ${formatRelativeTime(d.resolvedAt, t)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rematchIncoming && (
                        <NeoBadge color="yellow" size="sm">
                          {t("challenge.rematchIncoming")}
                        </NeoBadge>
                      )}
                      <p className="font-mono font-bold text-xs">
                        {d.myScore}–{d.opponentScore}
                      </p>
                    </div>
                  </NeoCard>
                );
              })}
              <NeoCard
                onClick={() => navigate(historyPath)}
                className="py-3 flex items-center justify-between"
              >
                <p className="font-heading font-bold text-sm inline-flex items-center gap-2">
                  <History size={16} strokeWidth={2.5} /> {t("challenge.duelHistory")}
                </p>
                <span className="inline-flex items-center gap-1.5">
                  <NeoBadge color="muted" size="sm">
                    {t("challenge.resultsCount", { count: resolved.length })}
                  </NeoBadge>
                  <ChevronRight size={16} strokeWidth={3} />
                </span>
              </NeoCard>
            </div>
          )}
        </div>

        <NeoCard
          onClick={() => navigate(rivalsPath)}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Users size={22} strokeWidth={2.5} />
            <div>
              <p className="font-heading font-bold text-sm">{t("challenge.rivals")}</p>
              <p className="text-xs text-muted-foreground">{t("challenge.rivalsLedger")}</p>
            </div>
          </div>
          <NeoBadge color="primary" size="sm">
            {rivalriesRes?.rivalries.length ?? 0}
          </NeoBadge>
        </NeoCard>
      </div>

      {showCreate && (
        <CreateDuelModal
          onClose={() => setShowCreate(false)}
          onCreated={(duelId) => {
            setShowCreate(false);
            navigate(`/duel/play/${duelId}`);
          }}
        />
      )}

      {showArenaCreate && (
        <CreateArenaModal
          onClose={() => setShowArenaCreate(false)}
          onCreated={(code) => {
            setShowArenaCreate(false);
            navigate(arenaPath(code));
          }}
        />
      )}

      {showArenaJoin && (
        <JoinArenaModal
          onClose={() => setShowArenaJoin(false)}
          onJoin={(code) => {
            setShowArenaJoin(false);
            navigate(arenaPath(code));
          }}
        />
      )}

      {!embedded && <BottomNav />}
    </div>
  );
}

function Section({
  title,
  icon,
  countLabel,
  empty,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  countLabel: string;
  empty: string;
  accent: "primary" | "blue" | "muted";
  children?: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-heading font-bold uppercase flex items-center gap-1.5">
          <span
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full neo-border ${
              accent === "primary"
                ? "bg-primary text-primary-foreground"
                : accent === "blue"
                  ? "bg-electric-blue text-electric-blue-foreground"
                  : "bg-muted"
            }`}
          >
            {icon}
          </span>
          {title}
        </p>
        <span className="text-[10px] font-heading uppercase text-muted-foreground">
          {countLabel}
        </span>
      </div>
      {hasChildren ? (
        <div className="space-y-2.5">{children}</div>
      ) : (
        <NeoCard className="text-center py-5">
          <p className="text-xs text-muted-foreground">{empty}</p>
        </NeoCard>
      )}
    </div>
  );
}
