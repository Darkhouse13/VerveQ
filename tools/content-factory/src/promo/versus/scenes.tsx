import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Pill, Slam, Pop, Ground, Stripes, spr, wipe, inOut, countTo, shake, W } from "../kit";
import { VKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  const k = inOut(frame, dur, 6);
  return { opacity: k };
};

// ============================================================ HOOK — the taunt
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const turn = frame >= 52;
  const sh = shake(frame, 52, 18, 12);
  const lines = [
    { t: "YOUR MATE", at: 0 },
    { t: "THINKS HE", at: 14 },
    { t: "KNOWS BALL.", at: 28 },
  ];
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.ink} opacity={0.1} />
      </Ground>
      <div style={{ position: "absolute", top: 300, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 6 }}>
        {lines.map((l) => (
          <Slam key={l.t} frame={frame} fps={fps} delay={l.at} from={1.4} rot={-1.5}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, lineHeight: 0.98, letterSpacing: -2, color: COLORS.cream, opacity: turn ? 0.3 : 1 }}>{l.t}</div>
          </Slam>
        ))}
      </div>
      {turn ? (
        <div style={{ position: "absolute", top: 820, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scaleX(${wipe(frame, fps, 52, 12)})` }}>
          <div style={{ background: COLORS.pink, border: `6px solid ${COLORS.cream}`, boxShadow: `10px 10px 0 ${COLORS.cream}`, padding: "22px 50px", transform: "rotate(-3deg)" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, letterSpacing: -3, color: COLORS.white }}>HE DOESN'T.</div>
          </div>
        </div>
      ) : null}
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.5 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ VS — the clash
const Vs: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const enter = spr(frame, fps, 0, 14, 20);
  const leftX = (1 - enter) * -700;
  const rightX = (1 - enter) * 700;
  const clash = spr(frame, fps, 20, 9, 16);
  const sh = shake(frame, 24, 20, 12);
  const Side: React.FC<{ x: number; color: string; label: string; sub: string; align: "flex-start" | "flex-end" }> = ({ x, color, label, sub, align }) => (
    <div style={{ flex: 1, background: color, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: align, padding: 60, transform: `translateX(${x}px)` }}>
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 128, letterSpacing: -3, color: COLORS.white, lineHeight: 0.95 }}>{label}</div>
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: COLORS.white, opacity: 0.85, marginTop: 10 }}>{sub}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <Side x={leftX} color={COLORS.blue} label={"YOU"} sub={"THE REAL FAN"} align="flex-start" />
        <Side x={rightX} color={COLORS.pink} label={"YOUR MATE"} sub={"ALL TALK"} align="flex-end" />
      </div>
      {/* VS badge at the seam */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${0.4 + clash * 0.6}) rotate(${(1 - clash) * -12}deg)`, opacity: Math.min(1, clash * 2) }}>
          <div style={{ ...neo(COLORS.yellow, 16, 200), width: 300, height: 300, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, color: COLORS.ink }}>VS</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 120, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 30, 14) }}>
        <Pill bg={COLORS.ink} fg={COLORS.cream} size={36} rot={-1}>SETTLE IT HEAD-TO-HEAD</Pill>
      </div>
    </AbsoluteFill>
  );
};

// shared header for the "feature" scenes
const Header: React.FC<{ label: string; accent: string; accentFg: string; dir: number }> = ({ label, accent, accentFg, dir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spr(frame, fps, 0, 13, 16);
  const x = (1 - enter) * 700 * dir;
  return (
    <div style={{ position: "absolute", top: 210, left: 72, right: 72, transform: `translateX(${x}px)` }}>
      <div style={{ display: "inline-block", background: accent, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(14), padding: "10px 30px", transform: "rotate(-1.5deg)" }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: label.length > 8 ? 104 : 132, letterSpacing: -2, color: accentFg, lineHeight: 1 }}>{label}</div>
      </div>
    </div>
  );
};

// ============================================================ DUEL — send a link
const Duel: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const you = countTo(frame, 40, dur - 6, 0, 7);
  const them = countTo(frame, 40, dur - 6, 0, 4);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.1} />
      </Ground>
      <Header label="DUEL A MATE" accent={COLORS.blue} accentFg={COLORS.white} dir={-1} />
      <div style={{ position: "absolute", top: 430, left: 72, right: 72, fontFamily: FONTS.body, fontWeight: 700, fontSize: 50, color: COLORS.ink }}>Send a link. Any mate, anywhere.</div>
      {/* share-link card */}
      <div style={{ position: "absolute", top: 600, left: 72, right: 72 }}>
        <Pop delay={8} from={0.7}>
          <div style={{ ...neo(COLORS.card, 10, 16), height: 130, display: "flex", alignItems: "center", gap: 24, paddingLeft: 28, paddingRight: 20 }}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 44, color: COLORS.ink, flex: 1, whiteSpace: "nowrap", overflow: "hidden" }}>verveq.com/duel/K7X2</div>
            <div style={{ background: COLORS.blue, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, padding: "16px 30px", border: `4px solid ${COLORS.ink}`, borderRadius: 10 }}>SEND</div>
          </div>
        </Pop>
      </div>
      {/* scoreboard */}
      <div style={{ position: "absolute", top: 830, left: 72, right: 72 }}>
        <Pop delay={16} from={0.6}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 30 }}>
            <div style={{ ...neo(COLORS.blue, 8, 14), width: 300, height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: COLORS.white }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, opacity: 0.85 }}>YOU</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 110 }}>{you}</div>
            </div>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 70, color: COLORS.ink }}>—</div>
            <div style={{ ...neo(COLORS.pink, 8, 14), width: 300, height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: COLORS.white }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, opacity: 0.85 }}>MATE</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 110 }}>{them}</div>
            </div>
          </div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ ARENA — go live
const Arena: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const dots = [COLORS.orange, COLORS.pink, COLORS.blue, COLORS.lime, COLORS.yellow];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.green} ground={COLORS.ink} opacity={0.1} />
      </Ground>
      <Header label="OR GO LIVE" accent={COLORS.green} accentFg={COLORS.white} dir={1} />
      <div style={{ position: "absolute", top: 430, left: 72, right: 72, fontFamily: FONTS.body, fontWeight: 700, fontSize: 50, color: COLORS.cream }}>One code. Everyone in the same room.</div>
      <div style={{ position: "absolute", top: 620, left: 72, right: 72, display: "flex", justifyContent: "center", gap: 26 }}>
        {dots.map((c, i) => (
          <Pop key={i} delay={14 + i * 7} from={0.2}>
            <div style={{ width: 120, height: 120, borderRadius: "50%", background: c, border: `5px solid ${COLORS.cream}`, boxShadow: `6px 6px 0 ${COLORS.cream}` }} />
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 810, left: 0, right: 0, textAlign: "center" }}>
        <Pop delay={30}><div style={{ display: "inline-block", fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -1, color: COLORS.lime }}>1v1 · 2v2 · FFA</div></Pop>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ RIVALRY — receipts
const Rivalry: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", top: 220, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -2, color: COLORS.ink, lineHeight: 0.96 }}>KEEP THE<br />RECEIPTS.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 560, left: 72, right: 72 }}>
        <Pop delay={8} from={0.7}>
          <div style={{ ...neo(COLORS.card, 12, 16), padding: "34px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 60, color: COLORS.ink }}>YOU vs DAVE</div>
              <div style={{ background: COLORS.lime, border: `4px solid ${COLORS.ink}`, borderRadius: 10, padding: "8px 22px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, color: COLORS.ink }}>W3</div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
              {[["12", "WON", COLORS.green], ["9", "LOST", COLORS.red], ["2", "DRAWN", COLORS.ink]].map(([n, l, c]) => (
                <div key={l} style={{ flex: 1, background: COLORS.cream, border: `4px solid ${COLORS.ink}`, borderRadius: 12, padding: "18px 0", textAlign: "center" }}>
                  <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 76, color: c as string }}>{n}</div>
                  <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: COLORS.ink, opacity: 0.7 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </Pop>
        <Pop delay={18} style={{ marginTop: 34 }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, color: COLORS.ink, textAlign: "center" }}>Every win on the record. Forever.</div>
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
  const settle = frame >= 20;
  const bar = wipe(frame, fps, 34, 14);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.blue, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={2} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 120, letterSpacing: -2, color: COLORS.cream, opacity: settle ? 0.35 : 1 }}>STOP ARGUING.</div>
        </Slam>
        {settle ? (
          <Slam frame={frame} fps={fps} delay={20} from={1.7} damping={9} rot={-2}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 210, lineHeight: 0.9, letterSpacing: -6, color: COLORS.cream, textShadow: `8px 8px 0 ${COLORS.pink}`, textAlign: "center", marginTop: 10 }}>SETTLE<br />IT.</div>
          </Slam>
        ) : null}
        <div style={{ width: 660, height: 24, background: COLORS.pink, marginTop: 20, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 56, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.blue, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 44, fontFamily: FONTS.body, fontWeight: 500, fontSize: 40, color: COLORS.cream, opacity: 0.85 }}>Football trivia · head-to-head</div>
      </div>
    </AbsoluteFill>
  );
};

export const VERSUS_SCENES: Record<VKey, React.FC<SceneProps>> = {
  hook: Hook,
  vs: Vs,
  duel: Duel,
  arena: Arena,
  rivalry: Rivalry,
  cta: Cta,
};
