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

interface ChallengeData {
  initials: string;
  difficulty: string;
  hint: string;
}

export default function DailySurvivalScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"survivalSessions"> | null>(null);
  const [attemptId, setAttemptId] = useState<Id<"dailyAttempts"> | null>(null);
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
  const [forfeited, setForfeited] = useState(false);

  // Tiered hint state
  const [hints, setHints] = useState<string[]>([]);
  const [hintStage, setHintStage] = useState(0);
  const [hintTokens, setHintTokens] = useState(3);

  // Speed streak state
  const [speedStreak, setSpeedStreak] = useState(0);
  const [isOnFire, setIsOnFire] = useState(false);
  const performanceBonusRef = useRef(0);

  const startTime = useRef(Date.now());

  const getOrCreateChallengeMut = useMutation(api.dailyChallenge.getOrCreateChallenge);
  const startAttemptMut = useMutation(api.dailyChallenge.startAttempt);
  const forfeitMut = useMutation(api.dailyChallenge.forfeit);
  const completeAttemptMut = useMutation(api.dailyChallenge.completeAttempt);
  const startGameMut = useMutation(api.survivalSessions.startGame);
  const submitGuessMut = useMutation(api.survivalSessions.submitGuess);
  const useHintMut = useMutation(api.survivalSessions.useHint);
  const skipMut = useMutation(api.survivalSessions.skipChallenge);
  const completeSurvivalMut = useMutation(api.games.completeSurvival);

  useEffect(() => {
    (async () => {
      try {
        await getOrCreateChallengeMut({ sport, mode: "survival" });
        const { attemptId: aid } = await startAttemptMut({ sport, mode: "survival" });
        setAttemptId(aid);

        // Start a regular survival session for gameplay
        const data = await startGameMut({ sport });
        setSessionId(data.sessionId);
        setLives(data.lives);
        setScore(data.score);
        setRound(data.round);
        setChallenge(data.challenge);
        setHintTokens(data.hintTokensLeft);
        setLoading(false);
        startTime.current = Date.now();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        if (msg.includes("Already attempted")) {
          toast.error("You've already played today's survival!");
          navigate("/home", { replace: true });
        } else {
          toast.error(msg);
          navigate(-1);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anti-cheat: forfeit on tab switch (daily mode is strict)
  useAntiCheat(
    useCallback(() => {
      if (attemptId && !forfeited) {
        setForfeited(true);
        forfeitMut({ attemptId }).then(() => {
          toast.error("Challenge forfeited — you switched tabs!");
          navigate("/home", { replace: true });
        });
      }
    }, [attemptId, forfeited, forfeitMut, navigate]),
  );

  const goToResults = async (finalScore: number, finalRound: number) => {
    // Complete daily attempt
    if (attemptId) {
      try {
        await completeAttemptMut({ attemptId });
      } catch { /* continue */ }
    }
    // Also complete survival for ELO
    let eloChange: number | null = null;
    let newElo: number | null = null;
    if (user && sessionId) {
      try {
        const res = await completeSurvivalMut({ sessionId });
        eloChange = res.eloChange;
        newElo = res.newElo;
      } catch { /* continue */ }
    }

    navigate("/daily-results", {
      state: {
        score: finalScore,
        total: finalRound,
        correctCount: finalScore,
        sport,
        mode: "daily-survival" as const,
        eloChange,
        newElo,
      },
    });
  };

  const handleGuess = async () => {
    if (!guess.trim() || !sessionId) return;
    setSubmitting(true);
    try {
      const res = await submitGuessMut({ sessionId, guess: guess.trim() });
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
          Starting daily survival...
        </p>
      </div>
    );
  }

  const initials = challenge?.initials.split("") || [];
  const hintsAvailable = sport === "football";

  return (
    <div
      className={`min-h-screen bg-background px-5 py-5 flex flex-col ${isOnFire ? "on-fire-bg" : ""}`}
    >
      {/* Header: Lives / Daily badge / Streak / Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              size={24}
              strokeWidth={2.5}
              className={`neo-border rounded ${i < lives ? "fill-destructive text-destructive" : "text-muted"}`}
            />
          ))}
        </div>
        <NeoBadge color="pink" rotated>Daily</NeoBadge>
        {speedStreak >= 2 && (
          <div
            className={`neo-border rounded px-2 py-1 ${isOnFire ? "bg-destructive text-destructive-foreground animate-pulse-urgent" : "bg-primary text-primary-foreground"}`}
          >
            <span className="font-heading font-bold text-xs uppercase">
              {isOnFire ? "\u{1F525} ON FIRE" : `\u26A1 x${speedStreak}`}
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

      {/* Initials card */}
      <NeoCard shadow="lg" className="flex flex-col items-center py-10 mb-5">
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

      {/* Input */}
      <NeoInput
        placeholder="Type player name..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleGuess()}
        className={`mb-4 ${isOnFire ? "on-fire-input" : ""}`}
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
          disabled={!hintsAvailable || hintTokens <= 0 || hintStage >= 3}
        >
          {!hintsAvailable
            ? "Hints N/A"
            : hintTokens <= 0
              ? "No Hints Left"
              : `\u{1F4A1} Hint (${hintTokens})`}
        </NeoButton>
        <NeoButton variant="secondary" size="md" onClick={handleSkip}>
          Skip
        </NeoButton>
      </div>
    </div>
  );
}
