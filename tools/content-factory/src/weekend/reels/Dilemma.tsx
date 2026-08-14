// DILEMMA-B1 — "the-dilemma", the experiment lane's second occupant after
// chain-long was killed on the lane law (DECISIONS 2026-08-14). One real draft
// decision per edition, 20.0s, and it does NOT resolve.
//
// THE WITHHOLD LAW, as built: the reel never states which side is correct — not
// in VO, not in the caption, not on a card. The two sides are drawn from the
// same component with the same geometry; the only asymmetry anywhere is WHICH
// side is being read right now, and that alternates. In `task` and `count` both
// cards are rendered neutral, side by side, and the closer covers them without
// marking either. There is no winner state in this file to accidentally ship.
//
// FRAME 0 IS THE TASK, ALREADY MOVING: the question, both option cards and the
// draining clock are all on screen at frame 0 — the bar already losing width,
// the clock mid-tick-pulse, the stripes scrolling. Nothing fades up and nothing
// scales in from an overscale (that would push the header out through the top
// of the safe area on exactly those frames). No countdown card, no logo
// bumper, no black frame — hard cuts everywhere, and the chrome is identical
// across scenes so a cut is seamless rather than a flash.
//
// FACTS: every name, price, position, opponent, venue and day comes from
// dilemma-facts.json, which weekend/dilemma-live.mjs re-verifies against the
// prod board (fantasyMarket:getMarket) on EVERY render — drift throws. Both
// sides of an edition cost exactly the same, and every player named has a
// fixture, because budget mode server-rejects a fixtureless pick.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, SafeArea, spr, shake, neoShadow } from "../../promo/kit";
import { FPS, DILEMMA_GRID, startsOf, totalOf, type DilemmaEdition, type DilemmaSide } from "./timeline";
import { hasVo, vo } from "./vo";
import FACTS from "./dilemma-facts.json";

const EDITIONS = FACTS.editions as unknown as DilemmaEdition[];
export const editionOf = (id: string): DilemmaEdition => {
  const ed = EDITIONS.find((e) => e.id === id);
  if (!ed) throw new Error(`Dilemma: no edition "${id}"`);
  return ed;
};
export const dilemmaTotal = (id: string): number => totalOf(DILEMMA_GRID[id].scenes);
export const DILEMMA_EDITIONS = EDITIONS;

const fmt = (n: number) => n.toFixed(1);

// ── the decide clock ───────────────────────────────────────────────────────
// Counts the reel down in whole seconds. The bar below it (TimeDrain) is the
// same number drawn as a width, so the two never disagree.
const Clock: React.FC<{ abs: number; total: number }> = ({ abs, total }) => {
  const left = Math.max(0, Math.ceil((total - abs) / FPS));
  const tickAge = abs % FPS;
  const pulse = 1 + 0.07 * Math.max(0, 1 - tickAge / 8);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "hsl(30 100% 97% / 0.6)" }}>DECIDE IN</div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 40,
          color: COLORS.lime,
          fontVariantNumeric: "tabular-nums",
          transform: `scale(${pulse})`,
          textShadow: `3px 3px 0 ${COLORS.ink}`,
        }}
      >
        {String(left).padStart(2, "0")}
      </div>
    </div>
  );
};

// The bar IS the clock, drawn. It drains once across the whole runtime, so its
// width always equals the fraction of the reel left to run and it agrees with
// the DECIDE IN numeral above it at every frame.
//
// It used to refill every second — a sawtooth — because that gave the motion
// gate an easy 0.37% per sample. But a bar that resets each second reports
// nothing about the time remaining; it was decoration pretending to be a meter,
// and two things on screen were telling different stories about the same clock.
// The gate is the thing that changed (see verify-reels.mjs), not the truth.
const DRAIN_H = 28;
const TimeDrain: React.FC<{ abs: number; total: number }> = ({ abs, total }) => (
  <div style={{ width: "100%", height: DRAIN_H, borderRadius: DRAIN_H / 2, background: "hsl(75 100% 55% / 0.16)", overflow: "hidden", border: `2px solid hsl(30 100% 97% / 0.25)` }}>
    <div style={{ width: `${Math.max(0, 1 - abs / total) * 100}%`, height: "100%", background: COLORS.lime }} />
  </div>
);

// ── one option card ────────────────────────────────────────────────────────
// `active` only ever means "this is the side being read right now". It is never
// a verdict: both scenes that could imply one (task, count) pass active=null.
const OptionCard: React.FC<{
  side: DilemmaSide;
  claimTag: string | null;
  active: boolean | null;
  frame: number;
  fps: number;
  rowStep: number;
  reveal: boolean;
}> = ({ side, claimTag, active, frame, fps, rowStep, reveal }) => {
  const lit = active === true;
  const dim = active === false;
  const solo = side.players.length === 1;
  const pop = lit ? spr(frame, fps, 0, 10, 12) : 0;
  return (
    <div
      style={{
        position: "relative",
        background: COLORS.ink,
        border: `6px solid ${lit ? COLORS.lime : "hsl(30 100% 97% / 0.45)"}`,
        borderRadius: 20,
        boxShadow: neoShadow(lit ? 12 : 7),
        padding: "20px 26px 22px",
        opacity: dim ? 0.42 : 1,
        // NO scale on the lit card. A 2% scale-up on a full-safe-width card
        // moves its edges to x=50.4 and x=1029.6 — inside BOTH platform chrome
        // strips — and the border is lime, so it lit the safe-zone gate up at
        // YMAX 217 on every side-scene frame. "Lit" is carried by the lime
        // border, the deeper shadow, and the other card dropping to 0.42.
        transform: `translateY(${-3 * pop}px)`,
      }}
    >
      {/* letter chip + the side's total — both sides show the SAME total, which
          is the whole point of the trade */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: lit ? COLORS.lime : "hsl(30 100% 97% / 0.9)",
            color: COLORS.ink,
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `4px solid ${COLORS.ink}`,
          }}
        >
          {side.key}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 3, color: "hsl(30 100% 97% / 0.6)" }}>{side.note}</div>
          <div
            style={{
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 54,
              color: lit ? COLORS.lime : COLORS.cream,
              fontVariantNumeric: "tabular-nums",
              textShadow: `4px 4px 0 ${COLORS.ink}`,
            }}
          >
            {fmt(side.total)}
          </div>
        </div>
      </div>

      {side.players.map((p, i) => {
        // A row is NEVER hidden and never re-appears. Both options are on screen
        // from frame 0 — that is the format — so staggering them in when their
        // side gets read made Berghuis vanish at f216 and land again at f240,
        // after the viewer had already read him at f0. The read is marked by a
        // NUDGE on the grid's cadence instead: same rhythm, same bed hits, no
        // content ever leaves the screen.
        const sh = reveal ? shake(frame, 6 + i * rowStep, 7, 9) : { x: 0, y: 0 };
        return (
          <div
            key={p.board}
            style={{
              marginTop: solo ? 14 : 12,
              transform: `translate(${sh.x}px, ${sh.y}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: solo ? 82 : 58,
                  letterSpacing: -2,
                  lineHeight: 1.0,
                  color: COLORS.cream,
                  textShadow: `5px 5px 0 ${COLORS.ink}`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {p.display}
              </div>
              {!solo && (
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontWeight: 700,
                    fontSize: 36,
                    color: COLORS.lime,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(p.price)}
                </div>
              )}
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "nowrap" }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: solo ? 28 : 23, letterSpacing: 2, color: "hsl(30 100% 97% / 0.78)", whiteSpace: "nowrap" }}>
                {p.chip} · {p.pos}
              </div>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "hsl(30 100% 97% / 0.4)" }} />
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: solo ? 28 : 23, letterSpacing: 2, color: "hsl(30 100% 97% / 0.78)", whiteSpace: "nowrap" }}>
                {p.isHome ? "v" : "at"} {p.oppChip}
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  background: COLORS.cream,
                  color: COLORS.ink,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: 2,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: `3px solid ${COLORS.ink}`,
                }}
              >
                {p.day}
              </div>
            </div>
          </div>
        );
      })}

      {claimTag && (
        <div style={{ marginTop: 14, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 19, letterSpacing: 2, color: COLORS.lime }}>{claimTag}</div>
      )}
    </div>
  );
};

// ── the persistent frame ───────────────────────────────────────────────────
// Rendered by EVERY scene, identical geometry, so scene changes are hard cuts
// with nothing moving underneath them.
const Frame: React.FC<{
  ed: DilemmaEdition;
  abs: number;
  total: number;
  frame: number;
  fps: number;
  activeKey: string | null;
  reveal: boolean;
}> = ({ ed, abs, total, frame, fps, activeKey, reveal }) => {
  const rowStep = DILEMMA_GRID[ed.id].rowStep ?? 18;
  const claimFor = (side: DilemmaSide) => (ed.claim && side.players.some((p) => p.board === ed.claim!.board) ? ed.claim.tag : null);
  return (
    <SafeArea>
      {/* NO frame-level settle scale. An overscale here would push the header
          out through the top of the safe area on exactly the frames it was
          meant to enliven (a 1.04 scale about the centre lifts the top edge
          ~28px, into the platform chrome strip). Frame 0 is already in motion
          without it: the drain bar is mid-drain, the clock is mid-tick-pulse
          and the stripes are scrolling. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: COLORS.lime }}>THE DILEMMA</div>
          <Clock abs={abs} total={total} />
        </div>

        {/* the task, stated as the question — persistent, never re-stated */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 60, letterSpacing: -2, lineHeight: 1.04, color: COLORS.cream, textShadow: `6px 6px 0 ${COLORS.ink}` }}>
            {ed.question.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <TimeDrain abs={abs} total={total} />
        </div>

        {/* the two options — same component, same geometry, no winner state.
            Centred in whatever height is left so a 1-player and a 2-player side
            both sit balanced rather than riding the top. */}
        <div style={{ flex: 1, marginTop: 22, marginLeft: 14, marginRight: 14, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <OptionCard
            side={ed.sides[0]}
            claimTag={claimFor(ed.sides[0])}
            active={activeKey === null ? null : activeKey === ed.sides[0].key}
            frame={frame}
            fps={fps}
            rowStep={rowStep}
            reveal={reveal && activeKey === ed.sides[0].key}
          />
          <div style={{ textAlign: "center" }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={30} rot={-1.5}>
              OR
            </Pill>
          </div>
          <OptionCard
            side={ed.sides[1]}
            claimTag={claimFor(ed.sides[1])}
            active={activeKey === null ? null : activeKey === ed.sides[1].key}
            frame={frame}
            fps={fps}
            rowStep={rowStep}
            reveal={reveal && activeKey === ed.sides[1].key}
          />
        </div>
      </div>
    </SafeArea>
  );
};

// ── scenes ─────────────────────────────────────────────────────────────────
type SceneProps = { ed: DilemmaEdition; dur: number; start: number; total: number };

// task: frame 0 is already the task. Settles from 1.04 — never a fade-in.
const Task: React.FC<SceneProps> = ({ ed, start, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={start + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <Frame ed={ed} abs={start + frame} total={total} frame={frame} fps={fps} activeKey={null} reveal={false} />
    </AbsoluteFill>
  );
};

const Side: React.FC<SceneProps & { which: 0 | 1 }> = ({ ed, start, total, which }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={start + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <Frame ed={ed} abs={start + frame} total={total} frame={frame} fps={fps} activeKey={ed.sides[which].key} reveal />
    </AbsoluteFill>
  );
};

// count: 3–2–1 over BOTH cards, neutral. The numerals are a scrimmed overlay,
// so the two options stay visible and equally weighted underneath.
const Count: React.FC<SceneProps> = ({ ed, start, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = 36;
  const idx = Math.min(2, Math.floor(frame / step));
  const local = frame - idx * step;
  const s = spr(local, fps, 0, 9, 12);
  const n = 3 - idx;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={start + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <Frame ed={ed} abs={start + frame} total={total} frame={frame} fps={fps} activeKey={null} reveal={false} />
      <AbsoluteFill style={{ background: "hsl(0 0% 7% / 0.72)" }} />
      {/* Shifted onto the GAP between the two cards, not the safe-area centre.
          The cards block sits low (its midpoint is ~150px below centre), so a
          centred numeral lands squarely over card A and reads as A being struck
          out — a verdict, in the one scene that must not imply one. Over the OR
          pill it covers both sides equally. */}
      <SafeArea center style={{ transform: "translateY(150px)" }}>
        <div
          style={{
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 420,
            lineHeight: 1,
            color: COLORS.lime,
            textShadow: `14px 14px 0 ${COLORS.ink}`,
            fontVariantNumeric: "tabular-nums",
            transform: `scale(${1.9 - 0.9 * s})`,
            opacity: Math.min(1, s * 2.4),
          }}
        >
          {n}
        </div>
        <div style={{ marginTop: 10, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 8, color: COLORS.cream }}>PICK ONE</div>
      </SafeArea>
    </AbsoluteFill>
  );
};

// closer: the format's law on screen. No side is named, no side is marked.
const Closer: React.FC<SceneProps> = ({ start, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = start + frame;
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const line2 = spr(frame, fps, 20, 10, 14);
  const card = spr(frame, fps, 42, 10, 15);
  const pill = spr(frame, fps, 62, 11, 14);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={abs} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash * 0.9 }} />
      <SafeArea>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: COLORS.lime }}>THE DILEMMA</div>
          <Clock abs={abs} total={total} />
        </div>
        <div style={{ position: "absolute", top: 58, left: 0, right: 0 }}>
          <TimeDrain abs={abs} total={total} />
        </div>
        <div style={{ position: "absolute", top: 190, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.4} damping={10}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, letterSpacing: -3, lineHeight: 0.98, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
              NO RIGHT
              <br />
              ANSWER.
            </div>
          </Slam>
          <div style={{ marginTop: 44, transform: `scale(${0.7 + 0.3 * line2})`, opacity: Math.min(1, line2 * 2) }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, lineHeight: 1.05, color: COLORS.lime, textShadow: `6px 6px 0 ${COLORS.ink}` }}>
              PICK IN THE
              <br />
              COMMENTS.
            </div>
          </div>
          <div style={{ marginTop: 52, transform: `scale(${0.6 + card * 0.4})`, opacity: Math.min(1, card * 2) }}>
            <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 56, letterSpacing: -1, padding: "24px 38px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>
              VERVEQ.COM<span style={{ opacity: 0.65 }}>/</span>WEEKEND
            </div>
          </div>
          <div style={{ marginTop: 30, transform: `scale(${0.6 + pill * 0.4})`, opacity: Math.min(1, pill * 2) }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={30} rot={1.5}>
              OR PICK FOR REAL · FREE, NO SIGNUP
            </Pill>
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

export const Dilemma: React.FC<{ id: string }> = ({ id }) => {
  const ed = editionOf(id);
  const grid = DILEMMA_GRID[id];
  const START = startsOf(grid.scenes);
  const total = totalOf(grid.scenes);
  const scene = (key: string): React.FC<SceneProps> => {
    switch (key) {
      case "task":
        return Task;
      case "sideA":
        return (p) => <Side {...p} which={0} />;
      case "sideB":
        return (p) => <Side {...p} which={1} />;
      case "count":
        return Count;
      default:
        return Closer;
    }
  };
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <Audio src={staticFile(`promo/${ed.slug}.wav`)} />
      {hasVo
        ? grid.cues.map((c) => {
            const line = vo(c.key);
            if (!line) return null;
            return (
              <Sequence key={c.key} from={c.at} durationInFrames={Math.ceil(line.dur * FPS) + 8} layout="none">
                <Audio src={staticFile(`promo/vo-wknd/${c.key}.mp3`)} />
              </Sequence>
            );
          })
        : null}
      {grid.scenes.map((s) => {
        const Comp = scene(s.key);
        return (
          <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
            <Comp ed={ed} dur={s.dur} start={START[s.key]} total={total} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
