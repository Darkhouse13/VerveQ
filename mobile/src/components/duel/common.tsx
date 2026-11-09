import type { FunctionReturnType } from "convex/server";
import { router } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Check } from "phosphor-react-native/src/icons/Check";
import { X } from "phosphor-react-native/src/icons/X";
import type { ReactNode } from "react";
import { Pressable, Share, Text, View } from "react-native";

import { Button, Card, Mono, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import type { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

export type DuelView = FunctionReturnType<typeof api.duels.getMyDuel>;
export type DuelList = FunctionReturnType<typeof api.duels.listMine>;
export type DuelSummary = DuelList["yourTurn"][number];

export const SHARE_BASE = "https://verveq.com/s/d/";

export const AVATAR_COLORS = [color.blue, color.pink, color.orange, color.yellow] as const;
export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, sz = 40, bg }: { name: string; sz?: number; bg?: string }) {
  const initials = name
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";
  return (
    <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: bg ?? avatarColor(name), alignItems: "center", justifyContent: "center" }}>
      <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.bold, fontSize: sz * 0.38, color: color.ink }}>{initials}</Text>
    </View>
  );
}

/** Duels need a username (web: UsernameRequiredRoute). */
export function useNeedsName() {
  const { ready, user } = useSession();
  return { ready, needsName: ready && !user?.username, user };
}

export function NeedsNameCard({ next }: { next: string }) {
  return (
    <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.l }}>
      <Txt v="h1Game">Pick a name first</Txt>
      <Txt c={color.muted}>Your friends see it on challenges, duels and live rooms. No email, no password.</Txt>
      <Button label="Pick a name" onPress={() => router.push({ pathname: "/pick-name" as never, params: { next } })} />
    </View>
  );
}

export function duelLabel(d: { mode: string; type: string; category: string | null; sport: string | null; difficulty: string }) {
  const level = d.difficulty === "intermediate" ? "Medium" : d.difficulty === "easy" ? "Easy" : "Hard";
  if (d.mode === "came_first" || d.category === "which_came_first") return `Which came first · ${level}`;
  if (d.type === "knowledge") {
    const cat = d.category ? d.category.replace(/_/g, " ") : "mixed";
    return `Knowledge · ${cat.charAt(0).toUpperCase()}${cat.slice(1)} · ${level}`;
  }
  return `Football · ${level}`;
}

export function hoursLeft(expiresAt: number) {
  const h = Math.max(0, Math.round((expiresAt - Date.now()) / 3_600_000));
  return h >= 1 ? `${h}h` : "<1h";
}

export async function shareDuelLink(linkCode: string, score?: number) {
  const url = `${SHARE_BASE}${encodeURIComponent(linkCode)}`;
  const text = score != null ? `Beat my ${score} on VerveQ — ${url}` : `Duel me on VerveQ — ${url}`;
  try {
    await Share.share({ message: text, url });
  } catch {
    // dismissed share sheets are not errors
  }
}

export function ListRow({
  left,
  title,
  line,
  right,
  onPress,
  last,
}: {
  left: ReactNode;
  title: string;
  line?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button"
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        minHeight: size.listRow,
        flexDirection: "row",
        alignItems: "center",
        gap: space.l,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {left}
      <View style={{ flex: 1, gap: space.xs }}>
        <Txt v="rowTitle" numberOfLines={1}>
          {title}
        </Txt>
        {line ? (
          <Txt v="caption" c={color.muted} numberOfLines={1}>
            {line}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <CaretRight size={20} weight="bold" color={color.dim} /> : null)}
    </Pressable>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
      {children}
    </View>
  );
}

export function EmptyLine({ icon: Ico, text }: { icon: Icon; text: string }) {
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
      <Ico size={20} weight="bold" color={color.dim} />
      <Txt v="caption" c={color.muted} style={{ flex: 1 }}>
        {text}
      </Txt>
    </Card>
  );
}

/** A row of 10 answer squares (mine) — right/wrong/unanswered. */
export function AnswerStrip({ perQuestion, total }: { perQuestion: { correct: boolean }[]; total: number }) {
  return (
    <View style={{ flexDirection: "row", gap: space.xs }}>
      {Array.from({ length: total }, (_, i) => {
        const a = perQuestion[i];
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 24,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: a ? (a.correct ? color.right : color.wrong) : color.line,
            }}
          >
            {a ? a.correct ? <Check size={12} weight="bold" color={color.ink} /> : <X size={12} weight="bold" color={color.ink} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function ScoreBlock({ name, score, sub, winner }: { name: string; score: number | string; sub?: string; winner?: boolean }) {
  return (
    <Card
      style={{
        flex: 1,
        alignItems: "center",
        gap: space.s,
        paddingVertical: space.gutter,
        borderColor: winner ? color.right : color.lineSoft,
        borderWidth: winner ? 2 : 1,
        backgroundColor: winner ? color.rightBg : color.surface,
      }}
    >
      <Avatar name={name} sz={48} />
      <Txt v="rowTitle" numberOfLines={1}>
        {name}
      </Txt>
      <Mono s={32}>{score}</Mono>
      {sub ? (
        <Txt v="micro" c={color.muted}>
          {sub}
        </Txt>
      ) : null}
    </Card>
  );
}
