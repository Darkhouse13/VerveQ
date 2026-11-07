import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Info } from "phosphor-react-native/src/icons/Info";
import { Lock } from "phosphor-react-native/src/icons/Lock";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { X } from "phosphor-react-native/src/icons/X";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Mono, Txt, haptic } from "@/components/ui";
import { AvailabilityTag, Empty, useNow } from "@/components/weekend/common";
import { LEAGUE_NAMES, ROLE_LABEL, SLOT_ROLES, kickoffLabel, leagueName, matchesName, price, serverMessage, type MarketPlayer, type SlotRole } from "@/components/weekend/data";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

const CAP = 130; // rows rendered at once (web MARKET_RESULT_CAP)

function FilterChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{ height: 36, paddingHorizontal: space.m, borderRadius: 18, justifyContent: "center", borderWidth: 1.5, borderColor: on ? color.lime : color.line, backgroundColor: on ? color.surfaceHigh : "transparent" }}
    >
      <Txt v="caption" c={on ? color.cream : color.muted} style={{ fontFamily: font.bold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export default function PickScreen() {
  const insets = useSafeAreaInsets();
  const { slot } = useLocalSearchParams<{ slot: string }>();
  const slotIndex = Number(slot);
  const { ready } = useSession();
  const gw = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const squad = useQuery(api.fantasySquads.getSquad, ready && gw ? { gameweekId: gw.gameweekId, context: "budget" } : "skip");
  const market = useQuery(api.fantasyMarket.getMarket, gw ? { fixtureOnly: true } : "skip");
  const setSlot = useMutation(api.fantasySquads.setSlot);

  const target = squad?.slots.find((s) => s.slotIndex === slotIndex);
  const [role, setRole] = useState<SlotRole | "ALL" | null>(null);
  const [league, setLeague] = useState<number | null>(null);
  const [affordable, setAffordable] = useState(true);
  const [hideFlagged, setHideFlagged] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const activeRole = role ?? target?.slotRole ?? "ALL";
  const now = useNow();

  const inSquad = useMemo(() => new Set((squad?.slots ?? []).map((s) => s.playerId).filter(Boolean) as string[]), [squad]);
  const toSpend = squad && target ? squad.budget.allowance - squad.budget.total + (target.playerId && !target.locked ? target.playerPrice : 0) : null;

  const rows = useMemo(() => {
    if (!market) return [];
    return market.players
      .filter((p) => p.price !== null && p.kickoffAt !== null)
      .filter((p) => activeRole === "ALL" || p.position === activeRole)
      .filter((p) => league === null || p.leagueId === league)
      .filter((p) => !affordable || toSpend === null || p.price <= toSpend + 1e-9)
      .filter((p) => !hideFlagged || !p.availability)
      .filter((p) => matchesName(`${p.name} ${p.clubName}`, q))
      .map((p) => ({ ...p, started: p.kickoffAt <= now }))
      .sort((a, b) => Number(a.started) - Number(b.started) || b.price - a.price || a.name.localeCompare(b.name))
      .slice(0, CAP);
  }, [market, activeRole, league, affordable, hideFlagged, q, toSpend, now]);

  const leagues = useMemo(() => [...new Set((market?.players ?? []).map((p) => p.leagueId))].filter((id) => LEAGUE_NAMES[id]).sort(), [market]);

  const pick = async (p: MarketPlayer & { started: boolean }) => {
    if (!squad || busy) return;
    if (p.started) {
      Alert.alert("His match has started", "Players lock at kickoff. Pick someone whose game is still to come.");
      return;
    }
    if (inSquad.has(p.playerId)) {
      Alert.alert("Already in your 13", `${p.name} is already in your squad.`);
      return;
    }
    setBusy(true);
    try {
      await setSlot({ squadId: squad.squadId, slotIndex, playerId: p.playerId });
      haptic.right();
      router.back();
    } catch (e) {
      haptic.wrong();
      Alert.alert("That pick didn't land", serverMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={{ paddingHorizontal: space.gutter, gap: space.m, paddingBottom: space.m }}>
      <View style={{ height: size.input, borderRadius: radius.input, backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.line, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l }}>
        <MagnifyingGlass size={20} weight="bold" color={color.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search players or clubs"
          placeholderTextColor={color.dim}
          accessibilityLabel="Search players"
          autoCorrect={false}
          style={{ flex: 1, color: color.cream, fontFamily: font.bold, fontSize: 17 }}
        />
        {q ? (
          <Pressable accessibilityLabel="Clear search" onPress={() => setQ("")} hitSlop={12}>
            <X size={20} weight="bold" color={color.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
        <FilterChip label="All" on={activeRole === "ALL"} onPress={() => setRole("ALL")} />
        {SLOT_ROLES.map((r) => (
          <FilterChip key={r} label={ROLE_LABEL[r]} on={activeRole === r} onPress={() => setRole(r)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
        {toSpend !== null ? <FilterChip label={`Up to ${price(Math.max(0, toSpend))}`} on={affordable} onPress={() => setAffordable((v) => !v)} /> : null}
        <FilterChip label="Hide flagged" on={hideFlagged} onPress={() => setHideFlagged((v) => !v)} />
        <FilterChip label="All leagues" on={league === null} onPress={() => setLeague(null)} />
        {leagues.map((id) => (
          <FilterChip key={id} label={leagueName(id)} on={league === id} onPress={() => setLeague(id)} />
        ))}
      </ScrollView>
      <Txt v="caption" c={color.dim}>
        Any player can fill any slot. Prices are the same for everyone and fixed for the gameweek.
      </Txt>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title={target?.playerName ? `Replace ${target.playerName}` : "Pick a player"}
        eyebrow={target ? `${target.isFinisher ? "Finisher · " : ""}${ROLE_LABEL[target.slotRole]}${toSpend !== null ? ` · ${price(Math.max(0, toSpend))} to spend` : ""}` : undefined}
        onBack={() => router.back()}
        close
      />
      {market === undefined || squad === undefined ? (
        <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />
      ) : !market || !squad ? (
        <Empty title="Nothing to pick from" line="No weekend is open right now." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.playerId}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingTop: space.l, paddingBottom: insets.bottom + space.xxl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty title="No players match" line="Loosen a filter or search another name." />}
          renderItem={({ item: p }) => {
            const mine = inSquad.has(p.playerId);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${p.clubName}, ${price(p.price)}`}
                onPress={() => pick(p)}
                disabled={busy}
                style={({ pressed }) => ({ minHeight: size.listRow, paddingHorizontal: space.gutter, paddingVertical: space.m, flexDirection: "row", alignItems: "center", gap: space.m, opacity: p.started || mine ? 0.5 : pressed ? 0.7 : 1 })}
              >
                <View style={{ flex: 1, gap: space.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                    <Txt v="rowTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {p.name}
                    </Txt>
                    {p.availability ? <AvailabilityTag status={p.availability.status} /> : null}
                    {mine ? (
                      <View style={{ paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.chip, backgroundColor: color.surfaceHigh }}>
                        <Mono s={10} c={color.muted}>
                          IN SQUAD
                        </Mono>
                      </View>
                    ) : null}
                  </View>
                  <Txt v="caption" c={color.muted} numberOfLines={1}>
                    {`${p.clubName} · ${p.isHome ? "v" : "@"} ${p.opponentName} · `}
                    {p.started ? "started" : kickoffLabel(p.kickoffAt)}
                    {p.availability?.reason ? ` · ${p.availability.reason}` : ""}
                  </Txt>
                </View>
                {p.started ? <Lock size={16} weight="fill" color={color.muted} /> : null}
                <Mono s={15}>{price(p.price)}</Mono>
                <Pressable
                  accessibilityLabel={`About ${p.name}`}
                  hitSlop={8}
                  onPress={() => router.push({ pathname: "/weekend/player/[id]", params: { id: p.playerId, pickFor: String(slotIndex) } })}
                >
                  <Info size={20} weight="bold" color={color.muted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
