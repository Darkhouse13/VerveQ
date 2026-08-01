import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { SKey, SPLITS, WR_TIME, START, FPS } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// The running timer readout. The parody runs "in-game time" (~2x real) so the
// WR lands on 0:09.94 — nobody audits a speedrun joke, the number IS the gag.
export const timerText = (globalFrame: number): string => {
  const elapsed = Math.max(0, globalFrame - START.run) / FPS;
  const t = Math.min(9.94, elapsed * 2);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
};

// ============================================================ TITLE
const Title: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", top: 480, left: 72, right: 72, transform: `scale(${settle})` }}>
        {/* frame-0 readable: the run card is already up */}
        <div style={{ display: "inline-block", background: COLORS.red, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, padding: "12px 30px", border: `4px solid ${COLORS.white}` }}>
          ● REC — WR ATTEMPT
        </div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 136, lineHeight: 0.96, letterSpacing: -4, color: COLORS.lime, textShadow: `8px 8px 0 ${COLORS.ink}`, WebkitTextStroke: `2px ${COLORS.ink}`, marginTop: 40 }}>
          ARGUMENT<br />SPEEDRUN
        </div>
        <div style={{ marginTop: 34, opacity: spr(frame, fps, 16, 13) }}>
          <div style={{ display: "inline-block", background: COLORS.card, color: COLORS.ink, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 3, padding: "14px 32px", border: `5px solid ${COLORS.ink}`, borderRadius: 12, boxShadow: `8px 8px 0 ${COLORS.lime}` }}>
            CATEGORY: ANY% · GLITCHLESS
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.lime, opacity: 0.55 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ RUN — the splits
const Run: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", top: 330, left: 72, right: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, color: COLORS.cream, opacity: 0.6 }}>
        SPLITS
      </div>
      <div style={{ position: "absolute", top: 420, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 24 }}>
        {SPLITS.map((sp) => {
          const landed = frame >= sp.at;
          const flash = landed && frame - sp.at < 6;
          return (
            <Pop key={sp.name} delay={sp.at} damping={13} from={0.7}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: flash ? COLORS.cream : sp.gold ? COLORS.yellow : COLORS.card,
                  border: `5px solid ${COLORS.ink}`,
                  borderRadius: 14,
                  boxShadow: neoShadow(8),
                  padding: "26px 34px",
                  opacity: landed ? 1 : 0,
                }}
              >
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 48, letterSpacing: -1, color: COLORS.ink }}>
                  {sp.gold ? "★ " : ""}
                  {sp.name}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 42, color: sp.gold ? COLORS.ink : COLORS.green }}>{sp.time}</div>
              </div>
            </Pop>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1420, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: COLORS.cream, opacity: 0.45 }}>
        ★ = GOLD SPLIT · PB PACE
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ WR
const CONFETTI = Array.from({ length: 26 }).map((_, i) => ({
  x: 80 + ((i * 379) % 920),
  drift: Math.sin(i * 2.1) * 120,
  size: 22 + ((i * 53) % 26),
  color: [COLORS.lime, COLORS.yellow, COLORS.pink, COLORS.blue, COLORS.orange][i % 5],
  delay: (i * 7) % 14,
  spin: (i % 2 ? 1 : -1) * (140 + ((i * 91) % 160)),
}));

const Wr: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 6, 18, 11);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.lime}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.lime} opacity={0.07} />
      </Ground>
      {CONFETTI.map((c, i) => {
        const t = Math.max(0, frame - c.delay);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x + (c.drift * t) / 72,
              top: -60 + t * 26,
              width: c.size,
              height: c.size * 0.7,
              background: c.color,
              border: `3px solid ${COLORS.ink}`,
              transform: `rotate(${(t * c.spin) / 30}deg)`,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, textAlign: "center" }}>
        <Slam frame={frame} fps={fps} delay={6} from={1.8} damping={9} rot={-2}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, lineHeight: 0.94, letterSpacing: -4, color: COLORS.ink, textShadow: `9px 9px 0 ${COLORS.white}` }}>
            NEW WORLD<br />RECORD.
          </div>
        </Slam>
        <div style={{ marginTop: 50, opacity: spr(frame, fps, 22, 12) }}>
          <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.lime, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 110, letterSpacing: 2, padding: "20px 60px", borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.white}` }}>
            {WR_TIME}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 30, 14);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 170, lineHeight: 0.92, letterSpacing: -5, color: COLORS.lime, textShadow: `10px 10px 0 ${COLORS.cream}`, textAlign: "center" }}>SETTLE IT.<br />FAST.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.lime, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, padding: "28px 60px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM/PLAY</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.cream }}>Free · no sign-up · run starts now</div>
      </div>
    </AbsoluteFill>
  );
};

export const SPEEDRUN_SCENES: Record<SKey, React.FC<SceneProps>> = {
  title: Title,
  run: Run,
  wr: Wr,
  cta: Cta,
};
