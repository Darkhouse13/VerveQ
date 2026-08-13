// CF-WEEKEND R2 — "THE CROWD IS THE REFEREE". Two FT performances with the
// same topline, six tie-breaker rows at the standing 7.00s pace, none of them
// breaks the tie, verdict withheld. The crowd-vote is the punchline frame,
// never the subject.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, spr, inOut, shake, neoShadow } from "../../promo/kit";
import { FPS, REFEREE, REFEREE_CAST, REFEREE_ROWS, startsOf, totalOf } from "./timeline";
import { hasVo, vo } from "./vo";

const START = startsOf(REFEREE.scenes);
export const REFEREE_TOTAL = totalOf(REFEREE.scenes);
const STEP = REFEREE.rowStep ?? 210;

const CastPlate: React.FC<{ name: string; club: string; league: string; color: string; landed: boolean; delay?: number }> = ({ name, club, league, color, landed, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = landed ? 1 : spr(frame, fps, delay, 10, 15);
  return (
    <div style={{ flex: 1, transform: `scale(${landed ? 1 : 1.3 - 0.3 * s})`, opacity: landed ? 1 : Math.min(1, s * 2), background: COLORS.ink, border: `5px solid ${color}`, borderRadius: 18, boxShadow: `8px 8px 0 hsl(0 0% 0% / 0.4)`, padding: "24px 18px", textAlign: "center" }}>
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, letterSpacing: -1, color, lineHeight: 0.95 }}>{name}</div>
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 2, color: COLORS.cream, opacity: 0.8, marginTop: 10 }}>{club}</div>
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 21, letterSpacing: 3, color: COLORS.cream, opacity: 0.45, marginTop: 4 }}>{league}</div>
    </div>
  );
};

const CastHeader: React.FC<{ landed: boolean }> = ({ landed }) => (
  <div style={{ position: "absolute", top: 190, left: 44, right: 44, display: "flex", gap: 20, alignItems: "stretch" }}>
    <CastPlate {...REFEREE_CAST.a} color={COLORS.lime} landed={landed} delay={4} />
    <div style={{ alignSelf: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 44, color: COLORS.cream, opacity: 0.7 }}>VS</div>
    <CastPlate {...REFEREE_CAST.b} color={COLORS.pink} landed={landed} delay={10} />
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
      <div style={{ position: "absolute", top: 66, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>OPENING WEEKEND · FULL TIME</div>
      <CastHeader landed={false} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", padding: "0 60px" }}>
        {/* pre-landed punch — readable on frame 0 (retention law), settle
            keeps the motion alive while the cast plates spring in. */}
        <div style={{ transform: `scale(${interpolate(frame, [0, 5], [1.08, 1], { extrapolateRight: "clamp" })})` }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 120, letterSpacing: -4, lineHeight: 0.95, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
            SAME WEEKEND.<br />
            <span style={{ color: COLORS.lime }}>SAME NUMBERS.</span>
          </div>
        </div>
        <Slam frame={frame} fps={fps} delay={20} from={1.3} damping={11}>
          <div style={{ marginTop: 54 }}>
            <Pill bg={COLORS.cream} fg={COLORS.ink} size={36} rot={-1.5}>YOU'RE THE REFEREE</Pill>
          </div>
        </Slam>
      </div>
    </AbsoluteFill>
  );
};

const Rows: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const landedCount = Math.min(REFEREE_ROWS.length, Math.floor(frame / STEP) + 1);
  // keep at most 4 rows on screen: older rows compress upward
  const firstShown = Math.max(0, landedCount - 4);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", top: 66, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>
        TIE-BREAKER {Math.min(landedCount, REFEREE_ROWS.length)} / {REFEREE_ROWS.length}
      </div>
      <CastHeader landed />
      <div style={{ position: "absolute", top: 480, left: 44, right: 44, display: "flex", flexDirection: "column", gap: 26 }}>
        {REFEREE_ROWS.slice(firstShown, landedCount).map((row, k) => {
          const i = firstShown + k;
          const at = i * STEP;
          const s = spr(frame, fps, at, 10, 15);
          const sh = shake(frame, at, 10, 7);
          const latest = i === landedCount - 1;
          return (
            <div key={row.label} style={{ transform: `translate(${latest ? sh.x : 0}px, ${latest ? sh.y : 0}px) scale(${1.25 - 0.25 * s})`, opacity: Math.min(1, s * 2) * (latest ? 1 : 0.62) }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 4, color: COLORS.ink, background: COLORS.cream, borderRadius: 10, padding: "8px 22px" }}>{row.label}</div>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1, background: COLORS.ink, border: `4px solid ${COLORS.lime}`, borderRadius: 14, boxShadow: neoShadow(6), padding: "20px 14px", textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: row.a.length > 12 ? 34 : 56, color: COLORS.lime, lineHeight: 1.05, display: "flex", alignItems: "center", justifyContent: "center" }}>{row.a}</div>
                <div style={{ flex: 1, background: COLORS.ink, border: `4px solid ${COLORS.pink}`, borderRadius: 14, boxShadow: neoShadow(6), padding: "20px 14px", textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: row.b.length > 12 ? 34 : 56, color: COLORS.pink, lineHeight: 1.05, display: "flex", alignItems: "center", justifyContent: "center" }}>{row.b}</div>
              </div>
            </div>
          );
        })}
      </div>
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
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 60px" }}>
        <Slam frame={frame} fps={fps} from={1.6} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 168, letterSpacing: -5, lineHeight: 0.92, color: COLORS.cream, textShadow: `11px 11px 0 ${COLORS.ink}` }}>
            WHO WAS<br />BETTER?
          </div>
        </Slam>
        <div style={{ marginTop: 64, transform: `scale(${0.7 + second * 0.3})`, opacity: Math.min(1, second * 2) }}>
          <Pill bg={COLORS.red} fg={COLORS.cream} size={40} rot={1.5}>I'M NOT DECIDING.</Pill>
        </div>
      </div>
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
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 64px" }}>
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
      </div>
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
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 60px" }}>
        <Slam frame={frame} fps={fps} from={1.4} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -2, color: COLORS.cream, lineHeight: 1.0 }}>
            <span style={{ color: COLORS.lime }}>PRESTIANNI</span><br />OR<br />
            <span style={{ color: COLORS.pink }}>MEULENSTEEN</span>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, color: COLORS.cream, marginTop: 24 }}>ONE WORD. COMMENTS.</div>
        </Slam>
        <div style={{ marginTop: 62, transform: `scale(${0.6 + btn * 0.4})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, letterSpacing: 6, color: COLORS.cream }}>THE WEEKEND</div>
          <div style={{ marginTop: 22, background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 60, padding: "22px 52px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
          <div style={{ marginTop: 24, fontFamily: FONTS.body, fontWeight: 500, fontSize: 36, color: COLORS.cream, opacity: 0.85 }}>Play free · no signup</div>
        </div>
      </div>
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
