import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, spr, wipe, inOut, shake } from "../../promo/kit";
import { MKey, LINE } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number, tail = 6) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, tail) };
};

// ============================================================ GRIND — the pains, struck through
// A2: generic frame — "season-long fantasy" — never a competitor's name in
// rendered evergreen video. Each pain gets a lime strike-through at local f10.
const PAINS = ["THE GRIND.", "THE TRANSFER MATH.", "THE CHIPS.", "THE PRICE CASINO."];

const Grind: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const i = Math.min(PAINS.length - 1, Math.floor(frame / LINE));
  const local = frame - i * LINE;
  const strike = interpolate(local, [10, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Chant-style punch, never a fade-in: the first pain is READABLE ON FRAME 0
  // with motion already underway — batch 1's retention law.
  const punch = interpolate(local, [0, 4], [1.16, 1], { extrapolateRight: "clamp" });
  const sh = shake(frame, i * LINE, 8, 5);
  const long = PAINS[i].length > 12;
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", top: 320, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: COLORS.cream, opacity: 0.55 }}>
        SEASON-LONG FANTASY
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 48px" }}>
        <div style={{ transform: `scale(${punch}) rotate(${i % 2 === 0 ? -1.2 : 1.2}deg)` }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: long ? 108 : 150, letterSpacing: -3, lineHeight: 0.95, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}`, textAlign: "center" }}>
              {PAINS[i]}
            </div>
            {/* the strike — deletion, foreshadowed */}
            <div style={{ position: "absolute", left: "-4%", right: "-4%", top: "44%", height: 20, background: COLORS.lime, boxShadow: `5px 5px 0 ${COLORS.ink}`, transform: `scaleX(${strike}) rotate(-2deg)`, transformOrigin: "left center" }} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {PAINS.map((_, k) => (
          <div key={k} style={{ width: 20, height: 20, borderRadius: 999, background: COLORS.lime, border: `3px solid ${COLORS.cream}`, opacity: k <= i ? 1 : 0.25 }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ FLIP — WE DELETED / THE LOT.
const Flip: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const second = frame >= LINE;
  const sh = shake(frame, second ? LINE : 0, 14, 8);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Slam frame={frame} fps={fps} from={1.5} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 132, letterSpacing: -4, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>WE DELETED</div>
        </Slam>
        {second && (
          <Slam frame={frame - LINE} fps={fps} from={1.8} damping={9} rot={-2}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 210, letterSpacing: -6, color: COLORS.lime, textShadow: `12px 12px 0 ${COLORS.ink}` }}>THE LOT.</div>
          </Slam>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CREED — the title beat
const Creed: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const second = frame >= LINE * 1.5; // 42f
  const sh = shake(frame, second ? LINE * 1.5 : 0, 15, 9);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: "0 48px" }}>
        <Slam frame={frame} fps={fps} from={1.5} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 128, letterSpacing: -4, lineHeight: 0.95, color: COLORS.cream, textAlign: "center" }}>
            IT'S NOT<br />A SEASON.
          </div>
        </Slam>
        {second && (
          <Slam frame={frame - LINE * 1.5} fps={fps} from={1.8} damping={8} rot={-2}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 158, letterSpacing: -5, lineHeight: 0.95, color: COLORS.lime, textShadow: `11px 11px 0 ${COLORS.ink}`, textAlign: "center" }}>
              IT'S A<br />WEEKEND.
            </div>
          </Slam>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ SHAPES — five locked mechanics
// Every line is a LOCKED spec shape. No constants — that's the CT-1 law.
const SHAPES = [
  { t: "FRESH SQUAD.\nEVERY WEEK.", bg: COLORS.lime, fg: COLORS.ink },
  { t: "FIVE LEAGUES.\nONE SQUAD.", bg: COLORS.cream, fg: COLORS.ink },
  { t: "THE CROWD IS\nTHE REFEREE.", bg: COLORS.lime, fg: COLORS.ink },
  { t: "THE BENCH IS\nA REAL ROLE.", bg: COLORS.cream, fg: COLORS.ink },
  { t: "DRAFT WITH\nYOUR CREW.", bg: COLORS.lime, fg: COLORS.ink },
];

const Shapes: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const i = Math.min(SHAPES.length - 1, Math.floor(frame / LINE));
  const s = SHAPES[i];
  const local = frame - i * LINE;
  const sh = shake(frame, i * LINE, 7, 5);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, color: COLORS.cream, opacity: 0.7 }}>{`0${i + 1} / 05`}</div>
        <Slam frame={local} fps={fps} from={1.45} damping={10} rot={i % 2 === 0 ? -1.5 : 1.5}>
          <div style={{ background: s.bg, color: s.fg, border: `6px solid ${COLORS.ink}`, borderRadius: 20, boxShadow: `12px 12px 0 ${i % 2 === 0 ? COLORS.cream : COLORS.lime}`, padding: "52px 64px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -3, lineHeight: 1.0, textAlign: "center", whiteSpace: "pre-line" }}>{s.t}</div>
          </div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ DEADPAN — the silent interrupt
// House pattern (Anthem): the music cuts to TRUE silence on a quiet frame.
// Here the quiet line is the campaign's whole job.
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
          the waitlist is open.
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
  const bar = wipe(frame, fps, 30, 12);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} from={1.6} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: 9, color: COLORS.cream, textAlign: "center" }}>THE</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 196, letterSpacing: -6, lineHeight: 0.9, color: COLORS.lime, textShadow: `12px 12px 0 ${COLORS.ink}`, textAlign: "center" }}>WEEKEND</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={18} from={1.4} damping={11}>
          <div style={{ marginTop: 34 }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={36} rot={-1.5}>LATE AUGUST</Pill>
          </div>
        </Slam>
        <div style={{ width: 620, height: 22, background: COLORS.lime, marginTop: 30, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 52, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 70, letterSpacing: -1, padding: "28px 62px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 42, fontFamily: FONTS.body, fontWeight: 500, fontSize: 38, color: COLORS.cream, opacity: 0.85 }}>Free · join the waitlist</div>
      </div>
    </AbsoluteFill>
  );
};

export const MANIFESTO_SCENES: Record<MKey, React.FC<SceneProps>> = {
  grind: Grind,
  flip: Flip,
  creed: Creed,
  shapes: Shapes,
  deadpan: Deadpan,
  cta: Cta,
};
