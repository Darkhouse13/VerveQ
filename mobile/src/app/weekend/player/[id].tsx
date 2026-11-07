import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Warning } from "phosphor-react-native/src/icons/Warning";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Card, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { Empty } from "@/components/weekend/common";
import { ROLE_LABEL, kickoffLabel, leagueName, points, price, serverMessage } from "@/components/weekend/data";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";
import { guardParams, isConvexId } from "@/lib/params";

const ago = (ms: number) => {
  const h = Math.max(0, Math.round((Date.now() - ms) / 3_600_000));
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, gap: space.xs }}>
      <Mono s={20}>{value}</Mono>
      <Txt v="caption" c={color.muted}>
        {label}
      </Txt>
    </View>
  );
}

/** Player sheet. From the squad (slot=…): Replace / Remove. From the picker (pickFor=…): Pick him. */
function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { id, slot, locked, pickFor } = useLocalSearchParams<{ id: string; slot?: string; locked?: string; pickFor?: string }>();
  const { ready } = useSession();
  const card = useQuery(api.fantasyPlayerCard.getPlayerCard, { playerId: id });
  const gw = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const squad = useQuery(api.fantasySquads.getSquad, ready && gw && (slot || pickFor) ? { gameweekId: gw.gameweekId, context: "budget" } : "skip");
  const setSlot = useMutation(api.fantasySquads.setSlot);
  const [busy, setBusy] = useState(false);

  const act = async (slotIndex: number, playerId: string | null, after: () => void) => {
    if (!squad) return;
    setBusy(true);
    try {
      await setSlot({ squadId: squad.squadId, slotIndex, playerId: playerId as never });
      haptic.right();
      after();
    } catch (e) {
      haptic.wrong();
      Alert.alert("That didn't go through", serverMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (card === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Player" onBack={() => router.back()} close />
        <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />
      </View>
    );
  }
  if (card === null) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Player" onBack={() => router.back()} close />
        <Empty title="Player not found" />
      </View>
    );
  }

  const season = card.seasons?.[0];
  const prev = card.seasons?.[1];
  const hist = [...(card.history ?? [])].sort((a, b) => a.gwNumber - b.gwNumber).slice(-12);
  const maxPts = Math.max(1, ...hist.map((h) => h.points));
  const best = hist.reduce<(typeof hist)[number] | null>((b, h) => (b === null || h.points > b.points ? h : b), null);
  const avg = hist.length ? hist.reduce((s, h) => s + h.points, 0) / hist.length : null;
  const wk = card.weekend;
  const isLocked = locked === "1";

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={card.name} eyebrow={`${ROLE_LABEL[card.position]} · ${leagueName(card.leagueId)}`} onBack={() => router.back()} close />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xxl }}>
        <View style={{ gap: space.s }}>
          <Txt v="h1Game">{card.name}</Txt>
          <Txt c={color.muted}>{card.clubName}</Txt>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.s }}>
            <Mono s={28}>{price(card.price)}</Mono>
            <Txt v="caption" c={color.dim}>
              same for everyone
            </Txt>
          </View>
        </View>

        <Card style={{ gap: space.s }}>
          <Eyebrow>{wk ? `GW ${wk.gwNumber}` : "This weekend"}</Eyebrow>
          <Txt v="rowTitle">{wk?.opponentName ? `${wk.isHome ? "v" : "@"} ${wk.opponentName}` : "No game this weekend"}</Txt>
          {wk ? (
            <Txt v="caption" c={color.muted}>
              {kickoffLabel(wk.kickoffAt)}
            </Txt>
          ) : null}
        </Card>

        <View style={{ gap: space.m }}>
          <Eyebrow>Availability</Eyebrow>
          <View style={{ flexDirection: "row", gap: space.m, alignItems: "flex-start" }}>
            {card.availability ? (
              <Warning size={20} weight="fill" color={card.availability.status === "out" ? color.wrong : color.yellow} />
            ) : (
              <CheckCircle size={20} weight="fill" color={card.availabilityReported ? color.right : color.dim} />
            )}
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle">
                {card.availability
                  ? `${card.availability.status === "out" ? "Out" : "Doubt"} · ${card.availability.category}`
                  : card.availabilityReported
                    ? "No concern"
                    : "No report from his league yet"}
              </Txt>
              {card.availability?.reason ? (
                <Txt v="caption" c={color.muted}>
                  {card.availability.reason}
                </Txt>
              ) : null}
              {card.availability?.updatedAt ? (
                <Txt v="caption" c={color.dim}>{`Feed read ${ago(card.availability.updatedAt)}`}</Txt>
              ) : null}
            </View>
          </View>
        </View>

        {hist.length ? (
          <View style={{ gap: space.m }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Eyebrow>Points by gameweek</Eyebrow>
              <Mono s={12} c={color.muted}>{`${hist.length} apps · ${avg !== null ? points(avg) : "—"} avg`}</Mono>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.xs, height: 96 }}>
              {hist.map((h) => (
                <View key={h.gameweekId} style={{ flex: 1, alignItems: "center", gap: space.xs }}>
                  <View style={{ width: "100%", height: Math.max(4, (Math.max(0, h.points) / maxPts) * 72), borderRadius: 4, backgroundColor: h === best ? color.lime : color.line }} />
                  <Mono s={10} c={color.dim}>
                    {h.gwNumber}
                  </Mono>
                </View>
              ))}
            </View>
            {best ? <Txt v="caption" c={color.muted}>{`Best: ${points(best.points)} pts in GW ${best.gwNumber}`}</Txt> : null}
          </View>
        ) : null}

        {season ? (
          <View style={{ gap: space.m }}>
            <Eyebrow>{`${season.season} · ${season.leagueLabel}`}</Eyebrow>
            <Card style={{ flexDirection: "row", gap: space.m }}>
              <Stat value={season.line.apps} label="Apps" />
              <Stat value={season.line.goals} label="Goals" />
              <Stat value={season.line.assists} label="Assists" />
              <Stat value={season.line.minutes} label="Minutes" />
            </Card>
            {prev ? (
              <Txt v="caption" c={color.muted}>{`${prev.season}: ${prev.line.apps} apps · ${prev.line.goals} goals · ${prev.line.assists} assists`}</Txt>
            ) : null}
          </View>
        ) : null}

        {card.ownership?.inSquads !== null && card.ownership?.inSquads !== undefined && card.ownership.totalSquads > 0 ? (
          <View style={{ borderRadius: radius.card, backgroundColor: color.surface, padding: space.l }}>
            <Txt v="caption" c={color.muted}>{`In ${card.ownership.inSquads} of ${card.ownership.totalSquads} squads this gameweek`}</Txt>
          </View>
        ) : null}

        {pickFor !== undefined ? (
          <Button label={busy ? "Picking…" : `Pick ${card.name.split(" ").slice(-1)[0]}`} disabled={busy || !squad} onPress={() => act(Number(pickFor), card.playerId, () => router.dismiss(2))} />
        ) : slot !== undefined ? (
          isLocked ? (
            <Txt v="caption" c={color.muted} center>
              {"His match has kicked off, so he's locked in for this gameweek."}
            </Txt>
          ) : (
            <View style={{ gap: space.m }}>
              <Button label="Replace" onPress={() => router.replace({ pathname: "/weekend/pick", params: { slot } })} />
              <Button
                variant="secondary"
                label={busy ? "Removing…" : "Remove from my 13"}
                disabled={busy || !squad}
                onPress={() => act(Number(slot), null, () => router.back())}
              />
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

export default guardParams(PlayerScreen, { id: isConvexId });
