import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  HelpCircle,
  Hourglass,
  LogOut,
  RotateCcw,
  Share2,
  Shield,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { QuestionImage } from "@/components/QuestionImage";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import {
  arenaCategoryEmoji,
  arenaCategoryLabel,
  arenaModeCapacity,
  arenaModeLabel,
  arenaModeVerboseLabel,
  buildArenaUrl,
  normalizeArenaCode,
  shareArenaLink,
  useClockOffset,
  useImagePreload,
  usePhaseAnchor,
  useTick,
} from "@/lib/arena";

type Room = NonNullable<FunctionReturnType<typeof api.challengeArenas.getRoom>>;
type RoomPlayer = Room["players"][number];
type Phase = Room["phase"];
type ArenaSummary = NonNullable<
  FunctionReturnType<typeof api.challengeArenas.getArenaSummary>
>;
type ArenaSummaryPlayerStats = ArenaSummary["players"][number];

const COUNTDOWN_MS = 3_000;
const ROUND_BREAK_MS = 8_000;
const FORCE_START_GRACE_LABEL_MS = 15_000;

export default function ChallengeArenaScreen() {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isGuest, isLoading } = useAuth();

  const rawCode = params.code ?? "";
  const code = useMemo(() => normalizeArenaCode(rawCode), [rawCode]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate(`/?from=arena&code=${encodeURIComponent(code)}`, { replace: true });
    } else if (isGuest) {
      navigate("/?mode=signup&from=arena", { replace: true });
    }
  }, [isAuthenticated, isGuest, isLoading, navigate, code]);

  if (!code) {
    return <NotInRoom title="Missing arena code" detail="The link you followed didn't include an arena code." />;
  }

  if (isLoading || !isAuthenticated || isGuest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  return <ChallengeArenaRoom code={code} userId={user?._id as Id<"users"> | undefined} />;
}

function ChallengeArenaRoom({
  code,
  userId,
}: {
  code: string;
  userId: Id<"users"> | undefined;
}) {
  const navigate = useNavigate();
  const room = useQuery(api.challengeArenas.getRoom, { code });
  const joinMut = useMutation(api.challengeArenas.join);
  const leaveMut = useMutation(api.challengeArenas.leave);
  const rematchMut = useMutation(api.challengeArenas.rematch);

  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [rematching, setRematching] = useState(false);
  const joinAttempted = useRef(false);

  // If we land on this URL and the room query returns null, attempt a join
  // exactly once. join is idempotent for existing players, and surfaces a
  // clean error for non-lobby states.
  useEffect(() => {
    if (room !== null) return;
    if (joinAttempted.current) return;
    joinAttempted.current = true;
    void (async () => {
      try {
        await joinMut({ code });
        setJoinError(null);
      } catch (e) {
        setJoinError(friendlyError(e, "Could not join arena"));
      }
    })();
  }, [code, joinMut, room]);

  const handleLeave = useCallback(
    async (silent = false) => {
      if (!room) {
        navigate("/challenge");
        return;
      }
      if (leaving) return;
      setLeaving(true);
      try {
        await leaveMut({ arenaId: room.arenaId });
      } catch (e) {
        if (!silent) {
          toast.error(friendlyError(e, "Could not leave"));
        }
      } finally {
        setLeaving(false);
        navigate("/challenge");
      }
    },
    [leaveMut, leaving, navigate, room],
  );

  const handleRematch = useCallback(async () => {
    if (!room || rematching) return;
    if (room.rematchArenaCode) {
      navigate(`/arena/${room.rematchArenaCode}`, { replace: true });
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ arenaId: room.arenaId });
      toast.success("Rematch lobby ready");
      navigate(`/arena/${result.code}`, { replace: true });
    } catch (e) {
      toast.error(friendlyError(e, "Rematch failed"));
    } finally {
      setRematching(false);
    }
  }, [navigate, rematchMut, rematching, room]);

  if (room === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading arena…</p>
      </div>
    );
  }

  if (room === null) {
    if (joinError) {
      return (
        <NotInRoom
          title="Couldn't join arena"
          detail={joinError}
          onBack={() => navigate("/challenge")}
        />
      );
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Joining…</p>
      </div>
    );
  }

  if (room.status === "abandoned") {
    return (
      <NotInRoom
        title="Arena ended"
        detail="The room was abandoned or expired."
        onBack={() => navigate("/challenge")}
      />
    );
  }

  return (
    <ArenaShell
      room={room}
      userId={userId}
      leaving={leaving}
      rematching={rematching}
      onLeave={() => void handleLeave()}
      onRematch={() => void handleRematch()}
    />
  );
}

function ArenaShell({
  room,
  userId,
  leaving,
  rematching,
  onLeave,
  onRematch,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
  leaving: boolean;
  rematching: boolean;
  onLeave: () => void;
  onRematch: () => void;
}) {
  const phase = room.phase;
  const me = userId
    ? room.players.find((p) => p.userId === userId) ?? null
    : null;
  const meLeft = me?.left ?? false;

  // Preload upcoming image-round media so the <img> tag hits a warm cache
  // when the next question opens — critical for high-latency clients.
  useImagePreload(room.upcomingImageUrls);

  // Inactive players (left, or never joined) get a soft fallback.
  if (!me || meLeft) {
    return (
      <NotInRoom
        title={meLeft ? "You left this arena" : "Not in this arena"}
        detail={
          meLeft
            ? "You can rejoin from the code if the lobby is still open, or head back to the Challenge hub."
            : "Ask the host for the code, or open the share link they sent."
        }
        onBack={() => (window.location.pathname = "/challenge")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <ArenaHeader
        room={room}
        onLeave={onLeave}
        leaving={leaving}
        showShare={phase === "lobby"}
      />

      {phase === "final" && room.rematchArenaCode && (
        <RematchReadyBanner
          rematching={rematching}
          onJoin={onRematch}
        />
      )}

      <div className="px-5 pb-6 space-y-5">
        {phase === "lobby" && <LobbyView room={room} userId={userId} />}
        {phase === "countdown" && <CountdownView room={room} />}
        {phase === "question" && (
          <QuestionView room={room} userId={userId} />
        )}
        {phase === "reveal" && <RevealView room={room} userId={userId} />}
        {phase === "round_break" && (
          <RoundBreakView room={room} userId={userId} />
        )}
        {phase === "final" && (
          <FinalView
            room={room}
            userId={userId}
            rematching={rematching}
            onRematch={onRematch}
          />
        )}
      </div>
    </div>
  );
}

function RematchReadyBanner({
  rematching,
  onJoin,
}: {
  rematching: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="px-5 pt-3">
      <button
        type="button"
        onClick={onJoin}
        disabled={rematching}
        className="w-full neo-border neo-shadow rounded-lg bg-accent text-accent-foreground px-4 py-3 flex items-center justify-between gap-3 cursor-pointer active:neo-shadow-pressed disabled:opacity-70 animate-slide-up"
      >
        <span className="flex items-center gap-2 min-w-0">
          <RotateCcw size={16} strokeWidth={3} className="shrink-0" />
          <span className="font-heading font-bold text-sm uppercase tracking-wide truncate">
            Rematch lobby is open — join the crew
          </span>
        </span>
        <ArrowRight size={16} strokeWidth={3} className="shrink-0" />
      </button>
    </div>
  );
}

function ArenaHeader({
  room,
  onLeave,
  leaving,
  showShare,
}: {
  room: Room;
  onLeave: () => void;
  leaving: boolean;
  showShare: boolean;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const isLobby = room.phase === "lobby";
  const handleShare = async () => {
    const res = await shareArenaLink(room.code);
    if (res === "copied") toast.success("Link copied");
    if (res === "failed") toast.error("Could not share link");
  };
  const phaseLabel = phaseDisplayLabel(room.phase);
  const roundLabel =
    room.phase === "question" || room.phase === "reveal"
      ? `R${room.currentRound + 1}/${room.config.rounds}`
      : room.phase === "round_break"
        ? `R${room.currentRound + 1} done`
        : null;

  return (
    <div className="sticky top-0 z-30 bg-background border-b-[3px] border-border">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          className="neo-border neo-shadow rounded-lg px-3 py-2 bg-background cursor-pointer active:neo-shadow-pressed inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <LogOut size={14} strokeWidth={3} />
          <span className="text-[10px] font-heading font-bold uppercase">Leave</span>
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="font-mono font-bold text-base tracking-[0.3em]">
            {room.code}
          </p>
          <p className="text-[10px] font-heading uppercase text-muted-foreground">
            {arenaModeLabel(room.mode)} · {phaseLabel}
            {roundLabel ? ` · ${roundLabel}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLobby && (
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              aria-label="How Challenge Arena works"
              className="neo-border neo-shadow rounded-lg w-9 h-9 bg-background cursor-pointer active:neo-shadow-pressed inline-flex items-center justify-center"
            >
              <HelpCircle size={16} strokeWidth={3} />
            </button>
          )}
          {showShare ? (
            <button
              type="button"
              onClick={handleShare}
              className="neo-border neo-shadow rounded-lg px-3 py-2 bg-electric-blue text-electric-blue-foreground cursor-pointer active:neo-shadow-pressed inline-flex items-center gap-1.5"
            >
              <Share2 size={14} strokeWidth={3} />
              <span className="text-[10px] font-heading font-bold uppercase">Share</span>
            </button>
          ) : (
            <div className="w-[68px]" />
          )}
        </div>
      </div>
      {showHelp && <ArenaHelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function ArenaHelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How Challenge Arena works"
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <NeoCard shadow="lg" className="relative py-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="absolute top-3 right-3 neo-border neo-shadow rounded-full w-8 h-8 bg-background cursor-pointer active:neo-shadow-pressed inline-flex items-center justify-center"
          >
            <X size={14} strokeWidth={3} />
          </button>
          <div className="pr-8">
            <NeoBadge color="primary" rotated size="md" className="text-base">
              How the Arena works
            </NeoBadge>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm leading-snug">
            <li className="flex items-start gap-2">
              <span className="neo-border rounded-full w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold text-[11px] bg-card">
                ▶
              </span>
              <span>
                <span className="font-heading font-bold">Rounds of rapid-fire questions.</span>{" "}
                Each round runs a single subject back-to-back.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="neo-border rounded-full w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold text-[11px] bg-card">
                ☰
              </span>
              <span>
                <span className="font-heading font-bold">The host picks the format.</span>{" "}
                Rounds and subjects are chosen when the arena is created — see the next one on the break screen.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="neo-border rounded-full w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold text-[11px] bg-card">
                ☝︎
              </span>
              <span>
                <span className="font-heading font-bold">Tap to answer.</span>{" "}
                Your pick locks in the moment you tap — there's no confirm button.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="neo-border rounded-full w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold text-[11px] bg-card">
                ⚡
              </span>
              <span>
                <span className="font-heading font-bold">Fastest correct scores most.</span>{" "}
                Wrong or missed answers score 0.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="neo-border rounded-full w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold text-[11px] bg-card">
                ✓
              </span>
              <span>
                <span className="font-heading font-bold">Ready up to start.</span>{" "}
                The host kicks it off once everyone in the lobby is ready.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="neo-border rounded-full w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold text-[11px] bg-card">
                ↩
              </span>
              <span>
                <span className="font-heading font-bold">Leave anytime.</span>{" "}
                You can drop out from the header — the rest of the room keeps playing.
              </span>
            </li>
          </ul>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full neo-border neo-shadow rounded-lg py-2.5 bg-primary text-primary-foreground font-heading font-bold text-sm uppercase cursor-pointer active:neo-shadow-pressed"
          >
            Got it
          </button>
        </NeoCard>
      </div>
    </div>
  );
}

function phaseDisplayLabel(phase: Phase) {
  switch (phase) {
    case "lobby":
      return "Lobby";
    case "countdown":
      return "Starting";
    case "question":
      return "Question";
    case "reveal":
      return "Reveal";
    case "round_break":
      return "Round break";
    case "final":
      return "Final";
    case "abandoned":
      return "Ended";
  }
}

// ───────────────────────── LOBBY ─────────────────────────

export function LobbyView({
  room,
  userId,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
}) {
  const setReady = useMutation(api.challengeArenas.setReady);
  const setTeam = useMutation(api.challengeArenas.setTeam);
  const startMut = useMutation(api.challengeArenas.start);
  const tick = useTick(500);

  const me = userId ? room.players.find((p) => p.userId === userId) : null;
  const active = room.players.filter((p) => !p.left);
  const isHost = !!userId && room.hostId === userId;
  const capacity = arenaModeCapacity(room.mode);
  const allReady = active.length >= 2 && active.every((p) => p.ready);
  const teamCounts = useMemo(() => countTeams(active), [active]);
  const teamsValid =
    room.mode !== "2v2"
      ? true
      : teamCounts.A >= 1 &&
        teamCounts.B >= 1 &&
        teamCounts.A <= 2 &&
        teamCounts.B <= 2 &&
        active.every((p) => p.team === "A" || p.team === "B");

  const canStartNormal = isHost && active.length >= 2 && allReady && teamsValid;
  const forceAvailable =
    isHost &&
    active.length >= 2 &&
    teamsValid &&
    tick >= room.forceStartAvailableAt;
  const blockedReasons = startBlockedReasons({
    active,
    allReady,
    teamsValid,
    mode: room.mode,
  });

  const handleReady = async () => {
    if (!me) return;
    try {
      await setReady({ arenaId: room.arenaId, ready: !me.ready });
    } catch (e) {
      toast.error(friendlyError(e, "Could not update ready"));
    }
  };

  const handleTeam = async (team: "A" | "B") => {
    try {
      await setTeam({ arenaId: room.arenaId, team });
    } catch (e) {
      toast.error(friendlyError(e, "Could not set team"));
    }
  };

  const handleStart = async (force = false) => {
    try {
      await startMut({ arenaId: room.arenaId, force });
    } catch (e) {
      toast.error(friendlyError(e, "Could not start"));
    }
  };

  const handleShare = async () => {
    const res = await shareArenaLink(room.code);
    if (res === "copied") toast.success("Link copied");
    if (res === "failed") toast.error("Could not share link");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildArenaUrl(room.code));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  // Desktop splits the lobby into two columns — room info (code · teams ·
  // players) on the left, status + controls on the right — so the room fits
  // common laptop heights without the controls falling below the fold, even
  // at FFA-5 capacity. On mobile the grid collapses to one column whose child
  // order (code → teams → roster → waiting → controls) and 1.25rem rhythm are
  // identical to the original stack.
  return (
    <div className="md:grid md:grid-cols-2 md:gap-5 md:items-start">
      <div className="space-y-5">
        <NeoCard shadow="lg" className="text-center py-5">
          <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
            Arena code
          </p>
          <p className="font-mono font-bold text-4xl tracking-[0.4em]">{room.code}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {active.length}/{capacity} joined · {arenaModeLabel(room.mode)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <NeoButton variant="blue" size="md" onClick={handleShare}>
              <Share2 size={14} strokeWidth={3} />
              Share
            </NeoButton>
            <NeoButton variant="secondary" size="md" onClick={handleCopy}>
              <Copy size={14} strokeWidth={3} />
              Copy link
            </NeoButton>
          </div>
        </NeoCard>

        {room.mode === "2v2" && (
          <TeamPicker
            me={me}
            active={active}
            teamCounts={teamCounts}
            onPick={handleTeam}
          />
        )}

        <Roster
          room={room}
          userId={userId}
          capacity={capacity}
        />
      </div>

      <div className="space-y-5 mt-5 md:mt-0">
        {!isHost && (
          <NeoCard className="text-center">
            <p className="text-xs text-muted-foreground">
              Waiting for the host to start. Mark yourself ready when you&apos;re good
              to go.
            </p>
          </NeoCard>
        )}

        {isHost && blockedReasons.length > 0 && (
          <NeoCard color="default" className="text-xs">
            <p className="font-heading font-bold uppercase mb-1.5">
              Waiting on
            </p>
            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
              {blockedReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </NeoCard>
        )}

        <div className="space-y-2.5">
          <NeoButton
            variant={me?.ready ? "success" : "primary"}
            size="full"
            onClick={handleReady}
          >
            {me?.ready ? (
              <>
                <Check size={16} strokeWidth={3} /> Ready
              </>
            ) : (
              "Mark me ready"
            )}
          </NeoButton>

          {isHost && (
            <NeoButton
              variant="primary"
              size="full"
              disabled={!canStartNormal}
              onClick={() => void handleStart(false)}
            >
              Start arena
            </NeoButton>
          )}

          {isHost && !canStartNormal && (
            <NeoButton
              variant={forceAvailable ? "danger" : "ghost"}
              size="full"
              disabled={!forceAvailable}
              onClick={() => void handleStart(true)}
            >
              {forceAvailable
                ? "Force start (drops unready)"
                : `Force start available in ${formatCountdown(
                    Math.max(0, room.forceStartAvailableAt - tick),
                    FORCE_START_GRACE_LABEL_MS,
                  )}`}
            </NeoButton>
          )}
        </div>
      </div>
    </div>
  );
}

function countTeams(players: RoomPlayer[]) {
  const counts = { A: 0, B: 0, none: 0 };
  for (const p of players) {
    if (p.team === "A") counts.A += 1;
    else if (p.team === "B") counts.B += 1;
    else counts.none += 1;
  }
  return counts;
}

function startBlockedReasons({
  active,
  allReady,
  teamsValid,
  mode,
}: {
  active: RoomPlayer[];
  allReady: boolean;
  teamsValid: boolean;
  mode: string;
}) {
  const reasons: string[] = [];
  if (active.length < 2) reasons.push("At least 2 players need to be in the lobby");
  if (mode === "2v2" && !teamsValid) {
    reasons.push("Each team needs at least one player (cap 2)");
  }
  if (active.length >= 2) {
    const unready = active.filter((p) => !p.ready).map((p) => p.nameSnapshot);
    if (unready.length > 0) {
      reasons.push(`Unready: ${unready.join(", ")}`);
    }
  }
  if (active.length >= 2 && allReady && teamsValid) return [];
  return reasons;
}

function TeamPicker({
  me,
  active,
  teamCounts,
  onPick,
}: {
  me: RoomPlayer | null;
  active: RoomPlayer[];
  teamCounts: { A: number; B: number; none: number };
  onPick: (team: "A" | "B") => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-heading font-bold uppercase mb-2">Teams</p>
      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((team) => {
          const members = active.filter((p) => p.team === team);
          const isMine = me?.team === team;
          const full = members.length >= 2 && !isMine;
          return (
            <NeoCard
              key={team}
              color={isMine ? "primary" : "default"}
              onClick={full ? undefined : () => onPick(team)}
              className={`py-3 ${full ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-heading font-bold text-sm">Team {team}</p>
                <NeoBadge
                  color={isMine ? "accent" : "muted"}
                  size="sm"
                >
                  {teamCounts[team]}/2
                </NeoBadge>
              </div>
              <div className="space-y-0.5">
                {members.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Empty</p>
                )}
                {members.map((m) => (
                  <p
                    key={m.userId}
                    className="text-[11px] font-mono truncate"
                  >
                    @{m.nameSnapshot}
                  </p>
                ))}
              </div>
            </NeoCard>
          );
        })}
      </div>
    </div>
  );
}

function Roster({
  room,
  userId,
  capacity,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
  capacity: number;
}) {
  const active = room.players.filter((p) => !p.left);
  const slotsToFill = Math.max(0, capacity - active.length);
  return (
    <div>
      <p className="text-[11px] font-heading font-bold uppercase mb-2 flex items-center gap-1.5">
        <Users size={12} strokeWidth={3} /> Players
      </p>
      <div className="space-y-1.5">
        {active.map((p) => (
          <PlayerRow
            key={p.userId}
            player={p}
            isMe={!!userId && p.userId === userId}
          />
        ))}
        {Array.from({ length: slotsToFill }).map((_, i) => (
          <NeoCard
            key={`empty-${i}`}
            className="py-2.5 text-xs text-muted-foreground"
          >
            <span className="font-heading uppercase">Waiting for player…</span>
          </NeoCard>
        ))}
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  isMe,
}: {
  player: RoomPlayer;
  isMe: boolean;
}) {
  return (
    <NeoCard color={isMe ? "primary" : "default"} className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {player.isHost && (
            <Crown size={14} strokeWidth={3} className="shrink-0" />
          )}
          <span className="font-heading font-bold text-sm truncate">
            {player.nameSnapshot}
            {isMe && " (you)"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {player.team && (
            <NeoBadge color="blue" size="sm">
              <Shield size={10} strokeWidth={3} /> {player.team}
            </NeoBadge>
          )}
          <NeoBadge color={player.ready ? "success" : "muted"} size="sm">
            {player.ready ? "Ready" : "Idle"}
          </NeoBadge>
        </div>
      </div>
    </NeoCard>
  );
}

// ───────────────────────── COUNTDOWN ─────────────────────────

export function CountdownView({ room }: { room: Room }) {
  const anchor = usePhaseAnchor(`${room.arenaId}:countdown`);
  const tick = useTick(120);
  const elapsed = anchor ? Math.max(0, tick - anchor) : 0;
  const remaining = Math.max(0, COUNTDOWN_MS - elapsed);
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const firstCategory = room.config.categories[0] ?? "football_quiz";

  return (
    <div className="space-y-4 pt-6">
      <NeoCard shadow="lg" className="text-center py-10">
        <p className="text-xs font-heading uppercase text-muted-foreground mb-3">
          Get ready
        </p>
        <p className="font-mono font-bold text-7xl">{seconds}</p>
        <p className="text-xs font-heading uppercase text-muted-foreground mt-4">
          Round 1 / {room.config.rounds}
        </p>
        <NeoBadge color="primary" rotated size="md" className="mt-2 text-base">
          {arenaCategoryEmoji(firstCategory)} {arenaCategoryLabel(firstCategory)}
        </NeoBadge>
      </NeoCard>
    </div>
  );
}

// ───────────────────────── QUESTION ─────────────────────────

function QuestionView({
  room,
  userId,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
}) {
  const submitAnswer = useMutation(api.challengeArenas.submitAnswer);
  const offset = useClockOffset(room.timer?.serverNow ?? null);
  const tick = useTick(150);

  const question = room.currentQuestion;
  const timer = room.timer;
  const me = userId ? room.players.find((p) => p.userId === userId) : null;
  const myAnswered = room.myCurrentAnswer?.answer ?? null;
  const [pending, setPending] = useState<string | null>(null);
  const [logoGuess, setLogoGuess] = useState("");
  const [logoFeedback, setLogoFeedback] = useState<"wrong" | "close" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Reset local pending selection when the question changes.
  const qKey = `${room.currentRound}:${room.currentQuestionIndex}`;
  const lastKey = useRef(qKey);
  useEffect(() => {
    if (lastKey.current !== qKey) {
      lastKey.current = qKey;
      setPending(null);
      setLogoGuess("");
      setLogoFeedback(null);
      setSubmitting(false);
    }
  }, [qKey]);

  if (!question || !timer || !timer.questionStartedAt) {
    return (
      <NeoCard className="text-center py-8">
        <p className="font-heading font-bold animate-pulse">Loading question…</p>
      </NeoCard>
    );
  }

  const serverNow = tick - offset;
  const elapsed = Math.max(0, serverNow - timer.questionStartedAt);
  const remainingMs = Math.max(0, timer.questionWindowMs - elapsed);
  const pct = Math.max(0, Math.min(1, remainingMs / timer.questionWindowMs));
  const seconds = Math.ceil(remainingMs / 1000);

  const isLogoText = question.kind === "logo_text";
  const isCameFirst =
    question.kind === "which_came_first" || question.category === "which_came_first";
  const isLogo = !!question.imageUrl;
  const locked = myAnswered !== null;
  const selected = pending ?? myAnswered;
  const activeCount = room.players.filter((p) => !p.left).length;
  const options =
    "options" in question && Array.isArray(question.options) ? question.options : [];

  const handleSelect = async (opt: string) => {
    if (locked || submitting) return;
    setPending(opt);
    setSubmitting(true);
    try {
      await submitAnswer({ arenaId: room.arenaId, answer: opt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (!/already answered/i.test(msg)) {
        toast.error(friendlyError(e, "Couldn’t submit your answer."));
        setPending(null);
        setSubmitting(false);
      }
    }
  };

  const handleLogoSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const guess = logoGuess.trim();
    if (locked || submitting || !guess) return;
    setSubmitting(true);
    setLogoFeedback(null);
    try {
      const res = await submitAnswer({ arenaId: room.arenaId, answer: guess });
      if ("result" in res && res.result === "wrong") {
        setLogoFeedback(res.close ? "close" : "wrong");
        setLogoGuess("");
        setSubmitting(false);
        // Keep the keyboard up and let the player retype immediately.
        requestAnimationFrame(() => logoInputRef.current?.focus());
        return;
      }
      setPending(guess);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (!/already answered/i.test(msg)) {
        toast.error(friendlyError(e, "Couldn’t submit your answer."));
        setSubmitting(false);
      }
    }
  };

  const letters = ["A", "B", "C", "D"];

  return (
    <div className="space-y-4">
      {/* Server-clocked timer bar */}
      <div className="neo-border rounded-lg bg-card overflow-hidden h-3 relative">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${
            pct < 0.25 ? "bg-destructive" : pct < 0.5 ? "bg-accent" : "bg-success"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-heading font-bold uppercase">
          {arenaCategoryEmoji(question.category)}{" "}
          {arenaCategoryLabel(question.category)}
        </p>
        <p className="font-mono font-bold text-sm inline-flex items-center gap-1">
          <Clock size={12} strokeWidth={3} />
          {seconds}s
        </p>
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono text-muted-foreground">
          Q {room.currentQuestionIndex + 1}/{room.config.perRound} ·
          R {room.currentRound + 1}/{room.config.rounds}
        </span>
        <span className="font-mono">
          {me?.nameSnapshot ?? "You"}:{" "}
          <span className="font-bold">{me?.totalScore ?? 0}</span>
        </span>
      </div>

      {isLogoText ? (
        <NeoCard shadow="lg" className="text-center">
          {question.imageUrl && (
            <QuestionImage imageUrl={question.imageUrl} alt="Logo quiz image" />
          )}
        </NeoCard>
      ) : isCameFirst ? (
        <NeoCard shadow="lg" className="text-center">
          <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
            Which came first?
          </p>
          <p className="font-heading font-bold text-lg leading-tight">
            {question.question}
          </p>
        </NeoCard>
      ) : (
        <NeoCard shadow="lg">
          {isLogo && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={question.imageUrl}
                alt={`Image for: ${question.question}`}
              />
            </div>
          )}
          <p className="font-heading font-bold text-lg leading-tight">
            {question.question}
          </p>
        </NeoCard>
      )}

      {isLogoText ? (
        <form onSubmit={(event) => void handleLogoSubmit(event)} className="space-y-2">
          <div className="flex gap-2">
            <NeoInput
              ref={logoInputRef}
              value={locked ? (myAnswered ?? "") : logoGuess}
              onChange={(event) => {
                setLogoGuess(event.target.value);
                if (logoFeedback) setLogoFeedback(null);
              }}
              disabled={locked || submitting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="go"
              autoFocus
              placeholder="Name the company"
              aria-label="Guess the company name"
              className="min-w-0 flex-1 py-3 font-heading font-bold"
            />
            <NeoButton
              type="submit"
              variant="primary"
              size="md"
              disabled={locked || submitting || !logoGuess.trim()}
              className="shrink-0 px-4 py-3 disabled:opacity-60"
              aria-label="Submit guess"
            >
              <ArrowRight size={18} strokeWidth={3} />
            </NeoButton>
          </div>
          <div className="min-h-[18px] text-center text-[11px] font-heading font-bold uppercase tracking-wide">
            {locked ? (
              <span className="text-success">Got it!</span>
            ) : logoFeedback === "close" ? (
              <span className="text-accent">So close — one letter off!</span>
            ) : logoFeedback === "wrong" ? (
              <span className="text-destructive">Nope — try again</span>
            ) : (
              <span className="text-muted-foreground normal-case">
                Type your guess and hit enter — keep trying.
              </span>
            )}
          </div>
        </form>
      ) : (
        <div
          className={
            isCameFirst ? "grid grid-cols-1 gap-3" : "space-y-2.5"
          }
        >
          {options.map((opt, idx) => {
            const isPicked = selected === opt;
            return (
              <button
                key={opt}
                type="button"
                disabled={locked || submitting}
                onClick={() => void handleSelect(opt)}
                className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left cursor-pointer transition-all ${
                  locked && isPicked
                    ? "bg-success text-success-foreground"
                    : isPicked
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground"
                } ${!locked ? "active:neo-shadow-pressed" : ""}`}
              >
                {!isCameFirst && (
                  <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
                    {letters[idx]}
                  </span>
                )}
                <span className="font-heading font-bold text-sm">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {locked ? (
        <p className="text-center text-[11px] text-muted-foreground">
          {activeCount > 1
            ? "Locked in — waiting for the rest of the room…"
            : "Locked in — waiting for reveal…"}
        </p>
      ) : isLogoText ? null : (
        <p className="text-center text-[11px] text-muted-foreground">
          Tap an option to lock it in.
        </p>
      )}
    </div>
  );
}

// ───────────────────────── REVEAL ─────────────────────────

function RevealView({
  room,
  userId,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
}) {
  const question = room.currentQuestion;
  if (!question) {
    return (
      <NeoCard className="text-center py-8">
        <p className="font-heading font-bold animate-pulse">Loading reveal…</p>
      </NeoCard>
    );
  }

  const me = userId ? room.players.find((p) => p.userId === userId) : null;
  const myAnswer = room.revealAnswers.find((a) => a.userId === userId);
  const isLogoText = question.kind === "logo_text";
  const questionText =
    "question" in question && typeof question.question === "string"
      ? question.question
      : "Name this logo.";
  const correctAnswer =
    "correctAnswer" in question && typeof question.correctAnswer === "string"
      ? question.correctAnswer
      : null;
  const sorted = [...room.revealAnswers].sort(
    (a, b) => b.points - a.points || a.serverTimeMs - b.serverTimeMs,
  );

  const verdict = !myAnswer
    ? { label: "Missed", color: "muted" as const }
    : myAnswer.correct
      ? { label: `+${myAnswer.points}`, color: "success" as const }
      : { label: "Wrong", color: "destructive" as const };

  return (
    <div className="space-y-4">
      <NeoCard shadow="lg">
        <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
          {arenaCategoryEmoji(question.category)}{" "}
          {arenaCategoryLabel(question.category)} · Q
          {room.currentQuestionIndex + 1}/{room.config.perRound}
        </p>
        {question.imageUrl && (
          <div className="mb-3 mt-2">
            <QuestionImage
              imageUrl={question.imageUrl}
              alt={isLogoText ? "Logo quiz image" : questionText}
            />
          </div>
        )}
        {!isLogoText && (
          <p className="font-heading font-bold text-base leading-snug">
            {questionText}
          </p>
        )}
        {correctAnswer && (
          <div className="mt-3 neo-border rounded-lg bg-success text-success-foreground px-3 py-2">
            <p className="text-[10px] font-heading uppercase mb-0.5">Correct</p>
            <p className="font-heading font-bold text-sm">{correctAnswer}</p>
          </div>
        )}
      </NeoCard>

      <NeoCard color={verdict.color === "success" ? "success" : "default"}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-heading uppercase">Your answer</p>
            <p className="font-heading font-bold text-sm">
              {myAnswer?.answer ?? "—"}
            </p>
            {me && (
              <p className="text-[10px] font-mono mt-1 opacity-80">
                total {me.totalScore}
              </p>
            )}
          </div>
          <NeoBadge color={verdict.color} size="md">
            {verdict.label}
          </NeoBadge>
        </div>
      </NeoCard>

      <div>
        <p className="text-[11px] font-heading font-bold uppercase mb-2">
          Round answers
        </p>
        <div className="space-y-1.5">
          {sorted.map((row) => {
            const player = room.players.find((p) => p.userId === row.userId);
            const isMe = !!userId && row.userId === userId;
            return (
              <NeoCard
                key={String(row.userId)}
                color={isMe ? "primary" : "default"}
                className="py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-xs truncate">
                      {player?.nameSnapshot ?? "Player"}
                      {isMe && " (you)"}
                    </p>
                    <p className="text-[10px] font-mono truncate opacity-80">
                      {row.answer || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {row.correct ? (
                      <NeoBadge color="success" size="sm">
                        +{row.points}
                      </NeoBadge>
                    ) : (
                      <NeoBadge color="destructive" size="sm">
                        <X size={10} strokeWidth={3} />
                      </NeoBadge>
                    )}
                  </div>
                </div>
              </NeoCard>
            );
          })}
          {sorted.length === 0 && (
            <NeoCard className="text-center text-xs text-muted-foreground py-3">
              No one answered in time
            </NeoCard>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Next up in a moment…
      </p>
    </div>
  );
}

// ───────────────────────── ROUND BREAK ─────────────────────────

export function RoundBreakView({
  room,
  userId,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
}) {
  const readyNextRound = useMutation(api.challengeArenas.readyNextRound);
  const anchor = usePhaseAnchor(
    `${room.arenaId}:break:${room.currentRound}`,
  );
  const tick = useTick(250);
  const elapsed = anchor ? Math.max(0, tick - anchor) : 0;
  const remaining = Math.max(0, ROUND_BREAK_MS - elapsed);
  const seconds = Math.ceil(remaining / 1000);

  const me = userId ? room.players.find((p) => p.userId === userId) : null;
  const isLastRound = room.currentRound + 1 >= room.config.rounds;
  const nextCategory = isLastRound
    ? null
    : room.config.categories[room.currentRound + 1] ?? null;

  const handleReady = async () => {
    try {
      await readyNextRound({ arenaId: room.arenaId });
    } catch (e) {
      toast.error(friendlyError(e, "Could not ready"));
    }
  };

  return (
    <div className="space-y-5">
      <NeoCard shadow="lg" className="text-center py-5">
        <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
          Round {room.currentRound + 1} complete
        </p>
        <NeoBadge color="primary" rotated size="md" className="text-base">
          {arenaCategoryEmoji(
            room.config.categories[room.currentRound] ?? "football_quiz",
          )}{" "}
          {arenaCategoryLabel(
            room.config.categories[room.currentRound] ?? "football_quiz",
          )}
        </NeoBadge>
      </NeoCard>

      <LeaderboardCard
        room={room}
        rows={room.roundLeaderboard ?? []}
        title="Round leaderboard"
      />

      {nextCategory && (
        <NeoCard color="blue" className="text-center">
          <p className="text-[10px] font-heading uppercase opacity-80 mb-1">
            Next round
          </p>
          <p className="font-heading font-bold text-base">
            {arenaCategoryEmoji(nextCategory)} {arenaCategoryLabel(nextCategory)}
          </p>
        </NeoCard>
      )}

      <NeoButton
        variant={me?.ready ? "success" : "primary"}
        size="full"
        disabled={!me || me.ready}
        onClick={() => void handleReady()}
      >
        {me?.ready ? (
          <>
            <Check size={16} strokeWidth={3} /> Ready
          </>
        ) : (
          <>
            <ChevronRight size={16} strokeWidth={3} /> Ready for next round
          </>
        )}
      </NeoButton>

      <p className="text-center text-[11px] text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
        <Hourglass size={12} strokeWidth={3} />
        Auto-advance in {seconds}s — or once everyone&apos;s ready
      </p>
    </div>
  );
}

// ───────────────────────── FINAL ─────────────────────────

export function FinalView({
  room,
  userId,
  rematching,
  onRematch,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
  rematching: boolean;
  onRematch: () => void;
}) {
  const summary = useQuery(api.challengeArenas.getArenaSummary, {
    arenaId: room.arenaId,
  });

  if (summary === undefined) {
    return (
      <NeoCard shadow="lg" className="text-center py-10">
        <Trophy size={24} strokeWidth={2.5} className="mx-auto mb-2 opacity-60" />
        <p className="font-heading font-bold text-sm animate-pulse">
          Tallying the final podium…
        </p>
      </NeoCard>
    );
  }

  if (summary === null) {
    return (
      <FinalUnavailable
        room={room}
        rematching={rematching}
        onRematch={onRematch}
      />
    );
  }

  return (
    <FinalSummaryView
      room={room}
      summary={summary}
      userId={userId}
      rematching={rematching}
      onRematch={onRematch}
    />
  );
}

function FinalUnavailable({
  room,
  rematching,
  onRematch,
}: {
  room: Room;
  rematching: boolean;
  onRematch: () => void;
}) {
  return (
    <div className="space-y-5">
      <NeoCard shadow="lg" className="text-center py-8">
        <Trophy size={24} strokeWidth={2.5} className="mx-auto mb-3 opacity-60" />
        <p className="font-heading font-bold text-base">
          Final results unavailable
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
          We couldn&apos;t load the podium for this arena yet. Try again from the
          rematch — or head back and rejoin.
        </p>
      </NeoCard>
      <div className="space-y-2.5">
        <NeoButton
          variant="primary"
          size="full"
          disabled={rematching}
          onClick={onRematch}
        >
          <RotateCcw size={16} strokeWidth={3} />
          {room.rematchArenaCode
            ? "Join rematch lobby"
            : rematching
              ? "Building lobby…"
              : "Rematch — same crew"}
        </NeoButton>
        <NeoButton
          variant="secondary"
          size="full"
          onClick={() => {
            void shareArenaLink(room.code).then((res) => {
              if (res === "copied") toast.success("Link copied");
              if (res === "failed") toast.error("Could not share");
            });
          }}
        >
          <Share2 size={16} strokeWidth={3} />
          Share arena
        </NeoButton>
      </div>
    </div>
  );
}

function formatSummaryNames(
  identities: Array<{ nameSnapshot: string }> | undefined,
  fallback: string,
) {
  if (!identities || identities.length === 0) return fallback;
  if (identities.length === 1) return identities[0].nameSnapshot;
  if (identities.length === 2) {
    return `${identities[0].nameSnapshot} & ${identities[1].nameSnapshot}`;
  }
  return `${identities
    .slice(0, -1)
    .map((p) => p.nameSnapshot)
    .join(", ")} & ${identities[identities.length - 1].nameSnapshot}`;
}

function formatAccuracy(stats: ArenaSummaryPlayerStats | undefined) {
  if (!stats || stats.questionsAnswered === 0) return "—";
  return `${Math.round(stats.accuracy * 100)}%`;
}

function formatAvgCorrect(stats: ArenaSummaryPlayerStats | undefined) {
  if (!stats || stats.avgCorrectMs === null) return "—";
  const seconds = stats.avgCorrectMs / 1000;
  if (seconds >= 10) return `${seconds.toFixed(1)}s`;
  return `${seconds.toFixed(2)}s`;
}

function formatAvgMsCompact(avgMs: number | null | undefined) {
  if (avgMs === null || avgMs === undefined) return "—";
  const seconds = avgMs / 1000;
  if (seconds >= 10) return `${seconds.toFixed(1)}s`;
  return `${seconds.toFixed(2)}s`;
}

function FinalSummaryView({
  room,
  summary,
  userId,
  rematching,
  onRematch,
}: {
  room: Room;
  summary: ArenaSummary;
  userId: Id<"users"> | undefined;
  rematching: boolean;
  onRematch: () => void;
}) {
  const playerStatsById = useMemo(() => {
    const map = new Map<Id<"users">, ArenaSummaryPlayerStats>();
    for (const player of summary.players) {
      map.set(player.userId, player);
    }
    return map;
  }, [summary.players]);

  const topPlayer = summary.rankings.players[0] ?? null;
  const topTeam = summary.rankings.teams[0] ?? null;

  const meAsPlayer = userId
    ? summary.rankings.players.find((row) => row.userId === userId) ?? null
    : null;
  const myTeamRow =
    summary.isTeamMode && meAsPlayer
      ? summary.rankings.teams.find((t) =>
          t.playerIds.some((id) => id === userId),
        ) ?? null
      : null;

  const handleShareCard = async () => {
    const code = room.code;
    let text: string;
    if (summary.isTeamMode && topTeam) {
      const myTeamScore = myTeamRow?.totalScore ?? 0;
      text = `VerveQ arena ${code} — ${topTeam.label} wins (${topTeam.totalScore}). My team scored ${myTeamScore}. Rematch?`;
    } else if (topPlayer) {
      const myScore = meAsPlayer?.totalScore ?? 0;
      text = `VerveQ arena ${code} — ${topPlayer.nameSnapshot} wins with ${topPlayer.totalScore}. I scored ${myScore}. Rematch?`;
    } else {
      text = `VerveQ arena ${code} — rematch?`;
    }
    const res = await shareArenaLink(code, text);
    if (res === "shared") toast.success("Result shared");
    if (res === "copied") toast.success("Result copied");
    if (res === "failed") toast.error("Could not share");
  };

  const modeLabel = arenaModeVerboseLabel(summary.mode);
  const subTitle = `${room.config.rounds}R×${room.config.perRound}Q · ${summary.totalQuestions}Q`;

  return (
    <div className="space-y-5">
      <FinalHero
        summary={summary}
        topPlayer={topPlayer}
        topTeam={topTeam}
        playerStatsById={playerStatsById}
      />

      <FinalAwards summary={summary} />

      <FinalStandingsCard
        summary={summary}
        userId={userId}
        playerStatsById={playerStatsById}
        modeLabel={modeLabel}
        subTitle={subTitle}
      />

      <div className="space-y-2.5">
        <NeoButton
          variant="primary"
          size="full"
          disabled={rematching}
          onClick={onRematch}
        >
          <RotateCcw size={16} strokeWidth={3} />
          {room.rematchArenaCode
            ? "Join rematch lobby"
            : rematching
              ? "Building lobby…"
              : "Rematch — same crew"}
        </NeoButton>
        <NeoButton variant="secondary" size="full" onClick={handleShareCard}>
          <Share2 size={16} strokeWidth={3} />
          Share result
        </NeoButton>
      </div>
    </div>
  );
}

function FinalHero({
  summary,
  topPlayer,
  topTeam,
  playerStatsById,
}: {
  summary: ArenaSummary;
  topPlayer: ArenaSummary["rankings"]["players"][number] | null;
  topTeam: ArenaSummary["rankings"]["teams"][number] | null;
  playerStatsById: Map<Id<"users">, ArenaSummaryPlayerStats>;
}) {
  if (summary.isTeamMode) {
    if (!topTeam) {
      return <FinalHeroEmpty />;
    }
    const memberNames = topTeam.playerIds
      .map((id) => playerStatsById.get(id)?.nameSnapshot ?? "Player")
      .join(" + ");
    return (
      <NeoCard
        color="primary"
        shadow="lg"
        className="text-center py-7 px-5"
      >
        <Trophy
          size={28}
          strokeWidth={2.5}
          className="mx-auto mb-2"
        />
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.3em] opacity-90">
          Winning team
        </p>
        <p className="font-heading font-bold text-3xl mt-1 leading-tight break-words">
          {topTeam.label}
        </p>
        <p className="font-mono font-bold text-5xl mt-3">
          {topTeam.totalScore}
        </p>
        <p className="text-[11px] font-mono mt-2 opacity-90">
          {memberNames}
        </p>
      </NeoCard>
    );
  }

  if (!topPlayer) {
    return <FinalHeroEmpty />;
  }
  return (
    <NeoCard
      color="primary"
      shadow="lg"
      className="text-center py-7 px-5"
    >
      <Trophy size={28} strokeWidth={2.5} className="mx-auto mb-2" />
      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.3em] opacity-90">
        Champion
      </p>
      <p className="font-heading font-bold text-3xl mt-1 leading-tight break-words">
        {topPlayer.nameSnapshot}
      </p>
      <p className="font-mono font-bold text-5xl mt-3">
        {topPlayer.totalScore}
      </p>
      <p className="text-[11px] font-mono mt-2 opacity-90">
        {summary.rankings.players.length} player
        {summary.rankings.players.length === 1 ? "" : "s"}
      </p>
    </NeoCard>
  );
}

function FinalHeroEmpty() {
  return (
    <NeoCard color="primary" shadow="lg" className="text-center py-7 px-5">
      <Trophy size={28} strokeWidth={2.5} className="mx-auto mb-2" />
      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.3em] opacity-90">
        Final
      </p>
      <p className="font-heading font-bold text-2xl mt-1">No score recorded</p>
    </NeoCard>
  );
}

function FinalAwards({ summary }: { summary: ArenaSummary }) {
  const fastestNames = formatSummaryNames(summary.superlatives.fastest, "—");
  const sharpshooterNames = formatSummaryNames(
    summary.superlatives.sharpshooter,
    "—",
  );
  const hotStreakNames = formatSummaryNames(summary.superlatives.hotStreak, "—");

  const fastestStat =
    summary.superlatives.fastest.length === 0
      ? "—"
      : formatAvgMsCompact(summary.superlatives.fastest[0].avgCorrectMs);
  const sharpshooterStat =
    summary.superlatives.sharpshooter.length === 0
      ? "—"
      : `${Math.round(summary.superlatives.sharpshooter[0].accuracy * 100)}%`;
  const hotStreakStat =
    summary.superlatives.hotStreak.length === 0
      ? "—"
      : `${summary.superlatives.hotStreak[0].longestStreak}🔥`;

  return (
    <div className="grid grid-cols-3 gap-2">
      <AwardChip
        color="success"
        label="Fastest"
        names={fastestNames}
        stat={fastestStat}
      />
      <AwardChip
        color="blue"
        label="Accuracy"
        names={sharpshooterNames}
        stat={sharpshooterStat}
      />
      <AwardChip
        color="pink"
        label="Hot Streak"
        names={hotStreakNames}
        stat={hotStreakStat}
      />
    </div>
  );
}

function AwardChip({
  color,
  label,
  names,
  stat,
}: {
  color: "success" | "blue" | "pink";
  label: string;
  names: string;
  stat: string;
}) {
  return (
    <NeoCard color={color} className="py-3 px-3 text-center">
      <p className="text-[9px] font-heading font-bold uppercase tracking-[0.2em] opacity-90">
        {label}
      </p>
      <p className="font-mono font-bold text-base mt-1 leading-tight">{stat}</p>
      <p
        className="text-[10px] font-heading font-bold mt-1 leading-tight break-words"
        title={names}
      >
        {names}
      </p>
    </NeoCard>
  );
}

function FinalStandingsCard({
  summary,
  userId,
  playerStatsById,
  modeLabel,
  subTitle,
}: {
  summary: ArenaSummary;
  userId: Id<"users"> | undefined;
  playerStatsById: Map<Id<"users">, ArenaSummaryPlayerStats>;
  modeLabel: string;
  subTitle: string;
}) {
  const topScore = summary.isTeamMode
    ? summary.rankings.teams[0]?.totalScore ?? null
    : summary.rankings.players[0]?.totalScore ?? null;

  return (
    <NeoCard className="py-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="font-heading font-bold uppercase text-sm tracking-wide">
          Final Standings
        </p>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">
          {modeLabel} · {subTitle}
        </p>
      </div>

      <StandingsHeader />

      <div className="space-y-1">
        {summary.isTeamMode
          ? renderTeamStandings(summary, userId, playerStatsById, topScore)
          : renderSoloStandings(summary, userId, playerStatsById, topScore)}
      </div>
    </NeoCard>
  );
}

function StandingsHeader() {
  return (
    <div className="grid grid-cols-[28px_1fr_56px_44px_56px] items-center gap-2 px-2 pb-1 mb-1 border-b-[2px] border-border">
      <span className="text-[9px] font-heading font-bold uppercase tracking-wide">
        #
      </span>
      <span className="text-[9px] font-heading font-bold uppercase tracking-wide">
        Player
      </span>
      <span className="text-[9px] font-heading font-bold uppercase tracking-wide text-right">
        Score
      </span>
      <span className="text-[9px] font-heading font-bold uppercase tracking-wide text-right">
        Acc
      </span>
      <span className="text-[9px] font-heading font-bold uppercase tracking-wide text-right">
        Avg
      </span>
    </div>
  );
}

function renderSoloStandings(
  summary: ArenaSummary,
  userId: Id<"users"> | undefined,
  playerStatsById: Map<Id<"users">, ArenaSummaryPlayerStats>,
  topScore: number | null,
) {
  return summary.rankings.players.map((row) => {
    const stats = playerStatsById.get(row.userId);
    const isMe = !!userId && row.userId === userId;
    const isWinner = topScore !== null && row.totalScore === topScore;
    return (
      <StandingsRow
        key={String(row.userId)}
        rankBadge={String(row.rank).padStart(2, "0")}
        rankColor="default"
        name={row.nameSnapshot}
        score={row.totalScore}
        acc={formatAccuracy(stats)}
        avg={formatAvgCorrect(stats)}
        isMe={isMe}
        isWinner={isWinner}
        left={row.left}
      />
    );
  });
}

function renderTeamStandings(
  summary: ArenaSummary,
  userId: Id<"users"> | undefined,
  playerStatsById: Map<Id<"users">, ArenaSummaryPlayerStats>,
  topTeamScore: number | null,
) {
  const rows: React.ReactNode[] = [];
  let playerCounter = 1;
  for (const team of summary.rankings.teams) {
    const isTopTeam =
      topTeamScore !== null && team.totalScore === topTeamScore;
    rows.push(
      <TeamHeaderRow
        key={`team-${team.id}`}
        teamMarker={`T-${team.id}`}
        label={team.label}
        score={team.totalScore}
        isWinner={isTopTeam}
      />,
    );
    const members = team.playerIds
      .map((id) => playerStatsById.get(id))
      .filter((p): p is ArenaSummaryPlayerStats => p !== undefined)
      .sort(
        (a, b) =>
          b.totalScore - a.totalScore ||
          a.nameSnapshot.localeCompare(b.nameSnapshot),
      );
    for (const member of members) {
      const isMe = !!userId && member.userId === userId;
      rows.push(
        <StandingsRow
          key={String(member.userId)}
          rankBadge={String(playerCounter).padStart(2, "0")}
          rankColor="default"
          name={member.nameSnapshot}
          score={member.totalScore}
          acc={formatAccuracy(member)}
          avg={formatAvgCorrect(member)}
          isMe={isMe}
          isWinner={false}
          left={member.left}
          indented
        />,
      );
      playerCounter += 1;
    }
  }
  return rows;
}

function TeamHeaderRow({
  teamMarker,
  label,
  score,
  isWinner,
}: {
  teamMarker: string;
  label: string;
  score: number;
  isWinner: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[36px_1fr_56px_44px_56px] items-center gap-2 px-2 py-2 rounded-md neo-border ${
        isWinner ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}
    >
      <span className="font-mono font-bold text-[10px] text-center neo-border rounded bg-background text-foreground px-1 py-0.5">
        {teamMarker}
      </span>
      <span className="font-heading font-bold text-sm truncate uppercase tracking-wide">
        {label}
      </span>
      <span className="font-mono font-bold text-sm text-right">{score}</span>
      <span className="font-mono text-[10px] text-right opacity-70">team</span>
      <span className="font-mono text-[10px] text-right opacity-70">·</span>
    </div>
  );
}

function StandingsRow({
  rankBadge,
  name,
  score,
  acc,
  avg,
  isMe,
  isWinner,
  left,
  indented,
}: {
  rankBadge: string;
  rankColor: "default";
  name: string;
  score: number;
  acc: string;
  avg: string;
  isMe: boolean;
  isWinner: boolean;
  left: boolean;
  indented?: boolean;
}) {
  const highlight = isWinner
    ? "bg-primary text-primary-foreground"
    : isMe
      ? "bg-accent text-accent-foreground"
      : "";
  return (
    <div
      className={`grid grid-cols-[28px_1fr_56px_44px_56px] items-center gap-2 px-2 py-2 rounded-md ${highlight} ${
        indented ? "pl-3" : ""
      }`}
    >
      <span className="font-mono font-bold text-[11px] text-center">
        {rankBadge}
      </span>
      <span className="font-heading font-bold text-sm truncate inline-flex items-center gap-1.5">
        <span className="truncate">{name}</span>
        {isMe && (
          <span className="text-[9px] font-mono uppercase opacity-70">
            you
          </span>
        )}
        {left && (
          <span className="text-[9px] font-mono uppercase opacity-70">
            left
          </span>
        )}
      </span>
      <span className="font-mono font-bold text-sm text-right">{score}</span>
      <span className="font-mono text-[11px] text-right">{acc}</span>
      <span className="font-mono text-[11px] text-right">{avg}</span>
    </div>
  );
}

function LeaderboardCard({
  room,
  rows,
  title,
}: {
  room: Room;
  rows: Array<{
    rank: number;
    id: string;
    label: string;
    score: number;
    playerIds: Array<Id<"users">>;
  }>;
  title: string;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-heading font-bold uppercase mb-2">
          {title}
        </p>
        <NeoCard className="text-center text-xs text-muted-foreground py-3">
          No scores yet
        </NeoCard>
      </div>
    );
  }
  const teamMode = room.mode === "2v2";
  return (
    <div>
      <p className="text-[11px] font-heading font-bold uppercase mb-2">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <NeoCard key={`${row.id}`} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-sm w-6 text-center">
                  #{row.rank}
                </span>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm truncate">
                    {row.label}
                  </p>
                  {teamMode && (
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      {row.playerIds
                        .map(
                          (id) =>
                            room.players.find((p) => p.userId === id)
                              ?.nameSnapshot ?? "?",
                        )
                        .join(" + ")}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono font-bold text-base">{row.score}</span>
            </div>
          </NeoCard>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── HELPERS ─────────────────────────

export function NotInRoom({
  title,
  detail,
  onBack,
  backLabel = "Back to Challenge",
}: {
  title: string;
  detail?: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center justify-center">
      <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
        <p className="font-heading font-bold text-lg mb-2">{title}</p>
        {detail && (
          <p className="text-xs text-muted-foreground mb-5 break-words">
            {detail}
          </p>
        )}
        <NeoButton
          variant="primary"
          size="full"
          onClick={onBack ?? (() => (window.location.pathname = "/challenge"))}
        >
          <ArrowRight size={14} strokeWidth={3} />
          {backLabel}
        </NeoButton>
      </NeoCard>
    </div>
  );
}

function formatCountdown(remainingMs: number, totalMs: number) {
  void totalMs;
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `${seconds}s`;
}
