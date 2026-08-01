import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Pill, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { BKey, BEAT } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ---- newsroom furniture -----------------------------------------------------
// typewriter reveal — the newsroom way for text to arrive
const Type: React.FC<{ text: string; start: number; cps?: number; style?: React.CSSProperties }> = ({ text, start, cps = 2.2, style }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor((frame - start) * cps));
  const done = n >= text.length;
  return (
    <div style={style}>
      {text.slice(0, n)}
      {!done && frame >= start ? <span style={{ opacity: frame % 10 < 5 ? 1 : 0 }}>▌</span> : null}
    </div>
  );
};

// the red BREAKING slab — pulses on the beat like a live bug
const BreakingBug: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.025 * Math.max(0, 1 - (frame % BEAT) / 5);
  return (
    <div style={{ display: "inline-block", background: COLORS.red, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(10), padding: "12px 34px", transform: `rotate(-1.5deg) scale(${pulse})` }}>
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: 2, color: COLORS.white }}>BREAKING</div>
    </div>
  );
};

const LiveBug: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...neo(COLORS.card, 6, 10), display: "flex", alignItems: "center", gap: 14, padding: "12px 24px" }}>
      <div style={{ width: 22, height: 22, borderRadius: 999, background: COLORS.red, opacity: frame % 16 < 9 ? 1 : 0.25 }} />
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: COLORS.ink }}>VQ · LIVE</div>
    </div>
  );
};

const Ticker: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const t = (text + " ··· ").repeat(4);
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 96, background: COLORS.ink, display: "flex", alignItems: "center", overflow: "hidden", whiteSpace: "nowrap", borderTop: `5px solid ${COLORS.ink}` }}>
      <div style={{ display: "inline-block", transform: `translateX(${-((frame * 6) % 2400)}px)`, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: COLORS.cream }}>{t}</div>
    </div>
  );
};

// ============================================================ ALERT — the chyron
const Alert: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 46, 14, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.red} ground={COLORS.cream} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", top: 130, left: 72 }}><BreakingBug /></div>
      <div style={{ position: "absolute", top: 140, right: 72 }}><LiveBug /></div>
      {/* headline types itself on — first word pre-typed so frame 0 already reads */}
      <div style={{ position: "absolute", top: 360, left: 72, right: 72 }}>
        <div style={{ ...neo(COLORS.ink, 12, 14), padding: "44px 46px" }}>
          <Type text="LOCAL MAN LOSES" start={-3} style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, lineHeight: 1.1, letterSpacing: -1, color: COLORS.cream, whiteSpace: "nowrap" }} />
          <Type text="SAME FOOTBALL" start={7} style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, lineHeight: 1.1, letterSpacing: -1, color: COLORS.cream, whiteSpace: "nowrap" }} />
          <Type text="ARGUMENT" start={14} style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, lineHeight: 1.1, letterSpacing: -1, color: COLORS.cream, whiteSpace: "nowrap" }} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 740, left: 72 }}>
        <Slam frame={frame} fps={fps} delay={46} from={1.6} damping={9} rot={-2}>
          <div style={{ display: "inline-block", background: COLORS.yellow, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(12), padding: "16px 38px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, letterSpacing: -2, color: COLORS.ink }}>FOR THE 47TH TIME.</div>
          </div>
        </Slam>
      </div>
      <Ticker text="DAVE STILL WRONG ··· 'HE'S NOT EVEN TOP 10' — MAN WITH ZERO EVIDENCE ··· GROUP CHAT ENTERS DAY 6 OF CRISIS" />
    </AbsoluteFill>
  );
};

// ============================================================ STATS — sources confirm
const Stats: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const chips: { label: string; value: string; c: string; fg: string; at: number }[] = [
    { label: "ARGUMENTS WON", value: "0", c: COLORS.red, fg: COLORS.white, at: 8 },
    { label: "SELF-RATING", value: "EXPERT", c: COLORS.yellow, fg: COLORS.ink, at: 20 },
    { label: "EVIDENCE", value: "NONE FOUND", c: COLORS.blue, fg: COLORS.white, at: 32 },
  ];
  // a jagged form-guide line crashing down behind the chips
  const dash = interpolate(frame, [6, 44], [1400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", top: 190, left: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ display: "inline-block", background: COLORS.ink, boxShadow: neoShadow(10), padding: "14px 34px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -1, color: COLORS.cream }}>SOURCES CONFIRM:</div>
          </div>
        </Slam>
      </div>
      <svg style={{ position: "absolute", top: 380, left: 0 }} width={1080} height={560} viewBox="0 0 1080 560">
        <polyline
          points="40,80 240,180 400,120 620,320 780,260 1040,520"
          fill="none"
          stroke={COLORS.red}
          strokeWidth={16}
          strokeDasharray={1400}
          strokeDashoffset={dash}
          opacity={0.35}
        />
      </svg>
      <div style={{ position: "absolute", top: 480, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 34 }}>
        {chips.map((c) => (
          <Pop key={c.label} delay={c.at} from={0.6}>
            <div style={{ ...neo(c.c, 10, 16), display: "flex", alignItems: "center", justifyContent: "space-between", padding: "30px 40px" }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: c.fg, opacity: 0.85 }}>{c.label}</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -2, color: c.fg }}>{c.value}</div>
            </div>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ OFFICIAL — the turn
const Official: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 0, 16, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 460, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.7} damping={9} rot={-2}>
          <div style={{ display: "inline-block", background: COLORS.lime, border: `6px solid ${COLORS.cream}`, boxShadow: `10px 10px 0 ${COLORS.cream}`, padding: "18px 44px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 140, letterSpacing: -3, color: COLORS.ink }}>OFFICIAL:</div>
          </div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={16} from={1.4} rot={1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, lineHeight: 1.0, letterSpacing: -2, color: COLORS.cream, marginTop: 40 }}>THERE'S NOW A WAY<br />TO SETTLE IT.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1180, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 34, 12) }}>
        <Pill bg={COLORS.pink} fg={COLORS.white} size={52} rot={-2} style={{ border: `5px solid ${COLORS.cream}`, boxShadow: `8px 8px 0 ${COLORS.cream}` }}>HERE WE GO.</Pill>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ DEAL — the terms
const Deal: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const terms = [
    { t: "10 QUESTIONS.", at: 8 },
    { t: "HEAD-TO-HEAD.", at: 20 },
    { t: "SCORE = FINAL SAY.", at: 32 },
  ];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", top: 220, left: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ display: "inline-block", background: COLORS.blue, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(12), padding: "12px 34px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -2, color: COLORS.white }}>THE TERMS:</div>
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 30 }}>
        {terms.map((term, i) => (
          <Pop key={term.t} delay={term.at} from={0.65}>
            <div style={{ ...neo(COLORS.card, 9, 14), display: "flex", alignItems: "center", gap: 28, padding: "26px 34px" }}>
              <div style={{ width: 74, height: 74, flexShrink: 0, background: COLORS.ink, color: COLORS.cream, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 38 }}>{`0${i + 1}`}</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, color: COLORS.ink }}>{term.t}</div>
            </div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1240, left: 72, right: 72, textAlign: "center" }}>
        <Pop delay={44}><div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.ink }}>No pundits. No VAR. No appeals.</div></Pop>
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
  const btn = spr(frame, fps, 38, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.red} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 216, letterSpacing: -6, color: COLORS.white, textShadow: `10px 10px 0 ${COLORS.ink}` }}>DONE DEAL.</div>
        </Slam>
        <div style={{ width: 700, height: 24, background: COLORS.ink, marginTop: 24, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white }}>Settle it before full-time · free, no sign-up</div>
      </div>
      <Ticker text="QUIZ ··· SURVIVAL ··· CAREER PATH ··· BLITZ ··· ARENA ··· DUELS ··· A NEW CHALLENGE EVERY DAY" />
    </AbsoluteFill>
  );
};

export const BREAKING_SCENES: Record<BKey, React.FC<SceneProps>> = {
  alert: Alert,
  stats: Stats,
  official: Official,
  deal: Deal,
  cta: Cta,
};
