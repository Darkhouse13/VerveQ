/**
 * useSoloBlitz — the solo Blitz game loop, server-authoritative and presentation
 * free, so the v2 shell's `BlitzPlayScreen` can drive the exact same backend flow
 * the legacy `BlitzScreen` runs inline.
 *
 * Every correctness/score/clock decision is the server's: `blitz.start`,
 * `blitz.getQuestion`, `blitz.submitAnswer`, and `blitz.endGame` are called
 * unchanged. This hook only sequences them and exposes view state. No grading,
 * no clock authority, and no scoring live here — the 60s window (and every -3s
 * penalty) is the server's `endTimeMs`.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import type { Id } from "../../convex/_generated/dataModel";

interface QuestionData {
  question: string;
  options: string[];
  checksum: string;
  imageUrl?: string | null;
}

export interface SoloBlitzState {
  loading: boolean;
  question: QuestionData | null;
  score: number;
  /** Server-authoritative end of the run; the clock counts down to this. */
  endTimeMs: number;
  selected: number | null;
  revealed: boolean;
  correctIdx: number;
  /** True briefly after a wrong answer — drives the penalty flash / shake. */
  penaltyFlash: boolean;
  shaking: boolean;
  zoomImage: string | null;
  setZoomImage: (url: string | null) => void;
  onOption: (idx: number) => void;
  /** Clock expiry handler to wire into the countdown component. */
  onExpired: () => void;
}

export function useSoloBlitz(): SoloBlitzState {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const [sessionId, setSessionId] = useState<Id<"blitzSessions"> | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [score, setScore] = useState(0);
  const [endTimeMs, setEndTimeMs] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const sessionRef = useRef<Id<"blitzSessions"> | null>(null);

  const startMut = useMutation(api.blitz.start);
  const getQuestionMut = useMutation(api.blitz.getQuestion);
  const submitAnswerMut = useMutation(api.blitz.submitAnswer);
  const endGameMut = useMutation(api.blitz.endGame);

  const finishGame = useCallback(async () => {
    if (gameOver) return;
    setGameOver(true);
    const sid = sessionRef.current;
    if (!sid) return;
    try {
      const res = await endGameMut({ sessionId: sid });
      navigate("/blitz-results", {
        state: {
          score: res.score,
          correctCount: res.correctCount,
          wrongCount: res.wrongCount,
          sport,
          mode: "blitz" as const,
        },
      });
    } catch {
      navigate("/home");
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
      } catch {
        // Time expired or no more questions — server is the authority.
        void finishGame();
      }
    },
    [getQuestionMut, finishGame],
  );

  useEffect(() => {
    (async () => {
      try {
        const { sessionId: sid, endTimeMs: serverEndTimeMs } = await startMut({
          sport,
        });
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

  // Anti-cheat: a tab-away submits a guaranteed-wrong guess; the server still
  // decides correctness and applies the -3s penalty.
  useAntiCheat(
    useCallback(() => {
      if (!gameOver && question && sessionId && !revealed) {
        submitAnswerMut({
          sessionId,
          answer: "__tabbed_away__",
          checksum: question.checksum,
        }).then((res) => {
          setEndTimeMs(res.endTimeMs);
          if (res.gameOver) void finishGame();
        });
        toast.error("Tab switch — counted as a wrong answer (-3s)");
      }
    }, [gameOver, question, sessionId, revealed, submitAnswerMut, finishGame]),
    { warningMessage: "Don't switch tabs — it counts as a wrong answer (-3s)" },
  );

  const onOption = useCallback(
    async (idx: number) => {
      if (revealed || !question || !sessionId || gameOver) return;
      setSelected(idx);
      setRevealed(true);
      try {
        const res = await submitAnswerMut({
          sessionId,
          answer: question.options[idx],
          checksum: question.checksum,
        });
        setScore(res.score);
        setEndTimeMs(res.endTimeMs);
        setRevealedAnswer(res.correctAnswer);

        if (!res.correct) {
          setPenaltyFlash(true);
          setShaking(true);
          setTimeout(() => setPenaltyFlash(false), 300);
          setTimeout(() => setShaking(false), 500);
        }

        if (res.gameOver) {
          setTimeout(() => void finishGame(), 600);
          return;
        }

        setTimeout(() => {
          void fetchQuestion(sessionId);
        }, res.correct ? 400 : 800);
      } catch {
        void finishGame();
      }
    },
    [revealed, question, sessionId, gameOver, submitAnswerMut, finishGame, fetchQuestion],
  );

  const correctIdx =
    question && revealedAnswer ? question.options.indexOf(revealedAnswer) : -1;

  return {
    loading,
    question,
    score,
    endTimeMs,
    selected,
    revealed,
    correctIdx,
    penaltyFlash,
    shaking,
    zoomImage,
    setZoomImage,
    onOption,
    onExpired: finishGame,
  };
}
