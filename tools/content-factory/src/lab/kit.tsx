// LAB lane kit — the shared chrome every lab composition composes inside.
// Inherits the brand tokens + motion primitives from the promo kit and adds
// the two standing layout laws: the platform SAFE zone (CF-SAFEZONE) and the
// centered STAGE (CF-FIVE's Middle wrapper — content is centered between a
// pinned topline and a pinned bottom block inside y 340–1580, which is both
// the chrome-safe band and the 4:5 feed crop).
import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, spr, shake, Ground, Stripes, Pill } from "../promo/kit";

export { COLORS, FONTS, neoShadow, spr, shake, Ground, Stripes, Pill };

export const STAGE = { top: 340, bottom: 340, x: 64 } as const;
export const STAGE_W = 1080 - STAGE.x * 2; // 952

export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", top: STAGE.top, bottom: STAGE.bottom, left: STAGE.x, right: STAGE.x }}>{children}</div>
);

// everything between the topline and the pinned bottom block, vertically centered
export const Middle: React.FC<{ bottom?: number; top?: number; children: React.ReactNode }> = ({ bottom = 0, top = 56, children }) => (
  <div style={{ position: "absolute", top, bottom, left: 0, right: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
);

export const Bottom: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, ...style }}>{children}</div>
);

// the brand bug, pinned top-left for the whole runtime (spec #17), and a
// right-hand state readout (round counter / survivors) that never leaves
export const Topline: React.FC<{ right: React.ReactNode; light?: boolean; accent?: string }> = ({ right, light, accent = COLORS.lime }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontFamily: FONTS.mono,
      fontWeight: 700,
      fontSize: 24,
      letterSpacing: 4,
      color: light ? "hsl(0 0% 7% / .72)" : "hsl(30 100% 97% / .72)",
    }}
  >
    <span style={{ color: light ? COLORS.ink : accent }}>VERVEQ</span>
    <span>{right}</span>
  </div>
);

// a bar that drains left→right; frac 1 = full
export const TimerBar: React.FC<{ frac: number; color?: string; track?: string; height?: number; border?: string }> = ({ frac, color = COLORS.lime, track = "hsl(0 0% 0% / .35)", height = 22, border = COLORS.ink }) => (
  <div style={{ height, borderRadius: height, border: `4px solid ${border}`, background: track, overflow: "hidden", boxShadow: neoShadow(4) }}>
    <div style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, height: "100%", background: color }} />
  </div>
);

// the chip row that IS the scoreboard (spec #26): n pips, `done` filled,
// `current` pulsing. A viewer at any exit point has a number to type.
export const Pips: React.FC<{ n: number; done: number; current?: number; color?: string; dim?: string }> = ({ n, done, current = -1, color = COLORS.lime, dim = "hsl(30 100% 97% / .22)" }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: n }, (_, i) => {
        const on = i < done;
        const cur = i === current;
        const pulse = cur ? 1 + 0.12 * Math.sin(frame / 3) : 1;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 16,
              borderRadius: 8,
              background: on ? color : cur ? "hsl(30 100% 97% / .55)" : dim,
              transform: `scaleY(${pulse})`,
              border: `2px solid ${on || cur ? COLORS.ink : "transparent"}`,
            }}
          />
        );
      })}
    </div>
  );
};

// standard lab closer: the single comment ask, then the brand — never a
// product pitch (standalone promo is retired; the payoff frame is the ask)
export const Closer: React.FC<{ line1: string; line2: string; sub?: string; accent?: string; ground?: string; fg?: string }> = ({ line1, line2, sub, accent = COLORS.lime, ground = COLORS.ink, fg = COLORS.cream }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const a = spr(frame, fps, 1, 9, 14);
  const b = spr(frame, fps, 12, 9, 14);
  const c = spr(frame, fps, 26, 10, 14);
  const pulse = 1 + 0.03 * Math.sin(frame / 2.6);
  return (
    <>
      <Ground color={ground}>
        <Stripes frame={frame} color={accent} ground={ground} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, background: accent, opacity: flash * 0.9 }} />
      <Stage>
        <Middle>
          <div style={{ textAlign: "center" }}>
            <div style={{ transform: `scale(${0.7 + 0.3 * a})`, opacity: Math.min(1, a * 2), fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, lineHeight: 0.9, letterSpacing: -5, color: fg }}>
              {line1}
            </div>
            <div style={{ marginTop: 34, transform: `scale(${(0.7 + 0.3 * b) * pulse})`, opacity: Math.min(1, b * 2) }}>
              <div style={{ display: "inline-block", background: accent, color: COLORS.ink, border: `6px solid ${COLORS.ink}`, borderRadius: 18, boxShadow: neoShadow(10), padding: "22px 44px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1 }}>
                {line2}
              </div>
            </div>
            {sub && (
              <div style={{ marginTop: 40, opacity: Math.min(1, c * 2), transform: `translateY(${(1 - c) * 20}px)`, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: fg === COLORS.cream ? "hsl(30 100% 97% / .72)" : "hsl(0 0% 7% / .7)" }}>
                {sub}
              </div>
            )}
          </div>
        </Middle>
        <Bottom>
          <div style={{ textAlign: "center", opacity: Math.min(1, c * 2), fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: fg }}>VERVEQ.COM</div>
        </Bottom>
      </Stage>
    </>
  );
};
