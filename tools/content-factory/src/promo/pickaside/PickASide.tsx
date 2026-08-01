import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, Slam, neoShadow } from "../kit";
import {
  CLUB_A,
  CLUB_B,
  NAMES,
  VERDICT,
  TURN_AT,
  VERDICT_AT,
  SIDE_AT,
  PROD_AT,
  PROD_MOTION,
  PROD_START_FRAME,
  FADE_FROM,
  TOTAL,
  CARET_PERIOD,
} from "./timeline";

// See timeline.ts for why this exists and what it is being tested against.
// GREEN LAW: green is the resolution signal in this batch. Here it appears on
// exactly two things — the verdict card and the product act — and nowhere else.

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

export const PickASide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // the board clears before the seam so the loop reads as a fresh round
  const clear = interpolate(frame, [FADE_FROM, TOTAL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const caret = frame % CARET_PERIOD < 8;

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/pickaside.wav")} />

      {/* ---- THE BOARD (0 -> PROD_AT) ---- */}
      <Sequence durationInFrames={PROD_AT}>
        <AbsoluteFill style={{ background: COLORS.cream, opacity: clear }}>
          {/* the premise — complete and static at frame 0 */}
          <div style={{ position: "absolute", top: 80, left: 60, right: 60 }}>
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
              {/* NOT "FOUR MEN": roughly 12 qualify (see longchain/timeline.ts
                  pair 1, which sources the figure). The board shows four of
                  them. Numbers get screenshot — README law. */}
              FOUR OF THE MEN WHO PLAYED FOR
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 18, flexWrap: "wrap" }}>
              <Plate text={CLUB_A} bg={COLORS.white} fg={COLORS.ink} rot={-1.2} />
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, color: COLORS.ink }}>+</div>
              <Plate text={CLUB_B} bg={COLORS.red} fg={COLORS.white} rot={1.2} />
            </div>
          </div>

          {/* the ballot — every option present at frame 0, because you cannot
              pick from a list you have not been shown */}
          <div
            style={{
              position: "absolute",
              top: 372,
              left: 60,
              right: 60,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {NAMES.map((n, i) => {
              const picked = frame >= VERDICT_AT && n === VERDICT;
              return (
                <div
                  key={n}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    background: picked ? COLORS.green : COLORS.white,
                    border: `6px solid ${COLORS.ink}`,
                    borderRadius: 18,
                    boxShadow: neoShadow(8),
                    padding: "22px 26px",
                    minHeight: 118,
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      flexShrink: 0,
                      borderRadius: 999,
                      background: picked ? COLORS.ink : COLORS.ink,
                      color: COLORS.cream,
                      fontFamily: FONTS.mono,
                      fontWeight: 700,
                      fontSize: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {`0${i + 1}`}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.head,
                      fontWeight: 700,
                      fontSize: 54,
                      letterSpacing: -1.6,
                      color: picked ? COLORS.white : COLORS.ink,
                    }}
                  >
                    {n}
                  </div>
                </div>
              );
            })}
          </div>

          {/* the turn — knowledge question becomes an allegiance question */}
          {frame >= TURN_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1010 }}>
              <Slam frame={frame - TURN_AT} fps={fps} damping={13}>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: 44,
                    lineHeight: 1.18,
                    color: COLORS.ink,
                  }}
                >
                  ONLY ONE OF THEM IS STILL
                  <br />
                  CLAIMED BY BOTH SETS OF FANS.
                </div>
              </Slam>
            </div>
          )}

          {/* the verdict — confident, declarative, unprovable */}
          {frame >= VERDICT_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1190 }}>
              <Slam frame={frame - VERDICT_AT} fps={fps} damping={10} from={1.5} rot={-2}>
                <div
                  style={{
                    display: "inline-block",
                    background: COLORS.green,
                    color: COLORS.ink,
                    border: `6px solid ${COLORS.ink}`,
                    borderRadius: 14,
                    boxShadow: neoShadow(10),
                    padding: "16px 32px",
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 58,
                    letterSpacing: -1.5,
                    transform: "rotate(-1deg)",
                  }}
                >
                  {`WE SAY: ${VERDICT}.`}
                </div>
              </Slam>
            </div>
          )}

          {/* the ask */}
          {frame >= SIDE_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1345 }}>
              <Slam frame={frame - SIDE_AT} fps={fps} damping={12}>
                <div
                  style={{
                    display: "inline-block",
                    background: COLORS.ink,
                    color: COLORS.cream,
                    borderRadius: 14,
                    padding: "16px 30px",
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: 42,
                    transform: "rotate(-1deg)",
                  }}
                >
                  {caret ? "▍" : " "} pick a side.
                </div>
              </Slam>
            </div>
          )}

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 1500,
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: 3,
              color: COLORS.ink,
              opacity: 0.5,
            }}
          >
            SETTLE IT · VERVEQ.COM
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ---- THE PRODUCT ACT (PROD_AT -> TOTAL) ----
          Real recording only. The app is where an argument actually resolves,
          so this is a payoff frame and green is allowed to live in it. */}
      <Sequence from={PROD_AT}>
        <AbsoluteFill style={{ background: COLORS.cream }}>
          <Sequence durationInFrames={PROD_MOTION}>
            <OffthreadVideo
              src={staticFile("product/arena-ui.mp4")}
              startFrom={PROD_START_FRAME}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
          {/* held proof — the standings stay up, exactly as edl_arena.json cuts it */}
          <Sequence from={PROD_MOTION}>
            <Img
              src={staticFile("product/standings-hold.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>

          {/* sits high on the frame on purpose: Instagram's own caption/audio
              chrome covers the bottom ~250px in feed, and down there it would
              also crop the final-standings table it is meant to be selling */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 250, textAlign: "center" }}>
            <Slam frame={frame - PROD_AT - 10} fps={fps} damping={12}>
              <div
                style={{
                  display: "inline-block",
                  background: COLORS.ink,
                  color: COLORS.cream,
                  border: `5px solid ${COLORS.ink}`,
                  borderRadius: 14,
                  boxShadow: neoShadow(8),
                  padding: "18px 34px",
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 46,
                  letterSpacing: -1,
                }}
              >
                ARGUE ON A SCOREBOARD.
              </div>
            </Slam>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
