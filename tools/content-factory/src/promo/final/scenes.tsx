import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { FKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ============================================================ DATE — the fixture card
const DateScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  // frame-0 readable: the date is already on screen, settling
  const settle = interpolate(frame, [0, 5], [1.05, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.green}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.green} opacity={0.09} />
      </Ground>
      <div style={{ position: "absolute", top: 430, left: 72, right: 72, transform: `scale(${settle})` }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, padding: "14px 32px" }}>
          ⚽ WORLD CUP FINAL
        </div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 190, lineHeight: 0.95, letterSpacing: -5, color: COLORS.white, textShadow: `9px 9px 0 ${COLORS.ink}`, marginTop: 36 }}>
          JULY 19.
        </div>
      </div>
      <div style={{ position: "absolute", top: 1080, left: 72, right: 72, opacity: spr(frame, fps, 22, 13) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 52, lineHeight: 1.25, color: COLORS.white }}>
          One match left.<br />Every debate on the line.
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.white, opacity: 0.6 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ DEBATES — already started
const TAKES = [
  { t: "greatest final ever?", at: 16, rot: -2, bg: COLORS.card },
  { t: "he's still overrated", at: 30, rot: 1.5, bg: COLORS.card },
  { t: "2006 was better", at: 44, rot: -1, bg: COLORS.card },
  { t: "source? ratio.", at: 58, rot: 2, bg: COLORS.yellow },
];

const Debates: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.green} ground={COLORS.cream} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", top: 250, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} damping={12} rot={-1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, lineHeight: 0.97, letterSpacing: -3, color: COLORS.ink }}>
            THE ARGUMENTS<br />HAVE ALREADY<br />STARTED.
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 740, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 26 }}>
        {TAKES.map((b, i) => (
          <Pop key={b.t} delay={b.at} damping={12} from={0.6}>
            <div
              style={{
                alignSelf: i % 2 ? "flex-end" : "flex-start",
                display: "inline-block",
                maxWidth: 700,
                marginLeft: i % 2 ? 180 : 0,
                marginRight: i % 2 ? 0 : 180,
                background: b.bg,
                border: `5px solid ${COLORS.ink}`,
                borderRadius: 20,
                boxShadow: neoShadow(8),
                padding: "24px 34px",
                transform: `rotate(${b.rot}deg)`,
                fontFamily: FONTS.body,
                fontWeight: 700,
                fontSize: 44,
                color: COLORS.ink,
              }}
            >
              {b.t}
            </div>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ PREP — warm up
const Prep: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 32, 14, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.green} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.3} damping={12}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, lineHeight: 1.0, letterSpacing: -2, color: COLORS.cream }}>
            THE PLAYERS ARE<br />WARMING UP.
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 900, left: 72 }}>
        <Slam frame={frame} fps={fps} delay={32} from={1.5} damping={10} rot={-2}>
          <div style={{ display: "inline-block", background: COLORS.lime, border: `6px solid ${COLORS.ink}`, boxShadow: `10px 10px 0 ${COLORS.cream}`, padding: "18px 40px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 88, letterSpacing: -2, color: COLORS.ink }}>YOU SHOULD TOO.</div>
          </div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ DRILLS — matchday prep plan
const DRILLS = [
  { name: "DAILY QUIZ", reps: "10 reps", at: 16 },
  { name: "CAREER PATH", reps: "3 sets", at: 40 },
  { name: "SURVIVAL", reps: "to failure", at: 64 },
];

const Drills: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.yellow}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.yellow} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 240, left: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} damping={12} rot={-1.5}>
          <div style={{ display: "inline-block", background: COLORS.ink, boxShadow: neoShadow(10), padding: "14px 36px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, letterSpacing: -2, color: COLORS.cream }}>MATCHDAY PREP:</div>
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 32 }}>
        {DRILLS.map((d) => {
          const done = frame >= d.at + 12;
          return (
            <Pop key={d.name} delay={d.at} damping={13} from={0.65}>
              <div style={{ ...neo(COLORS.card, 9, 16), display: "flex", alignItems: "center", justifyContent: "space-between", padding: "30px 36px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                  <div style={{ width: 76, height: 76, flexShrink: 0, background: done ? COLORS.green : COLORS.cream, border: `5px solid ${COLORS.ink}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 48, color: COLORS.white }}>
                    {done ? "✓" : ""}
                  </div>
                  <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 58, letterSpacing: -1, color: COLORS.ink }}>{d.name}</div>
                </div>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, color: COLORS.ink, opacity: 0.7 }}>{d.reps}</div>
              </div>
            </Pop>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1240, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 78, 13) }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: COLORS.ink, opacity: 0.75 }}>NO EQUIPMENT NEEDED.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 30, 14);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.green} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 180, lineHeight: 0.92, letterSpacing: -5, color: COLORS.white, textShadow: `10px 10px 0 ${COLORS.ink}`, textAlign: "center" }}>BE MATCH<br />FIT.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.lime, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, padding: "28px 60px", border: `6px solid ${COLORS.white}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.ink}` }}>VERVEQ.COM/PLAY</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white }}>Free · no sign-up · kickoff July 19</div>
      </div>
    </AbsoluteFill>
  );
};

export const FINAL_SCENES: Record<FKey, React.FC<SceneProps>> = {
  date: DateScene,
  debates: Debates,
  prep: Prep,
  drills: Drills,
  cta: Cta,
};
