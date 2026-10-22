/**
 * Career Path (solo) on the v2 shell — guess the player from the chronological
 * list of clubs he played for. The whole path is shown up front.
 *
 * Every decision is server-authoritative: `careerPath.startChallenge /
 * submitGuess / penalizeTabSwitch`. Grading (aliases + the length-scaled
 * Levenshtein typo budget) lives on the server; the client only ever sends the
 * raw typed string.
 *
 * DELIBERATELY NO AUTOCOMPLETE: unlike VerveGrid's roster search, this mode
 * offers no player suggestions while typing — the server-side fuzzy matcher is
 * what keeps honest typos from being punished.
 *
 * The club list is QUESTION CONTENT and owns the answering COLUMN. The ambient
 * rail carries ONLY meta (score, guesses remaining as `lives`) — the ambient
 * panels are content-blind by contract (answer-leak ESLint guard).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { notify } from "@/lib/notify";
import { User, AlertTriangle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { StageScore, StepDots, TierBadge } from "@/components/shell/play/StageParts";
import { VerdictBadge, VerdictSlot } from "@/components/shell/play/StageSignals";
import { CareerPathClassicResult, ClubPath } from "@/components/shell/play/careerPath/CareerPathParts";
import { MetricsPanel } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { cn } from "@/lib/utils";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { firstRunDifficulty, markCareerPathPlayed } from "@/lib/careerPathFirstRun";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { CareerPathClub } from "../../../../convex/lib/careerPathClubs";
import { getOrCreateCareerPathGuestToken } from "@/lib/careerPathGuest";
import {
  getOrCreateColdSessionToken,
  readColdSource,
} from "@/lib/coldSession";
import { useAuth } from "@/contexts/AuthContext";
import { startRun, completeRun, abandonRun } from "@/lib/gameAnalytics";
import { shareCareerPathResult } from "@/lib/careerPathShare";

const SUPPORTED_CAREER_PATH_SPORTS = new Set(["football"]);
const START_CHALLENGE_TIMEOUT_MS = 8000;

type GuessHistoryItem = {
  guessName: string;
  correct: boolean;
  closeCall: boolean;
  scoreAfter: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Career Path start timed out"));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export default function CareerPathClassicGame() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const startChallengeMut = useMutation(api.careerPath.startChallenge);
  const submitGuessMut = useMutation(api.careerPath.submitGuess);
  const penalizeTabSwitchMut = useMutation(api.careerPath.penalizeTabSwitch);
  const recordCareerPathEvent = useMutation(api.funnel.recordCareerPathEvent);

  // Zero-login play: a stable guest token identifies logged-out players. The
  // server prefers the auth user when present and ignores the token then.
  const [guestToken] = useState(getOrCreateCareerPathGuestToken);
  const { hasUsername, accountState } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"careerPathSessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<CareerPathClub[]>([]);
  const [score, setScore] = useState(1000);
  const [difficulty, setDifficulty] = useState("");
  const [maxGuesses, setMaxGuesses] = useState(3);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [guessHistory, setGuessHistory] = useState<GuessHistoryItem[]>([]);
  const [guess, setGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    typoAccepted?: boolean;
    answerName?: string;
    score: number;
  } | null>(null);
  // The KIND only — never the rendered copy. Holding translated strings in state
  // would put `t` in startGame's closure, and a locale switch would then re-run
  // the auto-start effect (see below); it would also freeze this text in the
  // language that was active when the failure happened.
  const [startupState, setStartupState] = useState<
    "unsupported" | "start_failed" | null
  >(null);
  const [closeCallShake, setCloseCallShake] = useState(false);
  // The verdict slot's last line: a close call (fix the spelling) or a miss
  // with the guesses left. Wrong guesses land here, never in a toast.
  const [notice, setNotice] = useState<{ kind: "close" } | { kind: "miss"; left: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedGuess = guess.trim();

  const handleShare = async () => {
    if (!result) return;
    const outcome = await shareCareerPathResult(
      t("careerPath.classicShareText", { score: result.score }),
    );
    if (outcome === "copied") notify.success(t("careerPath.shareCopied"));
    if (outcome === "failed") notify.error(t("careerPath.shareFailed"));
  };

  // Top-of-funnel instrumentation, mirroring ColdEntryScreen's taste round:
  // fired at most once per mount via these refs, deduped once-per-visitor on
  // the server (funnel.recordCareerPathEvent). Best-effort — a failed call
  // must never block or break play.
  const funnelStartedFired = useRef(false);
  const funnelCompletedFired = useRef(false);

  // Read through a ref, NOT as a startGame dependency: startGame already sits
  // in a useEffect keyed on its own identity, so adding accountState to its
  // deps would mint a fresh server session every time auth settled or the
  // visitor claimed a username — inventing games nobody started.
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  const startGame = useCallback(async () => {
    setLoading(true);
    setStartupState(null);

    if (!SUPPORTED_CAREER_PATH_SPORTS.has(sport)) {
      setSessionId(null);
      setClubs([]);
      setStartupState("unsupported");
      setLoading(false);
      return;
    }

    try {
      // A newcomer's first path comes from the easy pool (lib/careerPathFirstRun).
      const firstDifficulty = firstRunDifficulty();
      const res = await withTimeout(
        startChallengeMut({ sport, guestToken, ...(firstDifficulty ? { difficulty: firstDifficulty } : {}) }),
        START_CHALLENGE_TIMEOUT_MS,
      );
      markCareerPathPlayed();
      if (!funnelStartedFired.current) {
        funnelStartedFired.current = true;
        // Source comes off this route's own URL (?ref / ?utm_source) — the
        // /play short link and promo bio links land here directly.
        const source = readColdSource();
        void recordCareerPathEvent({
          sessionToken: getOrCreateColdSessionToken(),
          stage: "started",
          ...(source ? { source } : {}),
        }).catch(() => {});
      }
      // A game genuinely began — the server minted a session. Keyed on that
      // session id, so the "Next player" replays below each count as their own
      // game (unlike the once-per-mount funnel refs above, which answer a
      // different question), while a bare navigation here mints nothing and
      // stays silent.
      startRun(res.sessionId, "career-path", {
        accountState: accountStateRef.current,
      });
      setSessionId(res.sessionId);
      setClubs(res.clubs);
      setScore(res.score);
      setDifficulty(res.difficulty);
      setMaxGuesses(res.maxGuesses ?? 3);
      setWrongGuessCount(res.wrongGuessCount ?? 0);
      setGuessHistory(res.guesses ?? []);
      setGuess("");
      setGameOver(false);
      setResult(null);
      setCloseCallShake(false);
      setNotice(null);
    } catch (err) {
      console.error("Failed to start challenge:", err);
      setSessionId(null);
      setClubs([]);
      setStartupState("start_failed");
    } finally {
      setLoading(false);
    }
    // NO `t` here, deliberately: every start below is a server session, and a
    // re-created translation function is not a reason to mint one.
  }, [startChallengeMut, recordCareerPathEvent, sport, guestToken]);

  // Arriving provisions exactly ONE session per sport. Every other start is an
  // explicit user action — "Next player" and "Try again" call startGame
  // directly and are untouched by this guard, so a real new game is still a
  // real new start.
  //
  // Keyed on the real input, NOT on startGame's identity: a re-created closure
  // is not a new game. The first-run language modal is exactly that case — on
  // the marketed /play path a first-time visitor picks a language, i18n hands
  // out a new `t`, and anything holding it re-creates startGame. Re-running the
  // effect then minted a SECOND server session and orphaned the first, which
  // reported an abandon it never earned.
  const autoStartedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoStartedForRef.current === sport) return;
    autoStartedForRef.current = sport;
    void startGame();
  }, [sport, startGame]);

  // First finished round = the funnel "completed" (the result card, win or
  // lose, is the payoff the promo promised). Once per mount; server dedupes.
  useEffect(() => {
    if (!gameOver || !result || funnelCompletedFired.current) return;
    funnelCompletedFired.current = true;
    void recordCareerPathEvent({
      sessionToken: getOrCreateColdSessionToken(),
      stage: "completed",
    }).catch(() => {});
  }, [gameOver, result, recordCareerPathEvent]);

  // Per-GAME completion (distinct from the once-per-mount funnel signal above,
  // which deliberately ignores replays). Both terminal paths converge on
  // gameOver+result — a resolved guess and the anti-cheat forfeit — and
  // completeRun is idempotent per session, so neither can double-report.
  useEffect(() => {
    if (!gameOver || !result || !sessionId) return;
    completeRun(sessionId, {
      score: result.score,
      // One session is one career path, so the round IS the question.
      questionsAnswered: 1,
      result: result.correct ? "win" : "loss",
    });
  }, [gameOver, result, sessionId]);

  // Leaving mid-game. Reads the session through a ref so the cleanup sees the
  // session that was live at unmount rather than the one captured at mount.
  // abandonRun ignores runs that already ended, so a finished game can never
  // be reported as abandoned.
  const liveSessionRef = useRef<string | null>(null);
  liveSessionRef.current = sessionId;
  useEffect(() => () => abandonRun(liveSessionRef.current), []);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || gameOver || loading || startupState) return;
      penalizeTabSwitchMut({ sessionId, guestToken }).then((res) => {
        if (res.penalized) {
          setScore(res.score);
          setResult({ correct: false, score: res.score });
          setGameOver(true);
          notify.error(t("careerPath.tabSwitchEnded"));
        }
      });
    }, [sessionId, gameOver, loading, startupState, penalizeTabSwitchMut, guestToken, t]),
    { warningMessage: t("careerPath.tabSwitchWarning") },
  );

  const handleSubmitGuess = async () => {
    const submittedGuess = guess.trim();
    if (!sessionId || !submittedGuess || submitting || gameOver) return;
    setSubmitting(true);
    try {
      const res = await submitGuessMut({ sessionId, guess: submittedGuess, guestToken });

      if (res.closeCall) {
        setScore(res.score);
        setNotice({ kind: "close" });
        setCloseCallShake(true);
        setTimeout(() => setCloseCallShake(false), 600);
        setSubmitting(false);
        return;
      }

      setScore(res.score);
      setWrongGuessCount(res.wrongGuessCount ?? wrongGuessCount);
      setMaxGuesses(res.maxGuesses ?? maxGuesses);
      setGuessHistory(res.guesses ?? guessHistory);
      if (res.gameOver) {
        setResult({
          correct: res.correct,
          typoAccepted: res.typoAccepted,
          answerName: res.answerName,
          score: res.score,
        });
        setGuess("");
        setNotice(null);
        setGameOver(true);
      } else {
        setGuess("");
        setNotice({
          kind: "miss",
          left: Math.max(0, (res.maxGuesses ?? maxGuesses) - (res.wrongGuessCount ?? wrongGuessCount)),
        });
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Ambient view-model: score + guesses remaining (as `lives`) only — the club
  // list is question content and never leaves the answering column.
  const guessesRemaining = Math.max(0, maxGuesses - wrongGuessCount);
  const metrics = { score, lives: guessesRemaining };
  const exit = () => navigate(SHELL_ROUTES.home);

  if (loading) {
    return (
      <PlayStage mode="career-path" title={t("careerPath.title")} onExit={exit} exitLabel={t("careerPath.quit")}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">{t("careerPath.loading")}</p>
        </div>
      </PlayStage>
    );
  }

  if (startupState) {
    return (
      <PlayStage mode="career-path" title={t("careerPath.title")} onExit={exit} exitLabel={t("careerPath.quit")}>
        <div className="flex flex-col items-center justify-center py-10">
          <Card elevation="lifted" padding="lg" className="w-full text-center">
            <p className="font-heading font-bold text-title">
              {startupState === "unsupported"
                ? t("careerPath.unsupportedTitle")
                : t("careerPath.startFailedTitle")}
            </p>
            <p className="font-body text-body-sm mt-3 text-muted-foreground leading-relaxed">
              {startupState === "unsupported"
                ? t("careerPath.unsupportedMessage")
                : t("careerPath.startFailedMessage")}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {startupState === "unsupported" ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(`${SHELL_ROUTES.careerPathPlay}?sport=football`)}
                >
                  {t("careerPath.playFootball")}
                </Button>
              ) : (
                <Button variant="primary" size="lg" onClick={startGame}>
                  {t("careerPath.tryAgain")}
                </Button>
              )}
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(SHELL_ROUTES.competeSportGrid(sport))}
              >
                {t("careerPath.backToCompete")}
              </Button>
            </div>
          </Card>
        </div>
      </PlayStage>
    );
  }

  // The finished path: the shared result screen.
  if (gameOver && result) {
    return (
      <PlayStage
        mode="career-path"
        title={t("careerPath.title")}
        subtitle={t("careerPath.classicModeTitle")}
        onExit={exit}
        exitLabel={t("careerPath.quit")}
        right={<MetricsPanel metrics={metrics} />}
      >
        <CareerPathClassicResult
          correct={result.correct}
          typoAccepted={result.typoAccepted}
          answerName={result.answerName}
          score={result.score}
          onShare={() => void handleShare()}
          onNext={startGame}
          // Guests played with zero friction — invite (never force) an account.
          onAccount={
            hasUsername
              ? undefined
              : () =>
                  navigate(
                    `${SHELL_ROUTES.account}?next=${encodeURIComponent(
                      `${SHELL_ROUTES.careerPathPlay}?sport=football`,
                    )}`,
                  )
          }
        />
      </PlayStage>
    );
  }

  return (
    <PlayStage
      mode="career-path"
      title={t("careerPath.title")}
      subtitle={t("careerPath.classicModeTitle")}
      onExit={exit}
      exitLabel={t("careerPath.quit")}
      score={
        <StageScore
          icon={<Star size={16} strokeWidth={3} />}
          value={score}
          label={t("stage.scoreLabel", { value: score })}
        />
      }
      // The guesses, as the one progress row: a red dot per miss.
      progress={
        <StepDots
          total={maxGuesses}
          results={guessHistory.filter((g) => !g.correct).map(() => false)}
          current={wrongGuessCount}
          label={t("careerPath.guessMeta", { wrong: wrongGuessCount, max: maxGuesses })}
        />
      }
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className="flex flex-col">
        {/* Meta framing (difficulty) — not question content. */}
        {difficulty && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <TierBadge
              label={t(`careerPath.tiers.${difficulty}`, { defaultValue: difficulty })}
              level={TIER_LEVEL[difficulty] ?? 0}
            />
            <p className="font-heading font-bold uppercase text-body-sm tracking-tight text-right">
              {t("careerPath.subtitle")}
            </p>
          </div>
        )}

        {/* The career path — QUESTION CONTENT, owns the column. */}
        <ClubPath clubs={clubs} />

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
          {guessHistory.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label={t("careerPath.previousGuesses")}>
              {guessHistory.map((item, index) => (
                <Badge key={`${item.guessName}-${index}`} tone="muted" className="normal-case">
                  <span className="line-through">{item.guessName}</span>
                </Badge>
              ))}
            </div>
          )}

          {/* Guess input — free text only, NO player suggestions (the server's
              typo budget does the forgiving, not an autocomplete). */}
          <Input
            ref={inputRef}
            placeholder={t("careerPath.guessPlaceholder")}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitGuess()}
            className={closeCallShake ? "animate-shake-horizontal" : ""}
            data-testid="career-path-input"
          />
          <p className="text-meta text-muted-foreground font-body">{t("careerPath.typoHint")}</p>

          <Button
            variant="primary"
            size="lg"
            block
            onClick={handleSubmitGuess}
            disabled={!trimmedGuess || submitting}
            data-testid="career-path-guess"
          >
            <User size={16} aria-hidden="true" />
            {submitting ? t("careerPath.checking") : t("careerPath.guess")}
          </Button>
        </div>
      </div>
    </PlayStage>
  );
}

/** The served difficulty, as the four-pip tier tag. */
const TIER_LEVEL: Record<string, 0 | 1 | 2 | 3> = { easy: 0, medium: 1, hard: 2, impossible: 3 };
