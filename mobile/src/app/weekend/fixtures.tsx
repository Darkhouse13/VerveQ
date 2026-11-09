import { useQuery } from "convex/react";
import { router } from "expo-router";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { Empty } from "@/components/weekend/common";
import { LEAGUE_NAMES, fixtureKind, groupByDay, leagueName, type Fixture } from "@/components/weekend/data";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";

function Row({ f, mine, last }: { f: Fixture; mine: number; last: boolean }) {
  const kind = fixtureKind(f);
  const time = new Date(f.kickoffAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const showScore = kind === "live" || kind === "played";
  return (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, borderBottomWidth: last ? 0 : 1, borderBottomColor: color.lineSoft }}>
      <View style={{ width: 48 }}>
        {kind === "live" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.lime }} />
            <Mono s={11} c={color.lime}>
              LIVE
            </Mono>
          </View>
        ) : kind === "played" ? (
          <Mono s={11} c={color.muted}>
            FT
          </Mono>
        ) : kind === "void" ? (
          <Mono s={11} c={color.wrong}>
            OFF
          </Mono>
        ) : (
          <Mono s={13}>{time}</Mono>
        )}
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Txt v="body" style={{ fontFamily: font.bold }} numberOfLines={1}>
          {showScore ? `${f.homeName} ${f.homeGoals ?? 0}–${f.awayGoals ?? 0} ${f.awayName}` : `${f.homeName} v ${f.awayName}`}
        </Txt>
        {mine > 0 ? (
          <Mono s={10} c={color.lime}>{`${mine} YOURS`}</Mono>
        ) : null}
      </View>
      {kind === "played" ? (
        f.scored ? (
          <View accessibilityLabel="Points in">
            <CheckCircle size={16} weight="fill" color={color.right} />
          </View>
        ) : (
          <View accessibilityLabel="Points pending">
            <Hourglass size={16} weight="bold" color={color.muted} />
          </View>
        )
      ) : null}
    </View>
  );
}

export default function FixturesScreen() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const fx = useQuery(api.fantasyMarket.getWeekendFixtures, {});
  const squad = useQuery(api.fantasySquads.getSquad, ready && fx ? { gameweekId: fx.gameweekId, context: "budget" } : "skip");
  const [league, setLeague] = useState<number | null>(null);

  const myClubs = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of squad?.slots ?? []) if (s.playerClubId) m.set(s.playerClubId, (m.get(s.playerClubId) ?? 0) + 1);
    return m;
  }, [squad]);
  const leagues = useMemo(() => [...new Set((fx?.fixtures ?? []).map((f) => f.leagueId))].filter((id) => LEAGUE_NAMES[id]), [fx]);
  const days = useMemo(() => groupByDay((fx?.fixtures ?? []).filter((f) => league === null || f.leagueId === league)), [fx, league]);

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Fixtures" eyebrow={fx ? `GW ${fx.gwNumber} · ${fx.fixtures.length} matches` : undefined} onBack={() => router.back()} />
      {fx === undefined ? (
        <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />
      ) : fx === null ? (
        <Empty title="No weekend open right now" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.s }}>
            {[null, ...leagues].map((id) => {
              const on = league === id;
              return (
                <Pressable accessibilityRole="button"
                  hitSlop={8}
                  key={id ?? "all"}
                  onPress={() => {
                    haptic.tap();
                    setLeague(id);
                  }}
                  style={{ height: 36, paddingHorizontal: space.m, borderRadius: 18, justifyContent: "center", borderWidth: 1.5, borderColor: on ? color.lime : color.line, backgroundColor: on ? color.surfaceHigh : "transparent" }}
                >
                  <Txt v="caption" c={on ? color.cream : color.muted} style={{ fontFamily: font.bold }}>
                    {id === null ? "All leagues" : leagueName(id)}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          {days.map((d) => {
            const byLeague = new Map<number, Fixture[]>();
            for (const f of d.rows) byLeague.set(f.leagueId, [...(byLeague.get(f.leagueId) ?? []), f]);
            return (
              <View key={d.key} style={{ paddingHorizontal: space.gutter, gap: space.m }}>
                <Eyebrow>{d.label}</Eyebrow>
                {[...byLeague.entries()].map(([lid, rows]) => (
                  <View key={lid} style={{ gap: space.s }}>
                    <Mono s={11} c={color.dim}>
                      {leagueName(lid).toUpperCase()}
                    </Mono>
                    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
                      {rows.map((f, i) => (
                        <Row key={f.fixtureId} f={f} mine={(myClubs.get(f.homeClubId) ?? 0) + (myClubs.get(f.awayClubId) ?? 0)} last={i === rows.length - 1} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          <Txt v="caption" c={color.dim} center>
            Times are your time. Points land about 2 hours after each full time.
          </Txt>
        </ScrollView>
      )}
    </View>
  );
}
