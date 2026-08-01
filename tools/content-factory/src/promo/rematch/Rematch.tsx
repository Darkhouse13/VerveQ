import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { REMATCH_SCENES } from "./scenes";

// Promo #10 — "REMATCH": the revenge arc. Loss → reps → callout → the flip →
// REVENGE. The set's first story, riding a 100 BPM build that turns from
// minor-key grief to a major-key payoff.
export const Rematch: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/rematch.wav")} />
    {SCENES.map((s) => {
      const Comp = REMATCH_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
