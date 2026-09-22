// GUESS WHO — the deduction board. Nine famous names are on screen at frame 0,
// one of them is the mystery player, and six yes/no questions cut the board
// down in front of the viewer: 9 → 7 → 5 → 4 → 3 → 2. Every answer is a fact
// computed from the app's dataset (lab/guesswho-facts.mjs) — and the sixth
// answer is shown but NOT applied to the board. Two names stand; the viewer
// makes the last cut in the comments. The secret is never written anywhere
// in this composition: the reel resolves to a pair, never to a name.
import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, Closer, FONTS, Ground, Middle, Pill, Stage, Stripes, TimerBar, Topline, neoShadow, shake, spr } from "../kit";
import GRID from "../grid.json";
import FACTS from "./facts.json";

const G = GRID.guesswho;
const FPS = GRID.fps;
const QS = FACTS.questions;
const N = QS.length;
const qDur = (i: number) => (i === N - 1 ? G.qLast : G.q);
const qStart = (i: number) => {
  let acc = 0;
  for (let k = 0; k < i; k++) acc += qDur(k);
  return acc;
};
export const GUESSWHO_TOTAL = qStart(N) + G.closer;
export const GUESSWHO_STARTS = Array.from({ length: N }, (_, i) => qStart(i));

const TILE_W = 308;
const TILE_H = 196;
const GAP = 14;

// which tiles are already out before question i
const outBefore = (i: number) => {
  const s = new Set<number>();
  for (let k = 0; k < i; k++) for (const idx of QS[k].eliminated) s.add(idx);
  return s;
};

const Tile: React.FC<{ idx: number; state: "alive" | "out" | "flipping" | "finalist"; flipP: number; frame: number; pulse: number }> = ({ idx, state, flipP, frame, pulse }) => {
  const p = FACTS.board[idx];
  const idle = Math.sin((frame + idx * 11) / 9) * 2.5;
  const mid = flipP >= 0.5;
  const sy = Math.max(0.03, Math.abs(1 - 2 * flipP));
  const dead = state === "out" || (state === "flipping" && mid);
  const bg = dead ? COLORS.red : state === "finalist" ? COLORS.lime : COLORS.ink;
  const fg = dead ? "hsl(30 100% 97% / .55)" : state === "finalist" ? COLORS.ink : COLORS.cream;
  const border = state === "finalist" ? COLORS.ink : dead ? "hsl(0 0% 7%)" : COLORS.ink;
  const fin = state === "finalist" ? 1 + 0.035 * Math.sin(frame / 3 + idx) : 1;
  return (
    <div
      style={{
        width: TILE_W,
        height: TILE_H,
        transform: `translateY(${dead ? 0 : idle}px) scaleY(${state === "flipping" ? sy : 1}) scale(${pulse * fin})`,
        background: bg,
        color: fg,
        border: `5px solid ${border}`,
        borderRadius: 16,
        boxShadow: dead ? "none" : neoShadow(state === "finalist" ? 9 : 7),
        position: "relative",
        overflow: "hidden",
        opacity: dead ? 0.82 : 1,
      }}
    >
      <div style={{ position: "absolute", top: 10, left: 14, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 16, letterSpacing: 2, opacity: 0.55 }}>0{idx + 1}</div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: p.show.length > 10 ? 34 : 40, lineHeight: 1, letterSpacing: -1, textDecoration: dead ? "line-through" : "none", textDecorationThickness: 5 }}>{p.show}</div>
      </div>
      {dead && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.85 }}>
          <path d="M8 8 L92 92 M92 8 L8 92" stroke={COLORS.cream} strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {state === "finalist" && (
        <div style={{ position: "absolute", top: 8, right: 12, fontFamily: FONTS.head, fontWeight: 700, fontSize: 30, color: COLORS.ink }}>?</div>
      )}
    </div>
  );
};

const Question: React.FC<{ qi: number }> = ({ qi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const q = QS[qi];
  const dur = qDur(qi);
  const before = outBefore(qi);
  const aliveBefore = 9 - before.size;
  const timerFrac = 1 - interpolate(frame, [0, G.timer], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stamp = spr(frame, fps, G.stampAt, 9, 14);
  const sh = shake(frame, G.stampAt, 10, 9);
  const yes = q.answer === "YES";
  // flips
  const flipP = (idx: number) => {
    const j = q.eliminated.indexOf(idx);
    if (j < 0) return -1;
    const at = G.flipStart + j * G.flipStep;
    return interpolate(frame, [at, at + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  };
  const flipped = q.eliminated.filter((idx) => flipP(idx) >= 0.5).length;
  const left = q.withheld ? aliveBefore : aliveBefore - flipped;
  const allFlippedAt = G.flipStart + q.eliminated.length * G.flipStep + 6;
  const survivorPulse = q.withheld ? 0 : spr(frame, fps, allFlippedAt, 8, 12);
  const holdCard = q.withheld ? spr(frame, fps, G.holdCardAt, 10, 14) : 0;
  const lastSeconds = frame < G.timer && frame > G.timer - 30;
  const urgency = lastSeconds ? 1 + 0.02 * Math.sin(frame * 1.2) : 1;
  const accent = q.withheld ? COLORS.red : COLORS.yellow;

  return (
    <AbsoluteFill>
      <Ground color={COLORS.cream}>
        <Stripes frame={qStart(qi) + frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.045} />
      </Ground>
      <Stage>
        <Topline light right={`Q${qi + 1} / ${N}`} />
        <Middle bottom={64}>
          {/* question card */}
          <div style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${urgency})` }}>
            <div style={{ display: "flex", alignItems: "stretch", gap: 14 }}>
              <div style={{ flex: 1, background: COLORS.ink, color: COLORS.cream, border: `5px solid ${COLORS.ink}`, borderRadius: 18, boxShadow: neoShadow(9), padding: "26px 28px", display: "flex", alignItems: "center", minHeight: 150 }}>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: q.text.length > 20 ? 50 : 56, lineHeight: 0.98, letterSpacing: -2 }}>{q.text}</div>
              </div>
              <div style={{ width: 210, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {frame < G.stampAt ? (
                  <div style={{ width: 190, height: 150, borderRadius: 18, border: `5px dashed hsl(0 0% 7% / .45)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, color: "hsl(0 0% 7% / .35)" }}>?</div>
                ) : (
                  <div style={{ transform: `scale(${0.4 + 0.6 * stamp}) rotate(${-8 * (1 - stamp) - 3}deg)`, opacity: Math.min(1, stamp * 2) }}>
                    <div style={{ width: 190, height: 150, borderRadius: 18, background: yes ? COLORS.green : COLORS.red, color: COLORS.white, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(9), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -2 }}>{q.answer}</div>
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <TimerBar frac={timerFrac} color={timerFrac < 0.25 ? COLORS.red : accent} track="hsl(0 0% 7% / .12)" />
            </div>
          </div>

          {/* the board */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: `repeat(3, ${TILE_W}px)`, gap: GAP, justifyContent: "center" }}>
            {FACTS.board.map((t) => {
              const fp = flipP(t.i);
              const isOut = before.has(t.i);
              const isFinalist = q.withheld && FACTS.finalists.includes(t.i) && frame >= G.holdCardAt;
              const state = isOut ? "out" : fp >= 0 ? "flipping" : isFinalist ? "finalist" : "alive";
              const survivor = !isOut && fp < 0 && !q.withheld;
              const pulse = survivor ? 1 + 0.035 * Math.sin(Math.PI * Math.min(1, survivorPulse)) : 1;
              return <Tile key={t.i} idx={t.i} state={state} flipP={fp} frame={qStart(qi) + frame} pulse={pulse} />;
            })}
          </div>

          {/* the withheld card — rides in over the board's foot on Q6 */}
          {q.withheld && (
            <div style={{ marginTop: 22, transform: `translateY(${(1 - holdCard) * 30}px) scale(${0.85 + 0.15 * holdCard})`, opacity: Math.min(1, holdCard * 2) }}>
              <div style={{ background: COLORS.red, color: COLORS.cream, border: `5px solid ${COLORS.ink}`, borderRadius: 16, boxShadow: neoShadow(9), padding: "18px 24px", textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 44, letterSpacing: -1, lineHeight: 1 }}>
                I&apos;M NOT FLIPPING THIS ONE.
              </div>
            </div>
          )}
        </Middle>
        <Bottom>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: "hsl(0 0% 7% / .7)" }}>{q.withheld ? "YOUR CUT. COMMENTS." : "ONE OF THESE IS HIM."}</div>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 40, letterSpacing: -1, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ display: "inline-block", minWidth: 50, textAlign: "right", color: left <= 2 ? COLORS.red : COLORS.ink }}>{left}</span> LEFT
            </div>
          </div>
        </Bottom>
      </Stage>
      {/* every question after the first opens on a hard cut; a three-frame ink flash
          sells it. NEVER on Q1: frame 0 is the hook and must be the clean board. */}
      {qi > 0 && <div style={{ position: "absolute", inset: 0, background: COLORS.ink, opacity: interpolate(frame, [0, 3], [0.35, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

const GuessWhoCloser: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chips = spr(frame, fps, 30, 10, 14);
  return (
    <AbsoluteFill>
      <Closer line1="WHICH ONE IS HE?" line2="COMMENTS." accent={COLORS.red} />
      <Stage>
        <Bottom style={{ bottom: 90 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, transform: `scale(${0.7 + 0.3 * chips})`, opacity: Math.min(1, chips * 2) }}>
            {FACTS.finalists.map((i) => (
              <Pill key={i} bg={COLORS.cream} fg={COLORS.ink} size={30}>{FACTS.board[i].show}</Pill>
            ))}
          </div>
        </Bottom>
      </Stage>
    </AbsoluteFill>
  );
};

export const GuessWho: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.cream }}>
    <Audio src={staticFile("promo/lab-guesswho.wav")} />
    {QS.map((_, i) => (
      <Sequence key={i} from={qStart(i)} durationInFrames={qDur(i)} premountFor={FPS}>
        <Question qi={i} />
      </Sequence>
    ))}
    <Sequence from={qStart(N)} durationInFrames={G.closer} premountFor={FPS}>
      <GuessWhoCloser />
    </Sequence>
  </AbsoluteFill>
);
