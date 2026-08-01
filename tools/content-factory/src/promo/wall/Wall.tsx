import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import { CELLS, REVEALED, REVEAL_AT, CLOCK_FRAMES, VERDICT_AT, TOTAL } from "./timeline";

// See timeline.ts. The wall is complete at frame 0 by design — the only
// animation over it is the clock and a scan highlight, because the viewer is
// meant to be reading, not watching.

const COLS = 3;
const MARGIN = 46;
const GAP = 14;
const CELL_W = (1080 - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const CELL_H = 292;
const GRID_TOP = 556;

const Cell: React.FC<{ index: number; frame: number }> = ({ index, frame }) => {
  const cell = CELLS[index];
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const revealIdx = REVEALED.indexOf(index);
  const revealAt = revealIdx >= 0 ? REVEAL_AT[revealIdx] : -1;
  const revealed = revealAt >= 0 && frame >= revealAt;

  // a slow scan so the wall is never fully static, without pulling the eye off
  // any one cell for long
  const scanPos = (frame / 26) % 9;
  const scanned = Math.floor(scanPos) === index;

  // interpolate() rejects a non-finite input range, so the seven cells that are
  // never answered must not build one at all.
  const pop = revealed
    ? interpolate(frame, [revealAt, revealAt + 10], [0.8, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.back(3)),
      })
    : 1;
  // the seven unanswered cells dim when the verdict lands
  const dim = !revealed && frame >= VERDICT_AT ? 0.4 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: MARGIN + col * (CELL_W + GAP),
        top: GRID_TOP + row * (CELL_H + GAP),
        width: CELL_W,
        height: CELL_H,
        background: revealed ? COLORS.lime : COLORS.card,
        border: `5px solid ${COLORS.ink}`,
        borderRadius: 16,
        boxShadow: scanned && !revealed ? neoShadow(9) : neoShadow(6),
        padding: "14px 14px 12px",
        opacity: dim,
        transform: revealed ? `scale(${pop})` : scanned ? "scale(1.012)" : "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 20,
          color: COLORS.ink,
          opacity: 0.45,
        }}
      >
        {`0${index + 1}`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {cell.clubs.map((c, k) => (
          <div
            key={k}
            style={{
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 27,
              lineHeight: 1.06,
              letterSpacing: -0.5,
              color: COLORS.ink,
              opacity: revealed ? 0.5 : 1,
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div style={{ height: 40 }}>
        {revealed ? (
          <div
            style={{
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: -1,
              color: COLORS.ink,
            }}
          >
            {cell.answer}
          </div>
        ) : (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: 3,
              color: COLORS.ink,
              opacity: 0.3,
            }}
          >
            ?
          </div>
        )}
      </div>
    </div>
  );
};

export const Wall: React.FC = () => {
  const frame = useCurrentFrame();

  const secsLeft = Math.max(0, Math.ceil((CLOCK_FRAMES - frame) / 30));
  const drain = interpolate(frame, [0, CLOCK_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // the clock digit ticks — this is the motion at frame 0
  const tickScale = 1 + 0.12 * Math.max(0, 1 - ((frame % 30) / 30) * 4);

  const verdict = interpolate(frame, [VERDICT_AT, VERDICT_AT + 12], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.4)),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/wall.wav")} />

      {/* the claim — an identity test, not a question */}
      <div style={{ position: "absolute", top: 74, left: MARGIN, right: MARGIN }}>
        <div
          style={{
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 100,
            lineHeight: 0.9,
            letterSpacing: -4,
            color: COLORS.ink,
          }}
        >
          NAME 7 OF<br />THESE 9.
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: 38,
            color: COLORS.ink,
            opacity: 0.75,
            marginTop: 16,
          }}
        >
          Every path is one player. Seven is a serious score.
        </div>
      </div>

      {/* the clock — urgency over a puzzle the viewer will pause on anyway */}
      <div style={{ position: "absolute", top: 424, left: MARGIN, right: MARGIN, display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 14,
            background: secsLeft <= 3 ? COLORS.red : COLORS.ink,
            color: COLORS.cream,
            border: `5px solid ${COLORS.ink}`,
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${tickScale})`,
          }}
        >
          {secsLeft}
        </div>
        <div style={{ flex: 1, height: 24, border: `5px solid ${COLORS.ink}`, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${drain * 100}%`, height: "100%", background: secsLeft <= 3 ? COLORS.red : COLORS.orange }} />
        </div>
      </div>

      {CELLS.map((_, i) => (
        <Cell key={i} index={i} frame={frame} />
      ))}

      {/* the verdict — two proved, seven withheld */}
      {frame >= VERDICT_AT && (
        <div
          style={{
            position: "absolute",
            left: MARGIN,
            right: MARGIN,
            top: 1476,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${verdict}) rotate(-1.2deg)`,
          }}
        >
          <div
            style={{
              background: COLORS.ink,
              color: COLORS.cream,
              border: `6px solid ${COLORS.ink}`,
              borderRadius: 18,
              boxShadow: `10px 10px 0 ${COLORS.pink}`,
              padding: "20px 34px",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, letterSpacing: -1.5 }}>
              COMMENT YOUR SCORE /9
            </div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 25, letterSpacing: 2, opacity: 0.75, marginTop: 8 }}>
              THE OTHER SEVEN ARE IN THE APP
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1690,
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

export const WALL_TOTAL = TOTAL;
