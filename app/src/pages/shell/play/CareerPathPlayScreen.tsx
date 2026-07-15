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
import { toast } from "sonner";
import { User, AlertTriangle, Shirt } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { clubsForDisplay, type CareerPathClub } from "../../../../convex/lib/careerPathClubs";
import { getOrCreateCareerPathGuestToken } from "@/lib/careerPathGuest";
import {
  getOrCreateColdSessionToken,
  readColdSource,
} from "@/lib/coldSession";
import { useAuth } from "@/contexts/AuthContext";
import { startRun, completeRun, abandonRun } from "@/lib/gameAnalytics";

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

export default function CareerPathPlayScreen() {
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
  const [startupState, setStartupState] = useState<{
    kind: "unsupported" | "start_failed";
    title: string;
    message: string;
  } | null>(null);
  const [closeCallShake, setCloseCallShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedGuess = guess.trim();

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
      setStartupState({
        kind: "unsupported",
        title: t("careerPath.unsupportedTitle"),
        message: t("careerPath.unsupportedMessage"),
      });
      setLoading(false);
      return;
    }

    try {
      const res = await withTimeout(
        startChallengeMut({ sport, guestToken }),
        START_CHALLENGE_TIMEOUT_MS,
      );
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
    } catch (err) {
      console.error("Failed to start challenge:", err);
      setSessionId(null);
      setClubs([]);
      setStartupState({
        kind: "start_failed",
        title: t("careerPath.startFailedTitle"),
        message: t("careerPath.startFailedMessage"),
      });
    } finally {
      setLoading(false);
    }
  }, [startChallengeMut, recordCareerPathEvent, sport, guestToken, t]);

  useEffect(() => {
    startGame();
  }, [startGame]);

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
          toast.error(t("careerPath.tabSwitchEnded"));
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
        setGameOver(true);
      } else {
        setGuess("");
        toast.error(
          t("careerPath.wrongGuessesLeft", {
            count: Math.max(
              0,
              (res.maxGuesses ?? maxGuesses) - (res.wrongGuessCount ?? wrongGuessCount),
            ),
          }),
        );
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

  if (loading) {
    return (
      <PlayStage title="Career Path" onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">{t("careerPath.loading")}</p>
        </div>
      </PlayStage>
    );
  }

  if (startupState) {
    return (
      <PlayStage title="Career Path" onExit={() => navigate(SHELL_ROUTES.home)} exitLabel={t("careerPath.quit")}>
        <div className="flex flex-col items-center justify-center py-10">
          <NeoCard color="accent" className="w-full text-center py-8 px-6">
            <p className="font-heading font-bold text-2xl">{startupState.title}</p>
            <p className="font-body text-sm mt-3 text-muted-foreground leading-relaxed">
              {startupState.message}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              {startupState.kind === "unsupported" ? (
                <NeoButton
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(`${SHELL_ROUTES.careerPathPlay}?sport=football`)}
                >
                  {t("careerPath.playFootball")}
                </NeoButton>
              ) : (
                <NeoButton variant="primary" size="lg" onClick={startGame}>
                  {t("careerPath.tryAgain")}
                </NeoButton>
              )}
              <NeoButton
                variant="secondary"
                size="lg"
                onClick={() => navigate(SHELL_ROUTES.competeSportGrid(sport))}
              >
                {t("careerPath.backToCompete")}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title="Career Path"
      subtitle={t("careerPath.subtitle")}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("careerPath.quit")}
      strip={<AmbientStrip metrics={metrics} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className="flex flex-col">
        {/* Meta framing (difficulty / guesses) — not question content. */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <NeoBadge
            color={difficulty === "easy" ? "success" : difficulty === "medium" ? "accent" : "pink"}
            size="md"
          >
            {difficulty}
          </NeoBadge>
          <p className="text-xs text-muted-foreground">
            {t("careerPath.guessMeta", { wrong: wrongGuessCount, max: maxGuesses })}
          </p>
        </div>

        {/* The career path — QUESTION CONTENT, owns the column. */}
        <NeoCard color="blue" className="animate-slide-up">
          <p className="font-heading font-bold text-xs mb-3">{t("careerPath.clubsHeading")}</p>
          <div className="space-y-2">
            {clubsForDisplay(clubs).map((row, i) =>
              row.kind === "gap" ? (
                <div key={`gap-${i}`} className="flex items-center gap-3">
                  <div className="neo-border rounded-full bg-background w-8 h-8 flex items-center justify-center shrink-0">
                    <span className="font-mono font-bold text-sm text-muted-foreground">⋯</span>
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    {t("careerPath.moreClubs", { count: row.hidden })}
                  </p>
                </div>
              ) : (
                <div key={`${row.name}-${row.position}`} className="flex items-center gap-3">
                  <div className="neo-border rounded-full bg-background w-8 h-8 flex items-center justify-center shrink-0">
                    <span className="font-mono font-bold text-sm text-foreground">{row.position}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Shirt size={14} className="shrink-0 opacity-70" />
                    <p className="font-heading font-bold text-sm truncate">{row.name}</p>
                    {row.loan && (
                      <NeoBadge color="yellow" size="sm" className="shrink-0">
                        {t("careerPath.loan")}
                      </NeoBadge>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </NeoCard>

        {/* Action area */}
        {!gameOver && (
          <div className="mt-5 space-y-3">
            {closeCallShake && (
              <div className="neo-border rounded-lg bg-accent p-3 flex items-center gap-2 animate-shake-horizontal">
                <AlertTriangle size={16} />
                <p className="font-heading font-bold text-xs">{t("careerPath.closeTryAgain")}</p>
              </div>
            )}

            {guessHistory.length > 0 && (
              <NeoCard color="default" className="p-3">
                <p className="font-heading font-bold text-xs mb-2">{t("careerPath.previousGuesses")}</p>
                <div className="space-y-1">
                  {guessHistory.map((item, index) => (
                    <div
                      key={`${item.guessName}-${index}`}
                      className="flex items-center justify-between gap-2 neo-border rounded-md bg-background px-2 py-1"
                    >
                      <p className="font-heading font-bold text-xs truncate line-through opacity-70">
                        {item.guessName}
                      </p>
                      <p className="font-mono text-[10px]">
                        {t("careerPath.points", { score: item.scoreAfter })}
                      </p>
                    </div>
                  ))}
                </div>
              </NeoCard>
            )}

            {/* Guess input — free text only, NO player suggestions (the server's
                typo budget does the forgiving, not an autocomplete). */}
            <NeoInput
              ref={inputRef}
              placeholder={t("careerPath.guessPlaceholder")}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitGuess()}
              className={closeCallShake ? "animate-shake-horizontal" : ""}
            />
            <p className="text-xs text-muted-foreground font-body">{t("careerPath.typoHint")}</p>

            <NeoButton
              variant="primary"
              size="lg"
              onClick={handleSubmitGuess}
              disabled={!trimmedGuess || submitting}
              className="w-full"
            >
              <User size={16} className="mr-1" />
              {submitting ? t("careerPath.checking") : t("careerPath.guess")}
            </NeoButton>
          </div>
        )}

        {/* Result */}
        {gameOver && result && (
          <div className="mt-5 space-y-3 animate-slide-up">
            <NeoCard color={result.correct ? "success" : "destructive"} className="text-center py-5">
              <p className="font-heading font-bold text-xl">
                {result.correct ? t("careerPath.resultCorrect") : t("careerPath.resultWrong")}
              </p>
              {result.correct && result.typoAccepted && (
                <p className="font-body text-xs mt-1 opacity-80">{t("careerPath.typoAccepted")}</p>
              )}
              {result.answerName && (
                <p className="font-body text-sm mt-1 opacity-90">
                  {t("careerPath.itWas", { name: result.answerName })}
                </p>
              )}
              <p className="font-mono font-bold text-3xl mt-2">{result.score}</p>
              <p className="text-xs opacity-80 mt-1">{t("careerPath.pointsEarned")}</p>
            </NeoCard>
            {/* Guests played with zero friction — invite (never force) an account. */}
            {!hasUsername && (
              <NeoCard color="default" className="text-center py-3 px-4">
                <p className="font-body text-xs text-muted-foreground">
                  {t("careerPath.guestNudge")}
                </p>
                <NeoButton
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    navigate(
                      `${SHELL_ROUTES.account}?next=${encodeURIComponent(
                        `${SHELL_ROUTES.careerPathPlay}?sport=football`,
                      )}`,
                    )
                  }
                >
                  {t("careerPath.guestNudgeCta")}
                </NeoButton>
              </NeoCard>
            )}
            <div className="grid grid-cols-2 gap-3">
              <NeoButton variant="primary" size="lg" onClick={startGame}>
                {t("careerPath.nextPlayer")}
              </NeoButton>
              <NeoButton variant="secondary" size="lg" onClick={() => navigate(SHELL_ROUTES.home)}>
                {t("careerPath.home")}
              </NeoButton>
            </div>
          </div>
        )}
      </div>
    </PlayStage>
  );
}
