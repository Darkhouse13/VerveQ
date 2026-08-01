import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import { CLUB_A, CLUB_B, LINKS, NAME_AT, FADE_FROM, TOTAL, CARET_PERIOD } from "./timeline";

// See timeline.ts for the format and the loop law. All five slots are drawn
// from frame 0 — the empty fifth one is the whole point and must be visible
// before the viewer decides to scroll.

const Plate: React.FC<{ text: string; bg: string; fg: string; rot: number }> = ({ text, bg, fg, rot }) => (
  <div
    style={{
      background: bg,
      color: fg,
      border: `5px solid ${COLORS.ink}`,
      borderRadius: 14,
      boxShadow: neoShadow(8),
      padding: "12px 28px",
      fontFamily: FONTS.head,
      fontWeight: 700,
      fontSize: 54,
      letterSpacing: -1.5,
      transform: `rotate(${rot}deg)`,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

export const Chain: React.FC = () => {
  const frame = useCurrentFrame();

  // global fade-out that closes the loop: names clear back to empty by TOTAL
  const clear = interpolate(frame, [FADE_FROM, TOTAL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const caret = frame % CARET_PERIOD < 8;
  // breathing on the open slot — period divides TOTAL (330 / 55 = 6 cycles)
  const pulse = 1 + 0.02 * Math.sin((frame / 55) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/chain.wav")} />

      {/* the rule — static, complete, readable at frame 0 */}
      <div style={{ position: "absolute", top: 90, left: 60, right: 60 }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 3,
            color: COLORS.ink,
            opacity: 0.6,
          }}
        >
          NAME A PLAYER WHO PLAYED FOR
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 20, flexWrap: "wrap" }}>
          <Plate text={CLUB_A} bg={COLORS.white} fg={COLORS.ink} rot={-1.2} />
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, color: COLORS.ink }}>+</div>
          <Plate text={CLUB_B} bg={COLORS.red} fg={COLORS.white} rot={1.2} />
        </div>
      </div>

      {/* the chain — five slots, drawn from frame 0 */}
      <div style={{ position: "absolute", top: 400, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 22 }}>
        {[0, 1, 2, 3, 4].map((s) => {
          const open = s === 4;
          const at = open ? 0 : NAME_AT[s];
          const pop = interpolate(frame, [at, at + 11], [0.72, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(2.8)),
          });
          const shown = !open && frame >= at ? clear : 0;
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                background: open ? COLORS.card : COLORS.white,
                border: `6px ${open ? "dashed" : "solid"} ${COLORS.ink}`,
                borderRadius: 18,
                boxShadow: open ? `10px 10px 0 ${COLORS.pink}` : neoShadow(8),
                padding: "26px 28px",
                minHeight: 132,
                transform: open ? `scale(${pulse})` : "none",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  borderRadius: 999,
                  background: open ? COLORS.pink : COLORS.ink,
                  color: open ? COLORS.white : COLORS.cream,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {`0${s + 1}`}
              </div>
              {open ? (
                <div
                  style={{
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 50,
                    letterSpacing: -1,
                    color: COLORS.ink,
                    opacity: 0.45,
                  }}
                >
                  {caret ? "▍" : " "} your turn
                </div>
              ) : (
                <div
                  style={{
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 56,
                    letterSpacing: -1.6,
                    color: COLORS.ink,
                    opacity: shown,
                    transform: `scale(${frame >= at ? pop : 0.72})`,
                    transformOrigin: "left center",
                  }}
                >
                  {LINKS[s]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* the trigger line — the reason people type */}
      <div style={{ position: "absolute", left: 60, right: 60, top: 1230 }}>
        <div
          style={{
            display: "inline-block",
            background: COLORS.ink,
            color: COLORS.cream,
            borderRadius: 14,
            padding: "16px 30px",
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: 40,
            transform: "rotate(-1deg)",
          }}
        >
          we left out the obvious one.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1390,
          textAlign: "center",
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 3,
          color: COLORS.ink,
          opacity: 0.5,
        }}
      >
        ONE SQUARE OF TODAY&apos;S VERVEGRID · VERVEQ.COM
      </div>
    </AbsoluteFill>
  );
};
