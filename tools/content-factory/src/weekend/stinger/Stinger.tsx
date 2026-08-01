import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, spr, wipe, inOut, shake } from "../../promo/kit";
import { SKey, SCENES, START, BEAT } from "./timeline";

// THE WEEKEND campaign ident. Short enough that the scenes live in this one
// file — the manifesto is the piece with a scenes.tsx.
type SceneProps = { dur: number };

const useExit = (dur: number, tail = 6) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, tail) };
};

// ================================================== DRUM — a line per 2 beats
const LINES = [
  { t: "FIVE LEAGUES.", color: COLORS.lime },
  { t: "ONE SQUAD.", color: COLORS.cream },
];

const Drum: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const i = Math.min(LINES.length - 1, Math.floor(frame / (BEAT * 2)));
  const line = LINES[i];
  // Chant-style punch, never a fade-in: the line is READABLE ON FRAME 0 with
  // the motion already underway — batch 1's retention law.
  const local = frame - i * BEAT * 2;
  const punch = interpolate(local, [0, 4], [1.1, 1], { extrapolateRight: "clamp" });
  const sh = shake(frame, i * BEAT * 2, 9, 6);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>VERVEQ</div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 48px" }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 126, letterSpacing: -4, lineHeight: 0.95, color: line.color, textShadow: `9px 9px 0 ${COLORS.ink}`, textAlign: "center", transform: `scale(${punch}) rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` }}>
          {line.t}
        </div>
      </div>
      {/* two beat dots — the metronome the eye rides */}
      <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {LINES.map((_, k) => (
          <div key={k} style={{ width: 22, height: 22, borderRadius: 999, background: COLORS.lime, border: `3px solid ${COLORS.cream}`, opacity: k <= i ? 1 : 0.25 }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ================================================== LOCK — the wordmark
const Lock: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 0, 14, 9);
  const sub = spr(frame, fps, 28, 12, 16);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Slam frame={frame} fps={fps} from={1.35} damping={12}>
          <Pill bg={COLORS.lime} fg={COLORS.ink} size={30} rot={-2}>NEW MODE</Pill>
        </Slam>
        <Slam frame={frame} fps={fps} delay={8} from={1.7} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: 10, color: COLORS.cream, marginTop: 44, textAlign: "center" }}>THE</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 218, letterSpacing: -7, lineHeight: 0.9, color: COLORS.lime, textShadow: `12px 12px 0 ${COLORS.ink}`, textAlign: "center" }}>WEEKEND</div>
        </Slam>
        {/* live FW-P1 teaser copy, verbatim */}
        <div style={{ marginTop: 52, maxWidth: 760, textAlign: "center", transform: `scale(${0.7 + sub * 0.3})`, opacity: Math.min(1, sub * 2) }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 52, lineHeight: 1.15, color: COLORS.cream }}>
            Draft the whole European football weekend.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ================================================== DATE — late August, waitlist
const DateScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 0, 12, 8);
  const bar = wipe(frame, fps, 20, 12);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Slam frame={frame} fps={fps} from={1.6} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 176, letterSpacing: -5, lineHeight: 0.92, color: COLORS.cream, textShadow: `10px 10px 0 ${COLORS.ink}`, textAlign: "center" }}>
            LATE<br />AUGUST.
          </div>
        </Slam>
        <div style={{ width: 560, height: 20, background: COLORS.lime, marginTop: 34, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <Slam frame={frame} fps={fps} delay={26} from={1.4} damping={11}>
          <div style={{ marginTop: 48 }}>
            <Pill bg={COLORS.lime} fg={COLORS.ink} size={40} rot={1.5}>JOIN THE WAITLIST</Pill>
          </div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

// ================================================== CTA — button, then a still tail
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const btn = spr(frame, fps, 6, 11, 16);
  // still tail: every animated value clamps by ~f28 so the last half second is
  // a clean freeze — the loop/cut point.
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Slam frame={frame} fps={fps} from={1.5} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, letterSpacing: 6, color: COLORS.cream }}>THE WEEKEND</div>
        </Slam>
        <div style={{ marginTop: 54, transform: `scale(${0.6 + btn * 0.4})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 44, fontFamily: FONTS.body, fontWeight: 500, fontSize: 38, color: COLORS.cream, opacity: 0.85 }}>Free · waitlist open now</div>
      </div>
    </AbsoluteFill>
  );
};

const SCENE_MAP: Record<SKey, React.FC<SceneProps>> = {
  drum: Drum,
  lock: Lock,
  date: DateScene,
  cta: Cta,
};

export const Stinger: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wknd-stinger.wav")} />
    {SCENES.map((s) => {
      const Comp = SCENE_MAP[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
