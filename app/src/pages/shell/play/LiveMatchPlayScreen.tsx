/**
 * Live Match (1v1 realtime) on the v2 shell — the "prototype layout", following
 * the multi-user Arena pattern.
 *
 * The in-game phases (question / reveal) render a centered, phone-width answering
 * column flanked by AMBIENT rails: roster status + standings on the left, the
 * server-clocked timer/score + progress on the right (collapsing to a strip on
 * mobile). Per-player picks appear ONLY on reveal. The answering column owns the
 * question and options; the rails are content-blind (see `components/shell/play/
 * ambient`).
 *
 * Everything is server-authoritative and UNCHANGED: this screen reuses the real
 * `liveMatches` read-model (`getMatch`) and the existing mutations (setReady /
 * submitAnswer / heartbeat / forfeit). Realtime sync, matchmaking (the Challenge
 * hub + waiting room) and the LEGACY ELO all stay exactly as they are — this is a
 * FE reskin only. The client never grades; correctness/score come from the
 * server, and the opponent's pick text is never exposed (the read-model surfaces
 * only their status during the question and their outcome on reveal).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { FunctionReturnType } from "convex/server";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoAvatar } from "@/components/neo/NeoAvatar";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { ExitGameButton } from "@/components/ExitGameButton";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useTick } from "@/lib/arena";
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
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type Match = NonNullable<FunctionReturnType<typeof api.liveMatches.getMatch>>;
type Status = Match["status"];

/** Display-only window; the SERVER enforces the real cutoff on submit. */
const QUESTION_WINDOW_MS = 10_000;
const COUNTDOWN_MS = 3_000;

const STATUS_LABEL_KEY: Record<Status, string> = {
  waiting: "statusWaiting",
  countdown: "statusStarting",
  question: "statusQuestion",
  roundResult: "statusReveal",
  completed: "statusFinal",
  forfeited: "statusFinal",
};

// ───────────────────────── matchId resolve ─────────────────────────

export default function LiveMatchPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paramMatchId = params.get("matchId") as Id<"liveMatches"> | null;

  // The Challenge hub creates the match and routes here; if we arrived without an
  // explicit id (e.g. straight from the Compete tile), pick up any active match
  // the same way the legacy hub does. Matchmaking itself is untouched.
  const activeMatchId = useQuery(
    api.liveMatches.getActiveMatch,
    paramMatchId ? "skip" : {},
  );
  const matchId = paramMatchId ?? activeMatchId ?? null;

  if (paramMatchId === null && activeMatchId === undefined) {
    return <CenteredMessage>{t("liveMatch.findingMatch")}</CenteredMessage>;
  }

  if (!matchId) {
    return (
      <NotInMatch
        title={t("liveMatch.noMatchTitle")}
        detail={t("liveMatch.noMatchDetail")}
        actionLabel={t("liveMatch.goToChallenge")}
        onAction={() => navigate("/challenge")}
      />
    );
  }

  return <LiveMatchPlayRoom matchId={matchId} />;
}

function CenteredMessage({ children }: { children: string }) {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <p className="font-heading font-bold animate-pulse">{children}</p>
    </div>
  );
}

function NotInMatch({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="min-h-[100dvh] bg-background px-5 flex items-center justify-center">
      <NeoCard shadow="lg" className="w-full max-w-sm text-center py-6">
        <p className="font-heading font-bold text-lg">{title}</p>
        <p className="text-sm text-muted-foreground mt-2 mb-4">{detail}</p>
        <NeoButton variant="primary" size="full" onClick={onAction}>
          {actionLabel}
        </NeoButton>
      </NeoCard>
    </div>
  );
}

// ───────────────────────── room ─────────────────────────

function LiveMatchPlayRoom({ matchId }: { matchId: Id<"liveMatches"> }) {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const match = useQuery(api.liveMatches.getMatch, { matchId });
  const heartbeatMut = useMutation(api.liveMatches.heartbeat);
  const forfeitMut = useMutation(api.liveMatches.forfeit);
  const abandonWaitingMut = useMutation(api.liveMatches.abandonWaitingMatch);

  const tick = useTick(150);
  const status = match?.status;
  // In-game = anything past the ready-up lobby. The legacy waiting room arms no
  // anti-cheat and abandons (no ELO) on leave, so we mirror that distinction.
  const inGame =
    status === "countdown" || status === "question" || status === "roundResult";

  // Leaving forfeits once the match is live, but only ABANDONS while still
  // waiting (no winner, no ELO) — exactly as the legacy screens behave.
  const handleExit = useCallback(async () => {
    if (status === "completed" || status === "forfeited") return;
    if (status === "waiting") {
      await abandonWaitingMut({ matchId });
    } else {
      await forfeitMut({ matchId });
    }
  }, [status, matchId, abandonWaitingMut, forfeitMut]);

  // Heartbeat — keeps the session alive (unchanged from the legacy screen).
  useEffect(() => {
    if (status === "completed" || status === "forfeited") return;
    const id = window.setInterval(() => void heartbeatMut({ matchId }), 5000);
    return () => window.clearInterval(id);
  }, [matchId, status, heartbeatMut]);

  // Anti-cheat: forfeit on tab switch — armed ONLY in-game (the legacy waiting
  // room has none). Server applies the penalty/ELO.
  useAntiCheat(
    useCallback(() => {
      if (inGame) void forfeitMut({ matchId });
    }, [matchId, inGame, forfeitMut]),
    { warningMessage: t("liveMatch.antiCheatWarning") },
  );

  // On completion, hand off to the existing results screen with the legacy
  // versus summary (ELO/results flow unchanged).
  useEffect(() => {
    if (!match) return;
    if (match.status !== "completed" && match.status !== "forfeited") return;
    const myId = match.isPlayer1 ? match.player1.id : match.player2.id;
    const opponent = match.isPlayer1 ? match.player2 : match.player1;
    const myScore = match.isPlayer1 ? match.player1Score : match.player2Score;
    const opponentScore = match.isPlayer1 ? match.player2Score : match.player1Score;
    const outcome =
      match.status === "forfeited"
        ? match.winnerId === myId
          ? "forfeitWin"
          : "forfeitLoss"
        : match.winnerId === undefined
          ? "draw"
          : match.winnerId === myId
            ? "win"
            : "loss";
    navigate("/results", {
      state: {
        score: myScore,
        opponentScore,
        total: match.totalQuestions,
        correctCount: (match.myAnswers as Array<{ correct: boolean }>).filter(
          (a) => a?.correct,
        ).length,
        avgTime: 0,
        eloChange: null,
        newElo: null,
        sport: match.sport,
        mode: "challenge" as const,
        outcome,
        opponentName: opponent.username,
        opponentId: opponent.id,
        versusScore: match.versusSummary,
        currentStreak: match.versusSummary.currentStreak,
        recentMatches: match.versusSummary.recentMatches,
        currentUserIsPlayer1: match.isPlayer1,
      },
      replace: true,
    });
  }, [match?.status, match, navigate]);

  if (match === undefined)
    return <CenteredMessage>{t("liveMatch.loadingMatch")}</CenteredMessage>;
  if (match === null) {
    return (
      <NotInMatch
        title={t("liveMatch.unavailableTitle")}
        detail={t("liveMatch.unavailableDetail")}
        actionLabel={t("liveMatch.goToChallenge")}
        onAction={() => navigate("/challenge")}
      />
    );
  }
  if (match.status === "completed" || match.status === "forfeited") {
    // The effect above navigates to /results; render a placeholder meanwhile.
    return <CenteredMessage>{t("liveMatch.wrappingUp")}</CenteredMessage>;
  }

  const phase = match.status;
  const isInGame = phase === "question" || phase === "roundResult";

  const me = match.isPlayer1 ? match.player1 : match.player2;
  const opponent = match.isPlayer1 ? match.player2 : match.player1;
  const myScore = match.isPlayer1 ? match.player1Score : match.player2Score;
  const oppScore = match.isPlayer1 ? match.player2Score : match.player1Score;

  // ── Ambient view-models (sanitized; the rails never see raw question state) ──
  const standings: StandingEntry[] = [
    { id: String(me.id), name: me.username, score: myScore, isMe: true },
    { id: String(opponent.id), name: opponent.username, score: oppScore },
  ]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // During the question the server withholds the opponent's pick; the roster
  // shows only generic status (mine reflects my own locked state).
  const myAnswers = match.myAnswers as Array<
    { answer: string | null; correct: boolean; score: number } | undefined
  >;
  const myLocked = !!myAnswers[match.currentQuestion];
  const oppAnswering = match.opponentStatus === "thinking";
  const rosterEntries: RosterEntry[] = [
    {
      id: String(me.id),
      name: me.username,
      state: myLocked ? "answered" : "answering",
      isMe: true,
    },
    {
      id: String(opponent.id),
      name: opponent.username,
      state: oppAnswering ? "answering" : "answered",
    },
  ];

  // On reveal, surface sanitized per-player OUTCOMES only. The read-model never
  // exposes either pick's text, so `label` stays blank (renders "—").
  const round = match.roundAnswers;
  const myRound = match.isPlayer1 ? round?.player1 : round?.player2;
  const oppRound = match.isPlayer1 ? round?.player2 : round?.player1;
  const toPick = (
    id: string,
    name: string,
    r: { correct: boolean; score: number } | null | undefined,
    isMe: boolean,
  ): RevealPick => ({
    id,
    name,
    label: "",
    outcome: !r ? "missed" : r.correct ? "correct" : "wrong",
    points: r?.score,
    isMe,
  });
  const revealPicks: RevealPick[] = [
    toPick(String(me.id), me.username, myRound, true),
    toPick(String(opponent.id), opponent.username, oppRound, false),
  ];

  // Ambient timer (question phase only) — clocked off the server's
  // questionStartedAt, mirroring the legacy screen. Display-only.
  let seconds: number | undefined;
  let timeFraction: number | undefined;
  if (phase === "question" && match.questionStartedAt) {
    const elapsed = Math.max(0, tick - match.questionStartedAt);
    const remainingMs = Math.max(0, QUESTION_WINDOW_MS - elapsed);
    timeFraction = Math.max(0, Math.min(1, remainingMs / QUESTION_WINDOW_MS));
    seconds = Math.ceil(remainingMs / 1000);
  }

  const metrics = { score: myScore, seconds, timeFraction };
  const progress = {
    current: match.currentQuestion + 1,
    total: match.totalQuestions,
  };

  const left = isInGame ? (
    <>
      {phase === "roundResult" ? (
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
    <AmbientStrip metrics={metrics} progress={progress} rosterCount={2} />
  ) : undefined;

  let center: ReactNode;
  switch (phase) {
    case "waiting":
      center = <LiveLobbyColumn match={match} matchId={matchId} />;
      break;
    case "countdown":
      center = <LiveCountdownColumn match={match} tick={tick} />;
      break;
    case "question":
      center = <LiveQuestionColumn match={match} matchId={matchId} />;
      break;
    case "roundResult":
      center = <LiveRevealColumn match={match} />;
      break;
    default:
      center = <CenteredMessage>{t("liveMatch.loading")}</CenteredMessage>;
  }

  return (
    <PlayStage
      title={t("liveMatch.stageTitle")}
      subtitle={t("liveMatch.subtitle", {
        sport: capitalize(match.sport),
        status: t(`liveMatch.${STATUS_LABEL_KEY[phase]}`),
      })}
      headerRight={
        <ExitGameButton
          title={
            phase === "waiting"
              ? t("liveMatch.leaveTitle")
              : t("liveMatch.forfeitTitle")
          }
          description={
            phase === "waiting"
              ? t("liveMatch.leaveDescription")
              : t("liveMatch.forfeitDescription")
          }
          destination="/v2"
          onConfirm={handleExit}
        />
      }
      left={left}
      right={right}
      strip={strip}
    >
      {center}
    </PlayStage>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ───────────────────────── WAITING (ready-up lobby) ─────────────────────────

function LiveLobbyColumn({
  match,
  matchId,
}: {
  match: Match;
  matchId: Id<"liveMatches">;
}) {
  const { t } = useTranslation("play");
  const setReadyMut = useMutation(api.liveMatches.setReady);
  const [submitting, setSubmitting] = useState(false);
  const me = match.isPlayer1 ? match.player1 : match.player2;
  const opponent = match.isPlayer1 ? match.player2 : match.player1;
  const myReady = match.isPlayer1 ? match.player1Ready : match.player2Ready;
  const oppReady = match.isPlayer1 ? match.player2Ready : match.player1Ready;

  const handleReady = async () => {
    if (myReady || submitting) return;
    setSubmitting(true);
    try {
      await setReadyMut({ matchId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <NeoCard shadow="lg" className="text-center py-6">
        <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-4">
          {t("liveMatch.lobbyMeta", {
            sport: capitalize(match.sport),
            count: match.totalQuestions,
          })}
        </p>
        <div className="flex items-center justify-center gap-6">
          <PlayerStack name={me.username} ready={myReady} youLabel />
          <p className="font-heading font-bold text-2xl text-muted-foreground">
            {t("liveMatch.vs")}
          </p>
          <PlayerStack name={opponent.username} ready={oppReady} />
        </div>
      </NeoCard>

      {!myReady ? (
        <NeoButton
          variant="primary"
          size="full"
          onClick={() => void handleReady()}
          disabled={submitting}
        >
          {t("liveMatch.imReady")}
        </NeoButton>
      ) : (
        <p className="text-center font-heading font-bold text-sm animate-pulse">
          {t("liveMatch.waitingForOpponent", { name: opponent.username })}
        </p>
      )}
    </div>
  );
}

function PlayerStack({
  name,
  ready,
  youLabel,
}: {
  name: string;
  ready: boolean;
  youLabel?: boolean;
}) {
  const { t } = useTranslation("play");
  return (
    <div className="text-center">
      <NeoAvatar name={name} size="lg" />
      <p className="font-heading font-bold text-sm mt-2 truncate max-w-[100px]">
        {name}
        {youLabel && t("liveMatch.youSuffix")}
      </p>
      <p
        className={`text-xs font-heading font-bold uppercase mt-1 ${
          ready ? "text-success" : "text-muted-foreground"
        }`}
      >
        {ready ? t("liveMatch.ready") : t("liveMatch.notReady")}
      </p>
    </div>
  );
}

// ───────────────────────── COUNTDOWN ─────────────────────────

function LiveCountdownColumn({ match, tick }: { match: Match; tick: number }) {
  const { t } = useTranslation("play");
  const endsAt = match.countdownStartedAt
    ? match.countdownStartedAt + COUNTDOWN_MS
    : undefined;
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - tick) / 1000)) : 0;
  return (
    <NeoCard shadow="lg" className="text-center py-10">
      <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-2">
        {t("liveMatch.getReady")}
      </p>
      <p className="font-mono font-bold text-6xl">
        {remaining || t("liveMatch.go")}
      </p>
    </NeoCard>
  );
}

// ───────────────────────── QUESTION (answering column only) ─────────────────────────

function LiveQuestionColumn({
  match,
  matchId,
}: {
  match: Match;
  matchId: Id<"liveMatches">;
}) {
  const { t } = useTranslation("play");
  const submitAnswer = useMutation(api.liveMatches.submitAnswer);
  const question = match.questions[match.currentQuestion] as
    | { question: string; options: string[]; imageUrl?: string | null }
    | null
    | undefined;

  const myAnswers = match.myAnswers as Array<
    { answer: string | null; correct: boolean; score: number } | undefined
  >;
  const myAnswer = myAnswers[match.currentQuestion];

  const [pending, setPending] = useState<number | null>(null);
  const [shaking, setShaking] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Reset the local selection when the question changes.
  const lastQ = useRef(match.currentQuestion);
  useEffect(() => {
    if (lastQ.current !== match.currentQuestion) {
      lastQ.current = match.currentQuestion;
      setPending(null);
      setShaking(false);
    }
  }, [match.currentQuestion]);

  if (!question) {
    return (
      <NeoCard className="text-center py-8">
        <p className="font-heading font-bold animate-pulse">
          {t("liveMatch.loadingQuestion")}
        </p>
      </NeoCard>
    );
  }

  const locked = !!myAnswer || pending !== null;
  const myPickIdx =
    myAnswer?.answer != null
      ? question.options.indexOf(myAnswer.answer)
      : pending;
  const myCorrect = myAnswer?.correct ?? null;
  const letters = ["A", "B", "C", "D"];

  const handleSelect = async (idx: number) => {
    if (locked) return;
    setPending(idx);
    try {
      const res = await submitAnswer({ matchId, answer: question.options[idx] });
      if (!res.correct) {
        setShaking(true);
        window.setTimeout(() => setShaking(false), 500);
      }
    } catch {
      // Already answered, timed out, or round advanced — server is authoritative.
    }
  };

  const optionStyle = (idx: number) => {
    if (!locked) return "bg-card text-card-foreground";
    if (idx === myPickIdx) {
      // My own correctness is my data — safe to reveal before the round closes.
      return myCorrect
        ? "bg-success text-success-foreground"
        : myCorrect === false
          ? "bg-destructive text-destructive-foreground"
          : "bg-primary text-primary-foreground";
    }
    return "bg-muted text-muted-foreground opacity-50";
  };

  return (
    <div className="space-y-4">
      <NeoCard shadow="lg" className={shaking ? "animate-shake" : undefined}>
        {question.imageUrl && (
          <div className="mb-3">
            <QuestionImage
              imageUrl={question.imageUrl}
              alt={question.question}
              onZoom={() => setZoomImage(question.imageUrl!)}
            />
          </div>
        )}
        <p className="font-heading font-bold text-lg leading-tight">
          {question.question}
        </p>
      </NeoCard>

      <div className="space-y-2.5">
        {question.options.map((opt, idx) => (
          <button
            key={opt}
            type="button"
            disabled={locked}
            onClick={() => void handleSelect(idx)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${
              !locked ? "active:neo-shadow-pressed" : ""
            } ${optionStyle(idx)}`}
          >
            <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
              {locked && idx === myPickIdx && myCorrect ? (
                <Check size={16} strokeWidth={3} />
              ) : locked && idx === myPickIdx && myCorrect === false ? (
                <X size={16} strokeWidth={3} />
              ) : (
                letters[idx]
              )}
            </span>
            <span className="font-heading font-bold text-sm">{opt}</span>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {locked ? t("liveMatch.lockedHint") : t("liveMatch.tapToLockHint")}
      </p>

      {zoomImage && (
        <ImageZoomModal
          imageUrl={zoomImage}
          open={!!zoomImage}
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────── REVEAL (answering column only) ─────────────────────────

function LiveRevealColumn({ match }: { match: Match }) {
  const { t } = useTranslation("play");
  const question = match.questions[match.currentQuestion] as
    | { question: string; options: string[]; imageUrl?: string | null }
    | null
    | undefined;
  const myAnswers = match.myAnswers as Array<
    { answer: string | null; correct: boolean; score: number } | undefined
  >;
  const myAnswer = myAnswers[match.currentQuestion];
  const round = match.roundAnswers;
  const myRound = match.isPlayer1 ? round?.player1 : round?.player2;

  const verdict = !myRound
    ? { label: t("liveMatch.verdictMissed"), color: "muted" as const }
    : myRound.correct
      ? {
          label: t("liveMatch.verdictPoints", { score: myRound.score }),
          color: "success" as const,
        }
      : { label: t("liveMatch.verdictWrong"), color: "destructive" as const };

  return (
    <div className="space-y-4">
      <NeoCard shadow="lg">
        {question?.imageUrl && (
          <div className="mb-3">
            <QuestionImage imageUrl={question.imageUrl} alt={question.question} />
          </div>
        )}
        {question?.question && (
          <p className="font-heading font-bold text-base leading-snug">
            {question.question}
          </p>
        )}
      </NeoCard>

      <NeoCard color={verdict.color === "success" ? "success" : "default"}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-heading uppercase">
              {t("liveMatch.yourAnswer")}
            </p>
            <p className="font-heading font-bold text-sm truncate">
              {myAnswer?.answer ?? "—"}
            </p>
          </div>
          <NeoBadge color={verdict.color} size="md">
            {verdict.label}
          </NeoBadge>
        </div>
      </NeoCard>

      <p className="text-center text-[11px] text-muted-foreground">
        {t("liveMatch.nextUp")}
      </p>
    </div>
  );
}
