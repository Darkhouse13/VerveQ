/**
 * useSoloQuiz — the solo Quiz game loop, server-authoritative and presentation
 * free, so any screen (the legacy `QuizScreen` keeps its own inline copy; the
 * v2 shell's `QuizPlayScreen` uses this) can drive the exact same backend flow.
 *
 * Every correctness/score decision is the server's: `createSession`,
 * `getQuestion`, `checkAnswer`, and `completeQuiz` are called unchanged. This
 * hook only sequences them and exposes view state. No grading lives here.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useAuth } from "@/contexts/AuthContext";
import type { Id } from "../../convex/_generated/dataModel";
import type { GameResultState } from "@/types/api";

export const QUIZ_MAX_QUESTIONS = 10;
const AUTO_ADVANCE_DELAY_MS = 2000;
type QuizDifficulty = "easy" | "intermediate" | "hard";

function parseDifficulty(value: string | null): QuizDifficulty {
  return value === "easy" || value === "hard" ? value : "intermediate";
}

interface QuestionData {
  question: string;
  options: string[];
  // Canonical English options in the same order — submitted to the server so
  // grading stays canonical even when `options` are localized labels.
  optionValues: string[];
  difficulty: string;
  checksum: string;
  category: string;
  imageUrl?: string | null;
}

export interface SoloQuizState {
  loading: boolean;
  question: QuestionData | null;
  questionNum: number;
  maxQuestions: number;
  totalScore: number;
  timer: number;
  selected: number | null;
  revealed: boolean;
  checking: boolean;
  correctIdx: number;
  checkResult: { correct: boolean; explanation?: string | null } | null;
  isCameFirst: boolean;
  badgeLabel: string;
  zoomImage: string | null;
  setZoomImage: (url: string | null) => void;
  onOption: (idx: number) => void;
}

export function useSoloQuiz(): SoloQuizState {
  const { t, i18n } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const mode = params.get("mode") || "quiz";
  const difficulty = parseDifficulty(params.get("difficulty"));
  const isCameFirst = mode === "came_first";
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState<Id<"quizSessions"> | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);
  const [questionNum, setQuestionNum] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [scoreBreakdown, setScoreBreakdown] = useState<
    Array<{ correct: boolean; timeTaken: number; score: number }>
  >([]);
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

  const answerSubmitInFlight = useRef(false);
  const autoAdvanceInFlight = useRef(false);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);

  const createSessionMut = useMutation(api.quizSessions.createSession);
  const getQuestionMut = useMutation(api.quizSessions.getQuestion);
  const checkAnswerMut = useMutation(api.quizSessions.checkAnswer);
  const completeQuizMut = useMutation(api.games.completeQuiz);
  const penalizeTabSwitchMut = useMutation(api.quizSessions.penalizeTabSwitch);

  const fetchQuestion = useCallback(
    async (sid: Id<"quizSessions">) => {
      setLoading(true);
      try {
        const q = await getQuestionMut({
          sessionId: sid,
          locale: i18n.resolvedLanguage ?? i18n.language,
        });
        setQuestion(q);
        setRevealedAnswer(null);
        setSelected(null);
        setRevealed(false);
        setCheckResult(null);
        setTimer(0);
      } catch {
        toast.error(t("quiz.loadQuestionFailed"));
      } finally {
        setLoading(false);
      }
    },
    [getQuestionMut, t, i18n],
  );

  useEffect(() => {
    (async () => {
      try {
        const { sessionId: sid } = await createSessionMut({
          sport,
          mode: isCameFirst ? "came_first" : "quiz",
          difficulty,
        });
        setSessionId(sid);
        await fetchQuestion(sid);
      } catch {
        toast.error(t("quiz.startSessionFailed"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (revealed || loading) return;
    const id = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [revealed, loading]);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || revealed) return;
      penalizeTabSwitchMut({ sessionId }).then((res) => {
        if (res.penalized) {
          toast.error(t("quiz.tabSwitchEnded"));
          navigate("/home", { replace: true });
        }
      });
    }, [sessionId, revealed, penalizeTabSwitchMut, navigate, t]),
    { warningMessage: t("quiz.tabSwitchWarning") },
  );

  const handleCheck = useCallback(
    async (optionIndex: number) => {
      if (
        !question ||
        !sessionId ||
        checking ||
        revealed ||
        answerSubmitInFlight.current
      )
        return;
      answerSubmitInFlight.current = true;
      setSelected(optionIndex);
      setChecking(true);
      try {
        const res = await checkAnswerMut({
          sessionId,
          // Canonical English value — grading compares against correctAnswer.
          answer: question.optionValues[optionIndex],
        });
        setRevealedAnswer(res.correctAnswer);
        setRevealed(true);
        setCheckResult({ correct: res.correct, explanation: res.explanation });
        setTotalScore((s) => s + res.score);
        if (res.correct) setCorrectCount((c) => c + 1);
        setTimes((t) => [...t, res.timeTaken]);
        setScoreBreakdown((items) => [
          ...items,
          { correct: res.correct, timeTaken: res.timeTaken, score: res.score },
        ]);
      } catch (error) {
        toast.error(friendlyError(error, t("quiz.checkFailedToast")));
      } finally {
        answerSubmitInFlight.current = false;
        setChecking(false);
      }
    },
    [checkAnswerMut, checking, question, revealed, sessionId, t],
  );

  const onOption = useCallback(
    (idx: number) => {
      if (revealed || checking || answerSubmitInFlight.current) return;
      void handleCheck(idx);
    },
    [revealed, checking, handleCheck],
  );

  const advanceAfterReveal = useCallback(async () => {
    if (autoAdvanceInFlight.current || !revealed) return;
    autoAdvanceInFlight.current = true;
    try {
      if (questionNum >= QUIZ_MAX_QUESTIONS) {
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
          total: QUIZ_MAX_QUESTIONS,
          correctCount: serverCorrectCount,
          avgTime,
          eloChange,
          newElo,
          sport,
          // GameResultState.mode has no `came_first`; it's a quiz variant.
          mode: "quiz",
          kFactor,
          kFactorLabel,
          scoreBreakdown,
        };
        navigate("/results", { state });
      } else {
        setQuestionNum((n) => n + 1);
        if (sessionId) await fetchQuestion(sessionId);
      }
    } finally {
      autoAdvanceInFlight.current = false;
    }
  }, [
    completeQuizMut,
    correctCount,
    fetchQuestion,
    questionNum,
    revealed,
    scoreBreakdown,
    sessionId,
    sport,
    times,
    totalScore,
    user,
    navigate,
  ]);

  useEffect(() => {
    if (!revealed) return;
    if (autoAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
    }
    autoAdvanceTimeoutRef.current = window.setTimeout(() => {
      autoAdvanceTimeoutRef.current = null;
      void advanceAfterReveal();
    }, AUTO_ADVANCE_DELAY_MS);
    return () => {
      if (autoAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    };
  }, [advanceAfterReveal, revealed]);

  const correctIdx =
    question && revealedAnswer
      ? question.optionValues.indexOf(revealedAnswer)
      : -1;

  return {
    loading,
    question,
    questionNum,
    maxQuestions: QUIZ_MAX_QUESTIONS,
    totalScore,
    timer,
    selected,
    revealed,
    checking,
    correctIdx,
    checkResult,
    isCameFirst,
    badgeLabel: isCameFirst ? t("quiz.cameFirstBadge") : difficulty,
    zoomImage,
    setZoomImage,
    onOption,
  };
}
