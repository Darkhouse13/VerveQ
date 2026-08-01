import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, Slam, Pop, Ground, Stripes, spr, wipe, inOut, countTo, shake } from "../kit";
import { WKey, BEAT } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// deterministic confetti — accent shapes popping on the beat
const CONFETTI = [
  { x: 120, y: 300, c: COLORS.yellow, r: 0, at: -8 }, // pre-popped: frame 0 already has life
  { x: 880, y: 380, c: COLORS.lime, r: 18, at: -4 },
  { x: 200, y: 1500, c: COLORS.blue, r: -12, at: 22 },
  { x: 860, y: 1420, c: COLORS.orange, r: 24, at: 33 },
  { x: 520, y: 240, c: COLORS.white, r: -20, at: 44 },
  { x: 140, y: 900, c: COLORS.white, r: 10, at: 55 },
];

const Confetti: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {CONFETTI.map((k, i) => {
        const s = spr(frame, fps, k.at, 11, 14);
        return (
          <div key={i} style={{ position: "absolute", left: k.x, top: k.y, width: 64, height: 64, background: k.c, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(6), transform: `rotate(${k.r + (1 - s) * 90}deg) scale(${s})`, borderRadius: i % 2 === 0 ? 999 : 10 }} />
        );
      })}
    </>
  );
};

// ============================================================ INTRO
const Intro: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 5], [1.05, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.pink}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.pink} opacity={0.1} />
      </Ground>
      <Confetti />
      {/* readable on frame 0 */}
      <div style={{ position: "absolute", top: 620, left: 72, right: 72, textAlign: "center", transform: `scale(${settle})` }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, padding: "14px 32px", transform: "rotate(-2deg)" }}>
          YOUR SEASON IN FOOTBALL ARGUMENTS
        </div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 186, letterSpacing: -6, color: COLORS.white, textShadow: `10px 10px 0 ${COLORS.ink}`, marginTop: 34 }}>
          WRAPPED.
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.white, opacity: 0.6 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ---- shared stat card ---------------------------------------------------------
const StatCard: React.FC<{
  dur: number;
  index: number;
  ground: string;
  fg: string;
  label: string;
  children: React.ReactNode; // the big value
  sub?: React.ReactNode;
  subAt?: number;
}> = ({ dur, index, ground, fg, label, children, sub, subAt = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={ground}>
        <Stripes frame={frame} color={fg} ground={ground} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 90, left: 72, right: 72, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, padding: "12px 26px", transform: "rotate(-1.5deg)" }}>
          {`STAT 0${index} / 03`}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: fg, opacity: 0.6 }}>VERVEQ</div>
      </div>
      <div style={{ position: "absolute", top: 430, left: 72, right: 72, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.3} rot={-1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 88, letterSpacing: -1, lineHeight: 1, color: fg }}>{label}</div>
        </Slam>
        <div style={{ marginTop: 40 }}>{children}</div>
        {sub ? (
          <Pop delay={subAt} from={0.5} style={{ marginTop: 44 }}>
            {sub}
          </Pop>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const BigNumber: React.FC<{ children: React.ReactNode; color: string; shadow: string }> = ({ children, color, shadow }) => (
  <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 330, letterSpacing: -10, lineHeight: 0.9, color, textShadow: `12px 12px 0 ${shadow}` }}>{children}</div>
);

// ============================================================ STAT 1 — started
const Stat1: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  return (
    <StatCard dur={dur} index={1} ground={COLORS.orange} fg={COLORS.white} label="ARGUMENTS STARTED" sub={<div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.white }}>A new personal best.</div>} subAt={34}>
      <BigNumber color={COLORS.white} shadow={COLORS.ink}>{countTo(frame, 4, 32, 0, 147)}</BigNumber>
    </StatCard>
  );
};

// ============================================================ STAT 2 — won (the gag)
const Stat2: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wobble = spr(frame, fps, 10, 7, 20);
  return (
    <StatCard
      dur={dur}
      index={2}
      ground={COLORS.blue}
      fg={COLORS.white}
      label="ARGUMENTS WON"
      sub={
        <div style={{ display: "inline-block", background: COLORS.yellow, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(8), padding: "14px 30px", transform: "rotate(-2deg)", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, color: COLORS.ink }}>
          (SELF-REPORTED: 147)
        </div>
      }
      subAt={28}
    >
      <div style={{ transform: `scale(${0.4 + wobble * 0.6}) rotate(${(1 - wobble) * -14}deg)`, opacity: Math.min(1, wobble * 2) }}>
        <BigNumber color={COLORS.white} shadow={COLORS.ink}>0</BigNumber>
      </div>
    </StatCard>
  );
};

// ============================================================ STAT 3 — hours
const Stat3: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  return (
    <StatCard dur={dur} index={3} ground={COLORS.yellow} fg={COLORS.ink} label="HOURS SPENT ARGUING" sub={<div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.ink }}>That's 13 full days.</div>} subAt={34}>
      <BigNumber color={COLORS.ink} shadow={COLORS.white}>{countTo(frame, 4, 32, 0, 312)}</BigNumber>
    </StatCard>
  );
};

// ============================================================ TURN — new stat
const Turn: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 26, 16, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 100, letterSpacing: -2, color: COLORS.cream }}>NEW SEASON.</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={12} from={1.4} rot={1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 100, letterSpacing: -2, color: COLORS.cream, opacity: 0.85, marginTop: 6 }}>NEW STAT:</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={26} from={1.8} damping={8} rot={-2}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 260, letterSpacing: -8, color: COLORS.lime, textShadow: `11px 11px 0 ${COLORS.cream}`, marginTop: 24 }}>PROOF.</div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 28, 14);
  const btn = spr(frame, fps, 36, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.green} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.6} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 152, lineHeight: 0.92, letterSpacing: -4, color: COLORS.white, textShadow: `9px 9px 0 ${COLORS.ink}`, textAlign: "center" }}>CHANGE<br />YOUR STATS.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white }}>Free · no sign-up · your real numbers start today</div>
      </div>
    </AbsoluteFill>
  );
};

export const WRAPPED_SCENES: Record<WKey, React.FC<SceneProps>> = {
  intro: Intro,
  stat1: Stat1,
  stat2: Stat2,
  stat3: Stat3,
  turn: Turn,
  cta: Cta,
};
