import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import {
  ANSWER_AT,
  CLUB_GAP,
  CLUB_IN,
  CTA_AT,
  Edition,
  STEP,
  THINK_AT,
  TICK_AT,
  WITHHELD_AT,
  editionBySlug,
  locate,
} from "./timeline";
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

const RailRow: React.FC<{ ed: Edition; index: number; active: number; phase: number; cta: boolean }> = ({
  ed,
  index,
  active,
  phase,
  cta,
}) => {
  const rung = ed.rungs[index];
  const isLast = index === 9;
  // rung 10 never resolves — not on its own beat, not on the CTA card, never.
  const done = index < active || (index === active && !isLast && phase >= ANSWER_AT);
  const isActive = index === active && !cta;
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

export const LadderLong: React.FC<{ slug?: string }> = ({ slug = "all-timers" }) => {
  const ed = editionBySlug(slug);
  const frame = useCurrentFrame();
  const { i, phase, cta } = locate(frame);
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

  const cues = cuesFor(ed.slug, { step: STEP, answerAt: ANSWER_AT, withheldAt: WITHHELD_AT, ctaAt: CTA_AT });

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
          opacity: cta ? 0.25 : 1,
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
              <RailRow key={r} ed={ed} index={col * 5 + r} active={i} phase={phase} cta={cta} />
            ))}
          </div>
        ))}
      </div>

      {/* the closing card — the one comment ask, arriving as the clock empties */}
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
      {!cta && (
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
