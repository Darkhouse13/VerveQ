import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Swords, Clock, Trophy, Plus, Users, Bell, Gamepad2, Hash } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { BottomNav } from "@/components/neo/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { V2_SHELL_ENABLED } from "@/lib/flags";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { formatModeLabel, formatCategoryLabel, formatRelativeTime } from "@/lib/duel";

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

function pluralize(n: number, one: string, many: string) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

function summaryHeadline(s: { type: string; sport: string | null; category: string | null; mode: string }) {
  if (s.mode === "came_first") return "Which Came First";
  if (s.type === "knowledge") {
    return s.category ? formatCategoryLabel(s.category) : "Knowledge";
  }
  const sport = s.sport ?? "sport";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function statusBadge(status: string, winnerForMe: boolean | "draw" | null) {
  if (status === "awaiting_opponent") return { label: "Open", color: "blue" as const };
  if (status === "declined") return { label: "Declined", color: "muted" as const };
  if (status === "expired") return { label: "Expired", color: "muted" as const };
  if (winnerForMe === true) return { label: "Win", color: "success" as const };
  if (winnerForMe === false) return { label: "Loss", color: "destructive" as const };
  if (winnerForMe === "draw") return { label: "Draw", color: "blue" as const };
  return { label: "Done", color: "muted" as const };
}

export default function ChallengeScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuth();
  // When embedded in the v2 shell, cross-screen links resolve to the contained
  // shell routes so the user never drops into the v1 app / v1 bottom nav.
  const rivalsPath = embedded ? SHELL_ROUTES.rivals : "/rivals";
  const rivalDetailPath = (id: string) =>
    embedded ? SHELL_ROUTES.rivalDetail(id) : `/rivals/${id}`;
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

  if (isGuest) {
    return (
      <div className={embedded ? "" : "min-h-screen bg-background pb-20"}>
        <div className="px-5 pt-6 space-y-6">
          <h1 className="text-2xl font-heading font-bold">Challenge</h1>
          <NeoCard shadow="lg" className="text-center py-8">
            <Swords size={32} strokeWidth={2.5} className="mx-auto mb-3" />
            <p className="font-heading font-bold text-lg">Async duels need an account</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create a username so your duels and rivalries can stick.
            </p>
            <NeoButton variant="primary" size="md" onClick={handleCreateAccount}>
              Create an account
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

  return (
    <div className={embedded ? "" : "min-h-screen bg-background pb-24"}>
      <div className="px-5 pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Duels</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Async head-to-heads with your friends.
            </p>
          </div>
          {(unread?.count ?? 0) > 0 && (
            <NeoBadge color="destructive" size="sm">
              <Bell size={11} strokeWidth={3} className="mr-1" />
              {unread?.count} new
            </NeoBadge>
          )}
        </div>

        <NeoCard color="accent" shadow="lg" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-heading font-bold text-base inline-flex items-center gap-1.5">
                <Gamepad2 size={16} strokeWidth={3} /> Challenge Arena
              </p>
              <p className="text-xs opacity-90">
                Live 5-round rooms — 1v1, 2v2, or FFA. Share a code, ready up,
                play together.
              </p>
            </div>
            <NeoBadge color="primary" size="sm">New</NeoBadge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton
              variant="primary"
              size="md"
              onClick={() => setShowArenaCreate(true)}
            >
              <Plus size={14} strokeWidth={3} /> Create
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="md"
              onClick={() => setShowArenaJoin(true)}
            >
              <Hash size={14} strokeWidth={3} /> Join code
            </NeoButton>
          </div>
        </NeoCard>

        <NeoButton
          variant="primary"
          size="full"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={18} strokeWidth={3} /> New Duel
        </NeoButton>

        {/* Rivals strip */}
        {topRivals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-heading font-bold uppercase text-muted-foreground">
                Your Rivals
              </p>
              <button
                type="button"
                onClick={() => navigate(rivalsPath)}
                className="text-xs font-heading font-bold uppercase text-primary underline underline-offset-4 cursor-pointer"
              >
                See all
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
          title="Your turn"
          icon={<Swords size={16} strokeWidth={3} />}
          countLabel={pluralize(yourTurn.length, "duel waiting", "duels waiting")}
          empty={loading ? "Loading…" : "Nothing waiting on you. Send a new duel."}
          accent="primary"
        >
          {yourTurn.map((d) => {
            const winnerForMe = null;
            const badge = statusBadge(d.status, winnerForMe);
            const expiresIn = formatRelativeTime(d.expiresAt);
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
                      vs @{d.opponent.username}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {summaryHeadline(d)} · {formatModeLabel(d.mode)} · {d.difficulty}
                    </p>
                  </div>
                  <NeoBadge color={badge.color} size="sm">
                    {badge.label}
                  </NeoBadge>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-muted-foreground">
                    {d.myAnsweredCount}/{d.questionCount} answered
                  </span>
                  <span className="font-mono text-muted-foreground inline-flex items-center gap-1">
                    <Clock size={11} strokeWidth={3} /> {expiresIn}
                  </span>
                </div>
              </NeoCard>
            );
          })}
        </Section>

        {/* Awaiting opponent */}
        <Section
          title="Awaiting opponent"
          icon={<Clock size={16} strokeWidth={3} />}
          countLabel={pluralize(awaiting.length, "duel out", "duels out")}
          empty={loading ? "Loading…" : "No duels waiting on someone else."}
          accent="blue"
        >
          {awaiting.map((d) => {
            const badge = statusBadge(d.status, null);
            return (
              <NeoCard
                key={d.duelId}
                onClick={() => navigate(`/duel/play/${d.duelId}`)}
                className="space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">
                      vs @{d.opponent.username}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {summaryHeadline(d)} · {formatModeLabel(d.mode)} · {d.difficulty}
                    </p>
                  </div>
                  <NeoBadge color={badge.color} size="sm">
                    {badge.label}
                  </NeoBadge>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono">
                    You: <span className="font-bold">{d.myScore}</span>
                    {d.myCompleted ? " ✓" : ""}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {d.linkCode ? "Link share" : "Waiting for opponent"}
                  </span>
                </div>
                {d.linkCode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${window.location.origin}/duel/${d.linkCode}`;
                      navigator.clipboard.writeText(url).catch(() => {});
                      toast.success("Link copied");
                    }}
                    className="text-[11px] font-heading font-bold uppercase underline underline-offset-2 text-primary cursor-pointer"
                  >
                    Copy share link
                  </button>
                )}
              </NeoCard>
            );
          })}
        </Section>

        {/* Resolved */}
        <Section
          title="Resolved"
          icon={<Trophy size={16} strokeWidth={3} />}
          countLabel={pluralize(resolved.length, "result", "results")}
          empty={loading ? "Loading…" : "No resolved duels yet."}
          accent="muted"
        >
          {resolved.map((d) => {
            const winnerForMe =
              d.winnerId === null
                ? "draw"
                : d.winnerId === me?._id
                  ? true
                  : d.winnerId
                    ? false
                    : "draw";
            const badge = statusBadge(d.status, winnerForMe);
            return (
              <NeoCard
                key={d.duelId}
                onClick={() => navigate(`/duel/result/${d.duelId}`)}
                className="space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">
                      vs @{d.opponent.username}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {summaryHeadline(d)} · {formatModeLabel(d.mode)} · {d.difficulty}
                    </p>
                  </div>
                  <NeoBadge color={badge.color} size="sm">
                    {badge.label}
                  </NeoBadge>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>
                    You <span className="font-bold">{d.myScore}</span> —{" "}
                    <span className="font-bold">{d.opponentScore}</span> them
                  </span>
                  <span className="text-muted-foreground">
                    {d.resolvedAt ? formatRelativeTime(d.resolvedAt) : ""}
                  </span>
                </div>
              </NeoCard>
            );
          })}
        </Section>

        <NeoCard
          onClick={() => navigate(rivalsPath)}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Users size={22} strokeWidth={2.5} />
            <div>
              <p className="font-heading font-bold text-sm">Rivals</p>
              <p className="text-xs text-muted-foreground">Head-to-head ledger</p>
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
