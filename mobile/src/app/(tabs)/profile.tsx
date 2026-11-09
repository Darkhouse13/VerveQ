import { useQuery } from "convex/react";
import { router } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Crown } from "phosphor-react-native/src/icons/Crown";
import { ExportIcon } from "phosphor-react-native/src/icons/Export";
import { Fire } from "phosphor-react-native/src/icons/Fire";
import { GearSix } from "phosphor-react-native/src/icons/GearSix";
import { Globe } from "phosphor-react-native/src/icons/Globe";
import { Heart } from "phosphor-react-native/src/icons/Heart";
import { Lightning } from "phosphor-react-native/src/icons/Lightning";
import { Lock } from "phosphor-react-native/src/icons/Lock";
import { Medal } from "phosphor-react-native/src/icons/Medal";
import { Star } from "phosphor-react-native/src/icons/Star";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { User } from "phosphor-react-native/src/icons/User";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RankBadge, tierFromElo, tierInk, tierLabel, type Tier } from "@/components/ranks/RankBadge";
import { Button, Card, Eyebrow, IconButton, Mono, Section, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

const fmt = (n: number) => n.toLocaleString("en-US");

const ACH_ICON: Record<string, Icon> = {
  first_quiz: Star,
  first_survival: Heart,
  quiz_master: Crown,
  survival_legend: Trophy,
  multi_sport_athlete: Globe,
  dedicated_player: Fire,
  elo_champion: Medal,
  the_architect: Lightning,
};
const ACH_NAME: Record<string, string> = { multi_sport_athlete: "Multi-sport", elo_champion: "Rating Champion" };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1, backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, padding: space.l, gap: space.xs }}>
      <Mono s={24} style={{ lineHeight: 30 }}>
        {value}
      </Mono>
      <Txt v="caption" c={color.muted}>
        {label}
      </Txt>
    </View>
  );
}

function AccountPrompt({ hasName }: { hasName: boolean }) {
  return (
    <Card hero style={{ gap: space.l }}>
      <View style={{ gap: space.s }}>
        <Txt v="cardTitle">{hasName ? "Save your progress" : "Put your name on it"}</Txt>
        <Txt v="caption" c={color.muted}>
          {hasName
            ? "Create a free account to keep your streak on any phone and get ranked."
            : "Pick a username for challenges, duels and live rooms. No email needed."}
        </Txt>
      </View>
      <Button
        label={hasName ? "Create an account" : "Pick a name"}
        icon={ArrowRight}
        iconRight
        onPress={() => router.push(hasName ? "/create-account" : "/pick-name")}
      />
    </Card>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const username = typeof user?.username === "string" && /^[a-z0-9_]{3,24}$/.test(user.username) ? user.username : null;
  const isFull = !!user && user.isAnonymous !== true && !!username;

  const profile = useQuery(api.profile.get, user?._id ? { userId: user._id } : "skip");
  const allAch = useQuery(api.achievements.list, {});
  const mine = useQuery(api.achievements.userAchievements, user?._id ? { userId: user._id } : "skip");
  const seasons = useQuery(api.seasonManager.getUserSeasonHistory, isFull && user?._id ? { userId: user._id } : "skip");
  const currentSeason = useQuery(api.seasonManager.getCurrentSeason, {});
  const rank = useQuery(api.leaderboards.getGlobalRank, isFull && user?._id ? { userId: user._id, sport: "football", mode: "quiz" } : "skip");

  const ranked = isFull && profile?.rankedEligible && (profile.stats.totalGames ?? 0) > 0;
  const elo = ranked && profile ? Math.round(profile.eloRating) : null;
  const tier: Tier | null = elo != null ? tierFromElo(elo) : null;
  const unlocked = new Set((mine ?? []).map((a) => a.achievementId));
  const streak = profile?.stats.currentStreak ?? 0;
  const best = profile?.stats.bestStreak ?? 0;
  const since = profile ? new Date(profile.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : null;
  const name = username ?? "Guest";
  const nextTierAt = tier === "bronze" ? 1200 : tier === "silver" ? 1500 : tier === "gold" ? 2000 : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.ink }} contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: space.xxl }}>
      {/* Header */}
      <View style={{ paddingHorizontal: space.gutter, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Txt v="h1Tab">Profile</Txt>
        <View style={{ flexDirection: "row", gap: space.s }}>
          {username ? (
            <IconButton
              icon={ExportIcon}
              label="Share profile"
              onPress={() => void Share.share({ message: `I'm @${username} on VerveQ. Play today's football games: https://verveq.com` })}
            />
          ) : null}
          <IconButton icon={GearSix} label="Settings" onPress={() => router.push("/settings")} />
        </View>
      </View>

      {/* Identity */}
      <View style={{ paddingHorizontal: space.gutter, marginTop: space.xl, flexDirection: "row", alignItems: "center", gap: space.l }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: username ? color.lime : color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
          {username ? (
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 28, color: color.ink }}>{username.slice(0, 1).toUpperCase()}</Text>
          ) : (
            <User size={32} weight="regular" color={color.muted} />
          )}
        </View>
        <View style={{ flex: 1, gap: space.s }}>
          <Txt v="h1Game" numberOfLines={1}>
            {username ? `@${name}` : name}
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.s }}>
            {tier ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                <RankBadge tier={tier} size={20} />
                <Mono s={11} c={tierInk[tier]}>
                  {tierLabel(tier).toUpperCase()}
                </Mono>
              </View>
            ) : null}
            {since ? (
              <Txt v="caption" c={color.muted}>{`Member since ${since}`}</Txt>
            ) : null}
          </View>
        </View>
      </View>

      {!isFull ? (
        <Section style={{ marginTop: space.xl }}>
          <AccountPrompt hasName={!!username} />
        </Section>
      ) : null}

      {/* Streak + stats */}
      <Section style={{ marginTop: space.xl }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: color.yellow, alignItems: "center", justifyContent: "center" }}>
            <Fire size={24} weight="fill" color={color.ink} />
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt v="cardTitle">{streak > 0 ? `${streak}-day streak` : "No streak yet"}</Txt>
            <Txt v="caption" c={color.muted}>
              {best > 0 ? `Best streak: ${best} day${best === 1 ? "" : "s"}` : "Play today to start one"}
            </Txt>
          </View>
        </Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
          <Stat value={fmt(profile?.totalPlays ?? 0)} label="Games played" />
          <Stat value={fmt(best)} label="Best streak" />
          <Stat value={fmt(profile?.stats.totalGames ?? 0)} label="Ranked games" />
          <Stat value={profile && profile.stats.totalGames > 0 ? `${Math.round(profile.stats.winRate)}%` : "—"} label="Ranked win rate" />
        </View>
      </Section>

      {/* Ranked */}
      {isFull ? (
        <Section eyebrow={currentSeason ? `Ranked · Season ${currentSeason.seasonNumber}` : "Ranked"} style={{ marginTop: space.xxl }}>
          <Pressable accessibilityRole="button"
            onPress={() => router.navigate("/ranks")}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.l,
              backgroundColor: color.surface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: color.lineSoft,
              padding: space.l,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {tier ? <RankBadge tier={tier} size={48} /> : <Lock size={24} weight="regular" color={color.muted} />}
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle">{tier && elo != null ? `${tierLabel(tier)} · ${fmt(elo)}` : "Not ranked yet"}</Txt>
              <Txt v="caption" c={color.muted}>
                {tier && elo != null
                  ? [rank ? `#${rank.rank} global` : null, nextTierAt ? `${fmt(nextTierAt - elo)} to ${tierLabel(tierFromElo(nextTierAt))}` : null].filter(Boolean).join(" · ")
                  : "Play a ranked Quiz or Survival to get a rating"}
              </Txt>
            </View>
            <CaretRight size={20} weight="bold" color={color.muted} />
          </Pressable>
        </Section>
      ) : null}

      {/* Achievements */}
      <Section style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>Achievements</Eyebrow>
          <Mono s={12} c={color.muted}>{`${unlocked.size} / ${allAch?.length ?? 0}`}</Mono>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
          {(allAch ?? []).map((a) => {
            const on = unlocked.has(a.achievementId);
            const Ico = ACH_ICON[a.achievementId] ?? Star;
            return (
              <View
                key={a.achievementId}
                accessibilityLabel={`${a.name}: ${on ? "unlocked" : a.description}`}
                style={{ width: "22%", flexGrow: 1, alignItems: "center", gap: space.s }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: on ? color.lime : color.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: color.line,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {on ? <Ico size={24} weight="fill" color={color.ink} /> : <Lock size={20} weight="bold" color={color.dim} />}
                </View>
                <Txt v="micro" c={on ? color.cream : color.dim} center numberOfLines={2}>
                  {ACH_NAME[a.achievementId] ?? a.name}
                </Txt>
              </View>
            );
          })}
        </View>
      </Section>

      {/* Recent ranked */}
      {profile && profile.recentGames.length > 0 ? (
        <Section eyebrow="Recent ranked" style={{ marginTop: space.xxl }}>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
            {profile.recentGames.slice(0, 5).map((g, i, arr) => (
              <View
                key={g.id}
                style={{
                  minHeight: size.listRow,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.m,
                  paddingHorizontal: space.l,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: color.lineSoft,
                }}
              >
                <Txt v="rowTitle" style={{ flex: 1 }}>
                  {g.gameMode === "survival" ? "Survival" : "Quiz"}
                </Txt>
                <Mono s={15} c={color.muted}>
                  {g.gameMode === "survival" ? `${g.score} pts` : fmt(g.score)}
                </Mono>
                {typeof g.eloChange === "number" ? (
                  <Mono s={15} c={g.eloChange >= 0 ? color.right : color.wrong} style={{ minWidth: 48, textAlign: "right" }}>
                    {g.eloChange >= 0 ? `+${Math.round(g.eloChange)}` : `−${Math.abs(Math.round(g.eloChange))}`}
                  </Mono>
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {/* Season history */}
      {seasons && seasons.length > 0 ? (
        <Section eyebrow="Season history" style={{ marginTop: space.xxl }}>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
            {seasons.slice(0, 6).map((sh, i, arr) => {
              const t = tierFromElo(sh.finalElo);
              return (
                <View
                  key={sh._id}
                  style={{
                    minHeight: size.listRow,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.m,
                    paddingHorizontal: space.l,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: color.lineSoft,
                  }}
                >
                  <Mono s={13} c={color.muted} style={{ width: 32 }}>{`S${sh.seasonNumber}`}</Mono>
                  <RankBadge tier={t} size={28} />
                  <Txt v="rowTitle" style={{ flex: 1 }}>
                    {tierLabel(t)}
                  </Txt>
                  <Mono s={13} c={color.muted}>{`${fmt(Math.round(sh.finalElo))} · #${sh.rank}`}</Mono>
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}
