import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { OKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// the giant bedside clock — colon blinks on the beat (14f), lime on ink
const Clock: React.FC<{ time: string; frame: number; size?: number; color?: string }> = ({ time, frame, size = 230, color = COLORS.lime }) => {
  const [h, m] = time.split(":");
  const colonOn = frame % 28 < 14;
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: size, letterSpacing: -4, color, textShadow: `10px 10px 0 rgba(0,0,0,0.55)` }}>
      <span>{h}</span>
      <span style={{ opacity: colonOn ? 1 : 0.15 }}>:</span>
      <span>{m}</span>
    </div>
  );
};

// ============================================================ HOOK — the lie
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      {/* readable on frame 0: the clock + the lie, already on screen */}
      <div style={{ position: "absolute", top: 380, left: 0, right: 0 }}>
        <Clock time="00:41" frame={frame} />
      </div>
      <div style={{ position: "absolute", top: 760, left: 72, right: 72, textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 128, lineHeight: 0.96, letterSpacing: -3, color: COLORS.cream, transform: `scale(${interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" })})` }}>
          YOU SAID<br />ONE GAME.
        </div>
      </div>
      <Pop delay={34} style={{ position: "absolute", top: 1180, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 2, padding: "16px 38px", border: `5px solid ${COLORS.cream}`, boxShadow: `8px 8px 0 ${COLORS.cream}`, transform: "rotate(-2deg)" }}>
          THAT WAS AT ELEVEN.
        </div>
      </Pop>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.5 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ SPIRAL — the relapse loop
// each entry: when it hits, what the clock says, where the stamp lands
const LOOPS = [
  { at: 0, time: "00:58", x: 90, y: 900, rot: -8, size: 84, c: COLORS.orange, fg: COLORS.white, mode: "SURVIVAL" },
  { at: 42, time: "01:27", x: 420, y: 1150, rot: 5, size: 96, c: COLORS.pink, fg: COLORS.white, mode: "BLITZ" },
  { at: 77, time: "01:54", x: 60, y: 1380, rot: -4, size: 110, c: COLORS.blue, fg: COLORS.white, mode: "CAREER PATH" },
  { at: 105, time: "02:13", x: 330, y: 640, rot: 7, size: 124, c: COLORS.yellow, fg: COLORS.ink, mode: "HIGHER OR LOWER" },
  { at: 126, time: "02:36", x: 140, y: 420, rot: -6, size: 140, c: COLORS.red, fg: COLORS.white, mode: "ONE MORE RUN" },
];

const Spiral: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const current = [...LOOPS].reverse().find((l) => frame >= l.at) ?? LOOPS[0];
  const sh = LOOPS.reduce(
    (a, l) => {
      const s = shake(frame, l.at, 8 + LOOPS.indexOf(l) * 3, 9);
      return { x: a.x + s.x, y: a.y + s.y };
    },
    { x: 0, y: 0 }
  );
  const zoom = 1 + interpolate(frame, [0, dur], [0, 0.06], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom}) translate(${sh.x}px, ${sh.y}px)` }}>
        {/* the clock keeps lurching forward */}
        <div style={{ position: "absolute", top: 150, left: 0, right: 0 }}>
          <Clock time={current.time} frame={frame} size={190} color={frame >= 105 ? COLORS.red : COLORS.lime} />
        </div>
        {/* ONE MORE stamps pile up, each bigger and angrier */}
        {LOOPS.map((l, i) =>
          frame >= l.at ? (
            <div key={l.at} style={{ position: "absolute", left: l.x, top: l.y, transform: `rotate(${l.rot}deg) scale(${0.55 + spr(frame, fps, l.at, 9, 13) * 0.45})`, opacity: Math.min(1, spr(frame, fps, l.at, 9, 13) * 2) }}>
              <div style={{ background: l.c, color: l.fg, border: `6px solid ${COLORS.cream}`, boxShadow: `9px 9px 0 ${COLORS.cream}`, padding: "18px 40px", fontFamily: FONTS.head, fontWeight: 700, fontSize: l.size, letterSpacing: -2, whiteSpace: "nowrap" }}>
                ONE MORE.
              </div>
              <div style={{ marginTop: 12, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 27, letterSpacing: 2, color: COLORS.cream, opacity: 0.75 }}>{l.mode}</div>
            </div>
          ) : null
        )}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ BUSTED — the quiet gag, then relapse
const Busted: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const relapse = frame >= 35;
  const sh = shake(frame, 35, 18, 11);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={relapse ? COLORS.ink : COLORS.cream} />
      {!relapse ? (
        // dead quiet — small, reasonable, adult
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: interpolate(frame, [2, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 52, color: COLORS.ink, textAlign: "center" }}>You have work in six hours.</div>
        </div>
      ) : (
        // …relapse.
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Slam frame={frame} fps={fps} delay={35} from={1.8} damping={8} rot={-2}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 200, letterSpacing: -5, color: COLORS.lime, textShadow: `10px 10px 0 ${COLORS.cream}` }}>ONE MORE.</div>
          </Slam>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 30, 14);
  const btn = spr(frame, fps, 38, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.green} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.6} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, lineHeight: 0.92, letterSpacing: -4, color: COLORS.white, textShadow: `9px 9px 0 ${COLORS.ink}`, textAlign: "center" }}>IT'S NEVER<br />JUST ONE.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white }}>Free football trivia · new challenges daily</div>
        <Pop delay={62} style={{ marginTop: 30 }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2, color: COLORS.ink, opacity: 0.8 }}>(DON'T SAY WE DIDN'T WARN YOU)</div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

export const ONEMORE_SCENES: Record<OKey, React.FC<SceneProps>> = {
  hook: Hook,
  spiral: Spiral,
  busted: Busted,
  cta: Cta,
};
