import React from "react";
import {
  AbsoluteFill,
  Audio,
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
  CLUBS,
  CLUB_AT,
  BALLON_AT,
  WHO_AT,
  REFUSE_AT,
  POSITION_AT,
  PROD_AT,
  PROD_SRC,
  PROD_HOLD,
  PROD_START_FRAME,
  PROD_MOTION,
  CTA_AT,
  FADE_FROM,
  TOTAL,
  CARET_PERIOD,
} from "./timeline";

// See timeline.ts. The one law worth restating here: NO GREEN before PROD_AT.
// If you add an accent to this file, it is orange, pink, blue or red — never
// green. The first green pixel in this video is inside the app recording.

export const NotTelling: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clear = interpolate(frame, [FADE_FROM, TOTAL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const caret = frame % CARET_PERIOD < 8;

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/nottelling.wav")} />

      {/* ---- THE PUZZLE ---- */}
      <Sequence durationInFrames={PROD_AT}>
        <AbsoluteFill style={{ background: COLORS.cream, opacity: clear }}>
          {/* premise complete at frame 0 — an empty list communicates nothing */}
          <div style={{ position: "absolute", top: 90, left: 60, right: 60 }}>
            <div
              style={{
                fontFamily: FONTS.head,
                fontWeight: 700,
                fontSize: 104,
                letterSpacing: -4,
                lineHeight: 0.98,
                color: COLORS.ink,
              }}
            >
              FIVE CLUBS.
              <br />
              ONE MAN.
            </div>
          </div>

          {/* the path — one club every 3s */}
          <div
            style={{
              position: "absolute",
              top: 400,
              left: 60,
              right: 60,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {CLUBS.map((c, i) => {
              const at = CLUB_AT[i];
              if (frame < at) {
                // reserve the row so the list never reflows as it fills
                return <div key={c} style={{ minHeight: 118 }} />;
              }
              return (
                <Slam key={c} frame={frame - at} fps={fps} damping={11} from={1.3}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 22,
                      background: COLORS.white,
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
                        background: COLORS.ink,
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
                        fontSize: 52,
                        letterSpacing: -1.6,
                        color: COLORS.ink,
                      }}
                    >
                      {c}
                    </div>
                  </div>
                </Slam>
              );
            })}
          </div>

          {/* the sourced fact that reframes the whole path */}
          {frame >= BALLON_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1130 }}>
              <Slam frame={frame - BALLON_AT} fps={fps} damping={10} from={1.45} rot={-2}>
                <div
                  style={{
                    display: "inline-block",
                    background: COLORS.orange,
                    color: COLORS.white,
                    border: `6px solid ${COLORS.ink}`,
                    borderRadius: 14,
                    boxShadow: neoShadow(10),
                    padding: "16px 32px",
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 54,
                    letterSpacing: -1.4,
                    transform: "rotate(-1deg)",
                  }}
                >
                  HE WON A BALLON D&apos;OR.
                </div>
              </Slam>
            </div>
          )}

          {frame >= WHO_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1270 }}>
              <Slam frame={frame - WHO_AT} fps={fps} damping={12}>
                <div
                  style={{
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 76,
                    letterSpacing: -2.4,
                    color: COLORS.ink,
                  }}
                >
                  {`WHO IS HE? ${caret ? "▍" : " "}`}
                </div>
              </Slam>
            </div>
          )}

          {/* the thesis — the refusal is the brand voice, not a tease */}
          {frame >= REFUSE_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1390 }}>
              <Slam frame={frame - REFUSE_AT} fps={fps} damping={10} from={1.5} rot={-2}>
                <div
                  style={{
                    display: "inline-block",
                    background: COLORS.ink,
                    color: COLORS.cream,
                    borderRadius: 14,
                    padding: "18px 34px",
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 62,
                    letterSpacing: -1.8,
                    transform: "rotate(-1deg)",
                  }}
                >
                  WE&apos;RE NOT TELLING YOU.
                </div>
              </Slam>
            </div>
          )}

          {frame >= POSITION_AT && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 1560 }}>
              <Slam frame={frame - POSITION_AT} fps={fps} damping={13}>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontWeight: 700,
                    fontSize: 36,
                    lineHeight: 1.2,
                    color: COLORS.ink,
                    opacity: 0.72,
                  }}
                >
                  EVERY OTHER ACCOUNT WOULD
                  <br />
                  HAVE SHOWN YOU BY NOW.
                </div>
              </Slam>
            </div>
          )}
        </AbsoluteFill>
      </Sequence>

      {/* ---- THE PRODUCT ACT — the first and only green in the piece ----
           ⚠ Placeholder mode: this is the arena scoreboard, not Career Path.
           See the KNOWN GAP note in timeline.ts. */}
      <Sequence from={PROD_AT}>
        <AbsoluteFill style={{ background: COLORS.cream }}>
          <Sequence durationInFrames={PROD_MOTION}>
            <OffthreadVideo
              src={staticFile(PROD_SRC)}
              startFrom={PROD_START_FRAME}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
          <Sequence from={PROD_MOTION}>
            <Img src={staticFile(PROD_HOLD)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>

          {frame >= CTA_AT && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, textAlign: "center" }}>
              <Slam frame={frame - CTA_AT} fps={fps} damping={11} from={1.4}>
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
                    fontSize: 44,
                    letterSpacing: -1,
                    lineHeight: 1.18,
                  }}
                >
                  THE ANSWER IS IN THE APP.
                  <br />
                  VERVEQ.COM
                </div>
              </Slam>
            </div>
          )}
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
