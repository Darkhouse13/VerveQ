import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ArrowLeft, Eye, User, AlertTriangle } from "lucide-react";

export default function WhoAmIScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const startChallengeMut = useMutation(api.whoAmI.startChallenge);
  const revealNextClueMut = useMutation(api.whoAmI.revealNextClue);
  const submitGuessMut = useMutation(api.whoAmI.submitGuess);

  const [sessionId, setSessionId] = useState<Id<"whoAmISessions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [clues, setClues] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState(1);
  const [score, setScore] = useState(1000);
  const [difficulty, setDifficulty] = useState("");
  const [guess, setGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<{
    correct: boolean;
    answerName?: string;
    score: number;
  } | null>(null);
  const [closeCallShake, setCloseCallShake] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const startGame = useCallback(async () => {
    setLoading(true);
    try {
      const res = await startChallengeMut({ sport });
      setSessionId(res.sessionId);
      setClues([res.clue1]);
      setCurrentStage(res.currentStage);
      setScore(res.score);
      setDifficulty(res.difficulty);
      setGuess("");
      setGameOver(false);
      setResult(null);
      setCloseCallShake(false);
    } catch (err) {
      console.error("Failed to start challenge:", err);
    } finally {
      setLoading(false);
    }
  }, [startChallengeMut, sport]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const handleRevealClue = async () => {
    if (!sessionId || currentStage >= 4 || revealing || gameOver) return;
    setRevealing(true);
    try {
      const res = await revealNextClueMut({ sessionId });
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
    if (!sessionId || !guess.trim() || submitting || gameOver) return;
    setSubmitting(true);
    try {
      const res = await submitGuessMut({ sessionId, guess: guess.trim() });

      if (res.closeCall) {
        setCloseCallShake(true);
        setTimeout(() => setCloseCallShake(false), 600);
        setSubmitting(false);
        return;
      }

      setResult({
        correct: res.correct,
        answerName: res.answerName,
        score: res.score,
      });
      setGameOver(true);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Score multiplier display
  const multiplier = currentStage === 1 ? "1x" : currentStage === 2 ? "0.75x" : currentStage === 3 ? "0.56x" : "0.42x";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading text-lg animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate("/home")}
          className="neo-border neo-shadow rounded-lg p-2 bg-background cursor-pointer active:neo-shadow-pressed transition-all"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2">
          <NeoBadge color="accent" size="sm">
            {multiplier}
          </NeoBadge>
          <NeoBadge color="primary" size="md">
            {score} pts
          </NeoBadge>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-5">
        <h2 className="font-heading font-bold text-2xl">Who Am I?</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <NeoBadge
            color={difficulty === "easy" ? "success" : difficulty === "medium" ? "accent" : "pink"}
            size="md"
          >
            {difficulty}
          </NeoBadge>
          <p className="text-xs text-muted-foreground">
            Clue {currentStage}/4
          </p>
        </div>
      </div>

      {/* Clue stack */}
      <div className="space-y-3 flex-1">
        {clues.map((clue, i) => (
          <NeoCard
            key={i}
            className="animate-slide-up"
            color={i === clues.length - 1 ? "blue" : "default"}
          >
            <div className="flex items-start gap-3">
              <div className="neo-border rounded-full bg-background w-8 h-8 flex items-center justify-center shrink-0">
                <span className="font-mono font-bold text-sm">{i + 1}</span>
              </div>
              <p className="font-body text-sm leading-relaxed">{clue}</p>
            </div>
          </NeoCard>
        ))}

        {/* Unrevealed clue placeholders */}
        {Array.from({ length: 4 - currentStage }, (_, i) => (
          <NeoCard
            key={`placeholder-${i}`}
            className="opacity-30"
          >
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
          {/* Close call feedback */}
          {closeCallShake && (
            <div className="neo-border rounded-lg bg-accent p-3 flex items-center gap-2 animate-shake-horizontal">
              <AlertTriangle size={16} />
              <p className="font-heading font-bold text-xs">Close! Try again</p>
            </div>
          )}

          {/* Guess input */}
          <NeoInput
            ref={inputRef}
            placeholder="Enter player name..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitGuess()}
            className={closeCallShake ? "animate-shake-horizontal" : ""}
          />

          <div className="grid grid-cols-2 gap-3">
            <NeoButton
              variant="primary"
              size="lg"
              onClick={handleSubmitGuess}
              disabled={!guess.trim() || submitting}
            >
              <User size={16} className="mr-1" />
              Guess
            </NeoButton>
            <NeoButton
              variant="accent"
              size="lg"
              onClick={handleRevealClue}
              disabled={currentStage >= 4 || revealing}
            >
              <Eye size={16} className="mr-1" />
              Reveal ({currentStage >= 4 ? "Max" : "-25%"})
            </NeoButton>
          </div>
        </div>
      )}

      {/* Result */}
      {gameOver && result && (
        <div className="mt-5 space-y-3 animate-slide-up">
          <NeoCard
            color={result.correct ? "success" : "destructive"}
            className="text-center py-5"
          >
            <p className="font-heading font-bold text-xl">
              {result.correct ? "Correct!" : "Wrong!"}
            </p>
            {result.answerName && (
              <p className="font-body text-sm mt-1 opacity-90">
                It was {result.answerName}
              </p>
            )}
            <p className="font-mono font-bold text-3xl mt-2">{result.score}</p>
            <p className="text-xs opacity-80 mt-1">Points earned</p>
          </NeoCard>
          <div className="grid grid-cols-2 gap-3">
            <NeoButton variant="primary" size="lg" onClick={startGame}>
              Next Player
            </NeoButton>
            <NeoButton variant="secondary" size="lg" onClick={() => navigate("/home")}>
              Home
            </NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
