// MISSING LETTERS — name the player from a half-empty name board. Ten rounds,
// easy → impossible: more letters go missing each tier and the IMPOSSIBLE
// round hides the initials too. Each round: the board + a nation clue are on
// screen from the cut (round 1 from frame 0), a 4s clock drains, then the
// missing tiles fill in lime one by one. Spelling and clue are gated by
// lab/letters-facts.mjs (Wikidata label = enwiki title; Wikidata P1532).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, Closer, FONTS, Ground, Middle, Pips, Stage, STAGE_W, Stripes, TimerBar, Topline, neoShadow, shake, spr } from "../kit";
import GRID from "../grid.json";
import FACTS from "./facts.json";

const G = GRID.letters;
const FPS = GRID.fps;
const R = FACTS.rounds;
const N = R.length;
export const LETTERS_TOTAL = N * G.round + G.closer;

const TIER: Record<string, { bg: string; fg: string }> = {
  EASY: { bg: COLORS.green, fg: COLORS.white },
  MEDIUM: { bg: COLORS.yellow, fg: COLORS.ink },
  HARD: { bg: COLORS.red, fg: COLORS.white },
  IMPOSSIBLE: { bg: COLORS.ink, fg: COLORS.lime },
};

const Round: React.FC<{ ri: number }> = ({ ri }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = R[ri];
  const tier = TIER[r.tier];
  const cold = ri === 0;
  const accent = tier.bg === COLORS.ink ? COLORS.lime : tier.bg;
  const revealed = frame >= G.revealAt;
  const timerFrac = 1 - interpolate(frame, [0, G.timerTo], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const land = cold ? 1 : spr(frame, fps, 0, 10, 14);
  const heat = frame >= G.timerTo - 30 && !revealed;
  const longest = Math.max(...r.words.map((w) => w.length));
  const gapPx = 10;
  const tile = Math.min(124, Math.floor((STAGE_W - (longest - 1) * gapPx) / longest));
  let hiddenIdx = 0;
  const done = revealed && frame >= G.revealAt + r.words.flat().filter((t) => t.hide).length * G.fillStep + 6;
  const stamp = spr(frame, fps, G.revealAt + r.words.flat().filter((t) => t.hide).length * G.fillStep + 6, 9, 14);
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
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 76, lineHeight: 0.9, letterSpacing: -4, color: COLORS.cream }}>NAME HIM</div>
            <div style={{ background: tier.bg, color: tier.fg, border: `4px solid ${tier.bg === COLORS.ink ? COLORS.lime : COLORS.ink}`, borderRadius: 12, padding: "10px 18px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, boxShadow: neoShadow(5) }}>{r.tier}</div>
          </div>
          <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: "hsl(30 100% 97% / .6)" }}>CLUE</span>
            <span style={{ background: COLORS.cream, color: COLORS.ink, border: `4px solid ${COLORS.ink}`, borderRadius: 10, padding: "6px 16px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 34, letterSpacing: 1, boxShadow: neoShadow(4) }}>{r.nation.toUpperCase()}</span>
          </div>
          <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", transform: `translateY(${(1 - land) * 50}px)`, opacity: Math.min(1, land * 2) }}>
            {r.words.map((w, wi) => (
              <div key={wi} style={{ display: "flex", gap: gapPx }}>
                {w.map((t, ti) => {
                  const my = t.hide ? hiddenIdx++ : -1;
                  const at = G.revealAt + my * G.fillStep;
                  const filled = !t.hide || frame >= at;
                  const pop = t.hide ? spr(frame, fps, at, 9, 16) : 1;
                  const sh = t.hide && frame >= at ? shake(frame, at, 3, 5) : { x: 0, y: 0 };
                  const idle = !t.hide || filled ? 0 : Math.sin((frame + ti * 5 + wi * 11) / 7) * 3;
                  return (
                    <div
                      key={ti}
                      style={{
                        width: tile,
                        height: Math.round(tile * 1.22),
                        borderRadius: 12,
                        border: `5px solid ${t.hide && !filled ? "hsl(30 100% 97% / .55)" : COLORS.ink}`,
                        borderStyle: t.hide && !filled ? "dashed" : "solid",
                        background: !t.hide ? COLORS.cream : filled ? COLORS.lime : "hsl(0 0% 100% / .05)",
                        color: COLORS.ink,
                        boxShadow: !t.hide || filled ? neoShadow(5) : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: FONTS.head,
                        fontWeight: 700,
                        fontSize: Math.round(tile * 0.78),
                        transform: `translate(${sh.x}px, ${sh.y + idle}px) scale(${t.hide && filled ? 0.7 + 0.3 * pop : 1})`,
                      }}
                    >
                      {filled ? t.c : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48, minHeight: 74, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!revealed ? (
              <div style={{ width: "100%", transform: `scale(${heat ? 1 + 0.015 * Math.sin(frame * 1.3) : 1})` }}>
                <TimerBar frac={timerFrac} color={timerFrac < 0.3 ? COLORS.red : COLORS.lime} border={COLORS.cream} height={26} />
              </div>
            ) : done ? (
              <div style={{ transform: `scale(${0.5 + 0.5 * stamp}) rotate(${-2 * (1 - stamp)}deg)`, opacity: Math.min(1, stamp * 2) }}>
                <div style={{ background: COLORS.cream, color: COLORS.ink, border: `5px solid ${COLORS.ink}`, borderRadius: 16, padding: "12px 28px", boxShadow: neoShadow(8), fontFamily: FONTS.head, fontWeight: 700, fontSize: 44, letterSpacing: -1 }}>
                  GOT IT? +1
                </div>
              </div>
            ) : null}
          </div>
        </Middle>
        <Bottom>
          <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: "hsl(30 100% 97% / .62)" }}>
            {r.tier === "IMPOSSIBLE" ? "NO INITIALS THIS TIME" : "FILL THE GAPS BEFORE THE CLOCK"}
          </div>
        </Bottom>
      </Stage>
      {!cold && <div style={{ position: "absolute", inset: 0, background: accent, opacity: interpolate(frame, [0, 4], [0.28, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

export const MissingLetters: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/lab-letters.wav")} />
    {R.map((_, i) => (
      <Sequence key={i} from={i * G.round} durationInFrames={G.round} premountFor={FPS}>
        <Round ri={i} />
      </Sequence>
    ))}
    <Sequence from={N * G.round} durationInFrames={G.closer} premountFor={FPS}>
      <Closer line1="HOW MANY?" line2="0 TO 10. COMMENTS." sub="NO GOOGLING. WE CAN TELL." />
    </Sequence>
  </AbsoluteFill>
);
