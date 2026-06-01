/**
 * Challenge Arena (multi-user) on the v2 shell — the "prototype layout".
 *
 * The in-game phases (question / reveal) render a centered, phone-width
 * answering column flanked by AMBIENT rails: roster status + standings on the
 * left, timer/score + progress on the right (collapsing to a strip on mobile).
 * Per-player picks appear ONLY on reveal. The answering column owns the question
 * and options; the rails are content-blind (see `components/shell/play/ambient`).
 *
 * Everything is server-authoritative and unchanged: this screen reuses the real
 * `challengeArenas` room read-model and mutations (join/submit/leave/rematch),
 * and reuses the existing, proven Lobby/Countdown/RoundBreak/Final views for the
 * non-in-game phases. No arena backend, schema, or grading is touched.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Share2 } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { QuestionImage } from "@/components/QuestionImage";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import {
  arenaCategoryEmoji,
  arenaCategoryLabel,
  arenaModeLabel,
  normalizeArenaCode,
  shareArenaLink,
  useClockOffset,
  useImagePreload,
  useTick,
} from "@/lib/arena";
import { PlayStage } from "@/components/shell/play/PlayStage";
import {
  RosterPanel,
  StandingsPanel,
  MetricsPanel,
  ProgressPanel,
  AmbientStrip,
} from "@/components/shell/play/ambient";
import type {
  RosterEntry,
  RevealPick,
  StandingEntry,
} from "@/components/shell/play/ambient";
import {
  LobbyView,
  CountdownView,
  RoundBreakView,
  FinalView,
  NotInRoom,
} from "@/pages/ChallengeArenaScreen";

type Room = NonNullable<FunctionReturnType<typeof api.challengeArenas.getRoom>>;
type Phase = Room["phase"];

const PHASE_LABEL: Record<Phase, string> = {
  lobby: "Lobby",
  countdown: "Starting",
  question: "Question",
  reveal: "Reveal",
  round_break: "Round break",
  final: "Final",
  abandoned: "Ended",
};

// ───────────────────────── auth gate + join ─────────────────────────

export default function ArenaPlayScreen() {
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
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  return <ArenaPlayRoom code={code} userId={user?._id as Id<"users"> | undefined} />;
}

function CenteredMessage({ children }: { children: string }) {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <p className="font-heading font-bold animate-pulse">{children}</p>
    </div>
  );
}

function ArenaPlayRoom({ code, userId }: { code: string; userId: Id<"users"> | undefined }) {
  const navigate = useNavigate();
  const room = useQuery(api.challengeArenas.getRoom, { code });
  const joinMut = useMutation(api.challengeArenas.join);
  const leaveMut = useMutation(api.challengeArenas.leave);
  const rematchMut = useMutation(api.challengeArenas.rematch);

  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [rematching, setRematching] = useState(false);
  const joinAttempted = useRef(false);

  // Clock + tick drive the ambient timer; called unconditionally (hooks rules).
  const offset = useClockOffset(room?.timer?.serverNow ?? null);
  const tick = useTick(150);
  useImagePreload(room?.upcomingImageUrls);

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

  const handleLeave = useCallback(async () => {
    if (!room || leaving) return;
    setLeaving(true);
    try {
      await leaveMut({ arenaId: room.arenaId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not leave");
    } finally {
      setLeaving(false);
      navigate("/challenge");
    }
  }, [leaveMut, leaving, navigate, room]);

  const handleRematch = useCallback(async () => {
    if (!room || rematching) return;
    if (room.rematchArenaCode) {
      navigate(`/v2/arena/${room.rematchArenaCode}`, { replace: true });
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ arenaId: room.arenaId });
      toast.success("Rematch lobby ready");
      navigate(`/v2/arena/${result.code}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rematch failed");
    } finally {
      setRematching(false);
    }
  }, [navigate, rematchMut, rematching, room]);

  const handleShare = useCallback(async () => {
    if (!room) return;
    const res = await shareArenaLink(room.code);
    if (res === "copied") toast.success("Link copied");
    if (res === "failed") toast.error("Could not share link");
  }, [room]);

  if (room === undefined) return <CenteredMessage>Loading arena…</CenteredMessage>;
  if (room === null) {
    return joinError ? (
      <NotInRoom title="Couldn't join arena" detail={joinError} onBack={() => navigate("/challenge")} />
    ) : (
      <CenteredMessage>Joining…</CenteredMessage>
    );
  }
  if (room.status === "abandoned") {
    return <NotInRoom title="Arena ended" detail="The room was abandoned or expired." onBack={() => navigate("/challenge")} />;
  }

  const me = userId ? room.players.find((p) => p.userId === userId) ?? null : null;
  if (!me || me.left) {
    return (
      <NotInRoom
        title={me?.left ? "You left this arena" : "Not in this arena"}
        detail={
          me?.left
            ? "Rejoin from the code if the lobby is still open, or head back to the Challenge hub."
            : "Ask the host for the code, or open the share link they sent."
        }
        onBack={() => navigate("/challenge")}
      />
    );
  }

  const phase = room.phase;
  const isInGame = phase === "question" || phase === "reveal";

  // ── Ambient view-models (sanitized; the rails never see raw question state) ──
  const active = room.players.filter((p) => !p.left);

  const standings: StandingEntry[] = [...active]
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((p, i) => ({
      id: String(p.userId),
      name: p.nameSnapshot,
      score: p.totalScore,
      rank: i + 1,
      isMe: p.userId === userId,
    }));

  // During the question the server withholds others' answers, so the roster
  // shows only generic in-room status (and my own locked state) — never a pick.
  const myLocked = room.myCurrentAnswer !== null;
  const rosterEntries: RosterEntry[] = active.map((p) => ({
    id: String(p.userId),
    name: p.nameSnapshot,
    state:
      p.userId === userId ? (myLocked ? "answered" : "answering") : "answering",
    isMe: p.userId === userId,
  }));

  // On reveal, surface sanitized per-player picks (label = the pick text).
  const revealPicks: RevealPick[] = active.map((p) => {
    const a = room.revealAnswers.find((r) => r.userId === p.userId);
    return {
      id: String(p.userId),
      name: p.nameSnapshot,
      label: a?.answer ?? "",
      outcome: !a ? "missed" : a.correct ? "correct" : "wrong",
      points: a?.points,
      isMe: p.userId === userId,
    };
  });

  // Ambient timer (question phase only) — server-clocked, mirrors QuestionView.
  let seconds: number | undefined;
  let timeFraction: number | undefined;
  if (phase === "question" && room.timer?.questionStartedAt) {
    const serverNow = tick - offset;
    const elapsed = Math.max(0, serverNow - room.timer.questionStartedAt);
    const remainingMs = Math.max(0, room.timer.questionWindowMs - elapsed);
    timeFraction = Math.max(0, Math.min(1, remainingMs / room.timer.questionWindowMs));
    seconds = Math.ceil(remainingMs / 1000);
  }

  const metrics = { score: me.totalScore, seconds, timeFraction };
  const progress = {
    current: room.currentQuestionIndex + 1,
    total: room.config.perRound,
    roundLabel: `R${room.currentRound + 1}/${room.config.rounds}`,
  };

  const left = isInGame ? (
    <>
      {phase === "reveal" ? (
        <RosterPanel entries={rosterEntries} picks={revealPicks} />
      ) : (
        <RosterPanel entries={rosterEntries} />
      )}
      <StandingsPanel entries={standings} />
    </>
  ) : undefined;

  const right = isInGame ? (
    <>
      <MetricsPanel metrics={metrics} />
      <ProgressPanel progress={progress} />
    </>
  ) : undefined;

  const strip = isInGame ? (
    <AmbientStrip metrics={metrics} progress={progress} rosterCount={active.length} />
  ) : undefined;

  let center: ReactNode;
  switch (phase) {
    case "lobby":
      center = <LobbyView room={room} userId={userId} />;
      break;
    case "countdown":
      center = <CountdownView room={room} />;
      break;
    case "question":
      center = <ArenaQuestionColumn room={room} userId={userId} />;
      break;
    case "reveal":
      center = <ArenaRevealColumn room={room} userId={userId} />;
      break;
    case "round_break":
      center = <RoundBreakView room={room} userId={userId} />;
      break;
    case "final":
      center = <FinalView room={room} userId={userId} rematching={rematching} onRematch={() => void handleRematch()} />;
      break;
    default:
      center = <CenteredMessage>Loading…</CenteredMessage>;
  }

  return (
    <PlayStage
      title={room.code}
      subtitle={`${arenaModeLabel(room.mode)} · ${PHASE_LABEL[phase]}`}
      onExit={() => void handleLeave()}
      exitDisabled={leaving}
      headerRight={
        phase === "lobby" ? (
          <button
            type="button"
            onClick={() => void handleShare()}
            className="neo-border neo-shadow rounded-lg px-3 py-2 bg-electric-blue text-electric-blue-foreground cursor-pointer active:neo-shadow-pressed inline-flex items-center gap-1.5"
          >
            <Share2 size={14} strokeWidth={3} />
            <span className="text-[10px] font-heading font-bold uppercase">Share</span>
          </button>
        ) : undefined
      }
      left={left}
      right={right}
      strip={strip}
    >
      {center}
    </PlayStage>
  );
}

// ───────────────────────── QUESTION (answering column only) ─────────────────────────

function ArenaQuestionColumn({ room, userId }: { room: Room; userId: Id<"users"> | undefined }) {
  const submitAnswer = useMutation(api.challengeArenas.submitAnswer);
  const question = room.currentQuestion;
  const myAnswered = room.myCurrentAnswer?.answer ?? null;
  const [pending, setPending] = useState<string | null>(null);
  const [logoGuess, setLogoGuess] = useState("");
  const [logoFeedback, setLogoFeedback] = useState<"wrong" | "close" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Reset local selection when the question changes.
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

  if (!question) {
    return (
      <NeoCard className="text-center py-8">
        <p className="font-heading font-bold animate-pulse">Loading question…</p>
      </NeoCard>
    );
  }

  const isLogoText = question.kind === "logo_text";
  const isCameFirst =
    question.kind === "which_came_first" || question.category === "which_came_first";
  const isLogo = !!question.imageUrl;
  const locked = myAnswered !== null;
  const selected = pending ?? myAnswered;
  const options =
    "options" in question && Array.isArray(question.options) ? question.options : [];
  const letters = ["A", "B", "C", "D"];

  const handleSelect = async (opt: string) => {
    if (locked || submitting) return;
    setPending(opt);
    setSubmitting(true);
    try {
      await submitAnswer({ arenaId: room.arenaId, answer: opt });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (!/already answered/i.test(msg)) {
        toast.error(msg);
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
        requestAnimationFrame(() => logoInputRef.current?.focus());
        return;
      }
      setPending(guess);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      if (!/already answered/i.test(msg)) {
        toast.error(msg);
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {isLogoText ? (
        <NeoCard shadow="lg" className="text-center">
          {question.imageUrl && <QuestionImage imageUrl={question.imageUrl} alt="Logo quiz image" />}
        </NeoCard>
      ) : isCameFirst ? (
        <NeoCard shadow="lg" className="text-center">
          <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
            Which came first?
          </p>
          <p className="font-heading font-bold text-lg leading-tight">{question.question}</p>
        </NeoCard>
      ) : (
        <NeoCard shadow="lg">
          {isLogo && (
            <div className="mb-3">
              <QuestionImage imageUrl={question.imageUrl} alt={`Image for: ${question.question}`} />
            </div>
          )}
          <p className="font-heading font-bold text-lg leading-tight">{question.question}</p>
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
        <div className={isCameFirst ? "grid grid-cols-1 gap-3" : "space-y-2.5"}>
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

      <p className="text-center text-[11px] text-muted-foreground">
        {locked ? "Locked in — waiting for reveal…" : isLogoText ? "" : "Tap an option to lock it in."}
      </p>
    </div>
  );
}

// ───────────────────────── REVEAL (answering column only) ─────────────────────────

function ArenaRevealColumn({ room, userId }: { room: Room; userId: Id<"users"> | undefined }) {
  const question = room.currentQuestion;
  if (!question) {
    return (
      <NeoCard className="text-center py-8">
        <p className="font-heading font-bold animate-pulse">Loading reveal…</p>
      </NeoCard>
    );
  }

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

  const verdict = !myAnswer
    ? { label: "Missed", color: "muted" as const }
    : myAnswer.correct
      ? { label: `+${myAnswer.points}`, color: "success" as const }
      : { label: "Wrong", color: "destructive" as const };

  return (
    <div className="space-y-4">
      <NeoCard shadow="lg">
        <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
          {arenaCategoryEmoji(question.category)} {arenaCategoryLabel(question.category)}
        </p>
        {question.imageUrl && (
          <div className="mb-3 mt-2">
            <QuestionImage imageUrl={question.imageUrl} alt={isLogoText ? "Logo quiz image" : questionText} />
          </div>
        )}
        {!isLogoText && (
          <p className="font-heading font-bold text-base leading-snug">{questionText}</p>
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
            <p className="font-heading font-bold text-sm">{myAnswer?.answer ?? "—"}</p>
          </div>
          <NeoBadge color={verdict.color} size="md">
            {verdict.label}
          </NeoBadge>
        </div>
      </NeoCard>

      <p className="text-center text-[11px] text-muted-foreground">Next up in a moment…</p>
    </div>
  );
}
