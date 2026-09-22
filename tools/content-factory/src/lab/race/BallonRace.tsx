// MOST BALLON D'OR WINS BY CLUB, 1956 → 2025 — a bar race. Every club is a
// ribbon in its kit colours labelled with its NAME (no crests, no faces);
// the year ticker names each winner as the award lands. Facts are gated
// against Wikipedia AND Wikidata (lab/race-facts.mjs); timing lives in
// timeline.json (lab/race-timeline.mjs) so the sound bed and the verifier
// read the same beats. Frame 0 is already the board: title, 1956 on the
// ticker, Blackpool's first bar.
import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, Closer, FONTS, Ground, STAGE, Stage, Stripes, Topline, neoShadow, shake, spr } from "../kit";
import T from "./timeline.json";
import { barFill, clubStyle } from "./clubs";

export const RACE_TOTAL = T.total;
const V = T.visible;
const SEGS = T.segs;
const ROW = 76;
const BAR_H = 38;
const BADGE_W = 78;
const BOARD_W = 1080 - STAGE.x * 2;
const BAR_MAX = BOARD_W - BADGE_W - 14;
const CREAM_DIM = "hsl(30 100% 97% / .62)";

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = Easing.inOut(Easing.cubic);

const segAt = (f: number) => {
  let i = 0;
  while (i + 1 < SEGS.length && SEGS[i + 1].from <= f) i++;
  return i;
};

// the "→" drawn, not typed — the brand fonts' latin subsets don't carry it
const Arrow: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size * 1.1} height={size * 0.7} viewBox="0 0 44 28" style={{ display: "inline-block", margin: `0 ${size * 0.22}px`, verticalAlign: "middle", position: "relative", top: -size * 0.06 }}>
    <path d="M2 14 H38 M26 3 L40 14 L26 25" stroke={color} strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Chip: React.FC<{ club: string; size?: number }> = ({ club, size = 26 }) => {
  const s = clubStyle(club);
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.fg, border: `3px solid ${COLORS.cream}`, borderRadius: 10, padding: "4px 14px 5px", fontFamily: FONTS.head, fontWeight: 700, fontSize: size, letterSpacing: -0.5, boxShadow: `4px 4px 0 hsl(0 0% 0% / .6)`, whiteSpace: "nowrap" }}>
      {club}
    </span>
  );
};

const Stamp: React.FC<{ label: string; bg: string; fg: string; at: number; frame: number; fps: number }> = ({ label, bg, fg, at, frame, fps }) => {
  if (frame < at) return null;
  const s = spr(frame, fps, at, 9, 14);
  return (
    <span style={{ display: "inline-block", marginLeft: 14, transformOrigin: "left center", transform: `scale(${1.3 - 0.3 * s}) rotate(${-4 + 1 * s}deg)`, opacity: Math.min(1, s * 2) }}>
      <span style={{ display: "inline-block", background: bg, color: fg, border: `4px solid ${COLORS.ink}`, borderRadius: 10, padding: "5px 14px 6px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 26, letterSpacing: 0.5, boxShadow: `4px 4px 0 ${COLORS.cream}`, whiteSpace: "nowrap" }}>{label}</span>
    </span>
  );
};

const Board: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inRace = frame < T.race;
  const i = segAt(Math.min(frame, T.race - 1));
  const cur = SEGS[i];
  const prev = i > 0 ? SEGS[i - 1] : null;
  const trans = Math.min(cur.dur, 12);
  // seg 0 has no "before": frame 0 already shows 1956 landed
  const t = !inRace || i === 0 ? 1 : ease(clamp((frame - cur.from) / trans));
  const final = frame >= T.race;
  const settle = clamp((frame - T.race) / T.settle);

  const curCounts = cur.counts as Record<string, number>;
  const prevCounts = (prev?.counts ?? {}) as Record<string, number>;
  // axis floor of 2: the first bars read as a start, not a finished race
  const maxOf = (c: Record<string, number>) => Math.max(2, ...Object.values(c));
  const scale = prev ? maxOf(prevCounts) + (maxOf(curCounts) - maxOf(prevCounts)) * t : maxOf(curCounts);

  const clubs = [...new Set([...(prev?.order ?? []), ...cur.order])];
  const sh = cur.event === "lead" && inRace ? shake(frame, cur.from + 8, 7, 10) : { x: 0, y: 0 };
  const finalRank = Object.fromEntries(T.final.map((r) => [r.club, r.rank]));

  return (
    <div style={{ position: "relative", height: V * ROW, overflow: "hidden", transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      {/* the ten empty lanes — the board reads as a board from frame 0 */}
      {Array.from({ length: V }, (_, k) => (
        <div key={`lane${k}`} style={{ position: "absolute", left: 0, width: BAR_MAX, top: k * ROW + 32, height: BAR_H, borderRadius: 9, background: "hsl(30 100% 97% / .045)", border: "2px dashed hsl(30 100% 97% / .10)" }} />
      ))}
      {clubs.map((c) => {
        const p0 = prev ? prev.order.indexOf(c) : cur.order.indexOf(c);
        const p1 = cur.order.indexOf(c);
        const from = p0 === -1 ? (prev && prev.order.length < V ? prev.order.length : V + 0.3) : p0;
        const pos = from + (p1 - from) * t;
        if (pos > V + 0.2) return null;
        const v0 = prevCounts[c] ?? 0;
        const v1 = curCounts[c] ?? 0;
        const val = v0 + (v1 - v0) * t;
        const w = Math.max(18, (val / scale) * BAR_MAX);
        const s = clubStyle(c);
        const hot = inRace && cur.club === c;
        const op = clamp(V - pos) * (p0 === -1 ? clamp(t * 1.6) : 1);
        const rank = finalRank[c];
        const dimOut = final && rank === undefined ? 1 - settle : 1;
        return (
          <div key={c} style={{ position: "absolute", left: 0, right: 0, top: pos * ROW, height: ROW, opacity: op * dimOut, zIndex: hot ? 3 : 1 }}>
            <div style={{ height: 32, display: "flex", alignItems: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 27, letterSpacing: -0.3, color: hot ? COLORS.lime : COLORS.cream, whiteSpace: "nowrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", background: hot ? COLORS.ink : "transparent", paddingRight: 10, borderRadius: 6 }}>
              {final && rank !== undefined && <span style={{ display: "inline-block", width: 44 * settle, overflow: "hidden", opacity: settle, color: COLORS.lime, fontVariantNumeric: "tabular-nums" }}>{rank}</span>}
              {c}
              </span>
            </div>
            <div style={{ position: "relative", height: BAR_H, display: "flex", alignItems: "center" }}>
              <div style={{ width: w, height: BAR_H, borderRadius: 9, border: `3px solid ${hot ? COLORS.lime : "hsl(30 100% 97% / .9)"}`, boxShadow: `5px 5px 0 hsl(0 0% 0% / .55)`, ...barFill(s) }} />
              <div
                style={{
                  marginLeft: 12,
                  minWidth: 56,
                  height: BAR_H + 2,
                  padding: "0 10px",
                  borderRadius: 9,
                  background: hot ? COLORS.lime : COLORS.cream,
                  color: COLORS.ink,
                  border: `3px solid ${COLORS.ink}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 30,
                  fontVariantNumeric: "tabular-nums",
                  transform: hot && frame - cur.from < 10 ? `scale(${1 + 0.18 * (1 - (frame - cur.from) / 10)})` : undefined,
                }}
              >
                {t >= 0.35 ? v1 : v0 || v1}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const final = frame >= T.race;
  const i = segAt(Math.min(frame, T.race - 1));
  const cur = SEGS[i];
  const settle = clamp((frame - T.race) / 10);
  const inA = i === 0 ? 1 : spr(frame, fps, cur.from, 14, 6);
  const name = cur.awarded ? cur.winner! : "not awarded";
  const nameSize = name.length > 19 ? 44 : name.length > 15 ? 50 : 56;
  const race = (
    <div style={{ display: "flex", alignItems: "center", height: 136, opacity: 1 - settle }}>
      <div style={{ width: 300, flexShrink: 0, fontFamily: FONTS.head, fontWeight: 700, fontSize: 112, lineHeight: 1, letterSpacing: -5, color: COLORS.cream, fontVariantNumeric: "tabular-nums", transform: `translateY(${(1 - inA) * 14}px)`, opacity: 0.7 + 0.3 * inA }}>{cur.year}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: nameSize, lineHeight: 1.05, letterSpacing: -1.5, color: cur.awarded ? COLORS.cream : CREAM_DIM, whiteSpace: "nowrap", transform: `translateX(${(1 - inA) * 18}px)`, opacity: 0.45 + 0.55 * inA }}>
          <span style={{ color: COLORS.lime }}>·</span> {name}
        </div>
        <div style={{ marginTop: 12, height: 50, display: "flex", alignItems: "center", opacity: 0.45 + 0.55 * inA }}>
          {cur.awarded ? <Chip club={cur.club!} /> : <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 26, color: CREAM_DIM }}>no award this year</span>}
          {cur.event === "lead" && <Stamp label="NEW LEADER" bg={COLORS.lime} fg={COLORS.ink} at={cur.from + 6} frame={frame} fps={fps} />}
          {cur.event === "level" && <Stamp label="LEVEL AT THE TOP" bg={COLORS.yellow} fg={COLORS.ink} at={cur.from + 6} frame={frame} fps={fps} />}
        </div>
      </div>
    </div>
  );
  const top = T.final[0];
  const fin = (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", opacity: settle, transform: `translateY(${(1 - settle) * 20}px)` }}>
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, lineHeight: 0.95, letterSpacing: -4, color: COLORS.lime }}>FINAL TABLE</div>
      <div style={{ marginTop: 10, fontFamily: FONTS.head, fontWeight: 700, fontSize: 30, color: COLORS.cream }}>
        {T.final[1].count === top.count ? `${top.club} and ${T.final[1].club} level on ${top.count}` : `${top.club} top with ${top.count}`}
      </div>
    </div>
  );
  return (
    <div style={{ position: "relative", height: 136 }}>
      {race}
      {final && fin}
    </div>
  );
};

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const frac = clamp(frame / (T.race - 1));
  return (
    <div style={{ height: 10, borderRadius: 6, background: "hsl(30 100% 97% / .16)", overflow: "hidden" }}>
      <div style={{ width: `${frac * 100}%`, height: "100%", background: COLORS.lime }} />
    </div>
  );
};

const Race: React.FC = () => {
  const frame = useCurrentFrame();
  const i = segAt(Math.min(frame, T.race - 1));
  const cur = SEGS[i];
  const flash = cur.event === "lead" && frame < T.race ? interpolate(frame - cur.from, [0, 3, 12], [0, 0.13, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  // the stripes stop with the table: the freeze is a freeze
  const stripeFrame = Math.min(frame, T.race + T.settle);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={stripeFrame} color={COLORS.lime} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      {flash > 0 && <div style={{ position: "absolute", inset: 0, background: clubStyle(cur.club!).bg, opacity: flash }} />}
      <Stage>
        <Topline right="1956 – 2025" accent={COLORS.lime} />
        <div style={{ marginTop: 22, fontFamily: FONTS.head, fontWeight: 700, fontSize: 70, lineHeight: 0.92, letterSpacing: -3, color: COLORS.cream }}>
          MOST BALLON D&apos;OR
          <br />
          WINS BY CLUB
        </div>
        <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", background: COLORS.lime, color: COLORS.ink, border: `4px solid ${COLORS.ink}`, borderRadius: 12, padding: "4px 18px 6px", boxShadow: `5px 5px 0 ${COLORS.cream}`, fontFamily: FONTS.head, fontWeight: 700, fontSize: 36, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>
          1956
          <Arrow size={36} color={COLORS.ink} />
          2025
        </div>
        <div style={{ marginTop: 22 }}>
          <Ticker />
        </div>
        <div style={{ marginTop: 14, marginBottom: 20 }}>
          <Progress />
        </div>
        <Board />
      </Stage>
    </AbsoluteFill>
  );
};

export const BallonRace: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/lab-race.wav")} />
    <Sequence from={0} durationInFrames={T.closerFrom}>
      <Race />
    </Sequence>
    <Sequence from={T.closerFrom} durationInFrames={T.closer} premountFor={30}>
      <Closer line1="WHO WINS IN 2026?" line2="DROP A NAME 👇" sub="BALLON D'OR GALA · 26 OCT 2026" />
    </Sequence>
  </AbsoluteFill>
);
