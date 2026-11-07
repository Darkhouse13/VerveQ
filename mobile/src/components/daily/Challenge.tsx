import { router } from "expo-router";
import { Clock } from "phosphor-react-native/src/icons/Clock";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Play } from "phosphor-react-native/src/icons/Play";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Card, Eyebrow, Tag, Txt } from "@/components/ui";
import { color, font, radius, space } from "@/theme/tokens";

const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

function Avatar({ name, bg }: { name: string; bg: string }) {
  return (
    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Txt v="cardTitle" c={color.ink}>
        {initial(name)}
      </Txt>
    </View>
  );
}

/** Mockup ChallengeLanding: a friend opened a challenge link. */
export function ChallengeLanding({
  title,
  edition,
  fromName,
  score,
  total,
  accent,
  line,
  onPlay,
}: {
  title: string;
  edition: number;
  fromName: string;
  score: number;
  total: number;
  accent: string;
  line: string;
  onPlay: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={title} eyebrow={`Challenge · #${edition}`} onBack={() => router.replace("/")} close />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.gutter, paddingTop: space.xxl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <View style={{ alignItems: "center", gap: space.l }}>
          <View>
            <Avatar name={fromName} bg={accent} />
            <View style={{ position: "absolute", right: -space.s, bottom: -space.xs, width: 24, height: 24, borderRadius: 12, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" }}>
              <Sword size={16} weight="fill" color={color.lime} />
            </View>
          </View>
          <Txt v="h1Game" center>{`${fromName} scored ${score}/${total} on #${edition}. Beat it.`}</Txt>
          <Txt c={color.muted} center>
            {line}
          </Txt>
        </View>
        <Card hero style={{ alignItems: "center", gap: space.s }}>
          <Eyebrow>Score to beat</Eyebrow>
          <Text style={{ fontFamily: font.mono, fontSize: 64, lineHeight: 72, color: color.cream }}>
            {score}
            <Text style={{ fontSize: 32, color: color.dim }}>{`/${total}`}</Text>
          </Text>
        </Card>
        <View style={{ flex: 1 }} />
        <View style={{ gap: space.m }}>
          <Button label="Play the challenge" icon={Play} onPress={onPlay} />
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.s }}>
            <Clock size={16} weight="bold" color={color.dim} />
            <Txt v="caption" c={color.dim}>
              Free · no sign-up · about 1 minute
            </Txt>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Mockup ChallengeResult: the head-to-head once the friend has played. */
export function ChallengeResult({
  title,
  edition,
  fromName,
  theirScore,
  myScore,
  total,
  myHistory,
  accent,
  onSendBack,
}: {
  title: string;
  edition: number;
  fromName: string;
  theirScore: number;
  myScore: number;
  total: number;
  myHistory?: { correct: boolean }[];
  accent: string;
  onSendBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const verdict = myScore > theirScore ? "won" : myScore < theirScore ? "lost" : "tie";
  const head = verdict === "won" ? `You beat ${fromName}` : verdict === "lost" ? `${fromName} wins this one` : `Dead heat with ${fromName}`;
  const tag = verdict === "won" ? "You won" : verdict === "lost" ? "They won" : "Tie";
  const side = (name: string, score: number, bg: string, win: boolean) => (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        gap: space.m,
        padding: space.l,
        borderRadius: radius.card,
        borderWidth: win ? 2 : 1,
        borderColor: win ? color.right : color.lineSoft,
        backgroundColor: win ? color.rightBg : color.surface,
      }}
    >
      <Avatar name={name} bg={bg} />
      <Txt v="rowTitle" numberOfLines={1}>
        {name}
      </Txt>
      <Text style={{ fontFamily: font.mono, fontSize: 40, lineHeight: 48, color: color.cream }}>{score}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={title} eyebrow={`Challenge · #${edition}`} onBack={() => router.replace("/")} close />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xxl }}>
        <View style={{ alignItems: "center", gap: space.s }}>
          <Tag label={tag} tone="solid" c={verdict === "won" ? color.right : verdict === "lost" ? color.wrong : color.muted} />
          <Txt v="h1Game" center>
            {head}
          </Txt>
        </View>
        <View style={{ flexDirection: "row", gap: space.m, alignItems: "stretch" }}>
          {side("You", myScore, color.lime, verdict === "won")}
          {side(fromName, theirScore, accent, verdict === "lost")}
        </View>
        {myHistory && myHistory.length ? (
          <View style={{ gap: space.m }}>
            <Eyebrow>Your rounds</Eyebrow>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              {Array.from({ length: total }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 16, borderRadius: 4, backgroundColor: myHistory[i] ? (myHistory[i]!.correct ? color.right : color.wrong) : color.line }} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ gap: space.m }}>
          {onSendBack ? <Button label={`Send it back to ${fromName}`} icon={Export} onPress={onSendBack} /> : null}
          <Button variant="secondary" label="Play today's games" onPress={() => router.replace("/")} />
        </View>
      </ScrollView>
    </View>
  );
}
