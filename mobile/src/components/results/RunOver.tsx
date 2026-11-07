import { router } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { FlagCheckered } from "phosphor-react-native/src/icons/FlagCheckered";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Eyebrow, Txt } from "@/components/ui";
import { color, font, space } from "@/theme/tokens";

/** End of an endless run (mockup RunOver). `lastMiss` shows the round that ended it. */
export function RunOver({
  title,
  streak,
  previousBest,
  lastMiss,
  onPlayAgain,
  onTodayResult,
}: {
  title: string;
  streak: number;
  previousBest: number | null;
  lastMiss?: ReactNode;
  onPlayAgain: () => void;
  onTodayResult?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const newBest = previousBest == null || streak > previousBest;
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={title} eyebrow="Endless" onBack={() => router.back()} close />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xxl }}>
        <View style={{ alignItems: "center", gap: space.l }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <FlagCheckered size={16} weight="bold" color={color.muted} />
            <Eyebrow>Run over</Eyebrow>
          </View>
          <Eyebrow c={color.dim}>Streak</Eyebrow>
          <Text style={{ fontFamily: font.mono, fontSize: 88, lineHeight: 96, color: color.cream }}>{streak}</Text>
          {newBest && streak > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <Trophy size={16} weight="fill" color={color.yellow} />
              <Txt v="rowTitle" c={color.yellow}>
                {previousBest != null ? `New best · was ${previousBest}` : "New best"}
              </Txt>
            </View>
          ) : previousBest != null ? (
            <Txt c={color.muted}>{`Best: ${previousBest}`}</Txt>
          ) : null}
        </View>
        {lastMiss ? (
          <View style={{ gap: space.m }}>
            <Eyebrow>The one that got you</Eyebrow>
            {lastMiss}
          </View>
        ) : null}
        <View style={{ gap: space.m }}>
          <Button label="Play again" icon={ArrowClockwise} onPress={onPlayAgain} />
          {onTodayResult ? <Button variant="secondary" label="Today's result" onPress={onTodayResult} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

