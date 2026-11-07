import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useLocalSearchParams } from "expo-router";
import { ArrowsDownUp } from "phosphor-react-native/src/icons/ArrowsDownUp";
import { LockSimple } from "phosphor-react-native/src/icons/LockSimple";
import { WarningCircle } from "phosphor-react-native/src/icons/WarningCircle";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Card, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { ErrorLine, Loading, Notice, Segmented, WeekendScreen, errorText } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import type { Id } from "@convex/_generated/dataModel";
import { color, radius, size, space } from "@/theme/tokens";
import { guardParams, isConvexId } from "@/lib/params";

type Sheet = NonNullable<FunctionReturnType<typeof api.fantasySquads.getMyCrewSheet>>;
type Slot = Sheet["slots"][number];
type Role = "GK" | "DEF" | "MID" | "ATT";
const ROLES: Role[] = ["GK", "DEF", "MID", "ATT"];
const ROLE_TITLE: Record<Role, string> = { GK: "Goalkeeper", DEF: "Defenders", MID: "Midfielders", ATT: "Attackers" };

function SlotRow({ slot, selected, editable, onPress, last }: { slot: Slot; selected: boolean; editable: boolean; onPress: () => void; last: boolean }) {
  const flag = slot.availability as { status: "out" | "doubtful"; reason: string | null } | null;
  const tappable = editable && !slot.locked;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !tappable }}
      disabled={!tappable}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{
        minHeight: size.listRow,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: color.lineSoft,
        backgroundColor: selected ? color.surfaceHigh : "transparent",
        borderLeftWidth: 0,
      }}
    >
      <View style={{ width: 40, height: 32, borderRadius: radius.chip, borderWidth: 1.5, borderColor: selected ? color.lime : color.line, alignItems: "center", justifyContent: "center" }}>
        <Mono s={11} c={selected ? color.lime : color.muted}>
          {slot.slotRole}
        </Mono>
      </View>
      <View style={{ flex: 1, gap: space.xs, minWidth: 0 }}>
        <Txt v="rowTitle" numberOfLines={1}>
          {slot.playerName ?? "—"}
        </Txt>
        {flag ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <WarningCircle size={16} weight="fill" color={flag.status === "out" ? color.wrong : color.yellow} />
            <Txt v="caption" c={color.muted} numberOfLines={1}>
              {`${flag.status === "out" ? "Out" : "Doubt"}${flag.reason ? ` · ${flag.reason}` : ""}`}
            </Txt>
          </View>
        ) : null}
      </View>
      {slot.locked ? <LockSimple size={20} weight="bold" color={color.dim} /> : selected ? <ArrowsDownUp size={20} weight="bold" color={color.lime} /> : null}
    </Pressable>
  );
}

function CrewSheetScreen() {
  const { roomId: raw } = useLocalSearchParams<{ roomId: string }>();
  const roomId = String(raw ?? "");
  const { ready } = useSession();
  const convex = useConvex();
  const [gate, setGate] = useState<"checking" | "closed" | "open">("checking");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    convex
      .query(api.fantasySquads.getMyCrewSheet, { roomId: roomId as Id<"fantasyDraftRooms"> })
      .then((s) => !cancelled && setGate(s === null ? "closed" : "open"))
      .catch(() => !cancelled && setGate("closed"));
    return () => {
      cancelled = true;
    };
  }, [convex, ready, roomId]);

  const sheet = useQuery(api.fantasySquads.getMyCrewSheet, gate === "open" ? { roomId: roomId as Id<"fantasyDraftRooms"> } : "skip");
  const setFormation = useMutation(api.fantasySquads.setFormation);

  const editable = sheet != null && (sheet.gameweekStatus === "upcoming" || sheet.gameweekStatus === "live");
  const xi = useMemo(() => (sheet?.slots ?? []).filter((s) => !s.isFinisher), [sheet]);
  const finishers = useMemo(() => (sheet?.slots ?? []).filter((s) => s.isFinisher), [sheet]);
  const shape = ["DEF", "MID", "ATT"].map((r) => xi.filter((s) => s.slotRole === r).length).join("-");

  const save = (slots: { slotIndex: number; slotRole: Role; isFinisher: boolean }[], fallback: string) => {
    if (!sheet || busy) return;
    setBusy(true);
    setError(null);
    void setFormation({ squadId: sheet.squadId, slots })
      .catch((e: unknown) => setError(errorText(e, fallback)))
      .finally(() => setBusy(false));
  };

  // Tap one player, then another: they trade slots (role + finisher flag), as on the web sheet.
  const tap = (slotIndex: number) => {
    if (!sheet) return;
    if (source === null) return setSource(slotIndex);
    if (source === slotIndex) return setSource(null);
    const a = sheet.slots.find((s) => s.slotIndex === source);
    const b = sheet.slots.find((s) => s.slotIndex === slotIndex);
    setSource(null);
    if (!a || !b) return;
    save(
      sheet.slots.map((s) => ({
        slotIndex: s.slotIndex,
        slotRole: (s.slotIndex === a.slotIndex ? b.slotRole : s.slotIndex === b.slotIndex ? a.slotRole : s.slotRole) as Role,
        isFinisher: s.slotIndex === a.slotIndex ? b.isFinisher : s.slotIndex === b.slotIndex ? a.isFinisher : s.isFinisher,
      })),
      "That swap isn't legal.",
    );
  };

  const setFinisherRole = (slotIndex: number, role: Role) => {
    if (!sheet) return;
    save(
      sheet.slots.map((s) => ({ slotIndex: s.slotIndex, slotRole: (s.slotIndex === slotIndex ? role : s.slotRole) as Role, isFinisher: s.isFinisher })),
      "Couldn't change that finisher role.",
    );
  };

  return (
    <WeekendScreen title="Your team sheet" eyebrow={sheet ? `GW ${sheet.gwNumber}` : "The Weekend"}>
      {gate === "checking" || (gate === "open" && sheet === undefined) ? (
        <Loading />
      ) : gate === "closed" || !sheet ? (
        <Notice title="No sheet of yours here" body="It appears once your draft completes." />
      ) : (
        <>
          <Card hero style={{ gap: space.s, borderColor: color.lime }}>
            <Eyebrow c={color.lime}>{`Shape ${shape}`}</Eyebrow>
            <Txt v="caption" c={color.muted}>
              {editable
                ? "The 13 are the 13 — arrange, don't re-man. Tap a player, then another to swap their slots. Each one locks at his own kickoff."
                : "This gameweek is closed — the sheet is final."}
            </Txt>
          </Card>
          <ErrorLine text={error} />
          {ROLES.map((role) => {
            const rows = xi.filter((s) => s.slotRole === role);
            if (rows.length === 0) return null;
            return (
              <View key={role} style={{ gap: space.m }}>
                <Eyebrow>{`${ROLE_TITLE[role]} · ${rows.length}`}</Eyebrow>
                <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
                  {rows.map((s, i) => (
                    <SlotRow key={s.slotIndex} slot={s} selected={source === s.slotIndex} editable={editable && !busy} onPress={() => tap(s.slotIndex)} last={i === rows.length - 1} />
                  ))}
                </View>
              </View>
            );
          })}
          {finishers.length > 0 ? (
            <View style={{ gap: space.m }}>
              <Eyebrow>Finishers · ×1.25 after 75&apos;</Eyebrow>
              {finishers.map((s) => (
                <Card key={s.slotIndex} style={{ gap: space.m, borderColor: color.lime }}>
                  <View style={{ marginHorizontal: -space.l, marginTop: -space.l }}>
                    <SlotRow slot={s} selected={source === s.slotIndex} editable={editable && !busy} onPress={() => tap(s.slotIndex)} last />
                  </View>
                  {editable && !s.locked ? (
                    <Segmented value={s.slotRole as Role} onChange={(r) => setFinisherRole(s.slotIndex, r)} options={ROLES.map((r) => ({ value: r, label: r }))} />
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}
        </>
      )}
    </WeekendScreen>
  );
}

export default guardParams(CrewSheetScreen, { roomId: isConvexId });
