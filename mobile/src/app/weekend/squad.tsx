import { useMutation, useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { router, useLocalSearchParams } from "expo-router";
import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Lock } from "phosphor-react-native/src/icons/Lock";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Star } from "phosphor-react-native/src/icons/Star";
import { Warning } from "phosphor-react-native/src/icons/Warning";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Card, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { Empty, FavoriteClubSheet, Segmented, Sheet } from "@/components/weekend/common";
import {
  FORMATION_CATALOGUE,
  ROLE_LABEL,
  SLOT_ROLES,
  currentShape,
  fixtureTag,
  planFormationChange,
  points,
  price,
  resolveFormation,
  serverMessage,
  shapeToFormation,
  shortClub,
  type BudgetSlot,
  type MarketPlayer,
  type NamedFormation,
  type SlotRole,
} from "@/components/weekend/data";
import { Ledger } from "@/components/weekend/Ledger";
import { Pitch, type PitchSlot } from "@/components/weekend/Pitch";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";

const formationKey = (squadId: string) => `wk_formation_${squadId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        height: 40,
        paddingHorizontal: space.l,
        borderRadius: 20,
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: on ? color.lime : color.line,
        backgroundColor: on ? color.surfaceHigh : "transparent",
      }}
    >
      <Txt v="body" c={on ? color.cream : color.muted} style={{ fontFamily: font.bold }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** First visit this gameweek: pick a shape + the two finisher roles, then build. */
function CreateSquad({ gwNumber, onCreate, busy }: { gwNumber: number; busy: boolean; onCreate: (f: NamedFormation, finishers: [SlotRole, SlotRole]) => void }) {
  const [formation, setFormation] = useState<NamedFormation>(FORMATION_CATALOGUE[3]!); // 4-3-3
  const [finishers, setFinishers] = useState<[SlotRole, SlotRole]>(["MID", "ATT"]);
  return (
    <View style={{ paddingHorizontal: space.gutter, gap: space.xxl }}>
      <View style={{ gap: space.s }}>
        <Eyebrow>{`Gameweek ${gwNumber}`}</Eyebrow>
        <Txt v="h1Game">Build your 13</Txt>
        <Txt c={color.muted}>An XI plus 2 finishers under £91.0m. Finishers score ×1.25 after the 75th minute. You can change all of this later.</Txt>
      </View>
      <View style={{ gap: space.m }}>
        <Eyebrow>Shape</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
          {FORMATION_CATALOGUE.map((f) => (
            <Chip key={f.name} label={f.name} on={f.name === formation.name} onPress={() => setFormation(f)} />
          ))}
        </View>
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={{ gap: space.m }}>
          <Eyebrow>{`Finisher ${i + 1}`}</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
            {SLOT_ROLES.map((r) => (
              <Chip
                key={r}
                label={ROLE_LABEL[r]}
                on={finishers[i] === r}
                onPress={() => setFinishers((prev) => (i === 0 ? [r, prev[1]] : [prev[0], r]))}
              />
            ))}
          </View>
        </View>
      ))}
      <Button label={busy ? "Building…" : "Build my 13"} disabled={busy} onPress={() => onCreate(formation, finishers)} />
    </View>
  );
}

export default function SquadScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { ready } = useSession();
  const gw = useQuery(api.fantasyMarket.getOpenGameweek, {});
  const gwArgs = gw ? { gameweekId: gw.gameweekId, context: "budget" as const } : "skip";
  const squad = useQuery(api.fantasySquads.getSquad, ready ? gwArgs : "skip");
  const score = useQuery(api.fantasyScores.getSquadScore, ready && squad ? gwArgs : "skip");
  const market = useQuery(api.fantasyMarket.getMarket, gw ? { fixtureOnly: true } : "skip");
  const fav = useQuery(api.fantasySquads.getFavoriteClub, ready ? {} : "skip");

  const createSquad = useMutation(api.fantasySquads.createSquad);
  const setSlot = useMutation(api.fantasySquads.setSlot);
  const setFormation = useMutation(api.fantasySquads.setFormation);

  const [tab, setTab] = useState<"squad" | "ledger">(params.tab === "ledger" ? "ledger" : "squad");
  const [busy, setBusy] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [formationName, setFormationName] = useState<string | null>(null);

  useEffect(() => {
    if (!squad) return;
    SecureStore.getItemAsync(formationKey(squad.squadId)).then(setFormationName).catch(() => undefined);
  }, [squad?.squadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => {
    const m = new Map<string, MarketPlayer>();
    for (const p of market?.players ?? []) m.set(p.playerId, p);
    return m;
  }, [market]);
  const pointsBySlot = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of score?.slots ?? []) if (s.state === "scored" && s.points !== null) m.set(s.slotIndex, points(s.points));
    return m;
  }, [score]);

  const run = async (fn: () => Promise<unknown>, failTitle: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      haptic.wrong();
      Alert.alert(failTitle, serverMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toPitch = (s: BudgetSlot): PitchSlot => {
    const p = s.playerId ? byId.get(s.playerId) : undefined;
    return {
      slotIndex: s.slotIndex,
      slotRole: s.slotRole,
      name: s.playerId ? (s.playerName ?? "…") : null,
      club: p ? shortClub(p.clubName) : s.playerClubId ? "•" : null,
      fixture: p ? fixtureTag(p.opponentName, p.isHome) : null,
      locked: s.locked,
      flag: s.availability?.status ?? null,
      points: pointsBySlot.get(s.slotIndex) ?? null,
    };
  };

  const openSlot = (slotIndex: number, playerId: string | null, locked: boolean) => {
    if (playerId) router.push({ pathname: "/weekend/player/[id]", params: { id: playerId, slot: String(slotIndex), locked: locked ? "1" : "0" } });
    else if (!locked) router.push({ pathname: "/weekend/pick", params: { slot: String(slotIndex) } });
  };

  // ── states ──
  const body = (() => {
    if (gw === undefined || (ready && gw && squad === undefined)) return <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />;
    if (gw === null) return <Empty title="No weekend open right now" line="The next gameweek opens as soon as its fixtures are set." />;
    if (squad === null)
      return (
        <CreateSquad
          gwNumber={gw.gwNumber}
          busy={busy}
          onCreate={(f, finishers) =>
            run(async () => {
              const res = await createSquad({ gameweekId: gw.gameweekId, context: "budget", formation: shapeToFormation(f.shape), finisherRoles: finishers });
              await SecureStore.setItemAsync(formationKey(res.squadId), f.name);
              setFormationName(f.name);
              haptic.right();
            }, "Couldn't build your squad")
          }
        />
      );
    if (!squad) return null;

    const planner = squad.slots.map((s) => ({ slotIndex: s.slotIndex, slotRole: s.slotRole, isFinisher: s.isFinisher, playerId: s.playerId ?? null, locked: s.locked }));
    const shape = currentShape(planner);
    const formation = resolveFormation(formationName, shape);
    const rows = formation?.rows ?? [
      { role: "GK" as const, count: 1 },
      { role: "DEF" as const, count: shape.DEF },
      { role: "MID" as const, count: shape.MID },
      { role: "ATT" as const, count: shape.ATT },
    ];
    const xi = squad.slots.filter((s) => !s.isFinisher);
    const finishers = squad.slots.filter((s) => s.isFinisher).sort((a, b) => a.slotIndex - b.slotIndex);
    const filled = squad.slots.filter((s) => s.playerId).length;
    const { total, allowance } = squad.budget;
    const left = allowance - total;
    const favClub = fav && fav.signedIn ? (fav.inForce ?? null) : null;
    const favName = favClub ? (fav?.clubs.find((c) => c.clubId === favClub)?.name ?? "Favorite") : null;
    const favCount = favClub ? squad.slots.filter((s) => s.playerClubId === favClub).length : 0;

    const changeShape = (f: NamedFormation) => {
      setShapeOpen(false);
      const plan = planFormationChange(planner, f.shape);
      if (!plan.ok) {
        Alert.alert("Can't switch to " + f.name, `Too many ${ROLE_LABEL[plan.lockedConflict!].toLowerCase()}s are already locked in.`);
        return;
      }
      const remember = async () => {
        await SecureStore.setItemAsync(formationKey(squad.squadId), f.name);
        setFormationName(f.name);
      };
      if (!plan.changesAnything) {
        void remember();
        return;
      }
      const go = () =>
        run(async () => {
          await setFormation({ squadId: squad.squadId, slots: plan.payload });
          await remember();
          for (const d of plan.displaced) await setSlot({ squadId: squad.squadId, slotIndex: d.slotIndex, playerId: null as never });
        }, "Couldn't switch the shape");
      if (plan.displaced.length === 0) go();
      else {
        const names = plan.displaced.map((d) => squad.slots.find((s) => s.slotIndex === d.slotIndex)?.playerName ?? "a player").join(", ");
        Alert.alert(`Switch to ${f.name}?`, `${names} ${plan.displaced.length === 1 ? "doesn't" : "don't"} fit the new shape and will come off. You can pick them again.`, [
          { text: "Cancel", style: "cancel" },
          { text: "Switch", onPress: go },
        ]);
      }
    };

    return (
      <View style={{ gap: space.xl }}>
        <View style={{ paddingHorizontal: space.gutter }}>
          <Segmented value={tab} onChange={setTab} options={[{ value: "squad", label: "Squad" }, { value: "ledger", label: "Ledger" }]} />
        </View>

        {tab === "ledger" ? (
          <View style={{ paddingHorizontal: space.gutter }}>
            <Ledger gameweekId={gw.gameweekId} />
          </View>
        ) : (
          <>
            {/* Budget + shape + favorite club */}
            <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Txt v="caption" c={color.muted}>
                  {"Spent "}
                  <Mono s={13}>{price(total)}</Mono>
                  {` of ${price(allowance)}`}
                </Txt>
                <Mono s={13} c={left < 0 ? color.wrong : color.lime}>{`${price(Math.abs(left))} ${left < 0 ? "over" : "left"}`}</Mono>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: color.line, overflow: "hidden" }}>
                <View style={{ width: `${Math.min(100, (total / allowance) * 100)}%`, height: 6, backgroundColor: left < 0 ? color.wrong : color.cream }} />
              </View>
              <View style={{ flexDirection: "row", gap: space.s, flexWrap: "wrap" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change shape, currently ${formation?.name ?? "custom"}`}
                  onPress={() => setShapeOpen(true)}
                  style={{ height: 40, paddingHorizontal: space.l, borderRadius: 20, borderWidth: 1.5, borderColor: color.lime, flexDirection: "row", alignItems: "center", gap: space.s }}
                >
                  <Txt v="body" c={color.lime} style={{ fontFamily: font.bold }}>{`Shape ${formation?.name ?? `${shape.DEF}-${shape.MID}-${shape.ATT}`}`}</Txt>
                  <CaretDown size={16} weight="bold" color={color.lime} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (favClub ? undefined : setFavOpen(true))}
                  style={{ height: 40, paddingHorizontal: space.m, borderRadius: 20, backgroundColor: color.surface, flexDirection: "row", alignItems: "center", gap: space.s }}
                >
                  <Star size={16} weight={favClub ? "fill" : "bold"} color={color.yellow} />
                  <Txt v="caption" c={color.muted}>
                    {favClub ? `${favName} ${favCount}/4` : "Pick favorite club"}
                  </Txt>
                </Pressable>
              </View>
            </View>

            {/* Pitch */}
            <View style={{ paddingHorizontal: space.gutter }}>
              <Pitch rows={rows} slots={xi.map(toPitch)} onPressSlot={(p) => openSlot(p.slotIndex, xi.find((s) => s.slotIndex === p.slotIndex)?.playerId ?? null, p.locked)} />
            </View>

            {/* Finishers */}
            <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
              <Eyebrow>{"Finishers · ×1.25 after 75'"}</Eyebrow>
              <View style={{ flexDirection: "row", gap: space.m }}>
                {finishers.map((s) => {
                  const p = s.playerId ? byId.get(s.playerId) : undefined;
                  return (
                    <Pressable
                      key={s.slotIndex}
                      accessibilityRole="button"
                      onPress={() => openSlot(s.slotIndex, s.playerId ?? null, s.locked)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 72,
                        borderRadius: radius.card,
                        borderWidth: 1.5,
                        borderStyle: s.playerId ? "solid" : "dashed",
                        borderColor: color.lime,
                        padding: space.m,
                        gap: space.xs,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                        {s.playerId ? null : <Plus size={16} weight="bold" color={color.lime} />}
                        <Txt v="rowTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {s.playerName ?? `Add ${ROLE_LABEL[s.slotRole].toLowerCase()}`}
                        </Txt>
                        {s.locked ? <Lock size={16} weight="fill" color={color.muted} /> : null}
                      </View>
                      <Mono s={11} c={color.muted}>
                        {[s.slotRole, p ? shortClub(p.clubName) : null, p ? fixtureTag(p.opponentName, p.isHome) : null, pointsBySlot.has(s.slotIndex) ? `${pointsBySlot.get(s.slotIndex)} pts` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Mono>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Status */}
            <View style={{ paddingHorizontal: space.gutter }}>
              <Card style={{ flexDirection: "row", gap: space.m, alignItems: "flex-start", backgroundColor: filled === 13 ? color.rightBg : color.surface }}>
                {filled === 13 ? <CheckCircle size={20} weight="fill" color={color.right} /> : <Warning size={20} weight="fill" color={color.yellow} />}
                <View style={{ flex: 1, gap: space.xs }}>
                  <Txt v="rowTitle">{filled === 13 ? `You're in for GW ${gw.gwNumber}` : `${filled} of 13 picked`}</Txt>
                  <Txt v="caption" c={color.muted}>
                    {score && score.scoredSlots > 0
                      ? `${points(score.total)} pts so far · ${score.scoredSlots} scored`
                      : "Change any player until his match kicks off. Changes save as you make them."}
                  </Txt>
                </View>
              </Card>
            </View>

            <Sheet open={shapeOpen} onClose={() => setShapeOpen(false)} title="Shape">
              <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.s, flexDirection: "row", flexWrap: "wrap", paddingBottom: space.l }}>
                {FORMATION_CATALOGUE.map((f) => (
                  <Chip key={f.name} label={f.name} on={f.name === formation?.name} onPress={() => changeShape(f)} />
                ))}
              </ScrollView>
            </Sheet>
          </>
        )}
      </View>
    );
  })();

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Your 13" eyebrow={gw ? `Gameweek ${gw.gwNumber}` : undefined} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl }}>{body}</ScrollView>
      {busy ? (
        <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 64, alignSelf: "center" }}>
          <ActivityIndicator color={color.lime} />
        </View>
      ) : null}
      <FavoriteClubSheet open={favOpen} onClose={() => setFavOpen(false)} />
    </View>
  );
}
