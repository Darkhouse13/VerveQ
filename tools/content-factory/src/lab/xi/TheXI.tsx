// THE XI — the inference build. Eleven empty plates on a pitch at frame 0
// and one promise: every man who lands on it played for the same club. The
// plates fill on a metronomic 4.0s beat, forgotten connections first, the
// one-club man last, and the viewer is working the whole time. The club
// resolves on screen (lab/xi-facts.mjs proves it is the ONLY club on all
// eleven paths); the ask is the one thing the reveal cannot answer — which
// name gave it away.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, Closer, FONTS, Ground, Middle, Stage, TimerBar, Topline, neoShadow, shake, spr } from "../kit";
import GRID from "../grid.json";
import FACTS from "./facts.json";

const G = GRID.xi;
const FPS = GRID.fps;
const XI = FACTS.xi;
const N = XI.length;
const NAMES_END = N * G.name;
export const XI_TOTAL = NAMES_END + G.reveal + G.closer;

const PITCH_W = 952;
const PITCH_H = 830;
const PLATE_W = 262;
const PLATE_H = 80;
// formation 4-3-3, x/y as fractions of the pitch box (attack at the top)
const SLOTS: Record<string, [number, number]> = {
  GK: [0.5, 0.915],
  LB: [0.15, 0.7],
  CB1: [0.355, 0.8],
  CB2: [0.645, 0.8],
  RB: [0.85, 0.7],
  CM1: [0.2, 0.5],
  CM2: [0.5, 0.45],
  CM3: [0.8, 0.5],
  LW: [0.16, 0.22],
  ST: [0.5, 0.14],
  RW: [0.84, 0.22],
};
const PITCH_GREEN = "hsl(152 60% 30%)";
const GRASS = "hsl(152 55% 26%)";

const PitchLines: React.FC = () => (
  <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} width={PITCH_W} height={PITCH_H} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
    <g fill="none" stroke={COLORS.cream} strokeWidth="4">
      <rect x="4" y="4" width={PITCH_W - 8} height={PITCH_H - 8} rx="18" />
      <line x1="4" y1={PITCH_H / 2} x2={PITCH_W - 4} y2={PITCH_H / 2} />
      <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r="92" />
      <rect x={PITCH_W / 2 - 250} y="4" width="500" height="150" />
      <rect x={PITCH_W / 2 - 110} y="4" width="220" height="58" />
      <rect x={PITCH_W / 2 - 250} y={PITCH_H - 154} width="500" height="150" />
      <rect x={PITCH_W / 2 - 110} y={PITCH_H - 62} width="220" height="58" />
    </g>
  </svg>
);

const Plate: React.FC<{ item: (typeof XI)[number]; landed: boolean; land: number; sh: { x: number; y: number }; frame: number; revealed: boolean; rv: number }> = ({ item, landed, land, sh, frame, revealed, rv }) => {
  const [fx, fy] = SLOTS[item.slot];
  const idle = Math.sin((frame + item.i * 13) / 10) * 2;
  const cx = fx * PITCH_W;
  const cy = fy * PITCH_H;
  const glow = revealed ? 1 + 0.03 * Math.sin(frame / 3 + item.i) : 1;
  return (
    <div style={{ position: "absolute", left: cx - PLATE_W / 2, top: cy - PLATE_H / 2, width: PLATE_W, height: PLATE_H }}>
      {!landed ? (
        <div style={{ width: "100%", height: "100%", borderRadius: 14, border: `4px dashed hsl(30 100% 97% / .55)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 40, color: "hsl(30 100% 97% / .5)", transform: `translateY(${idle}px)` }}>?</div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 14,
            background: revealed ? COLORS.lime : COLORS.cream,
            color: COLORS.ink,
            border: `4px solid ${COLORS.ink}`,
            boxShadow: neoShadow(7),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transform: `translate(${sh.x}px, ${sh.y + (landed ? idle : 0)}px) scale(${(0.6 + 0.4 * land) * glow * (1 + 0.04 * rv)}) rotate(${-4 * (1 - land)}deg)`,
            opacity: Math.min(1, land * 2),
          }}
        >
          <div style={{ position: "absolute", top: 5, left: 9, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 14, letterSpacing: 1, opacity: 0.5 }}>{String(item.i + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: item.show.length > 10 ? 27 : 32, letterSpacing: -1, lineHeight: 1, whiteSpace: "nowrap" }}>{item.show}</div>
        </div>
      )}
    </div>
  );
};

const Board: React.FC<{ mode: "names" | "reveal" }> = ({ mode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = mode === "names" ? frame : NAMES_END + frame;
  const landedCount = mode === "reveal" ? N : Math.min(N, Math.floor((frame - G.landAt) / G.name) + 1 + (frame >= G.landAt ? 0 : -1));
  const current = Math.min(N, Math.max(0, landedCount));
  const revealed = mode === "reveal";
  const rv = revealed ? spr(frame, fps, 10, 8, 16) : 0;
  const rsh = revealed ? shake(frame, 10, 4, 12) : { x: 0, y: 0 };
  const clueFrac = mode === "names" ? interpolate(frame, [0, NAMES_END], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const idxNow = mode === "names" ? Math.min(N - 1, Math.max(0, Math.floor(frame / G.name))) : N - 1;
  const beat = mode === "names" ? frame - idxNow * G.name : 0;
  const heat = mode === "names" && beat < 14;
  return (
    <AbsoluteFill>
      <Ground color={GRASS}>
        {/* mowing bands — grounds may touch the chrome strips, text never does */}
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 160 - 20, height: 80, background: "hsl(0 0% 0% / .07)" }} />
        ))}
      </Ground>
      <Stage>
        <Topline right={revealed ? "11 / 11" : `${current} / ${N}`} accent={COLORS.lime} />
        <Middle bottom={80} top={64}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, lineHeight: 0.9, letterSpacing: -3, color: COLORS.cream, textShadow: `5px 5px 0 ${COLORS.ink}` }}>
              {revealed ? (
                <>
                  ALL ELEVEN.<br />
                  <span style={{ color: COLORS.lime }}>ONE CLUB.</span>
                </>
              ) : (
                <>
                  11 PLAYERS.<br />
                  <span style={{ color: COLORS.lime }}>1 CLUB.</span>
                </>
              )}
            </div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: "hsl(30 100% 97% / .8)", textAlign: "right", lineHeight: 1.4 }}>
              THEY ALL<br />PLAYED THERE.
            </div>
          </div>
          <div style={{ position: "relative", width: PITCH_W, height: PITCH_H, background: PITCH_GREEN, borderRadius: 22, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(10), overflow: "visible", transform: `translate(${rsh.x}px, ${rsh.y}px)` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden" }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * (PITCH_H / 8), height: PITCH_H / 16, background: "hsl(0 0% 100% / .045)" }} />
              ))}
              <PitchLines />
            </div>
            {XI.map((item) => {
              const at = item.i * G.name + G.landAt;
              const landed = revealed || abs >= at;
              const land = revealed ? 1 : spr(abs, fps, at, 9, 14);
              const sh = revealed ? { x: 0, y: 0 } : shake(abs, at, 11, 9);
              return <Plate key={item.i} item={item} landed={landed} land={land} sh={sh} frame={abs} revealed={revealed} rv={rv} />;
            })}
            {revealed && (
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${-5 + 2 * rv}deg) scale(${0.3 + 0.7 * rv})`, opacity: Math.min(1, rv * 2) }}>
                <div style={{ background: COLORS.red, color: COLORS.cream, border: `7px solid ${COLORS.cream}`, borderRadius: 22, boxShadow: `14px 14px 0 ${COLORS.ink}`, padding: "26px 46px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, letterSpacing: -4, whiteSpace: "nowrap", lineHeight: 0.95 }}>
                  {FACTS.clubShow}
                </div>
              </div>
            )}
          </div>
        </Middle>
        <Bottom>
          {revealed ? (
            <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: COLORS.cream, opacity: Math.min(1, rv * 2) }}>EVERY ONE OF THEM. SAME SHIRT.</div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: COLORS.cream }}>
                <span>NAME THE CLUB</span>
                <span style={{ transform: `scale(${heat ? 1.08 : 1})`, display: "inline-block", color: COLORS.lime }}>CLUE {current} / {N}</span>
              </div>
              <TimerBar frac={clueFrac} color={COLORS.lime} border={COLORS.cream} track="hsl(0 0% 0% / .35)" height={20} />
            </div>
          )}
        </Bottom>
      </Stage>
      {revealed && <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: interpolate(frame, [8, 16], [0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

export const TheXI: React.FC = () => (
  <AbsoluteFill style={{ background: GRASS }}>
    <Audio src={staticFile("promo/lab-xi.wav")} />
    <Sequence from={0} durationInFrames={NAMES_END} premountFor={FPS}>
      <Board mode="names" />
    </Sequence>
    <Sequence from={NAMES_END} durationInFrames={G.reveal} premountFor={FPS}>
      <Board mode="reveal" />
    </Sequence>
    <Sequence from={NAMES_END + G.reveal} durationInFrames={G.closer} premountFor={FPS}>
      <Closer line1="WHICH NAME GAVE IT AWAY?" line2="COMMENTS." accent={COLORS.green} />
    </Sequence>
  </AbsoluteFill>
);
