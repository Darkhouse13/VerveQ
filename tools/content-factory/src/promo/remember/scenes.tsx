import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { MKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ============================================================ YEAR — 2006.
const Year: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 6], [1.05, 1], { extrapolateRight: "clamp" });
  // a slow, warm drift — nostalgia breathes, it doesn't slam
  const drift = Math.sin(frame / 26) * 6;
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.orange} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      {/* readable on frame 0 */}
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center", transform: `scale(${settle}) translateY(${drift}px)` }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 380, letterSpacing: -14, lineHeight: 0.9, color: COLORS.ink, textShadow: `14px 14px 0 ${COLORS.orange}` }}>2006.</div>
      </div>
      <Pop delay={26} damping={14} style={{ position: "absolute", top: 1130, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 2, padding: "16px 38px", transform: "rotate(-1.5deg)" }}>
          YOU STAYED UP FOR THE GROUP STAGES.
        </div>
      </Pop>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.ink, opacity: 0.4 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ ALBUM — the stickers
const Album: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const stickers = [
    { filled: true, shiny: false, at: 18 },
    { filled: true, shiny: true, at: 30 }, // the shiny — everyone remembers the shiny
    { filled: false, shiny: false, at: 42 },
  ];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.orange}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.orange} opacity={0.1} />
      </Ground>
      <div style={{ position: "absolute", top: 340, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.3} damping={13} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 108, lineHeight: 0.97, letterSpacing: -2, color: COLORS.white, textShadow: `6px 6px 0 ${COLORS.ink}` }}>YOU KEPT THE<br />STICKER ALBUM.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 780, left: 72, right: 72, display: "flex", justifyContent: "center", gap: 34 }}>
        {stickers.map((s, i) => (
          <Pop key={i} delay={s.at} damping={13} from={0.6}>
            <div style={{ ...neo(s.shiny ? COLORS.lime : s.filled ? COLORS.card : COLORS.orange, 8, 12), width: 250, height: 330, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, transform: `rotate(${(i - 1) * 3}deg)`, borderStyle: s.filled ? "solid" : "dashed" }}>
              {s.filled ? (
                <>
                  <div style={{ width: 120, height: 120, borderRadius: "50%", background: s.shiny ? COLORS.white : COLORS.cream, border: `4px solid ${COLORS.ink}` }} />
                  <div style={{ width: 140, height: 18, background: COLORS.ink, opacity: 0.75 }} />
                  <div style={{ width: 100, height: 14, background: COLORS.ink, opacity: 0.45 }} />
                </>
              ) : (
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 90, color: COLORS.white, opacity: 0.7 }}>?</div>
              )}
              {s.shiny ? <div style={{ position: "absolute", top: -24, right: -20, background: COLORS.pink, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 1, padding: "6px 14px", border: `4px solid ${COLORS.ink}`, transform: "rotate(8deg)" }}>SHINY</div> : null}
            </div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1250, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 52, 14) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.white }}>62 short of complete. Still hurts.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ NUMBERS — squad numbers
const Numbers: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const nums = ["7", "10", "9", "23", "4"];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.yellow}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.yellow} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 340, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.3} damping={13} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, lineHeight: 0.97, letterSpacing: -2, color: COLORS.ink }}>YOU STILL KNOW<br />THE SQUAD NUMBERS.</div>
        </Slam>
      </div>
      {/* shirt-back number plates */}
      <div style={{ position: "absolute", top: 800, left: 72, right: 72, display: "flex", justifyContent: "center", gap: 26 }}>
        {nums.map((n, i) => (
          <Pop key={n} delay={16 + i * 9} damping={13} from={0.5}>
            <div style={{ ...neo(COLORS.card, 8, 14), width: 160, height: 210, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${(i - 2) * 2}deg)` }}>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 110, color: COLORS.ink }}>{n}</div>
            </div>
          </Pop>
        ))}
      </div>
      <div style={{ position: "absolute", top: 1180, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 60, 14) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.ink }}>By heart. Twenty years later.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ TURN
const Turn: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.orange} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 520, left: 72, right: 72, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.4} damping={11} rot={-1}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 116, lineHeight: 0.97, letterSpacing: -3, color: COLORS.cream }}>20 YEARS OF<br />FOOTBALL LIVE<br />IN YOUR HEAD.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1160, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scaleX(${wipe(frame, fps, 44, 14)})` }}>
        <div style={{ background: COLORS.lime, border: `6px solid ${COLORS.cream}`, boxShadow: `9px 9px 0 ${COLORS.cream}`, padding: "20px 46px", transform: "rotate(-2deg)" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -1, color: COLORS.ink }}>TIME IT PAID OFF.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA — warm cream close
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 28, 14);
  const btn = spr(frame, fps, 38, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.cream} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.orange, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.5} damping={10} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, lineHeight: 0.94, letterSpacing: -4, color: COLORS.ink, textAlign: "center" }}>PUT IT<br />TO WORK.</div>
        </Slam>
        <div style={{ width: 640, height: 24, background: COLORS.orange, border: `4px solid ${COLORS.ink}`, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 58, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.orange, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.ink}`, borderRadius: 18, boxShadow: neoShadow(10) }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 44, color: COLORS.ink }}>Career Path · name the player from his clubs</div>
        <div style={{ marginTop: 18, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2, color: COLORS.ink, opacity: 0.65 }}>FREE · NO SIGN-UP</div>
      </div>
    </AbsoluteFill>
  );
};

export const REMEMBER_SCENES: Record<MKey, React.FC<SceneProps>> = {
  year: Year,
  album: Album,
  numbers: Numbers,
  turn: Turn,
  cta: Cta,
};
