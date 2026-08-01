import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Pill, Slam, Pop, Ground, Stripes, spr, wipe, inOut, countTo, shake } from "../kit";
import { RKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// the story's connective tissue — a DAY chip in the same spot every scene
const DayChip: React.FC<{ label: string; accent?: string }> = ({ label, accent = COLORS.pink }) => (
  <div style={{ position: "absolute", top: 110, left: 72 }}>
    <div style={{ display: "inline-block", background: accent, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 3, padding: "16px 34px", border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(8), transform: "rotate(-2deg)" }}>
      {label}
    </div>
  </div>
);

// ============================================================ LOSS — day 1
const Loss: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" });
  const sh = shake(frame, 0, 12, 8);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.pink} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <DayChip label="DAY 1" />
      {/* readable on frame 0 — the confession is the hook */}
      <div style={{ position: "absolute", top: 560, left: 72, right: 72, transform: `scale(${settle})` }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 170, lineHeight: 0.95, letterSpacing: -5, color: COLORS.cream }}>I LOST<br />9–4.</div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -2, color: COLORS.pink, marginTop: 26 }}>TO DAVE.</div>
      </div>
      <Pop delay={38} style={{ position: "absolute", top: 1240, left: 72, right: 72 }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 52, color: COLORS.cream, opacity: 0.9 }}>He hasn't shut up since.</div>
      </Pop>
      <div style={{ position: "absolute", top: 60, right: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.5 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ GRIND — the reps
const REPS = [
  { day: "DAY 4", score: "5/10", at: 16 },
  { day: "DAY 11", score: "7/10", at: 28 },
  { day: "DAY 19", score: "8/10", at: 40 },
  { day: "DAY 26", score: "9/10", at: 52 },
];

const Grind: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const streak = countTo(frame, 16, 70, 1, 28);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      <DayChip label="DAY 2 – 29" accent={COLORS.blue} />
      <div style={{ position: "absolute", top: 300, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 112, lineHeight: 0.97, letterSpacing: -3, color: COLORS.ink }}>SO I PUT<br />THE REPS IN.</div>
        </Slam>
      </div>
      {/* the daily-quiz training log */}
      <div style={{ position: "absolute", top: 700, left: 72, right: 72, display: "flex", flexWrap: "wrap", gap: 26 }}>
        {REPS.map((r, i) => (
          <Pop key={r.day} delay={r.at} from={0.55} style={{ width: "calc(50% - 13px)" }}>
            <div style={{ ...neo(COLORS.card, 8, 14), padding: "26px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 32, letterSpacing: 2, color: COLORS.ink, opacity: 0.65 }}>{r.day}</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 56, color: i === REPS.length - 1 ? COLORS.green : COLORS.ink }}>{r.score}</div>
            </div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1210, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 58, 13) }}>
        <div style={{ display: "inline-block", background: COLORS.orange, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, padding: "18px 44px", border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(9), transform: "rotate(-2deg)" }}>
          {`STREAK ×${streak}`}
        </div>
      </div>
      <div style={{ position: "absolute", top: 1350, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 64, 13) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 44, color: COLORS.ink, opacity: 0.8 }}>One quiz a day. Every day.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CALLOUT — day 30
const Callout: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.blue}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.blue} opacity={0.1} />
      </Ground>
      <DayChip label="DAY 30" accent={COLORS.ink} />
      <div style={{ position: "absolute", top: 560, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.5} damping={10} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 148, lineHeight: 0.94, letterSpacing: -4, color: COLORS.white, textShadow: `8px 8px 0 ${COLORS.ink}` }}>REMATCH<br />REQUESTED.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1120, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 28, 12) }}>
        <Pill bg={COLORS.pink} fg={COLORS.white} size={54} rot={-2} style={{ padding: "22px 48px" }}>GET REVENGE →</Pill>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ REMATCH — the flip
const Rematch: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const you = countTo(frame, 10, 64, 0, 9);
  const dave = countTo(frame, 10, 64, 0, 4);
  const final = frame >= 72;
  const sh = shake(frame, 72, 16, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.pink} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", top: 130, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, padding: "14px 36px", transform: "rotate(-1.5deg)" }}>THE REMATCH</div>
      </div>
      {/* live vertical scoreboard — you pull away */}
      <div style={{ position: "absolute", top: 380, left: 72, right: 72, bottom: 420, display: "flex", gap: 30 }}>
        <div style={{ flex: 1, ...neo(COLORS.blue, 12, 18), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 3, color: COLORS.white, opacity: 0.85 }}>YOU</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 330, lineHeight: 0.9, color: COLORS.white }}>{you}</div>
        </div>
        <div style={{ flex: 1, ...neo(COLORS.card, 12, 18), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, opacity: 0.9 }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 3, color: COLORS.ink, opacity: 0.65 }}>DAVE</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 330, lineHeight: 0.9, color: COLORS.ink }}>{dave}</div>
        </div>
      </div>
      {final ? (
        <div style={{ position: "absolute", top: 900, left: 0, right: 0, display: "flex", justifyContent: "center", transform: "rotate(-8deg)" }}>
          <div style={{ background: COLORS.lime, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(12), padding: "18px 52px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 110, letterSpacing: -2, color: COLORS.ink }}>FINAL.</div>
        </div>
      ) : null}
      <div style={{ position: "absolute", bottom: 200, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 20, 13) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, color: COLORS.ink, opacity: 0.8 }}>Same questions. Both of you. No excuses.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ GLORY
const Glory: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 0, 18, 11);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40 }}>
        <Slam frame={frame} fps={fps} from={1.8} damping={8} rot={-2}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 216, letterSpacing: -6, color: COLORS.lime, textShadow: `10px 10px 0 ${COLORS.cream}` }}>REVENGE.</div>
        </Slam>
        <Pop delay={20}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 50, color: COLORS.cream, opacity: 0.9 }}>The chat went quiet.</div>
        </Pop>
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
      <Ground color={COLORS.blue} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 210, letterSpacing: -6, color: COLORS.white, textShadow: `10px 10px 0 ${COLORS.ink}` }}>YOUR TURN.</div>
        </Slam>
        <div style={{ width: 680, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white }}>Duels · send a link · rematch anytime · free</div>
      </div>
    </AbsoluteFill>
  );
};

export const REMATCH_SCENES: Record<RKey, React.FC<SceneProps>> = {
  loss: Loss,
  grind: Grind,
  callout: Callout,
  rematch: Rematch,
  glory: Glory,
  cta: Cta,
};
