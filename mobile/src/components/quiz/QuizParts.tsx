import { Image } from "expo-image";
import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { Check } from "phosphor-react-native/src/icons/Check";
import { Info } from "phosphor-react-native/src/icons/Info";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { LockSimple } from "phosphor-react-native/src/icons/LockSimple";
import { Timer } from "phosphor-react-native/src/icons/Timer";
import { X } from "phosphor-react-native/src/icons/X";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Mono, Tag, Txt } from "@/components/ui";
import { color, font, radius, space } from "@/theme/tokens";
import { useGuardedLeave } from "@/lib/guardLeave";

export const LETTERS = ["A", "B", "C", "D"];

/** Locale sent with question fetches so the server can serve translated questions (en/fr/es). */
export function questionLocale() {
  const code = getLocales()[0]?.languageCode ?? "en";
  return code === "fr" || code === "es" ? code : "en";
}

export function fmtClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Leaving the app mid-question = the web's tab switch. `onLeave` fires once per
 * trip to the background, only while `active` is true.
 */
export function useAppLeave(active: boolean, onLeave: () => void) {
  useGuardedLeave(active, onLeave);
  const ref = useRef(onLeave);
  useEffect(() => {
    ref.current = onLeave;
  });
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") ref.current();
    });
    return () => sub.remove();
  }, [active]);
}

export type AnswerState = "idle" | "pending" | "right" | "wrong" | "dim";

export function answerStateFor(idx: number, q: { revealed: boolean; selected: number | null; correctIdx: number }): AnswerState {
  if (!q.revealed) return q.selected === idx ? "pending" : "idle";
  if (idx === q.correctIdx) return "right";
  if (idx === q.selected) return "wrong";
  return "dim";
}

/** 64px answer row with letter tile (spec: radius 20, tile 32 radius 8, gap 12). */
export function AnswerButton({
  letter,
  label,
  state,
  onPress,
  disabled,
  compact,
}: {
  letter?: string;
  label: string;
  state: AnswerState;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const right = state === "right";
  const wrong = state === "wrong";
  const dim = state === "dim";
  const pending = state === "pending";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: pending || wrong }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 56 : 64,
        flex: compact ? 1 : undefined,
        borderRadius: radius.card,
        borderWidth: right || wrong ? 2 : 1.5,
        borderColor: right ? color.right : wrong ? color.wrong : pending ? color.lime : dim ? color.lineSoft : color.line,
        backgroundColor: right ? color.rightBg : wrong ? color.wrongBg : dim ? color.surfaceLow : color.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      {letter ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.chip,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: right ? color.right : wrong ? color.wrong : dim ? color.surfaceHigh : color.line,
          }}
        >
          {right ? (
            <Check size={20} weight="bold" color={color.ink} />
          ) : wrong ? (
            <X size={20} weight="bold" color={color.ink} />
          ) : (
            <Mono s={13} c={dim ? color.dim : color.muted}>
              {letter}
            </Mono>
          )}
        </View>
      ) : null}
      <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 17, lineHeight: 22, color: dim ? color.dim : color.cream }}>{label}</Text>
      {wrong ? (
        <Mono s={11} c={color.wrong}>
          YOU
        </Mono>
      ) : null}
    </Pressable>
  );
}

/**
 * The question clock as its own leaf: it ticks every 500ms without
 * re-rendering the question, answers or image above it.
 */
export function LiveClock({ startedAt, stoppedAt }: { startedAt: number | null; stoppedAt?: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || stoppedAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt, stoppedAt]);
  const end = stoppedAt ?? now;
  const secs = startedAt ? Math.max(0, (end - startedAt) / 1000) : 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
      <Timer size={16} weight="bold" color={color.muted} />
      <Mono s={13} c={color.muted}>
        {fmtClock(secs)}
      </Mono>
    </View>
  );
}

/** Points on the left, clock on the right (QuizQuestion mockup). */
export function ScoreClockRow({
  points,
  seconds,
  clock,
  right,
}: {
  points: number;
  seconds?: number;
  clock?: { startedAt: number | null; stoppedAt?: number | null };
  right?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.gutter }}>
      <Mono s={13} c={color.muted}>
        <Mono s={13}>{points.toLocaleString("en-US")}</Mono> pts
      </Mono>
      {right ??
        (clock ? (
          <LiveClock startedAt={clock.startedAt} stoppedAt={clock.stoppedAt} />
        ) : seconds !== undefined ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <Timer size={16} weight="bold" color={color.muted} />
            <Mono s={13} c={color.muted}>
              {fmtClock(seconds)}
            </Mono>
          </View>
        ) : null)}
    </View>
  );
}

/** Logo / player photo questions ("Which team does this badge belong to?"). */
export function QuestionImage({ uri }: { uri?: string | null }) {
  if (!uri) return null;
  return (
    <View style={{ height: 176, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden", padding: space.l }}>
      <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" transition={120} cachePolicy="memory-disk" recyclingKey={uri} accessibilityLabel="Question image" />
    </View>
  );
}

export function QuestionBlock({ tag, tagColor = color.yellow, verdict, verdictLabel, text, image }: { tag?: string; tagColor?: string; verdict?: boolean | null; verdictLabel?: string; text: string; image?: string | null }) {
  return (
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.m }}>
      {verdict === true ? (
        <Tag label="Right" tone="solid" c={color.right} />
      ) : verdict === false ? (
        <Tag label={verdictLabel ?? "Wrong"} tone="solid" c={color.wrong} />
      ) : tag ? (
        <Tag label={tag} c={tagColor} />
      ) : null}
      <QuestionImage uri={image} />
      <Txt v="h1Game">{text}</Txt>
    </View>
  );
}

export function Explanation({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space.m, paddingHorizontal: space.xl, paddingTop: space.l }}>
      <Lightbulb size={20} weight="fill" color={color.yellow} />
      <Txt v="body" c={color.muted} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

export function FooterNote({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.s }}>
      <Info size={16} weight="bold" color={color.dim} />
      <Txt v="caption" c={color.dim}>
        {text}
      </Txt>
    </View>
  );
}

/** Bottom action area: 16 top, 32 bottom + safe area. */
export function BottomActions({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>{children}</View>;
}

/** Ranked Quiz / Which Came First need a full account (FullAccountRoute on the web). */
export function FullAccountGate({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={title} eyebrow={eyebrow} onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: space.gutter, justifyContent: "center", gap: space.l }}>
        <View style={{ width: 64, height: 64, borderRadius: radius.hero, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" }}>
          <LockSimple size={32} weight="regular" color={color.cream} />
        </View>
        <View style={{ gap: space.s }}>
          <Txt v="h1Game">Create an account to play ranked</Txt>
          <Txt c={color.muted}>Ranked games move your rating and put you on the leaderboard. Your streak and games stay with you.</Txt>
        </View>
      </View>
      <BottomActions>
        <Button label="Create account" onPress={() => router.push("/create-account")} />
        <Button variant="secondary" label="Play the free daily instead" onPress={() => router.replace("/daily-quiz")} />
      </BottomActions>
    </View>
  );
}

export function LoadingNote({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.gutter }}>
      <Txt c={color.muted} center>
        {text}
      </Txt>
    </View>
  );
}
