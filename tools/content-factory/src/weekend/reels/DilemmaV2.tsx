// DILEMMA-WEEKLY v2 — "the-dilemma" amended by MONID-SWEEP-2
// (research/ig-fpl-decision-sweep/REPORT.md), for editions posted from
// Tue 2026-08-19 on. Dilemma.tsx (v1) is FROZEN: it backs the post-as-built
// paid-vs-organic twin and must keep rendering byte-for-byte what shipped.
//
// What the sweep changed, and what it didn't:
//   1. 13.4s, not 20s — the niche's winners are bimodal (40–130s argued
//      analysis, or ≤12s prompt-bait) and NOTHING between 12s and 40s clears
//      30K. This format is prompt-bait in function, so it exits the dead zone
//      DOWNWARD: fewer held frames, no a/b side reads (the cards + subtitles
//      carry the sides), the voice carries question / 3-2-1 / CTA only.
//   2. The DEADLINE is in the spoken question and the caption lead, not just
//      a card corner — our per-player lock is the one thing no competitor can
//      peg. deadlineDay is GATED against the earliest kickoff among the named
//      players. Day words only, never a clock time (no timezone claims).
//   3. Native-style SUBTITLES mirror ALL VO, word-timed from the ElevenLabs
//      timestamps in vo.json — 89% of the niche's winners carry them. Inter,
//      white, black-stroked, sentence case: the question and subtitles read
//      native; the ink/lime brand treatment stays on the cards (sweep spec
//      change #2 verbatim).
//   4. One RECEIPT row per card, BOTH sides, board-derivable only — the gate
//      (weekend/dilemma-v2-live.mjs) recomputes each receipt from the live
//      board, so an uncitable receipt cannot reach a frame.
//
// THE WITHHOLD LAW IS UNTOUCHED: same neutral geometry, both cards from one
// component, `task`/`count` render both sides neutral, the closer marks
// neither. There is still no winner state in this file to ship by accident.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, SafeArea, spr, shake, neoShadow } from "../../promo/kit";
import { FPS, dilemmaV2Grid, startsOf, totalOf, type DilemmaV2Edition, type DilemmaV2Side } from "./timeline";
import { hasVo, vo } from "./vo";
import FACTS from "./dilemma-v2-facts.json";

const EDITIONS = FACTS.editions as unknown as DilemmaV2Edition[];
export const v2EditionOf = (id: string): DilemmaV2Edition => {
  const ed = EDITIONS.find((e) => e.id === id);
  if (!ed) throw new Error(`DilemmaV2: no edition "${id}"`);
  return ed;
};
export const dilemmaV2Total = (id: string): number => totalOf(dilemmaV2Grid(v2EditionOf(id).grid).scenes);
export const DILEMMA_V2_EDITIONS = EDITIONS;

const fmt = (n: number) => n.toFixed(1);

// ── native subtitles ───────────────────────────────────────────────────────
// Word-timed from vo.json (ElevenLabs character timestamps), grouped into
// short chunks the way platform auto-captions read. One overlay for the whole
// reel, driven by ABSOLUTE frame, so a cue that crosses a scene cut keeps its
// subtitle. Sentence case, Inter, white on a black stroke — deliberately NOT
// the brand type: subtitles and question read native, ink/lime stays on the
// cards (sweep spec change #2).
type SubChunk = { text: string; from: number; to: number; cue: string };
const chunksOf = (cues: { key: string; at: number }[]): SubChunk[] => {
  const out: SubChunk[] = [];
  for (const cue of cues) {
    const line = vo(cue.key);
    if (!line?.words?.length) continue;
    let cur: { words: string[]; t0: number; t1: number } | null = null;
    const flush = () => {
      if (cur) out.push({ text: cur.words.join(" "), from: cue.at + Math.round(cur.t0 * FPS), to: cue.at + Math.round(cur.t1 * FPS), cue: cue.key });
      cur = null;
    };
    for (const w of line.words) {
      if (!cur) cur = { words: [], t0: w.t0, t1: w.t1 };
      cur.words.push(w.word);
      cur.t1 = w.t1;
      // chunk breaks on terminal punctuation or at 4 words — the auto-caption cadence
      if (/[.!?,]$/.test(w.word) || cur.words.length >= 4) flush();
    }
    flush();
  }
  // a chunk bridges to the next chunk of ITS OWN cue (no flicker inside a
  // line) but never across the silence between cues — the first cut caught a
  // question chunk squatting on screen for 5s waiting for the 3-2-1. When
  // the voice stops, the caption goes with it (a short 8f release).
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    out[i].to = next && next.cue === out[i].cue ? Math.max(out[i].to, next.from) : out[i].to + 8;
  }
  return out;
};

const Subtitles: React.FC<{ chunks: SubChunk[]; abs: number }> = ({ chunks, abs }) => {
  const cur = chunks.find((c) => abs >= c.from && abs < c.to);
  if (!cur) return null;
  return (
    <SafeArea>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.15,
            color: "#FFFFFF",
            textAlign: "center",
            maxWidth: 880,
            textShadow: "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 6px 0 #000",
          }}
        >
          {cur.text}
        </div>
      </div>
    </SafeArea>
  );
};

// ── the decide clock + drain (v1's meter, shorter runway) ──────────────────
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

const DRAIN_H = 28;
const TimeDrain: React.FC<{ abs: number; total: number }> = ({ abs, total }) => (
  <div style={{ width: "100%", height: DRAIN_H, borderRadius: DRAIN_H / 2, background: "hsl(75 100% 55% / 0.16)", overflow: "hidden", border: `2px solid hsl(30 100% 97% / 0.25)` }}>
    <div style={{ width: `${Math.max(0, 1 - abs / total) * 100}%`, height: "100%", background: COLORS.lime }} />
  </div>
);

// ── one option card — v1 geometry + the gated receipt row ──────────────────
// `active` only ever means "this is the side being read right now"; task and
// count pass active=null. No scale on the lit card (the v1 safe-zone lesson):
// lit = lime border + deeper shadow + the other card dropping to 0.42.
const OptionCard: React.FC<{
  side: DilemmaV2Side;
  active: boolean | null;
  frame: number;
  fps: number;
  rowStep: number;
  reveal: boolean;
}> = ({ side, active, frame, fps, rowStep, reveal }) => {
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
        padding: "18px 26px 20px",
        opacity: dim ? 0.42 : 1,
        transform: `translateY(${-3 * pop}px)`,
      }}
    >
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
        // rows are never hidden (the Berghuis lesson) — the read is a nudge
        const sh = reveal ? shake(frame, 6 + i * rowStep, 7, 9) : { x: 0, y: 0 };
        return (
          <div key={p.board} style={{ marginTop: solo ? 12 : 10, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: solo ? 76 : 56,
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
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, color: COLORS.lime, fontVariantNumeric: "tabular-nums" }}>{fmt(p.price)}</div>
              )}
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10, flexWrap: "nowrap" }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: solo ? 26 : 23, letterSpacing: 2, color: "hsl(30 100% 97% / 0.78)", whiteSpace: "nowrap" }}>
                {p.chip} · {p.pos}
              </div>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "hsl(30 100% 97% / 0.4)" }} />
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: solo ? 26 : 23, letterSpacing: 2, color: "hsl(30 100% 97% / 0.78)", whiteSpace: "nowrap" }}>
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

      {/* the receipt — one row, both sides get one, recomputed from the live
          board by the gate. Lime on the card is where the brand accent LIVES
          in v2; a side without a receipt fails the render. */}
      <div style={{ marginTop: 12, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 19, letterSpacing: 2, color: COLORS.lime }}>{side.receipt.tag}</div>
    </div>
  );
};

// ── the persistent frame ───────────────────────────────────────────────────
const Frame: React.FC<{
  ed: DilemmaV2Edition;
  abs: number;
  total: number;
  frame: number;
  fps: number;
  activeKey: string | null;
  reveal: boolean;
  rowStep: number;
}> = ({ ed, abs, total, frame, fps, activeKey, reveal, rowStep }) => (
  <SafeArea>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: COLORS.lime }}>THE DILEMMA</div>
        <Clock abs={abs} total={total} />
      </div>

      {/* the question, in the spoken register — sentence case, native type,
          carrying the deadline day. Persistent, never re-stated. */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 56, letterSpacing: -1, lineHeight: 1.08, color: COLORS.cream, textShadow: `6px 6px 0 ${COLORS.ink}` }}>
          {ed.question.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <TimeDrain abs={abs} total={total} />
      </div>

      {/* both options, same component, no winner state; 118px reserved below
          for the subtitle band so a caption never rides a card */}
      <div style={{ flex: 1, marginTop: 18, marginBottom: 118, marginLeft: 14, marginRight: 14, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        <OptionCard side={ed.sides[0]} active={activeKey === null ? null : activeKey === ed.sides[0].key} frame={frame} fps={fps} rowStep={rowStep} reveal={reveal && activeKey === ed.sides[0].key} />
        <div style={{ textAlign: "center" }}>
          <Pill bg={COLORS.cream} fg={COLORS.ink} size={30} rot={-1.5}>
            OR
          </Pill>
        </div>
        <OptionCard side={ed.sides[1]} active={activeKey === null ? null : activeKey === ed.sides[1].key} frame={frame} fps={fps} rowStep={rowStep} reveal={reveal && activeKey === ed.sides[1].key} />
      </div>
    </div>
  </SafeArea>
);

// ── scenes ─────────────────────────────────────────────────────────────────
type SceneProps = { ed: DilemmaV2Edition; dur: number; start: number; total: number; rowStep: number };

const Task: React.FC<SceneProps> = ({ ed, start, total, rowStep }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={start + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <Frame ed={ed} abs={start + frame} total={total} frame={frame} fps={fps} activeKey={null} reveal={false} rowStep={rowStep} />
    </AbsoluteFill>
  );
};

const Side: React.FC<SceneProps & { which: 0 | 1 }> = ({ ed, start, total, which, rowStep }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={start + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <Frame ed={ed} abs={start + frame} total={total} frame={frame} fps={fps} activeKey={ed.sides[which].key} reveal rowStep={rowStep} />
    </AbsoluteFill>
  );
};

// count: 3–2–1 over BOTH cards, neutral, on a 30f step (the spoken take's own
// cadence is ~1s/beat). The numeral sits on the gap between the cards — the
// v1 lesson: a centred numeral lands over card A and reads as a strike-out.
const Count: React.FC<SceneProps> = ({ ed, start, total, rowStep }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = 30;
  const idx = Math.min(2, Math.floor(frame / step));
  const local = frame - idx * step;
  const s = spr(local, fps, 0, 9, 12);
  const n = 3 - idx;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink}>
        <Stripes frame={start + frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <Frame ed={ed} abs={start + frame} total={total} frame={frame} fps={fps} activeKey={null} reveal={false} rowStep={rowStep} />
      <AbsoluteFill style={{ background: "hsl(0 0% 7% / 0.72)" }} />
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

// closer: the format's law on screen, compressed to 3.2s — no side named,
// no side marked. Spring delays tightened from v1's 20/42/62 to 10/24/38.
const Closer: React.FC<SceneProps> = ({ start, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = start + frame;
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const line2 = spr(frame, fps, 10, 10, 14);
  const card = spr(frame, fps, 24, 10, 15);
  const pill = spr(frame, fps, 38, 11, 14);
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
          <div style={{ marginTop: 40, transform: `scale(${0.7 + 0.3 * line2})`, opacity: Math.min(1, line2 * 2) }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, lineHeight: 1.05, color: COLORS.lime, textShadow: `6px 6px 0 ${COLORS.ink}` }}>
              PICK IN THE
              <br />
              COMMENTS.
            </div>
          </div>
          <div style={{ marginTop: 46, transform: `scale(${0.6 + card * 0.4})`, opacity: Math.min(1, card * 2) }}>
            <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 56, letterSpacing: -1, padding: "24px 38px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>
              VERVEQ.COM<span style={{ opacity: 0.65 }}>/</span>WEEKEND
            </div>
          </div>
          <div style={{ marginTop: 28, transform: `scale(${0.6 + pill * 0.4})`, opacity: Math.min(1, pill * 2) }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={30} rot={1.5}>
              OR PICK FOR REAL · FREE, NO SIGNUP
            </Pill>
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

export const DilemmaV2: React.FC<{ id: string }> = ({ id }) => {
  const ed = v2EditionOf(id);
  const grid = dilemmaV2Grid(ed.grid);
  const START = startsOf(grid.scenes);
  const total = totalOf(grid.scenes);
  const rowStep = grid.rowStep ?? 18;
  const abs = useCurrentFrame();
  const chunks = chunksOf(grid.cues);
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
            <Comp ed={ed} dur={s.dur} start={START[s.key]} total={total} rowStep={rowStep} />
          </Sequence>
        );
      })}
      {/* subtitles ride ABOVE every scene (and the count scrim), keyed on the
          absolute frame so a take that crosses a hard cut keeps its caption */}
      <Subtitles chunks={chunks} abs={abs} />
    </AbsoluteFill>
  );
};
