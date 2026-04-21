import { useState, useEffect, useRef, useCallback } from "react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
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
  maskedName?: string;
}

export default function SurvivalScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const { user } = useAuth();

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
  const useHintMut = useMutation(api.survivalSessions.useHint);
  const skipMut = useMutation(api.survivalSessions.skipChallenge);
  const completeSurvivalMut = useMutation(api.games.completeSurvival);
  const penalizeTabSwitchMut = useMutation(
    api.survivalSessions.penalizeTabSwitch,
  );

  useEffect(() => {
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
        toast.error("Failed to start survival");
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        toast.warning("CLOSE! Check your spelling.", { duration: 3000 });
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
          toast.warning(`TYPO ACCEPTED: Did you mean ${res.correctAnswer}?`, {
            duration: 3000,
          });
        }
        if (res.isHiddenAnswer) {
          toast.success("HIDDEN ANSWER FOUND! +BONUS", { duration: 4000 });
        }
        if (res.earnedLife) {
          setShowEarnedLife(true);
          setTimeout(() => setShowEarnedLife(false), 1500);
          toast.success("+1 LIFE", { duration: 3000 });
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
      toast.error("Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!sessionId || hintTokens <= 0 || hintStage >= 3) return;
    try {
      const nextStage = hintStage + 1;
      const res = await useHintMut({ sessionId, stage: nextStage });
      setHints((prev) => [...prev, res.hintText]);
      setHintStage(res.stage);
      setHintTokens(res.tokensLeft);
    } catch {
      toast.error("Failed to get hint");
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
      toast.error("Failed to skip");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Starting survival...
        </p>
      </div>
    );
  }

  const initials = challenge?.initials.split("") || [];

  return (
    <div
      key={shakeKey}
      className={`min-h-screen bg-background px-5 py-5 flex flex-col ${shakeKey > 0 ? "animate-shake" : ""} ${isOnFire ? "on-fire-bg" : ""}`}
    >
      {/* Header: Lives / Streak / Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <div className={`flex gap-1.5 ${lives === 1 ? "animate-pulse" : ""}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart
                key={i}
                size={24}
                strokeWidth={2.5}
                className={`neo-border rounded ${i < lives ? "fill-destructive text-destructive" : "text-muted"}`}
              />
            ))}
          </div>
          {showEarnedLife && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-success font-heading font-bold text-sm animate-float-up pointer-events-none">
              +1 LIFE
            </span>
          )}
        </div>
        {speedStreak >= 2 && (
          <div
            className={`neo-border rounded px-2 py-1 ${isOnFire ? "bg-destructive text-destructive-foreground animate-pulse-urgent" : "bg-primary text-primary-foreground"}`}
          >
            <span className="font-heading font-bold text-xs uppercase">
              {isOnFire ? "\u{1F525} ON FIRE" : `\u26A1 STREAK: x${speedStreak}`}
            </span>
          </div>
        )}
        <p className="font-mono font-bold text-lg">Score: {score}</p>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`neo-border rounded-lg p-3 mb-5 flex items-center gap-2 ${feedback.correct ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}
        >
          <span className="font-heading font-bold text-sm">
            {feedback.correct
              ? `Correct! ${feedback.answer}`
              : `Wrong! It was ${feedback.answer}`}
          </span>
        </div>
      )}

      {/* Initials card — panic state when 1 life */}
      <NeoCard
        shadow="lg"
        className={`flex flex-col items-center py-10 mb-5 ${
          lives === 1 ? "border-red-600 border-4 animate-pulse" : ""
        }`}
      >
        <p className="text-sm text-muted-foreground font-heading mb-4">
          Who has these initials?
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

        {/* Masked name boxes */}
        {challenge?.maskedName && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-5">
            {challenge.maskedName.split("").map((ch, i) =>
              ch === " " ? (
                <div key={i} className="w-3" />
              ) : (
                <div key={i} className="neo-border w-8 h-10 flex items-center justify-center bg-muted">
                  <span className="font-mono font-bold text-lg">_</span>
                </div>
              )
            )}
          </div>
        )}

        <NeoBadge color="blue" rotated>
          Round {round}
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
                <strong>Hint {i + 1}:</strong> {h}
              </p>
            </NeoCard>
          ))}
        </div>
      )}

      {/* Input — close call shake + panic glow */}
      <NeoInput
        placeholder="Type player name..."
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
        {submitting ? "Checking..." : "Submit Guess"}
      </NeoButton>

      {/* Hint + Skip */}
      <div className="grid grid-cols-2 gap-3">
        <NeoButton
          variant="blue"
          size="md"
          onClick={handleHint}
          disabled={hintTokens <= 0 || hintStage >= 3}
        >
          {hintTokens <= 0
            ? "No Hints Left"
            : `\u{1F4A1} Hint (${hintTokens})`}
        </NeoButton>
        <NeoButton
          variant={freeSkipsLeft > 0 ? "secondary" : "danger"}
          size="md"
          onClick={handleSkip}
        >
          {freeSkipsLeft > 0 ? `SKIP (${freeSkipsLeft} FREE)` : "SKIP (-1 LIFE)"}
        </NeoButton>
      </div>

      {/* Anti-cheat modal */}
      <Dialog open={showCheatModal} onOpenChange={setShowCheatModal}>
        <DialogContent className="neo-border neo-shadow-lg bg-destructive text-destructive-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-center">
              {"\u{1F6A8}"} CHEATING DETECTED {"\u{1F6A8}"}
            </DialogTitle>
            <DialogDescription className="text-destructive-foreground/90 text-center text-sm mt-2">
              You lost focus on the game window. 1 Life deducted.
            </DialogDescription>
          </DialogHeader>
          <NeoButton
            variant="secondary"
            size="full"
            onClick={() => setShowCheatModal(false)}
            className="mt-2"
          >
            I UNDERSTAND
          </NeoButton>
        </DialogContent>
      </Dialog>
    </div>
  );
}
