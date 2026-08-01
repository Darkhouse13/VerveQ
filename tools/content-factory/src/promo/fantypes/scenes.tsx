import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { FKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ============================================================ HOOK
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" });
  const dots = [COLORS.orange, COLORS.pink, COLORS.blue, COLORS.green, COLORS.red];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      {/* readable on frame 0 */}
      <div style={{ position: "absolute", top: 560, left: 72, right: 72, transform: `scale(${settle})` }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, lineHeight: 0.98, letterSpacing: -2, color: COLORS.ink }}>THE 5 TYPES OF</div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 148, lineHeight: 0.95, letterSpacing: -4, color: COLORS.ink, textShadow: `7px 7px 0 ${COLORS.orange}` }}>FOOTBALL FANS.</div>
      </div>
      <Pop delay={22} style={{ position: "absolute", top: 950, left: 72 }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, padding: "14px 32px", transform: "rotate(-2deg)", boxShadow: neoShadow(8) }}>
          A SCIENTIFIC CLASSIFICATION.
        </div>
      </Pop>
      {/* the five specimens, teased */}
      <div style={{ position: "absolute", top: 1180, left: 72, display: "flex", gap: 24 }}>
        {dots.map((c, i) => (
          <Pop key={i} delay={30 + i * 6} from={0.2}>
            <div style={{ width: 92, height: 92, borderRadius: "50%", background: c, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(6), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 38, color: COLORS.white }}>{i + 1}</div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.ink, opacity: 0.4 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ---- shared type card ---------------------------------------------------------
const TypeCard: React.FC<{
  dur: number;
  num: number;
  name: string;
  roast: string;
  ground: string;
  accent: string;
  accentFg: string;
  fg: string;
  dir: number;
  villain?: boolean;
}> = ({ dur, num, name, roast, ground, accent, accentFg, fg, dir, villain }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const enter = spr(frame, fps, 0, 13, 15);
  const x = (1 - enter) * 900 * dir;
  const sh = villain ? shake(frame, 0, 16, 10) : { x: 0, y: 0 };
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={ground}>
        <Stripes frame={frame} color={fg} ground={ground} opacity={0.08} />
      </Ground>
      {/* giant ghost number */}
      <div style={{ position: "absolute", right: -80, top: 120, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 900, lineHeight: 1, color: fg, opacity: 0.14, transform: `translateX(${x * 0.4}px)` }}>{num}</div>
      <div style={{ position: "absolute", top: 100, left: 72 }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, padding: "12px 26px", transform: "rotate(-1.5deg)" }}>
          {`SPECIMEN 0${num} / 05`}
        </div>
      </div>
      <div style={{ position: "absolute", top: 620, left: 72, right: 72, transform: `translateX(${x}px)` }}>
        <div style={{ display: "inline-block", background: accent, border: `6px solid ${villain ? COLORS.cream : COLORS.ink}`, boxShadow: villain ? `12px 12px 0 ${COLORS.cream}` : neoShadow(14), padding: "16px 36px", transform: "rotate(-1.5deg)" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: name.length > 16 ? 76 : 104, letterSpacing: -2, lineHeight: 1.02, color: accentFg }}>{name}</div>
        </div>
        <Pop delay={12} from={0.6} style={{ marginTop: 44 }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 58, color: fg }}>{roast}</div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

const T1: React.FC<SceneProps> = ({ dur }) => (
  <TypeCard dur={dur} num={1} name="THE STATS NERD" roast="Quotes xG in the pub." ground={COLORS.orange} accent={COLORS.ink} accentFg={COLORS.cream} fg={COLORS.white} dir={-1} />
);
const T2: React.FC<SceneProps> = ({ dur }) => (
  <TypeCard dur={dur} num={2} name="THE GLORY HUNTER" roast="New badge every May." ground={COLORS.pink} accent={COLORS.ink} accentFg={COLORS.cream} fg={COLORS.white} dir={1} />
);
const T3: React.FC<SceneProps> = ({ dur }) => (
  <TypeCard dur={dur} num={3} name={"THE 'KNEW HIM FIRST' GUY"} roast="Scouted Messi. Apparently." ground={COLORS.blue} accent={COLORS.ink} accentFg={COLORS.cream} fg={COLORS.white} dir={-1} />
);
const T4: React.FC<SceneProps> = ({ dur }) => (
  <TypeCard dur={dur} num={4} name="THE ONE-CLUB MARTYR" roast="Suffering since 2004." ground={COLORS.green} accent={COLORS.ink} accentFg={COLORS.cream} fg={COLORS.white} dir={1} />
);
const T5: React.FC<SceneProps> = ({ dur }) => (
  <TypeCard dur={dur} num={5} name="THE ALL TALK" roast="Loudest voice. Zero receipts." ground={COLORS.ink} accent={COLORS.red} accentFg={COLORS.white} fg={COLORS.cream} dir={-1} villain />
);

// ============================================================ VERDICT
const Verdict: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.pink} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 122, lineHeight: 0.96, letterSpacing: -3, color: COLORS.ink }}>EVERY CHAT<br />HAS ALL FIVE.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1000, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scaleX(${wipe(frame, fps, 30, 12)})` }}>
        <div style={{ background: COLORS.lime, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(10), padding: "20px 42px", transform: "rotate(-2deg)" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, color: COLORS.ink }}>ONE QUIZ EXPOSES EVERYONE.</div>
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
  const bar = wipe(frame, fps, 28, 14);
  const btn = spr(frame, fps, 36, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.yellow} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 176, lineHeight: 0.92, letterSpacing: -5, color: COLORS.ink, textAlign: "center" }}>WHICH ONE<br />ARE YOU?</div>
        </Slam>
        <div style={{ width: 680, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.blue, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.ink}`, borderRadius: 18, boxShadow: neoShadow(10) }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, color: COLORS.ink }}>Tag the other four.</div>
        <div style={{ marginTop: 20, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2, color: COLORS.ink, opacity: 0.7 }}>FREE · NO SIGN-UP</div>
      </div>
    </AbsoluteFill>
  );
};

export const FANTYPES_SCENES: Record<FKey, React.FC<SceneProps>> = {
  hook: Hook,
  t1: T1,
  t2: T2,
  t3: T3,
  t4: T4,
  t5: T5,
  verdict: Verdict,
  cta: Cta,
};
