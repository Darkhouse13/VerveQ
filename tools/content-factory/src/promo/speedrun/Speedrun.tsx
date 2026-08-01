import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../kit";
import { SCENES, START, TOTAL } from "./timeline";
import { SPEEDRUN_SCENES, timerText } from "./scenes";

// Promo #16 — "SPEEDRUN": the gaming-HUD hijack. An argument, any%,
// glitchless — five splits, two golds, WR 0:09.94. The LiveSplit timer is a
// GLOBAL overlay (outside the scene Sequences) so it runs continuously
// across cuts, freezes at the record and flashes gold, then gets out of the
// way for the CTA.
const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= START.cta - 6) return null;
  const frozen = frame >= START.wr;
  const gold = frozen && Math.floor(frame / 10) % 2 === 0; // slow blink, ≤1.5/s
  return (
    <div
      style={{
        position: "absolute",
        top: 150,
        right: 72,
        background: COLORS.ink,
        color: frozen ? (gold ? COLORS.yellow : COLORS.lime) : COLORS.lime,
        border: `5px solid ${frozen ? COLORS.yellow : COLORS.lime}`,
        borderRadius: 14,
        padding: "16px 30px",
        fontFamily: FONTS.mono,
        fontWeight: 700,
        fontSize: 58,
        letterSpacing: 2,
        boxShadow: `8px 8px 0 rgba(0,0,0,0.45)`,
      }}
    >
      {timerText(frame)}
    </div>
  );
};

export const Speedrun: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/speedrun.wav")} />
    {SCENES.map((s) => {
      const Comp = SPEEDRUN_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
    <Hud />
  </AbsoluteFill>
);
