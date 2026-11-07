import { useId } from "react";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

import { CROWN, INNER, LAUREL, SHIELD, SPARK } from "./badgePaths";

export type Tier = "bronze" | "silver" | "gold" | "platinum";

// convex/lib/elo.ts: Bronze < 1200 ≤ Silver < 1500 ≤ Gold < 2000 ≤ Platinum.
export const TIERS: { key: Tier; label: string; min: number; max: number | null }[] = [
  { key: "bronze", label: "Bronze", min: 0, max: 1199 },
  { key: "silver", label: "Silver", min: 1200, max: 1499 },
  { key: "gold", label: "Gold", min: 1500, max: 1999 },
  { key: "platinum", label: "Platinum", min: 2000, max: null },
];

export function tierFromElo(elo: number): Tier {
  if (elo >= 2000) return "platinum";
  if (elo >= 1500) return "gold";
  if (elo >= 1200) return "silver";
  return "bronze";
}

export const tierLabel = (t: Tier) => TIERS.find((x) => x.key === t)!.label;

/** Text color that reads each tier on ink. */
export const tierInk: Record<Tier, string> = {
  bronze: "#E9A56C",
  silver: "#D7DEE4",
  gold: "#FFE27A",
  platinum: "#C9FFF7",
};

const LOOK: Record<Tier, { m: string[]; d: string[]; glow: string | null; stars: number; laurel: boolean; crown: boolean }> = {
  bronze: { m: ["#FFD1A6", "#D98A4E", "#8A4B22", "#E9A56C"], d: ["#4A2A16", "#24140A"], glow: null, stars: 1, laurel: false, crown: false },
  silver: { m: ["#FFFFFF", "#D7DEE4", "#8E99A4", "#EEF2F5"], d: ["#3A434C", "#1A1F24"], glow: null, stars: 2, laurel: false, crown: false },
  gold: { m: ["#FFF6C2", "#FFD447", "#C98A12", "#FFE27A"], d: ["#5A3D06", "#2A1C02"], glow: "#FFC93D", stars: 3, laurel: true, crown: false },
  platinum: { m: ["#F2FFFD", "#A6F5EA", "#7CB8FF", "#E3C9FF"], d: ["#173A4A", "#0B1A24"], glow: "#8CF0FF", stars: 0, laurel: true, crown: true },
};

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

const STARS: Record<number, [number, number, number][]> = {
  0: [],
  1: [[60, 62, 16]],
  2: [
    [47, 62, 13],
    [73, 62, 13],
  ],
  3: [
    [41, 66, 11],
    [60, 54, 13.5],
    [79, 66, 11],
  ],
};

/** Layered metal crest per tier — the approved mockup badge, ported to react-native-svg. */
export function RankBadge({ tier, size = 44 }: { tier: Tier; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const t = LOOK[tier];
  const m = `m${id}`;
  const d = `d${id}`;
  const g = `g${id}`;
  const c = `c${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel={`${tierLabel(tier)} tier`}>
      <Defs>
        <LinearGradient id={m} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={t.m[0]} />
          <Stop offset="0.38" stopColor={t.m[1]} />
          <Stop offset="0.72" stopColor={t.m[2]} />
          <Stop offset="1" stopColor={t.m[3]} />
        </LinearGradient>
        <LinearGradient id={d} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.d[0]} />
          <Stop offset="1" stopColor={t.d[1]} />
        </LinearGradient>
        {t.glow ? (
          <RadialGradient id={g} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={t.glow} stopOpacity={0.55} />
            <Stop offset="1" stopColor={t.glow} stopOpacity={0} />
          </RadialGradient>
        ) : null}
        <ClipPath id={c}>
          <Path d={SHIELD} />
        </ClipPath>
      </Defs>
      {t.glow ? <Circle cx={60} cy={60} r={60} fill={`url(#${g})`} /> : null}
      {t.laurel ? (
        <G transform="translate(2 6) scale(0.2265625)">
          <Path d={LAUREL} fill={`url(#${m})`} />
        </G>
      ) : null}
      <Path d={SHIELD} fill={`url(#${m})`} />
      <Path d={INNER} fill={`url(#${d})`} />
      <Path d={INNER} fill="none" stroke={`url(#${m})`} strokeWidth={2.5} opacity={0.9} />
      {tier === "platinum" ? (
        <G opacity={0.35} stroke="#A6F5EA" strokeWidth={1}>
          <Path d="M60 21 L60 98 M31 31 L89 58 M89 31 L31 58" fill="none" />
        </G>
      ) : null}
      {STARS[t.stars].map(([cx, cy, r]) => (
        <Path key={`${cx}-${cy}`} d={star(cx, cy, r)} fill={`url(#${m})`} />
      ))}
      {t.crown ? (
        <>
          <G transform="translate(35 32) scale(0.09765625)">
            <Path d={CROWN} fill={`url(#${m})`} />
          </G>
          <G transform="translate(84 -2) scale(0.0625)">
            <Path d={SPARK} fill="#FFFFFF" />
          </G>
        </>
      ) : null}
      <G clipPath={`url(#${c})`}>
        <Path d="M14 4 H62 L26 116 H14 Z" fill="#FFFFFF" opacity={0.16} />
      </G>
      <Path d={SHIELD} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.5} />
    </Svg>
  );
}
