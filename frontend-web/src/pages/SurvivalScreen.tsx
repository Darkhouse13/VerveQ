import { useState, useEffect, useRef } from "react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import type { GameResultState } from "@/types/api";

interface ChallengeData {
  initials: string;
  difficulty: string;
  hint: string;
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
  const [hintPlayers, setHintPlayers] = useState<string[] | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const startTime = useRef(Date.now());

  const startGameMut = useMutation(api.survivalSessions.startGame);
  const submitGuessMut = useMutation(api.survivalSessions.submitGuess);
  const useHintMut = useMutation(api.survivalSessions.useHint);
  const skipMut = useMutation(api.survivalSessions.skipChallenge);
  const completeSurvivalMut = useMutation(api.games.completeSurvival);

  useEffect(() => {
    (async () => {
      try {
        const data = await startGameMut({ sport });
        setSessionId(data.sessionId);
        setLives(data.lives);
        setScore(data.score);
        setRound(data.round);
        setChallenge(data.challenge);
        setLoading(false);
        startTime.current = Date.now();
      } catch {
        toast.error("Failed to start survival");
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToResults = async (finalScore: number, finalRound: number) => {
    let eloChange: number | null = null;
    let newElo: number | null = null;
    if (user) {
      try {
        const dur = Math.round((Date.now() - startTime.current) / 1000);
        const res = await completeSurvivalMut({
          sport,
          score: finalScore,
          durationSeconds: dur,
        });
        eloChange = res.eloChange;
        newElo = res.newElo;
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
      setFeedback({ correct: res.correct, answer: res.correctAnswer });
      setLives(res.lives);
      setScore(res.score);
      setRound(res.round);
      setGuess("");
      if (res.gameOver) {
        goToResults(res.score, res.round);
      } else if (res.nextChallenge) {
        setTimeout(() => {
          setChallenge(res.nextChallenge!);
          setFeedback(null);
          setHintPlayers(null);
        }, 1500);
      }
    } catch {
      toast.error("Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHint = async () => {
    if (!sessionId || hintUsed) return;
    try {
      const res = await useHintMut({ sessionId });
      setHintPlayers(res.samplePlayers);
      setHintUsed(true);
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
      setHintPlayers(null);
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
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
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
        <p className="font-mono font-bold text-lg">Score: {score}</p>
      </div>

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

      {hintPlayers && (
        <NeoCard color="blue" className="mb-4 animate-slide-up">
          <p className="text-xs font-body">
            <strong>Hint:</strong> Some players: {hintPlayers.join(", ")}
          </p>
        </NeoCard>
      )}

      <NeoInput
        placeholder="Type player name..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleGuess()}
        className="mb-4"
      />

      <NeoButton
        variant="primary"
        size="full"
        className="mb-3"
        onClick={handleGuess}
        disabled={!guess.trim() || submitting}
      >
        {submitting ? "Checking..." : "Submit Guess"}
      </NeoButton>

      <div className="grid grid-cols-2 gap-3">
        <NeoButton
          variant="blue"
          size="md"
          onClick={handleHint}
          disabled={hintUsed}
        >
          {hintUsed ? "Hint Used" : "Use Hint"}
        </NeoButton>
        <NeoButton variant="secondary" size="md" onClick={handleSkip}>
          Skip
        </NeoButton>
      </div>
    </div>
  );
}
