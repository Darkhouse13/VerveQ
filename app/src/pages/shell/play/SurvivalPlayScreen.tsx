/**
 * Survival (solo) on the v2 shell — a PRESENTATION-ONLY reskin of the live
 * `SurvivalScreen` into the centered-column "prototype layout".
 *
 * Survival is protected: the game loop here is a faithful port of the live
 * screen. Every gameplay decision stays server-authoritative and UNCHANGED —
 * `survivalSessions.startGame / submitGuess / useHint / skipChallenge`,
 * `games.completeSurvival`, the close-call / typo / hidden-answer / earned-life
 * outcomes, and the tab-switch anti-cheat all behave exactly as on the live
 * screen. Fuzzy matching, valid answers, and hint content live on the server and
 * are not touched. Only the layout changes: the initials, hints, input, and
 * actions own the answering column; lives / streak / score move to the ambient
 * rail (the allowlisted ambient fields), content-blind by contract.
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
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tiered hint state
  const [hints, setHints] = useState<string[]>([]);
  const [hintStage, setHintStage] = useState(0);
  const [hintTokens, setHintTokens] = useState(3);
  const [hintLoading, setHintLoading] = useState(false);

  // Speed streak state
  const [speedStreak, setSpeedStreak] = useState(0);
  const [isOnFire, setIsOnFire] = useState(false);
  const performanceBonusRef = useRef(0);

  // Free skip state
  const [freeSkipsLeft, setFreeSkipsLeft] = useState(1);

  // Close call state
  const [closeCallShake, setCloseCallShake] = useState(false);

  // Earn-a-life animation
  const [showEarnedLife, setShowEarnedLife] = useState(false);

  // Anti-cheat state
  const [showCheatModal, setShowCheatModal] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const startTime = useRef(Date.now());

  const startGameMut = useMutation(api.survivalSessions.startGame);
  const submitGuessMut = useMutation(api.survivalSessions.submitGuess);
  const hintMutation = useMutation(api.survivalSessions.useHint);
  const skipMut = useMutation(api.survivalSessions.skipChallenge);
  const completeSurvivalMut = useMutation(api.games.completeSurvival);
  const penalizeTabSwitchMut = useMutation(
    api.survivalSessions.penalizeTabSwitch,
  );

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
        setChallenge(data.challenge);
        setHintTokens(data.hintTokensLeft);
        setFreeSkipsLeft(data.freeSkipsLeft);
        setLoading(false);
        startTime.current = Date.now();
      } catch {
        toast.error(t("survival.failedToStart"));
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Anti-cheat: penalize tab switching
  useAntiCheat(
    useCallback(() => {
      if (!sessionId || !challenge) return;
      penalizeTabSwitchMut({ sessionId, currentRound: round }).then((res) => {
        if (res.penalized) {
          setLives(res.lives);
          setShakeKey((k) => k + 1);
          setShowCheatModal(true);
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
      correctCount: finalScore,
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

      // Close call: shake input, don't clear, don't set feedback
      if (res.closeCall) {
        setCloseCallShake(true);
        setTimeout(() => setCloseCallShake(false), 600);
        toast.warning(t("survival.closeCheckSpelling"), { duration: 3000 });
        setSubmitting(false);
        return;
      }

      setFeedback({ correct: res.correct, answer: res.correctAnswer });
      setLives(res.lives);
      setScore(res.score);
      setRound(res.round);
      setGuess("");

      if (res.correct) {
        setSpeedStreak(res.speedStreak ?? 0);
        setIsOnFire(res.isOnFire ?? false);
        if (res.isOnFire) {
          performanceBonusRef.current += 0.1;
        }
        if (res.typoAccepted) {
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
        setTimeout(() => {
          setChallenge(res.nextChallenge!);
          setFeedback(null);
          setHints([]);
          setHintStage(0);
        }, 1500);
      }
    } catch {
      toast.error(t("survival.failedToSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!sessionId || hintTokens <= 0 || hintStage >= 3 || hintLoading) return;
    setHintLoading(true);
    try {
      const nextStage = hintStage + 1;
      const res = await hintMutation({ sessionId, stage: nextStage });
      setHints((prev) => [...prev, res.hintText]);
      setHintStage(res.stage);
      setHintTokens(res.tokensLeft);
    } catch {
      toast.error(t("survival.failedToGetHint"));
    } finally {
      setHintLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!sessionId) return;
    try {
      const res = await skipMut({ sessionId });
      setLives(res.lives);
      setFreeSkipsLeft(res.freeSkipsLeft);
      setFeedback(null);
      setHints([]);
      setHintStage(0);
      setSpeedStreak(0);
      setIsOnFire(false);
      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.challenge) {
        setChallenge(res.challenge);
        setRound(res.round);
      }
    } catch {
      toast.error(t("survival.failedToSkip"));
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
                ? t("survival.correct", { answer: feedback.answer })
                : t("survival.wrong", { answer: feedback.answer })}
            </span>
          </div>
        )}

        {/* Initials card — panic state when 1 life */}
        <NeoCard
          shadow="lg"
          className={`relative flex flex-col items-center py-10 mb-5 ${
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
          <div className="flex gap-4 mb-6">
            {initials.map((letter, i) => (
              <div
                key={i}
                className="neo-border neo-shadow-lg rounded-xl w-20 h-20 flex items-center justify-center bg-primary text-primary-foreground"
              >
                <span className="font-heading font-bold text-4xl">{letter}</span>
              </div>
            ))}
          </div>

          <NeoBadge color="blue" rotated>
            {t("survival.round", { round })}
          </NeoBadge>
        </NeoCard>

        {/* Hints tracker */}
        {hints.length > 0 && (
          <div className="space-y-2 mb-4">
            {hints.map((h, i) => (
              <NeoCard
                key={i}
                color={i === 0 ? "blue" : i === 1 ? "accent" : "primary"}
                className="animate-slide-up"
              >
                <p className="text-xs font-body">
                  <strong>{t("survival.hintLabel", { number: i + 1 })}</strong>{" "}
                  {h}
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

        {/* Hint + Skip */}
        <div className="grid grid-cols-2 gap-3">
          <NeoButton
            variant="blue"
            size="md"
            onClick={handleHint}
            disabled={hintTokens <= 0 || hintStage >= 3 || hintLoading}
          >
            {hintLoading
              ? t("survival.fetchingHint")
              : hintTokens <= 0
                ? t("survival.noHintsLeft")
                : t("survival.hint", { count: hintTokens })}
          </NeoButton>
          <NeoButton
            variant={freeSkipsLeft > 0 ? "secondary" : "danger"}
            size="md"
            onClick={handleSkip}
          >
            {freeSkipsLeft > 0
              ? t("survival.skipFree", { count: freeSkipsLeft })
              : t("survival.skipLife")}
          </NeoButton>
        </div>
      </div>

      {/* Anti-cheat modal */}
      <Dialog open={showCheatModal} onOpenChange={setShowCheatModal}>
        <DialogContent className="neo-border neo-shadow-lg bg-destructive text-destructive-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">
              {"\u{1F6A8}"} {t("survival.cheatingDetected")} {"\u{1F6A8}"}
            </DialogTitle>
            <DialogDescription className="text-destructive-foreground/90 text-center text-sm mt-2">
              {t("survival.cheatingDescription")}
            </DialogDescription>
          </DialogHeader>
          <NeoButton
            variant="secondary"
            size="full"
            onClick={() => setShowCheatModal(false)}
            className="mt-2"
          >
            {t("survival.iUnderstand")}
          </NeoButton>
        </DialogContent>
      </Dialog>
    </PlayStage>
  );
}
