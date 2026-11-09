import { useQuery } from "convex/react";
import { router } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { ArrowDown } from "phosphor-react-native/src/icons/ArrowDown";
import { ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { Medal } from "phosphor-react-native/src/icons/Medal";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Eyebrow, Mono, Txt } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";
import { NEXT_TIER, TIER_COLOR, TIER_FLOOR, TIER_NAME, TierBadge, tierFor } from "./TierBadge";
import type { QuizFinish } from "./useQuizSession";

function Stat({ label, value, c = color.cream }: { label: string; value: string; c?: string }) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, padding: space.l, gap: space.s }}>
      <Eyebrow>{label}</Eyebrow>
      <Mono s={28} c={c}>
        {value}
      </Mono>
    </View>
  );
}

/** End of a ranked Quiz / Which Came First run (mockup ResultRanked). */
export function RankedResult({ title, eyebrow, finish, total, onPlayAgain }: { title: string; eyebrow: string; finish: QuizFinish; total: number; onPlayAgain: () => void }) {
  const insets = useSafeAreaInsets();
  const achievements = useQuery(api.achievements.list, finish.unlocked.length ? {} : "skip");
  const unlocked = finish.unlocked.map((id) => achievements?.find((a) => a.achievementId === id)).filter(Boolean);
  const wrong = finish.rows.filter((r) => !r.correct).length;
  const accuracy = finish.rows.length ? Math.round((finish.correctCount / finish.rows.length) * 100) : 0;
  const elo = finish.newElo;
  const tier = elo != null ? tierFor(elo) : null;
  const nextTier = tier ? NEXT_TIER[tier] : null;
  const progress = tier && nextTier && elo != null ? Math.min(1, Math.max(0, (elo - TIER_FLOOR[tier]) / (TIER_FLOOR[nextTier] - TIER_FLOOR[tier]))) : 1;
  const change = finish.eloChange ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={title} eyebrow={eyebrow} onBack={() => router.back()} close />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        {unlocked.length ? (
          <View style={{ marginHorizontal: space.gutter, marginTop: space.l, flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.lime }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.lime, alignItems: "center", justifyContent: "center" }}>
              <Medal size={24} weight="fill" color={color.ink} />
            </View>
            <View style={{ flex: 1, gap: space.xs }}>
              <Eyebrow c={color.lime}>Achievement unlocked</Eyebrow>
              <Txt v="body" style={{ fontFamily: font.bold }}>
                {unlocked.map((a) => `${a!.name} · ${a!.description}`).join("\n")}
              </Txt>
            </View>
          </View>
        ) : null}

        <View style={{ alignItems: "center", gap: space.s, paddingTop: space.xxl, paddingHorizontal: space.gutter }}>
          <Eyebrow>Points</Eyebrow>
          <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.mono, fontSize: 72, lineHeight: 80, color: color.cream, letterSpacing: -2 }}>{finish.score.toLocaleString("en-US")}</Text>
          <Txt c={color.muted}>{`${finish.correctCount} of ${total} right`}</Txt>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m, paddingHorizontal: space.gutter, paddingTop: space.xxl }}>
          <Stat label="Right" value={String(finish.correctCount)} c={color.right} />
          <Stat label="Wrong" value={String(wrong)} c={color.wrong} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Average time" value={`${finish.avgTime.toFixed(1)} s`} />
        </View>

        {elo != null && tier ? (
          <View style={{ marginHorizontal: space.gutter, marginTop: space.xl, padding: space.gutter, gap: space.l, backgroundColor: color.surface, borderRadius: radius.hero, borderWidth: 1, borderColor: color.lineSoft }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: space.xs }}>
                <Eyebrow>Rating</Eyebrow>
                <Mono s={28}>{elo.toLocaleString("en-US")}</Mono>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.chip, backgroundColor: change >= 0 ? color.right : color.wrong }}>
                {change >= 0 ? <ArrowUp size={16} weight="bold" color={color.ink} /> : <ArrowDown size={16} weight="bold" color={color.ink} />}
                <Mono s={15} c={color.ink}>
                  {`${change >= 0 ? "+" : "−"}${Math.abs(change)}`}
                </Mono>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <TierBadge tier={tier} size={32} />
              <Txt v="caption" c={TIER_COLOR[tier]} style={{ fontFamily: font.bold }}>
                {TIER_NAME[tier]}
              </Txt>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line, overflow: "hidden" }}>
                <View style={{ width: `${Math.round(progress * 100)}%`, height: 8, borderRadius: 4, backgroundColor: TIER_COLOR[nextTier ?? tier] }} />
              </View>
              {nextTier ? (
                <>
                  <Txt v="caption" c={TIER_COLOR[nextTier]} style={{ fontFamily: font.bold }}>
                    {TIER_NAME[nextTier]}
                  </Txt>
                  <TierBadge tier={nextTier} size={32} />
                </>
              ) : null}
            </View>
            {nextTier ? (
              <Txt v="caption" c={color.muted}>{`${(TIER_FLOOR[nextTier] - elo).toLocaleString("en-US")} to reach ${TIER_NAME[nextTier]}`}</Txt>
            ) : (
              <Txt v="caption" c={color.muted}>
                Top tier
              </Txt>
            )}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.m }}>
          <Button label="Play again" icon={ArrowClockwise} onPress={onPlayAgain} />
          <Button variant="secondary" label="Home" onPress={() => router.dismissTo("/")} />
        </View>
      </ScrollView>
    </View>
  );
}
