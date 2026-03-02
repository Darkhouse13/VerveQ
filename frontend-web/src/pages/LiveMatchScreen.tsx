import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { RoundResult } from "@/components/RoundResult";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { Check, X } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export default function LiveMatchScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get("matchId") as Id<"liveMatches"> | null;

  const [showCountdown, setShowCountdown] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [myResult, setMyResult] = useState<{
    correct: boolean;
    score: number;
  } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(10);
  const prevQuestionRef = useRef(-1);

  const match = useQuery(
    api.liveMatches.getMatch,
    matchId ? { matchId } : "skip",
  );

  const submitAnswerMut = useMutation(api.liveMatches.submitAnswer);
  const heartbeatMut = useMutation(api.liveMatches.heartbeat);
  const forfeitMut = useMutation(api.liveMatches.forfeit);

  // Heartbeat
  useEffect(() => {
    if (!matchId) return;
    const id = setInterval(() => heartbeatMut({ matchId }), 5000);
    return () => clearInterval(id);
  }, [matchId, heartbeatMut]);

  // Anti-cheat: forfeit on tab switch
  useAntiCheat(
    useCallback(() => {
      if (matchId && match && match.status !== "completed" && match.status !== "forfeited") {
        forfeitMut({ matchId });
      }
    }, [matchId, match, forfeitMut]),
  );

  // Reset state when question changes
  useEffect(() => {
    if (!match) return;
    if (match.currentQuestion !== prevQuestionRef.current) {
      prevQuestionRef.current = match.currentQuestion;
      setSelected(null);
      setRevealed(false);
      setMyResult(null);
      setQuestionTimer(10);
    }
  }, [match?.currentQuestion, match]);

  // Question countdown timer
  useEffect(() => {
    if (!match || match.status !== "question") return;
    const id = setInterval(() => {
      if (match.questionStartedAt) {
        const elapsed = (Date.now() - match.questionStartedAt) / 1000;
        setQuestionTimer(Math.max(0, Math.ceil(10 - elapsed)));
      }
    }, 100);
    return () => clearInterval(id);
  }, [match?.status, match?.questionStartedAt, match]);

  // Handle match completion
  useEffect(() => {
    if (!match) return;
    if (match.status === "completed" || match.status === "forfeited") {
      const isWinner = match.winnerId === (match.isPlayer1 ? match.player1.id : match.player2.id);
      navigate("/results", {
        state: {
          score: match.isPlayer1 ? match.player1Score : match.player2Score,
          total: match.totalQuestions,
          correctCount: (match.myAnswers as Array<{ correct: boolean }>).filter((a) => a?.correct).length,
          avgTime: 0,
          eloChange: null,
          newElo: null,
          sport: match.sport,
          mode: "quiz" as const,
        },
        replace: true,
      });
    }
  }, [match?.status, match, navigate]);

  const handleSelect = async (idx: number) => {
    if (selected !== null || !match || !matchId || match.status !== "question")
      return;
    setSelected(idx);
    setRevealed(true);

    const currentQ = match.questions[match.currentQuestion] as {
      options: string[];
    };
    const answer = currentQ.options[idx];

    try {
      const res = await submitAnswerMut({ matchId, answer });
      setMyResult(res);
      if (!res.correct) {
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
      }
    } catch {
      // Already answered or match ended
    }
  };

  if (!matchId) {
    navigate("/home", { replace: true });
    return null;
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Loading match...
        </p>
      </div>
    );
  }

  // Show countdown overlay
  if (showCountdown && match.status === "countdown") {
    return <CountdownOverlay onComplete={() => setShowCountdown(false)} />;
  }

  // Show round result
  if (match.status === "roundResult") {
    const p1Answers = match.isPlayer1
      ? (match.myAnswers as Array<{ correct: boolean; score: number; timeTaken: number }>)
      : [];
    const p2Answers = !match.isPlayer1
      ? (match.myAnswers as Array<{ correct: boolean; score: number; timeTaken: number }>)
      : [];

    const qIdx = match.currentQuestion;
    const p1Answer = p1Answers[qIdx] || { correct: false, score: 0, timeTaken: 10 };
    const p2Answer = p2Answers[qIdx] || { correct: false, score: 0, timeTaken: 10 };

    return (
      <RoundResult
        questionNum={match.currentQuestion + 1}
        player1={{
          name: match.player1.username,
          correct: p1Answer.correct,
          score: p1Answer.score,
          timeTaken: p1Answer.timeTaken,
        }}
        player2={{
          name: match.player2.username,
          correct: p2Answer.correct,
          score: p2Answer.score,
          timeTaken: p2Answer.timeTaken,
        }}
        player1Total={match.player1Score}
        player2Total={match.player2Score}
      />
    );
  }

  const currentQ = match.questions[match.currentQuestion] as {
    question: string;
    options: string[];
  } | undefined;

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg">Waiting for question...</p>
      </div>
    );
  }

  const me = match.isPlayer1 ? match.player1 : match.player2;
  const opponent = match.isPlayer1 ? match.player2 : match.player1;
  const myScore = match.isPlayer1 ? match.player1Score : match.player2Score;
  const oppScore = match.isPlayer1 ? match.player2Score : match.player1Score;

  const opponentStatusText =
    match.opponentStatus === "lockedIn"
      ? "Locked In!"
      : match.opponentStatus === "answeredIncorrectly"
        ? "Answered Incorrectly!"
        : "Thinking...";

  const opponentStatusColor =
    match.opponentStatus === "lockedIn"
      ? "text-success"
      : match.opponentStatus === "answeredIncorrectly"
        ? "text-destructive"
        : "text-muted-foreground";

  const letters = ["A", "B", "C", "D"];

  const getOptionStyle = (idx: number) => {
    if (!revealed) return "bg-card text-card-foreground";
    if (myResult?.correct && idx === selected)
      return "bg-success text-success-foreground";
    if (!myResult?.correct && idx === selected)
      return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center">
          <p className="font-heading font-bold text-xs truncate max-w-[80px]">
            {me.username}
          </p>
          <p className="font-mono font-bold text-lg">{myScore}</p>
        </div>

        <div className="text-center">
          <p className="font-heading font-bold text-sm">
            Q {match.currentQuestion + 1}/{match.totalQuestions}
          </p>
          <p
            className={`font-mono font-bold text-2xl ${questionTimer <= 3 ? "text-destructive" : ""}`}
          >
            {questionTimer}
          </p>
        </div>

        <div className="text-center">
          <p className="font-heading font-bold text-xs truncate max-w-[80px]">
            {opponent.username}
          </p>
          <p className="font-mono font-bold text-lg">{oppScore}</p>
        </div>
      </div>

      {/* Opponent status */}
      <div className="text-center mb-4">
        <p className={`font-heading font-bold text-xs ${opponentStatusColor}`}>
          {opponent.username}: {opponentStatusText}
        </p>
      </div>

      {/* Question */}
      <NeoCard
        shadow="lg"
        className={`mb-5 ${shaking ? "animate-shake" : ""}`}
      >
        <p className="font-heading font-bold text-xl leading-tight">
          {currentQ.question}
        </p>
      </NeoCard>

      {/* Options */}
      <div className="space-y-2.5 flex-1">
        {currentQ.options.map((opt, idx) => (
          <button
            key={idx}
            disabled={revealed}
            onClick={() => handleSelect(idx)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!revealed ? "active:neo-shadow-pressed" : ""} ${getOptionStyle(idx)}`}
          >
            <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
              {revealed && myResult?.correct && idx === selected ? (
                <Check size={16} strokeWidth={3} />
              ) : revealed && !myResult?.correct && idx === selected ? (
                <X size={16} strokeWidth={3} />
              ) : (
                letters[idx]
              )}
            </span>
            <span className="font-heading font-bold text-sm">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
