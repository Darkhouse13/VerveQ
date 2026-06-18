/**
 * Who Am I (solo) on the v2 shell — a PRESENTATION-ONLY reskin of the live
 * `WhoAmIScreen` into the centered-column "prototype layout".
 *
 * The game loop is a faithful port: every decision stays server-authoritative
 * and UNCHANGED — `whoAmI.startChallenge / revealNextClue / submitGuess /
 * penalizeTabSwitch` and the curated `whoAmIPlayerSearch.searchPlayers`. Clue
 * sets, fuzzy matching, scoring, and the deduction feedback all live on the
 * server and are not touched.
 *
 * IMPORTANT — clues are QUESTION CONTENT. They (and the deduction board, the
 * blurred visual hook, the autocomplete, and the guess input) own the answering
 * COLUMN. The ambient rail carries ONLY meta: score, guesses remaining (as
 * `lives`), and the clues-revealed COUNT (never the clue text). The ambient
 * panels are content-blind by contract (answer-leak ESLint guard).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Eye, User, AlertTriangle } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, ProgressPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const SUPPORTED_WHO_AM_I_SPORTS = new Set(["football"]);
const START_CHALLENGE_TIMEOUT_MS = 8000;
const WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH = 3;
const TOTAL_CLUES = 4;

type GuessFeedback = {
  guessedPlayerName: string;
  nationality: "correct" | "incorrect" | "unknown";
  position: "correct" | "incorrect" | "unknown";
  team: "correct" | "incorrect" | "unknown";
};

type GuessHistoryItem = {
  guessName: string;
  correct: boolean;
  closeCall: boolean;
  scoreAfter: number;
  feedback?: GuessFeedback;
};

function feedbackLabel(value: GuessFeedback[keyof Omit<GuessFeedback, "guessedPlayerName">]) {
  if (value === "correct") return "✓";
  if (value === "incorrect") return "×";
  return "?";
}

function feedbackColor(value: GuessFeedback[keyof Omit<GuessFeedback, "guessedPlayerName">]) {
  if (value === "correct") return "text-green-700";
  if (value === "incorrect") return "text-destructive";
  return "text-muted-foreground";
}

type PlayerSuggestion = {
  playerId: string;
  name: string;
  nationality?: string;
  team?: string;
  position?: string;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Who Am I start timed out"));
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

export default function WhoAmIPlayScreen() {
  const { t, i18n } = useTranslation("play");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const hardMode = params.get("hardMode") === "true";

  const startChallengeMut = useMutation(api.whoAmI.startChallenge);
  const revealNextClueMut = useMutation(api.whoAmI.revealNextClue);
  const submitGuessMut = useMutation(api.whoAmI.submitGuess);
  const penalizeTabSwitchMut = useMutation(api.whoAmI.penalizeTabSwitch);

  const [sessionId, setSessionId] = useState<Id<"whoAmISessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [clues, setClues] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const [score, setScore] = useState(1000);
  const [difficulty, setDifficulty] = useState("");
  const [maxGuesses, setMaxGuesses] = useState(6);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [guessHistory, setGuessHistory] = useState<GuessHistoryItem[]>([]);
  const [guess, setGuess] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    answerName?: string;
    score: number;
  } | null>(null);
  const [startupState, setStartupState] = useState<{
    kind: "unsupported" | "start_failed";
    title: string;
    message: string;
  } | null>(null);
  const [closeCallShake, setCloseCallShake] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedGuess = guess.trim();
  const playerSuggestions = (useQuery(
    api.whoAmIPlayerSearch.searchPlayers,
    trimmedGuess.length >= WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH
      ? { sport, query: trimmedGuess, limit: 6 }
      : "skip",
  ) ?? []) as PlayerSuggestion[];
  const selectedSuggestion = playerSuggestions.find((player) => player.playerId === selectedPlayerId);

  const startGame = useCallback(async () => {
    setLoading(true);
    setStartupState(null);

    if (!SUPPORTED_WHO_AM_I_SPORTS.has(sport)) {
      setSessionId(null);
      setClues([]);
      setStartupState({
        kind: "unsupported",
        title: t("whoAmI.unsupportedTitle"),
        message: t("whoAmI.unsupportedMessage"),
      });
      setLoading(false);
      return;
    }

    try {
      const res = await withTimeout(startChallengeMut({ sport, hardMode, locale }), START_CHALLENGE_TIMEOUT_MS);
      setSessionId(res.sessionId);
      setClues([res.clue1]);
      setCurrentStage(res.currentStage);
      setScore(res.score);
      setDifficulty(res.difficulty);
      setMaxGuesses(res.maxGuesses ?? 6);
      setWrongGuessCount(res.wrongGuessCount ?? 0);
      setGuessHistory(res.guesses ?? []);
      setGuess("");
      setSelectedPlayerId(null);
      setGameOver(false);
      setResult(null);
      setCloseCallShake(false);
    } catch (err) {
      console.error("Failed to start challenge:", err);
      setSessionId(null);
      setClues([]);
      setStartupState({
        kind: "start_failed",
        title: t("whoAmI.startFailedTitle"),
        message: t("whoAmI.startFailedMessage"),
      });
    } finally {
      setLoading(false);
    }
  }, [startChallengeMut, sport, hardMode, locale, t]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || gameOver || loading || startupState) return;
      penalizeTabSwitchMut({ sessionId }).then((res) => {
        if (res.penalized) {
          setScore(res.score);
          setResult({ correct: false, score: res.score });
          setGameOver(true);
          toast.error(t("whoAmI.tabSwitchEnded"));
        }
      });
    }, [sessionId, gameOver, loading, startupState, penalizeTabSwitchMut, t]),
    { warningMessage: t("whoAmI.tabSwitchWarning") },
  );

  const handleRevealClue = async () => {
    if (!sessionId || currentStage >= TOTAL_CLUES || revealing || gameOver) return;
    setRevealing(true);
    try {
      const res = await revealNextClueMut({ sessionId, locale });
      setClues((prev) => [...prev, res.clueText]);
      setCurrentStage(res.currentStage);
      setScore(res.score);
    } catch (err) {
      console.error("Reveal error:", err);
    } finally {
      setRevealing(false);
    }
  };

  const handleSubmitGuess = async () => {
    const submittedGuess = selectedSuggestion?.name ?? guess.trim();
    if (!sessionId || !submittedGuess || submitting || gameOver) return;
    setSubmitting(true);
    try {
      const res = await submitGuessMut({ sessionId, guess: submittedGuess });

      if (res.closeCall) {
        setScore(res.score);
        setWrongGuessCount(res.wrongGuessCount ?? wrongGuessCount);
        setMaxGuesses(res.maxGuesses ?? maxGuesses);
        setGuessHistory(res.guesses ?? guessHistory);
        setCloseCallShake(true);
        setTimeout(() => setCloseCallShake(false), 600);
        setSelectedPlayerId(null);
        setSubmitting(false);
        return;
      }

      setScore(res.score);
      setWrongGuessCount(res.wrongGuessCount ?? wrongGuessCount);
      setMaxGuesses(res.maxGuesses ?? maxGuesses);
      setGuessHistory(res.guesses ?? guessHistory);
      setResult({
        correct: res.correct,
        answerName: res.answerName,
        score: res.score,
      });
      setGuess("");
      setSelectedPlayerId(null);
      if (res.gameOver) {
        setGameOver(true);
      } else {
        toast.error(
          t("whoAmI.wrongGuessesLeft", {
            count: Math.max(
              0,
              (res.maxGuesses ?? maxGuesses) - (res.wrongGuessCount ?? wrongGuessCount),
            ),
          }),
        );
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Score multiplier display (meta framing, kept in the column).
  const multiplier =
    currentStage === 1 ? "1x" : currentStage === 2 ? "0.75x" : currentStage === 3 ? "0.56x" : "0.42x";

  // Ambient view-model: score + guesses remaining (as `lives`) + clue COUNT only.
  const guessesRemaining = Math.max(0, maxGuesses - wrongGuessCount);
  const metrics = { score, lives: guessesRemaining };
  const clueProgress = { current: currentStage, total: TOTAL_CLUES, roundLabel: t("whoAmI.clueLabel") };

  if (loading) {
    return (
      <PlayStage title="Who Am I" onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">{t("whoAmI.loading")}</p>
        </div>
      </PlayStage>
    );
  }

  if (startupState) {
    return (
      <PlayStage title="Who Am I" onExit={() => navigate(SHELL_ROUTES.home)} exitLabel={t("whoAmI.quit")}>
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
                  onClick={() => navigate(`${SHELL_ROUTES.whoAmIPlay}?sport=football`)}
                >
                  {t("whoAmI.playFootball")}
                </NeoButton>
              ) : (
                <NeoButton variant="primary" size="lg" onClick={startGame}>
                  {t("whoAmI.tryAgain")}
                </NeoButton>
              )}
              <NeoButton
                variant="secondary"
                size="lg"
                onClick={() => navigate(SHELL_ROUTES.competeSportGrid(sport))}
              >
                {t("whoAmI.backToCompete")}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title="Who Am I"
      subtitle={hardMode ? t("whoAmI.subtitleHardMode") : t("whoAmI.subtitleCurated")}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("whoAmI.quit")}
      strip={<AmbientStrip metrics={{ score }} progress={clueProgress} />}
      right={
        <>
          <MetricsPanel metrics={metrics} />
          <ProgressPanel progress={clueProgress} />
        </>
      }
    >
      <div className="flex flex-col">
        {/* Meta framing (difficulty / multiplier / guesses) — not question content. */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <NeoBadge
            color={difficulty === "easy" ? "success" : difficulty === "medium" ? "accent" : "pink"}
            size="md"
          >
            {difficulty}
          </NeoBadge>
          <NeoBadge color="accent" size="sm">
            {multiplier}
          </NeoBadge>
          <p className="text-xs text-muted-foreground">
            {t("whoAmI.clueGuessMeta", {
              current: currentStage,
              total: TOTAL_CLUES,
              wrong: wrongGuessCount,
              max: maxGuesses,
            })}
          </p>
        </div>

        {hardMode && (
          <NeoCard color="default" className="mb-4 text-center py-3">
            <p className="font-heading font-bold text-sm">{t("whoAmI.hardModeTitle")}</p>
            <p className="font-body text-xs text-muted-foreground">{t("whoAmI.hardModeBody")}</p>
          </NeoCard>
        )}

        {/* Clue stack — QUESTION CONTENT, owns the column. */}
        <div className="space-y-3">
          {clues.map((clue, i) => (
            <NeoCard
              key={i}
              className="animate-slide-up"
              color={i === clues.length - 1 ? "blue" : "default"}
            >
              <div className="flex items-start gap-3">
                <div className="neo-border rounded-full bg-background w-8 h-8 flex items-center justify-center shrink-0">
                  <span className="font-mono font-bold text-sm text-foreground">{i + 1}</span>
                </div>
                <p className="font-body text-sm leading-relaxed">{clue}</p>
              </div>
            </NeoCard>
          ))}

          {/* Unrevealed clue placeholders */}
          {Array.from({ length: TOTAL_CLUES - currentStage }, (_, i) => (
            <NeoCard key={`placeholder-${i}`} className="opacity-30">
              <div className="flex items-start gap-3">
                <div className="neo-border rounded-full bg-muted w-8 h-8 flex items-center justify-center shrink-0">
                  <span className="font-mono font-bold text-sm text-muted-foreground">
                    {currentStage + i + 1}
                  </span>
                </div>
                <p className="font-body text-sm text-muted-foreground">???</p>
              </div>
            </NeoCard>
          ))}
        </div>

        {/* Action area */}
        {!gameOver && (
          <div className="mt-5 space-y-3">
            {closeCallShake && (
              <div className="neo-border rounded-lg bg-accent p-3 flex items-center gap-2 animate-shake-horizontal">
                <AlertTriangle size={16} />
                <p className="font-heading font-bold text-xs">{t("whoAmI.closeTryAgain")}</p>
              </div>
            )}

            {guessHistory.some((item) => item.feedback) && (
              <NeoCard color="default" className="p-3" data-testid="whoami-deduction-feedback">
                <p className="font-heading font-bold text-xs mb-2">{t("whoAmI.deductionBoard")}</p>
                <div className="space-y-2">
                  {guessHistory
                    .filter((item) => item.feedback)
                    .map((item, index) => (
                      <div
                        key={`${item.guessName}-${index}`}
                        className="neo-border rounded-md bg-background p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-heading font-bold text-xs truncate">{item.guessName}</p>
                          <p className="font-mono text-[10px]">
                            {t("whoAmI.points", { score: item.scoreAfter })}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] font-mono">
                          <span className={feedbackColor(item.feedback!.nationality)}>
                            {t("whoAmI.nationLabel", { mark: feedbackLabel(item.feedback!.nationality) })}
                          </span>
                          <span className={feedbackColor(item.feedback!.position)}>
                            {t("whoAmI.posLabel", { mark: feedbackLabel(item.feedback!.position) })}
                          </span>
                          <span className={feedbackColor(item.feedback!.team)}>
                            {t("whoAmI.clubLabel", { mark: feedbackLabel(item.feedback!.team) })}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </NeoCard>
            )}

            {/* Guess input */}
            <NeoInput
              ref={inputRef}
              placeholder={t("whoAmI.guessPlaceholder")}
              value={guess}
              onChange={(e) => {
                setGuess(e.target.value);
                setSelectedPlayerId(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitGuess()}
              className={closeCallShake ? "animate-shake-horizontal" : ""}
            />

            <div className="min-h-6" data-testid="whoami-player-autocomplete">
              {trimmedGuess.length > 0 && trimmedGuess.length < WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH && (
                <p className="text-xs text-muted-foreground font-body">
                  {t("whoAmI.suggestionsHint", { min: WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH })}
                </p>
              )}

              {playerSuggestions.length > 0 && (
                <div className="mt-2 neo-border bg-card rounded-lg overflow-hidden divide-y divide-border">
                  {playerSuggestions.map((player) => (
                    <button
                      key={player.playerId}
                      type="button"
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        selectedPlayerId === player.playerId
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hover:bg-muted"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setGuess(player.name);
                        setSelectedPlayerId(player.playerId);
                        inputRef.current?.focus();
                      }}
                    >
                      <p className="font-heading font-bold text-sm">{player.name}</p>
                      <p className="font-body text-[11px] opacity-80">
                        {[player.position, player.nationality, player.team].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NeoButton
                variant="primary"
                size="lg"
                onClick={handleSubmitGuess}
                disabled={!trimmedGuess || submitting}
              >
                <User size={16} className="mr-1" />
                {submitting ? t("whoAmI.checking") : t("whoAmI.guess")}
              </NeoButton>
              <NeoButton
                variant="accent"
                size="lg"
                onClick={handleRevealClue}
                disabled={currentStage >= TOTAL_CLUES || revealing}
              >
                <Eye size={16} className="mr-1" />
                {revealing
                  ? t("whoAmI.revealing")
                  : t("whoAmI.reveal", {
                      cost: currentStage >= TOTAL_CLUES ? t("whoAmI.revealMax") : t("whoAmI.revealCost"),
                    })}
              </NeoButton>
            </div>
          </div>
        )}

        {/* Result */}
        {gameOver && result && (
          <div className="mt-5 space-y-3 animate-slide-up">
            <NeoCard color={result.correct ? "success" : "destructive"} className="text-center py-5">
              <p className="font-heading font-bold text-xl">
                {result.correct ? t("whoAmI.resultCorrect") : t("whoAmI.resultWrong")}
              </p>
              {result.answerName && (
                <p className="font-body text-sm mt-1 opacity-90">
                  {t("whoAmI.itWas", { name: result.answerName })}
                </p>
              )}
              <p className="font-mono font-bold text-3xl mt-2">{result.score}</p>
              <p className="text-xs opacity-80 mt-1">{t("whoAmI.pointsEarned")}</p>
            </NeoCard>
            <div className="grid grid-cols-2 gap-3">
              <NeoButton variant="primary" size="lg" onClick={startGame}>
                {t("whoAmI.nextPlayer")}
              </NeoButton>
              <NeoButton variant="secondary" size="lg" onClick={() => navigate(SHELL_ROUTES.home)}>
                {t("whoAmI.home")}
              </NeoButton>
            </div>
          </div>
        )}
      </div>
    </PlayStage>
  );
}
