/**
 * useSoloQuiz — the solo Quiz game loop, server-authoritative and presentation
 * free, so the v2 shell's `QuizPlayScreen` can drive the exact same backend
 * flow.
 *
 * Every correctness/score decision is the server's: `createSession`,
 * `getQuestion`, `checkAnswer`, and `completeQuiz` are called unchanged. This
 * hook only sequences them and exposes view state. No grading lives here.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { notify } from "@/lib/notify";
import { friendlyError } from "@/lib/errors";
import { api } from "../../convex/_generated/api";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useAuth } from "@/contexts/AuthContext";
import {
  startRun,
  completeRun,
  abandonRun,
  noteQuestionAnswered,
} from "@/lib/gameAnalytics";
import type { Id } from "../../convex/_generated/dataModel";
import type { QuizResultData } from "@/components/shell/play/result/ModeResults";

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
  // Server hint: the next planned question's image, warmed into the browser
  // cache while this question is on screen. Never rendered directly.
  nextImageUrl?: string | null;
  // Ranked answer window (owner ruling 2026-11-05): the server grades an
  // answer wrong once graceMs + answerLimitMs have passed since it served the
  // question; elapsedMs is how much of that had already run (carried-over
  // questions keep their original clock).
  answerLimitMs?: number;
  graceMs?: number;
  elapsedMs?: number;
}

/** Warm the browser cache so the next question's image paints instantly. */
function preloadImage(url: string | null | undefined) {
  if (!url) return;
  const img = new Image();
  img.src = url;
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
  /** Verdicts of the questions answered so far, in order (the progress dots). */
  verdicts: boolean[];
  isCameFirst: boolean;
  badgeLabel: string;
  zoomImage: string | null;
  setZoomImage: (url: string | null) => void;
  onOption: (idx: number) => void;
}

/**
 * @param onFinish receives the scored run once the last answer is in; the
 *                 screen shows its result in place (VerveQ ONE P3.1 — this
 *                 used to navigate to the v1 /results page).
 */
export function useSoloQuiz(onFinish: (result: QuizResultData) => void): SoloQuizState {
  const { t, i18n } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const mode = params.get("mode") || "quiz";
  const difficulty = parseDifficulty(params.get("difficulty"));
  const isCameFirst = mode === "came_first";
  const { user, accountState } = useAuth();

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
  // Count-up seconds, or — when the server sends an answer window — the
  // seconds LEFT in it (the stage shows either as m:ss).
  const [timer, setTimer] = useState(0);
  // Wall-clock deadline of the current question's answer window (null = none).
  const deadlineRef = useRef<number | null>(null);
  const timeoutSentRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const answerSubmitInFlight = useRef(false);
  const autoAdvanceInFlight = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const autoAdvanceTimeoutRef = useRef<number | null>(null);

  const createSessionMut = useMutation(api.quizSessions.createSession);
  const getQuestionMut = useMutation(api.quizSessions.getQuestion);
  const checkAnswerMut = useMutation(api.quizSessions.checkAnswer);
  const completeQuizMut = useMutation(api.games.completeQuiz);
  const penalizeTabSwitchMut = useMutation(api.quizSessions.penalizeTabSwitch);
  const endSessionMut = useMutation(api.quizSessions.endSession);

  const applyQuestion = useCallback((q: QuestionData) => {
    setQuestion(q);
    setRevealedAnswer(null);
    setSelected(null);
    setRevealed(false);
    setCheckResult(null);
    if (q.answerLimitMs) {
      const deadline =
        Date.now() - (q.elapsedMs ?? 0) + (q.graceMs ?? 0) + q.answerLimitMs;
      deadlineRef.current = deadline;
      setTimer(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    } else {
      deadlineRef.current = null;
      setTimer(0);
    }
    timeoutSentRef.current = false;
    preloadImage(q.nextImageUrl);
  }, []);

  const fetchQuestion = useCallback(
    async (sid: Id<"quizSessions">) => {
      setLoading(true);
      try {
        const q = await getQuestionMut({
          sessionId: sid,
          locale: i18n.resolvedLanguage ?? i18n.language,
        });
        applyQuestion(q);
      } catch {
        notify.error(t("quiz.loadQuestionFailed"));
      } finally {
        setLoading(false);
      }
    },
    [getQuestionMut, applyQuestion, t, i18n],
  );

  // Read through a ref, NOT as a dependency of the mount-once effect below:
  // adding accountState there would re-run it and mint a fresh server session
  // every time auth settled or the visitor claimed a username — inventing
  // games nobody started.
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  useEffect(() => {
    (async () => {
      try {
        // Question 1 ships with the session itself — one round trip before the
        // player sees anything instead of two.
        const { sessionId: sid, firstQuestion } = await createSessionMut({
          sport,
          mode: isCameFirst ? "came_first" : "quiz",
          difficulty,
          withFirstQuestion: true,
          locale: i18n.resolvedLanguage ?? i18n.language,
        });
        // A game genuinely began — the server minted the session. `came_first`
        // is a quiz variant, not a mode of its own (same as GameResultState).
        startRun(sid, "quiz", { accountState: accountStateRef.current });
        setSessionId(sid);
        if (firstQuestion) {
          applyQuestion(firstQuestion);
          setLoading(false);
        } else {
          // Empty plan (or a backend that predates merged starts): fall back
          // to the separate first fetch.
          await fetchQuestion(sid);
        }
      } catch {
        notify.error(t("quiz.startSessionFailed"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving mid-quiz. Reads the session through a ref so the cleanup sees the
  // session that was live at unmount rather than the null captured on mount.
  // abandonRun ignores runs that already ended, so the result screen (which
  // unmounts this loop) can never be re-reported as an abandon.
  const liveSessionRef = useRef<Id<"quizSessions"> | null>(null);
  liveSessionRef.current = sessionId;
  // Quitting a ranked run ends it on the server too: with ≥1 answer that
  // settles as a loss (convex/lib/rankedSettle.ts), so a bad start can't be
  // walked away from. A no-op for a run that already completed.
  const endSessionMutRef = useRef(endSessionMut);
  endSessionMutRef.current = endSessionMut;
  useEffect(
    () => () => {
      const sid = liveSessionRef.current;
      abandonRun(sid);
      if (sid) void endSessionMutRef.current({ sessionId: sid }).catch(() => {});
    },
    [],
  );

  // Ticks the clock. With an answer window it counts DOWN from the server's
  // deadline and, at 0, submits a timeout in the same single checkAnswer round
  // trip a pick uses — the server grades it wrong (past the window) and the
  // reveal shows the right answer.
  const submitTimeoutRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (revealed || loading) return;
    if (deadlineRef.current == null) {
      const id = setInterval(() => setTimer((t) => t + 1), 1000);
      return () => clearInterval(id);
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil(((deadlineRef.current ?? 0) - Date.now()) / 1000));
      setTimer(left);
      if (left === 0) submitTimeoutRef.current();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [revealed, loading]);

  useAntiCheat(
    useCallback(() => {
      if (!sessionId || revealed) return;
      penalizeTabSwitchMut({ sessionId }).then((res) => {
        if (res.penalized) {
          // Abandoned, not completed: the server stamps `abandonedAt` and
          // computes no score, and the player is dropped on /home with no
          // result. (Career Path treats ITS anti-cheat forfeit as a completion
          // because there the forfeit still produces a final scored card.)
          abandonRun(sessionId);
          notify.error(t("quiz.tabSwitchEnded"));
          navigate("/home", { replace: true });
        }
      });
    }, [sessionId, revealed, penalizeTabSwitchMut, navigate, t]),
    { warningMessage: t("quiz.tabSwitchWarning") },
  );

  const handleCheck = useCallback(
    async (optionIndex: number | null) => {
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
          // A timeout submits an empty answer: always graded wrong.
          answer: optionIndex == null ? "" : question.optionValues[optionIndex],
        });
        noteQuestionAnswered(sessionId);
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
        notify.error(friendlyError(error, t("quiz.checkFailedToast")));
      } finally {
        answerSubmitInFlight.current = false;
        setChecking(false);
      }
    },
    [checkAnswerMut, checking, question, revealed, sessionId, t],
  );

  useEffect(() => {
    submitTimeoutRef.current = () => {
      if (timeoutSentRef.current || revealed || checking || answerSubmitInFlight.current) return;
      timeoutSentRef.current = true;
      notify(t("quiz.timeUp"));
      void handleCheck(null);
    };
  }, [revealed, checking, handleCheck, t]);

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
        // Fires for logged-out players too. completeQuizMut above is gated on
        // `user` (no server identity, no elo to write), so gating this on the
        // same condition would erase every logged-out finish from the funnel
        // while still counting its game_started. serverScore already falls back
        // to the local totalScore — the score those players are actually shown.
        // No `result`: the quiz is scored, it has no win/loss.
        completeRun(sessionId, { score: serverScore });
        onFinishRef.current({
          score: serverScore,
          total: QUIZ_MAX_QUESTIONS,
          correctCount: serverCorrectCount,
          avgTime,
          eloChange,
          newElo,
          sport,
          isCameFirst,
          kFactor,
          kFactorLabel,
          breakdown: scoreBreakdown,
        });
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
    isCameFirst,
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
    verdicts: scoreBreakdown.map((r) => r.correct),
    isCameFirst,
    badgeLabel: isCameFirst
      ? t("quiz.cameFirstBadge")
      : t(`tier.${difficulty}`, { defaultValue: difficulty }),
    zoomImage,
    setZoomImage,
    onOption,
  };
}
