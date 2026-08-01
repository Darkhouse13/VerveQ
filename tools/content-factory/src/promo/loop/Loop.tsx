import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import { MESSAGES, STEP, TOTAL, ROTATE_WINDOW, TYPING_FROM, TYPING_TO } from "./timeline";

// Promo #20 — "LOOP": the circular argument. See timeline.ts for the loop
// law this file obeys: nothing here is a one-shot — every value is periodic,
// so the last frame hands off to the first invisibly.

const CX = 540;
const CY = 985;
const R = 340;

// periodic stripes: shift must return to 0 at frame TOTAL (360/3 = 120 ≡ 0 mod 120)
const LoopStripes: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      inset: -40,
      opacity: 0.05,
      backgroundImage: `repeating-linear-gradient(45deg, ${COLORS.blue} 0 6px, transparent 6px 60px)`,
      backgroundPosition: `${(frame / 3) % 120}px 0`,
    }}
  />
);

export const Loop: React.FC = () => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / STEP) % 6;
  const phase = frame % STEP;

  // ring rotation: hold, then ease one slot in the step's last frames
  const eased = interpolate(phase, [STEP - ROTATE_WINDOW, STEP], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const theta = -(step + eased) * 60;

  // active bubble pops as it arrives at the top (phase-local => loop-safe)
  const arrive = interpolate(phase, [0, 10], [0.86, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
  const typing = phase >= TYPING_FROM && phase <= TYPING_TO;
  const breathe = 1 + 0.012 * Math.sin((frame / 180) * Math.PI * 2); // 2 cycles / video
  const ctaGlow = 0.5 + 0.5 * Math.sin((frame / 120) * Math.PI * 2); // 3 cycles / video

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/loop.wav")} />
      <LoopStripes frame={frame} />

      {/* hook — static, readable at frame 0, never animates (loop-safe) */}
      <div style={{ position: "absolute", top: 120, left: 72, right: 72 }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, lineHeight: 0.97, letterSpacing: -3, color: COLORS.ink }}>
          THIS ARGUMENT<br />NEVER ENDS.
        </div>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 2, color: COLORS.ink, opacity: 0.5, marginTop: 18 }}>
          (neither does this video)
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, right: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.ink, opacity: 0.35 }}>
        VERVEQ
      </div>

      {/* the orbit track */}
      <div
        style={{
          position: "absolute",
          left: CX - R,
          top: CY - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          border: `4px dashed rgba(15,15,15,0.25)`,
        }}
      />

      {/* the ring of bubbles */}
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, transform: `scale(${breathe})` }}>
        <div style={{ position: "absolute", left: CX, top: CY, transform: `rotate(${theta}deg)` }}>
          {MESSAGES.map((m, i) => {
            const angle = i * 60 - 90; // bubble i starts at the top
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * R;
            const y = Math.sin(rad) * R;
            const isActive = i === step && eased === 0;
            const scale = isActive ? arrive * 1.14 : 0.82;
            const opacity = isActive ? 1 : 0.55;
            return (
              <div key={i} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) rotate(${-theta}deg) scale(${scale})`, opacity }}>
                <div
                  style={{
                    whiteSpace: "nowrap",
                    background: m.side === "a" ? COLORS.card : COLORS.blue,
                    color: m.side === "a" ? COLORS.ink : COLORS.white,
                    border: `4px solid ${COLORS.ink}`,
                    borderRadius: 18,
                    boxShadow: neoShadow(6),
                    padding: "18px 26px",
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: 34,
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          {/* orbit chevrons — ride the ring between bubbles */}
          {MESSAGES.map((_, i) => {
            const angle = i * 60 - 60;
            const rad = (angle * Math.PI) / 180;
            return (
              <div
                key={`c${i}`}
                style={{
                  position: "absolute",
                  left: Math.cos(rad) * R,
                  top: Math.sin(rad) * R,
                  transform: `translate(-50%, -50%) rotate(${angle + 180}deg)`,
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 40,
                  color: COLORS.ink,
                  opacity: 0.4,
                }}
              >
                ‹
              </div>
            );
          })}
        </div>

        {/* the center: how long this has been going on */}
        <div style={{ position: "absolute", left: CX, top: CY, transform: "translate(-50%, -50%)", textAlign: "center" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 92, letterSpacing: -2, color: COLORS.ink }}>DAY 847</div>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 32, color: COLORS.ink, opacity: 0.6, marginTop: 6 }}>same argument.</div>
          {/* typing chip — appears late in every step, identically (loop-safe) */}
          <div style={{ height: 54, marginTop: 16 }}>
            {typing && (
              <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, borderRadius: 999, padding: "10px 24px" }}>
                typing{".".repeat(1 + (Math.floor(phase / 5) % 3))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* persistent CTA — no endcard on a loop; the strip IS the CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1650, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            background: COLORS.ink,
            color: COLORS.cream,
            border: `5px solid ${COLORS.ink}`,
            borderRadius: 18,
            boxShadow: `8px 8px 0 rgba(15,15,15,${0.25 + 0.35 * ctaGlow})`,
            padding: "22px 44px",
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: -1,
          }}
        >
          or end it → <span style={{ color: COLORS.lime }}>VERVEQ.COM/PLAY</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
