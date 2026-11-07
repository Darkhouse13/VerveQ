import { useMutation } from "convex/react";
import { router } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { Brain } from "phosphor-react-native/src/icons/Brain";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { Play } from "phosphor-react-native/src/icons/Play";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NeedsNameCard, useNeedsName } from "@/components/duel/common";
import { AppBar, Button, Card, Eyebrow, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";

type Kind = "football" | "knowledge" | "came_first";
type Difficulty = "easy" | "intermediate" | "hard";

// Same list as the web's CreateDuelModal.
const CATEGORIES = [
  "common_knowledge",
  "history",
  "geography",
  "science",
  "physics",
  "chemistry",
  "biology",
  "astronomy",
  "earth_science",
  "mathematics",
  "literature_arts",
  "philosophy",
  "language",
  "culture",
  "inventions",
  "discoveries",
  "fun_facts",
  "human_knowledge",
  "laws_of_universe",
];
const pretty = (k: string) => {
  const s = k.replace(/_/g, " ").replace("literature arts", "literature & arts");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const KINDS: { key: Kind; title: string; line: string; icon: Icon }[] = [
  { key: "football", title: "Football", line: "Head-to-head football quiz", icon: SoccerBall },
  { key: "knowledge", title: "Knowledge", line: "Science · History · Culture · more", icon: Brain },
  { key: "came_first", title: "Which came first", line: "Two events. Which happened earlier?", icon: Hourglass },
];
const LEVELS: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "intermediate", label: "Medium" },
  { key: "hard", label: "Hard" },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        height: 40,
        paddingHorizontal: space.l,
        borderRadius: 20,
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: on ? color.lime : color.line,
        backgroundColor: on ? color.lime : "transparent",
      }}
    >
      <Txt v="body" c={on ? color.ink : color.cream} style={{ fontFamily: font.bold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export default function NewDuelScreen() {
  const insets = useSafeAreaInsets();
  const { needsName } = useNeedsName();
  const create = useMutation(api.duels.create);
  const [kind, setKind] = useState<Kind>("football");
  const [category, setCategory] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const base = { difficulty, mode: kind === "came_first" ? "came_first" : "quiz", viaLink: true };
      const args =
        kind === "knowledge"
          ? { ...base, type: "knowledge" as const, category: category ?? undefined }
          : kind === "came_first"
            ? { ...base, type: "knowledge" as const, category: "which_came_first" }
            : { ...base, type: "sports" as const, sport: "football" };
      const r = await create(args);
      router.replace(`/duels/${r.duelId}`);
    } catch {
      setError("Couldn't start the duel. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (needsName) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="New duel" onBack={() => router.back()} />
        <NeedsNameCard next="/duels/new" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="New duel" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: space.xxl, gap: space.xxl }}>
        <View style={{ paddingHorizontal: space.gutter, gap: space.s }}>
          <Txt v="h1Game">What do you want to play?</Txt>
          <Txt c={color.muted}>10 questions. Your friend gets 72 hours to beat your score.</Txt>
        </View>

        <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
          <Eyebrow>Game</Eyebrow>
          {KINDS.map((k) => {
            const on = kind === k.key;
            const Ico = k.icon;
            return (
              <Pressable
                key={k.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  haptic.tap();
                  setKind(k.key);
                }}
              >
                <Card style={{ flexDirection: "row", alignItems: "center", gap: space.l, borderColor: on ? color.lime : color.lineSoft, borderWidth: on ? 2 : 1 }}>
                  <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
                    <Ico size={24} weight={on ? "fill" : "regular"} color={on ? color.lime : color.cream} />
                  </View>
                  <View style={{ flex: 1, gap: space.xs }}>
                    <Txt v="rowTitle">{k.title}</Txt>
                    <Txt v="caption" c={color.muted}>
                      {k.line}
                    </Txt>
                  </View>
                  {on ? <CheckCircle size={24} weight="fill" color={color.lime} /> : null}
                </Card>
              </Pressable>
            );
          })}
        </View>

        {kind === "knowledge" ? (
          <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
            <Eyebrow>Topic</Eyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
              <Chip label="Mixed" on={category == null} onPress={() => setCategory(null)} />
              {CATEGORIES.map((c) => (
                <Chip key={c} label={pretty(c)} on={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
          <Eyebrow>Level</Eyebrow>
          <View style={{ flexDirection: "row", gap: space.s }}>
            {LEVELS.map((l) => (
              <Chip key={l.key} label={l.label} on={difficulty === l.key} onPress={() => setDifficulty(l.key)} />
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: space.gutter }}>
          <Card style={{ flexDirection: "row", gap: space.m }}>
            <Lightbulb size={20} weight="bold" color={color.yellow} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle">Play now, invite after</Txt>
              <Txt v="caption" c={color.muted}>
                You take your turn first. When you finish, share a link to challenge a friend to beat your score.
              </Txt>
            </View>
          </Card>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
        {error ? (
          <Txt v="caption" c={color.wrong} center>
            {error}
          </Txt>
        ) : null}
        <Button label={busy ? "Starting…" : "Play duel"} icon={Play} disabled={busy} onPress={start} />
      </View>
    </View>
  );
}
