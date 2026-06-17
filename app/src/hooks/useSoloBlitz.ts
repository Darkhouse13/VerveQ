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
import { useTranslation } from "react-i18next";
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
  /** True while the pick is in flight to the server, before the verdict lands. */
  checking: boolean;
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
  const { t } = useTranslation("play");
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
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [penaltyFlash, setPenaltyFlash] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

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
      // hair (or a transient hiccup dropped the call). Wait a beat — the server
      // clock advances past the deadline — and finalize once more before giving
      // up to home, so a clean run still reaches its results screen.
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
        toast.error(t("blitz.startFailedToast"));
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
        toast.error(t("blitz.tabSwitchWrong"));
      }
    }, [gameOver, question, sessionId, revealed, submitAnswerMut, finishGame, t]),
    { warningMessage: t("blitz.tabSwitchWarning") },
  );

  const onOption = useCallback(
    async (idx: number) => {
      if (
        revealed ||
        checking ||
        answerSubmitInFlight.current ||
        !question ||
        !sessionId ||
        gameOver
      )
        return;
      // Lock input immediately (so a second tap can't fire another submit) and
      // mark the pick "checking" — but DON'T flip `revealed` yet. Revealing
      // before the server verdict arrives would paint a correct pick red for one
      // frame (correctIdx is still -1) and only flip it green once the answer
      // lands. We wait for the verdict and reveal it atomically below.
      answerSubmitInFlight.current = true;
      setSelected(idx);
      setChecking(true);
      try {
        const res = await submitAnswerMut({
          sessionId,
          answer: question.options[idx],
          checksum: question.checksum,
        });
        setScore(res.score);
        setEndTimeMs(res.endTimeMs);
        // Set the correct answer BEFORE revealing so the grading colours (green
        // for correct, red for a wrong pick) are right on the very first frame.
        setRevealedAnswer(res.correctAnswer);
        setRevealed(true);

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
      } finally {
        answerSubmitInFlight.current = false;
        setChecking(false);
      }
    },
    [revealed, checking, question, sessionId, gameOver, submitAnswerMut, finishGame, fetchQuestion],
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
    checking,
    correctIdx,
    penaltyFlash,
    shaking,
    zoomImage,
    setZoomImage,
    onOption,
    onExpired: finishGame,
  };
}
