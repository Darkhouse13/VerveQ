// XI DEBATE — "combined XI: who gets in?" (research/concept-sweep-2026-09 §2
// row 13, §3.8: the comment champion of the sweep). One pitch, eleven slots,
// two name plates per slot — the 2003–04 Invincibles on red, the 2022–23 treble
// team on sky blue. The pairs land headliners-first, then the question is left
// OPEN: no pick is ever made on screen (it is an opinion format). Every name
// and both team labels come from facts.json, written by lab/xidebate-facts.mjs
// (Wikipedia season article + Wikidata dated P54 + Wikipedia infobox years).
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, FONTS, Ground, Middle, Stage, Topline, neoShadow, shake, spr } from "../kit";
import GRID from "./grid.json";
import FACTS from "./facts.json";

const PITCH_W = 952;
const PITCH_H = 840;
const PLATE_W = 214;
const HALF_H = 46;
const POS: Record<string, [number, number]> = {
  ST_L: [0.33, 0.1],
  ST_R: [0.67, 0.1],
  LM: [0.125, 0.39],
  CM_L: [0.375, 0.43],
  CM_R: [0.625, 0.43],
  RM: [0.875, 0.39],
  LB: [0.125, 0.67],
  CB_L: [0.375, 0.71],
  CB_R: [0.625, 0.71],
  RB: [0.875, 0.67],
  GK: [0.5, 0.905],
};
const A = FACTS.teams.a;
const B = FACTS.teams.b;
const NAVY = "#1C2C5B";
const GRASS = "hsl(152 55% 24%)";
const fit = (text: string, maxW: number, maxSize: number, k = 0.62) => Math.min(maxSize, Math.floor(maxW / (k * Math.max(1, text.length))));

const PitchLines: React.FC = () => (
  <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} width={PITCH_W} height={PITCH_H} style={{ position: "absolute", inset: 0, opacity: 0.45 }}>
    <g fill="none" stroke={COLORS.cream} strokeWidth="4">
      <rect x="4" y="4" width={PITCH_W - 8} height={PITCH_H - 8} rx="18" />
      <line x1="4" y1={PITCH_H / 2} x2={PITCH_W - 4} y2={PITCH_H / 2} />
      <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="86" />
      <rect x={PITCH_W / 2 - 240} y="4" width="480" height="140" />
      <rect x={PITCH_W / 2 - 240} y={PITCH_H - 144} width="480" height="140" />
    </g>
  </svg>
);

const Half: React.FC<{ text: string; bg: string; fg: string; top?: boolean }> = ({ text, bg, fg, top }) => (
  <div style={{ height: HALF_H, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: top ? `4px solid ${COLORS.ink}` : "none", fontFamily: FONTS.head, fontWeight: 700, fontSize: fit(text, PLATE_W - 20, 32), letterSpacing: -0.5, whiteSpace: "nowrap" }}>{text}</div>
);

export const XIDebate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const order = GRID.order;
  const landed = order.filter((_, k) => frame >= GRID.landAt + k * GRID.step).length;
  const asked = frame >= GRID.askAt;
  const ask = spr(frame, fps, GRID.askAt, 9, 16);
  const ash = shake(frame, GRID.askAt, 10, 10);
  const head = spr(frame, fps, 0, 10, 14);
  const flash = frame < GRID.askAt ? 0 : interpolate(frame, [GRID.askAt, GRID.askAt + 8], [0.45, 0], { extrapolateRight: "clamp" });
  // after the ask, a slow spotlight walks the slots: "this one — who?"
  const spot = asked ? Math.floor((frame - GRID.askAt) / 18) % order.length : -1;
  return (
    <AbsoluteFill style={{ background: GRASS }}>
      <Audio src={staticFile("promo/lab-xidebate.wav")} />
      <Ground color={GRASS}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 160 - 20, height: 80, background: "hsl(0 0% 0% / .07)" }} />
        ))}
      </Ground>
      <Stage>
        <Topline right={asked ? "YOUR CALL" : `${landed} / 11`} />
        <Middle top={52} bottom={96}>
          {/* the two teams */}
          <div style={{ display: "flex", gap: 14, alignItems: "stretch", transform: `scale(${0.9 + 0.1 * head})` }}>
            {[A, B].map((t, i) => (
              <div key={i} style={{ flex: 1, background: t.bg, color: t.fg === "#FFFFFF" ? COLORS.white : NAVY, border: `5px solid ${COLORS.ink}`, borderRadius: 16, boxShadow: neoShadow(7), padding: "12px 18px", textAlign: i === 0 ? "left" : "right" }}>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 38, letterSpacing: -1, lineHeight: 1 }}>
                  {t.club} {t.season}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 21, letterSpacing: 3, marginTop: 6 }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, marginBottom: 16, textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 60, letterSpacing: -2.5, lineHeight: 1, color: COLORS.cream, textShadow: `5px 5px 0 ${COLORS.ink}` }}>
            COMBINED XI. <span style={{ color: COLORS.lime }}>WHO GETS IN?</span>
          </div>
          <div style={{ position: "relative", width: PITCH_W, height: PITCH_H, background: "hsl(152 60% 30%)", borderRadius: 22, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(10) }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden" }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * (PITCH_H / 8), height: PITCH_H / 16, background: "hsl(0 0% 100% / .045)" }} />
              ))}
              <PitchLines />
            </div>
            {FACTS.slots.map((s) => {
              const k = order.indexOf(s.slot);
              const at = GRID.landAt + k * GRID.step;
              const [fx, fy] = POS[s.slot];
              const idle = Math.sin((frame + k * 13) / 10) * 2;
              const cx = fx * PITCH_W;
              const cy = fy * PITCH_H;
              const h = HALF_H * 2 + 12;
              if (frame < at)
                return (
                  <div key={s.slot} style={{ position: "absolute", left: cx - PLATE_W / 2, top: cy - h / 2, width: PLATE_W, height: h, borderRadius: 14, border: `4px dashed hsl(30 100% 97% / .5)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 38, color: "hsl(30 100% 97% / .5)", transform: `translateY(${idle}px)` }}>?</div>
                );
              const land = spr(frame, fps, at, 9, 14);
              const sh = shake(frame, at, 9, 8);
              const lit = spot === k;
              return (
                <div
                  key={s.slot}
                  style={{
                    position: "absolute",
                    left: cx - PLATE_W / 2,
                    top: cy - h / 2,
                    width: PLATE_W,
                    borderRadius: 14,
                    border: `4px solid ${lit ? COLORS.lime : COLORS.ink}`,
                    outline: lit ? `4px solid ${COLORS.ink}` : "none",
                    boxShadow: neoShadow(lit ? 10 : 7),
                    overflow: "hidden",
                    transform: `translate(${sh.x}px, ${sh.y + idle}px) scale(${(0.6 + 0.4 * land) * (lit ? 1.08 : 1)}) rotate(${-4 * (1 - land)}deg)`,
                    opacity: Math.min(1, land * 2),
                    zIndex: lit ? 2 : 1,
                  }}
                >
                  <Half text={s.a.show} bg={A.bg} fg={COLORS.white} top />
                  <Half text={s.b.show} bg={B.bg} fg={NAVY} />
                </div>
              );
            })}
          </div>
        </Middle>
        <Bottom>
          {asked ? (
            <div style={{ display: "flex", justifyContent: "center", transform: `translate(${ash.x}px, ${ash.y}px) scale(${(0.7 + 0.3 * ask) * (1 + 0.03 * Math.sin(frame / 3))})`, opacity: Math.min(1, ask * 2) }}>
              <div style={{ background: COLORS.lime, color: COLORS.ink, border: `6px solid ${COLORS.ink}`, borderRadius: 16, boxShadow: neoShadow(8), padding: "14px 30px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 40, letterSpacing: -1, whiteSpace: "nowrap" }}>
                HOW MANY INVINCIBLES MAKE YOURS?
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: COLORS.cream }}>ONE NAME PER SLOT. PICK.</div>
          )}
        </Bottom>
      </Stage>
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
