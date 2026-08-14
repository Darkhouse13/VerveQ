// CF-42H — "wknd-42h", the 30s paid-boost conversion reel. One job: a cold
// stranger taps verveq.com/weekend. No withheld answers, no comment traps —
// one CTA, twice (bo-cta VO + end card).
//
// THE DOPAMINE LAW, as built: every scene carries a CONTINUOUS meaningful
// ticker so no 0.75s window is static (the verify motion gate asserts this on
// rendered pixels):
//   open      the live countdown flips every second (+ tick pulse)
//   fixtures  a real fixture card slams every 22f (0.73s)
//   fill      a real shirt lands every 21f, the SPENT bar drains continuously
//   squeeze   pops → pulsing PICK → the pick slams + 4-shirt sprint to 91.0
//   rules     stamp hits + the countdown (64px digits + per-second drain bar)
//   cta       countdown still ticking above the URL card
// Hard cuts only; scene changes on VO beat boundaries (grid.json).
//
// FACTS: everything on screen is the prod board's own data — boost-facts.json
// is re-verified against fantasyMarket:getMarket by weekend/boost-live.mjs on
// EVERY render (drift throws). The countdown seconds come from
// boost-live.json, stamped at render time (truthful at post time ±15min —
// post within 15 minutes or re-run the one command). Yamal carries no fixture
// this GW: his 13.0 is a board price (the wknd-squad precedent), and the reel
// never claims he plays — the squeeze is pure board arithmetic:
//   55.5 after 8 shirts → 13.0 vs 3×4.5 → 68.5 → +7.5+6.5+4.5+4.0 = 91.0.
//
// The pitch is a faithful recreation of the shipped product (PitchView.tsx,
// FW-IMMERSE A2): same jersey path, mow-stripe greens, converging-touchline
// markings, cream name plate over dark price plate, dashed lime empty slots,
// SPENT bar. No fabricated UI.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, SafeArea, spr, inOut, shake, neoShadow } from "../../promo/kit";
import { FPS, BOOST, startsOf, totalOf } from "./timeline";
import { hasVo, vo } from "./vo";
import FACTS from "./boost-facts.json";
import LIVE from "./boost-live.json";

const START = startsOf(BOOST.scenes);
export const BOOST_TOTAL = totalOf(BOOST.scenes);
const CARD_STEP = BOOST.cardStep ?? 22;
const SHIRT_STEP = BOOST.shirtStep ?? 21;

const fmt = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
const SQUAD = FACTS.squad;
const BUDGET = FACTS.budget;

// ── the live countdown ─────────────────────────────────────────────────────
// abs = absolute reel frame; the displayed value is secondsAtFrame0 minus
// elapsed whole seconds — truthful at render time by construction.
const cdText = (abs: number): string => {
  const s = Math.max(0, LIVE.secondsAtFrame0 - Math.floor(abs / FPS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
};

const Countdown: React.FC<{ abs: number; size: number; color?: string }> = ({ abs, size, color = COLORS.lime }) => {
  const tickAge = abs % FPS; // frames since the last second flip
  const pulse = 1 + 0.06 * Math.max(0, 1 - tickAge / 8);
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 2,
        color,
        textShadow: `${Math.round(size / 18)}px ${Math.round(size / 18)}px 0 ${COLORS.ink}`,
        transform: `scale(${pulse})`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {cdText(abs)}
    </div>
  );
};

// the per-second drain bar under a countdown: refills at each flip and drains
// with the second — time visibly leaving, every frame different.
const SecondDrain: React.FC<{ abs: number; width: number; height?: number }> = ({ abs, width, height = 8 }) => (
  <div style={{ width, height, marginTop: 10, borderRadius: height / 2, background: "hsl(75 100% 55% / 0.18)", overflow: "hidden" }}>
    <div style={{ width: `${(1 - (abs % FPS) / FPS) * 100}%`, height: "100%", background: COLORS.lime }} />
  </div>
);

// ── the product pitch, recreated from PitchView.tsx ────────────────────────
const JERSEY_PATH =
  "M8.6 1.4 C9.6 2.7 14.4 2.7 15.4 1.4 L19.2 2.9 L23.2 7.6 L19.7 10.4 L17.9 8.4 " +
  "L17.9 19.6 Q17.9 21 16.4 21 L7.6 21 Q6.1 21 6.1 19.6 L6.1 8.4 L4.3 10.4 " +
  "L0.8 7.6 L4.8 2.9 Z";
const JERSEY_SHADE_PATH =
  "M12 2.38 C13.5 2.38 15 2 15.4 1.4 L19.2 2.9 L23.2 7.6 L19.7 10.4 L17.9 8.4 " +
  "L17.9 19.6 Q17.9 21 16.4 21 L12 21 Z";

const Jersey: React.FC<{ empty?: boolean; w?: number }> = ({ empty, w = 88 }) => (
  <svg viewBox="0 0 24 22" width={w} height={(w * 22) / 24} style={{ filter: "drop-shadow(3px 4px 0 hsl(0 0% 0% / 0.55))" }}>
    <path
      d={JERSEY_PATH}
      fill={empty ? "none" : COLORS.cream}
      stroke={empty ? "hsl(75 100% 55% / 0.65)" : COLORS.ink}
      strokeWidth={empty ? 1.1 : 1}
      strokeDasharray={empty ? "2.6 1.8" : undefined}
      strokeLinejoin="round"
    />
    {!empty && <path d={JERSEY_SHADE_PATH} fill="hsl(0 0% 0% / 0.09)" />}
    {empty && (
      <g stroke="hsl(75 100% 55% / 0.85)" strokeWidth={1.6} strokeLinecap="round">
        <path d="M12 9.6 L12 14.8" />
        <path d="M9.4 12.2 L14.6 12.2" />
      </g>
    )}
  </svg>
);

// PitchSurface, verbatim geometry from the shipped component (mow bands,
// floodlight, converging touchlines, ellipse arcs).
const PitchSurface: React.FC = () => {
  const bands = [0, 8.6, 18.5, 29.9, 43.0, 58.0, 75.3, 95.2, 118.1, 144];
  const halfW = (y: number) => 40 + (8 * (y - 5)) / 134;
  const line = "hsl(78 90% 88% / 0.5)";
  return (
    <svg viewBox="0 0 100 144" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="bo-turf-depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(0 0% 0%)" stopOpacity="0.5" />
          <stop offset="0.3" stopColor="hsl(0 0% 0%)" stopOpacity="0.08" />
          <stop offset="0.72" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
          <stop offset="1" stopColor="hsl(0 0% 0%)" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="bo-turf-sides" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="hsl(0 0% 0%)" stopOpacity="0.38" />
          <stop offset="0.1" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
          <stop offset="0.9" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
          <stop offset="1" stopColor="hsl(0 0% 0%)" stopOpacity="0.38" />
        </linearGradient>
        <radialGradient id="bo-floodlight" cx="0.5" cy="0.16" r="0.75">
          <stop offset="0" stopColor="hsl(75 100% 72%)" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="hsl(75 100% 72%)" stopOpacity="0.04" />
          <stop offset="1" stopColor="hsl(75 100% 72%)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {bands.slice(0, -1).map((top, i) => (
        <rect key={top} x="0" y={top} width="100" height={bands[i + 1] - top} fill={i % 2 === 0 ? "hsl(140 34% 10%)" : "hsl(142 30% 13.5%)"} />
      ))}
      <rect x="0" y="0" width="100" height="144" fill="url(#bo-floodlight)" />
      <rect x="0" y="0" width="100" height="144" fill="url(#bo-turf-depth)" />
      <rect x="0" y="0" width="100" height="144" fill="url(#bo-turf-sides)" />
      <g stroke={line} strokeWidth={0.45} fill="none">
        <path d={`M ${50 - halfW(5)} 5 L ${50 + halfW(5)} 5 L ${50 + halfW(139)} 139 L ${50 - halfW(139)} 139 Z`} />
        <path d={`M ${50 - 0.56 * halfW(5)} 5 L ${50 - 0.56 * halfW(26)} 26 L ${50 + 0.56 * halfW(26)} 26 L ${50 + 0.56 * halfW(5)} 5`} />
        <path d={`M ${50 - 0.27 * halfW(5)} 5 L ${50 - 0.27 * halfW(13.5)} 13.5 L ${50 + 0.27 * halfW(13.5)} 13.5 L ${50 + 0.27 * halfW(5)} 5`} />
        <path d="M 43.4 26 A 8.4 4.6 0 0 0 56.6 26" />
        <path d="M 37.2 139 A 12.8 7.6 0 0 1 62.8 139" />
        <path d={`M ${50 - halfW(5) + 2.4} 5 A 2.4 1.7 0 0 1 ${50 - halfW(5)} 6.9`} />
        <path d={`M ${50 + halfW(5) - 2.4} 5 A 2.4 1.7 0 0 0 ${50 + halfW(5)} 6.9`} />
      </g>
      <ellipse cx="50" cy="18.5" rx="0.8" ry="0.5" fill={line} />
      <ellipse cx="50" cy="138.2" rx="0.9" ry="0.55" fill={line} />
    </svg>
  );
};

// landing schedule → eased SPENT total (8-frame ease per landing, like the
// product's drop-in + the wknd-squad bar)
type Landing = { idx: number; at: number };
const spentAt = (frame: number, landings: Landing[]): number => {
  let spent = 0;
  for (const l of landings) {
    const t = interpolate(frame - l.at, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    spent += SQUAD[l.idx].price * t;
  }
  return spent;
};

const Chip: React.FC<{ idx: number; landAt: number; frame: number; fps: number }> = ({ idx, landAt, frame, fps }) => {
  const p = SQUAD[idx];
  const landed = frame >= landAt;
  // empty slots carry landAt = +Infinity — never feed that to a spring
  const s = landed ? spr(frame, fps, landAt, 9, 14) : 0;
  const sh = landed ? shake(frame, landAt, 9, 8) : { x: 0, y: 0 };
  const role = p.finisher ? `F·${p.pos}` : p.pos;
  return (
    <div style={{ width: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {landed ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            transform: `translate(${sh.x}px, ${-60 * (1 - s) + sh.y}px) scale(${1.2 - 0.2 * s})`,
            opacity: Math.min(1, s * 2.2),
          }}
        >
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 17, letterSpacing: 2, color: "hsl(30 100% 97% / 0.85)" }}>{role}</div>
          <Jersey />
          <div
            style={{
              width: 142,
              textAlign: "center",
              background: COLORS.cream,
              color: COLORS.ink,
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 25,
              lineHeight: "34px",
              borderRadius: 6,
              border: `3px solid ${COLORS.ink}`,
              boxShadow: neoShadow(3),
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {p.surname}
          </div>
          <div
            style={{
              width: 142,
              textAlign: "center",
              background: "hsl(0 0% 10%)",
              color: "hsl(30 100% 97% / 0.92)",
              fontFamily: FONTS.mono,
              fontWeight: 700,
              fontSize: 23,
              lineHeight: "31px",
              borderRadius: 6,
              border: `3px solid ${COLORS.ink}`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p.price.toFixed(1)}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.9 }}>
          <div style={{ height: 21 }} />
          <Jersey empty />
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 22, color: "hsl(30 100% 97% / 0.9)" }}>{p.pos}</div>
        </div>
      )}
    </div>
  );
};

// slot index → visual row (product ROW_ORDER, GK far/top; finishers on strip)
const XI_ROWS: number[][] = [[0], [1, 2, 3, 4], [5, 6, 7, 10], [8, 9]];
const FINISHERS = [11, 12];
const ROW_TOP = [10, 210, 424, 636]; // px within the 860px pitch box

const Board: React.FC<{ frame: number; fps: number; landings: Landing[]; children?: React.ReactNode }> = ({ frame, fps, landings, children }) => {
  const spent = spentAt(frame, landings);
  const frac = spent / BUDGET;
  const landAtByIdx = new Map(landings.map((l) => [l.idx, l.at]));
  const chip = (idx: number) => <Chip key={idx} idx={idx} landAt={landAtByIdx.get(idx) ?? Number.POSITIVE_INFINITY} frame={frame} fps={fps} />;
  return (
    <SafeArea>
      <div style={{ position: "absolute", top: 0, left: 10, right: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 34, color: COLORS.cream }}>Your weekend 13</div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: "hsl(30 100% 97% / 0.7)" }}>GW 1</div>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3 }}>
          <span style={{ color: "hsl(30 100% 97% / 0.6)" }}>SPENT</span>
          <span style={{ color: COLORS.cream, fontVariantNumeric: "tabular-nums" }}>
            {spent.toFixed(1)} / {BUDGET.toFixed(1)}
          </span>
        </div>
        <div style={{ marginTop: 8, height: 22, borderRadius: 11, border: `3px solid ${COLORS.cream}`, overflow: "hidden", background: COLORS.ink }}>
          <div style={{ width: `${Math.min(1, frac) * 100}%`, height: "100%", background: COLORS.lime }} />
        </div>
        <div style={{ marginTop: 6, textAlign: "right", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: COLORS.lime, fontVariantNumeric: "tabular-nums" }}>
          {(BUDGET - spent).toFixed(1)} left
        </div>
      </div>
      {/* the turf */}
      <div style={{ position: "absolute", top: 158, left: 10, right: 10, height: 860, borderRadius: 18, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(10), overflow: "hidden" }}>
        <PitchSurface />
        {XI_ROWS.map((row, r) => (
          <div key={r} style={{ position: "absolute", top: ROW_TOP[r], left: 0, right: 0, display: "flex", justifyContent: "space-evenly" }}>
            {row.map(chip)}
          </div>
        ))}
      </div>
      {/* finisher touchline, sharing the turf greens */}
      <div
        style={{
          position: "absolute",
          top: 1042,
          left: 10,
          right: 10,
          borderRadius: 14,
          border: `5px solid ${COLORS.ink}`,
          boxShadow: neoShadow(6),
          background: "hsl(140 34% 10%)",
          display: "flex",
          alignItems: "center",
          padding: "12px 18px",
          gap: 16,
        }}
      >
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 20, letterSpacing: 3, color: "hsl(30 100% 97% / 0.7)" }}>FINISHERS</div>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-evenly" }}>{FINISHERS.map(chip)}</div>
      </div>
      {children}
    </SafeArea>
  );
};

// ── scenes ─────────────────────────────────────────────────────────────────
const Open: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const abs = START.open + frame;
  const exit = { opacity: inOut(frame, dur, 5) };
  // frame 0 is mid-motion: the countdown is already ticking (tick pulse decays
  // from f0) and the kicker settles from 1.05 — never a fade-in, never blank.
  const settle = interpolate(frame, [0, 5], [1.05, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={abs} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <SafeArea center>
        <div style={{ transform: `scale(${settle})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 6, color: "hsl(30 100% 97% / 0.75)" }}>FIRST KICKOFF</div>
          <div style={{ marginTop: 14, fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, letterSpacing: -1, color: COLORS.cream, textShadow: `6px 6px 0 ${COLORS.ink}` }}>
            TELSTAR v SPARTA
          </div>
          <div style={{ marginTop: 44 }}>
            <Countdown abs={abs} size={158} />
          </div>
          <SecondDrain abs={abs} width={700} />
          <div style={{ marginTop: 54 }}>
            <Pill bg={COLORS.lime} fg={COLORS.ink} size={34} rot={-1.5}>
              THE WEEKEND · GW 1
            </Pill>
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Fixtures: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 5) };
  const landedCards = Math.min(FACTS.cards.length, Math.max(0, Math.floor((frame - 40) / CARD_STEP) + 1));
  const stamp = spr(frame, fps, 156, 11, 14);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={START.fixtures + frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <SafeArea>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.45} damping={10}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 76, letterSpacing: -2, lineHeight: 1.0, color: COLORS.cream, textShadow: `7px 7px 0 ${COLORS.ink}` }}>
              THE BIG LEAGUES
              <br />
              ARE ASLEEP.
            </div>
          </Slam>
          <Slam frame={frame} fps={fps} delay={24} from={1.6} rot={-2} damping={9}>
            <div style={{ marginTop: 18 }}>
              <Pill bg={COLORS.lime} fg={COLORS.ink} size={40} rot={-2}>
                GOOD.
              </Pill>
            </div>
          </Slam>
        </div>
        <div style={{ position: "absolute", top: 300, left: 18, right: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {FACTS.cards.slice(0, landedCards).map((c, i) => {
            const at = 40 + i * CARD_STEP;
            const s = spr(frame, fps, at, 9, 13);
            const latest = i === landedCards - 1;
            const sh = shake(frame, at, 10, 8);
            return (
              <div
                key={c.home}
                style={{
                  transform: `translate(${latest ? sh.x : 0}px, ${latest ? sh.y : 0}px) scale(${1.22 - 0.22 * s})`,
                  opacity: Math.min(1, s * 2) * (latest ? 1 : 0.8),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", background: COLORS.ink, border: `5px solid ${latest ? COLORS.lime : "hsl(30 100% 97% / 0.4)"}`, borderRadius: 14, boxShadow: neoShadow(7), padding: "16px 24px", gap: 18 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 43, letterSpacing: -1, color: COLORS.cream, lineHeight: 1.02, whiteSpace: "nowrap" }}>
                      {c.home} <span style={{ color: "hsl(30 100% 97% / 0.5)" }}>—</span> {c.away}
                    </div>
                    <div style={{ marginTop: 6, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 20, letterSpacing: 3, color: "hsl(30 100% 97% / 0.55)" }}>{c.league}</div>
                  </div>
                  <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 27, letterSpacing: 2, padding: "8px 16px", borderRadius: 9, border: `3px solid ${COLORS.ink}` }}>
                    {c.day}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", transform: `scale(${0.6 + stamp * 0.4})`, opacity: Math.min(1, stamp * 2) }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.lime }}>36 GAMES · 4 LEAGUES · ONE SQUAD</div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// fill: 8 real shirts land at SHIRT_STEP, the bar drains live
const FILL_LANDINGS: Landing[] = Array.from({ length: FACTS.fillCount }, (_, i) => ({ idx: i, at: 6 + i * SHIRT_STEP }));

const Fill: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 5) };
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={START.fill + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.04} />
      </Ground>
      <Board frame={frame} fps={fps} landings={FILL_LANDINGS} />
    </AbsoluteFill>
  );
};

// squeeze: duel overlay to f148 ("Choose."), then the pick slams and the last
// four shirts sprint the bar to 91.0 — plan == board arithmetic, verified.
const PICK_AT = 148;
const SQUEEZE_LANDINGS: Landing[] = [
  ...FILL_LANDINGS.map((l) => ({ ...l, at: -20 })), // already on the pitch
  { idx: 8, at: PICK_AT },
  { idx: 9, at: 154 },
  { idx: 10, at: 160 },
  { idx: 11, at: 166 },
  { idx: 12, at: 172 },
];
const SPENT_AFTER_FILL = SQUAD.slice(0, FACTS.fillCount).reduce((a, s) => a + s.price, 0); // 55.5

const Squeeze: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const star = SQUAD[FACTS.squeezeIndex];
  const alt = FACTS.squeezeAlt;
  const duel = frame < PICK_AT;
  const pickShake = shake(frame, PICK_AT, 16, 10);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={START.squeeze + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.04} />
      </Ground>
      <div style={{ transform: `translate(${pickShake.x}px, ${pickShake.y}px)` }}>
        <Board frame={frame} fps={fps} landings={SQUEEZE_LANDINGS} />
      </div>
      {duel && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "hsl(0 0% 7% / 0.85)" }} />
          <SafeArea>
            <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, fontVariantNumeric: "tabular-nums" }}>
              {fmt(BUDGET - SPENT_AFTER_FILL)} LEFT · 5 PLAYERS
            </div>
            <div style={{ position: "absolute", top: 120, left: 24, right: 24 }}>
              <Slam frame={frame} fps={fps} delay={4} from={1.4} damping={9}>
                <div style={{ background: COLORS.cream, border: `6px solid ${COLORS.ink}`, borderRadius: 20, boxShadow: neoShadow(12), padding: "30px 36px", display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -3, color: COLORS.ink, lineHeight: 0.95 }}>{star.surname}</div>
                    <div style={{ marginTop: 10, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: "hsl(0 0% 7% / 0.6)" }}>{star.chip}</div>
                  </div>
                  <div style={{ background: COLORS.ink, color: COLORS.lime, fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, padding: "10px 28px", borderRadius: 14, fontVariantNumeric: "tabular-nums" }}>
                    {star.price.toFixed(1)}
                  </div>
                </div>
              </Slam>
              <div style={{ marginTop: 26, textAlign: "center" }}>
                <Slam frame={frame} fps={fps} delay={26} from={1.7} rot={2} damping={9}>
                  <Pill bg={COLORS.cream} fg={COLORS.ink} size={38} rot={2}>
                    OR
                  </Pill>
                </Slam>
              </div>
              <div style={{ marginTop: 26, display: "flex", justifyContent: "center", gap: 20 }}>
                {Array.from({ length: alt.count }, (_, i) => {
                  const s = spr(frame, fps, 36 + i * 10, 10, 13);
                  return (
                    <div key={i} style={{ transform: `scale(${1.25 - 0.25 * s})`, opacity: Math.min(1, s * 2), background: COLORS.ink, border: `5px solid ${COLORS.cream}`, borderRadius: 16, boxShadow: neoShadow(7), padding: "20px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <Jersey empty w={70} />
                      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 46, color: COLORS.lime, fontVariantNumeric: "tabular-nums" }}>{alt.price.toFixed(1)}</div>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  marginTop: 22,
                  textAlign: "center",
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 30,
                  letterSpacing: 3,
                  color: "hsl(30 100% 97% / 0.75)",
                  opacity: Math.min(1, spr(frame, fps, 96, 11, 13) * 2),
                  transform: `scale(${0.7 + 0.3 * spr(frame, fps, 96, 11, 13)})`,
                }}
              >
                = {fmt(alt.count * alt.price)} FOR THREE
              </div>
              <div style={{ marginTop: 34, textAlign: "center", transform: `scale(${frame >= 80 ? 1 + 0.05 * Math.sin((frame - 80) / 2.4) : 0})` }}>
                <Pill bg={COLORS.red} fg={COLORS.cream} size={46} rot={-1.5}>
                  PICK.
                </Pill>
              </div>
            </div>
          </SafeArea>
        </>
      )}
    </AbsoluteFill>
  );
};

// rules: three hits stamped over the finished board, countdown draining below
const ALL_LANDED: Landing[] = SQUAD.map((_, i) => ({ idx: i, at: -20 }));

const Rules: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = START.rules + frame;
  const exit = { opacity: inOut(frame, dur, 5) };
  const hit = (at: number) => spr(frame, fps, at, 9, 14);
  const h1 = hit(4), h2 = hit(59), h3 = hit(114), h3b = hit(134);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink} />
      <div style={{ opacity: 0.3 }}>
        <Board frame={frame} fps={fps} landings={ALL_LANDED} />
      </div>
      <SafeArea>
        <div style={{ position: "absolute", top: 130, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 60, textAlign: "center" }}>
          <div style={{ transform: `scale(${1.5 - 0.5 * h1}) rotate(${-1.5 * (1 - h1)}deg)`, opacity: Math.min(1, h1 * 2) }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 116, letterSpacing: -3, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>13 PLAYERS.</div>
          </div>
          <div style={{ transform: `scale(${1.5 - 0.5 * h2}) rotate(${1.5 * (1 - h2)}deg)`, opacity: Math.min(1, h2 * 2) }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 116, letterSpacing: -3, color: COLORS.lime, textShadow: `9px 9px 0 ${COLORS.ink}` }}>91.0 BUDGET.</div>
          </div>
          <div>
            <div style={{ transform: `scale(${1.4 - 0.4 * h3})`, opacity: Math.min(1, h3 * 2), fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -2, color: COLORS.cream, textShadow: `7px 7px 0 ${COLORS.ink}` }}>
              EVERY PLAYER LOCKS
            </div>
            <div style={{ marginTop: 12, transform: `scale(${1.4 - 0.4 * h3b})`, opacity: Math.min(1, h3b * 2), fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -2, color: COLORS.red, textShadow: `7px 7px 0 ${COLORS.ink}` }}>
              AT HIS OWN KICKOFF.
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "hsl(30 100% 97% / 0.7)" }}>FIRST KICKOFF</div>
          <div style={{ marginTop: 6 }}>
            <Countdown abs={abs} size={96} />
          </div>
          <SecondDrain abs={abs} width={920} height={14} />
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = START.cta + frame;
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const card = spr(frame, fps, 18, 10, 15);
  const pill = spr(frame, fps, 36, 11, 14);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={abs} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash * 0.9 }} />
      <SafeArea>
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 4, color: "hsl(30 100% 97% / 0.75)" }}>FIRST KICKOFF</div>
          <div style={{ marginTop: 8 }}>
            <Countdown abs={abs} size={104} />
          </div>
          <SecondDrain abs={abs} width={920} height={14} />
        </div>
        <div style={{ position: "absolute", top: 420, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.45} damping={10}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, letterSpacing: -3, lineHeight: 1.0, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
              NO SIGNUP.
              <br />
              NO APP.
            </div>
          </Slam>
          <div style={{ marginTop: 60, transform: `scale(${0.6 + card * 0.4})`, opacity: Math.min(1, card * 2) }}>
            <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, letterSpacing: -1, padding: "26px 44px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>
              VERVEQ.COM
              <span style={{ opacity: 0.65 }}>/</span>WEEKEND
            </div>
          </div>
          <div style={{ marginTop: 34, transform: `scale(${0.6 + pill * 0.4})`, opacity: Math.min(1, pill * 2) }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={32} rot={1.5}>
              PLAY FREE
            </Pill>
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const SCENE_MAP: Record<string, React.FC<{ dur: number }>> = {
  open: Open,
  fixtures: Fixtures,
  fill: Fill,
  squeeze: Squeeze,
  rules: Rules,
  cta: Cta,
};

export const Boost: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wknd-42h.wav")} />
    {hasVo
      ? BOOST.cues.map((c) => {
          const line = vo(c.key);
          if (!line) return null;
          return (
            <Sequence key={c.key} from={c.at} durationInFrames={Math.ceil(line.dur * FPS) + 8} layout="none">
              <Audio src={staticFile(`promo/vo-wknd/${c.key}.mp3`)} />
            </Sequence>
          );
        })
      : null}
    {BOOST.scenes.map((s) => {
      const Comp = SCENE_MAP[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
