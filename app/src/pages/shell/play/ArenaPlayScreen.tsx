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
import { ArrowRight, Share2, Star } from "lucide-react";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuestionImage } from "@/components/QuestionImage";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { localizedAnswerLabel } from "../../../../convex/lib/contentI18n";
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
import { StageScore, StepDots } from "@/components/shell/play/StageParts";
import { RevealedAnswer, StageTimer, VerdictBadge } from "@/components/shell/play/StageSignals";
import { cn } from "@/lib/utils";
import { UsernameOnlyOnboarding } from "@/components/shell/onboarding/UsernameOnlyOnboarding";
import {
  RosterPanel,
  StandingsPanel,
  MetricsPanel,
  ProgressPanel,
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
} from "@/pages/arena/ArenaRoomViews";

type Room = NonNullable<FunctionReturnType<typeof api.challengeArenas.getRoom>>;
type Phase = Room["phase"];

// Reveal/ambient UIs surface canonical values — the `correctAnswer` and each
// player's pick (clients submit the canonical `optionValues[i]`). Map them back
// to the localized DISPLAY label via the aligned options/optionValues the serve
// returns; falls back to canonical for logo text / proper nouns. Grading is
// untouched (it still compares the canonical value).
function localizeArenaAnswer(question: Room["currentQuestion"], value: string): string {
  const options =
    question && "options" in question && Array.isArray(question.options)
      ? question.options
      : undefined;
  const optionValues =
    question && "optionValues" in question && Array.isArray(question.optionValues)
      ? question.optionValues
      : undefined;
  return localizedAnswerLabel(options, optionValues, value);
}

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
  const { t, i18n } = useTranslation("play");
  const room = useQuery(api.challengeArenas.getRoom, {
    code,
    locale: i18n.resolvedLanguage ?? i18n.language,
  });
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
      notify.error(friendlyError(e, t("arena.leaveFailed")));
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
      notify.success(t("arena.rematchReady"));
      navigate(`/v2/arena/${result.code}`, { replace: true });
    } catch (e) {
      notify.error(friendlyError(e, t("arena.rematchFailed")));
    } finally {
      setRematching(false);
    }
  }, [navigate, rematchMut, rematching, room, t]);

  const handleShare = useCallback(async () => {
    if (!room) return;
    const res = await shareArenaLink(room.code, undefined, t);
    if (res === "copied") notify.success(t("arena.linkCopied"));
    if (res === "failed") notify.error(t("arena.shareFailed"));
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

  // On reveal, surface sanitized per-player picks (label = the localized pick text).
  const revealPicks: RevealPick[] = active.map((p) => {
    const a = room.revealAnswers.find((r) => r.userId === p.userId);
    return {
      id: String(p.userId),
      name: p.nameSnapshot,
      label: a ? localizeArenaAnswer(room.currentQuestion, a.answer) : "",
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

  const timer =
    seconds !== undefined && timeFraction !== undefined ? { seconds, fraction: timeFraction } : null;

  let center: ReactNode;
  switch (phase) {
    case "lobby":
      center = <LobbyView room={room} userId={userId} />;
      break;
    case "countdown":
      center = <CountdownView room={room} />;
      break;
    case "question":
      center = <ArenaQuestionColumn room={room} userId={userId} timer={timer} />;
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

  // Mid-game, leaving drops you out of a game the others are still playing.
  const midGame = phase === "countdown" || phase === "question" || phase === "reveal" || phase === "round_break";
  const exitConfirm = midGame
    ? {
        title: t("arena.quitConfirm.title"),
        description: t("arena.quitConfirm.body"),
        confirmLabel: t("arena.quitConfirm.confirm"),
        cancelLabel: t("arena.quitConfirm.cancel"),
      }
    : undefined;

  return (
    <PlayStage
      mode="arena"
      title={room.code}
      subtitle={`${arenaModeLabel(room.mode)} · ${
        isInGame ? progress.roundLabel : t(`arena.phase.${PHASE_LABEL_KEY[phase]}`)
      }`}
      onExit={() => void handleLeave()}
      exitLabel={t("arena.quit")}
      exitDisabled={leaving}
      exitConfirm={exitConfirm}
      score={
        isInGame ? (
          <StageScore
            icon={<Star size={16} strokeWidth={3} />}
            value={me.totalScore}
            label={t("stage.scoreLabel", { value: me.totalScore })}
          />
        ) : undefined
      }
      // One progress row: this round's questions. Others' answers stay
      // withheld, so played questions are plain dots, not verdicts.
      progress={
        isInGame ? (
          <StepDots
            total={room.config.perRound}
            results={Array.from({ length: room.currentQuestionIndex }, () => null)}
            current={room.currentQuestionIndex}
            label={`${progress.roundLabel} · ${progress.current}/${progress.total}`}
          />
        ) : undefined
      }
      headerRight={
        phase === "lobby" ? (
          <Button variant="secondary" size="sm" onClick={() => void handleShare()} data-testid="arena-lobby-share">
            <Share2 size={16} strokeWidth={3} aria-hidden="true" />
            {t("arena.share")}
          </Button>
        ) : undefined
      }
      left={left}
      right={right}
      // The lobby has no ambient rails and owns its own desktop grid, so it
      // takes the wide column to use the viewport and fit laptop heights.
      wide={phase === "lobby"}
    >
      {center}
    </PlayStage>
  );
}

// ───────────────────────── QUESTION (answering column only) ─────────────────────────

function ArenaQuestionColumn({
  room,
  userId,
  timer,
}: {
  room: Room;
  userId: Id<"users"> | undefined;
  timer: { seconds: number; fraction: number } | null;
}) {
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

  const timerRow = timer ? (
    <StageTimer
      seconds={timer.seconds}
      fraction={timer.fraction}
      label={t("ambient.seconds", { seconds: timer.seconds })}
    />
  ) : null;

  if (!question) {
    return (
      <div className="space-y-3">
        {timerRow}
        <Card className="text-center py-8">
          <p className="font-heading font-bold animate-pulse motion-reduce:animate-none">{t("arena.loadingQuestion")}</p>
        </Card>
      </div>
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
  // Canonical English values (same order) — submitted/compared so grading and
  // selection stay canonical even when `options` are localized labels.
  const optionValues =
    "optionValues" in question && Array.isArray(question.optionValues)
      ? question.optionValues
      : options;
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
        notify.error(friendlyError(e, t("arena.submitFailed")));
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
        notify.error(friendlyError(e, t("arena.submitFailed")));
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-3">
      {timerRow}
      {isLogoText ? (
        <Card elevation="lifted" className="text-center">
          {question.imageUrl && <QuestionImage imageUrl={question.imageUrl} alt={t("arena.logoImageAlt")} />}
        </Card>
      ) : isCameFirst ? (
        <Card elevation="lifted" className="text-center">
          <p className="font-mono text-eyebrow uppercase text-muted-foreground mb-1">
            {t("arena.whichCameFirst")}
          </p>
          <p className="font-heading font-bold text-title-sm leading-tight">{question.question}</p>
        </Card>
      ) : (
        <Card elevation="lifted">
          {isLogo && (
            <div className="mb-3">
              <QuestionImage imageUrl={question.imageUrl} alt={t("arena.questionImageAlt", { question: question.question })} />
            </div>
          )}
          <p className="font-heading font-bold text-title-sm leading-tight">{question.question}</p>
        </Card>
      )}

      {isLogoText ? (
        <form onSubmit={(event) => void handleLogoSubmit(event)} className="space-y-2">
          <div className="flex gap-2">
            <Input
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
              className="min-w-0 flex-1 font-heading font-bold"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={locked || submitting || !logoGuess.trim()}
              className="shrink-0 px-4"
              aria-label={t("arena.submitGuess")}
            >
              <ArrowRight size={18} strokeWidth={3} aria-hidden="true" />
            </Button>
          </div>
          {/* The verdict row for a typed guess. */}
          <div className="min-h-11 flex items-center justify-center text-center" aria-live="polite">
            {locked ? (
              <VerdictBadge right>{t("arena.gotIt")}</VerdictBadge>
            ) : logoFeedback === "close" ? (
              <span className="font-heading font-bold text-body-sm">{t("arena.feedbackClose")}</span>
            ) : logoFeedback === "wrong" ? (
              <VerdictBadge right={false}>{t("arena.feedbackWrong")}</VerdictBadge>
            ) : (
              <span className="text-meta text-muted-foreground">{t("arena.logoHint")}</span>
            )}
          </div>
        </form>
      ) : (
        <div className={isCameFirst ? "grid grid-cols-1 gap-3" : "space-y-2"}>
          {options.map((opt, idx) => {
            const value = optionValues[idx] ?? opt;
            const isPicked = selected === value;
            return (
              // A picked option takes the Arena accent — it is a choice, not
              // a verdict, so it is never green until the reveal.
              <Card
                key={value}
                interactive
                padding="md"
                disabled={locked || submitting}
                onClick={() => void handleSelect(value)}
                aria-pressed={isPicked}
                className={cn(
                  "flex items-center gap-3",
                  isPicked ? "bg-mode-accent text-ink" : !locked && "hover:bg-muted",
                  locked && !isPicked && "text-muted-foreground",
                )}
              >
                {!isCameFirst && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full neo-border bg-background text-foreground font-mono font-bold text-body-sm">
                    {letters[idx]}
                  </span>
                )}
                <span className="font-heading font-bold text-body-sm">{opt}</span>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-meta text-muted-foreground">
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
      <Card className="text-center py-8">
        <p className="font-heading font-bold animate-pulse motion-reduce:animate-none">{t("arena.loadingReveal")}</p>
      </Card>
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
  // Show the localized label for the correct answer (the served value is canonical).
  const correctAnswerLabel = correctAnswer
    ? localizeArenaAnswer(question, correctAnswer)
    : null;
  const mine = userId ? room.revealAnswers.find((r) => r.userId === userId) : undefined;

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
      <Card elevation="lifted">
        <p className="font-mono text-eyebrow uppercase text-muted-foreground mb-1">
          {arenaCategoryEmoji(question.category)} {arenaCategoryLabel(question.category, t)}
        </p>
        {question.imageUrl && (
          <div className="mb-3 mt-2">
            <QuestionImage imageUrl={question.imageUrl} alt={isLogoText ? t("arena.logoImageAlt") : questionText} />
          </div>
        )}
        {!isLogoText && (
          <p className="font-heading font-bold text-body leading-snug">{questionText}</p>
        )}
        {/* The verdict row: your ✓/✕, then the right answer in green. */}
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
          {mine ? (
            <VerdictBadge right={mine.correct}>{mine.correct ? t("arena.correct") : t("arena.wrong")}</VerdictBadge>
          ) : (
            <Badge tone="muted" shape="tag" size="md">
              {t("arena.missed")}
            </Badge>
          )}
          {correctAnswerLabel && (
            <RevealedAnswer className="text-body-sm">
              {correctAnswerLabel}
            </RevealedAnswer>
          )}
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <p className="font-mono text-eyebrow uppercase text-muted-foreground px-3 pt-2.5 pb-1.5">
          {t("arena.roundAnswers")}
        </p>
        <div className="max-h-[26dvh] overflow-y-auto scrollbar-none">
          {rows.map(({ player, a }) => {
            const isMe = !!userId && player.userId === userId;
            return (
              <div
                key={String(player.userId)}
                className={cn("border-t-2 border-border px-3 py-2 flex items-center gap-2.5", isMe && "bg-muted")}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold text-body-sm truncate">
                    {player.nameSnapshot}
                    {isMe && t("arena.youSuffix")}
                  </p>
                  <p className="text-eyebrow tracking-normal font-mono truncate text-muted-foreground">
                    {a?.answer ? localizeArenaAnswer(question, a.answer) : "—"}
                  </p>
                </div>
                <Badge tone={!a ? "muted" : a.correct ? "right" : "wrong"}>
                  {!a ? t("arena.missed") : a.correct ? t("arena.pointsGained", { points: a.points }) : t("arena.wrong")}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-center text-meta text-muted-foreground">{t("arena.nextUp")}</p>
    </div>
  );
}
