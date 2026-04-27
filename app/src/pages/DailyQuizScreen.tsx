import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Check, X } from "lucide-react";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { ExitGameButton } from "@/components/ExitGameButton";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

const MAX_QUESTIONS = 10;

interface QuestionData {
  question: string;
  options: string[];
  checksum: string;
  category: string;
  imageUrl?: string | null;
  questionStartedAt: number;
}

export default function DailyQuizScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const [attemptId, setAttemptId] = useState<Id<"dailyAttempts"> | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [questionNum, setQuestionNum] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [results, setResults] = useState<Array<{ correct: boolean; timeTaken: number; score: number }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    correct: boolean;
    explanation?: string | null;
    score: number;
    timeTaken: number;
  } | null>(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [forfeited, setForfeited] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);

  const startTime = useRef(Date.now());

  const getOrCreateChallengeMut = useMutation(api.dailyChallenge.getOrCreateChallenge);
  const startAttemptMut = useMutation(api.dailyChallenge.startAttempt);
  const dailyQuestion = useQuery(
    api.dailyChallenge.getQuestion,
    attemptId && questionNum < MAX_QUESTIONS
      ? { attemptId, questionIndex: questionNum }
      : "skip",
  );
  const submitAnswerMut = useMutation(api.dailyChallenge.submitAnswer);
  const forfeitMut = useMutation(api.dailyChallenge.forfeit);
  const completeAttemptMut = useMutation(api.dailyChallenge.completeAttempt);

  // Initialize
  useEffect(() => {
    (async () => {
      try {
        await getOrCreateChallengeMut({ sport, mode: "quiz" });
        const { attemptId: aid } = await startAttemptMut({ sport, mode: "quiz" });
        setAttemptId(aid);
        setLoading(false);
        startTime.current = Date.now();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed";
        if (msg.includes("Already attempted")) {
          toast.error("You've already played today's challenge!");
          navigate("/home", { replace: true });
        } else {
          toast.error(msg);
          navigate(-1);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load question from query
  useEffect(() => {
    if (dailyQuestion && !forfeited) {
      setQuestion(dailyQuestion);
      setRevealedAnswer(null);
      setSelected(null);
      setRevealed(false);
      setCheckResult(null);
      startTime.current = dailyQuestion.questionStartedAt ?? Date.now();
      setTimer(
        Math.max(0, Math.floor((Date.now() - startTime.current) / 1000)),
      );
    }
  }, [dailyQuestion, forfeited]);

  // Timer
  useEffect(() => {
    if (revealed || loading || !question) return;
    const updateTimer = () => {
      setTimer(
        Math.max(0, Math.floor((Date.now() - startTime.current) / 1000)),
      );
    };
    updateTimer();
    const id = setInterval(updateTimer, 250);
    return () => clearInterval(id);
  }, [revealed, loading, question]);

  // Anti-cheat
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
    { warningMessage: "Don't switch tabs — daily challenge will be forfeited" },
  );

  const handleCheck = async () => {
    if (selected === null || !question || !attemptId) return;
    setChecking(true);
    try {
      const res = await submitAnswerMut({
        attemptId,
        answer: question.options[selected],
        questionIndex: questionNum,
      });
      setRevealedAnswer(res.correctAnswer);
      setRevealed(true);
      setCheckResult({
        correct: res.correct,
        explanation: res.explanation,
        score: res.score,
        timeTaken: res.timeTaken,
      });
      setTotalScore(res.totalScore);
      setResults((r) => [
        ...r,
        { correct: res.correct, timeTaken: res.timeTaken, score: res.score },
      ]);
    } catch {
      toast.error("Failed to check answer");
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = async () => {
    if (questionNum + 1 >= MAX_QUESTIONS) {
      // Complete
      if (attemptId) {
        try {
          await completeAttemptMut({ attemptId });
        } catch {
          /* continue to results */
        }
      }
      const finalResults =
        results.length > questionNum || !checkResult
          ? results
          : [
              ...results,
              {
                correct: checkResult.correct,
                timeTaken: checkResult.timeTaken,
                score: checkResult.score,
              },
            ];
      // Build share string
      const shareEmojis = finalResults
        .map((r) => {
          if (!r.correct) return "\uD83D\uDFE5"; // red
          if (r.timeTaken <= 3) return "\uD83D\uDFE9"; // green (fast)
          return "\uD83D\uDFE8"; // yellow (slow)
        })
        .join("");

      navigate("/daily-results", {
        state: {
          score: totalScore,
          total: MAX_QUESTIONS,
          correctCount: finalResults.filter((r) => r.correct).length,
          sport,
          shareString: shareEmojis,
          mode: "daily-quiz" as const,
          scoreBreakdown: finalResults,
        },
      });
    } else {
      setQuestionNum((n) => n + 1);
    }
  };

  const correctIdx =
    question && revealedAnswer
      ? question.options.indexOf(revealedAnswer)
      : -1;

  const getOptionStyle = (idx: number) => {
    if (!revealed)
      return selected === idx
        ? "bg-primary text-primary-foreground"
        : "bg-card text-card-foreground";
    if (idx === correctIdx) return "bg-success text-success-foreground";
    if (idx === selected) return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  if (loading || !question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Loading daily challenge...
        </p>
      </div>
    );
  }

  const letters = ["A", "B", "C", "D"];
  const timerMinutes = Math.floor(timer / 60);
  const timerSeconds = timer % 60;

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <ExitGameButton
          title="Quit daily challenge?"
          description="Quitting will forfeit today's daily — you can't retry until tomorrow."
        />
        <p className="font-mono font-bold text-lg">
          {timerMinutes}:{timerSeconds.toString().padStart(2, "0")}
        </p>
      </div>
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono font-bold text-sm">Score: {totalScore}</p>
        <p className="font-heading font-bold text-sm">
          Q {questionNum + 1}/{MAX_QUESTIONS}
        </p>
      </div>

      <div className="flex justify-center mb-5">
        <NeoBadge color="pink" rotated size="md">
          Daily Challenge
        </NeoBadge>
      </div>

      <NeoCard shadow="lg" className="mb-5">
        {question.imageUrl && (
          <div className="mb-3">
            <QuestionImage
              imageUrl={question.imageUrl}
              alt={`Image for: ${question.question}`}
              onZoom={() => setZoomImage(question.imageUrl!)}
            />
          </div>
        )}
        <p className="font-heading font-bold text-xl leading-tight">
          {question.question}
        </p>
      </NeoCard>

      <div className="space-y-2.5 flex-1">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            disabled={revealed}
            onClick={() => setSelected(idx)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!revealed ? "active:neo-shadow-pressed" : ""} ${getOptionStyle(idx)}`}
          >
            <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
              {revealed && idx === correctIdx ? (
                <Check size={16} strokeWidth={3} />
              ) : revealed && idx === selected ? (
                <X size={16} strokeWidth={3} />
              ) : (
                letters[idx]
              )}
            </span>
            <span className="font-heading font-bold text-sm">{opt}</span>
          </button>
        ))}
      </div>

      {revealed && checkResult?.explanation && (
        <NeoCard
          color={checkResult.correct ? "success" : "default"}
          className="mt-4 text-sm leading-snug"
        >
          {checkResult.explanation}
        </NeoCard>
      )}

      <div className="mt-5">
        {!revealed ? (
          <NeoButton
            variant="primary"
            size="full"
            disabled={selected === null || checking}
            onClick={handleCheck}
          >
            {checking ? "Checking..." : "Check Answer"}
          </NeoButton>
        ) : (
          <NeoButton variant="primary" size="full" onClick={handleContinue}>
            {questionNum + 1 >= MAX_QUESTIONS ? "See Results" : "Continue"}
          </NeoButton>
        )}
      </div>

      {zoomImage && (
        <ImageZoomModal
          imageUrl={zoomImage}
          open={!!zoomImage}
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  );
}
