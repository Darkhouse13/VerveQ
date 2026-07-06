/**
 * Survival (solo) on the v2 shell — the REVEAL LADDER edition.
 *
 * Survival is protected: every gameplay decision stays server-authoritative —
 * `survivalSessions.startGame / submitGuess / requestHelp / skipChallenge /
 * endRun`, `games.completeSurvival`, and the tab-switch anti-cheat all live on
 * the server. The client only renders what the server projects: the initials,
 * the masked name (letters are filled in exclusively by server-side help-ladder
 * responses — the full name never reaches the client while a round is live),
 * the current pot, and the outcome flags (close call / ambiguous surname /
 * typo / hidden answer / earned life).
 *
 * Reveal Ladder rules, for orientation:
 * - each round is a pot (Easy 100 → Expert 300) that shrinks 15% of base per
 *   help press and floors at 10, so every round is finishable;
 * - one HELP button: 2 metadata clues, then letter-by-letter reveals;
 * - lives are only lost on committed wrong guesses (skips are free, budget 3);
 * - CASH OUT ends the run voluntarily and banks the score into ELO/results.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { GameResultState } from "@/types/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ChallengeData {
  initials: string;
  difficulty: string;
  hint: string;
  maskedName: string;
  basePot: number;
  potValue: number;
  lettersRemaining: number;
}

interface ClueI18n {
  key: string;
  vars: Record<string, string | number>;
}

const MASK_CHAR = "•";
/** Ladder stages 1-2 are clues; must mirror CLUE_STAGES on the server. */
const CLUE_STAGES = 2;

/** The masked name as tappable-looking letter boxes, word by word. */
function MaskedName({ maskedName }: { maskedName: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-2">
      {maskedName.split(" ").map((word, wi) => (
        <div key={wi} className="flex gap-1">
          {Array.from(word).map((char, ci) =>
            char === MASK_CHAR ? (
              <div
                key={ci}
                className="neo-border rounded w-7 h-9 bg-muted"
                aria-hidden
              />
            ) : /\p{L}|\p{N}/u.test(char) ? (
              <div
                key={ci}
                className="neo-border rounded w-7 h-9 flex items-center justify-center bg-primary text-primary-foreground"
              >
                <span className="font-heading font-bold text-sm">{char}</span>
              </div>
            ) : (
              <span
                key={ci}
                className="w-3 h-9 flex items-center justify-center font-heading font-bold text-sm"
              >
                {char}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

export default function SurvivalPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"survivalSessions"> | null>(
    null,
  );
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    answer: string;
    points: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Reveal Ladder round state — updated by requestHelp responses and reset
  // whenever a fresh challenge arrives.
  const [maskedName, setMaskedName] = useState("");
  const [potValue, setPotValue] = useState(0);
  const [basePot, setBasePot] = useState(0);
  const [lettersRemaining, setLettersRemaining] = useState(0);
  const [helpStage, setHelpStage] = useState(0);
  const [clues, setClues] = useState<ClueI18n[]>([]);
  const [helpLoading, setHelpLoading] = useState(false);

  // Speed streak state
  const [speedStreak, setSpeedStreak] = useState(0);
  const [isOnFire, setIsOnFire] = useState(false);
  const correctCountRef = useRef(0);

  // Skip budget (free — lives are never lost on skips)
  const [skipsLeft, setSkipsLeft] = useState(3);

  // Close call state
  const [closeCallShake, setCloseCallShake] = useState(false);

  // Earn-a-life animation
  const [showEarnedLife, setShowEarnedLife] = useState(false);

  // Anti-cheat state: first offense is a warning (pot floored), repeats cost a life
  const [cheatModal, setCheatModal] = useState<"warning" | "penalty" | null>(
    null,
  );
  const [shakeKey, setShakeKey] = useState(0);
  const [endingRun, setEndingRun] = useState(false);

  const startTime = useRef(Date.now());

  const startGameMut = useMutation(api.survivalSessions.startGame);
  const submitGuessMut = useMutation(api.survivalSessions.submitGuess);
  const helpMutation = useMutation(api.survivalSessions.requestHelp);
  const skipMut = useMutation(api.survivalSessions.skipChallenge);
  const endRunMut = useMutation(api.survivalSessions.endRun);
  const completeSurvivalMut = useMutation(api.games.completeSurvival);
  const penalizeTabSwitchMut = useMutation(
    api.survivalSessions.penalizeTabSwitch,
  );

  const applyChallenge = useCallback((next: ChallengeData) => {
    setChallenge(next);
    setMaskedName(next.maskedName);
    setPotValue(next.potValue);
    setBasePot(next.basePot);
    setLettersRemaining(next.lettersRemaining);
    setHelpStage(0);
    setClues([]);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        const data = await startGameMut({ sport });
        setSessionId(data.sessionId);
        setLives(data.lives);
        setScore(data.score);
        setRound(data.round);
        setSkipsLeft(data.skipsLeft);
        applyChallenge(data.challenge);
        setLoading(false);
        startTime.current = Date.now();
      } catch {
        toast.error(t("survival.failedToStart"));
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Anti-cheat: warn first (pot floored), penalize repeats
  useAntiCheat(
    useCallback(() => {
      if (!sessionId || !challenge) return;
      penalizeTabSwitchMut({ sessionId, currentRound: round }).then((res) => {
        if (!res.penalized) return;
        setShakeKey((k) => k + 1);
        if (res.warning) {
          setCheatModal("warning");
          if (typeof res.potValue === "number") setPotValue(res.potValue);
        } else {
          setCheatModal("penalty");
          setLives(res.lives);
          if (res.gameOver) {
            setTimeout(() => goToResults(score, round), 2000);
          }
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, round, challenge]),
    { warningMessage: t("survival.tabSwitchWarning") },
  );

  const goToResults = async (finalScore: number, finalRound: number) => {
    let eloChange: number | null = null;
    let newElo: number | null = null;
    let kFactor: number | undefined;
    let kFactorLabel: string | undefined;
    if (user && sessionId) {
      try {
        const res = await completeSurvivalMut({ sessionId });
        eloChange = res.eloChange;
        newElo = res.newElo;
        kFactor = res.kFactor;
        kFactorLabel = res.kFactorLabel;
      } catch {
        /* continue */
      }
    }
    const state: GameResultState = {
      score: finalScore,
      total: finalRound,
      correctCount: correctCountRef.current,
      avgTime: 0,
      eloChange,
      newElo,
      sport,
      mode: "survival",
      kFactor,
      kFactorLabel,
    };
    navigate("/results", { state });
  };

  const handleGuess = async () => {
    if (!guess.trim() || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await submitGuessMut({
        sessionId,
        guess: guess.trim(),
      });

      // Close call / ambiguous surname: shake, keep input, free retry
      if (res.closeCall) {
        setCloseCallShake(true);
        setTimeout(() => setCloseCallShake(false), 600);
        toast.warning(
          res.ambiguousSurname
            ? t("survival.ambiguousSurname")
            : t("survival.closeCheckSpelling"),
          { duration: 3000 },
        );
        setSubmitting(false);
        return;
      }

      setFeedback({
        correct: res.correct,
        answer: res.correctAnswer ?? "",
        points: res.pointsEarned,
      });
      setLives(res.lives);
      setScore(res.score);
      setRound(res.round);
      setGuess("");

      if (res.correct) {
        correctCountRef.current += 1;
        setSpeedStreak(res.speedStreak ?? 0);
        setIsOnFire(res.isOnFire ?? false);
        if (res.surnameMatch) {
          toast.success(
            t("survival.surnameAccepted", { answer: res.correctAnswer }),
            { duration: 3000 },
          );
        } else if (res.typoAccepted) {
          toast.warning(
            t("survival.typoAccepted", { answer: res.correctAnswer }),
            {
              duration: 3000,
            },
          );
        }
        if (res.isHiddenAnswer) {
          toast.success(t("survival.hiddenAnswerFound"), { duration: 4000 });
        }
        if (res.earnedLife) {
          setShowEarnedLife(true);
          setTimeout(() => setShowEarnedLife(false), 1500);
          toast.success(t("survival.plusOneLife"), { duration: 3000 });
        }
      } else {
        setSpeedStreak(0);
        setIsOnFire(false);
      }

      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.nextChallenge) {
        const next = res.nextChallenge;
        setTimeout(() => {
          applyChallenge(next);
          setFeedback(null);
        }, 1500);
      }
    } catch {
      toast.error(t("survival.failedToSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const helpExhausted = helpStage >= CLUE_STAGES && lettersRemaining <= 0;

  const handleHelp = async () => {
    if (!sessionId || helpLoading || helpExhausted) return;
    setHelpLoading(true);
    try {
      const res = await helpMutation({ sessionId });
      if (res.kind === "clue" && res.hintI18n) {
        setClues((prev) => [...prev, res.hintI18n as ClueI18n]);
      }
      setMaskedName(res.maskedName);
      setPotValue(res.potValue);
      setLettersRemaining(res.lettersRemaining);
      setHelpStage(res.stage);
    } catch {
      toast.error(t("survival.failedToGetHelp"));
    } finally {
      setHelpLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!sessionId || skipsLeft <= 0) return;
    try {
      const res = await skipMut({ sessionId });
      setSkipsLeft(res.skipsLeft);
      setFeedback(null);
      setSpeedStreak(0);
      setIsOnFire(false);
      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.challenge) {
        applyChallenge(res.challenge);
        setRound(res.round);
      }
    } catch {
      toast.error(t("survival.failedToSkip"));
    }
  };

  const handleCashOut = async () => {
    if (!sessionId || endingRun) return;
    setEndingRun(true);
    try {
      const res = await endRunMut({ sessionId });
      await goToResults(res.score, res.round);
    } catch {
      toast.error(t("survival.failedToCashOut"));
      setEndingRun(false);
    }
  };

  const metrics = { score, lives, streak: speedStreak };

  if (loading) {
    return (
      <PlayStage
        title={t("survival.title")}
        onExit={() => navigate(SHELL_ROUTES.home)}
      >
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">
            {t("survival.starting")}
          </p>
        </div>
      </PlayStage>
    );
  }

  const initials = challenge?.initials.split("") || [];

  return (
    <PlayStage
      title={t("survival.title")}
      subtitle={t("survival.round", { round })}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("survival.quit")}
      strip={<AmbientStrip metrics={metrics} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      <div
        key={shakeKey}
        className={`flex flex-col ${shakeKey > 0 ? "animate-shake" : ""} ${isOnFire ? "on-fire-bg" : ""}`}
      >
        {/* On-fire / streak banner — Survival's signature flair, kept in column. */}
        {speedStreak >= 2 && (
          <div className="flex justify-center mb-4">
            <div
              className={`neo-border rounded px-3 py-1.5 ${isOnFire ? "bg-destructive text-destructive-foreground animate-pulse-urgent" : "bg-primary text-primary-foreground"}`}
            >
              <span className="font-heading font-bold text-xs uppercase">
                {isOnFire
                  ? t("survival.onFire")
                  : t("survival.streak", { count: speedStreak })}
              </span>
            </div>
          </div>
        )}

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`neo-border rounded-lg p-3 mb-4 flex items-center gap-2 ${feedback.correct ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
          >
            <span className="font-heading font-bold text-sm">
              {feedback.correct
                ? t("survival.correctPoints", {
                    answer: feedback.answer,
                    points: feedback.points,
                  })
                : t("survival.wrong", { answer: feedback.answer })}
            </span>
          </div>
        )}

        {/* Initials + masked name card — panic state when 1 life */}
        <NeoCard
          shadow="lg"
          className={`relative flex flex-col items-center py-8 mb-5 ${
            lives === 1 ? "border-red-600 border-4 animate-pulse" : ""
          }`}
        >
          {showEarnedLife && (
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-success font-heading font-bold text-sm animate-float-up pointer-events-none">
              {t("survival.plusOneLife")}
            </span>
          )}
          <p className="text-sm text-muted-foreground font-heading mb-4">
            {t("survival.whoHasInitials")}
          </p>
          <div className="flex gap-4 mb-2">
            {initials.map((letter, i) => (
              <div
                key={i}
                className="neo-border neo-shadow-lg rounded-xl w-20 h-20 flex items-center justify-center bg-primary text-primary-foreground"
              >
                <span className="font-heading font-bold text-4xl">{letter}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-body mb-4">
            {t("survival.anyPlayerCounts")}
          </p>

          {/* The Reveal Ladder mask stays hidden until help is requested —
              shown up front, the name's letter boxes read as a constraint on
              the answer, when really any player with the initials counts.
              Once visible it is labelled as the famous-match hint target. */}
          {helpStage > 0 && maskedName && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground font-heading uppercase mb-2">
                {t("survival.maskLabel")}
              </p>
              <MaskedName maskedName={maskedName} />
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <NeoBadge color={potValue < basePot ? "accent" : "success"} rotated>
              {t("survival.pot", { points: potValue })}
            </NeoBadge>
            <NeoBadge color="blue" rotated>
              {t("survival.round", { round })}
            </NeoBadge>
          </div>
        </NeoCard>

        {/* Clues from the help ladder — one caption states the target so the
            bare facts below don't read as random noise. */}
        {clues.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground font-body">
              {t("survival.hintsTarget")}
            </p>
            {clues.map((h, i) => (
              <NeoCard
                key={i}
                color={i === 0 ? "blue" : "accent"}
                className="animate-slide-up"
              >
                <p className="text-xs font-body">
                  <strong>{t("survival.clueLabel", { number: i + 1 })}</strong>{" "}
                  {t(
                    `survival.hintBody.${h.key}`,
                    // `sport` is the only var that localizes (small closed enum);
                    // all other vars are canonical proper nouns, passed through.
                    "sport" in h.vars
                      ? { ...h.vars, sport: t(`survival.sportName.${h.vars.sport}`) }
                      : h.vars,
                  )}
                </p>
              </NeoCard>
            ))}
          </div>
        )}

        {/* Input — close call shake + panic glow */}
        <NeoInput
          placeholder={t("survival.inputPlaceholder")}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGuess()}
          className={`mb-4 ${isOnFire ? "on-fire-input" : ""} ${closeCallShake ? "border-yellow-400 border-4 animate-shake-horizontal" : ""}`}
        />

        {/* Submit */}
        <NeoButton
          variant="primary"
          size="full"
          className="mb-3"
          onClick={handleGuess}
          disabled={!guess.trim() || submitting}
        >
          {submitting ? t("survival.checking") : t("survival.submitGuess")}
        </NeoButton>

        {/* Help + Skip + Cash Out */}
        <div className="grid grid-cols-3 gap-3">
          <NeoButton
            variant="blue"
            size="md"
            onClick={handleHelp}
            disabled={helpLoading || helpExhausted}
          >
            {helpLoading
              ? t("survival.gettingHelp")
              : helpExhausted
                ? t("survival.nothingToReveal")
                : helpStage < CLUE_STAGES
                  ? t("survival.helpClue")
                  : t("survival.helpLetter")}
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="md"
            onClick={handleSkip}
            disabled={skipsLeft <= 0}
          >
            {skipsLeft > 0
              ? t("survival.skip", { count: skipsLeft })
              : t("survival.noSkipsLeft")}
          </NeoButton>
          <NeoButton
            variant="accent"
            size="md"
            onClick={handleCashOut}
            disabled={endingRun}
          >
            {endingRun ? t("survival.cashingOut") : t("survival.cashOut")}
          </NeoButton>
        </div>
      </div>

      {/* Anti-cheat modal: warning (pot floored) vs penalty (life lost) */}
      <Dialog
        open={cheatModal !== null}
        onOpenChange={(open) => !open && setCheatModal(null)}
      >
        <DialogContent
          className={`neo-border neo-shadow-lg max-w-sm ${cheatModal === "warning" ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground"}`}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">
              {cheatModal === "warning"
                ? `⚠️ ${t("survival.tabSwitchCaughtTitle")} ⚠️`
                : `\u{1F6A8} ${t("survival.cheatingDetected")} \u{1F6A8}`}
            </DialogTitle>
            <DialogDescription
              className={`text-center text-sm mt-2 ${cheatModal === "warning" ? "text-accent-foreground/90" : "text-destructive-foreground/90"}`}
            >
              {cheatModal === "warning"
                ? t("survival.tabSwitchWarningDescription")
                : t("survival.cheatingDescription")}
            </DialogDescription>
          </DialogHeader>
          <NeoButton
            variant="secondary"
            size="full"
            onClick={() => setCheatModal(null)}
            className="mt-2"
          >
            {t("survival.iUnderstand")}
          </NeoButton>
        </DialogContent>
      </Dialog>
    </PlayStage>
  );
}
