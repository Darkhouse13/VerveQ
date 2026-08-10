import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import { Edition, editionBySlug, locate } from "./timeline";
import { cuesFor, hasVo } from "./vo";

// See timeline.ts for the format and the two withholds. LAYOUT LAW: this is a
// RAIL of wide slots under two club plates — deliberately NOT the ladder's
// card-over-rail stack, so the two formats are distinguishable at a glance in
// a feed. The rail is on screen from frame 0 and never moves; slots fill down
// it like links closing on a chain. Slot 10 is drawn empty from frame 0 with
// its caret already blinking — the empty box is the premise (`chain` law), and
// it is also the motion a scroller sees before deciding.

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

// What the live slot asks while its window is open. Spoiler-free, no facts —
// the escalation is the ask wearing thin, which is the relay's own grammar.
const PROMPTS = ["GOT ONE?", "ANOTHER?", "ANOTHER?", "KEEP GOING.", "ANOTHER?", "STILL GOING?", "ANOTHER?", "ANYONE LEFT?", "LAST ONE WE GIVE."];

// Rail names run to 14 characters (LASSANA DIARRA); the stamp shrinks so the
// slot height never moves.
const nameSize = (s: string): number => (s.length > 11 ? 40 : 48);

const Plate: React.FC<{ text: string; bg: string; fg: string; rot: number }> = ({ text, bg, fg, rot }) => (
  <div
    style={{
      background: bg,
      color: fg,
      border: `5px solid ${COLORS.ink}`,
      borderRadius: 14,
      boxShadow: neoShadow(8),
      padding: "10px 24px",
      fontFamily: FONTS.head,
      fontWeight: 700,
      fontSize: 46,
      letterSpacing: -1.2,
      transform: `rotate(${rot}deg)`,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

// KEEP COUNT — the batch-2 scoreboard surface, reused whole. Nine pips, not
// ten: slot 10 is yours, so it is not something you can have scored, and `/9`
// has to match what the reused closer asks for out loud.
const CountRail: React.FC<{ resolved: number; justFilled: boolean; phase: number; answerAt: number }> = ({
  resolved,
  justFilled,
  phase,
  answerAt,
}) => {
  const pop = interpolate(phase, [answerAt, answerAt + 9], [0.55, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(3)),
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 1722,
        left: 60,
        right: 60,
        display: "flex",
        alignItems: "center",
        gap: 22,
        boxSizing: "border-box",
        background: COLORS.card,
        border: `5px solid ${COLORS.ink}`,
        borderRadius: 16,
        boxShadow: neoShadow(8),
        padding: "14px 24px",
      }}
    >
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 2, color: COLORS.ink, opacity: 0.72 }}>
        KEEP COUNT
      </div>
      <div style={{ flex: 1, display: "flex", gap: 8 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
          const filled = p < resolved;
          const newest = filled && p === resolved - 1 && justFilled;
          return (
            <div
              key={p}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 7,
                border: `3px solid ${COLORS.ink}`,
                background: filled ? COLORS.lime : "transparent",
                opacity: filled ? 1 : 0.34,
                transform: newest ? `scale(${pop})` : "none",
              }}
            />
          );
        })}
      </div>
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 44, letterSpacing: -2, color: COLORS.ink }}>?/9</div>
    </div>
  );
};

export const ChainLong: React.FC<{ slug?: string }> = ({ slug = "liverpool-city" }) => {
  const ed = editionBySlug(slug);
  const g = ed.grid;
  const { thinkAt: THINK_AT, tickAt: TICK_AT, answerAt: ANSWER_AT } = g;
  const TURN_AT = ANSWER_AT; // slot 10: the demand lands where a name would
  const frame = useCurrentFrame();
  const { i, phase, follow, cta } = locate(frame, ed);
  const ended = follow || cta;
  const isLast = i === 9;

  const caret = Math.floor(frame / 8) % 2 === 0;
  // slot 10 breathes from frame 0 — chain's open-slot pulse, period off-beat
  const pulse = 1 + 0.012 * Math.sin((frame / 57) * Math.PI * 2);

  const answered = !isLast && phase >= ANSWER_AT;
  const justFilled = !ended && !isLast && phase >= ANSWER_AT;
  const resolved = ended ? 9 : Math.min(9, i + (justFilled ? 1 : 0));

  // the drain — slot 1 drains from frame 0 (motion before 0.3s, spec #8)
  const thinkEnd = isLast ? TURN_AT : ANSWER_AT;
  const drain = interpolate(phase, [i === 0 ? 0 : THINK_AT, thinkEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3-2-1, shown inside the live slot until the name takes it
  const tickIdx = TICK_AT.filter((t) => phase >= t).length;
  const countdown = tickIdx > 0 && phase < thinkEnd ? 3 - tickIdx + 1 : 0;
  const tickPop = interpolate(phase - (TICK_AT[tickIdx - 1] ?? 0), [0, 7], [1.45, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const cues = cuesFor(ed);

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      {/* one bed per edition, its own identity — promo/chainlong-audio.mjs */}
      <Audio src={staticFile(`promo/chainlong-${ed.slug}.wav`)} />
      {/* VO cues. Absent until promo/chainlong-vo.mjs has run — the piece
          renders silent-but-complete without them, and a proof is never posted. */}
      {hasVo &&
        cues.map((c) => (
          <Sequence key={c.key} from={c.at} name={`vo:${c.key}`}>
            <Audio src={staticFile(`promo/vo-cl/${c.key}.mp3`)} />
          </Sequence>
        ))}

      {/* the rule + the pair — static, complete, readable at frame 0 */}
      <div style={{ position: "absolute", top: 52, left: 60, right: 60 }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 29,
            letterSpacing: 3,
            color: COLORS.ink,
            opacity: 0.6,
          }}
        >
          NAME A PLAYER WHO PLAYED FOR
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 18, flexWrap: "wrap" }}>
          <Plate text={ed.clubA} bg={COLORS.white} fg={COLORS.ink} rot={-1.2} />
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 50, color: COLORS.ink }}>+</div>
          <Plate text={ed.clubB} bg={COLORS.red} fg={COLORS.white} rot={1.2} />
        </div>
        <div
          style={{
            marginTop: 20,
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 25,
            letterSpacing: 1.4,
            color: COLORS.ink,
            opacity: 0.6,
          }}
        >
          WE NAME 9. SLOT 10 IS YOURS. KEEP COUNT.
        </div>
      </div>

      {/* THE CHAIN — ten slots, drawn from frame 0, never moves */}
      <div style={{ position: "absolute", top: 372, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 13 }}>
        {Array.from({ length: 10 }, (_, s) => {
          const open = s === 9;
          const done = s < i || (s === i && !open && phase >= ANSWER_AT);
          const isActive = s === i && !ended;
          const stamp = interpolate(phase, [ANSWER_AT, ANSWER_AT + 9], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.back(2.6)),
          });
          const demanded = open && (i === 9 || ended) && (ended || phase >= TURN_AT);
          const slot = s < 9 ? ed.slots[s] : undefined;
          return (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                height: 118,
                boxSizing: "border-box",
                padding: "12px 22px",
                borderRadius: 16,
                background: isActive && !open ? COLORS.card : open ? COLORS.card : done ? COLORS.white : "transparent",
                border: `5px ${open ? "dashed" : "solid"} ${isActive || done || open ? COLORS.ink : "rgba(15,15,15,0.13)"}`,
                boxShadow: isActive && !open ? neoShadow(7) : open ? `8px 8px 0 ${COLORS.pink}` : done ? neoShadow(4) : "none",
                opacity: isActive || done || open ? 1 : 0.42,
                transform: open ? `scale(${pulse})` : "none",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  flexShrink: 0,
                  borderRadius: 999,
                  background: open ? COLORS.pink : COLORS.ink,
                  color: open ? COLORS.white : COLORS.cream,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s + 1 < 10 ? `0${s + 1}` : "10"}
              </div>

              {/* the slot's content */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}>
                {open ? (
                  demanded ? (
                    <div
                      style={{
                        display: "inline-block",
                        background: COLORS.ink,
                        borderRadius: 12,
                        padding: "8px 24px",
                        transform: `scale(${ended ? 1 : stamp}) rotate(-1.2deg)`,
                        transformOrigin: "left center",
                        fontFamily: FONTS.head,
                        fontWeight: 700,
                        fontSize: 46,
                        letterSpacing: -1.5,
                        color: COLORS.cream,
                      }}
                    >
                      YOUR TURN{caret ? " ▍" : "  "}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontFamily: FONTS.head,
                        fontWeight: 700,
                        fontSize: 42,
                        letterSpacing: -1,
                        color: COLORS.ink,
                        opacity: 0.4,
                      }}
                    >
                      {caret ? "▍" : " "} your turn
                    </div>
                  )
                ) : done ? (
                  <div
                    style={{
                      fontFamily: FONTS.head,
                      fontWeight: 700,
                      fontSize: nameSize(slot!.answer),
                      letterSpacing: -1.4,
                      color: COLORS.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      transform: s === i ? `scale(${stamp})` : "none",
                      transformOrigin: "left center",
                    }}
                  >
                    {slot!.answer}
                  </div>
                ) : isActive ? (
                  <div
                    style={{
                      fontFamily: FONTS.head,
                      fontWeight: 700,
                      fontSize: 38,
                      letterSpacing: -0.5,
                      color: COLORS.ink,
                      opacity: 0.42,
                    }}
                  >
                    {PROMPTS[s]}
                  </div>
                ) : (
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: COLORS.ink, opacity: 0.14 }} />
                )}
              </div>

              {/* live-slot clock: the 3-2-1 and the drain */}
              {isActive && !open && countdown > 0 && (
                <div
                  style={{
                    fontFamily: FONTS.head,
                    fontWeight: 700,
                    fontSize: 62,
                    letterSpacing: -3,
                    color: COLORS.ink,
                    opacity: 0.34,
                    transform: `scale(${tickPop})`,
                    flexShrink: 0,
                  }}
                >
                  {countdown}
                </div>
              )}
              {isActive && (
                <div style={{ width: 130, height: 13, flexShrink: 0, border: `4px solid ${COLORS.ink}`, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${drain * 100}%`, height: "100%", background: COLORS.ink }} />
                </div>
              )}

              {/* the tier — the escalation promise, EASY -> IMPOSSIBLE -> YOU */}
              <div
                style={{
                  flexShrink: 0,
                  background: open ? COLORS.pink : TIER_COLOR[slot!.tier],
                  color: open ? COLORS.white : TIER_FG[slot!.tier],
                  border: `4px solid ${COLORS.ink}`,
                  borderRadius: 999,
                  padding: "6px 16px",
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: 1.6,
                }}
              >
                {open ? "YOU" : slot!.tier}
              </div>
            </div>
          );
        })}
      </div>

      {/* THE CONFESSION — lands with the omission line, a stamp across the
          resolved half of the rail. Slots 5-6 are 40s gone when it arrives;
          the demand, the last links and the count strip stay clear of it. */}
      {isLast && !ended && phase >= TURN_AT && (
        <div
          style={{
            position: "absolute",
            top: 1006,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            transform: `scale(${interpolate(phase, [TURN_AT + 4, TURN_AT + 14], [0.5, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.back(2.8)),
            })}) rotate(-2deg)`,
          }}
        >
          <div
            style={{
              background: COLORS.ink,
              color: COLORS.cream,
              borderRadius: 16,
              boxShadow: `10px 10px 0 ${COLORS.pink}`,
              padding: "18px 34px",
              fontFamily: FONTS.body,
              fontWeight: 700,
              fontSize: 44,
            }}
          >
            and we left out the obvious one.
          </div>
        </div>
      )}

      {/* the running count — batch 2's surface, reused whole */}
      <CountRail resolved={resolved} justFilled={justFilled} phase={phase} answerAt={ANSWER_AT} />

      {/* THE FOLLOW HOOK — batch 2's card, reused whole (same VO line, same
          ground): the only beat in the piece that resolves upward. */}
      {follow && (
        <AbsoluteFill
          style={{
            background: COLORS.lime,
            alignItems: "center",
            justifyContent: "center",
            padding: "0 90px",
          }}
        >
          <div
            style={{
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 118,
              lineHeight: 0.92,
              letterSpacing: -5,
              color: COLORS.ink,
              textAlign: "center",
            }}
          >
            NEW GAUNTLET<br />DAILY
          </div>
          <div
            style={{
              marginTop: 44,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: 2,
              color: COLORS.ink,
              opacity: 0.7,
              textAlign: "center",
            }}
          >
            FOLLOW FOR TOMORROW&apos;S TEN
          </div>
        </AbsoluteFill>
      )}

      {/* the closing card — batch 2's two asks plus this format's third. The
          voice (cta2, reused) asks score + number ten; the card carries the
          omission ask the voice already made at 68s. */}
      {cta && (
        <AbsoluteFill
          style={{
            background: COLORS.ink,
            alignItems: "center",
            justifyContent: "center",
            padding: "0 90px",
          }}
        >
          <div
            style={{
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 168,
              lineHeight: 0.9,
              letterSpacing: -8,
              color: COLORS.lime,
              textAlign: "center",
            }}
          >
            ? / 9
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 82,
              lineHeight: 0.94,
              letterSpacing: -3,
              color: COLORS.cream,
              textAlign: "center",
            }}
          >
            YOUR SLOT 10
          </div>
          <div
            style={{
              marginTop: 30,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 33,
              letterSpacing: 2,
              color: COLORS.cream,
              opacity: 0.85,
              textAlign: "center",
            }}
          >
            PLUS THE ONE WE LEFT OUT
          </div>
          <div
            style={{
              marginTop: 34,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: 2,
              color: COLORS.lime,
              textAlign: "center",
            }}
          >
            ALL OF IT IN THE COMMENTS
          </div>
          <div
            style={{
              marginTop: 56,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: 3,
              color: COLORS.cream,
              opacity: 0.55,
            }}
          >
            CAREER PATH · VERVEQ.COM
          </div>
        </AbsoluteFill>
      )}

      {/* CTA strip — small on purpose; the comment is the ask, not the click */}
      {!ended && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1852,
            textAlign: "center",
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 25,
            letterSpacing: 3,
            color: COLORS.ink,
            opacity: 0.55,
          }}
        >
          CAREER PATH · VERVEQ.COM
        </div>
      )}
    </AbsoluteFill>
  );
};
