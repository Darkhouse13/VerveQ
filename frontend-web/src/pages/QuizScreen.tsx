import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Check, X } from "lucide-react";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import type { GameResultState } from "@/types/api";

const MAX_QUESTIONS = 10;
type QuizDifficulty = "easy" | "intermediate" | "hard";

function parseDifficulty(value: string | null): QuizDifficulty {
  return value === "easy" || value === "hard" ? value : "intermediate";
}

interface QuestionData {
  question: string;
  options: string[];
  difficulty: string;
  checksum: string;
  category: string;
  imageUrl?: string | null;
}

export default function QuizScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const difficulty = parseDifficulty(params.get("difficulty"));
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"quizSessions"> | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    correct: boolean;
    explanation?: string | null;
  } | null>(null);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const startTime = useRef(Date.now());

  const createSessionMut = useMutation(api.quizSessions.createSession);
  const getQuestionMut = useMutation(api.quizSessions.getQuestion);
  const checkAnswerMut = useMutation(api.quizSessions.checkAnswer);
  const completeQuizMut = useMutation(api.games.completeQuiz);

  const fetchQuestion = useCallback(
    async (sid: Id<"quizSessions">) => {
      setLoading(true);
      try {
        const q = await getQuestionMut({ sessionId: sid });
        setQuestion(q);
        setRevealedAnswer(null);
        setSelected(null);
        setRevealed(false);
        setCheckResult(null);
        startTime.current = Date.now();
        setTimer(0);
      } catch {
        toast.error("Failed to load question");
      } finally {
        setLoading(false);
      }
    },
    [getQuestionMut],
  );

  useEffect(() => {
    (async () => {
      try {
        const { sessionId: sid } = await createSessionMut({
          sport,
          difficulty,
        });
        setSessionId(sid);
        await fetchQuestion(sid);
      } catch {
        toast.error("Failed to start quiz session");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (revealed || loading) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [revealed, loading]);

  const handleCheck = async () => {
    if (selected === null || !question || !sessionId) return;
    setChecking(true);
    const timeTaken = (Date.now() - startTime.current) / 1000;
    try {
      const res = await checkAnswerMut({
        sessionId,
        answer: question.options[selected],
      });
      setRevealedAnswer(res.correctAnswer);
      setRevealed(true);
      setCheckResult({
        correct: res.correct,
        explanation: res.explanation,
      });
      setTotalScore((s) => s + res.score);
      if (res.correct) setCorrectCount((c) => c + 1);
      setTimes((t) => [...t, timeTaken]);
    } catch {
      toast.error("Failed to check answer");
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = async () => {
    if (questionNum >= MAX_QUESTIONS) {
      const avgTime = times.length
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 0;
      let eloChange: number | null = null;
      let newElo: number | null = null;
      let kFactor: number | undefined;
      let kFactorLabel: string | undefined;
      let serverScore = totalScore;
      let serverCorrectCount = correctCount;
      if (user && sessionId) {
        try {
          const res = await completeQuizMut({ sessionId });
          eloChange = res.eloChange;
          newElo = res.newElo;
          kFactor = res.kFactor;
          kFactorLabel = res.kFactorLabel;
          serverScore = res.score;
          serverCorrectCount = res.correctCount;
        } catch {
          /* continue to results */
        }
      }
      const state: GameResultState = {
        score: serverScore,
        total: MAX_QUESTIONS,
        correctCount: serverCorrectCount,
        avgTime,
        eloChange,
        newElo,
        sport,
        mode: "quiz",
        kFactor,
        kFactorLabel,
      };
      navigate("/results", { state });
    } else {
      setQuestionNum((n) => n + 1);
      if (sessionId) fetchQuestion(sessionId);
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
    if (idx === selected)
      return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  if (loading && !question) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Loading quiz...
        </p>
      </div>
    );
  }

  const letters = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono font-bold text-sm">Score: {totalScore}</p>
        <p className="font-heading font-bold text-sm">
          Q {questionNum}/{MAX_QUESTIONS}
        </p>
        <p className="font-mono font-bold text-lg">
          0:{timer.toString().padStart(2, "0")}
        </p>
      </div>

      <div className="flex justify-center mb-5">
        <NeoBadge color="primary" rotated size="md">
          {difficulty}
        </NeoBadge>
      </div>

      <NeoCard shadow="lg" className="mb-5">
        {question?.imageUrl && (
          <div className="mb-3">
            <QuestionImage
              imageUrl={question.imageUrl}
              alt="Question image"
              onZoom={() => setZoomImage(question.imageUrl!)}
            />
          </div>
        )}
        <p className="font-heading font-bold text-xl leading-tight">
          {question?.question}
        </p>
      </NeoCard>

      <div className="space-y-2.5 flex-1">
        {question?.options.map((opt, idx) => (
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
            {questionNum >= MAX_QUESTIONS ? "See Results" : "Continue"}
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
