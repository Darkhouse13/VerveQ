import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, SkipForward, Star, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { StageScore, StepDots, TierBadge } from "@/components/shell/play/StageParts";
import { RevealedAnswer, StageTimer, VerdictBadge, VerdictSlot } from "@/components/shell/play/StageSignals";
import { CareerPathLadderResult, ClubPath } from "@/components/shell/play/careerPath/CareerPathParts";
import { MetricsPanel } from "@/components/shell/play/ambient";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateCareerPathGuestToken } from "@/lib/careerPathGuest";
import { getOrCreateColdSessionToken, readColdSource } from "@/lib/coldSession";
import {
  abandonRun,
  completeRun,
  noteQuestionAnswered,
  startRun,
} from "@/lib/gameAnalytics";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { shareCareerPathResult } from "@/lib/careerPathShare";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { CareerPathClub } from "../../../../convex/lib/careerPathClubs";

const ROUND_COUNT = 10;
const REVEAL_MS = 1_300;
const START_TIMEOUT_MS = 8_000;
type LadderTier = "easy" | "medium" | "hard" | "impossible";
type Resolution = "guessed" | "skipped" | "timed_out";
type GuessHistoryItem = {
  guessName: string;
  correct: boolean;
  closeCall: boolean;
  scoreAfter: number;
};
type RoundResult = {
  correct: boolean;
  typoAccepted?: boolean;
  answerName?: string;
  score: number;
  resolution: Resolution;
};
type PreparedRound = {
  sessionId: Id<"careerPathSessions">;
  clubs: CareerPathClub[];
  difficulty: string;
  ladderRound: number;
  startsAt: number;
  deadlineAt: number;
  score: number;
  maxGuesses: number;
  wrongGuessCount: number;
  guesses: GuessHistoryItem[];
};
type PendingAction = "guess" | "skip" | "timeout" | null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("Career ladder start timed out")), timeoutMs);
    promise.then((value) => {
      window.clearTimeout(timeoutId);
      resolve(value);
    }).catch((error) => {
      window.clearTimeout(timeoutId);
      reject(error);
    });
  });
}

export default function CareerPathLadderGame({ onChooseMode }: { onChooseMode: () => void }) {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const { hasUsername, accountState } = useAuth();
  const [guestToken] = useState(getOrCreateCareerPathGuestToken);

  const startChallenge = useMutation(api.careerPath.startChallenge);
  const submitGuess = useMutation(api.careerPath.submitGuess);
  const resolveLadderChallenge = useMutation(api.careerPath.resolveLadderChallenge);
  const recordCareerPathEvent = useMutation(api.funnel.recordCareerPathEvent);

  const [sessionId, setSessionId] = useState<Id<"careerPathSessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [clubs, setClubs] = useState<CareerPathClub[]>([]);
  const [difficulty, setDifficulty] = useState<LadderTier>("easy");
  const [score, setScore] = useState(1000);
  const [maxGuesses, setMaxGuesses] = useState(3);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [guessHistory, setGuessHistory] = useState<GuessHistoryItem[]>([]);
  const [guess, setGuess] = useState("");
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [closeCallShake, setCloseCallShake] = useState(false);
  // The verdict slot's last line: a close call or a miss with guesses left.
  const [notice, setNotice] = useState<{ kind: "close" } | { kind: "miss"; left: number } | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [finished, setFinished] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  const runIdRef = useRef<string | null>(null);
  const preparedNextRoundRef = useRef<PreparedRound | null>(null);
  const resolvedSessionRef = useRef<string | null>(null);
  const resolutionInFlightRef = useRef(false);
  const totalScoreRef = useRef(0);
  const resultsRef = useRef<RoundResult[]>([]);
  const funnelStartedRef = useRef(false);
  const funnelCompletedRef = useRef(false);
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  const applyPreparedRound = useCallback((round: PreparedRound) => {
    preparedNextRoundRef.current = null;
    resolvedSessionRef.current = null;
    resolutionInFlightRef.current = false;
    setPendingAction(null);
    setResult(null);
    setGuess("");
    setCloseCallShake(false);
    setNotice(null);
    setSessionId(round.sessionId);
    setRoundIndex(round.ladderRound - 1);
    setClubs(round.clubs);
    setDifficulty(round.difficulty as LadderTier);
    setScore(round.score);
    setMaxGuesses(round.maxGuesses ?? 3);
    setWrongGuessCount(round.wrongGuessCount ?? 0);
    setGuessHistory(round.guesses ?? []);
    setDeadlineAt(round.deadlineAt);
    setSecondsLeft(Math.max(0, Math.ceil((round.deadlineAt - Date.now()) / 1000)));
  }, []);

  const startLadder = useCallback(async () => {
    setLoading(true);
    setStartupError(false);
    setResult(null);
    setGuess("");
    setCloseCallShake(false);
    resolvedSessionRef.current = null;
    resolutionInFlightRef.current = false;

    try {
      const response = await withTimeout(
        startChallenge({
          sport,
          guestToken,
          mode: "ladder",
        }),
        START_TIMEOUT_MS,
      );

      if (!runIdRef.current) {
        runIdRef.current = response.sessionId;
        startRun(response.sessionId, "career-path-ladder", {
          accountState: accountStateRef.current,
          startTrigger: "user_action",
        });
      }
      if (!funnelStartedRef.current) {
        funnelStartedRef.current = true;
        const source = readColdSource();
        void recordCareerPathEvent({
          sessionToken: getOrCreateColdSessionToken(),
          stage: "started",
          ...(source ? { source } : {}),
        }).catch(() => {});
      }

      applyPreparedRound(response as PreparedRound);
    } catch (error) {
      console.error("Failed to start career ladder round:", error);
      setSessionId(null);
      setStartupError(true);
    } finally {
      setLoading(false);
    }
  }, [applyPreparedRound, guestToken, recordCareerPathEvent, sport, startChallenge]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startLadder();
  }, [startLadder]);

  const settleRound = useCallback((nextResult: RoundResult, nextRound?: PreparedRound) => {
    if (!sessionId || resolvedSessionRef.current === sessionId) return;
    resolvedSessionRef.current = sessionId;
    resolutionInFlightRef.current = false;
    preparedNextRoundRef.current = nextRound ?? null;
    setPendingAction(null);
    setDeadlineAt(null);
    setResult(nextResult);
    const nextTotal = totalScoreRef.current + nextResult.score;
    totalScoreRef.current = nextTotal;
    setTotalScore(nextTotal);
    resultsRef.current = [...resultsRef.current, nextResult];
    setResults(resultsRef.current);
    noteQuestionAnswered(runIdRef.current);
  }, [sessionId]);

  const resolveWithoutGuess = useCallback(async (reason: "skipped" | "timed_out") => {
    if (!sessionId || result || resolutionInFlightRef.current) return;
    resolutionInFlightRef.current = true;
    setPendingAction(reason === "skipped" ? "skip" : "timeout");
    try {
      const response = await resolveLadderChallenge({ sessionId, reason, guestToken });
      settleRound({
        correct: false,
        answerName: response.answerName,
        score: response.score,
        resolution: reason,
      }, response.nextRound as PreparedRound | undefined);
    } catch (error) {
      resolutionInFlightRef.current = false;
      setPendingAction(null);
      // The 200ms clock interval retries an early timeout naturally while the
      // round is still active. Do not schedule a detached retry here: a guess
      // can resolve in the same instant and make that old session terminal.
      if (reason === "skipped") {
        console.error("Failed to skip career ladder round:", error);
      }
    }
  }, [guestToken, resolveLadderChallenge, result, sessionId, settleRound]);

  useEffect(() => {
    if (!deadlineAt || result || loading || finished) return;
    const updateClock = () => {
      const remaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) void resolveWithoutGuess("timed_out");
    };
    updateClock();
    const intervalId = window.setInterval(updateClock, 200);
    return () => window.clearInterval(intervalId);
  }, [deadlineAt, finished, loading, resolveWithoutGuess, result]);

  useEffect(() => {
    if (!result) return;
    const nextRound = preparedNextRoundRef.current;
    const transitionDelay = nextRound
      ? Math.max(0, nextRound.startsAt - Date.now())
      : REVEAL_MS;
    const timeoutId = window.setTimeout(() => {
      if (nextRound) {
        applyPreparedRound(nextRound);
        return;
      }

      if (roundIndex < ROUND_COUNT - 1) {
        setResult(null);
        setStartupError(true);
        return;
      }

      setFinished(true);
      completeRun(runIdRef.current, {
        score: totalScoreRef.current,
        questionsAnswered: ROUND_COUNT,
      });
      if (!funnelCompletedRef.current) {
        funnelCompletedRef.current = true;
        void recordCareerPathEvent({
          sessionToken: getOrCreateColdSessionToken(),
          stage: "completed",
        }).catch(() => {});
      }
    }, transitionDelay);
    return () => window.clearTimeout(timeoutId);
  }, [applyPreparedRound, recordCareerPathEvent, result, roundIndex]);

  useEffect(() => () => abandonRun(runIdRef.current), []);

  const handleSubmitGuess = async () => {
    const submittedGuess = guess.trim();
    if (!sessionId || !submittedGuess || pendingAction || result) return;
    setPendingAction("guess");
    try {
      const response = await submitGuess({ sessionId, guess: submittedGuess, guestToken });
      if (response.closeCall) {
        setScore(response.score);
        setNotice({ kind: "close" });
        setCloseCallShake(true);
        window.setTimeout(() => setCloseCallShake(false), 600);
        return;
      }

      setScore(response.score);
      setWrongGuessCount(response.wrongGuessCount ?? wrongGuessCount);
      setMaxGuesses(response.maxGuesses ?? maxGuesses);
      setGuessHistory(response.guesses ?? guessHistory);
      if (response.gameOver) {
        setGuess("");
        setNotice(null);
        settleRound({
          correct: response.correct,
          typoAccepted: response.typoAccepted,
          answerName: response.answerName,
          score: response.score,
          resolution: response.resolution === "timed_out" ? "timed_out" : "guessed",
        }, response.nextRound as PreparedRound | undefined);
      } else {
        setGuess("");
        setNotice({
          kind: "miss",
          left: Math.max(0, (response.maxGuesses ?? maxGuesses) - (response.wrongGuessCount ?? wrongGuessCount)),
        });
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Career ladder guess failed:", error);
    } finally {
      setPendingAction(null);
    }
  };

  const restart = () => {
    preparedNextRoundRef.current = null;
    resultsRef.current = [];
    totalScoreRef.current = 0;
    runIdRef.current = null;
    funnelStartedRef.current = false;
    funnelCompletedRef.current = false;
    startedRef.current = true;
    setResults([]);
    setTotalScore(0);
    setFinished(false);
    void startLadder();
  };

  const correctCount = results.filter((item) => item.correct).length;
  const guessesRemaining = Math.max(0, maxGuesses - wrongGuessCount);
  const metrics = { score: totalScore + (result ? 0 : score), lives: guessesRemaining };
  const exit = () => navigate(SHELL_ROUTES.home);

  const handleShare = async () => {
    const outcome = await shareCareerPathResult(
      t("careerPath.ladderShareText", { correct: correctCount, score: totalScore }),
    );
    if (outcome === "copied") notify.success(t("careerPath.shareCopied"));
    if (outcome === "failed") notify.error(t("careerPath.shareFailed"));
  };

  if (finished) {
    return (
      <PlayStage
        mode="career-path"
        title={t("careerPath.title")}
        subtitle={t("careerPath.ladderModeTitle")}
        onExit={exit}
        exitLabel={t("careerPath.quit")}
      >
        <CareerPathLadderResult
          results={results}
          rounds={ROUND_COUNT}
          totalScore={totalScore}
          onShare={() => void handleShare()}
          onPlayAgain={restart}
          onChangeMode={onChooseMode}
          onAccount={
            hasUsername
              ? undefined
              : () =>
                  navigate(
                    `${SHELL_ROUTES.account}?next=${encodeURIComponent(`${SHELL_ROUTES.careerPathPlay}?sport=football`)}`,
                  )
          }
        />
      </PlayStage>
    );
  }

  if (loading) {
    return (
      <PlayStage mode="career-path" title={t("careerPath.title")} subtitle={t("careerPath.ladderModeTitle")} onExit={exit} exitLabel={t("careerPath.quit")}>
        <div className="flex items-center justify-center py-16">
          <p className="animate-pulse motion-reduce:animate-none font-heading text-title-sm font-bold">
            {t("careerPath.loadingLadder", { round: roundIndex + 1 })}
          </p>
        </div>
      </PlayStage>
    );
  }

  if (startupError) {
    return (
      <PlayStage mode="career-path" title={t("careerPath.title")} subtitle={t("careerPath.ladderModeTitle")} onExit={exit} exitLabel={t("careerPath.quit")}>
        <div className="flex min-h-full flex-col justify-center py-8">
          <Card elevation="lifted" padding="lg" className="text-center">
            <p className="font-heading text-title font-bold">{t("careerPath.startFailedTitle")}</p>
            <p className="mt-3 font-body text-body-sm text-muted-foreground">{t("careerPath.startFailedMessage")}</p>
            <div className="mt-6 grid gap-3">
              <Button variant="primary" size="lg" block onClick={() => void startLadder()}>
                {t("careerPath.tryAgain")}
              </Button>
              <Button variant="secondary" size="lg" block onClick={onChooseMode}>
                {t("careerPath.changeMode")}
              </Button>
            </div>
          </Card>
        </div>
      </PlayStage>
    );
  }

  // Paths already played are progress a quit throws away.
  const exitConfirm =
    results.length > 0
      ? {
          title: t("careerPath.quitLadder.title"),
          description: t("careerPath.quitLadder.body", { round: roundIndex + 1 }),
          confirmLabel: t("careerPath.quitLadder.confirm"),
          cancelLabel: t("careerPath.quitLadder.cancel"),
        }
      : undefined;

  return (
    <PlayStage
      mode="career-path"
      title={t("careerPath.title")}
      subtitle={t("careerPath.ladderModeTitle")}
      onExit={exit}
      exitLabel={t("careerPath.quit")}
      exitConfirm={exitConfirm}
      score={
        <StageScore
          icon={<Star size={16} strokeWidth={3} />}
          value={metrics.score}
          label={t("stage.scoreLabel", { value: metrics.score })}
        />
      }
      progress={
        <StepDots
          total={ROUND_COUNT}
          results={results.map((item) => item.correct)}
          current={roundIndex}
          label={t("careerPath.pathNumber", { round: roundIndex + 1, total: ROUND_COUNT })}
        />
      }
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className="flex flex-col">
        {/* The rung's tier beside the one clock (frozen once the path resolves). */}
        <div className="mb-3 flex items-center gap-3">
          <TierBadge label={t(`careerPath.tiers.${difficulty}`)} level={TIER_LEVEL[difficulty] ?? 0} />
          <StageTimer
            className="flex-1 min-w-0"
            seconds={secondsLeft}
            fraction={secondsLeft / 30}
            label={t("ambient.seconds", { seconds: secondsLeft })}
          />
        </div>

        <ClubPath clubs={clubs} />

        {!result ? (
          <>
            {/* The verdict row: a close call or a miss lands here. */}
            <VerdictSlot className="mt-3" testId="career-path-verdict-slot">
              {notice?.kind === "close" ? (
                <Badge
                  tone="neutral"
                  shape="tag"
                  size="md"
                  className={cn("text-body-sm normal-case", closeCallShake && "animate-shake-horizontal")}
                >
                  <AlertTriangle size={16} aria-hidden="true" />
                  {t("careerPath.closeTryAgain")}
                </Badge>
              ) : notice?.kind === "miss" ? (
                <VerdictBadge right={false} testId="career-path-miss">
                  {t("careerPath.wrongGuessesLeft", { count: notice.left })}
                </VerdictBadge>
              ) : null}
            </VerdictSlot>
            <div className="space-y-3">
              <Input
                ref={inputRef}
                placeholder={t("careerPath.guessPlaceholder")}
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleSubmitGuess()}
                className={closeCallShake ? "animate-shake-horizontal" : ""}
                data-testid="career-path-input"
              />
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void handleSubmitGuess()}
                  disabled={!guess.trim() || pendingAction !== null}
                  data-testid="career-path-guess"
                >
                  <User size={16} aria-hidden="true" /> {pendingAction === "guess" ? t("careerPath.checking") : t("careerPath.guess")}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => void resolveWithoutGuess("skipped")}
                  disabled={pendingAction !== null}
                  data-testid="career-path-skip"
                >
                  <SkipForward size={16} aria-hidden="true" /> {t("careerPath.skip")}
                </Button>
              </div>
              <p className="text-center font-body text-meta text-muted-foreground">
                {t("careerPath.ladderGuessMeta", { count: guessesRemaining })}
              </p>
            </div>
          </>
        ) : (
          // The reveal: verdict stamp, then the player — the strongest line,
          // in the verdict green.
          <div className="mt-4 flex flex-col items-center gap-2 text-center" aria-live="polite" data-testid="career-path-reveal">
            <VerdictBadge right={result.correct} testId="career-path-verdict">
              {result.correct
                ? t("careerPath.resultCorrect")
                : result.resolution === "timed_out"
                  ? t("careerPath.timeUp")
                  : result.resolution === "skipped"
                    ? t("careerPath.skipped")
                    : t("careerPath.resultWrong")}
            </VerdictBadge>
            {result.answerName && (
              <RevealedAnswer className="font-heading text-title font-bold leading-tight">
                {t("careerPath.itWas", { name: result.answerName })}
              </RevealedAnswer>
            )}
            <p className="mt-1 font-mono text-eyebrow uppercase text-muted-foreground">{t("careerPath.nextPathLoading")}</p>
          </div>
        )}
      </div>
    </PlayStage>
  );
}

/** The ladder's tiers as the four-pip tier tag. */
const TIER_LEVEL: Record<LadderTier, 0 | 1 | 2 | 3> = { easy: 0, medium: 1, hard: 2, impossible: 3 };
