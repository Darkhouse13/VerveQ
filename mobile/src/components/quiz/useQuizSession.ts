import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { questionLocale, useAppLeave } from "./QuizParts";

export const QUIZ_MAX = 10;
export type Difficulty = "easy" | "intermediate" | "hard";

type Question = {
  question: string;
  options: string[];
  optionValues: string[];
  checksum: string;
  category: string;
  imageUrl?: string | null;
  /** How long this question has already been on the SERVER clock (a carried-over
   *  or re-served question). The visible timer starts from it so it matches grading. */
  elapsedMs?: number;
  /** Ranked answer window (owner ruling 2026-11-05) and the serve grace before it. */
  answerLimitMs?: number;
  graceMs?: number;
};
export type QuizRow = { correct: boolean; timeTaken: number; score: number };
export type QuizFinish = {
  score: number;
  correctCount: number;
  rows: QuizRow[];
  avgTime: number;
  eloChange: number | null;
  newElo: number | null;
  unlocked: string[];
};

/**
 * Server-authoritative ranked run (quizSessions + games.completeQuiz), the
 * mobile twin of the web's useSoloQuiz. Grading, scoring and rating are the
 * server's; this only sequences the calls.
 */
export function useQuizSession(opts: { sport: string; mode: "quiz" | "came_first"; difficulty: Difficulty; onAbandon: () => void }) {
  const create = useMutation(api.quizSessions.createSession);
  const getQuestion = useMutation(api.quizSessions.getQuestion);
  const check = useMutation(api.quizSessions.checkAnswer);
  const complete = useMutation(api.games.completeQuiz);
  const penalize = useMutation(api.quizSessions.penalizeTabSwitch);
  const endSession = useMutation(api.quizSessions.endSession);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [qNum, setQNum] = useState(1);
  const [rows, setRows] = useState<QuizRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ correct: boolean; correctAnswer: string; explanation?: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  // Local clock bounds for the visible timer (the server's own clock grades).
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  // Wall-clock end of the server's answer window (null = no window sent).
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finish, setFinish] = useState<QuizFinish | null>(null);
  const started = useRef(false);
  const onAbandon = useRef(opts.onAbandon);
  useEffect(() => {
    onAbandon.current = opts.onAbandon;
  });

  const apply = useCallback((q: Question) => {
    setQuestion(q);
    setSelected(null);
    setReveal(null);
    const servedAt = Date.now() - Math.max(0, q.elapsedMs ?? 0);
    setShownAt(servedAt);
    setDeadlineAt(q.answerLimitMs ? servedAt + (q.graceMs ?? 0) + q.answerLimitMs : null);
    setAnsweredAt(null);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await create({ sport: opts.sport, mode: opts.mode, difficulty: opts.difficulty, withFirstQuestion: true, locale: questionLocale() });
        setSessionId(res.sessionId);
        if (res.firstQuestion) apply(res.firstQuestion);
        else apply(await getQuestion({ sessionId: res.sessionId, locale: questionLocale() }));
      } catch {
        setError("Couldn't start a game right now. Try again in a moment.");
      }
    })();
  }, [create, getQuestion, apply, opts.sport, opts.mode, opts.difficulty]);


  // Leaving the app mid-question = the web's tab switch: the server abandons the run.
  // Leaving the screen any other way (quit confirm, back after a reveal) ends
  // the run on the server: with ≥1 answer a ranked run settles as a loss
  // (convex/lib/rankedSettle.ts). A no-op once the run has completed.
  const liveRun = useRef<{ id: string | null; endSession: typeof endSession }>({ id: null, endSession });
  useEffect(() => {
    liveRun.current = { id: finish ? null : sessionId, endSession };
  }, [sessionId, finish, endSession]);
  useEffect(
    () => () => {
      const { id, endSession: end } = liveRun.current;
      if (id) void end({ sessionId: id as never }).catch(() => {});
    },
    [],
  );

  useAppLeave(!!sessionId && !!question && !reveal && !finish, () => {
    if (!sessionId) return;
    void penalize({ sessionId: sessionId as never }).then((r) => {
      if (r.penalized) onAbandon.current();
    });
  });

  const pick = useCallback(
    async (idx: number | null) => {
      if (!question || !sessionId || checking || reveal) return;
      // Instant feedback: the choice lights up and the phone ticks before the
      // server answers; right/wrong follows when it does. `null` = the answer
      // window ran out: an empty answer the server always grades wrong — still
      // one round trip, and the reveal shows the right answer.
      haptic.tap();
      setSelected(idx);
      setAnsweredAt(Date.now());
      setChecking(true);
      try {
        const res = await check({ sessionId: sessionId as never, answer: idx == null ? "" : question.optionValues[idx] });
        if (res.correct) haptic.right();
        else haptic.wrong();
        setReveal({ correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation });
        setTotal((t) => t + res.score);
        setRows((r) => [...r, { correct: res.correct, timeTaken: res.timeTaken, score: res.score }]);
      } catch {
        setSelected(null);
        setAnsweredAt(null);
        setError("That answer didn't go through — try again");
      } finally {
        setChecking(false);
      }
    },
    [question, sessionId, checking, reveal, check],
  );

  const next = useCallback(async () => {
    if (!sessionId || loadingNext) return;
    setLoadingNext(true);
    try {
      if (qNum >= QUIZ_MAX) {
        const avgTime = rows.length ? rows.reduce((a, r) => a + r.timeTaken, 0) / rows.length : 0;
        let result: QuizFinish = { score: total, correctCount: rows.filter((r) => r.correct).length, rows, avgTime, eloChange: null, newElo: null, unlocked: [] };
        try {
          const res = await complete({ sessionId: sessionId as never });
          // completeQuiz runs the achievement pass in the same round trip.
          result = { ...result, score: res.score, correctCount: res.correctCount, eloChange: res.eloChange, newElo: res.newElo, unlocked: res.newlyUnlocked ?? [] };
        } catch {
          // Still show the run; the server holds the answers.
        }
        setFinish(result);
        return;
      }
      try {
        const q = await getQuestion({ sessionId: sessionId as never, locale: questionLocale() });
        setQNum((n) => n + 1);
        apply(q);
      } catch {
        setError("Couldn't load the next question.");
      }
    } finally {
      setLoadingNext(false);
    }
  }, [sessionId, loadingNext, qNum, rows, total, complete, getQuestion, apply]);

  const correctIdx = question && reveal ? question.optionValues.indexOf(reveal.correctAnswer) : -1;
  return { question, qNum, rows, total, selected, reveal, checking, loadingNext, clock: { startedAt: shownAt, stoppedAt: answeredAt, deadlineAt, totalMs: question?.answerLimitMs ?? 0 }, error, finish, correctIdx, pick, next };
}
