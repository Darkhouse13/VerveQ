// CF-WEEKEND R2 — "THE CROWD IS THE REFEREE" (v2, owner recast 2026-08-13:
// famous names only). The duel is THE BOARD vs YOUR EYES: six of the live
// market's most argue-able price calls, one per beat at the standing 7.00s
// pace, verdict withheld. The crowd-vote is the punchline frame, never the
// subject. Frame 0 is the headline shock: OLISE COSTS MORE THAN MBAPPÉ.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, SafeArea, spr, inOut, shake, neoShadow } from "../../promo/kit";
import { FPS, REFEREE, REFEREE_ROWS, VsCard, startsOf, totalOf } from "./timeline";
import { hasVo, vo } from "./vo";

const START = startsOf(REFEREE.scenes);
export const REFEREE_TOTAL = totalOf(REFEREE.scenes);
const STEP = REFEREE.rowStep ?? 210;

const fmt = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

const PriceCard: React.FC<{ card: VsCard; color: string }> = ({ card, color }) => (
  <div style={{ flex: 1, background: COLORS.ink, border: `4px solid ${color}`, borderRadius: 14, boxShadow: neoShadow(6), padding: "22px 14px", textAlign: "center" }}>
    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: card.name.length > 9 ? 40 : 52, letterSpacing: -1, color: COLORS.cream, lineHeight: 1.0 }}>{card.name}</div>
    <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 21, letterSpacing: 2, color: COLORS.cream, opacity: 0.5, marginTop: 6 }}>{card.club}</div>
    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, color, marginTop: 8 }}>{fmt(card.price)}</div>
  </div>
);

const Open: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <SafeArea>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>THE LIVE BOARD · 8 LEAGUES</div>
      </SafeArea>
      <SafeArea center>
        {/* pre-landed punch — readable on frame 0 (retention law) */}
        <div style={{ transform: `scale(${interpolate(frame, [0, 5], [1.08, 1], { extrapolateRight: "clamp" })})` }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -4, lineHeight: 0.95, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
            OLISE COSTS<br />MORE THAN<br />
            <span style={{ color: COLORS.lime }}>MBAPPÉ.</span>
          </div>
        </div>
        <Slam frame={frame} fps={fps} delay={22} from={1.3} damping={11}>
          <div style={{ marginTop: 56 }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={36} rot={-1.5}>YOU'RE THE REFEREE</Pill>
          </div>
        </Slam>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Rows: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const landedCount = Math.min(REFEREE_ROWS.length, Math.floor(frame / STEP) + 1);
  const firstShown = Math.max(0, landedCount - 3);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <SafeArea>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>
          PRICE CHECK {Math.min(landedCount, REFEREE_ROWS.length)} / {REFEREE_ROWS.length}
        </div>
        <div style={{ position: "absolute", top: 66, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 54, letterSpacing: -1, color: COLORS.cream }}>
          THE BOARD <span style={{ color: COLORS.lime }}>vs</span> YOUR EYES
        </div>
        <div style={{ position: "absolute", top: 180, left: 16, right: 16, display: "flex", flexDirection: "column", gap: 30 }}>
        {REFEREE_ROWS.slice(firstShown, landedCount).map((row, k) => {
          const i = firstShown + k;
          const at = i * STEP;
          const s = spr(frame, fps, at, 10, 15);
          const sh = shake(frame, at, 10, 7);
          const latest = i === landedCount - 1;
          return (
            <div key={row.label} style={{ transform: `translate(${latest ? sh.x : 0}px, ${latest ? sh.y : 0}px) scale(${1.25 - 0.25 * s})`, opacity: Math.min(1, s * 2) * (latest ? 1 : 0.55) }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 4, color: COLORS.ink, background: COLORS.cream, borderRadius: 10, padding: "8px 22px" }}>{row.label}</div>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
                <PriceCard card={row.a} color={COLORS.lime} />
                <div style={{ alignSelf: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 38, color: COLORS.cream, opacity: 0.7 }}>VS</div>
                <PriceCard card={row.b} color={COLORS.pink} />
              </div>
            </div>
          );
        })}
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Question: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const second = spr(frame, fps, 130, 11, 16);
  const sh = shake(frame, 0, 13, 9);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <SafeArea center>
        <Slam frame={frame} fps={fps} from={1.6} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, letterSpacing: -5, lineHeight: 0.92, color: COLORS.cream, textShadow: `11px 11px 0 ${COLORS.ink}` }}>
            IS THE<br />BOARD<br />RIGHT?
          </div>
        </Slam>
        <div style={{ marginTop: 64, transform: `scale(${0.7 + second * 0.3})`, opacity: Math.min(1, second * 2) }}>
          <Pill bg={COLORS.red} fg={COLORS.cream} size={40} rot={1.5}>I'M NOT DECIDING.</Pill>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Punch: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const sub = spr(frame, fps, 40, 11, 16);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <SafeArea center>
        <Slam frame={frame} fps={fps} from={1.5} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 122, letterSpacing: -4, lineHeight: 0.95, color: COLORS.lime, textShadow: `10px 10px 0 ${COLORS.ink}` }}>
            THE CROWD<br />IS THE<br />REFEREE.
          </div>
        </Slam>
        <div style={{ marginTop: 58, maxWidth: 860, transform: `scale(${0.75 + sub * 0.25})`, opacity: Math.min(1, sub * 2) }}>
          {/* live manifesto copy, verbatim — a shape, never a number */}
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, lineHeight: 1.2, color: COLORS.cream }}>
            The crowd rates the players — not an algorithm.
          </div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const btn = spr(frame, fps, 34, 11, 16);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash * 0.9 }} />
      <SafeArea center>
        <Slam frame={frame} fps={fps} from={1.4} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, letterSpacing: -2, color: COLORS.cream, lineHeight: 0.98 }}>
            WORST PRICE<br />ON THE <span style={{ color: COLORS.lime }}>BOARD?</span>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, color: COLORS.cream, marginTop: 24 }}>COMMENTS. GO.</div>
        </Slam>
        <div style={{ marginTop: 62, transform: `scale(${0.6 + btn * 0.4})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, letterSpacing: 6, color: COLORS.cream }}>THE WEEKEND</div>
          <div style={{ marginTop: 22, background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 60, padding: "22px 52px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
          <div style={{ marginTop: 24, fontFamily: FONTS.body, fontWeight: 500, fontSize: 36, color: COLORS.cream, opacity: 0.85 }}>Play free · no signup</div>
        </div>
      </SafeArea>
    </AbsoluteFill>
  );
};

const SCENE_MAP: Record<string, React.FC<{ dur: number }>> = { open: Open, rows: Rows, question: Question, punch: Punch, cta: Cta };

export const Referee: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wknd-referee.wav")} />
    {hasVo
      ? REFEREE.cues.map((c) => {
          const line = vo(c.key);
          if (!line) return null;
          return (
            <Sequence key={c.key} from={c.at} durationInFrames={Math.ceil(line.dur * FPS) + 8} layout="none">
              <Audio src={staticFile(`promo/vo-wknd/${c.key}.mp3`)} />
            </Sequence>
          );
        })
      : null}
    {REFEREE.scenes.map((s) => {
      const Comp = SCENE_MAP[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
