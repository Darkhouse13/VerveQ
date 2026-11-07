import { Lock } from "phosphor-react-native/src/icons/Lock";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";

import { Mono, Txt } from "@/components/ui";
import { color, radius, space } from "@/theme/tokens";

import type { FormationRow, SlotRole } from "./data";

export interface PitchSlot {
  slotIndex: number;
  slotRole: SlotRole;
  name: string | null; // null = empty slot
  club: string | null; // "ARS"
  fixture: string | null; // "HUL (H)" — no prices on the pitch (owner ruling)
  locked: boolean;
  flag: "out" | "doubtful" | null;
  points: string | null; // shown once a score exists
}

const PITCH_H = 448;

function Chip({ slot, onPress }: { slot: PitchSlot; onPress: () => void }) {
  const empty = slot.name === null;
  const ring = slot.flag === "out" ? color.wrong : slot.flag === "doubtful" ? color.yellow : empty ? color.lime : color.line;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? `Add a ${slot.slotRole}` : `${slot.name}, ${slot.fixture ?? ""}`}
      onPress={onPress}
      style={({ pressed }) => ({ width: 84, alignItems: "center", gap: space.xs, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: slot.slotRole === "GK" && !empty ? color.cream : color.surface,
          borderWidth: 1.5,
          borderStyle: empty ? "dashed" : "solid",
          borderColor: ring,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {empty ? (
          <Plus size={20} weight="bold" color={color.lime} />
        ) : (
          <Mono s={11} c={slot.slotRole === "GK" ? color.ink : color.cream}>
            {slot.club ?? "—"}
          </Mono>
        )}
        {slot.locked ? (
          <View style={{ position: "absolute", right: -4, top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" }}>
            <Lock size={10} weight="fill" color={color.muted} />
          </View>
        ) : null}
      </View>
      <View style={{ backgroundColor: color.ink, borderRadius: radius.chip, paddingHorizontal: space.s, paddingVertical: 2, maxWidth: 84 }}>
        <Txt v="micro" numberOfLines={1} c={empty ? color.muted : color.cream}>
          {empty ? slot.slotRole : slot.name}
        </Txt>
      </View>
      <Mono s={10} c={slot.points ? color.lime : color.muted}>
        {slot.points ? `${slot.points} pts` : empty ? "" : (slot.fixture ?? "")}
      </Mono>
    </Pressable>
  );
}

/** The XI on a vertical pitch: attack at the top, goalkeeper at the bottom. */
export function Pitch({ rows, slots, onPressSlot }: { rows: FormationRow[]; slots: PitchSlot[]; onPressSlot: (s: PitchSlot) => void }) {
  const [w, setW] = useState(350);
  const byRole: Record<SlotRole, PitchSlot[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const s of [...slots].sort((a, b) => a.slotIndex - b.slotIndex)) byRole[s.slotRole].push(s);
  const taken: Record<SlotRole, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const laid = rows.map((r) => {
    const part = byRole[r.role].slice(taken[r.role], taken[r.role] + r.count);
    taken[r.role] += r.count;
    return part;
  });
  // Any slot the row layout didn't place (shape outside the catalogue) still shows.
  for (const role of ["GK", "DEF", "MID", "ATT"] as SlotRole[]) {
    const rest = byRole[role].slice(taken[role]);
    if (rest.length) laid.push(rest);
  }
  const top = [...laid].reverse();

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={{ height: PITCH_H, borderRadius: radius.hero, backgroundColor: "#13241A", overflow: "hidden" }}
    >
      <Svg width={w} height={PITCH_H} style={{ position: "absolute" }}>
        <Rect x={12} y={12} width={w - 24} height={PITCH_H - 24} rx={6} stroke="#FFF7F0" strokeOpacity={0.13} strokeWidth={2} fill="none" />
        <Line x1={12} y1={PITCH_H / 2} x2={w - 12} y2={PITCH_H / 2} stroke="#FFF7F0" strokeOpacity={0.13} strokeWidth={2} />
        <Circle cx={w / 2} cy={PITCH_H / 2} r={40} stroke="#FFF7F0" strokeOpacity={0.13} strokeWidth={2} fill="none" />
        <Rect x={w / 2 - 84} y={12} width={168} height={64} stroke="#FFF7F0" strokeOpacity={0.13} strokeWidth={2} fill="none" />
        <Rect x={w / 2 - 84} y={PITCH_H - 76} width={168} height={64} stroke="#FFF7F0" strokeOpacity={0.13} strokeWidth={2} fill="none" />
      </Svg>
      <View style={{ flex: 1, justifyContent: "space-around", paddingVertical: space.s }}>
        {top.map((line, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-evenly" }}>
            {line.map((s) => (
              <Chip key={s.slotIndex} slot={s} onPress={() => onPressSlot(s)} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

