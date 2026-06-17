/**
 * useDailyQuiz — the Daily Challenge (quiz) game loop, shaped to the shared
 * `SoloQuizState` so it can drive the exact same `QuizPlayView` as solo Quiz.
 *
 * This is a faithful port of the live `DailyQuizScreen` loop: every decision
 * stays server-authoritative and the Daily GATING is preserved EXACTLY —
 * `dailyChallenge.getOrCreateChallenge / startAttempt / getQuestion (the daily
 * set, by attempt + index) / submitAnswer / completeAttempt`, the
 * one-attempt-per-day check (`getAttemptStatus`), and the STRICTER anti-cheat
 * (tab switch FORFEITS the attempt, it doesn't just end the session). The flow
 * uses the DAILY session (`dailyAttempts`), never a regular quiz session, and
 * none of the daily backend is touched. On completion it routes to the existing
 * `/daily-results` screen with the same state shape the live screen produced.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import type { Id } from "../../convex/_generated/dataModel";
import type { SoloQuizState } from "@/hooks/useSoloQuiz";

const MAX_QUESTIONS = 10;
const AUTO_ADVANCE_DELAY_MS = 2000;

interface DailyQuestionData {
  question: string;
  options: string[];
  // Canonical English options (same order) — submitted so grading stays canonical.
  optionValues: string[];
  checksum: string;
  category: string;
  imageUrl?: string | null;
  questionStartedAt: number;
}

export interface DailyQuizState extends SoloQuizState {
  /** Quitting a daily forfeits the attempt (gating), then leaves the shell. */
  forfeitAndExit: () => void;
}

export function useDailyQuiz(): DailyQuizState {
  const { t, i18n } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const [attemptId, setAttemptId] = useState<Id<"dailyAttempts"> | null>(null);
  const [question, setQuestion] = useState<DailyQuestionData | null>(null);
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
  const [attemptFinished, setAttemptFinished] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null);

  const startTime = useRef(Date.now());
  const lastDailyQuestionKey = useRef<string | null>(null);
  const answerSubmitInFlight = useRef(false);
  const startAttemptInFlight = useRef(false);
  const localAttemptSport = useRef<string | null>(null);
  const autoAdvanceInFlight = useRef(false);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);

  const getOrCreateChallengeMut = useMutation(api.dailyChallenge.getOrCreateChallenge);
  const startAttemptMut = useMutation(api.dailyChallenge.startAttempt);
  const attemptStatus = useQuery(api.dailyChallenge.getAttemptStatus, { sport, mode: "quiz" });
  const dailyQuestion = useQuery(
    api.dailyChallenge.getQuestion,
    attemptId && !attemptFinished && questionNum < MAX_QUESTIONS
      ? {
          attemptId,
          questionIndex: questionNum,
          locale: i18n.resolvedLanguage ?? i18n.language,
        }
      : "skip",
  );
  const submitAnswerMut = useMutation(api.dailyChallenge.submitAnswer);
  const forfeitMut = useMutation(api.dailyChallenge.forfeit);
  const completeAttemptMut = useMutation(api.dailyChallenge.completeAttempt);

  // Start (or block) the daily attempt — one attempt per day, server-enforced.
  useEffect(() => {
    if (attemptStatus === undefined) return;
    if (attemptStatus) {
      const hasLocalAttempt = localAttemptSport.current === sport || attemptId !== null;
      if (startAttemptInFlight.current || hasLocalAttempt) return;
      toast.error(t("dailyQuiz.alreadyPlayed"));
      navigate(SHELL_ROUTES.home, { replace: true });
      return;
    }
    if (startAttemptInFlight.current || localAttemptSport.current === sport || attemptId !== null) {
      return;
    }

    startAttemptInFlight.current = true;
    localAttemptSport.current = sport;
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
          toast.error(t("dailyQuiz.alreadyPlayed"));
          navigate(SHELL_ROUTES.home, { replace: true });
        } else {
          toast.error(friendlyError(e, t("dailyQuiz.startFailedToast")));
          navigate(-1);
        }
        localAttemptSport.current = null;
      } finally {
        startAttemptInFlight.current = false;
      }
    })();
  }, [attemptId, attemptStatus, getOrCreateChallengeMut, navigate, sport, startAttemptMut, t]);

  useEffect(() => {
    if (dailyQuestion && !forfeited) {
      const questionKey = `${questionNum}:${dailyQuestion.checksum}`;
      if (lastDailyQuestionKey.current === questionKey) return;
      lastDailyQuestionKey.current = questionKey;
      setQuestion(dailyQuestion);
      setRevealedAnswer(null);
      setSelected(null);
      setRevealed(false);
      setCheckResult(null);
      startTime.current = dailyQuestion.questionStartedAt ?? Date.now();
      setTimer(Math.max(0, Math.floor((Date.now() - startTime.current) / 1000)));
    }
  }, [dailyQuestion, forfeited, questionNum]);

  useEffect(() => {
    if (revealed || loading || !question) return;
    const updateTimer = () => {
      setTimer(Math.max(0, Math.floor((Date.now() - startTime.current) / 1000)));
    };
    updateTimer();
    const id = setInterval(updateTimer, 250);
    return () => clearInterval(id);
  }, [revealed, loading, question]);

  // Stricter daily anti-cheat: a tab switch FORFEITS today's attempt.
  useAntiCheat(
    useCallback(() => {
      if (attemptId && !forfeited) {
        setForfeited(true);
        forfeitMut({ attemptId }).then(() => {
          toast.error(t("dailyQuiz.forfeitedTabSwitch"));
          navigate(SHELL_ROUTES.home, { replace: true });
        });
      }
    }, [attemptId, forfeited, forfeitMut, navigate, t]),
    { warningMessage: t("dailyQuiz.tabSwitchWarning") },
  );

  const handleCheck = useCallback(
    async (optionIndex: number) => {
      if (
        !question ||
        !attemptId ||
        checking ||
        answerSubmitInFlight.current ||
        revealed
      )
        return;
      answerSubmitInFlight.current = true;
      setSelected(optionIndex);
      setChecking(true);
      try {
        const res = await submitAnswerMut({
          attemptId,
          // Canonical English value — grading compares against correctAnswer.
          answer: question.optionValues[optionIndex],
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
      } catch (error) {
        toast.error(friendlyError(error, t("dailyQuiz.checkFailedToast")));
      } finally {
        answerSubmitInFlight.current = false;
        setChecking(false);
      }
    },
    [attemptId, checking, question, questionNum, revealed, submitAnswerMut, t],
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
      if (questionNum + 1 >= MAX_QUESTIONS) {
        if (attemptId) {
          try {
            await completeAttemptMut({ attemptId });
          } catch {
            /* continue to results */
          }
        }
        setAttemptFinished(true);
        setAttemptId(null);
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
        const shareEmojis = finalResults
          .map((r) => {
            if (!r.correct) return "🟥";
            if (r.timeTaken <= 3) return "🟩";
            return "🟨";
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
    } finally {
      autoAdvanceInFlight.current = false;
    }
  }, [attemptId, checkResult, completeAttemptMut, navigate, questionNum, results, revealed, sport, totalScore]);

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

  const forfeitAndExit = useCallback(() => {
    if (attemptId && !forfeited) {
      setForfeited(true);
      void forfeitMut({ attemptId });
    }
    navigate(SHELL_ROUTES.home, { replace: true });
  }, [attemptId, forfeited, forfeitMut, navigate]);

  const correctIdx =
    question && revealedAnswer
      ? question.optionValues.indexOf(revealedAnswer)
      : -1;

  return {
    loading: loading || !question,
    question: question
      ? {
          question: question.question,
          options: question.options,
          optionValues: question.optionValues,
          difficulty: "",
          checksum: question.checksum,
          category: question.category,
          imageUrl: question.imageUrl,
        }
      : null,
    questionNum: questionNum + 1,
    maxQuestions: MAX_QUESTIONS,
    totalScore,
    timer,
    selected,
    revealed,
    checking,
    correctIdx,
    checkResult: checkResult
      ? { correct: checkResult.correct, explanation: checkResult.explanation }
      : null,
    isCameFirst: false,
    badgeLabel: "Daily Challenge",
    zoomImage,
    setZoomImage,
    onOption,
    forfeitAndExit,
  };
}
