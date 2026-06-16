import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { BlitzClock } from "@/components/BlitzClock";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { Check, X } from "lucide-react";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { ExitGameButton } from "@/components/ExitGameButton";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

interface QuestionData {
  question: string;
  options: string[];
  checksum: string;
  imageUrl?: string | null;
}

export default function BlitzScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const [sessionId, setSessionId] = useState<Id<"blitzSessions"> | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [score, setScore] = useState(0);
  const [endTimeMs, setEndTimeMs] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);

  const sessionRef = useRef<Id<"blitzSessions"> | null>(null);
  const answerSubmitInFlight = useRef(false);

  const startMut = useMutation(api.blitz.start);
  const getQuestionMut = useMutation(api.blitz.getQuestion);
  const submitAnswerMut = useMutation(api.blitz.submitAnswer);
  const endGameMut = useMutation(api.blitz.endGame);

  const finishGame = useCallback(async () => {
    if (gameOver) return;
    setGameOver(true);
    const sid = sessionRef.current;
    if (!sid) return;
    const goToResults = (res: {
      score: number;
      correctCount: number;
      wrongCount: number;
    }) =>
      navigate("/blitz-results", {
        state: {
          score: res.score,
          correctCount: res.correctCount,
          wrongCount: res.wrongCount,
          sport,
          mode: "blitz" as const,
        },
      });
    try {
      goToResults(await endGameMut({ sessionId: sid }));
    } catch {
      // The buzzer fired on the client, but the server clock may trail it by a
      // hair (or a transient hiccup dropped the call). Wait a beat and finalize
      // once more before falling back home, so a clean run still reaches its
      // results screen instead of being dumped to the home page.
      try {
        await new Promise((r) => setTimeout(r, 1200));
        goToResults(await endGameMut({ sessionId: sid }));
      } catch {
        navigate("/home");
      }
    }
  }, [endGameMut, navigate, sport, gameOver]);

  const fetchQuestion = useCallback(
    async (sid: Id<"blitzSessions">) => {
      try {
        const q = await getQuestionMut({ sessionId: sid });
        setQuestion(q);
        setRevealedAnswer(null);
        setSelected(null);
        setRevealed(false);
        setIsCorrect(false);
      } catch {
        // Time expired or no more questions
        finishGame();
      }
    },
    [getQuestionMut, finishGame],
  );

  useEffect(() => {
    (async () => {
      try {
        const { sessionId: sid, endTimeMs: serverEndTimeMs } = await startMut({ sport });
        setSessionId(sid);
        sessionRef.current = sid;
        const q = await getQuestionMut({ sessionId: sid });
        setQuestion(q);
        setEndTimeMs(serverEndTimeMs);
        setLoading(false);
      } catch {
        toast.error("Failed to start blitz");
        navigate(-1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anti-cheat: mark wrong on tab-away
  useAntiCheat(
    useCallback(() => {
      if (!gameOver && question && sessionId && !revealed) {
        // Submit a guaranteed-wrong guess; server still decides correctness.
        submitAnswerMut({
          sessionId,
          answer: "__tabbed_away__",
          checksum: question.checksum,
        }).then((res) => {
          setEndTimeMs(res.endTimeMs);
          if (res.gameOver) finishGame();
        });
        toast.error("Tab switch — counted as a wrong answer (-3s)");
      }
    }, [gameOver, question, sessionId, revealed, submitAnswerMut, finishGame]),
    { warningMessage: "Don't switch tabs — it counts as a wrong answer (-3s)" },
  );

  const handleSelect = async (idx: number) => {
    if (
      revealed ||
      checking ||
      answerSubmitInFlight.current ||
      !question ||
      !sessionId ||
      gameOver
    )
      return;
    // Lock input right away (so a double-tap can't fire a second submit) but
    // hold off on `revealed` until the server's verdict is in — revealing early
    // would flash a correct pick red for a frame before it turns green.
    answerSubmitInFlight.current = true;
    setSelected(idx);
    setChecking(true);

    const answer = question.options[idx];

    try {
      const res = await submitAnswerMut({
        sessionId,
        answer,
        checksum: question.checksum,
      });

      setScore(res.score);
      setEndTimeMs(res.endTimeMs);
      // Set the correct answer BEFORE revealing so grading colours are right on
      // the first frame (green for a correct pick, never a red flash first).
      setRevealedAnswer(res.correctAnswer);
      setIsCorrect(res.correct);
      setRevealed(true);

      if (!res.correct) {
        setPenaltyFlash(true);
        setShaking(true);
        setTimeout(() => setPenaltyFlash(false), 300);
        setTimeout(() => setShaking(false), 500);
      }

      if (res.gameOver) {
        setTimeout(() => finishGame(), 600);
        return;
      }

      // Auto-advance after brief reveal
      setTimeout(() => {
        fetchQuestion(sessionId);
      }, res.correct ? 400 : 800);
    } catch {
      finishGame();
    } finally {
      answerSubmitInFlight.current = false;
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">
          Starting Blitz...
        </p>
      </div>
    );
  }

  const correctIdx =
    question && revealedAnswer
      ? question.options.indexOf(revealedAnswer)
      : -1;

  const getOptionStyle = (idx: number) => {
    // Before the verdict lands, show the picked option as "selected" (primary),
    // never red — grading colours only apply once the server answer is known.
    if (!revealed)
      return idx === selected
        ? "bg-primary text-primary-foreground"
        : "bg-card text-card-foreground";
    if (idx === correctIdx) return "bg-success text-success-foreground";
    if (idx === selected) return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  const letters = ["A", "B", "C", "D"];

  return (
    <div className="min-h-screen bg-background px-5 py-5 flex flex-col">
      <div className="mb-3">
        <ExitGameButton title="Quit Blitz?" description="Your run will end and the score won't be saved." />
      </div>
      {/* Clock */}
      <div className="mb-4">
        <BlitzClock
          endTimeMs={endTimeMs}
          onExpired={finishGame}
          penaltyFlash={penaltyFlash}
        />
      </div>

      {/* Score */}
      <div className="flex justify-center mb-4">
        <p className="font-mono font-bold text-lg">Score: {score}</p>
      </div>

      {/* Question */}
      <NeoCard
        shadow="lg"
        className={`mb-5 ${shaking ? "animate-shake" : ""}`}
      >
        {question?.imageUrl && (
          <div className="mb-3">
            <QuestionImage
              imageUrl={question.imageUrl}
              alt={`Image for: ${question?.question ?? "question"}`}
              onZoom={() => setZoomImage(question.imageUrl!)}
            />
          </div>
        )}
        <p className="font-heading font-bold text-xl leading-tight">
          {question?.question}
        </p>
      </NeoCard>

      {/* Options */}
      <div className="space-y-2.5 flex-1">
        {question?.options.map((opt, idx) => (
          <button
            key={idx}
            disabled={revealed || checking}
            onClick={() => handleSelect(idx)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!revealed && !checking ? "active:neo-shadow-pressed" : ""} ${getOptionStyle(idx)}`}
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
