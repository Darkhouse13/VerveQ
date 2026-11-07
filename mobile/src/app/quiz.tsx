import { router, useLocalSearchParams } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { Brain } from "phosphor-react-native/src/icons/Brain";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { BottomActions, FullAccountGate, LoadingNote } from "@/components/quiz/QuizParts";
import { QuizRunView } from "@/components/quiz/QuizRunView";
import { RankedResult } from "@/components/quiz/RankedResult";
import { useQuizSession, type Difficulty } from "@/components/quiz/useQuizSession";
import { AppBar, Button, Eyebrow, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { color, radius, space } from "@/theme/tokens";

type Topic = "football" | "knowledge";
const LEVELS: { id: Difficulty; name: string; line: string }[] = [
  { id: "easy", name: "Easy", line: "Top clubs and major leagues" },
  { id: "intermediate", name: "Medium", line: "Adds more leagues and cups" },
  { id: "hard", name: "Hard", line: "Every club and competition" },
];
const LEVEL_NAME: Record<Difficulty, string> = { easy: "Easy", intermediate: "Medium", hard: "Hard" };

function TopicButton({ label, icon: Ico, on, onPress }: { label: string; icon: Icon; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        flex: 1,
        height: 56,
        borderRadius: radius.input,
        borderWidth: on ? 2 : 1.5,
        borderColor: on ? color.lime : color.line,
        backgroundColor: color.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.s,
      }}
    >
      <Ico size={20} weight={on ? "fill" : "bold"} color={on ? color.lime : color.cream} />
      <Txt v="rowTitle">{label}</Txt>
    </Pressable>
  );
}

function LevelRow({ name, line, on, onPress }: { name: string; line: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        minHeight: 64,
        borderRadius: radius.card,
        borderWidth: on ? 2 : 1.5,
        borderColor: on ? color.lime : color.line,
        backgroundColor: color.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
      }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? color.lime : color.dim, alignItems: "center", justifyContent: "center" }}>
        {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.lime }} /> : null}
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Txt v="rowTitle">{name}</Txt>
        <Txt v="caption" c={color.muted}>
          {line}
        </Txt>
      </View>
    </Pressable>
  );
}

function Setup({ topic, setTopic, level, setLevel, onStart }: { topic: Topic; setTopic: (t: Topic) => void; level: Difficulty; setLevel: (d: Difficulty) => void; onStart: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="" onBack={() => router.back()} right={<Tag label="Ranked" c={color.lime} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.xxl }}>
        <View style={{ gap: space.s }}>
          <Txt v="h1Tab">Quiz</Txt>
          <Txt c={color.muted}>10 questions. Your score moves your rating.</Txt>
        </View>
        <View style={{ gap: space.m }}>
          <Eyebrow>Topic</Eyebrow>
          <View style={{ flexDirection: "row", gap: space.m }}>
            <TopicButton label="Football" icon={SoccerBall} on={topic === "football"} onPress={() => setTopic("football")} />
            <TopicButton label="Knowledge" icon={Brain} on={topic === "knowledge"} onPress={() => setTopic("knowledge")} />
          </View>
        </View>
        <View style={{ gap: space.m }}>
          <Eyebrow>Level</Eyebrow>
          {LEVELS.map((l) => (
            <LevelRow key={l.id} name={l.name} line={topic === "knowledge" ? levelLineKnowledge(l.id) : l.line} on={level === l.id} onPress={() => setLevel(l.id)} />
          ))}
        </View>
      </ScrollView>
      <BottomActions>
        <Txt v="caption" c={color.dim} center>
          You can always change this later
        </Txt>
        <Button label="Start game" icon={ArrowRight} iconRight onPress={onStart} />
      </BottomActions>
    </View>
  );
}

function levelLineKnowledge(d: Difficulty) {
  return d === "easy" ? "Casual fun, relaxed pace" : d === "intermediate" ? "A fair test" : "Expert level, no mercy";
}

function Run({ topic, level, onAgain }: { topic: Topic; level: Difficulty; onAgain: () => void }) {
  const run = useQuizSession({
    sport: topic,
    mode: "quiz",
    difficulty: level,
    onAbandon: () => {
      Alert.alert("Game ended", "You left the app, so this game doesn't count.");
      router.back();
    },
  });
  const eyebrow = `Ranked · ${LEVEL_NAME[level]}`;
  const title = topic === "knowledge" ? "Knowledge Quiz" : "Quiz";
  if (run.finish) return <RankedResult title={title} eyebrow={eyebrow} finish={run.finish} total={10} onPlayAgain={onAgain} />;
  return <QuizRunView run={run} title={title} eyebrow={eyebrow} tag={LEVEL_NAME[level]} />;
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ topic?: string; difficulty?: string }>();
  const { ready, user } = useSession();
  const [topic, setTopic] = useState<Topic>(params.topic === "knowledge" ? "knowledge" : "football");
  const [level, setLevel] = useState<Difficulty>(params.difficulty === "easy" || params.difficulty === "hard" ? params.difficulty : "intermediate");
  const [run, setRun] = useState(0); // 0 = setup; n = nth run (a fresh session each time)

  if (!ready) return <View style={{ flex: 1, backgroundColor: color.ink }}><LoadingNote text="Loading…" /></View>;
  if (user?.isAnonymous || user?.isGuest) return <FullAccountGate title={topic === "knowledge" ? "Knowledge Quiz" : "Quiz"} eyebrow="Ranked" />;
  if (run === 0) return <Setup topic={topic} setTopic={setTopic} level={level} setLevel={setLevel} onStart={() => setRun(1)} />;
  return <Run key={run} topic={topic} level={level} onAgain={() => setRun((n) => n + 1)} />;
}

