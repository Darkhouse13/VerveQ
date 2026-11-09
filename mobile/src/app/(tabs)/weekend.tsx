import { useQuery } from "convex/react";
import { router, type Href } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Eye } from "phosphor-react-native/src/icons/Eye";
import { Receipt } from "phosphor-react-native/src/icons/Receipt";
import { Scales } from "phosphor-react-native/src/icons/Scales";
import { Star } from "phosphor-react-native/src/icons/Star";
import { TShirt } from "phosphor-react-native/src/icons/TShirt";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Eyebrow, Mono, Section, Txt, haptic } from "@/components/ui";
import { FavoriteClubSheet, useNow } from "@/components/weekend/common";
import { countdown, fixtureKind, kickoffLabel, leagueName, points } from "@/components/weekend/data";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";

const TOP_LEAGUES = [39, 140, 135, 78, 61];

function Tile({ title, line, icon: Ico, href }: { title: string; line: string; icon: Icon; href: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        router.push(href);
      }}
      style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, padding: space.l, gap: space.m, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.tile, borderWidth: 1.5, borderColor: color.lime, alignItems: "center", justifyContent: "center" }}>
        <Ico size={24} weight="regular" color={color.lime} />
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

function LinkRow({ label, href }: { label: string; href: Href }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
      <Txt v="caption" c={color.lime} style={{ fontFamily: font.bold }}>
        {label}
      </Txt>
      <CaretRight size={16} weight="bold" color={color.lime} />
    </Pressable>
  );
}

export default function WeekendHub() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const gw = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const leagues = useQuery(api.fantasyMarket.getWeekendLeagues, {});
  const fx = useQuery(api.fantasyMarket.getWeekendFixtures, {});
  const gwArgs = ready && gw ? { gameweekId: gw.gameweekId, context: "budget" as const } : "skip";
  const squad = useQuery(api.fantasySquads.getSquad, gwArgs);
  const score = useQuery(api.fantasyScores.getSquadScore, squad ? gwArgs : "skip");
  const latest = useQuery(api.fantasyReceipts.latestReceiptRef, ready ? {} : "skip");
  const receipt = useQuery(api.fantasyReceipts.getReceipt, latest ? { gameweekId: latest.gameweekId, context: "budget" } : "skip");
  const table = useQuery(api.fantasyScores.getWeekendLeaderboard, latest ? { gameweekId: latest.gameweekId } : "skip");
  const fav = useQuery(api.fantasySquads.getFavoriteClub, ready ? {} : "skip");
  const [favOpen, setFavOpen] = useState(false);

  const now = useNow();
  const live = useMemo(() => (fx?.fixtures ?? []).filter((f) => fixtureKind(f, now) === "live"), [fx, now]);
  const finished = (fx?.fixtures ?? []).filter((f) => fixtureKind(f, now) === "played").length;
  const withPoints = (fx?.fixtures ?? []).filter((f) => f.scored).length;
  const marquee = useMemo(
    () => (fx?.fixtures ?? []).filter((f) => fixtureKind(f, now) === "upcoming" && TOP_LEAGUES.includes(f.leagueId)).sort((a, b) => a.kickoffAt - b.kickoffAt).slice(0, 3),
    [fx, now],
  );
  const firstKickoff = (fx?.fixtures ?? []).filter((f) => fixtureKind(f, now) === "upcoming").sort((a, b) => a.kickoffAt - b.kickoffAt)[0];
  const filled = squad?.slots.filter((s) => s.playerId).length ?? 0;
  const favId = fav && fav.signedIn ? fav.inForce : null;
  const favName = favId ? fav?.clubs.find((c) => c.clubId === favId)?.name : null;
  const pct = receipt?.percentile && receipt.percentile.population > 1 ? Math.round((receipt.percentile.beatCount / (receipt.percentile.population - 1)) * 100) : null;
  const me = table?.rows.find((r) => r.isYou);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.ink }} contentContainerStyle={{ paddingTop: insets.top + space.l, paddingBottom: space.xxl }}>
      {/* Header */}
      <View style={{ paddingHorizontal: space.gutter, gap: space.s }}>
        <Eyebrow>{gw ? `Gameweek ${gw.gwNumber}${leagues ? ` · ${leagues.leagues.length} leagues` : ""}` : "The Weekend"}</Eyebrow>
        <Txt v="h1Tab">The Weekend</Txt>
        <Txt c={color.muted}>Free fantasy football, eight leagues</Txt>
      </View>

      {gw === null ? (
        <Section style={{ marginTop: space.xl }}>
          <Card>
            <Txt v="rowTitle">No weekend open right now</Txt>
            <Txt v="caption" c={color.muted}>
              The next gameweek opens as soon as its fixtures are set.
            </Txt>
          </Card>
        </Section>
      ) : null}

      {/* In play now */}
      {live.length ? (
        <Section eyebrow="In play now" style={{ marginTop: space.xxl }}>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
            {live.slice(0, 3).map((f, i) => (
              <View key={f.fixtureId} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.lime }} />
                <Txt v="body" style={{ flex: 1, fontFamily: font.bold }} numberOfLines={1}>{`${f.homeName} ${f.homeGoals ?? 0}–${f.awayGoals ?? 0} ${f.awayName}`}</Txt>
                <Mono s={11} c={color.lime}>
                  LIVE
                </Mono>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt v="caption" c={color.muted}>{`${live.length} live · ${finished} finished · ${withPoints} with points in`}</Txt>
            <LinkRow label="All fixtures" href="/weekend/fixtures" />
          </View>
        </Section>
      ) : null}

      {/* Your 13 */}
      {gw ? (
        <Section eyebrow={`Your 13 · GW ${gw.gwNumber}`} style={{ marginTop: space.xxl }}>
          <Card hero style={{ gap: space.l }}>
            {squad ? (
              <>
                <View style={{ gap: space.xs }}>
                  <Txt v="cardTitle">{filled === 13 ? "Your 13 is in" : `${filled} of 13 picked`}</Txt>
                  <Txt v="caption" c={color.muted}>
                    {filled === 13 ? "Points land about 2h after each full time" : "Fill every slot before each player's match kicks off"}
                  </Txt>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.s }}>
                  <Mono s={40}>{score ? points(score.total) : "0.0"}</Mono>
                  <Txt c={color.muted}>pts</Txt>
                  <View style={{ flex: 1 }} />
                  <Mono s={13} c={color.muted}>{`${score?.scoredSlots ?? 0}/13 scored`}</Mono>
                </View>
                <Button label="Open your 13" icon={ArrowRight} iconRight onPress={() => router.push("/weekend/squad")} />
              </>
            ) : (
              <>
                <View style={{ gap: space.xs }}>
                  <Txt v="cardTitle">Pick your 13</Txt>
                  <Txt v="caption" c={color.muted}>
                    {firstKickoff ? `An XI plus 2 finishers under £91.0m. First kickoff in ${countdown(firstKickoff.kickoffAt)}.` : "An XI plus 2 finishers under £91.0m."}
                  </Txt>
                </View>
                <Button label="Build my 13" icon={ArrowRight} iconRight onPress={() => router.push("/weekend/squad")} />
              </>
            )}
          </Card>
          {latest && receipt ? (
            <Pressable accessibilityRole="button"
              onPress={() => router.push({ pathname: "/weekend/receipt/[gameweekId]", params: { gameweekId: latest.gameweekId } })}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: radius.card, borderWidth: 1.5, borderColor: color.lime, opacity: pressed ? 0.8 : 1 })}
            >
              <Receipt size={24} weight="regular" color={color.lime} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Txt v="rowTitle">{`Gameweek ${latest.gwNumber} settled — your receipt is in`}</Txt>
                <Txt v="caption" c={color.muted}>{`${points(receipt.total)} pts${pct !== null && pct >= 50 ? ` · beat ${pct}% of budget squads` : ""}`}</Txt>
              </View>
              <CaretRight size={20} weight="bold" color={color.muted} />
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      {/* Play the Weekend */}
      <Section eyebrow="Play the Weekend" style={{ marginTop: space.xxl }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
          <Tile title="Budget squad" line="A fresh 13 under budget" icon={TShirt} href="/weekend/squad" />
          <Tile title="Crew draft" line="One code, unique picks" icon={UsersThree} href={"/weekend/crews" as Href} />
          <Tile title="Rate the weekend" line="The crowd moves every score" icon={Eye} href={"/weekend/vote" as Href} />
          <Tile title="Player court" line="Wrong position listed? Vote to fix it" icon={Scales} href={"/weekend/court" as Href} />
        </View>
      </Section>

      {/* Table teaser */}
      {table && table.rows.length ? (
        <Section eyebrow="Weekend table" style={{ marginTop: space.xxl }}>
          <Card style={{ gap: space.m }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Txt v="caption" c={color.muted}>{`Gameweek ${table.gwNumber} · ${table.state === "final" ? "final" : "provisional"}`}</Txt>
              {me ? <Mono s={13}>{`You #${me.rank}`}</Mono> : null}
            </View>
            {table.rows.slice(0, 3).map((r) => (
              <View key={`${r.rank}-${r.name}`} style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                <Mono s={15} c={color.yellow} style={{ width: 24 }}>
                  {r.rank}
                </Mono>
                <Txt v="body" style={{ flex: 1, fontFamily: font.bold }} numberOfLines={1}>
                  {r.isYou ? "You" : r.name}
                </Txt>
                <Mono s={15}>{points(r.total)}</Mono>
              </View>
            ))}
            <LinkRow label="Full table" href="/weekend/leaderboard" />
          </Card>
        </Section>
      ) : null}

      {/* This gameweek */}
      {marquee.length ? (
        <Section eyebrow="This gameweek" style={{ marginTop: space.xxl }}>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
            {marquee.map((f, i) => (
              <View key={f.fixtureId} style={{ minHeight: 64, justifyContent: "center", gap: space.xs, paddingHorizontal: space.l, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
                <Txt v="body" style={{ fontFamily: font.bold }} numberOfLines={1}>{`${f.homeName} v ${f.awayName}`}</Txt>
                <Mono s={11} c={color.muted}>{`${kickoffLabel(f.kickoffAt).toUpperCase()} · ${leagueName(f.leagueId).toUpperCase()}`}</Mono>
              </View>
            ))}
          </View>
          <LinkRow label={fx ? `All ${fx.fixtures.length} fixtures` : "All fixtures"} href="/weekend/fixtures" />
        </Section>
      ) : null}

      {/* Favorite club */}
      <Section style={{ marginTop: space.xxl }}>
        <Pressable accessibilityRole="button"
          disabled={!!favId}
          onPress={() => setFavOpen(true)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: radius.card, backgroundColor: color.surface, opacity: pressed ? 0.8 : 1 })}
        >
          <Star size={24} weight={favId ? "fill" : "regular"} color={color.yellow} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt v="rowTitle">{favName ? `Favorite club · ${favName}` : "Pick your favorite club"}</Txt>
            <Txt v="caption" c={color.muted}>
              {favName ? `4 ${favName} players allowed, 3 for any other club. Set for good.` : "4 players from them instead of 3. Set for good."}
            </Txt>
          </View>
          {favId ? null : <CaretRight size={20} weight="bold" color={color.muted} />}
        </Pressable>
        <LinkRow label="How the Weekend works" href={"/weekend/how-to-play" as Href} />
      </Section>

      <FavoriteClubSheet open={favOpen} onClose={() => setFavOpen(false)} />
      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}
