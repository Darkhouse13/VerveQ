import React from "react";
import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { COLORS, DIFFICULTY_STYLE, neoShadow } from "../theme";

// Feed posts (Instagram / Facebook), not reels: static 4:5 slides, one
// composition frame per slide. latin-ext is non-negotiable (Šeško, Çalhanoğlu…).
const heading = loadHeading("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const body = loadBody("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] });
const mono = loadMono("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });

export const FONTS = { head: heading.fontFamily, body: body.fontFamily, mono: mono.fontFamily };
export { COLORS, neoShadow };

export const POST_W = 1080;
export const POST_H = 1350;
export const PAD = 72;

export const ACCENTS = [COLORS.orange, COLORS.pink, COLORS.blue, COLORS.green, COLORS.lime] as const;

// The quiz data says "intermediate"; the brand badge set says MEDIUM.
export const difficultyStyle = (d: string) =>
  DIFFICULTY_STYLE[d === "intermediate" ? "medium" : d] ?? DIFFICULTY_STYLE.medium;

const alpha = (hsl: string, a: number): string => hsl.replace(/^hsl\(([^)]+)\)$/, `hsl($1 / ${a})`);

export const Slide: React.FC<{
  accent: string;
  mode: string;
  index: number;
  total: number;
  children: React.ReactNode;
}> = ({ accent, mode, index, total, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      background: COLORS.cream,
      color: COLORS.ink,
      fontFamily: FONTS.body,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `radial-gradient(${alpha(accent, 0.13)} 3px, transparent 3px)`,
        backgroundSize: "54px 54px",
      }}
    />
    <div style={{ position: "absolute", inset: PAD, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 2.5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ background: COLORS.ink, color: COLORS.cream, padding: "9px 14px", borderRadius: 8 }}>VERVEQ</span>
          <span>{mode}</span>
        </div>
        {total > 1 ? <span style={{ opacity: 0.55 }}>{index + 1}/{total}</span> : null}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div>
    </div>
  </div>
);

export const Pill: React.FC<{ bg: string; fg: string; children: React.ReactNode; size?: number }> = ({
  bg,
  fg,
  children,
  size = 26,
}) => (
  <span
    style={{
      display: "inline-block",
      alignSelf: "flex-start",
      background: bg,
      color: fg,
      fontFamily: FONTS.mono,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: 2,
      padding: "10px 16px",
      borderRadius: 10,
      border: `4px solid ${COLORS.ink}`,
      boxShadow: neoShadow(6),
    }}
  >
    {children}
  </span>
);

export const Card: React.FC<{ bg?: string; shadow?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  bg = COLORS.card,
  shadow = 8,
  style,
  children,
}) => (
  <div
    style={{
      background: bg,
      border: `5px solid ${COLORS.ink}`,
      borderRadius: 18,
      boxShadow: neoShadow(shadow),
      ...style,
    }}
  >
    {children}
  </div>
);

export const Footer: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark = true }) => (
  <div
    style={{
      alignSelf: "stretch",
      background: dark ? COLORS.ink : COLORS.card,
      color: dark ? COLORS.cream : COLORS.ink,
      border: `5px solid ${COLORS.ink}`,
      borderRadius: 16,
      padding: "22px 28px",
      fontFamily: FONTS.head,
      fontWeight: 700,
      fontSize: 38,
      lineHeight: 1.15,
      textAlign: "center",
    }}
  >
    {children}
  </div>
);

// Largest font size (from the list) whose rough line estimate fits the box.
// Static slides, so a coarse character-width model is enough; the render
// check (posts.mjs --check) catches anything it gets wrong.
export const fitSize = (text: string, widthPx: number, maxLines: number, sizes: number[], charW = 0.56): number => {
  for (const size of sizes) {
    const perLine = Math.floor(widthPx / (size * charW));
    const words = text.split(/\s+/);
    let lines = 1;
    let cur = 0;
    for (const w of words) {
      const len = w.length + (cur ? 1 : 0);
      if (w.length > perLine) {
        lines = maxLines + 1;
        break;
      }
      if (cur + len > perLine) {
        lines++;
        cur = w.length;
      } else cur += len;
    }
    if (lines <= maxLines) return size;
  }
  return sizes[sizes.length - 1];
};
