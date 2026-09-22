// WHO'S OLDER? — the streak duel. Ten head-to-heads, one binary call each,
// resolved on screen with both birth dates (Wikidata P569, day precision —
// lab/older-facts.mjs). The gap between the two dates shrinks every round —
// seventeen years down to nine days — and that shrinking gap IS the
// escalation label. The ten-pip rail across the top is the scoreboard: the
// viewer counts their own streak against it and types the number.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, Closer, FONTS, Ground, Middle, Pips, Stage, Stripes, TimerBar, Topline, neoShadow, shake, spr } from "../kit";
import GRID from "../grid.json";
import FACTS from "./facts.json";

const G = GRID.older;
const FPS = GRID.fps;
const R = FACTS.rounds;
const N = R.length;
export const OLDER_TOTAL = N * G.round + G.closer;

const tierOf = (n: number) => (n <= 3 ? { label: "EASY", bg: COLORS.green, fg: COLORS.white } : n <= 6 ? { label: "CLOSE", bg: COLORS.yellow, fg: COLORS.ink } : n <= 9 ? { label: "TIGHT", bg: COLORS.red, fg: COLORS.white } : { label: "IMPOSSIBLE", bg: COLORS.ink, fg: COLORS.lime });

// `cold` = round 1: the pair is ALREADY on the board at frame 0 (spec #9 — frame 0
// states the game); later rounds slam in on the cut.
const Card: React.FC<{ side: "a" | "b"; round: (typeof R)[number]; frame: number; fps: number; delay: number; cold?: boolean }> = ({ side, round, frame, fps, delay, cold }) => {
  const p = round[side];
  const revealed = frame >= G.revealAt;
  const isOlder = round.older === side;
  const land = cold ? 1 : spr(frame, fps, delay, 10, 14);
  const sh = cold ? { x: 0, y: 0 } : shake(frame, delay, 6, 8);
  const rv = spr(frame, fps, G.revealAt, 9, 14);
  const rsh = shake(frame, G.revealAt, 6, 9);
  const bg = side === "a" ? COLORS.blue : COLORS.pink;
  const dim = revealed && !isOlder ? interpolate(rv, [0, 1], [1, 0.42]) : 1;
  // a vertical lift, never a scale: a 952-wide card scaled 1.03 puts its lime
  // border inside both chrome strips (the DILEMMA gate's lesson, re-learned here)
  const lift = revealed && isOlder ? -8 * rv : 0;
  const from = side === "a" ? -1 : 1;
  // a small idle float keeps the pair alive between the land and the reveal —
  // and is what makes frame 0 of a cold round measurably in motion
  const idle = revealed ? 0 : Math.sin((frame + (side === "a" ? 0 : 14)) / 8) * 4;
  return (
    <div
      style={{
        transform: `translate(${sh.x + rsh.x * (isOlder ? 1 : 0.3)}px, ${(1 - land) * 60 * from + sh.y + lift + idle}px) scale(${0.9 + 0.1 * land})`,
        opacity: Math.min(1, land * 2) * dim,
        background: bg,
        color: COLORS.white,
        border: `6px solid ${revealed && isOlder ? COLORS.lime : COLORS.ink}`,
        borderRadius: 22,
        boxShadow: neoShadow(revealed && isOlder ? 12 : 8),
        height: 330,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: p.show.length > 10 ? 78 : 96, lineHeight: 0.9, letterSpacing: -4, textShadow: `6px 6px 0 ${COLORS.ink}`, transform: `translateY(${revealed ? -22 * rv : 0}px)` }}>{p.show}</div>
      {revealed && (
        <div style={{ marginTop: 18, transform: `scale(${0.6 + 0.4 * rv})`, opacity: Math.min(1, rv * 2) }}>
          <div style={{ background: COLORS.cream, color: COLORS.ink, border: `4px solid ${COLORS.ink}`, borderRadius: 12, padding: "8px 20px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, boxShadow: neoShadow(5), fontVariantNumeric: "tabular-nums" }}>{p.date}</div>
        </div>
      )}
      {revealed && isOlder && (
        <div style={{ position: "absolute", top: 14, right: 16, transform: `rotate(${-8 + 4 * rv}deg) scale(${0.5 + 0.5 * rv})`, opacity: Math.min(1, rv * 2) }}>
          <div style={{ background: COLORS.lime, color: COLORS.ink, border: `4px solid ${COLORS.ink}`, borderRadius: 12, padding: "8px 18px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 34, letterSpacing: 1, boxShadow: neoShadow(5) }}>OLDER</div>
        </div>
      )}
    </div>
  );
};

const Round: React.FC<{ ri: number }> = ({ ri }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = R[ri];
  const tier = tierOf(r.n);
  const cold = ri === 0;
  // round 1 has no land-in, so its clock starts at frame 0
  const timerFrac = 1 - interpolate(frame, [cold ? 0 : G.timerFrom, G.timerTo], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const revealed = frame >= G.revealAt;
  const gap = spr(frame, fps, G.gapAt, 9, 14);
  const vs = cold ? 1 : spr(frame, fps, 6, 8, 14);
  const vsPulse = revealed ? 1 : 1 + 0.06 * Math.sin(frame / 2.5);
  const heat = frame >= G.timerTo - 30 && frame < G.revealAt;
  const accent = tier.bg === COLORS.ink ? COLORS.lime : tier.bg;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={ri * G.round + frame} color={accent} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <Stage>
        <Topline right={`ROUND ${r.n} / ${N}`} accent={COLORS.lime} />
        <div style={{ marginTop: 18 }}>
          <Pips n={N} done={ri} current={ri} />
        </div>
        <Middle top={110} bottom={70}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, lineHeight: 0.9, letterSpacing: -4, color: COLORS.cream }}>WHO&apos;S OLDER?</div>
            <div style={{ background: tier.bg, color: tier.fg, border: `4px solid ${tier.bg === COLORS.ink ? COLORS.lime : COLORS.ink}`, borderRadius: 12, padding: "10px 18px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, boxShadow: neoShadow(5) }}>{tier.label}</div>
          </div>
          <div style={{ marginTop: 26, position: "relative" }}>
            <Card side="a" round={r} frame={frame} fps={fps} delay={0} cold={cold} />
            <div style={{ height: 34 }} />
            <Card side="b" round={r} frame={frame} fps={fps} delay={4} cold={cold} />
            {/* the VS hinge, sat on the seam */}
            <div style={{ position: "absolute", left: "50%", top: 330 + 17, transform: `translate(-50%, -50%) scale(${(0.5 + 0.5 * vs) * vsPulse}) rotate(${-6 * (1 - vs)}deg)` }}>
              <div style={{ width: 118, height: 118, borderRadius: 60, background: revealed ? COLORS.lime : COLORS.cream, color: COLORS.ink, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(7), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 46, letterSpacing: -2 }}>VS</div>
            </div>
          </div>
          <div style={{ marginTop: 30, minHeight: 74, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!revealed ? (
              <div style={{ width: "100%", transform: `scale(${heat ? 1 + 0.015 * Math.sin(frame * 1.3) : 1})` }}>
                <TimerBar frac={timerFrac} color={timerFrac < 0.3 ? COLORS.red : COLORS.lime} border={COLORS.cream} height={26} />
              </div>
            ) : (
              <div style={{ transform: `scale(${0.5 + 0.5 * gap}) rotate(${-2 * (1 - gap)}deg)`, opacity: Math.min(1, gap * 2) }}>
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 16, background: COLORS.cream, color: COLORS.ink, border: `5px solid ${COLORS.ink}`, borderRadius: 16, padding: "12px 28px", boxShadow: neoShadow(8) }}>
                  <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, opacity: 0.6 }}>GAP</span>
                  <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: r.gapDays < 30 ? 60 : 50, letterSpacing: -2, color: r.gapDays < 30 ? COLORS.red : COLORS.ink }}>{r.gap}</span>
                </div>
              </div>
            )}
          </div>
        </Middle>
        <Bottom>
          <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: "hsl(30 100% 97% / .62)" }}>
            {revealed ? "THE GAP SHRINKS EVERY ROUND" : "PICK ONE. COUNT YOUR STREAK."}
          </div>
        </Bottom>
      </Stage>
      {!cold && <div style={{ position: "absolute", inset: 0, background: accent, opacity: interpolate(frame, [0, 4], [0.28, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

export const WhosOlder: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/lab-older.wav")} />
    {R.map((_, i) => (
      <Sequence key={i} from={i * G.round} durationInFrames={G.round} premountFor={FPS}>
        <Round ri={i} />
      </Sequence>
    ))}
    <Sequence from={N * G.round} durationInFrames={G.closer} premountFor={FPS}>
      <Closer line1="YOUR STREAK?" line2="0 TO 10. COMMENTS." sub="TEN OUT OF TEN AND WE DON'T BELIEVE YOU" />
    </Sequence>
  </AbsoluteFill>
);
