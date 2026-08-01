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
  PAIRS,
  PAIR_DUR,
  PAIRS_AT,
  HOOK_CUT,
  CLOSE_AT,
  LOCKUP_AT,
  FADE_FROM,
  TOTAL,
  P_SLOT,
  P_TICK,
  P_ANSWER,
  P_FACT,
  CARET_PERIOD,
  LOBBY_START_FRAME,
  LOBBY_MOTION,
  pairStart,
  type Pair,
} from "./timeline";

// See timeline.ts for the hypothesis this is testing and the green law.

const Plate: React.FC<{ text: string; bg: string; fg: string; rot: number }> = ({ text, bg, fg, rot }) => (
  <div
    style={{
      background: bg,
      color: fg,
      border: `5px solid ${COLORS.ink}`,
      borderRadius: 14,
      boxShadow: neoShadow(8),
      padding: "12px 26px",
      fontFamily: FONTS.head,
      fontWeight: 700,
      fontSize: 50,
      letterSpacing: -1.5,
      transform: `rotate(${rot}deg)`,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

// The progress rail — every pair, all the time, filling in as they resolve.
//
// Two jobs, and over 100 seconds both matter far more than they would at 11s.
// First retention: the same law ladder/timeline.ts is built on — show the whole
// gauntlet up front and the viewer stays to watch it fill, where a
// one-at-a-time reveal lets them leave the moment they solve the one on screen.
// Second, and this IS the format: row six is dashed from frame one, reads
// NEVER, and never turns green. So at every instant of the video the eye can
// already see that one of these is not going to be answered — the caption only
// has to confirm what the viewer worked out on their own.
const Rail: React.FC<{ pairs: Pair[]; index: number; local: number }> = ({ pairs, index, local }) => (
  <div
    style={{
      position: "absolute",
      left: 60,
      right: 60,
      top: 900,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    {pairs.map((p, i) => {
      const isOpen = p.answer === null;
      const resolved = !isOpen && (i < index || (i === index && local >= P_ANSWER));
      const current = i === index;
      return (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            minHeight: 78,
            padding: "0 20px",
            borderRadius: 12,
            background: resolved ? COLORS.green : COLORS.card,
            border: `4px ${isOpen ? "dashed" : "solid"} ${COLORS.ink}`,
            boxShadow: current ? `7px 7px 0 ${COLORS.pink}` : "none",
            opacity: resolved || current ? 1 : 0.42,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: 1,
              color: COLORS.ink,
              opacity: 0.65,
              width: 34,
              flexShrink: 0,
            }}
          >
            {`0${i + 1}`}
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: 0.5,
              color: COLORS.ink,
              opacity: 0.75,
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {`${p.a} + ${p.b}`}
          </div>
          <div
            style={{
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: -0.6,
              color: COLORS.ink,
              opacity: resolved ? 1 : 0.5,
              flexShrink: 0,
            }}
          >
            {resolved ? p.answer : isOpen ? "NEVER" : "—"}
          </div>
        </div>
      );
    })}
  </div>
);

// One pair, one 13-second grid. `local` is frames since this pair started.
const PairBlock: React.FC<{
  pair: Pair;
  pairs: Pair[];
  local: number;
  index: number;
  fps: number;
}> = ({ pair, pairs, local, index, fps }) => {
  const caret = local % CARET_PERIOD < 8;
  const answered = pair.answer !== null && local >= P_ANSWER;
  // 3 -> 2 -> 1, then nothing
  const ticked = P_TICK.filter((t) => local >= t).length;
  const countLabel = ticked === 0 ? null : String(P_TICK.length + 1 - ticked);

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      {/* which pair of six, so a late-arriving viewer knows where they are */}
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 3,
          color: COLORS.ink,
          opacity: 0.55,
        }}
      >
        <span>NAME A PLAYER WHO PLAYED FOR</span>
        <span>{`0${index + 1} / 06`}</span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 170,
          left: 60,
          right: 60,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Slam frame={local} fps={fps} damping={11} from={1.35}>
          <Plate text={pair.a} bg={COLORS.white} fg={COLORS.ink} rot={-1.2} />
        </Slam>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 50, color: COLORS.ink }}>+</div>
        <Slam frame={local - 6} fps={fps} damping={11} from={1.35}>
          <Plate text={pair.b} bg={COLORS.red} fg={COLORS.white} rot={1.2} />
        </Slam>
      </div>

      {/* the slot — dashed and empty until the answer lands, and on pair six
          it simply never does */}
      {local >= P_SLOT && (
        <div style={{ position: "absolute", top: 470, left: 60, right: 60 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              background: answered ? COLORS.green : COLORS.card,
              border: `7px ${answered ? "solid" : "dashed"} ${COLORS.ink}`,
              borderRadius: 20,
              boxShadow: answered ? neoShadow(12) : `12px 12px 0 ${COLORS.pink}`,
              padding: "34px 32px",
              minHeight: 168,
            }}
          >
            {answered ? (
              <Slam frame={local - P_ANSWER} fps={fps} damping={10} from={1.5}>
                <div
                  style={{
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 68,
                    letterSpacing: -2,
                    color: COLORS.ink,
                  }}
                >
                  {pair.answer}
                </div>
              </Slam>
            ) : (
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 60,
                  letterSpacing: -1.4,
                  color: COLORS.ink,
                  opacity: 0.42,
                }}
              >
                {caret ? "▍" : " "} your turn
              </div>
            )}
          </div>
        </div>
      )}

      {/* the countdown the viewer answers in their head */}
      {countLabel !== null && local < P_ANSWER && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 330,
            textAlign: "center",
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 150,
            letterSpacing: -6,
            color: COLORS.ink,
            opacity: 0.16,
          }}
        >
          {countLabel}
        </div>
      )}

      {/* one sourced line — see the fact-check log in SCRIPTS_PHASE2.md */}
      {local >= P_FACT && (
        <div style={{ position: "absolute", left: 60, right: 60, top: 700 }}>
          <Slam frame={local - P_FACT} fps={fps} damping={13}>
            <div
              style={{
                display: "inline-block",
                background: COLORS.ink,
                color: COLORS.cream,
                borderRadius: 14,
                padding: "16px 30px",
                fontFamily: FONTS.body,
                fontWeight: 700,
                fontSize: 38,
                lineHeight: 1.2,
                transform: "rotate(-1deg)",
              }}
            >
              {pair.fact}
            </div>
          </Slam>
        </div>
      )}

      <Rail pairs={pairs} index={index} local={local} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1470,
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
  );
};

export const LongChain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clear = interpolate(frame, [FADE_FROM, TOTAL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const caret = frame % CARET_PERIOD < 8;

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      <Audio src={staticFile("promo/longchain.wav")} />

      {/* ---- COLD OPEN: 2s of a real face, with the premise already on it.
           The b-roll buys the scroll-stop; the plate keeps frame 0 legible. ---- */}
      <Sequence durationInFrames={HOOK_CUT}>
        <AbsoluteFill>
          <OffthreadVideo
            src={staticFile("product/hook-row.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{ position: "absolute", left: 50, right: 50, top: 150 }}>
            <Plate text="SIX CLUB PAIRS." bg={COLORS.white} fg={COLORS.ink} rot={-1.5} />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ---- THE CONTRACT (hard cut to cream — the cut is the punchline) ---- */}
      <Sequence from={HOOK_CUT} durationInFrames={PAIRS_AT - HOOK_CUT}>
        <AbsoluteFill
          style={{
            background: COLORS.cream,
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "0 70px",
          }}
        >
          <Slam frame={frame - HOOK_CUT} fps={fps} damping={10} from={1.4}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -4, color: COLORS.ink }}>
              SIX PAIRS.
            </div>
          </Slam>
          <Slam frame={frame - HOOK_CUT - 45} fps={fps} damping={10} from={1.4}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -4, color: COLORS.ink }}>
              WE ANSWER FIVE.
            </div>
          </Slam>
          {frame >= HOOK_CUT + 120 && (
            <Slam frame={frame - HOOK_CUT - 120} fps={fps} damping={11} from={1.4}>
              <div
                style={{
                  marginTop: 26,
                  display: "inline-block",
                  background: COLORS.ink,
                  color: COLORS.cream,
                  borderRadius: 14,
                  padding: "18px 32px",
                  fontFamily: FONTS.body,
                  fontWeight: 700,
                  fontSize: 52,
                  transform: "rotate(-1deg)",
                }}
              >
                the last one is yours.
              </div>
            </Slam>
          )}
        </AbsoluteFill>
      </Sequence>

      {/* ---- THE SIX PAIRS ---- */}
      {PAIRS.map((pair, i) => (
        <Sequence key={i} from={pairStart(i)} durationInFrames={PAIR_DUR}>
          <PairBlock pair={pair} pairs={PAIRS} local={frame - pairStart(i)} index={i} fps={fps} />
        </Sequence>
      ))}

      {/* ---- PRODUCT ACT — real recording, the place these get settled ---- */}
      <Sequence from={CLOSE_AT} durationInFrames={LOCKUP_AT - CLOSE_AT}>
        <AbsoluteFill style={{ background: COLORS.cream }}>
          <Sequence durationInFrames={LOBBY_MOTION}>
            <OffthreadVideo
              src={staticFile("product/arena-ui.mp4")}
              startFrom={LOBBY_START_FRAME}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
          <Sequence from={LOBBY_MOTION}>
            <Img
              src={staticFile("product/lobby-hold.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 110, textAlign: "center" }}>
            <Slam frame={frame - CLOSE_AT - 20} fps={fps} damping={12}>
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
                WE SETTLE THESE PROPERLY.
              </div>
            </Slam>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ---- LOCKUP — pair six comes back, still open. The video ends on the
           question, which is the entire point of the format. ---- */}
      <Sequence from={LOCKUP_AT}>
        <AbsoluteFill style={{ background: COLORS.cream, opacity: clear }}>
          <div style={{ position: "absolute", top: 300, left: 60, right: 60 }}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontWeight: 700,
                fontSize: 30,
                letterSpacing: 3,
                color: COLORS.ink,
                opacity: 0.6,
                marginBottom: 22,
              }}
            >
              STILL OPEN — 06 / 06
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Plate text={PAIRS[5].a} bg={COLORS.white} fg={COLORS.ink} rot={-1.2} />
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 50, color: COLORS.ink }}>+</div>
              <Plate text={PAIRS[5].b} bg={COLORS.red} fg={COLORS.white} rot={1.2} />
            </div>
            <div
              style={{
                marginTop: 40,
                display: "flex",
                alignItems: "center",
                background: COLORS.card,
                border: `7px dashed ${COLORS.ink}`,
                borderRadius: 20,
                boxShadow: `12px 12px 0 ${COLORS.pink}`,
                padding: "34px 32px",
                minHeight: 168,
                fontFamily: FONTS.head,
                fontWeight: 700,
                fontSize: 60,
                letterSpacing: -1.4,
                color: COLORS.ink,
                opacity: 0.42,
              }}
            >
              {caret ? "▍" : " "} your turn
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 1420,
              textAlign: "center",
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 58,
              letterSpacing: -1.5,
              color: COLORS.ink,
            }}
          >
            VERVEQ.COM
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
