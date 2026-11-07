import { router, type Href } from "expo-router";
import { useQuery } from "convex/react";
import type { Icon } from "phosphor-react-native";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { ArrowsDownUp } from "phosphor-react-native/src/icons/ArrowsDownUp";
import { Brain } from "phosphor-react-native/src/icons/Brain";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Fire } from "phosphor-react-native/src/icons/Fire";
import { GridFour } from "phosphor-react-native/src/icons/GridFour";
import { Hash } from "phosphor-react-native/src/icons/Hash";
import { Heart } from "phosphor-react-native/src/icons/Heart";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { Lightning } from "phosphor-react-native/src/icons/Lightning";
import { Shuffle } from "phosphor-react-native/src/icons/Shuffle";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { TextAa } from "phosphor-react-native/src/icons/TextAa";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLockup } from "@/components/BrandLockup";
import { Button, Card, Eyebrow, Mono, PillButton, Section, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { useSession } from "@/lib/auth";
import { color, font, modeAccent, radius, size, space } from "@/theme/tokens";

type RowState = { kind: "play" } | { kind: "resume"; line?: string } | { kind: "done"; score: string };

function TodayRow({
  title,
  edition,
  line,
  accent,
  icon: Ico,
  state,
  href,
  last,
}: {
  title: string;
  edition?: number;
  line: string;
  accent: string;
  icon: Icon;
  state: RowState;
  href: Href;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(href);
      }}
      style={({ pressed }) => ({
        minHeight: 72,
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
      <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}>
        <Ico size={24} weight="fill" color={color.ink} />
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={{ fontFamily: font.bold, fontSize: size.rowTitle, color: color.cream }}>
          {title}
          {edition ? <Text style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>{`  #${edition}`}</Text> : null}
        </Text>
        <Txt v="caption" c={color.muted}>
          {state.kind === "resume" && state.line ? state.line : line}
        </Txt>
      </View>
      {state.kind === "done" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          <CheckCircle size={20} weight="fill" color={color.right} />
          <Mono s={15} c={color.right}>
            {state.score}
          </Mono>
        </View>
      ) : (
        <PillButton label={state.kind === "resume" ? "Resume" : "Play"} outline={state.kind === "resume"} onPress={() => router.push(href)} />
      )}
    </Pressable>
  );
}

function dailyGameState(today: { daily: { status: string; score: number; totalRounds: number | null } | null } | undefined | null): RowState {
  const d = today?.daily;
  if (d?.status === "completed") return { kind: "done", score: d.totalRounds ? `${d.score}/${d.totalRounds}` : "✓" };
  if (d?.status === "active") return { kind: "resume" };
  return { kind: "play" };
}

function MoreTile({ title, line, icon: Ico, ranked, href, wide }: { title: string; line: string; icon: Icon; ranked?: boolean; href: Href; wide?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(href);
      }}
      style={({ pressed }) => ({
        width: wide ? "100%" : undefined,
        flexBasis: wide ? "100%" : "47%",
        flexGrow: 1,
        backgroundColor: color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: color.lineSoft,
        padding: space.l,
        gap: space.m,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Ico size={24} weight="regular" color={color.cream} />
        {ranked ? (
          <View style={{ borderWidth: 1, borderColor: color.lime, borderRadius: radius.chip, paddingHorizontal: space.xs }}>
            <Mono s={10} c={color.lime}>
              RANKED
            </Mono>
          </View>
        ) : null}
      </View>
      <View style={{ gap: space.xs }}>
        <Txt v="rowTitle">{title}</Txt>
        <Txt v="caption" c={color.muted}>
          {line}
        </Txt>
      </View>
    </Pressable>
  );
}

function FriendsCard({ top, title, line, href }: { top: ReactNode; title: string; line: string; href: Href }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(href);
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 136,
        backgroundColor: color.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: color.lineSoft,
        padding: space.l,
        justifyContent: "space-between",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {top}
      <View style={{ gap: space.xs }}>
        <Txt v="cardTitle">{title}</Txt>
        <Txt v="caption" c={color.muted}>
          {line}
        </Txt>
      </View>
    </Pressable>
  );
}

function msUntilUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const mins = Math.max(0, Math.floor((next - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const { ready, user } = useSession();
  const profile = useQuery(api.profile.get, user?._id ? { userId: user._id } : "skip");
  const older = useQuery(api.whosOlder.getToday, ready ? {} : "skip");
  const letters = useQuery(api.missingLetters.getToday, ready ? {} : "skip");
  const dailyQuiz = useQuery(api.dailyChallenge.getAttemptStatus, ready ? { sport: "football", mode: "quiz" } : "skip");
  const dailySurvival = useQuery(api.dailyChallenge.getAttemptStatus, ready ? { sport: "football", mode: "survival" } : "skip");

  const quizState: RowState = dailyQuiz?.completed || dailyQuiz?.forfeited ? { kind: "done", score: "✓" } : dailyQuiz ? { kind: "resume" } : { kind: "play" };
  const survivalState: RowState = dailySurvival?.completed || dailySurvival?.forfeited ? { kind: "done", score: "✓" } : dailySurvival ? { kind: "resume" } : { kind: "play" };
  const states = [dailyGameState(older), dailyGameState(letters), quizState, survivalState];
  const played = states.filter((x) => x.kind === "done").length;
  const streak = (profile as { stats?: { currentStreak?: number } } | null | undefined)?.stats?.currentStreak ?? 0;
  const initial = (user?.username ?? user?.displayName ?? "?").slice(0, 1).toUpperCase();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.ink }} contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: space.xxl }}>
      {/* Header */}
      <View style={{ paddingHorizontal: space.gutter, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BrandLockup height={32} />
        <View style={{ flexDirection: "row", gap: space.s }}>
          <View
            accessibilityLabel={`Streak: ${streak} days`}
            style={{ height: 48, paddingHorizontal: space.l, borderRadius: 24, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, flexDirection: "row", alignItems: "center", gap: space.s }}
          >
            <Fire size={20} weight="fill" color={color.yellow} />
            <Mono s={15}>{streak}</Mono>
          </View>
          <Pressable
            accessibilityLabel="Profile"
            onPress={() => router.navigate("/profile")}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.lime, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 17, color: color.ink }}>{initial}</Text>
          </Pressable>
        </View>
      </View>

      {/* Today */}
      <Section style={{ marginTop: space.xl }}>
        <View style={{ gap: space.s }}>
          <Eyebrow>Today · same for everyone</Eyebrow>
          <Txt v="h1Tab">{"Today's games"}</Txt>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              {states.map((x, i) => (
                <View key={i} style={{ width: 24, height: 6, borderRadius: 3, backgroundColor: x.kind === "done" ? color.lime : color.line }} />
              ))}
            </View>
            <Txt v="caption" c={color.muted}>{`${played} of 4 played`}</Txt>
          </View>
          <Mono s={12} c={color.muted}>{`New in ${msUntilUtcMidnight()}`}</Mono>
        </View>
        <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
          <TodayRow title="Who's Older?" edition={older?.edition} line="Tap the older player" accent={modeAccent.whosOlder} icon={UsersThree} state={states[0]} href="/whos-older" />
          <TodayRow title="Missing Letters" edition={letters?.edition} line="Name the player" accent={modeAccent.missingLetters} icon={TextAa} state={states[1]} href="/missing-letters" />
          <TodayRow title="Daily Quiz" line="10 questions, one try" accent={modeAccent.dailyQuiz} icon={Brain} state={states[2]} href="/daily-quiz" />
          <TodayRow title="Daily Survival" line="Same 10 rounds for everyone" accent={modeAccent.dailySurvival} icon={Heart} state={states[3]} href="/daily-survival" last />
        </View>
      </Section>

      {/* Featured */}
      <Section eyebrow="Featured" style={{ marginTop: space.xxl }}>
        <Card hero style={{ gap: space.l }}>
          <View style={{ gap: space.s }}>
            <Txt v="h1Game">Career Path</Txt>
            <Txt c={color.muted}>Name the player from his clubs</Txt>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s }}>
            {["Lyon", "Real Madrid", "Al-Ittihad"].map((club) => (
              <View key={club} style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                <View style={{ paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.chip, backgroundColor: color.surfaceHigh }}>
                  <Txt v="body" style={{ fontFamily: font.bold }}>
                    {club}
                  </Txt>
                </View>
                <CaretRight size={16} weight="bold" color={color.dim} />
              </View>
            ))}
            <View style={{ paddingHorizontal: space.m, paddingVertical: space.s, borderRadius: radius.chip, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.lime }}>
              <Mono c={color.lime}>?</Mono>
            </View>
          </View>
          <Button label="Play Career Path" onPress={() => router.push("/career-path")} />
        </Card>
      </Section>

      {/* With friends */}
      <Section eyebrow="With friends" style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", gap: space.m }}>
          <FriendsCard
            href="/arena"
            title="Live room"
            line="2–5 players, same questions, live"
            top={
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.lime }} />
                <Mono s={11} c={color.lime}>
                  LIVE
                </Mono>
              </View>
            }
          />
          <FriendsCard href="/duels/new" title="Duel" line="Send a link, they play when they can" top={<Sword size={24} weight="regular" color={color.muted} />} />
        </View>
        <View style={{ flexDirection: "row", gap: space.m }}>
          <Button variant="secondary" label="Join with a code" icon={Hash} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => router.push("/arena")} />
          <Button variant="secondary" label="Your duels" icon={ArrowRight} iconRight style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => router.push("/friends")} />
        </View>
      </Section>

      {/* More games */}
      <Section eyebrow="More games" style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
          <MoreTile title="Quiz" line="10 questions, 3 levels" icon={Brain} ranked href="/quiz" />
          <MoreTile title="Survival" line="Name players from initials" icon={Heart} ranked href="/survival" />
          <MoreTile title="Blitz" line="60 seconds, go" icon={Lightning} href="/blitz" />
          <MoreTile title="Higher or Lower" line="Guess the bigger stat" icon={ArrowsDownUp} href="/higher-lower" />
          <MoreTile title="VerveGrid" line="Fill a 3×3 grid" icon={GridFour} href="/verve-grid" />
          <MoreTile title="Which Came First" line="Two events, pick the older" icon={Hourglass} href="/came-first" />
          <MoreTile title="Knowledge Quiz" line="History, geography, science and more" icon={Shuffle} href="/quiz?topic=knowledge" wide />
        </View>
      </Section>
    </ScrollView>
  );
}
