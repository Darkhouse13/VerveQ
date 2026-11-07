import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Card, Eyebrow, Mono, Txt } from "@/components/ui";
import { Empty, Segmented } from "@/components/weekend/common";
import { points } from "@/components/weekend/data";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";

type Row = { rank: number; name: string; total: number; isYou?: boolean; tied?: boolean };

function Table({ rows }: { rows: Row[] }) {
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <View
          key={`${r.rank}-${r.name}-${i}`}
          style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: color.lineSoft, backgroundColor: r.isYou ? color.surfaceHigh : "transparent" }}
        >
          <Mono s={15} c={r.rank <= 3 ? color.yellow : color.muted} style={{ width: 32 }}>
            {r.tied ? `=${r.rank}` : r.rank}
          </Mono>
          <Txt v="rowTitle" style={{ flex: 1 }} numberOfLines={1}>
            {r.isYou ? "You" : r.name}
          </Txt>
          <Mono s={15}>{points(r.total)}</Mono>
        </View>
      ))}
    </View>
  );
}

export default function WeekendLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const [tab, setTab] = useState<"gw" | "season">("gw");
  const gw = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const latest = useQuery(api.fantasyReceipts.latestReceiptRef, ready ? {} : "skip");
  // The table to read: the last settled weekend, else the open one (provisional).
  const gwId = latest?.gameweekId ?? gw?.gameweekId;
  const board = useQuery(api.fantasyScores.getWeekendLeaderboard, tab === "gw" && gwId ? { gameweekId: gwId } : "skip");
  const season = latest?.season ?? gw?.season;
  const seasonBoard = useQuery(api.fantasyScores.getWeekendSeasonLeaderboard, tab === "season" && season ? { season } : "skip");

  const body = () => {
    if (tab === "gw") {
      if (board === undefined) return <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />;
      if (board === null || board.rows.length === 0) return <Empty title="No table yet" line="It fills in as squads score this weekend." />;
      const me = board.rows.find((r) => r.isYou);
      const top = board.rows.slice(0, 7);
      const myIdx = me ? board.rows.indexOf(me) : -1;
      const around = myIdx > 6 ? board.rows.slice(Math.max(7, myIdx - 1), myIdx + 2) : [];
      const above = myIdx > 0 ? board.rows[myIdx - 1] : null;
      const beat = me ? board.rows.filter((r) => r.total < me.total).length : 0;
      const beatPct = me && board.ranked > 1 ? Math.round((beat / (board.ranked - 1)) * 100) : null;
      return (
        <View style={{ gap: space.xxl }}>
          <View style={{ paddingHorizontal: space.gutter, gap: space.s }}>
            <Eyebrow>{`Gameweek ${board.gwNumber} · ${board.state === "final" ? "final" : "provisional"}`}</Eyebrow>
            {me ? (
              <Card hero style={{ gap: space.s }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.s }}>
                  <Mono s={40}>{`#${me.rank}`}</Mono>
                  <Txt c={color.muted}>{`of ${board.ranked}`}</Txt>
                </View>
                <Txt v="rowTitle">{`You · ${points(me.total)} pts`}</Txt>
                {above ? <Txt v="caption" c={color.muted}>{`${points(above.total - me.total)} pts to #${above.rank}`}</Txt> : null}
                {/* Honest numbers (docs/BRAND.md): only a standing that flatters. */}
                {beatPct !== null && beatPct >= 50 ? <Txt v="caption" c={color.lime}>{`Beat ${beatPct}% of squads`}</Txt> : null}
              </Card>
            ) : (
              <Txt c={color.muted}>{"You don't have a squad in this gameweek."}</Txt>
            )}
          </View>
          <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
            <Eyebrow>Top</Eyebrow>
            <Table rows={top} />
          </View>
          {around.length ? (
            <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
              <Eyebrow>Around you</Eyebrow>
              <Table rows={around} />
            </View>
          ) : null}
          <Txt v="caption" c={color.dim} center style={{ paddingHorizontal: space.gutter }}>
            Ties share a place. Points can move until the gameweek settles.
          </Txt>
        </View>
      );
    }
    if (seasonBoard === undefined) return <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />;
    if (!seasonBoard || seasonBoard.rows.length === 0) return <Empty title="No season table yet" />;
    return (
      <View style={{ gap: space.xxl }}>
        {seasonBoard.me ? (
          <View style={{ paddingHorizontal: space.gutter }}>
            <Card hero style={{ gap: space.s }}>
              <Eyebrow>{`Season ${seasonBoard.season}`}</Eyebrow>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.s }}>
                <Mono s={40}>{`#${seasonBoard.me.rank}`}</Mono>
                <Txt c={color.muted}>{`of ${seasonBoard.ranked}`}</Txt>
              </View>
              <Txt v="rowTitle">{`${points(seasonBoard.me.total)} pts · ${seasonBoard.me.playedWeekends} weekends`}</Txt>
              <Txt v="caption" c={color.muted}>{`Best finish #${seasonBoard.me.bestRank}`}</Txt>
            </Card>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
          <Eyebrow>Top</Eyebrow>
          <Table rows={seasonBoard.rows.slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, total: r.total, isYou: (r as { isYou?: boolean }).isYou }))} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Weekend table" eyebrow="All budget squads" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <View style={{ paddingHorizontal: space.gutter }}>
          <Segmented value={tab} onChange={setTab} options={[{ value: "gw", label: "Gameweek" }, { value: "season", label: "This season" }]} />
        </View>
        {body()}
      </ScrollView>
    </View>
  );
}
