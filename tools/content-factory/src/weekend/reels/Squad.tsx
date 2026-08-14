// CF-WEEKEND R3 — "13 SHIRTS, 91.0, EIGHT LEAGUES". A build-along on the real
// board: live prod prices, the greedy start, the arithmetic turning on you,
// one agonizing drop — and the final thirteen withheld. The board is the
// game; the product frame arrives only at the end.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, SafeArea, spr, inOut, shake, neoShadow } from "../../promo/kit";
import { FPS, SQUAD, SQUAD_BUDGET, SQUAD_SLOTS, SQUAD_STARS, SQUAD_GEMS, startsOf, totalOf } from "./timeline";
import { hasVo, vo } from "./vo";

const START = startsOf(SQUAD.scenes);
export const SQUAD_TOTAL = totalOf(SQUAD.scenes);
const STEP = SQUAD.starStep ?? 210;

const fmt = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

// ── shared board furniture ──
const BudgetBar: React.FC<{ left: number; pulse?: boolean }> = ({ left, pulse }) => {
  const frame = useCurrentFrame();
  const frac = left / SQUAD_BUDGET;
  const hot = frac < 0.5;
  const flash = pulse ? 0.75 + 0.25 * Math.sin(frame / 3) : 1;
  return (
    <div style={{ position: "absolute", top: 84, left: 0, right: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: COLORS.cream, marginBottom: 10 }}>
        <span style={{ opacity: 0.55 }}>BUDGET</span>
        <span style={{ color: hot ? COLORS.red : COLORS.lime, opacity: flash }}>{fmt(left)} LEFT</span>
      </div>
      <div style={{ height: 26, borderRadius: 13, border: `4px solid ${COLORS.cream}`, overflow: "hidden", background: COLORS.ink }}>
        <div style={{ width: `${Math.max(0, frac) * 100}%`, height: "100%", background: hot ? COLORS.red : COLORS.lime }} />
      </div>
    </div>
  );
};

const SlotRack: React.FC<{ filled: number }> = ({ filled }) => (
  <div style={{ position: "absolute", top: 158, left: 0, right: 0, display: "flex", gap: 10 }}>
    {Array.from({ length: SQUAD_SLOTS }, (_, i) => (
      <div key={i} style={{ flex: 1, height: 46, borderRadius: 9, border: `3px solid ${i < filled ? COLORS.lime : "hsl(30 100% 97% / 0.3)"}`, background: i < filled ? COLORS.lime : "transparent" }} />
    ))}
  </div>
);

const Board: React.FC<{ children: React.ReactNode; left: number; filled: number; pulse?: boolean }> = ({ children, left, filled, pulse }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <SafeArea>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: COLORS.cream }}>
          <span style={{ opacity: 0.9 }}>13 SHIRTS · 91.0 · 8 LEAGUES</span>
        </div>
        <BudgetBar left={left} pulse={pulse} />
        <SlotRack filled={filled} />
        {children}
      </SafeArea>
    </>
  );
};

// ── scenes ──
const Open: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  return (
    <AbsoluteFill style={exit}>
      <Board left={SQUAD_BUDGET} filled={0}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          {/* pre-landed punch, NOT a Slam: readable on frame 0 with the settle
              still moving — the batch-1 retention law (70% gone before 3s on a
              static open; a faded-in open is worse, it's a BLANK frame 0).
              v2: the hook leads with the four names, not the abstract number. */}
          <div style={{ transform: `scale(${interpolate(frame, [0, 5], [1.08, 1], { extrapolateRight: "clamp" })})` }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 86, letterSpacing: -2, lineHeight: 1.02, color: COLORS.cream, textShadow: `8px 8px 0 ${COLORS.ink}` }}>
              MBAPPÉ. YAMAL.<br />KANE. OLISE.
            </div>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -4, lineHeight: 0.95, color: COLORS.lime, textShadow: `9px 9px 0 ${COLORS.ink}`, marginTop: 34 }}>
              THEY DON'T<br />ALL FIT.
            </div>
          </div>
          <Slam frame={frame} fps={fps} delay={22} from={1.3} damping={11}>
            <div style={{ marginTop: 56 }}>
              <Pill bg={COLORS.cream} fg={COLORS.ink} size={38} rot={-1.5}>91.0. LET'S BUILD.</Pill>
            </div>
          </Slam>
        </div>
      </Board>
    </AbsoluteFill>
  );
};

const Stars: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const landed = Math.min(SQUAD_STARS.length, Math.floor(frame / STEP) + 1);
  const spent = SQUAD_STARS.slice(0, landed).reduce((a, s) => a + s.price, 0);
  // the bar drains as each card lands (a 12-frame ease from the previous value)
  const prev = SQUAD_STARS.slice(0, landed - 1).reduce((a, s) => a + s.price, 0);
  const t = interpolate(frame - (landed - 1) * STEP, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const left = SQUAD_BUDGET - (prev + (spent - prev) * t);
  return (
    <AbsoluteFill style={exit}>
      <Board left={Math.round(left * 2) / 2} filled={landed}>
        <div style={{ position: "absolute", top: 240, left: 16, right: 16, display: "flex", flexDirection: "column", gap: 24 }}>
          {SQUAD_STARS.slice(0, landed).map((star, i) => {
            const at = i * STEP;
            const s = spr(frame, fps, at, 9, 15);
            const sh = shake(frame, at, 11, 8);
            const latest = i === landed - 1;
            return (
              <div key={star.name} style={{ transform: `translate(${latest ? sh.x : 0}px, ${latest ? sh.y : 0}px) scale(${1.3 - 0.3 * s})`, opacity: Math.min(1, s * 2) * (latest ? 1 : 0.75) }}>
                <div style={{ display: "flex", alignItems: "center", background: COLORS.ink, border: `5px solid ${COLORS.lime}`, borderRadius: 16, boxShadow: neoShadow(8), padding: "24px 30px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 58, letterSpacing: -1, color: COLORS.cream, lineHeight: 1.0 }}>{star.name}</div>
                    <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: COLORS.cream, opacity: 0.5, marginTop: 6 }}>{star.club}</div>
                  </div>
                  <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 76, color: COLORS.lime }}>{fmt(star.price)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Board>
    </AbsoluteFill>
  );
};

const MathCard: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const second = spr(frame, fps, 110, 10, 16);
  const sh = shake(frame, 110, 14, 10);
  return (
    <AbsoluteFill style={exit}>
      <Board left={40.5} filled={4} pulse>
        <div style={{ position: "absolute", left: 0, right: 0, top: 230, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.5} damping={10}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 108, letterSpacing: -3, lineHeight: 0.95, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
              9 SHIRTS LEFT.<br />40.5 TO SPEND.
            </div>
          </Slam>
          <div style={{ marginTop: 66, transform: `translate(${second >= 0.1 ? sh.x : 0}px, ${second >= 0.1 ? sh.y : 0}px) scale(${0.7 + second * 0.3})`, opacity: Math.min(1, second * 2) }}>
            <div style={{ background: COLORS.red, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -2, padding: "26px 54px", border: `6px solid ${COLORS.cream}`, borderRadius: 20, boxShadow: `12px 12px 0 hsl(0 0% 0% / 0.4)`, transform: "rotate(-1.5deg)" }}>
              4.5 A SHIRT.
            </div>
          </div>
        </div>
      </Board>
    </AbsoluteFill>
  );
};

const Tradeoff: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  // each star card pulses in turn while the voice weighs the drop
  const hot = Math.floor(frame / 90) % SQUAD_STARS.length;
  return (
    <AbsoluteFill style={exit}>
      <Board left={40.5} filled={4} pulse>
        <div style={{ position: "absolute", top: 220, left: 0, right: 0, textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.5} damping={9}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 120, letterSpacing: -4, color: COLORS.red, textShadow: `9px 9px 0 ${COLORS.ink}` }}>ONE HAS TO GO.</div>
          </Slam>
        </div>
        <div style={{ position: "absolute", top: 390, left: 20, right: 20, display: "flex", flexDirection: "column", gap: 22 }}>
          {SQUAD_STARS.map((star, i) => {
            const isHot = i === hot;
            return (
              <div key={star.name} style={{ display: "flex", alignItems: "center", background: COLORS.ink, border: `5px solid ${isHot ? COLORS.red : "hsl(30 100% 97% / 0.35)"}`, borderRadius: 16, padding: "20px 30px", transform: isHot ? "scale(1.03)" : "scale(1)", opacity: isHot ? 1 : 0.6 }}>
                <div style={{ flex: 1, fontFamily: FONTS.head, fontWeight: 700, fontSize: 54, color: COLORS.cream }}>{star.name}</div>
                {isHot ? <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: COLORS.red, marginRight: 24 }}>DROP?</div> : null}
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, color: isHot ? COLORS.red : COLORS.lime }}>{fmt(star.price)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: COLORS.cream, opacity: 0.7 }}>
          DROP KANE → 5.3 A SHIRT FOR TEN
        </div>
      </Board>
    </AbsoluteFill>
  );
};

const Gems: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  return (
    <AbsoluteFill style={exit}>
      <Board left={40.5} filled={4}>
        <div style={{ position: "absolute", top: 220, left: 0, right: 0, textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.4} damping={10}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 86, letterSpacing: -2, color: COLORS.lime, textShadow: `8px 8px 0 ${COLORS.ink}` }}>THE BIN HAS<br />FAMOUS NAMES.</div>
          </Slam>
        </div>
        <div style={{ position: "absolute", top: 500, left: 16, right: 16, display: "flex", flexDirection: "column", gap: 24 }}>
          {SQUAD_GEMS.map((gem, i) => {
            const at = 30 + i * 70;
            const s = spr(frame, fps, at, 10, 15);
            return (
              <div key={gem.name} style={{ transform: `scale(${1.25 - 0.25 * s})`, opacity: Math.min(1, s * 2) }}>
                <div style={{ display: "flex", alignItems: "center", background: COLORS.ink, border: `5px solid ${COLORS.cream}`, borderRadius: 16, boxShadow: neoShadow(8), padding: "22px 30px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, color: COLORS.cream, lineHeight: 1.0 }}>{gem.name}</div>
                    <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 23, letterSpacing: 2, color: COLORS.lime, marginTop: 8 }}>{gem.receipt}</div>
                  </div>
                  <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, color: COLORS.lime }}>{fmt(gem.price)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Board>
    </AbsoluteFill>
  );
};

const Withhold: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const second = spr(frame, fps, 70, 11, 16);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <SafeArea center>
        <Slam frame={frame} fps={fps} from={1.5} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 116, letterSpacing: -4, lineHeight: 0.95, color: COLORS.cream, textShadow: `10px 10px 0 ${COLORS.ink}` }}>
            MY FINAL 13?<br />
            <span style={{ color: COLORS.lime }}>NOT SHOWING YOU.</span>
          </div>
        </Slam>
        <div style={{ marginTop: 64, transform: `scale(${0.7 + second * 0.3})`, opacity: Math.min(1, second * 2) }}>
          <Pill bg={COLORS.red} fg={COLORS.cream} size={42} rot={1.5}>WHO GOES? COMMENTS.</Pill>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const btn = spr(frame, fps, 14, 11, 16);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash * 0.9 }} />
      <SafeArea center>
        <Slam frame={frame} fps={fps} from={1.4} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: 7, color: COLORS.cream }}>THE WEEKEND</div>
        </Slam>
        <div style={{ marginTop: 44, transform: `scale(${0.6 + btn * 0.4})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, padding: "24px 56px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
          <div style={{ marginTop: 26, fontFamily: FONTS.body, fontWeight: 500, fontSize: 38, color: COLORS.cream, opacity: 0.85 }}>Play free · no signup</div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const SCENE_MAP: Record<string, React.FC<{ dur: number }>> = {
  open: Open,
  stars: Stars,
  math: MathCard,
  tradeoff: Tradeoff,
  gems: Gems,
  withhold: Withhold,
  cta: Cta,
};

export const Squad: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wknd-squad.wav")} />
    {hasVo
      ? SQUAD.cues.map((c) => {
          const line = vo(c.key);
          if (!line) return null;
          return (
            <Sequence key={c.key} from={c.at} durationInFrames={Math.ceil(line.dur * FPS) + 8} layout="none">
              <Audio src={staticFile(`promo/vo-wknd/${c.key}.mp3`)} />
            </Sequence>
          );
        })
      : null}
    {SQUAD.scenes.map((s) => {
      const Comp = SCENE_MAP[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
