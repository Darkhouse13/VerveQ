import { router, type Href } from "expo-router";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Info } from "phosphor-react-native/src/icons/Info";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { color, font, radius, space } from "@/theme/tokens";

function ModeCard({
  href,
  meta,
  badge,
  title,
  body,
  highlight,
  footer,
}: {
  href: Href;
  meta: string;
  badge?: string;
  title: string;
  body: string;
  highlight?: boolean;
  footer: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        router.push(href);
      }}
      style={({ pressed }) => ({
        backgroundColor: color.surface,
        borderRadius: radius.hero,
        borderWidth: highlight ? 1.5 : 1,
        borderColor: highlight ? color.lime : color.lineSoft,
        padding: space.gutter,
        gap: space.l,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow>{meta}</Eyebrow>
        {badge ? (
          <View style={{ borderWidth: 1, borderColor: color.lime, borderRadius: radius.chip, paddingHorizontal: space.s, paddingVertical: space.xs }}>
            <Mono s={10} c={color.lime} style={{ letterSpacing: 1.2 }}>
              {badge}
            </Mono>
          </View>
        ) : null}
      </View>
      <View style={{ gap: space.s }}>
        <Txt v="h1Game" style={{ fontSize: 24, lineHeight: 30 }}>
          {title}
        </Txt>
        <Txt c={color.muted}>{body}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {footer}
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.lime, alignItems: "center", justifyContent: "center" }}>
          <ArrowRight size={20} weight="bold" color={color.ink} />
        </View>
      </View>
    </Pressable>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: color.surfaceHigh }}>
      <Txt v="caption" c={color.muted} style={{ fontFamily: font.bold }}>
        {label}
      </Txt>
    </View>
  );
}

export default function CareerPathModes() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Career Path" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, flexGrow: 1 }}>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.s }}>
          <Eyebrow>Two ways to play</Eyebrow>
          <Txt v="h1Tab">Pick a mode</Txt>
          <Txt c={color.muted}>Take one path at your own pace, or try 10 Path from our reels.</Txt>
        </View>

        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.m }}>
          <ModeCard
            href="/career-path/classic"
            meta="No timer · 3 guesses"
            title="One at a time"
            body="The original mode. One career path, no clock, three guesses — then play another whenever you're ready."
            footer={
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Chip label="Osasuna" />
                <CaretRight size={16} weight="bold" color={color.dim} />
                <Chip label="Chelsea" />
                <CaretRight size={16} weight="bold" color={color.dim} />
                <Mono c={color.lime}>?</Mono>
              </View>
            }
          />
          <ModeCard
            href="/career-path/ladder"
            meta="10 paths · 30s each"
            badge="FROM THE REELS"
            title="10 Path"
            body="Ten career paths. They get harder. You have 30 seconds for each one — how far do you get?"
            highlight
            footer={
              <View style={{ flexDirection: "row", gap: space.xs, width: 168 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: 10 }, (_, i) => (
                  <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < 2 ? color.right : color.line }} />
                ))}
              </View>
            }
          />
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s, paddingTop: space.xxl, paddingHorizontal: space.gutter }}>
          <Info size={16} weight="bold" color={color.dim} />
          <Txt v="caption" c={color.dim}>
            Football only · leaving the app ends a One at a time round
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
