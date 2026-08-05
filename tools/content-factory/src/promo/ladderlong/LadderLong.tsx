import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import { Edition, editionBySlug, locate } from "./timeline";
import { cuesFor, hasVo } from "./vo";

// See timeline.ts for why this format exists and why it is ten rungs.
//
// LAYOUT LAW, inherited from `ladder` and hardened by FACELESS_WINNER_SPEC:
// the rail is on screen from frame 0 and NEVER moves. It is the promise that
// keeps a viewer past the first answer, and at ten slots it is also a
// SCOREBOARD — the viewer counts their own hits against it, which is the
// mechanic behind the best comment rate in the studied cohort (spec #26).
// The card above it is the only thing that changes, and it is a FIXED height so
// a 2-club path and a 7-club path leave the rail in exactly the same place.

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

// Whole paths are never truncated, so the type gives instead. Casting caps at
// 7 clubs (timeline.ts) which is why this table stops there.
const clubSize = (n: number): number => (n <= 2 ? 76 : n === 3 ? 68 : n === 4 ? 60 : n === 5 ? 54 : n === 6 ? 48 : 42);
// Rail names run to 16 characters (ALEXANDER-ARNOLD), so the rail shrinks too.
const railSize = (s: string): number => (s.length > 13 ? 26 : s.length > 10 ? 30 : 34);

const RailRow: React.FC<{ ed: Edition; index: number; active: number; phase: number; ended: boolean }> = ({
  ed,
  index,
  active,
  phase,
  ended,
}) => {
  const rung = ed.rungs[index];
  const ANSWER_AT = ed.grid.answerAt;
  const isLast = index === 9;
  // rung 10 never resolves — not on its own beat, not on the closing cards, never.
  const done = index < active || (index === active && !isLast && phase >= ANSWER_AT);
  const isActive = index === active && !ended;
  const stamp = interpolate(phase, [ANSWER_AT, ANSWER_AT + 8], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.4)),
  });
  const label = done ? rung.answer : isLast ? "?????" : "▓▓▓▓";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 16px",
        borderRadius: 12,
        background: isActive ? COLORS.card : "transparent",
        border: `3px solid ${isActive ? COLORS.ink : "rgba(15,15,15,0.13)"}`,
        boxShadow: isActive ? neoShadow(5) : "none",
        opacity: isActive || done ? 1 : 0.48,
        height: 70,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          flexShrink: 0,
          borderRadius: 8,
          background: TIER_COLOR[rung.tier],
          color: TIER_FG[rung.tier],
          border: `3px solid ${COLORS.ink}`,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {index + 1}
      </div>
      <div
        style={{
          fontFamily: FONTS.head,
          fontWeight: 700,
          fontSize: railSize(label),
          letterSpacing: -0.5,
          color: COLORS.ink,
          whiteSpace: "nowrap",
          overflow: "hidden",
          transform: done && isActive ? `scale(${stamp})` : "none",
          transformOrigin: "left center",
        }}
      >
        {label}
      </div>
    </div>
  );
};

// THE SCORE RAIL — batch 2 only, and the reason batch 2 exists.
//
// The ten-slot answer rail above already IS a scoreboard in spec #26's sense,
// but it scores US: it fills with the answers the video gives away. Nothing on
// screen ever asked the viewer for a NUMBER, so only the people who survived to
// the withhold at 68s had anything to type. This strip is the cheap fix — it
// states the denominator from frame 0, fills a pip per resolved rung, and turns
// every exit point into a comment ("6/9" is typeable at rung 6 by someone who
// is about to scroll). Nine pips, not ten: rung 10 is withheld, so it is not
// something a viewer can have scored, and "/9" has to match what the voice asks
// for at the close.
const ScoreRail: React.FC<{ ed: Edition; active: number; phase: number; ended: boolean }> = ({
  ed,
  active,
  phase,
  ended,
}) => {
  const ANSWER_AT = ed.grid.answerAt;
  const justFilled = !ended && active < 9 && phase >= ANSWER_AT;
  const resolved = ended ? 9 : Math.min(9, active + (justFilled ? 1 : 0));
  const pop = interpolate(phase, [ANSWER_AT, ANSWER_AT + 9], [0.55, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(3)),
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 1472,
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
        padding: "16px 24px",
      }}
    >
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 2, color: COLORS.ink, opacity: 0.72 }}>
        KEEP SCORE
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
                height: 30,
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
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 46, letterSpacing: -2, color: COLORS.ink }}>?/9</div>
    </div>
  );
};

export const LadderLong: React.FC<{ slug?: string }> = ({ slug = "all-timers" }) => {
  const ed = editionBySlug(slug);
  const g = ed.grid;
  const { clubIn: CLUB_IN, clubGap: CLUB_GAP, thinkAt: THINK_AT, tickAt: TICK_AT, answerAt: ANSWER_AT } = g;
  const WITHHELD_AT = ANSWER_AT; // rung 10: the demand lands where an answer would
  const b2 = ed.batch === 2;
  const frame = useCurrentFrame();
  const { i, phase, follow, cta } = locate(frame, ed);
  const ended = follow || cta; // either closing card is up; the rung grid is done
  const rung = ed.rungs[i];
  const isLast = i === 9;

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
  const turnPop = interpolate(phase, [WITHHELD_AT, WITHHELD_AT + 12], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2.6)),
  });
  const caret = Math.floor(frame / 8) % 2 === 0;

  // The drain bar. Rung 1 drains from frame 0 — a scroller must see motion
  // before they have decided whether to keep scrolling (spec #8, 4/4 winners).
  const thinkEnd = isLast ? WITHHELD_AT : ANSWER_AT;
  const drain = interpolate(phase, [i === 0 ? 0 : THINK_AT, thinkEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3-2-1. Shown in the answer slot until the answer takes it.
  const tickIdx = TICK_AT.filter((t) => phase >= t).length; // 0..3
  const countdown = tickIdx > 0 && phase < thinkEnd ? 3 - tickIdx + 1 : 0;
  const tickPop = interpolate(phase - (TICK_AT[tickIdx - 1] ?? 0), [0, 7], [1.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const cues = cuesFor(ed);

  return (
    <AbsoluteFill style={{ background: COLORS.cream }}>
      {/* one bed per edition — the club slams land on each club, and the four
          editions have different path lengths (see promo/ladderlong-audio.mjs) */}
      <Audio src={staticFile(`promo/ladderlong-${ed.slug}.wav`)} />
      {/* VO cues. Absent until promo/ladderlong-vo.mjs has been run with a
          FAL_KEY — the piece renders silent-but-complete without them. */}
      {hasVo &&
        cues.map((c) => (
          <Sequence key={c.key} from={c.at} name={`vo:${c.key}`}>
            <Audio src={staticFile(`promo/vo-ll/${c.key}.mp3`)} />
          </Sequence>
        ))}

      {/* header — the promise, readable at frame 0, static for the whole run */}
      <div style={{ position: "absolute", top: 56, left: 60, right: 60 }}>
        <div
          style={{
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 88,
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
            fontSize: 25,
            letterSpacing: 1.4,
            color: COLORS.ink,
            opacity: 0.6,
            marginTop: 12,
          }}
        >
          10 CAREER PATHS. THEY GET WORSE.
        </div>
      </div>

      {/* the card — fixed height so the rail never moves */}
      <div
        style={{
          position: "absolute",
          top: 306,
          left: 60,
          right: 60,
          height: 700,
          transform: `scale(${cardIn})`,
          transformOrigin: "center top",
          opacity: ended ? 0.25 : 1,
        }}
      >
        <div
          style={{
            height: "100%",
            boxSizing: "border-box",
            background: COLORS.card,
            border: `6px solid ${COLORS.ink}`,
            borderRadius: 22,
            boxShadow: neoShadow(12),
            padding: "24px 30px 26px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* tier + drain bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div
              style={{
                background: TIER_COLOR[rung.tier],
                color: TIER_FG[rung.tier],
                border: `4px solid ${COLORS.ink}`,
                borderRadius: 999,
                padding: "7px 24px",
                fontFamily: FONTS.mono,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: 2,
              }}
            >
              {rung.tier}
            </div>
            <div style={{ width: 230, height: 17, border: `4px solid ${COLORS.ink}`, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${drain * 100}%`, height: "100%", background: COLORS.ink }} />
            </div>
          </div>

          {/* the clubs — vertically centred so short and long paths both sit well */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {rung.clubs.map((club, c) => {
              // Rung 1 is pre-placed: at frame 0 a scroller must see a COMPLETE
              // puzzle, not an empty card animating toward one.
              const at = CLUB_IN + c * CLUB_GAP;
              const s =
                i === 0
                  ? 1
                  : interpolate(phase, [at, at + 9], [0.86, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.out(Easing.back(2.2)),
                    });
              const o =
                i === 0
                  ? 1
                  : interpolate(phase, [at, at + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const fs = clubSize(rung.clubs.length);
              return (
                <div
                  key={`${i}-${c}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 8,
                    opacity: o,
                    transform: `scale(${s})`,
                    transformOrigin: "left center",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 999,
                      background: COLORS.ink,
                      color: COLORS.cream,
                      fontFamily: FONTS.mono,
                      fontWeight: 700,
                      fontSize: 20,
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
                      fontSize: fs,
                      letterSpacing: -1.4,
                      color: COLORS.ink,
                      lineHeight: 1.08,
                    }}
                  >
                    {club}
                  </div>
                </div>
              );
            })}
          </div>

          {/* the answer slot — 3-2-1, then either the answer or the demand */}
          <div style={{ minHeight: 118, display: "flex", alignItems: "center" }}>
            {countdown > 0 && (
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 92,
                  letterSpacing: -4,
                  color: COLORS.ink,
                  opacity: 0.32,
                  transform: `scale(${tickPop})`,
                  transformOrigin: "left center",
                }}
              >
                {countdown}
              </div>
            )}
            {answered && (
              <div
                style={{
                  display: "inline-block",
                  background: COLORS.lime,
                  border: `5px solid ${COLORS.ink}`,
                  borderRadius: 16,
                  boxShadow: neoShadow(8),
                  padding: "12px 30px",
                  transform: `scale(${answerPop}) rotate(-1.5deg)`,
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: rung.answer.length > 12 ? 48 : 62,
                  letterSpacing: -2,
                  color: COLORS.ink,
                }}
              >
                {rung.answer}
              </div>
            )}
            {isLast && phase >= WITHHELD_AT && (
              <div
                style={{
                  display: "inline-block",
                  background: COLORS.ink,
                  border: `5px solid ${COLORS.ink}`,
                  borderRadius: 16,
                  boxShadow: `8px 8px 0 ${COLORS.pink}`,
                  padding: "12px 30px",
                  transform: `scale(${turnPop}) rotate(-1.5deg)`,
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 56,
                  letterSpacing: -2,
                  color: COLORS.cream,
                }}
              >
                YOU TELL ME{caret ? " ▍" : "  "}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* THE RAIL / SCOREBOARD — two columns of five, on screen from frame 0,
          never moves. Mirrors the 10-slot answer sheet that carried the best
          comment rate in the studied cohort. */}
      <div style={{ position: "absolute", top: 1050, left: 60, right: 60, display: "flex", gap: 26 }}>
        {[0, 1].map((col) => (
          <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
            {[0, 1, 2, 3, 4].map((r) => (
              <RailRow key={r} ed={ed} index={col * 5 + r} active={i} phase={phase} ended={ended} />
            ))}
          </div>
        ))}
      </div>

      {/* the running score — batch 2's addition, see ScoreRail above */}
      {b2 && <ScoreRail ed={ed} active={i} phase={phase} ended={ended} />}

      {/* THE FOLLOW HOOK — batch 2 only, and deliberately BEFORE the ask.
          It is a content promise, not a brand plea: the reason to follow is
          that there is another one of these tomorrow, which is the only thing
          a viewer who just played one actually wants. Lime ground so it reads
          as a different beat from the ink CTA that follows it, and it holds for
          2.00s — long enough to read, too short to scroll away in. */}
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

      {/* the closing card — the comment ask, arriving as the clock empties.
          Batch 2 asks for TWO things, because they cost the same breath and
          they catch different viewers: the score catches everyone who played
          any of it, the name catches only the ones who lasted. Both are one
          word to type, which is spec #23's actual requirement. */}
      {cta && (
        <AbsoluteFill
          style={{
            background: COLORS.ink,
            alignItems: "center",
            justifyContent: "center",
            padding: "0 90px",
          }}
        >
          {b2 ? (
            <>
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
                  fontSize: 86,
                  lineHeight: 0.94,
                  letterSpacing: -3,
                  color: COLORS.cream,
                  textAlign: "center",
                }}
              >
                AND NUMBER 10
              </div>
              <div
                style={{
                  marginTop: 40,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 34,
                  letterSpacing: 2,
                  color: COLORS.lime,
                  textAlign: "center",
                }}
              >
                BOTH IN THE COMMENTS
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 104,
                  lineHeight: 0.94,
                  letterSpacing: -4,
                  color: COLORS.cream,
                  textAlign: "center",
                }}
              >
                NUMBER 10<br />IS IN THE<br />COMMENTS
              </div>
              <div
                style={{
                  marginTop: 40,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 32,
                  letterSpacing: 2,
                  color: COLORS.lime,
                  textAlign: "center",
                }}
              >
                HOW FAR DID YOU GET?
              </div>
            </>
          )}
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

      {/* CTA strip — deliberately small; the comment is the ask, not the click */}
      {!ended && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1806,
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
