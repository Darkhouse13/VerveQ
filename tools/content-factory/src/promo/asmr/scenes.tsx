import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Slam, Pop, Ground, Stripes, spr, wipe, inOut } from "../kit";
import { AKey, STREAK_STEP, STREAK_COUNT, LETTER_STEP, WORD } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ============================================================ HOOK — sound on
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 6], [1.03, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", top: 560, left: 72, right: 72, transform: `scale(${settle})` }}>
        {/* frame-0 readable: the classic ASMR bait, already on screen */}
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 38, letterSpacing: 4, padding: "16px 36px", borderRadius: 14 }}>
          🔊 SOUND ON
        </div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, lineHeight: 1.04, letterSpacing: -2, color: COLORS.ink, marginTop: 48 }}>
          the most satisfying<br />sound in football…
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.ink, opacity: 0.4 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ STREAK — the counter
const Streak: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const n = Math.min(STREAK_COUNT, Math.max(0, Math.floor((frame - 8) / STREAK_STEP) + 1));
  const justTicked = (frame - 8) % STREAK_STEP < 4 && n > 0 && n <= STREAK_COUNT;
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream} />
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, color: COLORS.ink, opacity: 0.55 }}>
        WIN STREAK
      </div>
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ display: "inline-block", ...neo(COLORS.card, 10, 26), padding: "50px 110px", transform: `scale(${justTicked ? 1.05 : 1})` }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 300, lineHeight: 0.9, letterSpacing: -8, color: COLORS.ink }}>{n}</div>
        </div>
      </div>
      {/* the emoji-grid row filling square by square */}
      <div style={{ position: "absolute", top: 1120, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {Array.from({ length: STREAK_COUNT }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 92,
              height: 92,
              borderRadius: 14,
              border: `5px solid ${COLORS.ink}`,
              background: i < n ? COLORS.green : COLORS.card,
              boxShadow: neoShadow(i < n ? 6 : 3),
              transform: `scale(${i === n - 1 && justTicked ? 1.12 : 1})`,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ LETTERS — the name clicks in
const Letters: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream} />
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, color: COLORS.ink, opacity: 0.55 }}>
        THE ANSWER, ARRIVING
      </div>
      <div style={{ position: "absolute", top: 700, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 20 }}>
        {WORD.split("").map((ch, i) => {
          const at = 8 + i * LETTER_STEP;
          const s = spr(frame, fps, at, 10, 14);
          const shown = frame >= at;
          return (
            <div
              key={i}
              style={{
                width: 128,
                height: 150,
                borderRadius: 16,
                border: `5px solid ${COLORS.ink}`,
                background: shown ? COLORS.lime : COLORS.card,
                boxShadow: neoShadow(shown ? 8 : 4),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONTS.head,
                fontWeight: 700,
                fontSize: 86,
                color: COLORS.ink,
                transform: `scale(${shown ? 0.7 + s * 0.3 : 1}) translateY(${shown ? (1 - s) * -26 : 0}px)`,
              }}
            >
              {shown ? ch : ""}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 960, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 8 + WORD.length * LETTER_STEP, 13) }}>
        <div style={{ display: "inline-block", background: COLORS.green, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 2, padding: "16px 40px", border: `5px solid ${COLORS.ink}`, borderRadius: 14, boxShadow: neoShadow(7), transform: "rotate(-2deg)" }}>
          CORRECT ✓
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ TEN — the payoff
const Ten: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream} />
      <div style={{ position: "absolute", top: 540, left: 0, right: 0, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.4} damping={11}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 250, letterSpacing: -8, color: COLORS.ink, textShadow: `10px 10px 0 ${COLORS.lime}` }}>10/10</div>
        </Slam>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -2, color: COLORS.ink, marginTop: 70, opacity: spr(frame, fps, 24, 13) }}>
          …is being right.
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
  const bar = wipe(frame, fps, 30, 14);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.lime} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 180, lineHeight: 0.92, letterSpacing: -5, color: COLORS.ink, textShadow: `10px 10px 0 ${COLORS.white}`, textAlign: "center" }}>GET YOUR<br />FIX.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.lime, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, padding: "28px 60px", border: `6px solid ${COLORS.white}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.ink}` }}>VERVEQ.COM/PLAY</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.ink }}>Free · no sign-up · dangerously satisfying</div>
      </div>
    </AbsoluteFill>
  );
};

export const ASMR_SCENES: Record<AKey, React.FC<SceneProps>> = {
  hook: Hook,
  streak: Streak,
  letters: Letters,
  ten: Ten,
  cta: Cta,
};
