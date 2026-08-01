import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Pill, Slam, Pop, Ground, Stripes, spr, wipe, inOut, W } from "../kit";
import { QKey } from "./timeline";

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
  const q = spr(frame, fps, 6, 10, 22);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.blue}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.blue} opacity={0.12} />
      </Ground>
      {/* giant ? motif */}
      <div style={{ position: "absolute", right: -60, top: 380, fontFamily: FONTS.head, fontWeight: 700, fontSize: 1100, color: COLORS.white, opacity: 0.12, transform: `scale(${0.7 + q * 0.3})` }}>?</div>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 108, lineHeight: 0.98, letterSpacing: -2, color: COLORS.white }}>HOW GOOD<br />ARE YOU</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={16} from={1.7} rot={2} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 220, letterSpacing: -6, color: COLORS.yellow, textShadow: `8px 8px 0 ${COLORS.ink}`, marginTop: 6 }}>REALLY?</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.white, opacity: 0.6 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ---- shared timed question card ---------------------------------------------
const QuestionCard: React.FC<{
  dur: number;
  qLabel: string;
  ground: string;
  onGroundFg: string;
  accent: string;
  question: string;
  options: string[];
  correct: number;
  revealAt: number;
}> = ({ dur, qLabel, ground, onGroundFg, accent, question, options, correct, revealAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const revealed = frame >= revealAt;
  const count = Math.max(1, Math.min(3, Math.ceil((revealAt - frame) / 18)));
  const barW = interpolate(frame, [4, revealAt], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const letters = ["A", "B", "C", "D"];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={ground}>
        <Stripes frame={frame} color={onGroundFg} ground={ground} opacity={0.07} />
      </Ground>
      {/* top row: Q label + timer */}
      <div style={{ position: "absolute", top: 80, left: 72, right: 72, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Pill bg={COLORS.ink} fg={COLORS.cream} size={32} rot={-2}>{qLabel}</Pill>
        <div style={{ ...neo(revealed ? COLORS.lime : COLORS.white, 6, 999), width: 110, height: 110, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, color: COLORS.ink }}>
          {revealed ? "✓" : count}
        </div>
      </div>
      {/* timer bar */}
      <div style={{ position: "absolute", top: 220, left: 72, right: 72, height: 18, background: "rgba(0,0,0,0.15)", border: `4px solid ${COLORS.ink}` }}>
        <div style={{ width: `${barW * 100}%`, height: "100%", background: revealed ? COLORS.lime : accent }} />
      </div>
      {/* question */}
      <div style={{ position: "absolute", top: 300, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.25} rot={-1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: question.length > 30 ? 74 : 90, lineHeight: 1.0, letterSpacing: -1, color: onGroundFg }}>{question}</div>
        </Slam>
      </div>
      {/* options 2x2 */}
      <div style={{ position: "absolute", top: 660, left: 72, right: 72, display: "flex", flexWrap: "wrap", gap: 24 }}>
        {options.map((o, i) => {
          const isRight = i === correct;
          const bg = revealed ? (isRight ? COLORS.lime : COLORS.card) : COLORS.card;
          const dim = revealed && !isRight ? 0.4 : 1;
          return (
            <Pop key={o} delay={8 + i * 4} from={0.7} style={{ width: "calc(50% - 12px)" }}>
              <div style={{ ...neo(bg, 8, 14), height: 180, display: "flex", alignItems: "center", gap: 22, paddingLeft: 24, paddingRight: 20, opacity: dim }}>
                <div style={{ width: 78, height: 78, flexShrink: 0, borderRadius: 10, background: revealed && isRight ? COLORS.ink : accent, color: revealed && isRight ? COLORS.lime : COLORS.white, border: `3px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40 }}>
                  {revealed && isRight ? "✓" : letters[i]}
                </div>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: o.length > 12 ? 40 : 52, color: COLORS.ink, lineHeight: 1 }}>{o}</div>
              </div>
            </Pop>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Q1: React.FC<SceneProps> = ({ dur }) => (
  <QuestionCard dur={dur} qLabel="Q1 · EASY" ground={COLORS.yellow} onGroundFg={COLORS.ink} accent={COLORS.orange} question="Who won the 2014 World Cup?" options={["Brazil", "Germany", "Argentina", "Spain"]} correct={1} revealAt={82} />
);
const Q2: React.FC<SceneProps> = ({ dur }) => (
  <QuestionCard dur={dur} qLabel="Q2 · HARDER" ground={COLORS.pink} onGroundFg={COLORS.white} accent={COLORS.blue} question="Ronaldo's first senior club?" options={["Man Utd", "Sporting CP", "Benfica", "Real Madrid"]} correct={1} revealAt={64} />
);

// ============================================================ RAPID — overwhelm
const Rapid: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const frags = [
    { t: "BALLON D'OR 2006?", y: 300, speed: 15, delay: 0, c: COLORS.yellow },
    { t: "GOLDEN BOOT 2019?", y: 470, speed: -13, delay: 4, c: COLORS.lime },
    { t: "MOST UCL GOALS?", y: 640, speed: 17, delay: 8, c: COLORS.pink },
    { t: "2010 WC HOSTS?", y: 810, speed: -16, delay: 12, c: COLORS.blue },
    { t: "OFFSIDE RULE?", y: 980, speed: 14, delay: 16, c: COLORS.orange },
  ];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.red}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.red} opacity={0.1} />
      </Ground>
      {frags.map((f, i) => {
        const p = spr(frame, fps, f.delay, 16, 14);
        const drift = (frame - f.delay) * f.speed;
        return (
          <div key={i} style={{ position: "absolute", top: f.y, left: 0, right: 0, textAlign: "center", opacity: p * 0.9, transform: `translateX(${drift}px) rotate(${f.speed > 0 ? -2 : 2}deg)` }}>
            <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, color: f.c, whiteSpace: "nowrap", textShadow: `4px 4px 0 ${COLORS.ink}` }}>{f.t}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Slam frame={frame} fps={fps} from={1.5} rot={-2}>
          <div style={{ ...neo(COLORS.ink, 14, 18), padding: "24px 44px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, color: COLORS.cream, letterSpacing: -2 }}>STILL SURE?</div>
          </div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ STAT
const Stat: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const fill = spr(frame, fps, 14, 16, 20) * 0.4; // 4/10
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.red} ground={COLORS.ink} opacity={0.1} />
      </Ground>
      <div style={{ position: "absolute", top: 380, left: 72, right: 72, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.4}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, lineHeight: 1.0, letterSpacing: -2, color: COLORS.cream }}>MOST FANS GET</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={12} from={1.8} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 300, letterSpacing: -8, color: COLORS.red, textShadow: `8px 8px 0 ${COLORS.cream}` }}>4/10</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1120, left: 72, right: 72 }}>
        <div style={{ height: 60, background: "rgba(255,255,255,0.1)", border: `5px solid ${COLORS.cream}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ width: `${fill * 100}%`, height: "100%", background: COLORS.red }} />
        </div>
        <Pop delay={24}><div style={{ marginTop: 34, textAlign: "center", fontFamily: FONTS.body, fontWeight: 700, fontSize: 50, color: COLORS.cream }}>Can you beat the average?</div></Pop>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ MODES
const Modes: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const chips = [
    { t: "QUIZ", c: COLORS.orange },
    { t: "DAILY", c: COLORS.blue },
    { t: "SURVIVAL", c: COLORS.pink },
    { t: "BLITZ", c: COLORS.yellow },
  ];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.lime}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.lime} opacity={0.09} />
      </Ground>
      <div style={{ position: "absolute", top: 300, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 100, lineHeight: 0.98, letterSpacing: -2, color: COLORS.ink }}>PROVE YOU'RE<br />NOT MOST FANS.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 640, left: 72, right: 72, display: "flex", flexWrap: "wrap", gap: 24 }}>
        {chips.map((c, i) => (
          <Pop key={c.t} delay={8 + i * 5} from={0.5} style={{ width: "calc(50% - 12px)" }}>
            <div style={{ ...neo(c.c, 10, 16), height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, color: c.c === COLORS.yellow ? COLORS.ink : COLORS.white }}>{c.t}</div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1080, left: 72, right: 72, textAlign: "center" }}>
        <Pop delay={30}><div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 44, letterSpacing: 2, color: COLORS.ink }}>A NEW QUIZ EVERY DAY</div></Pop>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 22, 14);
  const btn = spr(frame, fps, 28, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.orange} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.yellow, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 70, letterSpacing: -1, color: COLORS.white, opacity: spr(frame, fps, 4, 14), textAlign: "center" }}>HOW GOOD ARE YOU REALLY?</div>
        <Slam frame={frame} fps={fps} delay={20} from={1.7} damping={9} rot={-2}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 230, letterSpacing: -6, color: COLORS.ink, marginTop: 16 }}>FIND OUT.</div>
        </Slam>
        <div style={{ width: 640, height: 24, background: COLORS.ink, marginTop: 12, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 56, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, letterSpacing: -1, padding: "30px 70px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white }}>Free · no sign-up.</div>
      </div>
    </AbsoluteFill>
  );
};

export const QUIZTEASE_SCENES: Record<QKey, React.FC<SceneProps>> = {
  hook: Hook,
  q1: Q1,
  q2: Q2,
  rapid: Rapid,
  stat: Stat,
  modes: Modes,
  cta: Cta,
};
