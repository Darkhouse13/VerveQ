import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import {
  RUNGS,
  STEP,
  LAST,
  TOTAL,
  CLUB_IN,
  CLUB_GAP,
  THINK_AT,
  ANSWER_AT,
  YOURTURN_AT,
} from "./timeline";

// See timeline.ts for the format's reason to exist. Layout law here: the rail
// (the climb) is on screen from frame 0 and NEVER moves — it is the promise
// that keeps a viewer past the first answer. The card above it is the only
// thing that changes.

const TIER_COLOR: Record<string, string> = {
  EASY: COLORS.green,
  MEDIUM: COLORS.yellow,
  HARD: COLORS.red,
  IMPOSSIBLE: COLORS.pink,
};
const TIER_FG: Record<string, string> = {
  EASY: COLORS.white,
  MEDIUM: COLORS.ink,
  HARD: COLORS.white,
  IMPOSSIBLE: COLORS.white,
};

// Which rung is on the card, and how far into it we are.
const locate = (frame: number) => {
  const i = Math.min(4, Math.floor(frame / STEP));
  return { i, phase: frame - i * STEP, dur: i === 4 ? LAST : STEP };
};

const RailRow: React.FC<{ index: number; active: number; phase: number }> = ({ index, active, phase }) => {
  const rung = RUNGS[index];
  const done = index < active || (index === active && index < 4 && phase >= ANSWER_AT);
  const isActive = index === active;
  // the rail entry stamps at the same instant the card does
  const stamp = interpolate(phase, [ANSWER_AT, ANSWER_AT + 8], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.4)),
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "15px 20px",
        borderRadius: 14,
        background: isActive ? COLORS.card : "transparent",
        border: `4px solid ${isActive ? COLORS.ink : "rgba(15,15,15,0.14)"}`,
        boxShadow: isActive ? neoShadow(6) : "none",
        opacity: isActive || done ? 1 : 0.5,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          flexShrink: 0,
          borderRadius: 10,
          background: TIER_COLOR[rung.tier],
          color: TIER_FG[rung.tier],
          border: `3px solid ${COLORS.ink}`,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {index + 1}
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 1.5,
          color: COLORS.ink,
          opacity: 0.65,
          width: 168,
          flexShrink: 0,
        }}
      >
        {rung.tier}
      </div>
      <div
        style={{
          fontFamily: FONTS.head,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: -0.5,
          color: COLORS.ink,
          transform: done && isActive ? `scale(${stamp})` : "none",
          transformOrigin: "left center",
        }}
      >
        {done ? rung.answer : index === 4 ? "?????" : "▓▓▓▓▓"}
      </div>
    </div>
  );
};

export const Ladder: React.FC = () => {
  const frame = useCurrentFrame();
  const { i, phase } = locate(frame);
  const rung = RUNGS[i];
  const isLast = i === 4;

  // card swap: a quick scale-in so each rung reads as a new question
  const cardIn = interpolate(phase, [0, 7], [0.965, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const answered = !isLast && phase >= ANSWER_AT;
  const answerPop = interpolate(phase, [ANSWER_AT, ANSWER_AT + 10], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(3)),
  });

  // rung 5 only: the demand
  const turnPop = interpolate(phase, [YOURTURN_AT, YOURTURN_AT + 12], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.6)),
  });
  const caret = Math.floor(frame / 8) % 2 === 0;

  // think-timer bar: drains while the viewer is meant to be guessing. Rung 1
  // starts draining at frame 0 — the first rung is pre-placed (see below), so
  // the bar is what moves before the viewer has decided whether to scroll.
  const thinkEnd = isLast ? YOURTURN_AT : ANSWER_AT;
  const drain = interpolate(phase, [i === 0 ? 0 : THINK_AT, thinkEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/ladder.wav")} />

      {/* header — the promise, static and readable at frame 0 */}
      <div style={{ position: "absolute", top: 78, left: 64, right: 64 }}>
        <div
          style={{
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 104,
            lineHeight: 0.92,
            letterSpacing: -4,
            color: COLORS.ink,
          }}
        >
          HOW FAR<br />DO YOU GET?
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 27,
            letterSpacing: 1.5,
            color: COLORS.ink,
            opacity: 0.6,
            marginTop: 16,
          }}
        >
          5 CAREER PATHS. THEY GET WORSE.
        </div>
      </div>

      {/* the card — the only thing that changes */}
      <div
        style={{
          position: "absolute",
          top: 330,
          left: 64,
          right: 64,
          transform: `scale(${cardIn})`,
          transformOrigin: "center top",
        }}
      >
        <div
          style={{
            background: COLORS.card,
            border: `6px solid ${COLORS.ink}`,
            borderRadius: 22,
            boxShadow: neoShadow(12),
            padding: "26px 30px 30px",
          }}
        >
          {/* tier + drain bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div
              style={{
                background: TIER_COLOR[rung.tier],
                color: TIER_FG[rung.tier],
                border: `4px solid ${COLORS.ink}`,
                borderRadius: 999,
                padding: "8px 26px",
                fontFamily: FONTS.mono,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: 2,
              }}
            >
              {rung.tier}
            </div>
            <div style={{ width: 250, height: 18, border: `4px solid ${COLORS.ink}`, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${drain * 100}%`, height: "100%", background: COLORS.ink }} />
            </div>
          </div>

          {/* the clubs */}
          {rung.clubs.map((club, c) => {
            // Rung 1 is pre-placed: at frame 0 a scroller must see a COMPLETE
            // puzzle, not an empty card animating toward one. Every later rung
            // animates in, because by then the format is understood.
            const at = CLUB_IN + c * CLUB_GAP;
            const s = i === 0 ? 1 : interpolate(phase, [at, at + 9], [0.86, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.back(2.2)),
            });
            const o = i === 0 ? 1 : interpolate(phase, [at, at + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={`${i}-${c}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  marginBottom: 14,
                  opacity: o,
                  transform: `scale(${s})`,
                  transformOrigin: "left center",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 999,
                    background: COLORS.ink,
                    color: COLORS.cream,
                    fontFamily: FONTS.mono,
                    fontWeight: 700,
                    fontSize: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {c + 1}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 52,
                    letterSpacing: -1.5,
                    color: COLORS.ink,
                    lineHeight: 1.05,
                  }}
                >
                  {club}
                </div>
              </div>
            );
          })}

          {/* the answer slot */}
          <div style={{ marginTop: 22, minHeight: 112 }}>
            {answered && (
              <div
                style={{
                  display: "inline-block",
                  background: COLORS.lime,
                  border: `5px solid ${COLORS.ink}`,
                  borderRadius: 16,
                  boxShadow: neoShadow(8),
                  padding: "14px 34px",
                  transform: `scale(${answerPop}) rotate(-1.5deg)`,
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 66,
                  letterSpacing: -2,
                  color: COLORS.ink,
                }}
              >
                {rung.answer}
              </div>
            )}
            {isLast && phase >= YOURTURN_AT && (
              <div
                style={{
                  display: "inline-block",
                  background: COLORS.ink,
                  border: `5px solid ${COLORS.ink}`,
                  borderRadius: 16,
                  boxShadow: `8px 8px 0 ${COLORS.pink}`,
                  padding: "14px 34px",
                  transform: `scale(${turnPop}) rotate(-1.5deg)`,
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 60,
                  letterSpacing: -2,
                  color: COLORS.cream,
                }}
              >
                YOU TELL ME{caret ? " ▍" : "  "}
              </div>
            )}
            {isLast && phase < YOURTURN_AT && phase >= THINK_AT && (
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 40,
                  letterSpacing: 6,
                  color: COLORS.ink,
                  opacity: 0.35,
                }}
              >
                ?????
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THE RAIL — the whole climb, on screen from frame 0, never moves */}
      <div style={{ position: "absolute", top: 1010, left: 64, right: 64, display: "flex", flexDirection: "column", gap: 10 }}>
        {RUNGS.map((_, r) => (
          <RailRow key={r} index={r} active={i} phase={phase} />
        ))}
      </div>

      {/* CTA strip — deliberately small; the comment is the ask, not the click */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1760,
          textAlign: "center",
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 3,
          color: COLORS.ink,
          opacity: 0.55,
        }}
      >
        CAREER PATH · VERVEQ.COM
      </div>
    </AbsoluteFill>
  );
};

export const LADDER_TOTAL = TOTAL;
