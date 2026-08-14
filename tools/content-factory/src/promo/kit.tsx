import React from "react";
import { spring, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { COLORS, neoShadow } from "../theme";

const H = loadHeading("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const M = loadMono("normal", { weights: ["700"], subsets: ["latin"] });
const B = loadBody("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });

export const FONTS = { head: H.fontFamily, mono: M.fontFamily, body: B.fontFamily };
export { COLORS, neoShadow };

export const W = 1080;
export const HGT = 1920;

// spring 0→1, the workhorse
export const spr = (frame: number, fps: number, delay = 0, damping = 12, dur = 18) =>
  spring({ frame: frame - delay, fps, config: { damping }, durationInFrames: dur });

// a value that ramps in then punches out at the tail of a scene
export const inOut = (frame: number, dur: number, tail = 7): number =>
  interpolate(frame, [dur - tail, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// scaleX wipe for accent bars/slashes
export const wipe = (frame: number, fps: number, delay = 0, dur = 12) =>
  spring({ frame: frame - delay, fps, config: { damping: 16 }, durationInFrames: dur });

// integer count-up between two numbers over [a,b]
export const countTo = (frame: number, a: number, b: number, from: number, to: number): number => {
  const t = interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return Math.round(from + (to - from) * t);
};

// A word/line that slams in from an overscale with a hard shadow. The staple
// of the whole piece.
export const Slam: React.FC<{
  frame: number;
  fps: number;
  delay?: number;
  damping?: number;
  from?: number;
  rot?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ frame, fps, delay = 0, damping = 11, from = 1.4, rot = 0, children, style }) => {
  const s = spr(frame, fps, delay, damping, 18);
  return (
    <div
      style={{
        ...style,
        transform: `scale(${from - (from - 1) * s}) rotate(${rot * (1 - s)}deg)`,
        opacity: Math.min(1, s * 1.8),
      }}
    >
      {children}
    </div>
  );
};

// element that pops (scale+fade) at a local delay — used all over the mode/
// question motifs
export const Pop: React.FC<{ delay?: number; damping?: number; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0,
  damping = 12,
  from = 0.5,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spr(frame, fps, delay, damping, 16);
  return <div style={{ ...style, transform: `scale(${from + (1 - from) * s})`, opacity: Math.min(1, s * 2) }}>{children}</div>;
};

// a decaying screen-shake offset (px) that fires at a given frame — sells impacts
export const shake = (frame: number, at: number, mag = 14, life = 10): { x: number; y: number } => {
  const d = frame - at;
  if (d < 0 || d > life) return { x: 0, y: 0 };
  const decay = 1 - d / life;
  return { x: Math.sin(d * 2.7) * mag * decay, y: Math.cos(d * 3.3) * mag * decay };
};

export const neo = (bg: string, depth = 12, radius = 18): React.CSSProperties => ({
  background: bg,
  border: `5px solid ${COLORS.ink}`,
  borderRadius: radius,
  boxShadow: neoShadow(depth),
});

// a chunky pill (mode labels, CTAs)
export const Pill: React.FC<{ bg: string; fg: string; size?: number; rot?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  bg,
  fg,
  size = 34,
  rot = 0,
  style,
  children,
}) => (
  <div
    style={{
      display: "inline-block",
      background: bg,
      color: fg,
      fontFamily: FONTS.mono,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: 2,
      padding: "16px 34px",
      border: `4px solid ${COLORS.ink}`,
      borderRadius: 12,
      boxShadow: neoShadow(7),
      transform: `rotate(${rot}deg)`,
      ...style,
    }}
  >
    {children}
  </div>
);

// full-bleed ground for a scene (hard cut between scenes flips the ground)
export const Ground: React.FC<{ color: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ color, children, style }) => (
  <div style={{ position: "absolute", inset: 0, background: color, overflow: "hidden", ...style }}>{children}</div>
);

// ── platform safe zone (CF-SAFEZONE, 2026-08-13) — STANDING DEFAULT ──
// On Instagram/TikTok a 9:16 frame loses the top ~200px to platform chrome
// (username, Reels header) and the bottom ~300px to caption/actions. Text or
// any critical element there is simply not seen. Every composition from this
// date forward puts ALL text and critical UI inside SafeArea; only grounds,
// stripes, and full-bleed flashes may touch the chrome strips. Grandfathered
// MP4s are untouched, but a re-render of an old format must adopt this.
// verify-reels.mjs (and future lane verifiers) assert this on rendered
// frames — bright pixels in the chrome strips fail the gate.
export const SAFE = { top: 220, bottom: 320, x: 60 } as const;
export const SafeArea: React.FC<{ center?: boolean; style?: React.CSSProperties; children: React.ReactNode }> = ({ center, style, children }) => (
  <div
    style={{
      position: "absolute",
      top: SAFE.top,
      bottom: SAFE.bottom,
      left: SAFE.x,
      right: SAFE.x,
      ...(center ? { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" } : {}),
      ...style,
    }}
  >
    {children}
  </div>
);

// subtle animated diagonal stripes to keep grounds alive (scrolls with frame)
export const Stripes: React.FC<{ frame: number; color: string; ground: string; opacity?: number }> = ({ frame, color, ground, opacity = 0.08 }) => {
  const shift = (frame * 1.4) % 120;
  return (
    <div
      style={{
        position: "absolute",
        inset: -40,
        opacity,
        backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 6px, transparent 6px 60px)`,
        backgroundPosition: `${shift}px 0`,
      }}
    />
  );
};
