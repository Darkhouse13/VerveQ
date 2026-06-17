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
import { friendlyError } from "@/lib/errors";
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
import { useTranslation } from "react-i18next";

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
import { UsernameOnlyOnboarding } from "@/components/shell/onboarding/UsernameOnlyOnboarding";
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

// Maps each phase to its i18n key under `arena.phase`; resolved via `t` at the
// call site (this constant is module-level and can't call the hook).
const PHASE_LABEL_KEY: Record<Phase, string> = {
  lobby: "lobby",
  countdown: "countdown",
  question: "question",
  reveal: "reveal",
  round_break: "roundBreak",
  final: "final",
  abandoned: "abandoned",
};

// ───────────────────────── auth gate + join ─────────────────────────

export default function ArenaPlayScreen() {
  const params = useParams<{ code: string }>();
  const { user, accountState, hasUsername } = useAuth();
  const { t } = useTranslation("play");

  const rawCode = params.code ?? "";
  const code = useMemo(() => normalizeArenaCode(rawCode), [rawCode]);

  if (!code) {
    return <NotInRoom title={t("arena.missingCodeTitle")} detail={t("arena.missingCodeDetail")} />;
  }
  if (accountState === "loading") {
    return <CenteredMessage>{t("arena.loading")}</CenteredMessage>;
  }
  // No session, or a session without a username yet: onboard RIGHT HERE so the
  // lobby code is never dropped. Arena is in the username-only mode set, so any
  // user with a username (anonymous or full) may join — the gate is `hasUsername`.
  // On a successful claim, `hasUsername` flips and this re-renders into the room,
  // whose existing effect auto-joins by code.
  if (!hasUsername) {
    return <ArenaOnboardingGate code={code} />;
  }
  return <ArenaPlayRoom code={code} userId={user?._id as Id<"users"> | undefined} />;
}

function ArenaOnboardingGate({ code }: { code: string }) {
  // No-op: the username claim flips `hasUsername` in AuthContext, which swaps
  // ArenaPlayScreen into ArenaPlayRoom. We never navigate, so the code survives.
  const { t } = useTranslation("play");
  const noop = useCallback(() => {}, []);
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-5 py-8">
      <UsernameOnlyOnboarding
        inviteCode={code}
        heading={t("arena.onboardHeading")}
        subheading={t("arena.onboardSubheading", { code })}
        submitLabel={t("arena.onboardSubmit")}
        onComplete={noop}
      />
    </div>
  );
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
  const { t } = useTranslation("play");
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
        setJoinError(friendlyError(e, t("arena.joinFailed")));
      }
    })();
  }, [code, joinMut, room, t]);

  const handleLeave = useCallback(async () => {
    if (!room || leaving) return;
    setLeaving(true);
    try {
      await leaveMut({ arenaId: room.arenaId });
    } catch (e) {
      toast.error(friendlyError(e, t("arena.leaveFailed")));
    } finally {
      setLeaving(false);
      navigate("/v2/arena");
    }
  }, [leaveMut, leaving, navigate, room, t]);

  const handleRematch = useCallback(async () => {
    if (!room || rematching) return;
    if (room.rematchArenaCode) {
      navigate(`/v2/arena/${room.rematchArenaCode}`, { replace: true });
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ arenaId: room.arenaId });
      toast.success(t("arena.rematchReady"));
      navigate(`/v2/arena/${result.code}`, { replace: true });
    } catch (e) {
      toast.error(friendlyError(e, t("arena.rematchFailed")));
    } finally {
      setRematching(false);
    }
  }, [navigate, rematchMut, rematching, room, t]);

  const handleShare = useCallback(async () => {
    if (!room) return;
    const res = await shareArenaLink(room.code);
    if (res === "copied") toast.success(t("arena.linkCopied"));
    if (res === "failed") toast.error(t("arena.shareFailed"));
  }, [room, t]);

  if (room === undefined) return <CenteredMessage>{t("arena.loadingArena")}</CenteredMessage>;
  if (room === null) {
    return joinError ? (
      <NotInRoom title={t("arena.joinErrorTitle")} detail={joinError} backLabel={t("arena.backToArena")} onBack={() => navigate("/v2/arena")} />
    ) : (
      <CenteredMessage>{t("arena.joining")}</CenteredMessage>
    );
  }
  if (room.status === "abandoned") {
    return <NotInRoom title={t("arena.endedTitle")} detail={t("arena.endedDetail")} backLabel={t("arena.backToArena")} onBack={() => navigate("/v2/arena")} />;
  }

  const me = userId ? room.players.find((p) => p.userId === userId) ?? null : null;
  if (!me || me.left) {
    return (
      <NotInRoom
        title={me?.left ? t("arena.leftTitle") : t("arena.notInRoomTitle")}
        detail={me?.left ? t("arena.leftDetail") : t("arena.notInRoomDetail")}
        onBack={() => navigate("/v2/arena")}
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
    roundLabel: t("arena.roundLabel", {
      round: room.currentRound + 1,
      rounds: room.config.rounds,
    }),
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
      center = <CenteredMessage>{t("arena.loading")}</CenteredMessage>;
  }

  return (
    <PlayStage
      title={room.code}
      subtitle={`${arenaModeLabel(room.mode)} · ${t(`arena.phase.${PHASE_LABEL_KEY[phase]}`)}`}
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
            <span className="text-[10px] font-heading font-bold uppercase">{t("arena.share")}</span>
          </button>
        ) : undefined
      }
      left={left}
      right={right}
      strip={strip}
      // The lobby has no ambient rails and owns its own desktop grid, so it
      // takes the wide column to use the viewport and fit laptop heights.
      wide={phase === "lobby"}
    >
      {center}
    </PlayStage>
  );
}

// ───────────────────────── QUESTION (answering column only) ─────────────────────────

function ArenaQuestionColumn({ room, userId }: { room: Room; userId: Id<"users"> | undefined }) {
  const { t } = useTranslation("play");
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
        <p className="font-heading font-bold animate-pulse">{t("arena.loadingQuestion")}</p>
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
        toast.error(friendlyError(e, t("arena.submitFailed")));
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
        toast.error(friendlyError(e, t("arena.submitFailed")));
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-3">
      {isLogoText ? (
        <NeoCard shadow="lg" className="text-center">
          {question.imageUrl && <QuestionImage imageUrl={question.imageUrl} alt={t("arena.logoImageAlt")} />}
        </NeoCard>
      ) : isCameFirst ? (
        <NeoCard shadow="lg" className="text-center">
          <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
            {t("arena.whichCameFirst")}
          </p>
          <p className="font-heading font-bold text-lg leading-tight">{question.question}</p>
        </NeoCard>
      ) : (
        <NeoCard shadow="lg">
          {isLogo && (
            <div className="mb-3">
              <QuestionImage imageUrl={question.imageUrl} alt={t("arena.questionImageAlt", { question: question.question })} />
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
              placeholder={t("arena.logoPlaceholder")}
              aria-label={t("arena.logoAriaLabel")}
              className="min-w-0 flex-1 py-3 font-heading font-bold"
            />
            <NeoButton
              type="submit"
              variant="primary"
              size="md"
              disabled={locked || submitting || !logoGuess.trim()}
              className="shrink-0 px-4 py-3 disabled:opacity-60"
              aria-label={t("arena.submitGuess")}
            >
              <ArrowRight size={18} strokeWidth={3} />
            </NeoButton>
          </div>
          <div className="min-h-[18px] text-center text-[11px] font-heading font-bold uppercase tracking-wide">
            {locked ? (
              <span className="text-success">{t("arena.gotIt")}</span>
            ) : logoFeedback === "close" ? (
              <span className="text-accent">{t("arena.feedbackClose")}</span>
            ) : logoFeedback === "wrong" ? (
              <span className="text-destructive">{t("arena.feedbackWrong")}</span>
            ) : (
              <span className="text-muted-foreground normal-case">
                {t("arena.logoHint")}
              </span>
            )}
          </div>
        </form>
      ) : (
        <div className={isCameFirst ? "grid grid-cols-1 gap-3" : "space-y-2"}>
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
        {locked ? t("arena.lockedWaiting") : isLogoText ? "" : t("arena.tapToLock")}
      </p>
    </div>
  );
}

// ───────────────────────── REVEAL (answering column only) ─────────────────────────

function ArenaRevealColumn({ room, userId }: { room: Room; userId: Id<"users"> | undefined }) {
  const { t } = useTranslation("play");
  const question = room.currentQuestion;
  if (!question) {
    return (
      <NeoCard className="text-center py-8">
        <p className="font-heading font-bold animate-pulse">{t("arena.loadingReveal")}</p>
      </NeoCard>
    );
  }

  const isLogoText = question.kind === "logo_text";
  const questionText =
    "question" in question && typeof question.question === "string"
      ? question.question
      : t("arena.nameThisLogo");
  const correctAnswer =
    "correctAnswer" in question && typeof question.correctAnswer === "string"
      ? question.correctAnswer
      : null;

  // Everyone's picks, banter-ordered: scorers first (fastest on top), then
  // wrong picks, then misses. My row is highlighted instead of a separate
  // "your answer" card so the column fits without scrolling.
  const rows = room.players
    .filter((p) => !p.left)
    .map((p) => ({
      player: p,
      a: room.revealAnswers.find((r) => r.userId === p.userId),
    }))
    .sort(
      (x, y) =>
        (y.a?.points ?? -1) - (x.a?.points ?? -1) ||
        (x.a?.serverTimeMs ?? Number.MAX_SAFE_INTEGER) -
          (y.a?.serverTimeMs ?? Number.MAX_SAFE_INTEGER),
    );

  return (
    <div className="space-y-3">
      <NeoCard shadow="lg">
        <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
          {arenaCategoryEmoji(question.category)} {arenaCategoryLabel(question.category)}
        </p>
        {question.imageUrl && (
          <div className="mb-3 mt-2">
            <QuestionImage imageUrl={question.imageUrl} alt={isLogoText ? t("arena.logoImageAlt") : questionText} />
          </div>
        )}
        {!isLogoText && (
          <p className="font-heading font-bold text-base leading-snug">{questionText}</p>
        )}
        {correctAnswer && (
          <div className="mt-3 neo-border rounded-lg bg-success text-success-foreground px-3 py-2">
            <p className="text-[10px] font-heading uppercase mb-0.5">{t("arena.correct")}</p>
            <p className="font-heading font-bold text-sm">{correctAnswer}</p>
          </div>
        )}
      </NeoCard>

      <NeoCard className="p-0 overflow-hidden">
        <p className="text-[10px] font-heading font-bold uppercase tracking-wide px-3 pt-2.5 pb-1.5">
          {t("arena.roundAnswers")}
        </p>
        <div className="max-h-[26dvh] overflow-y-auto scrollbar-none">
          {rows.map(({ player, a }) => {
            const isMe = !!userId && player.userId === userId;
            return (
              <div
                key={String(player.userId)}
                className={`border-t-2 border-border px-3 py-2 flex items-center gap-2.5 ${
                  isMe ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold text-xs truncate">
                    {player.nameSnapshot}
                    {isMe && t("arena.youSuffix")}
                  </p>
                  <p className={`text-[10px] font-mono truncate ${isMe ? "opacity-90" : "opacity-70"}`}>
                    {a?.answer || "—"}
                  </p>
                </div>
                <NeoBadge
                  color={!a ? "muted" : a.correct ? "success" : "destructive"}
                  size="sm"
                >
                  {!a ? t("arena.missed") : a.correct ? t("arena.pointsGained", { points: a.points }) : t("arena.wrong")}
                </NeoBadge>
              </div>
            );
          })}
        </div>
      </NeoCard>

      <p className="text-center text-[11px] text-muted-foreground">{t("arena.nextUp")}</p>
    </div>
  );
}
