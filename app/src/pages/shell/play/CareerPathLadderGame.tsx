import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCcw, Share2, Shirt, SkipForward, Timer, Trophy, User } from "lucide-react";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoInput } from "@/components/neo/NeoInput";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { AmbientStrip, MetricsPanel } from "@/components/shell/play/ambient";
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
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { clubsForDisplay, type CareerPathClub } from "../../../../convex/lib/careerPathClubs";

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

function tierColor(tier: LadderTier): "success" | "accent" | "pink" | "yellow" {
  if (tier === "easy") return "success";
  if (tier === "medium") return "accent";
  if (tier === "hard") return "pink";
  return "yellow";
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
        settleRound({
          correct: response.correct,
          typoAccepted: response.typoAccepted,
          answerName: response.answerName,
          score: response.score,
          resolution: response.resolution === "timed_out" ? "timed_out" : "guessed",
        }, response.nextRound as PreparedRound | undefined);
      } else {
        setGuess("");
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
  const clockPercent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));

  const handleShare = async () => {
    const outcome = await shareCareerPathResult(
      t("careerPath.ladderShareText", { correct: correctCount, score: totalScore }),
    );
    if (outcome === "copied") toast.success(t("careerPath.shareCopied"));
    if (outcome === "failed") toast.error(t("careerPath.shareFailed"));
  };

  if (finished) {
    return (
      <PlayStage title="Career Path" subtitle={t("careerPath.ladderModeTitle")} onExit={onChooseMode} exitLabel={t("careerPath.changeMode")}>
        <div className="flex min-h-full flex-col justify-center py-6">
          <NeoCard color="primary" className="text-center px-6 py-8">
            <Trophy className="mx-auto" size={42} strokeWidth={2.5} />
            <p className="mt-3 font-heading text-3xl font-bold">{t("careerPath.ladderComplete")}</p>
            <p className="mt-2 font-body text-sm opacity-85">{t("careerPath.ladderCompleteMessage")}</p>
            <p className="mt-5 font-mono text-6xl font-bold">{correctCount}<span className="text-2xl">/{ROUND_COUNT}</span></p>
            <p className="mt-1 font-heading text-xs font-bold uppercase">{t("careerPath.pathsSolved")}</p>
            <div className="mx-auto mt-5 flex max-w-xs justify-center gap-1.5">
              {results.map((item, index) => (
                <span
                  key={index}
                  className={cn("h-3 flex-1 neo-border rounded-sm", item.correct ? "bg-success" : "bg-background/40")}
                  title={`${index + 1}: ${item.answerName ?? ""}`}
                />
              ))}
            </div>
            <p className="mt-5 font-mono text-xl font-bold">{t("careerPath.totalPoints", { score: totalScore })}</p>
          </NeoCard>

          <NeoButton variant="accent" size="lg" className="mt-4 w-full" onClick={() => void handleShare()}>
            <Share2 size={17} /> {t("careerPath.shareResult")}
          </NeoButton>

          {!hasUsername && (
            <NeoCard color="default" className="mt-4 text-center py-3 px-4">
              <p className="font-body text-xs text-muted-foreground">{t("careerPath.guestNudge")}</p>
              <NeoButton
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => navigate(`${SHELL_ROUTES.account}?next=${encodeURIComponent(`${SHELL_ROUTES.careerPathPlay}?sport=football`)}`)}
              >
                {t("careerPath.guestNudgeCta")}
              </NeoButton>
            </NeoCard>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <NeoButton variant="primary" size="lg" onClick={restart}>
              <RotateCcw size={16} /> {t("careerPath.playAgain")}
            </NeoButton>
            <NeoButton variant="secondary" size="lg" onClick={onChooseMode}>
              {t("careerPath.changeMode")}
            </NeoButton>
          </div>
        </div>
      </PlayStage>
    );
  }

  if (loading) {
    return (
      <PlayStage title="Career Path" subtitle={t("careerPath.ladderModeTitle")} onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="animate-pulse font-heading text-lg font-bold">{t("careerPath.loadingLadder", { round: roundIndex + 1 })}</p>
        </div>
      </PlayStage>
    );
  }

  if (startupError) {
    return (
      <PlayStage title="Career Path" subtitle={t("careerPath.ladderModeTitle")} onExit={onChooseMode} exitLabel={t("careerPath.changeMode")}>
        <div className="flex min-h-full flex-col justify-center py-8">
          <NeoCard color="accent" className="text-center py-8 px-6">
            <p className="font-heading text-2xl font-bold">{t("careerPath.startFailedTitle")}</p>
            <p className="mt-3 font-body text-sm text-muted-foreground">{t("careerPath.startFailedMessage")}</p>
            <NeoButton className="mt-6 w-full" variant="primary" size="lg" onClick={() => void startLadder()}>
              {t("careerPath.tryAgain")}
            </NeoButton>
          </NeoCard>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title="Career Path"
      subtitle={t("careerPath.ladderRoundSubtitle", { round: roundIndex + 1, total: ROUND_COUNT })}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("careerPath.quit")}
      strip={<AmbientStrip metrics={metrics} />}
      right={<MetricsPanel metrics={metrics} />}
      headerRight={(
        <div className={cn("neo-border rounded-lg px-3 py-2 font-mono text-sm font-bold", secondsLeft <= 5 ? "bg-destructive text-destructive-foreground" : "bg-accent")}>
          <Timer className="mr-1 inline" size={14} /> {secondsLeft}s
        </div>
      )}
    >
      <div className="flex flex-col">
        <div className="mb-3 flex gap-1" aria-label={t("careerPath.ladderProgressLabel")}>
          {Array.from({ length: ROUND_COUNT }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-2 flex-1 neo-border rounded-sm",
                index < roundIndex && (results[index]?.correct ? "bg-success" : "bg-muted"),
                index === roundIndex && "bg-primary",
                index > roundIndex && "bg-background",
              )}
            />
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <NeoBadge color={tierColor(difficulty)} size="md">{t(`careerPath.tiers.${difficulty}`)}</NeoBadge>
          <p className="font-mono text-xs font-bold">{t("careerPath.pathNumber", { round: roundIndex + 1, total: ROUND_COUNT })}</p>
        </div>

        <div className="mb-4 h-3 overflow-hidden neo-border rounded-full bg-background">
          <div
            className={cn("h-full transition-[width] duration-200", secondsLeft <= 5 ? "bg-destructive" : "bg-accent")}
            style={{ width: `${clockPercent}%` }}
          />
        </div>

        <NeoCard color="blue" className="animate-slide-up">
          <p className="mb-3 font-heading text-xs font-bold">{t("careerPath.clubsHeading")}</p>
          <div className="space-y-2">
            {clubsForDisplay(clubs).map((row, index) => row.kind === "gap" ? (
              <div key={`gap-${index}`} className="flex items-center gap-3">
                <div className="neo-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                  <span className="font-mono text-sm font-bold text-muted-foreground">⋯</span>
                </div>
                <p className="font-body text-xs text-muted-foreground">{t("careerPath.moreClubs", { count: row.hidden })}</p>
              </div>
            ) : (
              <div key={`${row.name}-${row.position}`} className="flex items-center gap-3">
                <div className="neo-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                  <span className="font-mono text-sm font-bold">{row.position}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Shirt size={14} className="shrink-0 opacity-70" />
                  <p className="truncate font-heading text-sm font-bold">{row.name}</p>
                  {row.loan && <NeoBadge color="yellow" size="sm">{t("careerPath.loan")}</NeoBadge>}
                </div>
              </div>
            ))}
          </div>
        </NeoCard>

        {!result ? (
          <div className="mt-4 space-y-3">
            {closeCallShake && (
              <div className="neo-border flex items-center gap-2 rounded-lg bg-accent p-3 animate-shake-horizontal">
                <AlertTriangle size={16} />
                <p className="font-heading text-xs font-bold">{t("careerPath.closeTryAgain")}</p>
              </div>
            )}
            <NeoInput
              ref={inputRef}
              placeholder={t("careerPath.guessPlaceholder")}
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleSubmitGuess()}
            />
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <NeoButton variant="primary" size="lg" onClick={() => void handleSubmitGuess()} disabled={!guess.trim() || pendingAction !== null}>
                <User size={16} /> {pendingAction === "guess" ? t("careerPath.checking") : t("careerPath.guess")}
              </NeoButton>
              <NeoButton variant="secondary" size="lg" onClick={() => void resolveWithoutGuess("skipped")} disabled={pendingAction !== null}>
                <SkipForward size={16} /> {t("careerPath.skip")}
              </NeoButton>
            </div>
            <p className="text-center font-body text-[11px] text-muted-foreground">
              {t("careerPath.ladderGuessMeta", { count: guessesRemaining })}
            </p>
          </div>
        ) : (
          <NeoCard color={result.correct ? "success" : "destructive"} className="mt-4 animate-slide-up text-center py-4">
            <p className="font-heading text-xl font-bold">
              {result.correct
                ? t("careerPath.resultCorrect")
                : result.resolution === "timed_out"
                  ? t("careerPath.timeUp")
                  : result.resolution === "skipped"
                    ? t("careerPath.skipped")
                    : t("careerPath.resultWrong")}
            </p>
            {result.answerName && (
              <p className="mt-2 font-heading text-2xl font-bold leading-tight">
                {t("careerPath.itWas", { name: result.answerName })}
              </p>
            )}
            <p className="mt-2 font-mono text-xs font-bold uppercase">{t("careerPath.nextPathLoading")}</p>
          </NeoCard>
        )}
      </div>
    </PlayStage>
  );
}
