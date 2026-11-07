import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { Check } from "phosphor-react-native/src/icons/Check";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Fire } from "phosphor-react-native/src/icons/Fire";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import type { ReactNode } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Eyebrow, Mono, PillButton, Tag, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";

export type NextToday = { title: string; edition?: number; line: string; accent: string; icon: Icon; href: Href };

export type DailyQuizResultProps = {
  /** App bar title, e.g. "Daily Quiz". */
  title: string;
  /** App bar eyebrow, e.g. "4 NOV · FOOTBALL". */
  eyebrow?: string;
  /** Tag colour (mode accent). */
  accent: string;
  correct: number;
  total: number;
  /** One entry per answered round, in order. */
  squares: boolean[];
  /** Extra mono stats under the squares, e.g. ["680 pts", "2:41 total"]. */
  stats?: string[];
  /** Standing — shown only when it flatters (docs/BRAND.md honest numbers). */
  standing?: { pct: number; players: number } | null;
  /** Text handed to the system share sheet. */
  shareText: string;
  /** Optional head-to-head challenge (Who's Older / Missing Letters only). */
  onChallenge?: () => void;
  /** Optional reminder row (shown only when a reminder target exists). */
  reminderHref?: Href;
  next?: NextToday | null;
  /** Anything mode-specific placed after the streak card. */
  extra?: ReactNode;
};

const DAY = ["S", "M", "T", "W", "T", "F", "S"];

function untilUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(0, Math.floor((next - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** The end of every daily game (mockup ResultDaily). */
export function DailyQuizResultView(p: DailyQuizResultProps) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const profile = useQuery(api.profile.get, user?._id ? { userId: user._id } : "skip");
  const stats = (profile as { stats?: { currentStreak?: number; bestStreak?: number } } | null | undefined)?.stats;
  const streak = stats?.currentStreak ?? 0;
  const best = Math.max(stats?.bestStreak ?? 0, streak);
  const todayDow = new Date().getUTCDay();
  const week = Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i; // 6 days ago … today
    return { letter: DAY[(todayDow - back + 7) % 7], played: back < streak, today: back === 0 };
  });
  const showStanding = p.standing && p.standing.players > 1 && p.standing.pct >= 50;

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={p.title} eyebrow={p.eyebrow} onBack={() => router.back()} close />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        {/* Hero */}
        <View style={{ alignItems: "center", gap: space.l, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
          <Tag label="Done for today" c={p.accent} />
          <Text style={{ fontFamily: font.mono, fontSize: 88, lineHeight: 96, color: color.cream, letterSpacing: -3 }}>
            {p.correct}
            <Text style={{ fontSize: 48, color: color.dim }}>{`/${p.total}`}</Text>
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs, width: 300 }} accessibilityLabel={`Your answers: ${p.correct} right of ${p.total}`}>
            {Array.from({ length: p.total }, (_, i) => (
              <View
                key={i}
                style={{ flex: 1, height: 24, borderRadius: 6, backgroundColor: p.squares[i] === undefined ? color.line : p.squares[i] ? color.right : color.wrong }}
              />
            ))}
          </View>
          {p.stats?.length ? (
            <View style={{ flexDirection: "row", gap: space.l }}>
              {p.stats.map((s) => (
                <Mono key={s} s={13} c={color.muted}>
                  {s}
                </Mono>
              ))}
            </View>
          ) : null}
          {showStanding ? <Txt v="rowTitle" center>{`Better than ${p.standing!.pct}% of today's ${p.standing!.players} players`}</Txt> : null}
        </View>

        {/* Share */}
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.m }}>
          <Button label="Share result" icon={Export} onPress={() => void Share.share({ message: p.shareText })} />
          {p.onChallenge ? (
            <>
              <Button variant="secondary" label="Challenge a friend" icon={Sword} onPress={p.onChallenge} />
              <Txt v="caption" c={color.dim} center>
                They play the same rounds and see your score to beat
              </Txt>
            </>
          ) : null}
        </View>

        {/* Streak */}
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl }}>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.hero, borderWidth: 1, borderColor: color.lineSoft, padding: space.gutter, gap: space.l }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
              <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: color.yellow, alignItems: "center", justifyContent: "center" }}>
                <Fire size={24} weight="fill" color={color.ink} />
              </View>
              <View style={{ gap: space.xs }}>
                <Txt v="cardTitle">{streak > 0 ? `${streak}-day streak` : "Start a streak"}</Txt>
                <Txt v="caption" c={color.muted}>
                  {best > 0 ? `Best streak: ${best} day${best === 1 ? "" : "s"}` : "Play every day to build one"}
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }} accessibilityLabel={`This week: ${Math.min(streak, 7)} days in a row`}>
              {week.map((d, i) => (
                <View key={i} style={{ alignItems: "center", gap: space.s }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: d.played ? color.yellow : color.surfaceHigh,
                      borderWidth: d.today ? 2 : 0,
                      borderColor: color.cream,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {d.played && d.today ? <Check size={16} weight="bold" color={color.ink} /> : null}
                  </View>
                  <Mono s={11} c={d.today ? color.cream : color.dim}>
                    {d.letter}
                  </Mono>
                </View>
              ))}
            </View>
            <Txt v="caption" c={color.muted}>
              {`Next game in ${untilUtcMidnight()}. Play it to make it ${streak + 1}.`}
            </Txt>
            {p.reminderHref ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: radius.card, backgroundColor: color.surfaceLow, borderWidth: 1, borderColor: color.line }}>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Txt v="rowTitle">{"Don't lose your streak"}</Txt>
                  <Txt v="caption" c={color.muted}>
                    {"Get a reminder when tomorrow's games are live"}
                  </Txt>
                </View>
                <PillButton label="Turn on" onPress={() => router.push(p.reminderHref!)} />
              </View>
            ) : null}
          </View>
        </View>

        {p.extra}

        {/* Next today */}
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.m }}>
          {p.next ? (
            <>
              <Eyebrow>Next today</Eyebrow>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.l, padding: space.l, backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft }}>
                <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: p.next.accent, alignItems: "center", justifyContent: "center" }}>
                  <p.next.icon size={24} weight="fill" color={color.ink} />
                </View>
                <View style={{ flex: 1, gap: space.xs }}>
                  <Txt v="rowTitle">
                    {p.next.title}
                    {p.next.edition ? <Text style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>{`  #${p.next.edition}`}</Text> : null}
                  </Txt>
                  <Txt v="caption" c={color.muted}>
                    {p.next.line}
                  </Txt>
                </View>
                <PillButton label="Play" onPress={() => router.replace(p.next!.href)} />
              </View>
            </>
          ) : null}
          <Button variant="ghost" label="Back to Play" onPress={() => router.dismissTo("/")} />
        </View>
      </ScrollView>
    </View>
  );
}
