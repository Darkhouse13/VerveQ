import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { TextAa } from "phosphor-react-native/src/icons/TextAa";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import {
  AnswerButton,
  BottomActions,
  Explanation,
  FooterNote,
  LETTERS,
  LoadingNote,
  QuestionBlock,
  ScoreClockRow,
  answerStateFor,
  fmtClock,
  questionLocale,
  useAppLeave,
} from "@/components/quiz/QuizParts";
import { DailyQuizResultView, type NextToday } from "@/components/quiz/DailyQuizResult";
import { AppBar, Button, Mono, ProgressSegments, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, modeAccent, space } from "@/theme/tokens";

const SPORT = "football";
const MAX = 10;
// Same reveal beat as the web daily (useDailyQuiz AUTO_ADVANCE_DELAY_MS).
const AUTO_ADVANCE_MS = 2000;

type Row = { correct: boolean; timeTaken: number; score: number };
type Finished = { score: number; rows: Row[] };

function isRow(r: unknown): r is Row {
  return typeof r === "object" && r !== null && typeof (r as Row).correct === "boolean" && typeof (r as Row).score === "number";
}

function todayEyebrow() {
  const d = new Date();
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase()} · FOOTBALL`;
}

function useNextToday(): NextToday | null {
  const { ready } = useSession();
  const older = useQuery(api.whosOlder.getToday, ready ? {} : "skip");
  const letters = useQuery(api.missingLetters.getToday, ready ? {} : "skip");
  if (letters && letters.daily?.status !== "completed")
    return { title: "Missing Letters", edition: letters.edition, line: "Name the player. 10 a day.", accent: modeAccent.missingLetters, icon: TextAa, href: "/missing-letters" };
  if (older && older.daily?.status !== "completed")
    return { title: "Who's Older?", edition: older.edition, line: "Tap the older player. 10 a day.", accent: modeAccent.whosOlder, icon: UsersThree, href: "/whos-older" };
  return null;
}

function Result({ finished }: { finished: Finished }) {
  const next = useNextToday();
  const correct = finished.rows.filter((r) => r.correct).length;
  const totalTime = finished.rows.reduce((a, r) => a + (r.timeTaken ?? 0), 0);
  const date = new Date().toISOString().slice(0, 10);
  const grid = finished.rows.map((r) => (r.correct ? "🟩" : "🟥")).join("");
  return (
    <DailyQuizResultView
      title="Daily Quiz"
      eyebrow={todayEyebrow()}
      accent={modeAccent.dailyQuiz}
      correct={correct}
      total={MAX}
      squares={finished.rows.map((r) => r.correct)}
      stats={[`${finished.score.toLocaleString("en-US")} pts`, ...(totalTime > 0 ? [`${fmtClock(totalTime)} total`] : [])]}
      shareText={`VerveQ Daily Quiz · Football · ${date} — ${correct}/${MAX} · ${finished.score} pts\n${grid}\nThink you can beat me? https://verveq.com/games/daily-football-quiz/?ref=daily_share`}
      next={next}
    />
  );
}

/** Wall-clock time of a tap (event handlers only). */
const tapTime = () => Date.now();

export default function DailyQuizScreen() {
  const { ready } = useSession();
  const status = useQuery(api.dailyChallenge.getAttemptStatus, ready ? { sport: SPORT, mode: "quiz" } : "skip");
  const getOrCreate = useMutation(api.dailyChallenge.getOrCreateChallenge);
  const startAttempt = useMutation(api.dailyChallenge.startAttempt);
  const submitAnswer = useMutation(api.dailyChallenge.submitAnswer);
  const forfeit = useMutation(api.dailyChallenge.forfeit);
  const completeAttempt = useMutation(api.dailyChallenge.completeAttempt);

  // What this visit is: decided once, so the attempt we start never swaps the screen.
  const [arrival, setArrival] = useState<"play" | "spent" | Finished | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ correct: boolean; correctAnswer: string; explanation?: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [forfeited, setForfeited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const starting = useRef(false);

  const question = useQuery(
    api.dailyChallenge.getQuestion,
    attemptId && !finished && !forfeited && qIndex < MAX
      ? { attemptId: attemptId as never, questionIndex: qIndex, locale: questionLocale() }
      : "skip",
  );

  // Arrival, latched once: finished today → show it; spent (forfeited / mid-run elsewhere) → say so; else play.
  if (arrival === null && status !== undefined) {
    const stored = status && Array.isArray(status.results) ? (status.results as unknown[]).filter(isRow) : [];
    // A mid-run attempt (≥1 answer, still continuable) resumes instead of reading as spent.
    setArrival(
      status === null || status.resumable
        ? "play"
        : status.completed && !status.forfeited && stored.length > 0
          ? { score: status.score, rows: stored }
          : "spent",
    );
  }

  useEffect(() => {
    if (arrival !== "play" || attemptId || starting.current) return;
    starting.current = true;
    (async () => {
      try {
        await getOrCreate({ sport: SPORT, mode: "quiz" });
        const started = await startAttempt({ sport: SPORT, mode: "quiz" });
        // Resume where the server says the run stands (mid-run, or question 1
        // recorded as a timeout after the attempt expired unanswered).
        const resumeAt = started.resumeAt ?? 0;
        if (resumeAt > 0) {
          const prior = Array.isArray(started.results) ? (started.results as unknown[]).filter(isRow) : [];
          setRows(prior.map(({ correct, timeTaken, score }) => ({ correct, timeTaken, score })));
          setTotal(started.score ?? 0);
          setQIndex(resumeAt);
        }
        setAttemptId(started.attemptId);
      } catch (e) {
        setError(String(e).includes("lready") ? "You've already played today's Daily Quiz." : "Couldn't start today's Daily Quiz.");
      }
    })();
  }, [arrival, attemptId, getOrCreate, startAttempt]);

  // Warm the next question while the reveal is on screen. Integrity-neutral:
  // submitAnswer already started the next question's server clock
  // (questionStartedAts[i + 1] = submit time), so seeing it a beat early buys
  // no free time — it only removes the wait after "Next question".
  const upcoming = useQuery(
    api.dailyChallenge.getQuestion,
    attemptId && reveal && !finished && !forfeited && qIndex + 1 < MAX
      ? { attemptId: attemptId as never, questionIndex: qIndex + 1, locale: questionLocale() }
      : "skip",
  );
  const upcomingImage = upcoming?.imageUrl ?? null;
  useEffect(() => {
    if (upcomingImage) void Image.prefetch(upcomingImage, "memory-disk");
  }, [upcomingImage]);

  // Question clock (server start time is the authority); the leaf LiveClock ticks on its own.
  const startedAt = question?.questionStartedAt ?? null;

  // Leaving the app = the web's tab switch: today's attempt is forfeited.
  useAppLeave(!!attemptId && !finished && !forfeited, () => {
    setForfeited(true);
    if (attemptId) void forfeit({ attemptId: attemptId as never });
  });

  async function pick(idx: number) {
    if (!question || !attemptId || checking || reveal) return;
    haptic.tap();
    setSelected(idx);
    setAnsweredAt(tapTime());
    setChecking(true);
    try {
      const res = await submitAnswer({ attemptId: attemptId as never, answer: question.optionValues[idx], questionIndex: qIndex });
      if (res.correct) haptic.right();
      else haptic.wrong();
      setReveal({ correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation });
      setTotal(res.totalScore);
      setRows((r) => [...r, { correct: res.correct, timeTaken: res.timeTaken, score: res.score }]);
    } catch {
      setSelected(null);
      setAnsweredAt(null);
      setError("That answer didn't go through — try again");
    } finally {
      setChecking(false);
    }
  }

  async function next() {
    if (qIndex + 1 >= MAX) {
      try {
        if (attemptId) await completeAttempt({ attemptId: attemptId as never });
      } catch {
        // The result is still shown; the server already holds every answer.
      }
      setFinished({ score: total, rows });
      return;
    }
    setReveal(null);
    setSelected(null);
    setAnsweredAt(null);
    setQIndex((i) => i + 1);
  }

  function quit() {
    if (!attemptId || finished || forfeited) return router.back();
    Alert.alert("Quit today's quiz?", "It counts as played — there's one try a day.", [
      { text: "Keep playing", style: "cancel" },
      {
        text: "Quit",
        style: "destructive",
        onPress: () => {
          setForfeited(true);
          void forfeit({ attemptId: attemptId as never });
          router.back();
        },
      },
    ]);
  }

  // The next question's server clock starts when this answer lands (the serve
  // grace covers the web's 2s reveal + network), so a reveal held open by hand
  // costs the player points. Advance on the web's beat; the button still skips it.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });
  useEffect(() => {
    if (!reveal || qIndex + 1 >= MAX) return;
    const t = setTimeout(() => void nextRef.current(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [reveal, qIndex]);

  const shown = finished ?? (arrival && typeof arrival === "object" ? arrival : null);
  if (shown) return <Result finished={shown} />;

  const correctIdx = question && reveal ? question.optionValues.indexOf(reveal.correctAnswer) : -1;
  const segs = [...rows.map((r) => (r.correct ? "right" : "wrong") as "right" | "wrong"), ...(reveal ? [] : (["current"] as const))];

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="Daily Quiz"
        eyebrow={todayEyebrow()}
        onBack={quit}
        close
        right={
          <Mono s={15}>
            {Math.min(qIndex + 1, MAX)}
            <Mono s={15} c={color.dim}>{`/${MAX}`}</Mono>
          </Mono>
        }
      />
      {forfeited ? (
        <View style={{ flex: 1 }}>
          <LoadingNote text="You left the app, so today's quiz is over. A new one opens at midnight UTC." />
          <BottomActions>
            <Button label="Back to Play" onPress={() => router.back()} />
          </BottomActions>
        </View>
      ) : arrival === "spent" || (error && !attemptId) ? (
        <View style={{ flex: 1 }}>
          <LoadingNote text={error ?? "You've already played today's Daily Quiz. A new one opens at midnight UTC."} />
          <BottomActions>
            <Button label="Back to Play" onPress={() => router.back()} />
          </BottomActions>
        </View>
      ) : !question ? (
        <LoadingNote text="Loading the Daily Quiz…" />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingTop: space.s }}>
            <ProgressSegments states={segs} total={MAX} />
            <View style={{ height: space.l }} />
            <ScoreClockRow points={total} clock={{ startedAt, stoppedAt: answeredAt }} />
            <QuestionBlock text={question.question} image={question.imageUrl} tag="Daily" tagColor={color.yellow} verdict={reveal ? reveal.correct : null} />
            <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
              {question.options.map((opt, i) => (
                <AnswerButton
                  key={`${qIndex}-${i}`}
                  letter={LETTERS[i]}
                  label={opt}
                  state={answerStateFor(i, { revealed: !!reveal, selected, correctIdx })}
                  disabled={!!reveal || checking}
                  onPress={() => void pick(i)}
                />
              ))}
            </View>
            {reveal?.explanation ? <Explanation text={reveal.explanation} /> : null}
            {error && attemptId ? (
              <Txt v="caption" c={color.wrong} center style={{ marginTop: space.l }}>
                {error}
              </Txt>
            ) : null}
          </ScrollView>
          <BottomActions>
            {reveal ? (
              <Button label={qIndex + 1 >= MAX ? "See result" : "Next question"} icon={ArrowRight} iconRight onPress={() => void next()} />
            ) : (
              <FooterNote text="Leaving the app ends today's quiz" />
            )}
          </BottomActions>
        </>
      )}
    </View>
  );
}
