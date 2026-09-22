// SPOT THE IMPOSTER — the imposter ladder (research/concept-sweep-2026-09 §3.3).
// Six rounds, one question each: "3 of them played for CLUB. Who didn't?"
// Four name cards (no photos, no crests: name, flag, position, a club-colour
// edge), a 5s bar drains, the imposter card flips red "NEVER PLAYED HERE" and
// stamps the club he is actually known for. The ladder across the top fills
// as it goes: EASY EASY MEDIUM HARD HARD IMPOSSIBLE. Round 6 is NOT revealed —
// the grid stays up and the reel ends on the comment ask.
//
// Every fact on screen comes from facts.json, written by lab/imposter-facts.mjs
// (career_paths.json AND Wikidata P54 must agree, or the script exits non-zero).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Bottom, COLORS, FONTS, Ground, Middle, Stage, Stripes, TimerBar, Topline, neoShadow, shake, spr } from "../kit";
import GRID from "./grid.json";
import FACTS from "./facts.json";

const G = GRID;
const FPS = GRID.fps;
const R = FACTS.rounds;
const N = R.length;
export const IMPOSTER_TOTAL = (N - 1) * G.round + G.withholdAt + G.withholdHold;

type Round = (typeof R)[number];
type CardT = Round["cards"][number];

const EMOJI = "'Noto Color Emoji', 'Apple Color Emoji', sans-serif";
const HEAD = `${FONTS.head}, ${EMOJI}`;

// width-fit for bold caps in Space Grotesk (≈0.66em per glyph, conservative)
const fit = (text: string, maxW: number, maxSize: number, k = 0.66) => Math.min(maxSize, Math.floor(maxW / (k * Math.max(1, text.length))));

const TIER = {
  EASY: { bg: COLORS.green, fg: COLORS.white, line: COLORS.ink },
  MEDIUM: { bg: COLORS.yellow, fg: COLORS.ink, line: COLORS.ink },
  HARD: { bg: COLORS.red, fg: COLORS.white, line: COLORS.ink },
  IMPOSSIBLE: { bg: COLORS.ink, fg: COLORS.lime, line: COLORS.lime },
} as const;

// ── the header ladder: fills as it goes ──────────────────────────────────
const Ladder: React.FC<{ ri: number; resolved: boolean; frame: number }> = ({ ri, resolved, frame }) => (
  <div style={{ display: "flex", gap: 10 }}>
    {R.map((r, i) => {
      const t = TIER[r.tier as keyof typeof TIER];
      const done = i < ri || (i === ri && resolved);
      const cur = i === ri && !resolved;
      const pulse = cur ? 1 + 0.05 * Math.sin(frame / 3) : 1;
      return (
        <div
          key={i}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: r.tier.length > 6 ? 16 : 19,
            letterSpacing: 1,
            transform: `scale(${pulse})`,
            background: done ? t.bg : cur ? COLORS.cream : "transparent",
            color: done ? t.fg : cur ? COLORS.ink : "hsl(30 100% 97% / .38)",
            border: `3px solid ${done ? t.line : cur ? COLORS.lime : "hsl(30 100% 97% / .2)"}`,
            boxShadow: done || cur ? neoShadow(4) : "none",
          }}
        >
          {r.tier}
          {done && <span style={{ fontFamily: HEAD, fontSize: 18 }}>✓</span>}
        </div>
      );
    })}
  </div>
);

// ── a name card ──────────────────────────────────────────────────────────
const CARD_W = 464;
const CARD_H = 272;

const Face: React.FC<{ c: CardT; round: Round; badge: React.ReactNode; tone: "front" | "back" }> = ({ c, round, badge, tone }) => {
  const back = tone === "back";
  const lines = c.last.includes(" ") && c.last.length > 10 ? c.last.split(" ") : [c.last];
  const longest = Math.max(...lines.map((l) => l.length));
  const size = fit("x".repeat(longest), CARD_W - 64, 74);
  const ink = back ? COLORS.cream : COLORS.ink;
  return (
    <div style={{ position: "absolute", inset: 0, background: back ? COLORS.red : COLORS.card, color: ink, display: "flex", flexDirection: "column" }}>
      {/* the club-colour edge */}
      <div style={{ height: 18, display: "flex", borderBottom: `4px solid ${COLORS.ink}` }}>
        <div style={{ flex: 3, background: back ? COLORS.ink : round.club.bg }} />
        <div style={{ flex: 1, background: back ? COLORS.ink : round.club.edge }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px 0 18px", height: 58 }}>
        <span style={{ fontFamily: EMOJI, fontSize: 44, lineHeight: 1 }}>{c.flag}</span>
        {badge}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: back ? "flex-start" : "center", textAlign: "center", padding: "0 20px", marginTop: back ? 4 : -6 }}>
        {c.first && !back && <div style={{ fontFamily: FONTS.head, fontWeight: 500, fontSize: 30, lineHeight: 1, opacity: 0.72, marginBottom: 4 }}>{c.first}</div>}
        {lines.map((l) => (
          <div key={l} style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: back ? Math.min(size, lines.length > 1 ? 40 : 62) : size, lineHeight: 0.95, letterSpacing: -2 }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ visibility: back ? "hidden" : "visible", display: "flex", justifyContent: "space-between", padding: "0 18px 14px 18px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 18, letterSpacing: 2, opacity: 0.66 }}>
        <span>{c.nation.toUpperCase()}</span>
        <span>{c.position}</span>
      </div>
    </div>
  );
};

const Card: React.FC<{ round: Round; ci: number; frame: number; fps: number; cold: boolean }> = ({ round, ci, frame, fps, cold }) => {
  const c = round.cards[ci];
  const isImp = ci === round.imposter;
  const withheld = round.withheld;
  const revealed = !withheld && frame >= G.revealAt;
  const flipP = !withheld && isImp ? interpolate(frame, [G.revealAt, G.revealAt + G.flipDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const showBack = flipP >= 0.5;
  const sx = isImp && revealed ? Math.max(0.03, Math.abs(1 - 2 * flipP)) : 1;
  const land = cold ? 1 : spr(frame, fps, 2 + ci * 3, 11, 14);
  const idle = Math.sin((frame + ci * 13) / 8) * 4;
  const stampP = isImp && revealed ? spr(frame, fps, G.stampAt, 8, 14) : 0;
  const stampSh = shake(frame, G.stampAt, 8, 9);
  const okP = !isImp && revealed ? spr(frame, fps, G.revealAt + 4 + ci * 2, 10, 12) : 0;
  const withP = withheld ? spr(frame, fps, G.withholdAt + ci * 3, 10, 12) : 0;
  const border = showBack ? COLORS.ink : okP > 0 ? COLORS.green : COLORS.ink;

  const badge = showBack ? (
    <span style={{ background: COLORS.ink, color: COLORS.cream, borderRadius: 10, padding: "6px 12px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 19, letterSpacing: 2 }}>NEVER PLAYED HERE</span>
  ) : okP > 0 ? (
    <span style={{ transform: `scale(${okP})`, width: 50, height: 50, borderRadius: 25, background: COLORS.green, color: COLORS.white, border: `4px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: HEAD, fontWeight: 700, fontSize: 28 }}>✓</span>
  ) : withP > 0 ? (
    <span style={{ transform: `scale(${withP * (1 + 0.08 * Math.sin(frame / 3 + ci))})`, width: 50, height: 50, borderRadius: 25, background: COLORS.lime, color: COLORS.ink, border: `4px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 32 }}>?</span>
  ) : null;

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        position: "relative",
        transform: `translate(${stampP > 0 ? stampSh.x * 0.4 : 0}px, ${(1 - land) * 50 + (showBack ? 0 : idle)}px) scale(${(0.86 + 0.14 * land)}) scaleX(${sx})`,
        opacity: Math.min(1, land * 2),
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: 20, border: `6px solid ${border}`, boxShadow: neoShadow(8), overflow: "hidden", background: COLORS.card }}>
        <Face c={c} round={round} badge={badge} tone={showBack ? "back" : "front"} />
      </div>
      {showBack && stampP > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 16,
            transform: `translate(-50%, 0) rotate(${-4 + 3 * (1 - stampP)}deg) scale(${1.8 - 0.8 * stampP})`,
            opacity: Math.min(1, stampP * 3),
          }}
        >
          <div style={{ background: round.real.bg, color: round.real.fg, border: `5px solid ${COLORS.ink}`, borderBottom: `12px solid ${round.real.edge === "#FFFFFF" ? COLORS.ink : round.real.edge}`, borderRadius: 12, padding: "6px 20px 4px", boxShadow: neoShadow(6), textAlign: "center", whiteSpace: "nowrap" }}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 15, letterSpacing: 2, opacity: 0.8 }}>BEST KNOWN AT</div>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: fit(round.real.show, 360, 44), lineHeight: 1.05, letterSpacing: -1 }}>{round.real.show}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── one round ────────────────────────────────────────────────────────────
const RoundScene: React.FC<{ ri: number }> = ({ ri }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = R[ri];
  const cold = ri === 0;
  const withheld = r.withheld;
  const resolved = !withheld && frame >= G.revealAt;
  const timerFrac = 1 - interpolate(frame, [cold ? 0 : G.timerFrom, G.timerTo], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const heat = frame >= G.timerTo - 30 && frame < G.revealAt;
  const strip = cold ? 1 : spr(frame, fps, 0, 10, 12);
  const verdict = spr(frame, fps, G.stampAt + 6, 10, 14);
  const ask = spr(frame, fps, G.withholdAt + 10, 9, 14);
  const askPulse = 1 + 0.025 * Math.sin(frame / 3);
  const brand = withheld ? spr(frame, fps, G.withholdAt + G.brandAt, 10, 14) : 0;
  const imp = r.cards[r.imposter];

  const line2 = `${r.club.show} WHO DIDN'T?`;
  const qSize = fit(line2, 952 - 70, 70, 0.64);
  const vText = `${imp.last} NEVER PLAYED FOR ${r.club.show}`;
  const vSize = fit(vText, 900, 40, 0.62);

  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={ri * G.round + frame} color={r.club.bg === "#000000" ? COLORS.cream : r.club.bg} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <Stage>
        <Topline right={`ROUND ${r.n} / ${N}`} accent={COLORS.lime} />
        <div style={{ marginTop: 16 }}>
          <Ladder ri={ri} resolved={resolved} frame={frame} />
        </div>
        <Middle top={112} bottom={44}>
          <div style={{ textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 76, lineHeight: 0.9, letterSpacing: -3, color: COLORS.cream }}>
            SPOT THE <span style={{ color: COLORS.red, textShadow: `5px 5px 0 hsl(0 0% 0%)` }}>IMPOSTER</span>
          </div>
          {/* the question strip — two lines, big */}
          <div style={{ marginTop: 26, textAlign: "center", transform: `translateY(${(1 - strip) * 24}px)`, opacity: Math.min(1, strip * 2) }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 46, lineHeight: 1, letterSpacing: -1, color: "hsl(30 100% 97% / .9)" }}>3 OF THEM PLAYED FOR</div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <span
                style={{
                  background: r.club.bg,
                  color: r.club.fg,
                  border: `5px solid ${COLORS.cream}`,
                  boxShadow: `inset 0 -10px 0 ${r.club.edge === r.club.fg ? COLORS.cream : r.club.edge}, ${neoShadow(6)}`,
                  borderRadius: 14,
                  padding: `${Math.round(qSize * 0.1)}px ${Math.round(qSize * 0.3)}px ${Math.round(qSize * 0.22)}px`,
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: qSize,
                  lineHeight: 1,
                  letterSpacing: -2,
                  whiteSpace: "nowrap",
                }}
              >
                {r.club.show}
              </span>
              <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: qSize, lineHeight: 1, letterSpacing: -2, color: COLORS.lime, whiteSpace: "nowrap" }}>WHO DIDN&apos;T?</span>
            </div>
          </div>
          {/* the 2×2 grid */}
          <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: `${CARD_W}px ${CARD_W}px`, gap: 22, justifyContent: "space-between" }}>
            {r.cards.map((_, ci) => (
              <Card key={ci} round={r} ci={ci} frame={frame} fps={fps} cold={cold} />
            ))}
          </div>
          {/* the slot: clock → verdict (or the withheld ask) */}
          <div style={{ marginTop: 26, height: 164, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {withheld && frame >= G.withholdAt ? (
              <div style={{ transform: `scale(${(0.6 + 0.4 * ask) * askPulse})`, opacity: Math.min(1, ask * 2), background: COLORS.lime, color: COLORS.ink, border: `6px solid ${COLORS.ink}`, borderRadius: 18, boxShadow: neoShadow(10), padding: "14px 34px", textAlign: "center" }}>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, lineHeight: 1, letterSpacing: -2 }}>IMPOSSIBLE —</div>
                <div style={{ marginTop: 8, fontFamily: HEAD, fontWeight: 700, fontSize: 44, lineHeight: 1.05, letterSpacing: -1 }}>answer in the comments 👇</div>
              </div>
            ) : !resolved ? (
              <div style={{ width: "100%", transform: `scale(${heat ? 1 + 0.015 * Math.sin(frame * 1.3) : 1})` }}>
                <TimerBar frac={timerFrac} color={timerFrac < 0.3 ? COLORS.red : COLORS.lime} border={COLORS.cream} height={30} />
                <div style={{ marginTop: 18, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "hsl(30 100% 97% / .6)" }}>PICK ONE BEFORE THE BAR RUNS OUT</div>
              </div>
            ) : (
              <div style={{ transform: `scale(${0.6 + 0.4 * verdict})`, opacity: Math.min(1, verdict * 2), textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: vSize, lineHeight: 1.1, letterSpacing: -1, color: COLORS.cream }}>
                <span style={{ color: COLORS.red }}>{imp.last}</span> NEVER PLAYED FOR {r.club.show}
              </div>
            )}
          </div>
        </Middle>
        <Bottom>
          <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: brand > 0 ? COLORS.cream : "hsl(30 100% 97% / .55)", opacity: brand > 0 ? Math.min(1, brand * 2) : 1 }}>
            {brand > 0 ? "VERVEQ.COM · THE DAILY FOOTBALL QUIZ" : "ONE IMPOSTER PER ROUND · KEEP SCORE"}
          </div>
        </Bottom>
      </Stage>
      {!cold && <div style={{ position: "absolute", inset: 0, background: r.club.bg, opacity: interpolate(frame, [0, 4], [0.3, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

export const Imposter: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/lab-imposter.wav")} />
    {R.map((r, i) => (
      <Sequence key={i} from={i * G.round} durationInFrames={r.withheld ? G.withholdAt + G.withholdHold : G.round} premountFor={FPS}>
        <RoundScene ri={i} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
