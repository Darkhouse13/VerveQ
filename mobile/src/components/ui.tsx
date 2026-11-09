import * as Haptics from "expo-haptics";
import type { Icon as PhosphorIcon, IconWeight } from "phosphor-react-native";
import { CaretLeft } from "phosphor-react-native/src/icons/CaretLeft";
import { X } from "phosphor-react-native/src/icons/X";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, font, radius, size, space } from "@/theme/tokens";

// ── Text ────────────────────────────────────────────────────────────────

// Large system font: body text grows up to 1.3×, display numbers (40px+)
// stay put so fixed cards and score heroes keep their shape.
export const MAX_TEXT_SCALE = 1.3;
const scaleFor = (px: number) => (px >= 40 ? 1 : MAX_TEXT_SCALE);

type TxtVariant = "h1Tab" | "h1Game" | "cardTitle" | "rowTitle" | "body" | "caption" | "micro";
const txt: Record<TxtVariant, TextStyle> = {
  h1Tab: { fontFamily: font.bold, fontSize: size.h1Tab, lineHeight: 35, letterSpacing: -0.6 },
  h1Game: { fontFamily: font.bold, fontSize: size.h1Game, lineHeight: 34, letterSpacing: -0.5 },
  cardTitle: { fontFamily: font.bold, fontSize: size.cardTitle, lineHeight: 26 },
  rowTitle: { fontFamily: font.bold, fontSize: size.rowTitle, lineHeight: 22 },
  body: { fontFamily: font.medium, fontSize: size.body, lineHeight: 22 },
  caption: { fontFamily: font.medium, fontSize: size.caption, lineHeight: 18 },
  micro: { fontFamily: font.bold, fontSize: size.micro, lineHeight: 16 },
};

export function Txt({
  v = "body",
  c = color.cream,
  style,
  children,
  numberOfLines,
  center,
  maxScale = MAX_TEXT_SCALE,
}: {
  maxScale?: number;
  v?: TxtVariant;
  c?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  center?: boolean;
}) {
  return (
    <Text maxFontSizeMultiplier={maxScale} numberOfLines={numberOfLines} style={[txt[v], { color: c }, center && { textAlign: "center" }, style]}>
      {children}
    </Text>
  );
}

export function Mono({ s = 15, c = color.cream, style, children, maxScale }: { s?: number; c?: string; style?: StyleProp<TextStyle>; children: ReactNode; maxScale?: number }) {
  return <Text maxFontSizeMultiplier={maxScale ?? scaleFor(s)} style={[{ fontFamily: font.mono, fontSize: s, color: c }, style]}>{children}</Text>;
}

export function Eyebrow({ c = color.muted, children }: { c?: string; children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: size.eyebrow, letterSpacing: 1.5, color: c }}>
      {typeof children === "string" ? children.toUpperCase() : children}
    </Text>
  );
}

// ── Haptics ─────────────────────────────────────────────────────────────

export const haptic = {
  tap: () => void Haptics.selectionAsync(),
  right: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  wrong: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

// ── Buttons ─────────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  iconRight,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: PhosphorIcon;
  iconRight?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary";
  const h = primary ? size.buttonPrimary : size.buttonSecondary;
  const fg = primary ? color.ink : color.cream;
  const ic = Icon ? <Icon size={20} weight="bold" color={fg} /> : null;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: h,
          paddingVertical: space.s,
          borderRadius: h / 2,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.s,
          paddingHorizontal: space.xl,
          backgroundColor: primary ? color.lime : "transparent",
          borderWidth: variant === "secondary" ? 1.5 : 0,
          borderColor: color.line,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {!iconRight && ic}
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: primary ? 17 : 15, color: fg }}>{label}</Text>
      {iconRight && ic}
    </Pressable>
  );
}

export function PillButton({ label, onPress, outline }: { label: string; onPress?: () => void; outline?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: size.pill,
        paddingHorizontal: space.l,
        borderRadius: size.pill / 2,
        justifyContent: "center",
        backgroundColor: outline ? "transparent" : color.lime,
        borderWidth: outline ? 1.5 : 0,
        borderColor: color.lime,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 15, color: outline ? color.lime : color.ink }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  weight = "regular",
}: {
  icon: PhosphorIcon;
  label: string;
  onPress?: () => void;
  weight?: IconWeight;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: size.iconButton,
        height: size.iconButton,
        borderRadius: size.iconButton / 2,
        backgroundColor: color.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon size={24} weight={weight} color={color.cream} />
    </Pressable>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────

/** The 56px top app bar under the status bar (spec §2). */
export function AppBar({
  title,
  eyebrow,
  onBack,
  close,
  right,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  close?: boolean;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, paddingHorizontal: space.s, backgroundColor: color.ink }}>
      <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {onBack ? (
          <IconButton icon={close ? X : CaretLeft} label={close ? "Quit" : "Back"} onPress={onBack} />
        ) : (
          <View style={{ width: size.iconButton }} />
        )}
        <View style={{ alignItems: "center", gap: space.xs, flexShrink: 1 }}>
          <Txt v="rowTitle" numberOfLines={1}>
            {title}
          </Txt>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        </View>
        <View style={{ minWidth: size.iconButton, alignItems: "center", justifyContent: "center" }}>{right}</View>
      </View>
    </View>
  );
}

export function Card({ children, style, hero }: { children: ReactNode; style?: StyleProp<ViewStyle>; hero?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: color.surface,
          borderRadius: hero ? radius.hero : radius.card,
          borderWidth: 1,
          borderColor: color.lineSoft,
          padding: hero ? space.gutter : space.l,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Section({ eyebrow, children, style }: { eyebrow?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: space.gutter, gap: space.m }, style]}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {children}
    </View>
  );
}

export function ProgressSegments({ states, total }: { states: ("right" | "wrong" | "current" | "todo")[]; total: number; accent?: string }) {
  const fill = { right: color.right, wrong: color.wrong, current: color.lime, todo: color.line };
  return (
    <View style={{ flexDirection: "row", gap: space.xs, paddingHorizontal: space.gutter }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: fill[states[i] ?? "todo"] }} />
      ))}
    </View>
  );
}

export function Tag({ label, tone = "outline", c = color.cream }: { label: string; tone?: "outline" | "solid"; c?: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: space.s,
        paddingVertical: space.xs,
        borderRadius: radius.chip,
        borderWidth: tone === "outline" ? 1.5 : 0,
        borderColor: c,
        backgroundColor: tone === "solid" ? c : "transparent",
      }}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: size.eyebrow, letterSpacing: 1.5, color: tone === "solid" ? color.ink : c }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  row: { flexDirection: "row", alignItems: "center" },
});
