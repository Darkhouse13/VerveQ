// PAUSE IT — THAT'S YOUR NEW STRIKER. A 10.0s seamless loop: 25 name cards
// (23 real forwards, clubs from PROD via lab/pause-facts.mjs, + 2 joke cards)
// flicker past at 4 frames each (7.5 a second) in three differently-shuffled
// passes. Every card gets exactly 12 frames of the 300, so a pause is a fair
// draw. Every single frame is a finished, legible card (hard cuts, no
// transition frames) — whatever frame the viewer stops on IS the screenshot.
//
// Loop law: nothing here depends on absolute time except through a period that
// divides 300 (stripes drift one full tile per loop, pulses run on 30f), so
// frame 299 → frame 0 is just another card cut.
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Bottom, COLORS, FONTS, Middle, Stage, Topline, neoShadow } from "../kit";
import FACTS from "./facts.json";

const FPC = FACTS.framesPerCard;
export const PAUSE_TOTAL = FACTS.order.length * FPC; // 300
const BY_KEY = Object.fromEntries(FACTS.cards.map((c) => [c.key, c]));
type Card = (typeof FACTS.cards)[number];

// diagonal stripes that drift exactly N whole tiles per loop — seamless
const TILE = 60; // px along the gradient axis
const LoopStripes: React.FC<{ frame: number; color: string; opacity: number }> = ({ frame, color, opacity }) => {
  const period = TILE * Math.SQRT2; // horizontal repeat of a 45° stripe tile
  const shift = ((frame / PAUSE_TOTAL) * 5 * period) % period;
  return (
    <div
      style={{
        position: "absolute",
        top: -200,
        bottom: -200,
        left: -200,
        right: -200,
        opacity,
        backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 6px, transparent 6px ${TILE}px)`,
        transform: `translateX(${shift}px)`,
      }}
    />
  );
};

const lastSize = (s: string) => {
  // Space Grotesk 700 caps ≈ 0.66em advance at -4 tracking; card text box 860px
  const fit = 860 / (s.length * 0.66);
  return Math.min(190, Math.floor(fit));
};

const PauseGlyph: React.FC<{ size: number; fg: string; bg: string }> = ({ size, fg, bg }) => (
  <div style={{ width: size, height: size, borderRadius: size, background: bg, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(5), display: "flex", alignItems: "center", justifyContent: "center", gap: size * 0.13 }}>
    <div style={{ width: size * 0.14, height: size * 0.42, background: fg, borderRadius: 3 }} />
    <div style={{ width: size * 0.14, height: size * 0.42, background: fg, borderRadius: 3 }} />
  </div>
);

const NameCard: React.FC<{ card: Card; sub: number }> = ({ card, sub }) => {
  const c = card.colors!;
  // a 6px drop on the cut, settled by the card's last frame — alive, never blurred
  const drop = [6, 3, 1, 0][sub] ?? 0;
  const joke = "joke" in card && card.joke;
  return (
    <div
      style={{
        transform: `translateY(${-drop}px)`,
        background: COLORS.card,
        border: `7px solid ${COLORS.ink}`,
        borderRadius: 28,
        boxShadow: neoShadow(14),
        height: 600,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* club-colour trim along the top edge */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 26, background: c.bg, borderBottom: `5px solid ${COLORS.ink}` }}>
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 6, background: c.bar }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 20 }}>
        <span style={{ fontSize: 76, lineHeight: 1, fontFamily: "Noto Color Emoji" }}>{card.flag}</span>
        <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: "hsl(0 0% 7% / .62)" }}>{card.natLabel}</span>
      </div>
      <div style={{ height: 44, marginTop: 10, marginBottom: 26, fontFamily: FONTS.head, fontWeight: 700, fontSize: 44, letterSpacing: 2, color: "hsl(0 0% 7% / .7)" }}>{card.first}</div>
      {/* fixed-height slot: the club pill never jumps between cards */}
      <div style={{ height: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: lastSize(card.last),
            lineHeight: 1.0,
            letterSpacing: -4,
            color: joke ? COLORS.orange : COLORS.ink,
            whiteSpace: "nowrap",
            padding: "0 20px",
          }}
        >
          {card.last}
        </div>
      </div>
      <div style={{ marginTop: 34 }}>
        <div
          style={{
            display: "inline-block",
            background: c.bg,
            color: c.fg,
            border: `5px solid ${COLORS.ink}`,
            borderRadius: 14,
            boxShadow: neoShadow(6),
            padding: "12px 30px 12px 30px",
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: card.club.length > 17 ? 44 : 52,
            letterSpacing: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: c.bar }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 14, background: c.bar }} />
          <span style={{ position: "relative" }}>{card.club}</span>
        </div>
      </div>
    </div>
  );
};

export const Pause: React.FC = () => {
  const frame = useCurrentFrame();
  const slot = Math.floor(frame / FPC) % FACTS.order.length;
  const sub = frame % FPC;
  const card = BY_KEY[FACTS.order[slot]] as Card;
  const pulse = 1 + 0.06 * Math.sin((frame / 30) * 2 * Math.PI); // 30f period
  const blink = frame % 30 < 20;
  return (
    <AbsoluteFill style={{ background: COLORS.ink, overflow: "hidden" }}>
      <Audio src={staticFile("promo/lab-pause.wav")} />
      <LoopStripes frame={frame} color={COLORS.lime} opacity={0.06} />
      <Stage>
        <Topline right="PAUSE CHALLENGE" accent={COLORS.lime} />
        <div style={{ marginTop: 34, textAlign: "center" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 100, lineHeight: 0.92, letterSpacing: -4, color: COLORS.cream }}>
            SCREENSHOT IT <span style={{ fontFamily: "Noto Color Emoji", fontSize: 84, letterSpacing: 0 }}>📸</span>
          </div>
          <div style={{ marginTop: 24, display: "inline-block", background: COLORS.lime, color: COLORS.ink, border: `6px solid ${COLORS.ink}`, borderRadius: 16, boxShadow: `8px 8px 0 hsl(30 100% 97% / .9)`, padding: "12px 34px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 58, letterSpacing: -1 }}>
            That&apos;s your new striker
          </div>
        </div>
        <Middle top={300} bottom={150}>
          <NameCard card={card} sub={sub} />
        </Middle>
        <Bottom>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 58 }}>
            <div style={{ transform: `scale(${pulse})` }}>
              <PauseGlyph size={78} fg={COLORS.ink} bg={COLORS.lime} />
            </div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 5, color: COLORS.cream, opacity: blink ? 1 : 0.55 }}>HOLD TO PAUSE</div>
          </div>
          <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 5, color: "hsl(30 100% 97% / .62)" }}>VERVEQ.COM</div>
        </Bottom>
      </Stage>
    </AbsoluteFill>
  );
};
