/**
 * Duels hub (`/v2/duels`) — async head-to-heads with friends, rebuilt on the
 * shell (VerveQ ONE P3.3): ShellLayout header + nav, one lime "New Duel", then
 * the buckets in the order a player acts on them — your turn, waiting on them,
 * recent results, rivals — with Arena rooms as a quiet secondary at the foot.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Swords, Clock, Plus, Users, Bell, Hash, History, Copy } from "lucide-react";
import { notify } from "@/lib/notify";

import { ShellLayout } from "@/components/shell/ShellLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DuelBadge,
  DuelRow,
  RecordStrip,
  SectionEmpty,
  SectionLabel,
  SectionLink,
} from "@/components/shell/duels/DuelParts";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import {
  formatModeLabel,
  formatRelativeTime,
  duelSummaryHeadline,
  duelMetaLine,
  duelStatusBadge,
  duelOpponentLabel,
} from "@/lib/duel";
import CreateDuelModal from "./challenge/CreateDuelModal";
import CreateArenaModal from "./arena/CreateArenaModal";
import JoinArenaModal from "./arena/JoinArenaModal";

const RECENT_RESULTS_SHOWN = 3;

export default function ChallengeScreen() {
  const { t } = useTranslation("screens");
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showArenaCreate, setShowArenaCreate] = useState(false);
  const [showArenaJoin, setShowArenaJoin] = useState(false);

  const me = user;
  const list = useQuery(api.duels.listMine, !isGuest && me ? {} : "skip");
  const rivalriesRes = useQuery(api.rivalries.listMine, !isGuest && me ? {} : "skip");
  const unread = useQuery(api.notifications.unreadCount, !isGuest && me ? {} : "skip");
  const markAllRead = useMutation(api.notifications.markAllRead);
  // Live Match removed 2026-07: nothing can create a match, so the old
  // active-match redirect into /waiting-room is gone with its routes.

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

  const title = t("challenge.duelsTitle");

  if (isGuest) {
    return (
      <ShellLayout title={title} subtitle={t("challenge.duelsSubtitle")}>
        <Card elevation="lifted" padding="lg" className="mt-2 text-center">
          <Swords size={32} strokeWidth={2.5} className="mx-auto mb-3" aria-hidden="true" />
          <p className="font-heading text-title-sm font-bold">{t("challenge.guestHeadline")}</p>
          <p className="mt-1 text-body-sm text-muted-foreground">{t("challenge.guestSubtitle")}</p>
          <Button variant="primary" size="lg" block className="mt-5" onClick={handleCreateAccount}>
            {t("challenge.createAccount")}
          </Button>
        </Card>
      </ShellLayout>
    );
  }

  const loading = list === undefined;
  const yourTurn = list?.yourTurn ?? [];
  const awaiting = list?.awaiting ?? [];
  const resolved = list?.resolved ?? [];
  const recent = resolved.slice(0, RECENT_RESULTS_SHOWN);
  const hasRecord = record.wins + record.losses + record.draws > 0;
  const unreadCount = unread?.count ?? 0;
  // A player with no duels at all sees one empty line, not three.
  const noDuels = !loading && yourTurn.length + awaiting.length + resolved.length === 0;

  return (
    <ShellLayout
      title={title}
      subtitle={t("challenge.duelsSubtitle")}
      headerRight={
        unreadCount > 0 ? (
          <Badge tone="neutral" data-testid="duels-unread">
            <Bell size={12} strokeWidth={3} aria-hidden="true" />
            {t("challenge.unreadNew", { count: unreadCount })}
          </Badge>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 py-1 md:mx-auto md:max-w-xl" data-testid="duels-hub">
        <Button variant="primary" size="lg" block onClick={() => setShowCreate(true)} data-testid="duels-new">
          <Plus size={20} strokeWidth={3} aria-hidden="true" />
          {t("challenge.newDuel")}
        </Button>

        {hasRecord && (
          <RecordStrip
            wins={record.wins}
            losses={record.losses}
            draws={record.draws}
            labels={{ wins: t("challenge.wins"), losses: t("challenge.losses"), draws: t("challenge.draws") }}
            testId="duels-record"
          />
        )}

        {/* Your turn */}
        <section>
          <SectionLabel
            aside={yourTurn.length > 0 ? <Count>{t("challenge.duelsWaiting", { count: yourTurn.length })}</Count> : undefined}
          >
            <span className="inline-flex items-center gap-1.5">
              <Swords size={14} strokeWidth={3} aria-hidden="true" />
              {t("challenge.yourTurnTitle")}
            </span>
          </SectionLabel>
          {yourTurn.length === 0 ? (
            <SectionEmpty>{loading ? t("challenge.loading") : t("challenge.yourTurnEmpty")}</SectionEmpty>
          ) : (
            <div className="flex flex-col gap-2.5">
              {yourTurn.map((d) => {
                return (
                  <DuelRow
                    key={d.duelId}
                    to={`/duel/play/${d.duelId}`}
                    title={duelOpponentLabel(d.opponent.username, t)}
                    meta={duelMetaLine(d, formatModeLabel(d.mode, t), t)}
                    footer={
                      <span className="flex items-center justify-between gap-2 font-mono">
                        <span>{t("challenge.answeredCount", { answered: d.myAnsweredCount, total: d.questionCount })}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} strokeWidth={3} aria-hidden="true" />
                          {formatRelativeTime(d.expiresAt, t)}
                        </span>
                      </span>
                    }
                    aside={d.rematchOfDuelId ? <Badge tone="neutral">{t("challenge.rematch")}</Badge> : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Waiting on them */}
        {!noDuels && (
        <section>
          <SectionLabel
            aside={awaiting.length > 0 ? <Count>{t("challenge.duelsOut", { count: awaiting.length })}</Count> : undefined}
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} strokeWidth={3} aria-hidden="true" />
              {t("challenge.waitingTitle")}
            </span>
          </SectionLabel>
          {awaiting.length === 0 ? (
            <SectionEmpty>{loading ? t("challenge.loading") : t("challenge.waitingEmpty")}</SectionEmpty>
          ) : (
            <div className="flex flex-col gap-2.5">
              {awaiting.map((d) => {
                return (
                  <div key={d.duelId} className="flex flex-col gap-1.5">
                    <DuelRow
                      to={`/duel/play/${d.duelId}`}
                      title={duelOpponentLabel(d.opponent.username, t)}
                      meta={duelMetaLine(d, formatModeLabel(d.mode, t), t)}
                      footer={
                        <span className="flex items-center justify-between gap-2 font-mono">
                          <span>
                            {t("challenge.youLabel")} <span className="font-bold text-foreground">{d.myScore}</span>
                          </span>
                          <span>{d.linkCode ? t("challenge.linkShare") : t("challenge.waitingForOpponent")}</span>
                        </span>
                      }
                    />
                    {d.linkCode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          const url = `${window.location.origin}/duel/${d.linkCode}`;
                          navigator.clipboard.writeText(url).catch(() => {});
                          notify.success(t("challenge.linkCopied"));
                        }}
                      >
                        <Copy size={16} aria-hidden="true" />
                        {t("challenge.copyShareLink")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        )}

        {/* Recent results — the full list lives on the history page. */}
        {!noDuels && (
        <section>
          <SectionLabel
            aside={resolved.length > 0 ? <SectionLink to={SHELL_ROUTES.duelHistory}>{t("challenge.history")}</SectionLink> : undefined}
          >
            {t("challenge.recentResults")}
          </SectionLabel>
          {recent.length === 0 ? (
            <SectionEmpty>{loading ? t("challenge.loading") : t("challenge.noFinishedDuels")}</SectionEmpty>
          ) : (
            <div className="flex flex-col gap-2.5">
              {recent.map((d) => {
                const winnerForMe =
                  d.status === "resolved" ? (d.winnerId ? d.winnerId === me?._id : "draw") : null;
                const badge = duelStatusBadge(d.status, winnerForMe, t);
                const rematchIncoming = d.openRematch && !d.openRematch.byMe;
                return (
                  <DuelRow
                    key={d.duelId}
                    to={`/duel/result/${d.duelId}`}
                    title={duelOpponentLabel(d.opponent.username, t)}
                    meta={`${duelSummaryHeadline(d, t)}${d.resolvedAt ? ` · ${formatRelativeTime(d.resolvedAt, t)}` : ""}`}
                    aside={
                      <>
                        {rematchIncoming && <Badge tone="neutral">{t("challenge.rematchIncoming")}</Badge>}
                        <span className="font-mono text-body-sm font-bold tabular-nums">
                          {d.myScore}–{d.opponentScore}
                        </span>
                        <DuelBadge label={badge.label} color={badge.color} />
                      </>
                    }
                  />
                );
              })}
              <DuelRow
                to={SHELL_ROUTES.duelHistory}
                title={
                  <span className="inline-flex items-center gap-2">
                    <History size={16} strokeWidth={2.5} aria-hidden="true" />
                    {t("challenge.duelHistory")}
                  </span>
                }
                aside={<Badge tone="muted">{t("challenge.resultsCount", { count: resolved.length })}</Badge>}
              />
            </div>
          )}
        </section>

        )}

        {/* Rivals */}
        <section>
          {topRivals.length > 0 && (
            <>
            <SectionLabel aside={<SectionLink to={SHELL_ROUTES.rivals}>{t("challenge.seeAll")}</SectionLink>}>
              {t("challenge.yourRivals")}
            </SectionLabel>
            <div className="-mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-none">
              {topRivals.map((r) => (
                <Link
                  key={r.opponent.userId}
                  to={SHELL_ROUTES.rivalDetail(r.opponent.userId)}
                  className="min-h-14 min-w-36 shrink-0 rounded-lg bg-card px-3 py-2 text-left neo-border neo-shadow-sm transition duration-press hover:bg-muted active:translate-x-0.5 active:translate-y-0.5"
                >
                  <p className="truncate font-heading text-body-sm font-bold">@{r.opponent.username}</p>
                  <p className="mt-0.5 font-mono text-meta font-bold tabular-nums">
                    {r.wins}-{r.losses}
                    {r.draws ? `-${r.draws}` : ""}
                    {r.currentStreakLen > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {r.currentStreakHolderId === user?._id ? `🔥 ${r.currentStreakLen}` : `↳ ${r.currentStreakLen}`}
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
            </>
          )}
          <DuelRow
            to={SHELL_ROUTES.rivals}
            testId="duels-rivals"
            title={
              <span className="inline-flex items-center gap-2">
                <Users size={16} strokeWidth={2.5} aria-hidden="true" />
                {t("challenge.rivals")}
              </span>
            }
            meta={t("challenge.rivalsLedger")}
            aside={<Badge tone="muted">{rivalriesRes?.rivalries.length ?? 0}</Badge>}
          />
        </section>

        {/* Arena — live rooms. A secondary path here; it has its own hub. */}
        <Card elevation="flat" padding="md" data-testid="duels-arena">
          <p className="font-heading text-body font-bold">{t("challenge.arenaTitle")}</p>
          <p className="mt-0.5 text-body-sm text-muted-foreground">{t("challenge.arenaDescription")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowArenaCreate(true)}>
              <Plus size={16} strokeWidth={3} aria-hidden="true" />
              {t("challenge.create")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowArenaJoin(true)}>
              <Hash size={16} strokeWidth={3} aria-hidden="true" />
              {t("challenge.joinCode")}
            </Button>
          </div>
        </Card>
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
            navigate(SHELL_ROUTES.arenaPlay(code));
          }}
        />
      )}

      {showArenaJoin && (
        <JoinArenaModal
          onClose={() => setShowArenaJoin(false)}
          onJoin={(code) => {
            setShowArenaJoin(false);
            navigate(SHELL_ROUTES.arenaPlay(code));
          }}
        />
      )}
    </ShellLayout>
  );
}

/** A section's quiet count line (hidden at zero). */
function Count({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-eyebrow uppercase text-muted-foreground">{children}</span>;
}
