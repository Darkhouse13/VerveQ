import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { AKey, BEAT } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ============================================================ CHANT — word per beat
// pairs share a ground so the colour flips at 1.25/s while the words hit at 2.5/s
const WORDS = [
  { t: "EVERY", ground: COLORS.orange },
  { t: "PUB.", ground: COLORS.orange },
  { t: "EVERY", ground: COLORS.pink },
  { t: "OFFICE.", ground: COLORS.pink },
  { t: "EVERY", ground: COLORS.blue },
  { t: "GROUP CHAT.", ground: COLORS.blue },
  { t: "EVERY", ground: COLORS.green },
  { t: "BARBER SHOP.", ground: COLORS.green },
];

const Chant: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const i = Math.min(WORDS.length - 1, Math.floor(frame / BEAT));
  const w = WORDS[i];
  const local = frame - i * BEAT; // 0..11 within the word
  const punch = interpolate(local, [0, 4], [1.18, 1], { extrapolateRight: "clamp" });
  const sh = shake(frame, i * BEAT, 7, 5);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={w.ground}>
        <Stripes frame={frame} color={COLORS.white} ground={w.ground} opacity={0.1} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 40px" }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: w.t.length > 7 ? 140 : 210, letterSpacing: -5, lineHeight: 0.95, color: COLORS.white, textShadow: `10px 10px 0 ${COLORS.ink}`, textAlign: "center", transform: `scale(${punch}) rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` }}>
          {w.t}
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.white, opacity: 0.6 }}>VERVEQ</div>
      {/* beat dots — a tiny metronome so the eye feels the grid */}
      <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {WORDS.map((_, k) => (
          <div key={k} style={{ width: 22, height: 22, borderRadius: 999, background: COLORS.white, border: `3px solid ${COLORS.ink}`, opacity: k <= i ? 1 : 0.3 }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ SAME — the point
const Same: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 0, 14, 9);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.orange} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.6} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 190, lineHeight: 0.9, letterSpacing: -5, color: COLORS.cream }}>SAME<br />ARGUMENT.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1080, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scaleX(${wipe(frame, fps, 36, 12)})` }}>
        <div style={{ background: COLORS.yellow, border: `6px solid ${COLORS.cream}`, boxShadow: `10px 10px 0 ${COLORS.cream}`, padding: "20px 44px", transform: "rotate(-2deg)" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, letterSpacing: -1, color: COLORS.ink }}>WHO ACTUALLY KNOWS BALL?</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ STROBE — five modes, one per beat
const MODES = [
  { t: "QUIZ", ground: COLORS.orange, fg: COLORS.white },
  { t: "SURVIVAL", ground: COLORS.pink, fg: COLORS.white },
  { t: "CAREER PATH", ground: COLORS.blue, fg: COLORS.white },
  { t: "BLITZ", ground: COLORS.yellow, fg: COLORS.ink },
  { t: "ARENA", ground: COLORS.green, fg: COLORS.white },
];

const Strobe: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const i = Math.min(MODES.length - 1, Math.floor(frame / BEAT));
  const m = MODES[i];
  const local = frame - i * BEAT;
  const punch = interpolate(local, [0, 4], [1.22, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={m.ground}>
        <Stripes frame={frame} color={m.fg} ground={m.ground} opacity={0.09} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, color: m.fg, opacity: 0.8 }}>{`0${i + 1} / 05`}</div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: m.t.length > 8 ? 130 : 190, letterSpacing: -4, color: m.fg, textShadow: `9px 9px 0 ${COLORS.ink}`, transform: `scale(${punch}) rotate(${i % 2 === 0 ? -1 : 1}deg)`, whiteSpace: "nowrap" }}>
          {m.t}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ DEADPAN — the pattern interrupt
const Deadpan: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const on = interpolate(frame, [6, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorOn = frame % 24 < 14;
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: on }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 54, color: COLORS.ink }}>
          there's a website for this now.
          <span style={{ opacity: cursorOn ? 1 : 0, fontWeight: 700 }}>|</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 26, 14);
  const btn = spr(frame, fps, 36, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} from={1.7} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 200, letterSpacing: -6, color: COLORS.cream }}>VERVEQ</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={14} from={1.5} rot={-2} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -3, color: COLORS.lime, textShadow: `7px 7px 0 ${COLORS.ink}`, marginTop: 8 }}>TALK IS CHEAP.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.lime, marginTop: 24, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 58, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 500, fontSize: 40, color: COLORS.cream, opacity: 0.85 }}>Football trivia · free · no sign-up</div>
      </div>
    </AbsoluteFill>
  );
};

export const ANTHEM_SCENES: Record<AKey, React.FC<SceneProps>> = {
  chant: Chant,
  same: Same,
  strobe: Strobe,
  deadpan: Deadpan,
  cta: Cta,
};
