import { useQuery } from "convex/react";
import { router } from "expo-router";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { Info } from "phosphor-react-native/src/icons/Info";
import { Lock } from "phosphor-react-native/src/icons/Lock";
import { Play } from "phosphor-react-native/src/icons/Play";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RankBadge, TIERS, tierFromElo, tierInk, tierLabel } from "@/components/ranks/RankBadge";
import { Button, Card, Eyebrow, Mono, Section, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

// Same board the web shows (RanksScreen.tsx BOARD_SPORT / BOARD_MODE).
const BOARD = { sport: "football", mode: "quiz" } as const;
const fmt = (n: number) => n.toLocaleString("en-US");

function useAccount() {
  const { user } = useSession();
  const username = typeof user?.username === "string" && /^[a-z0-9_]{3,24}$/.test(user.username) ? user.username : null;
  const isFull = !!user && user.isAnonymous !== true && !!username && user.isGuest !== true;
  return { user, username, isFull };
}

function Segmented({ value, onChange }: { value: "ladder" | "board"; onChange: (v: "ladder" | "board") => void }) {
  const opt = (key: "ladder" | "board", label: string) => {
    const on = value === key;
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        onPress={() => {
          if (!on) {
            haptic.tap();
            onChange(key);
          }
        }}
        style={{ flex: 1, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? color.cream : "transparent" }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: on ? color.ink : color.muted }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: space.xs, padding: space.xs, borderRadius: 24, backgroundColor: color.surface, borderWidth: 1, borderColor: color.lineSoft }}>
      {opt("ladder", "Ladder")}
      {opt("board", "Leaderboard")}
    </View>
  );
}

function LockedHero() {
  return (
    <Card hero style={{ gap: space.l }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.tile, backgroundColor: color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
          <Lock size={24} weight="regular" color={color.cream} />
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt v="cardTitle">Get ranked</Txt>
          <Txt v="caption" c={color.muted}>
            Ranked Quiz and Survival need a free account, so your rating follows you to any phone.
          </Txt>
        </View>
      </View>
      <Button label="Create an account" icon={ArrowRight} iconRight onPress={() => router.push("/create-account")} />
    </Card>
  );
}

function Ladder({ isFull, elo, rank }: { isFull: boolean; elo: number | null; rank: { rank: number; total: number } | null | undefined }) {
  const tier = elo != null ? tierFromElo(elo) : null;
  const next = tier ? TIERS[TIERS.findIndex((x) => x.key === tier) + 1] : undefined;
  const current = tier ? TIERS.find((x) => x.key === tier)! : undefined;
  const progress = elo != null && current && next ? Math.min(1, Math.max(0, (elo - current.min) / (next.min - current.min))) : 1;

  return (
    <>
      <Section style={{ marginTop: space.xl }}>
        {!isFull ? (
          <LockedHero />
        ) : elo == null || !tier ? (
          <Card hero style={{ alignItems: "center", paddingVertical: space.xxl }}>
            <ActivityIndicator color={color.lime} />
          </Card>
        ) : (
          <Card hero style={{ gap: space.l }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
              <RankBadge tier={tier} size={88} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Eyebrow c={tierInk[tier]}>{tierLabel(tier)}</Eyebrow>
                <Mono s={40}>{fmt(elo)}</Mono>
                <Txt v="caption" c={color.muted}>
                  Rating
                </Txt>
              </View>
              {rank ? (
                <View style={{ alignItems: "flex-end", gap: space.xs }}>
                  <Mono s={20}>{`#${rank.rank}`}</Mono>
                  <Txt v="micro" c={color.muted} style={{ fontFamily: font.medium }}>{`of ${fmt(rank.total)}`}</Txt>
                </View>
              ) : null}
            </View>
            {next ? (
              <View style={{ gap: space.s }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                  <RankBadge tier={tier} size={24} />
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`Progress to ${next.label}`}
                    style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: color.line, overflow: "hidden" }}
                  >
                    <View style={{ width: `${Math.round(progress * 100)}%`, height: 8, borderRadius: 4, backgroundColor: tierInk[next.key] }} />
                  </View>
                  <RankBadge tier={next.key} size={24} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt v="caption" c={color.muted}>{`${fmt(next.min - elo)} to reach ${next.label}`}</Txt>
                  <Mono s={12} c={color.muted}>{`${fmt(elo)} / ${fmt(next.min)}`}</Mono>
                </View>
              </View>
            ) : (
              <Txt v="caption" c={tierInk.platinum}>
                Top tier. Keep playing ranked to hold it.
              </Txt>
            )}
          </Card>
        )}
      </Section>

      <Section eyebrow="Play ranked" style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", gap: space.m }}>
          {[
            { title: "Quiz", line: "10 questions, 3 levels", href: "/quiz" as const },
            { title: "Survival", line: "Name players from initials", href: "/survival" as const },
          ].map((m) => (
            <Pressable
              key={m.title}
              onPress={() => {
                haptic.tap();
                router.push(isFull ? m.href : "/create-account");
              }}
              style={({ pressed }) => ({
                flex: 1,
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
                <Txt v="rowTitle">{m.title}</Txt>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isFull ? color.lime : color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
                  {isFull ? <Play size={16} weight="fill" color={color.ink} /> : <Lock size={16} weight="bold" color={color.muted} />}
                </View>
              </View>
              <Txt v="caption" c={color.muted}>
                {m.line}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>Tiers</Eyebrow>
          <Txt v="micro" c={color.dim} style={{ fontFamily: font.medium }}>
            Win to climb
          </Txt>
        </View>
        <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
          {[...TIERS].reverse().map((t, i) => {
            const mine = t.key === tier;
            return (
              <View
                key={t.key}
                style={{
                  minHeight: size.listRow,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.l,
                  paddingHorizontal: space.l,
                  paddingVertical: space.m,
                  borderBottomWidth: i < TIERS.length - 1 ? 1 : 0,
                  borderBottomColor: color.lineSoft,
                  backgroundColor: mine ? color.surfaceHigh : "transparent",
                }}
              >
                <RankBadge tier={t.key} size={44} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Txt v="rowTitle" c={t.key === "gold" || t.key === "platinum" ? tierInk[t.key] : color.cream}>
                    {t.label}
                  </Txt>
                  {t.key === "platinum" ? (
                    <Txt v="caption" c={color.dim}>
                      Top of the game
                    </Txt>
                  ) : null}
                </View>
                {mine ? (
                  <View style={{ backgroundColor: color.cream, borderRadius: radius.chip, paddingHorizontal: space.s, paddingVertical: space.xs }}>
                    <Mono s={11} c={color.ink}>
                      YOU
                    </Mono>
                  </View>
                ) : null}
                <Mono s={12} c={color.muted}>
                  {t.max == null ? `${fmt(t.min)}+` : t.min === 0 ? `Under ${fmt(1200)}` : `${fmt(t.min)}–${fmt(t.max)}`}
                </Mono>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: space.m, paddingHorizontal: space.xs }}>
          <Info size={16} weight="bold" color={color.dim} style={{ marginTop: space.xs }} />
          <Txt v="caption" c={color.dim} style={{ flex: 1 }}>
            Seasons last 90 days. At the end, ratings above 1,200 move halfway back toward 1,200. Gold and above lose 25 after 14 days without a ranked game.
          </Txt>
        </View>
      </Section>
    </>
  );
}

function Board({ userId, rank }: { userId: string | undefined; rank: { rank: number; total: number } | null | undefined }) {
  const board = useQuery(api.leaderboards.getLeaderboard, { ...BOARD, limit: 50 });
  const blitz = useQuery(api.blitz.getHighScores, { sport: "football", limit: 3 });
  const entries = board?.entries ?? [];
  const mineInTop = entries.some((e) => e.userId === userId);
  const medal = (r: number) => (r === 1 ? tierInk.gold : r === 2 ? tierInk.silver : r === 3 ? tierInk.bronze : color.muted);

  const row = (e: { rank: number; username: string; elo?: number; score?: string }, me: boolean, last: boolean) => (
    <View
      key={`${e.rank}-${e.username}`}
      style={{
        minHeight: size.listRow,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
        backgroundColor: me ? color.surfaceHigh : "transparent",
      }}
    >
      <Mono s={15} c={medal(e.rank)} style={{ width: 32 }}>
        {e.rank}
      </Mono>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: me ? color.lime : color.line, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: me ? color.ink : color.cream }}>{e.username.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Txt v="rowTitle" numberOfLines={1} style={{ flex: 1 }}>
        {me ? "You" : e.username}
      </Txt>
      {e.elo != null ? <RankBadge tier={tierFromElo(e.elo)} size={28} /> : null}
      <Mono s={15}>{e.score ?? fmt(Math.round(e.elo ?? 0))}</Mono>
    </View>
  );

  return (
    <>
      <Section style={{ marginTop: space.xl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>{rank ? `Rating · ${fmt(rank.total)} ranked` : "Rating"}</Eyebrow>
          <Txt v="micro" c={color.dim} style={{ fontFamily: font.medium }}>
            Ranked Quiz
          </Txt>
        </View>
        <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
          {board === undefined ? (
            <View style={{ padding: space.xxl, alignItems: "center" }}>
              <ActivityIndicator color={color.lime} />
            </View>
          ) : entries.length === 0 ? (
            <View style={{ padding: space.gutter }}>
              <Txt c={color.muted}>No ranked players yet this season.</Txt>
            </View>
          ) : (
            <>
              {entries.slice(0, 10).map((e, i, arr) =>
                row({ rank: e.rank, username: e.username, elo: e.elo_rating }, e.userId === userId, i === arr.length - 1 && (mineInTop || !rank)),
              )}
              {!mineInTop && rank ? (
                <>
                  <View style={{ alignItems: "center", paddingVertical: space.s, borderBottomWidth: 1, borderBottomColor: color.lineSoft }}>
                    <Mono s={13} c={color.dim}>
                      · · ·
                    </Mono>
                  </View>
                  {row({ rank: rank.rank, username: "you" }, true, true)}
                </>
              ) : null}
            </>
          )}
        </View>
      </Section>

      <Section style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>Blitz · all time</Eyebrow>
          <Txt v="micro" c={color.dim} style={{ fontFamily: font.medium }}>
            Best 60-second run
          </Txt>
        </View>
        <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
          {(blitz?.entries ?? []).length === 0 ? (
            <View style={{ padding: space.gutter }}>
              <Txt c={color.muted}>{blitz === undefined ? "Loading…" : "No Blitz runs yet."}</Txt>
            </View>
          ) : (
            (blitz?.entries ?? []).map((e, i, arr) => row({ rank: e.rank, username: e.username, score: `${fmt(e.score)} pts` }, false, i === arr.length - 1))
          )}
        </View>
        <Pressable
          onPress={() => router.navigate("/weekend")}
          style={({ pressed }) => ({
            height: size.buttonPrimary,
            borderRadius: radius.input,
            borderWidth: 1,
            borderColor: color.lime,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.l,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
            <SoccerBall size={20} weight="bold" color={color.lime} />
            <Txt v="rowTitle">Weekend table</Txt>
          </View>
          <CaretRight size={20} weight="bold" color={color.cream} />
        </Pressable>
      </Section>
    </>
  );
}

export default function RanksScreen() {
  const insets = useSafeAreaInsets();
  const { user, isFull } = useAccount();
  const [view, setView] = useState<"ladder" | "board">("ladder");
  const season = useQuery(api.seasonManager.getCurrentSeason, {});
  const profile = useQuery(api.profile.get, isFull && user?._id ? { userId: user._id } : "skip");
  const rank = useQuery(api.leaderboards.getGlobalRank, isFull && user?._id ? { userId: user._id, ...BOARD } : "skip");
  const elo = isFull && profile ? Math.round(profile.eloRating) : null;
  const [now] = useState(() => Date.now());
  const daysLeft = season ? Math.max(0, Math.ceil((season.endDate - now) / 86400000)) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.ink }} contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.gutter, gap: space.xl }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ gap: space.s }}>
            <Eyebrow>{season ? `Ranked play · Season ${season.seasonNumber}` : "Ranked play"}</Eyebrow>
            <Txt v="h1Tab">Ranks</Txt>
          </View>
          {daysLeft != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, borderWidth: 1, borderColor: color.line, borderRadius: radius.chip, paddingHorizontal: space.s, paddingVertical: space.xs }}>
              <Hourglass size={16} weight="bold" color={color.muted} />
              <Mono s={12} c={color.muted}>{`Ends in ${daysLeft} d`}</Mono>
            </View>
          ) : null}
        </View>
        <Segmented value={view} onChange={setView} />
      </View>
      {view === "ladder" ? <Ladder isFull={isFull} elo={elo} rank={rank} /> : <Board userId={user?._id} rank={rank} />}
    </ScrollView>
  );
}
