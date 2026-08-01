import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, spr, wipe, inOut, shake } from "../kit";
import { HKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// slow candle-flicker — small amplitude, long period (photosensitivity-safe:
// well under 2 events/sec and never a full luminance swing)
const useFlicker = (period = 17, depth = 0.07) => {
  const frame = useCurrentFrame();
  return 1 - depth * (0.5 + 0.5 * Math.sin((frame / period) * Math.PI * 2));
};

// soft vignette so the ink grounds read "film", not "app"
const Vignette: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 340px 60px rgba(0,0,0,0.75)" }} />
);

// typewriter, per-file idiom (same as breaking/license)
const Type: React.FC<{ text: string; start: number; cps?: number; style?: React.CSSProperties }> = ({ text, start, cps = 1.1, style }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor((frame - start) * cps));
  return <span style={style}>{text.slice(0, n)}</span>;
};

// ============================================================ COLD OPEN
const Cold: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const flick = useFlicker();
  const settle = interpolate(frame, [0, 6], [1.03, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink} />
      <Vignette />
      {/* frame-0 readable: the trailer card is already up, breathing */}
      <div style={{ position: "absolute", top: 560, left: 72, right: 72, transform: `scale(${settle})`, opacity: flick }}>
        <div style={{ display: "inline-block", border: `4px solid ${COLORS.cream}`, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 32, letterSpacing: 8, padding: "12px 30px", opacity: 0.85 }}>
          THIS SUMMER
        </div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 128, lineHeight: 1.0, letterSpacing: -3, color: COLORS.cream, marginTop: 44 }}>
          EVERY FAN<br />HAS A FEAR.
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.4 }}>VERVEQ PICTURES</div>
    </AbsoluteFill>
  );
};

// ============================================================ DENIAL
const Denial: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const flick = useFlicker(19, 0.06);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink} />
      <Vignette />
      <div style={{ position: "absolute", top: 700, left: 100, right: 72, opacity: flick, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 54, lineHeight: 2.0, color: COLORS.cream }}>
        <div>
          <Type text="it's not relegation." start={6} />
        </div>
        <div style={{ opacity: 0.9 }}>
          <Type text="it's not penalties." start={40} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ REVEAL — PROVE IT.
const Reveal: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 24, 22, 12);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink} />
      <Vignette />
      <div style={{ position: "absolute", top: 520, left: 72, right: 72 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 44, letterSpacing: 3, color: COLORS.cream, opacity: interpolate(frame, [0, 6], [0, 0.85], { extrapolateRight: "clamp" }) }}>
          it's two words.
        </div>
        <Slam frame={frame} fps={fps} delay={24} from={2.0} damping={8}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 210, lineHeight: 0.92, letterSpacing: -6, color: COLORS.red, textShadow: `10px 10px 0 ${COLORS.ink}`, marginTop: 60, WebkitTextStroke: `3px ${COLORS.cream}` }}>
            "PROVE<br />IT."
          </div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ POSTER
const Poster: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const flick = useFlicker(21, 0.05);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink} />
      <Vignette />
      <div style={{ position: "absolute", top: 380, left: 100, right: 100, opacity: flick }}>
        <div style={{ border: `6px solid ${COLORS.red}`, background: COLORS.ink, boxShadow: `14px 14px 0 rgba(255,60,56,0.35)`, padding: "60px 48px", textAlign: "center", transform: `scale(${0.85 + spr(frame, fps, 4, 13, 20) * 0.15})` }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: COLORS.cream, opacity: 0.7 }}>A VERVEQ PICTURE</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, lineHeight: 0.96, letterSpacing: -3, color: COLORS.red, marginTop: 36 }}>
            THE<br />SCOREBOARD
          </div>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 44, color: COLORS.cream, marginTop: 36, opacity: spr(frame, fps, 26, 13) }}>
            It knows what you don't.
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2, color: COLORS.cream, opacity: 0.6 * spr(frame, fps, 44, 13), marginTop: 44 }}>
            STARRING DAVE (2/10) · RATED A: ALL TALK
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA — the genre flip
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 30, 14);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.yellow} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 170, lineHeight: 0.92, letterSpacing: -5, color: COLORS.ink, textShadow: `10px 10px 0 ${COLORS.white}`, textAlign: "center" }}>FACE<br />YOUR FEAR.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.yellow, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, padding: "28px 60px", border: `6px solid ${COLORS.white}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.ink}` }}>VERVEQ.COM/PLAY</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.ink }}>Free · no sign-up · survivors post screenshots</div>
      </div>
    </AbsoluteFill>
  );
};

export const HORROR_SCENES: Record<HKey, React.FC<SceneProps>> = {
  cold: Cold,
  denial: Denial,
  reveal: Reveal,
  poster: Poster,
  cta: Cta,
};
