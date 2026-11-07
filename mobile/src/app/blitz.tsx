import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Lightning } from "phosphor-react-native/src/icons/Lightning";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Share, Text, View } from "react-native";

import { AnswerButton, BottomActions, LoadingNote, QuestionImage, answerStateFor, fmtClock, questionLocale, useAppLeave } from "@/components/quiz/QuizParts";
import { AppBar, Button, Eyebrow, Mono, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, space } from "@/theme/tokens";

const DURATION_MS = 60_000;
type Question = { question: string; options: string[]; optionValues: string[]; checksum: string; imageUrl?: string | null };
type Final = { score: number; correctCount: number; wrongCount: number };

function BlitzResult({ final, topic, onAgain }: { final: Final; topic: string; onAgain: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Blitz" eyebrow={`60 seconds · ${topic}`} onBack={() => router.back()} close />
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
        <Tag label="Time's up" c={color.yellow} />
        <Text style={{ fontFamily: font.mono, fontSize: 72, lineHeight: 80, color: color.cream, letterSpacing: -2 }}>{final.score.toLocaleString("en-US")}</Text>
        <Eyebrow>Points</Eyebrow>
        <View style={{ flexDirection: "row", gap: space.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <CheckCircle size={20} weight="fill" color={color.right} />
            <Txt v="rowTitle">{`${final.correctCount} right`}</Txt>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <XCircle size={20} weight="fill" color={color.wrong} />
            <Txt v="rowTitle">{`${final.wrongCount} wrong`}</Txt>
          </View>
        </View>
      </ScrollView>
      <BottomActions>
        <Button label="Play again" icon={ArrowClockwise} onPress={onAgain} />
        <Button
          variant="secondary"
          label="Share result"
          icon={Export}
          onPress={() =>
            void Share.share({
              message: `VerveQ Blitz — ${final.score} pts in 60 seconds (${final.correctCount} right)\nThink you can beat me? https://verveq.com/games/blitz/`,
            })
          }
        />
      </BottomActions>
    </View>
  );
}

/** Countdown + bar + score: the only part of the run that ticks (200ms). */
function BlitzHeader({ endTimeMs, onExpire, score, right, wrong }: { endTimeMs: number; onExpire: () => void; score: number; right: number; wrong: number }) {
  const [now, setNow] = useState(() => Date.now());
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    if (!endTimeMs) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endTimeMs) expire.current();
    }, 200);
    return () => clearInterval(id);
  }, [endTimeMs]);
  const leftMs = endTimeMs ? Math.max(0, endTimeMs - now) : DURATION_MS;
  const urgent = leftMs <= 10_000;
  return (
    <View style={{ paddingHorizontal: space.gutter, paddingTop: space.s, gap: space.m }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: font.mono, fontSize: 56, lineHeight: 60, color: urgent ? color.wrong : color.cream }} accessibilityRole="timer">
          {fmtClock(Math.ceil(leftMs / 1000))}
        </Text>
        <View style={{ alignItems: "flex-end", gap: space.xs }}>
          <Mono s={17}>{`${score.toLocaleString("en-US")} pts`}</Mono>
          <Mono s={13} c={color.muted}>{`${right} right · ${wrong} wrong`}</Mono>
        </View>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: color.line, overflow: "hidden" }}>
        <View style={{ width: `${(leftMs / DURATION_MS) * 100}%`, height: 8, borderRadius: 4, backgroundColor: urgent ? color.wrong : color.yellow }} />
      </View>
    </View>
  );
}

function Run({ sport, onFinish }: { sport: string; onFinish: (f: Final) => void }) {
  const start = useMutation(api.blitz.start);
  const getQuestion = useMutation(api.blitz.getQuestion);
  const submit = useMutation(api.blitz.submitAnswer);
  const endGame = useMutation(api.blitz.endGame);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [endTimeMs, setEndTimeMs] = useState(0);
  const [score, setScore] = useState(0);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealAnswer, setRevealAnswer] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const over = useRef(false);
  const [ended, setEnded] = useState(false);
  const startedRef = useRef(false);

  const finish = useCallback(async () => {
    if (over.current || !sessionId) return;
    over.current = true;
    setEnded(true);
    try {
      onFinish(await endGame({ sessionId: sessionId as never }));
    } catch {
      // The server allows a short grace window; retry once, then fall back to what we saw.
      await new Promise((r) => setTimeout(r, 1200));
      try {
        onFinish(await endGame({ sessionId: sessionId as never }));
      } catch {
        onFinish({ score, correctCount: right, wrongCount: wrong });
      }
    }
  }, [sessionId, endGame, onFinish, score, right, wrong]);

  const apply = (q: Question) => {
    setQuestion(q);
    setSelected(null);
    setRevealAnswer(null);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await start({ sport, withFirstQuestion: true, locale: questionLocale() });
        setSessionId(res.sessionId);
        setEndTimeMs(res.endTimeMs);
        if (res.firstQuestion) apply(res.firstQuestion);
        else apply(await getQuestion({ sessionId: res.sessionId, locale: questionLocale() }));
      } catch {
        setError("Couldn't start Blitz right now.");
      }
    })();
  }, [start, getQuestion, sport]);

  // The server's endTimeMs is the authority. BlitzHeader ticks on its own and
  // calls finish at zero, so the question and answers don't re-render 5×/s.

  // Leaving the app = the web's tab switch: the current question is marked wrong (−3s).
  useAppLeave(!!sessionId && !!question && !revealAnswer && !ended, () => {
    if (!sessionId || !question) return;
    void submit({ sessionId: sessionId as never, answer: "__tabbed_away__", checksum: question.checksum }).then((res) => {
      setEndTimeMs(res.endTimeMs);
      if (res.gameOver) void finish();
    });
  });

  async function pick(idx: number) {
    if (!question || !sessionId || checking || revealAnswer || over.current) return;
    haptic.tap();
    setSelected(idx);
    setChecking(true);
    try {
      const res = await submit({ sessionId: sessionId as never, answer: question.optionValues[idx], checksum: question.checksum });
      setScore(res.score);
      setEndTimeMs(res.endTimeMs);
      setRevealAnswer(res.correctAnswer ?? question.optionValues[idx]);
      if (res.correct) {
        haptic.right();
        setRight((n) => n + 1);
      } else {
        haptic.wrong();
        setWrong((n) => n + 1);
      }
      if (res.gameOver) {
        setTimeout(() => void finish(), 600);
        return;
      }
      // Fetch the next question during the reveal pause, as the web does.
      const nextQ = getQuestion({ sessionId: sessionId as never, locale: questionLocale() }).catch(() => null);
      setTimeout(
        () =>
          void nextQ.then((q) => {
            if (q) apply(q);
            else void finish();
          }),
        res.correct ? 400 : 800,
      );
    } catch {
      void finish();
    } finally {
      setChecking(false);
    }
  }

  const correctIdx = question && revealAnswer ? question.optionValues.indexOf(revealAnswer) : -1;

  function quit() {
    Alert.alert("Quit Blitz?", "This run won't count.", [
      { text: "Keep playing", style: "cancel" },
      { text: "Quit", style: "destructive", onPress: () => router.back() },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Blitz" eyebrow={`60 seconds · ${sport}`} onBack={quit} close />
      {!question ? (
        <LoadingNote text={error ?? "Loading Blitz…"} />
      ) : (
        <>
          <BlitzHeader endTimeMs={endTimeMs} onExpire={finish} score={score} right={right} wrong={wrong} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.xl }}>
            <QuestionImage uri={question.imageUrl} />
            <Txt v="h1Game">{question.question}</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
              {question.options.map((opt, i) => (
                <View key={`${question.checksum}-${i}`} style={{ flexBasis: "47%", flexGrow: 1 }}>
                  <AnswerButton
                    label={opt}
                    state={answerStateFor(i, { revealed: !!revealAnswer, selected, correctIdx })}
                    disabled={!!revealAnswer || checking}
                    onPress={() => void pick(i)}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
          <BottomActions>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: space.xl }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                <Lightning size={16} weight="fill" color={color.right} />
                <Txt v="caption" c={color.muted}>
                  +100 per right
                </Txt>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                <XCircle size={16} weight="fill" color={color.wrong} />
                <Txt v="caption" c={color.muted}>
                  −3s per wrong
                </Txt>
              </View>
            </View>
          </BottomActions>
        </>
      )}
    </View>
  );
}

export default function BlitzScreen() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const sport = params.sport === "knowledge" ? "knowledge" : "football";
  const { ready } = useSession();
  const [final, setFinal] = useState<Final | null>(null);
  const [run, setRun] = useState(1);
  if (!ready) return <View style={{ flex: 1, backgroundColor: color.ink }}><LoadingNote text="Loading…" /></View>;
  if (final)
    return (
      <BlitzResult
        final={final}
        topic={sport}
        onAgain={() => {
          setFinal(null);
          setRun((n) => n + 1);
        }}
      />
    );
  return <Run key={run} sport={sport} onFinish={setFinal} />;
}
