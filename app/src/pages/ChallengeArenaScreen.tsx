import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
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
  buildArenaUrl,
  normalizeArenaCode,
  shareArenaLink,
  useClockOffset,
  usePhaseAnchor,
  useTick,
} from "@/lib/arena";

type Room = NonNullable<FunctionReturnType<typeof api.challengeArenas.getRoom>>;
type RoomPlayer = Room["players"][number];
type Phase = Room["phase"];

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
        setJoinError(e instanceof Error ? e.message : "Could not join arena");
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
          toast.error(e instanceof Error ? e.message : "Could not leave");
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
    setRematching(true);
    try {
      const result = await rematchMut({ arenaId: room.arenaId });
      toast.success("Rematch lobby ready");
      navigate(`/arena/${result.code}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rematch failed");
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

function LobbyView({
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
      toast.error(e instanceof Error ? e.message : "Could not update ready");
    }
  };

  const handleTeam = async (team: "A" | "B") => {
    try {
      await setTeam({ arenaId: room.arenaId, team });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set team");
    }
  };

  const handleStart = async (force = false) => {
    try {
      await startMut({ arenaId: room.arenaId, force });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
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

  return (
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

function CountdownView({ room }: { room: Room }) {
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
  const [submitting, setSubmitting] = useState(false);

  // Reset local pending selection when the question changes.
  const qKey = `${room.currentRound}:${room.currentQuestionIndex}`;
  const lastKey = useRef(qKey);
  useEffect(() => {
    if (lastKey.current !== qKey) {
      lastKey.current = qKey;
      setPending(null);
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

  const isCameFirst = question.category === "which_came_first";
  const isLogo = !!question.imageUrl;
  const locked = myAnswered !== null;
  const selected = pending ?? myAnswered;
  const activeCount = room.players.filter((p) => !p.left).length;

  const handleSelect = (opt: string) => {
    if (locked || submitting) return;
    setPending(opt);
  };

  const handleSubmit = async () => {
    if (!selected || locked || submitting) return;
    setSubmitting(true);
    try {
      await submitAnswer({ arenaId: room.arenaId, answer: selected });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (!/already answered/i.test(msg)) {
        toast.error(msg);
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

      {isCameFirst ? (
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

      <div
        className={
          isCameFirst ? "grid grid-cols-1 gap-3" : "space-y-2.5"
        }
      >
        {question.options.map((opt, idx) => {
          const isPicked = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={locked || submitting}
              onClick={() => handleSelect(opt)}
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

      <NeoButton
        variant="primary"
        size="full"
        disabled={!selected || locked || submitting}
        onClick={() => void handleSubmit()}
      >
        {locked
          ? "Locked in — wait for reveal"
          : submitting
            ? "Submitting…"
            : "Lock in answer"}
      </NeoButton>

      {locked && (
        <p className="text-center text-[11px] text-muted-foreground">
          {activeCount > 1
            ? "Waiting for the rest of the room…"
            : "Waiting for reveal…"}
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
            <QuestionImage imageUrl={question.imageUrl} alt={question.question} />
          </div>
        )}
        <p className="font-heading font-bold text-base leading-snug">
          {question.question}
        </p>
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

function RoundBreakView({
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
      toast.error(e instanceof Error ? e.message : "Could not ready");
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

function FinalView({
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
  const podium = room.finalPodium ?? [];
  const myRow = podium.find((row) =>
    row.playerIds.some((id) => id === userId),
  );

  const handleShareCard = async () => {
    const topLabel = podium[0]?.label ?? "Crew";
    const topScore = podium[0]?.score ?? 0;
    const myScore = myRow?.score ?? 0;
    const text = `VerveQ arena ${room.code} — winner ${topLabel} (${topScore}). I scored ${myScore}. Rematch?`;
    const res = await shareArenaLink(room.code, text);
    if (res === "copied") toast.success("Result copied");
    if (res === "failed") toast.error("Could not share");
  };

  return (
    <div className="space-y-5">
      <NeoCard shadow="lg" className="text-center py-6">
        <Trophy size={28} strokeWidth={2.5} className="mx-auto mb-2" />
        <NeoBadge color="primary" rotated size="md" className="text-base">
          Final
        </NeoBadge>
        <p className="text-xs text-muted-foreground mt-2">
          {arenaModeLabel(room.mode)} · {room.config.rounds} rounds
        </p>
      </NeoCard>

      <PodiumGrid podium={podium} userId={userId} />

      <LeaderboardCard room={room} rows={podium} title="Final ranking" />

      <div className="space-y-2.5">
        <NeoButton
          variant="primary"
          size="full"
          disabled={rematching}
          onClick={onRematch}
        >
          <RotateCcw size={16} strokeWidth={3} />
          {rematching ? "Building lobby…" : "Rematch — same crew"}
        </NeoButton>
        <NeoButton variant="secondary" size="full" onClick={handleShareCard}>
          <Share2 size={16} strokeWidth={3} />
          Share result
        </NeoButton>
      </div>
    </div>
  );
}

function PodiumGrid({
  podium,
  userId,
}: {
  podium: Array<{
    rank: number;
    id: string;
    label: string;
    score: number;
    playerIds: Array<Id<"users">>;
  }>;
  userId: Id<"users"> | undefined;
}) {
  if (podium.length === 0) return null;
  const top = podium.slice(0, 3);

  // First place spans full width on top, then 2nd / 3rd side-by-side.
  return (
    <div className="space-y-2">
      {top[0] && <PodiumCard row={top[0]} userId={userId} accent="primary" />}
      <div className="grid grid-cols-2 gap-2">
        {top[1] && <PodiumCard row={top[1]} userId={userId} accent="blue" />}
        {top[2] && <PodiumCard row={top[2]} userId={userId} accent="accent" />}
      </div>
    </div>
  );
}

function PodiumCard({
  row,
  userId,
  accent,
}: {
  row: {
    rank: number;
    label: string;
    score: number;
    playerIds: Array<Id<"users">>;
  };
  userId: Id<"users"> | undefined;
  accent: "primary" | "blue" | "accent";
}) {
  const isMine = !!userId && row.playerIds.some((id) => id === userId);
  return (
    <NeoCard color={accent} className="py-4 text-center">
      <p className="text-[10px] font-heading uppercase opacity-80">
        #{row.rank}
        {isMine ? " · you" : ""}
      </p>
      <p className="font-heading font-bold text-base truncate">{row.label}</p>
      <p className="font-mono font-bold text-2xl mt-1">{row.score}</p>
    </NeoCard>
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

function NotInRoom({
  title,
  detail,
  onBack,
}: {
  title: string;
  detail?: string;
  onBack?: () => void;
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
          Back to Challenge
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
