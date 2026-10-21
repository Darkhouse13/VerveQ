/**
 * Duel play (`/duel/play/:duelId`, and the guest leg of `/duel/:linkCode`) —
 * shell-native since VerveQ ONE P3.3: the round runs inside StageFrame (Exit,
 * the score slot, a StepDots progress row), and every finished state (solo
 * score to share, waiting on the opponent, resolved) is a ResultScreen with
 * one lime action.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Check, X, Clock, Trophy, Swords, Share2, ArrowLeft, Eye } from "lucide-react";
import { notify } from "@/lib/notify";
import { friendlyError } from "@/lib/errors";

import { StageScore, StepDots } from "@/components/shell/play/StageParts";
import { ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { ResultActions, type ResultAction } from "@/components/shell/play/result/ResultActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DuelFrame, DuelHero, LoadingLine } from "@/components/shell/duels/DuelParts";
import { QuestionImage } from "@/components/QuestionImage";
import { cn } from "@/lib/utils";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildShareUrl,
  formatModeLabel,
  formatRelativeTime,
  readGuestDuelToken,
} from "@/lib/duel";

const AUTO_ADVANCE_DELAY_MS = 1500;

type DuelView = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  type: "sports" | "knowledge";
  category: string | null;
  sport: string | null;
  difficulty: "easy" | "intermediate" | "hard";
  mode: string;
  expiresAt: number;
  questionCount: number;
  challenger: { id: Id<"users">; username: string; displayName: string };
  opponent: { id: Id<"users"> | null; username: string; displayName: string };
  myResult: {
    score: number;
    completedAt: number | null;
    perQuestion: Array<{
      questionIndex: number;
      checksum: string;
      answer: string;
      correct: boolean;
      score: number;
    }>;
  };
  opponentResult: {
    score: number;
    completedAt: number | null;
    answeredCount: number;
  };
  winnerId: Id<"users"> | null;
  currentQuestion: {
    checksum: string;
    question: string;
    options: string[];
    optionValues: string[];
    category: string;
    difficulty: string;
    imageUrl: string | null;
  } | null;
  linkCode: string | null;
};

type DuelStatus = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  resolvedAt: number | null;
  questionCount: number;
  myScore: number;
  myAnsweredCount: number;
  myCompleted: boolean;
  opponentScore: number;
  opponentAnsweredCount: number;
  opponentCompleted: boolean;
  winnerId: Id<"users"> | null;
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  bucket: "your_turn" | "awaiting_opponent" | "resolved";
};

interface DuelPlayProps {
  duelId: Id<"duels">;
  guestToken?: string;
  initialView?: DuelView;
}

export default function DuelPlayScreen() {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/?from=duel", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!duelId || !isAuthenticated) return null;
  // Keyed so navigating between duels (e.g. into a rematch) remounts with
  // fresh state instead of carrying the previous duel's view.
  return <DuelPlay key={duelId} duelId={duelId as Id<"duels">} />;
}

export function DuelPlay({ duelId, guestToken, initialView }: DuelPlayProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("screens");
  const { user } = useAuth();
  const getMyDuel = useMutation(api.duels.getMyDuel);
  const submitAnswer = useMutation(api.duels.submitAnswer);
  const completeDuel = useMutation(api.duels.complete);
  const rematchMut = useMutation(api.duels.rematch);

  const [view, setView] = useState<DuelView | null>(initialView ?? null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{
    correctAnswer: string;
    correct: boolean;
    explanation: string | null;
    score: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const completeCalled = useRef(false);

  const guestTokenForArgs = guestToken
    ? guestToken
    : view?.linkCode
      ? readGuestDuelToken(view.linkCode) ?? undefined
      : undefined;
  const liveStatus = useQuery(
    api.duels.getDuelStatus,
    view
      ? guestTokenForArgs
        ? { duelId, guestToken: guestTokenForArgs }
        : { duelId }
      : "skip",
  ) as DuelStatus | undefined;

  const refresh = useCallback(async () => {
    try {
      const fresh = (await getMyDuel({
        duelId,
        guestToken: guestTokenForArgs,
        locale: i18n.resolvedLanguage ?? i18n.language,
      })) as DuelView;
      setView(fresh);
      setLoadError(null);
      return fresh;
    } catch (e) {
      setLoadError(friendlyError(e, t("duelPlay.errorLoadDuel")));
      return null;
    }
  }, [duelId, getMyDuel, guestTokenForArgs, t, i18n]);

  useEffect(() => {
    if (!initialView) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the player has answered every question, ask the server to lock.
  useEffect(() => {
    if (!view) return;
    if (view.status !== "awaiting_opponent") return;
    const answered = view.myResult.perQuestion.length;
    if (
      !completeCalled.current &&
      answered >= view.questionCount &&
      !view.myResult.completedAt
    ) {
      completeCalled.current = true;
      (async () => {
        try {
          await completeDuel({ duelId, guestToken: guestTokenForArgs });
        } catch {
          /* server may already be locked; refresh handles state */
        } finally {
          await refresh();
        }
      })();
    }
  }, [view, completeDuel, duelId, guestTokenForArgs, refresh]);

  // Tap = submit, matching the other versus modes (arena, live match): there is
  // no separate confirm step. The selected index just drives the brief
  // pre-reveal highlight while the server result is in flight.
  const handleSelect = async (idx: number) => {
    if (!view || !view.currentQuestion) return;
    if (selected !== null || submitting || revealed) return;
    setSelected(idx);
    const questionIndex = view.myResult.perQuestion.length;
    setSubmitting(true);
    try {
      const result = await submitAnswer({
        duelId,
        questionIndex,
        // Canonical English value — grading compares against correctAnswer.
        answer: view.currentQuestion.optionValues[idx],
        guestToken: guestTokenForArgs,
      });
      setRevealed({
        correctAnswer: result.correctAnswer,
        correct: result.correct,
        explanation: result.explanation,
        score: result.score,
      });
      advanceTimer.current = window.setTimeout(async () => {
        advanceTimer.current = null;
        setRevealed(null);
        setSelected(null);
        await refresh();
      }, AUTO_ADVANCE_DELAY_MS);
    } catch (e) {
      notify.error(friendlyError(e, t("duelPlay.errorSubmitAnswer")));
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRematch = async () => {
    if (!view || guestTokenForArgs) return;
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: view.duelId });
      if (result.existing) {
        notify.success(t("duelPlay.rematchAlreadyOpen"));
      } else if (result.linkCode) {
        notify.success(t("duelPlay.rematchReady"));
      } else {
        notify.success(t("duelPlay.rematchSent"));
      }
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      notify.error(friendlyError(e, t("duelPlay.errorRematchFailed")));
    } finally {
      setRematching(false);
    }
  };

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  // Guests reach play through a link and have no Duels hub to return to.
  const exitPath = guestToken ? "/home" : SHELL_ROUTES.duels;
  const exit = () => navigate(exitPath);

  if (loadError) {
    return (
      <DuelFrame title={t("duelResult.title")} onExit={exit}>
        <Card elevation="lifted" padding="lg" className="mt-6 text-center">
          <p className="mb-2 font-heading text-title-sm font-bold">{t("duelPlay.couldntLoadDuel")}</p>
          <p className="mb-5 break-words text-body-sm text-muted-foreground">{loadError}</p>
          <Button variant="primary" size="lg" block onClick={exit}>
            {t("duelPlay.backToDuels")}
          </Button>
        </Card>
      </DuelFrame>
    );
  }

  if (!view) {
    return (
      <DuelFrame onExit={exit}>
        <LoadingLine>{t("duelPlay.loadingDuel")}</LoadingLine>
      </DuelFrame>
    );
  }

  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const isCameFirst = view.mode === "came_first";
  const totalQ = view.questionCount;
  const answered = view.myResult.perQuestion.length;
  const progress = t("duelPlay.progress", {
    current: Math.min(answered + 1, totalQ),
    total: totalQ,
  });

  const openRematchHandler = (rematchDuelId: Id<"duels">) =>
    navigate(`/duel/play/${rematchDuelId}`);

  if (liveStatus && liveStatus.status !== "awaiting_opponent") {
    return (
      <LiveResolvedStatus
        view={view}
        status={liveStatus}
        userId={user?._id ?? null}
        canRematch={!guestTokenForArgs && !!user?._id}
        rematching={rematching}
        onRematch={handleRematch}
        onOpenRematch={openRematchHandler}
        onBack={exit}
        onSeeResult={() => navigate(`/duel/result/${duelId}`)}
      />
    );
  }

  if (view.status === "resolved" || view.status === "expired" || view.status === "declined") {
    return (
      <DuelLocked
        view={view}
        userId={user?._id ?? null}
        openRematch={
          !guestTokenForArgs && user?._id ? liveStatus?.openRematch ?? null : null
        }
        onOpenRematch={openRematchHandler}
        onBack={exit}
        onSeeResult={() => navigate(`/duel/result/${duelId}`)}
      />
    );
  }

  if (view.myResult.completedAt && !view.currentQuestion) {
    return (
      <WaitingForOpponent
        view={view}
        liveStatus={liveStatus}
        userId={user?._id ?? null}
        canRematch={!guestTokenForArgs && !!user?._id}
        rematching={rematching}
        onRematch={handleRematch}
        onOpenRematch={openRematchHandler}
        onBack={exit}
        onSeeResult={() => navigate(`/duel/result/${duelId}`)}
      />
    );
  }

  const question = view.currentQuestion;
  const frameTitle =
    view.opponent.id === null && view.role === "challenger"
      ? t("duelPlay.setYourScore")
      : t("duelPlay.versusOpponent", { name: opponentName });
  const frameScore = (
    <StageScore
      icon={<Trophy size={18} strokeWidth={2.5} aria-hidden="true" />}
      value={view.myResult.score}
      label={t("duelPlay.scoreLabel", { score: view.myResult.score })}
    />
  );
  const frameProgress = (
    <StepDots
      total={totalQ}
      results={view.myResult.perQuestion.map((q) => q.correct)}
      current={answered}
      label={progress}
    />
  );

  if (!question) {
    return (
      <DuelFrame title={frameTitle} subtitle={progress} onExit={exit} score={frameScore} progress={frameProgress}>
        <LoadingLine>{t("duelPlay.loadingQuestion")}</LoadingLine>
      </DuelFrame>
    );
  }

  const correctIdx = revealed
    ? question.optionValues.indexOf(revealed.correctAnswer)
    : -1;

  const optionClass = (idx: number) => {
    if (!revealed) return selected === idx ? "bg-foreground text-background" : "";
    if (idx === correctIdx) return "bg-verdict-right text-ink";
    if (idx === selected) return "bg-verdict-wrong text-ink";
    return "";
  };

  const letters = ["A", "B", "C", "D"];

  return (
    <DuelFrame title={frameTitle} subtitle={progress} onExit={exit} score={frameScore} progress={frameProgress}>
      <div className="flex flex-col gap-3" data-testid="duel-play">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="mode">{formatModeLabel(view.mode, t)}</Badge>
          <span className="inline-flex items-center gap-1 font-mono text-meta text-muted-foreground">
            <Clock size={14} strokeWidth={2.5} aria-hidden="true" />
            {formatRelativeTime(view.expiresAt, t)}
          </span>
        </div>

        <Card elevation="lifted" className={cn(isCameFirst && "text-center")}>
          {isCameFirst && (
            <p className="mb-1 font-mono text-eyebrow uppercase text-muted-foreground">{t("duelPlay.whichCameFirst")}</p>
          )}
          {!isCameFirst && question.imageUrl && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={question.imageUrl}
                alt={t("duelPlay.imageAlt", { question: question.question })}
              />
            </div>
          )}
          <p className="font-heading text-title font-bold">{question.question}</p>
        </Card>

        <div className="flex flex-col gap-2.5" role="group" aria-label={question.question}>
          {question.options.map((opt, idx) => (
            <Button
              key={idx}
              variant="secondary"
              size="lg"
              block
              disabled={!!revealed}
              aria-disabled={submitting || undefined}
              onClick={() => void handleSelect(idx)}
              data-testid="duel-option"
              className={cn("h-auto justify-start text-left text-body-sm", optionClass(idx))}
            >
              {!isCameFirst && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background font-heading text-meta font-bold text-foreground neo-border">
                  {revealed && idx === correctIdx ? (
                    <Check size={16} strokeWidth={3} aria-hidden="true" />
                  ) : revealed && idx === selected ? (
                    <X size={16} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    letters[idx]
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">{opt}</span>
            </Button>
          ))}
        </div>

        {revealed ? (
          <Card
            elevation="flat"
            padding="sm"
            aria-live="polite"
            className={cn(revealed.correct ? "border-verdict-right" : "border-verdict-wrong")}
          >
            <p className="font-heading text-body-sm font-bold">
              {revealed.correct
                ? t("duelPlay.revealCorrect", { score: revealed.score })
                : t("duelPlay.revealWrong")}
            </p>
            {revealed.explanation && <p className="mt-1 text-body-sm">{revealed.explanation}</p>}
          </Card>
        ) : (
          <p className="text-center text-meta text-muted-foreground">{t("duelPlay.fastAnswersHint")}</p>
        )}
      </div>
    </DuelFrame>
  );
}

/**
 * The rematch line above a finished duel. Informational only: when the other
 * player asked, ACCEPTING is the screen's one primary action below.
 */
function RematchPrompt({
  openRematch,
  opponentName,
  onOpen,
}: {
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  opponentName: string;
  onOpen: (duelId: Id<"duels">) => void;
}) {
  const { t } = useTranslation("screens");
  if (!openRematch) return null;
  if (openRematch.byMe) {
    return (
      <Card elevation="flat" padding="sm" className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-body-sm font-bold">{t("duelPlay.rematchSentTitle")}</p>
          <p className="truncate text-meta text-muted-foreground">
            {t("duelPlay.waitingForOpponentToPlay", { name: opponentName })}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onOpen(openRematch.duelId)}>
          {t("duelPlay.open")}
        </Button>
      </Card>
    );
  }
  return (
    <Card elevation="flat" padding="sm" className="border-mode-accent" data-testid="duel-rematch-incoming">
      <p className="inline-flex items-center gap-1.5 font-heading text-body-sm font-bold">
        <Swords size={16} strokeWidth={3} className="text-mode-accent" aria-hidden="true" />
        {t("duelPlay.opponentWantsRematch", { name: opponentName })}
      </p>
    </Card>
  );
}

function WaitingForOpponent({
  view,
  liveStatus,
  userId,
  canRematch,
  rematching,
  onRematch,
  onOpenRematch,
  onBack,
  onSeeResult,
}: {
  view: DuelView;
  liveStatus?: DuelStatus;
  userId: string | null;
  canRematch: boolean;
  rematching: boolean;
  onRematch: () => void;
  onOpenRematch: (duelId: Id<"duels">) => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  const { t } = useTranslation("screens");
  const markShared = useMutation(api.duels.markShared);

  if (liveStatus && liveStatus.status !== "awaiting_opponent") {
    return (
      <LiveResolvedStatus
        view={view}
        status={liveStatus}
        userId={userId}
        canRematch={canRematch}
        rematching={rematching}
        onRematch={onRematch}
        onOpenRematch={onOpenRematch}
        onBack={onBack}
        onSeeResult={onSeeResult}
      />
    );
  }

  // Only the challenger of a link duel can invite (their view carries linkCode).
  const canInvite = !!view.linkCode;
  // Play-first: finished a solo round, nobody invited yet.
  const opponentBound = view.opponent.id !== null;

  const share = async () => {
    if (!view.linkCode) return;
    // The share IS the "challenge issued" moment for a play-first duel — record
    // it server-side (idempotent), then open the share sheet.
    markShared({ duelId: view.duelId }).catch(() => {});
    const url = buildShareUrl(view.linkCode);
    try {
      if (navigator.share) {
        await navigator.share({
          text: t("duelPlay.shareBeatMyScore", { score: view.myResult.score }),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        notify.success(t("duelPlay.linkCopied"));
      }
    } catch {
      /* ignore */
    }
  };

  const back: ResultAction = {
    label: t("duelPlay.backToDuels"),
    icon: <ArrowLeft size={18} aria-hidden="true" />,
    onClick: onBack,
    testId: "duel-back",
  };

  if (canInvite && !opponentBound) {
    return (
      <DuelFrame title={t("duelResult.title")} onExit={onBack}>
        <ResultScreen
          testId="duel-solo-score"
          hero={
            <DuelHero
              headline={t("duelPlay.thatsYourScore")}
              myScore={view.myResult.score}
              youLabel={t("duelPlay.yourScore")}
            />
          }
          status={<p className="text-center text-body-sm text-muted-foreground">{t("duelPlay.inviteFriendToBeatItHint")}</p>}
          actions={
            <ResultActions
              primary={{
                label: t("duelPlay.inviteAFriend"),
                icon: <Share2 size={18} aria-hidden="true" />,
                onClick: () => void share(),
                testId: "duel-invite",
              }}
              secondary={[back]}
            />
          }
        />
      </DuelFrame>
    );
  }

  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  return (
    <DuelFrame title={t("duelResult.title")} onExit={onBack}>
      <ResultScreen
        testId="duel-waiting"
        hero={
          <DuelHero
            headline={t("duelPlay.lockedIn")}
            myScore={view.myResult.score}
            youLabel={t("duelPlay.yourScore")}
          />
        }
        status={
          <p className="inline-flex items-center justify-center gap-1.5 text-center text-body-sm text-muted-foreground">
            <Clock size={16} aria-hidden="true" />
            {t("duelPlay.waitingForOpponentToFinish", { name: opponentName })}
          </p>
        }
        actions={
          canInvite ? (
            <ResultActions
              primary={{
                label: t("duelPlay.shareChallengeLink"),
                icon: <Share2 size={18} aria-hidden="true" />,
                onClick: () => void share(),
                testId: "duel-invite",
              }}
              secondary={[back]}
            />
          ) : (
            <ResultActions primary={back} />
          )
        }
      />
    </DuelFrame>
  );
}

function statusHeadline(
  view: DuelView,
  status: Pick<DuelStatus, "status" | "winnerId">,
  userId: string | null,
  t: (key: string) => string,
) {
  if (status.status === "expired") return t("duelPlay.duelExpired");
  if (status.status === "declined") return t("duelPlay.duelDeclined");
  if (!status.winnerId) return t("duelPlay.draw");
  const challengerWon = status.winnerId === view.challenger.id;
  const mine =
    userId && status.winnerId === userId
      ? true
      : view.role === "challenger"
        ? challengerWon
        : !challengerWon;
  return mine ? t("duelPlay.youWon") : t("duelPlay.youLost");
}

function LiveResolvedStatus({
  view,
  status,
  userId,
  canRematch,
  rematching,
  onRematch,
  onOpenRematch,
  onBack,
  onSeeResult,
}: {
  view: DuelView;
  status: DuelStatus;
  userId: string | null;
  canRematch: boolean;
  rematching: boolean;
  onRematch: () => void;
  onOpenRematch: (duelId: Id<"duels">) => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  const { t } = useTranslation("screens");
  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const openRematch = canRematch ? status.openRematch : null;

  const seeResult: ResultAction = {
    label: t("duelPlay.seeFullResult"),
    icon: <Eye size={18} aria-hidden="true" />,
    onClick: onSeeResult,
    testId: "duel-see-result",
  };
  const back: ResultAction = { label: t("duelPlay.backToDuels"), onClick: onBack, testId: "duel-back" };
  const primary: ResultAction =
    openRematch && !openRematch.byMe
      ? {
          label: t("duelPlay.acceptRematch"),
          icon: <Swords size={18} aria-hidden="true" />,
          onClick: () => onOpenRematch(openRematch.duelId),
          testId: "duel-accept-rematch",
        }
      : canRematch && !openRematch
        ? {
            label: t("duelPlay.rematch"),
            icon: <Swords size={18} aria-hidden="true" />,
            onClick: onRematch,
            loading: rematching,
            testId: "duel-rematch",
          }
        : seeResult;

  return (
    <DuelFrame title={t("duelResult.title")} onExit={onBack}>
      <ResultScreen
        testId="duel-resolved"
        top={<RematchPrompt openRematch={openRematch} opponentName={opponentName} onOpen={onOpenRematch} />}
        hero={
          <DuelHero
            eyebrow={t("duelPlay.opponentFinished", { name: opponentName })}
            headline={statusHeadline(view, status, userId, t)}
            myScore={status.myScore}
            opponentScore={status.opponentScore}
            youLabel={t("duelHistory.scoreYou")}
            opponentLabel={`@${opponentName}`}
          />
        }
        actions={
          <ResultActions primary={primary} secondary={primary === seeResult ? [back] : [seeResult, back]} />
        }
      />
    </DuelFrame>
  );
}

function DuelLocked({
  view,
  userId,
  openRematch,
  onOpenRematch,
  onBack,
  onSeeResult,
}: {
  view: DuelView;
  userId: string | null;
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  onOpenRematch: (duelId: Id<"duels">) => void;
  onBack: () => void;
  onSeeResult: () => void;
}) {
  const { t } = useTranslation("screens");
  let title = t("duelPlay.duelResolved");
  if (view.status === "expired") {
    title = t("duelPlay.duelExpired");
  } else if (view.status === "declined") {
    title = t("duelPlay.duelDeclined");
  } else if (view.winnerId && userId && view.winnerId === userId) {
    title = t("duelPlay.youWon");
  } else if (view.winnerId && userId && view.winnerId !== userId) {
    title = t("duelPlay.youLost");
  } else {
    title = t("duelPlay.draw");
  }
  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const seeResult: ResultAction = {
    label: t("duelPlay.seeFullResult"),
    icon: <Eye size={18} aria-hidden="true" />,
    onClick: onSeeResult,
    testId: "duel-see-result",
  };
  const back: ResultAction = { label: t("duelPlay.backToDuels"), onClick: onBack, testId: "duel-back" };
  const incoming = openRematch && !openRematch.byMe ? openRematch : null;
  return (
    <DuelFrame title={t("duelResult.title")} onExit={onBack}>
      <ResultScreen
        testId="duel-locked"
        top={<RematchPrompt openRematch={openRematch} opponentName={opponentName} onOpen={onOpenRematch} />}
        hero={
          <DuelHero
            headline={title}
            myScore={view.myResult.score}
            opponentScore={view.opponentResult.score}
            youLabel={t("duelHistory.scoreYou")}
            opponentLabel={`@${opponentName}`}
          />
        }
        actions={
          incoming ? (
            <ResultActions
              primary={{
                label: t("duelPlay.acceptRematch"),
                icon: <Swords size={18} aria-hidden="true" />,
                onClick: () => onOpenRematch(incoming.duelId),
                testId: "duel-accept-rematch",
              }}
              secondary={[seeResult, back]}
            />
          ) : (
            <ResultActions primary={seeResult} secondary={[back]} />
          )
        }
      />
    </DuelFrame>
  );
}
