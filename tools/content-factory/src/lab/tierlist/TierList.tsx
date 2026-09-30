// TIER LIST — the static comment-your-pick board (research/concept-sweep-2026-09
// §2 row 12, §3.8): one still-ish 9s board, four tiers, eight names, and one
// ask — your top 3. The tiers are our opinion (and deliberately arguable);
// every NAME and CLUB on the board comes from facts.json, written by
// lab/tierlist-facts.mjs (career paths + Wikidata + Wikipedia must agree).
// No photos, no crests: names plus a club-colour bar.
//
// Frame 0 is the finished board already moving: a light sweep crosses the
// board on a 3s loop, the arguable chips breathe, the ask pulses.
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, FONTS, Ground, Middle, Stage, Stripes, Topline, neoShadow, spr } from "../kit";
import GRID from "./grid.json";
import FACTS from "./facts.json";

const TIER_STYLE: Record<string, { bg: string; fg: string }> = {
  S: { bg: COLORS.red, fg: COLORS.white },
  A: { bg: COLORS.orange, fg: COLORS.ink },
  B: { bg: COLORS.yellow, fg: COLORS.ink },
  C: { bg: COLORS.lime, fg: COLORS.ink },
};
const LABEL_W = 150;
const ROW_H = 176;
const GAP = 14;
const CHIP_W = Math.floor((952 - LABEL_W - GAP - 2 * GAP - 2 * 12) / 3); // 3 per row max
const fit = (text: string, maxW: number, maxSize: number, k = 0.64) => Math.min(maxSize, Math.floor(maxW / (k * Math.max(1, text.length))));
// the arguable placements breathe (opinion bait — the board's two "wait, what?")
const BAIT = new Set(["HAALAND", "ROONEY"]);

type Player = (typeof FACTS.tiers)[number]["players"][number];

const Chip: React.FC<{ p: Player; frame: number; idx: number }> = ({ p, frame, idx }) => {
  const bait = BAIT.has(p.show);
  const wob = bait ? Math.sin(frame / 5 + idx) * 1.6 : 0;
  const breathe = bait ? 1 + 0.025 * Math.sin(frame / 4 + idx) : 1;
  return (
    <div style={{ position: "relative", width: CHIP_W, height: ROW_H - 24, transform: `rotate(${wob}deg) scale(${breathe})` }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: COLORS.cream,
          border: `5px solid ${COLORS.ink}`,
          borderRadius: 14,
          boxShadow: neoShadow(7),
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ height: 40, background: p.club.bg, borderBottom: `4px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 19, letterSpacing: 2, color: p.club.fg }}>{p.club.show}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: fit(p.show, CHIP_W - 24, 50), letterSpacing: -1.5, color: COLORS.ink, lineHeight: 1 }}>{p.show}</div>
      </div>
      {bait && (
        <div style={{ position: "absolute", top: -20, right: -16, width: 58, height: 58, borderRadius: 29, background: COLORS.red, border: `4px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 30, color: COLORS.white, transform: `rotate(12deg) scale(${1 + 0.1 * Math.sin(frame / 3)})` }}>?!</div>
      )}
    </div>
  );
};

export const TierList: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // the light sweep: a diagonal band crossing the board, looping, on screen at f0
  const phase = (frame % GRID.sweep) / GRID.sweep;
  const sweepX = interpolate(phase, [0, 1], [-200, 1280]);
  const ask = spr(frame, fps, GRID.askAt, 9, 16);
  const askPulse = 1 + 0.035 * Math.sin(frame / 3.2);
  const flash = frame < GRID.askAt ? 0 : interpolate(frame, [GRID.askAt, GRID.askAt + 8], [0.5, 0], { extrapolateRight: "clamp" });
  let idx = 0;
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <Audio src={staticFile("promo/lab-tierlist.wav")} />
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.04} />
      </Ground>
      <Stage>
        <Topline right="TIER LIST" />
        <Middle top={56} bottom={124}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: COLORS.lime, marginBottom: 10 }}>OUR RANKING. FIX IT.</div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, lineHeight: 0.9, letterSpacing: -4, color: COLORS.cream, textShadow: `6px 6px 0 hsl(0 0% 0% / .6)` }}>
            {FACTS.title[0]}
            <br />
            <span style={{ color: COLORS.lime }}>{FACTS.title[1]}</span>
          </div>
          <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: GAP, position: "relative" }}>
            {FACTS.tiers.map((t) => {
              const s = TIER_STYLE[t.tier];
              return (
                <div key={t.tier} style={{ display: "flex", gap: GAP, height: ROW_H, background: "hsl(30 100% 97% / .07)", border: `4px solid hsl(30 100% 97% / .16)`, borderRadius: 18, overflow: "visible" }}>
                  <div style={{ width: LABEL_W, flex: "none", background: s.bg, color: s.fg, borderRadius: 14, border: `5px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 120, letterSpacing: -4, lineHeight: 1 }}>{t.tier}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: GAP }}>
                    {t.players.map((p) => (
                      <Chip key={p.name} p={p} frame={frame} idx={idx++} />
                    ))}
                  </div>
                </div>
              );
            })}
            {/* the sweep — clipped to the board so the chrome strips stay clean */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 18, pointerEvents: "none", mixBlendMode: "screen" }}>
              <div style={{ position: "absolute", top: -200, bottom: -200, left: sweepX - 64, width: 120, background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / .22), transparent)", transform: "rotate(14deg)" }} />
            </div>
          </div>
        </Middle>
        <Bottom>
          <div style={{ display: "flex", justifyContent: "center", transform: `scale(${askPulse * (frame >= GRID.askAt ? 1 + 0.12 * (1 - ask) : 1)})` }}>
            <div style={{ background: COLORS.lime, color: COLORS.ink, border: `6px solid ${COLORS.ink}`, borderRadius: 18, boxShadow: `8px 8px 0 hsl(0 0% 0% / .7)`, padding: "18px 40px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 56, letterSpacing: -1.5, whiteSpace: "nowrap" }}>
              YOUR TOP 3? COMMENTS.
            </div>
          </div>
        </Bottom>
      </Stage>
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
