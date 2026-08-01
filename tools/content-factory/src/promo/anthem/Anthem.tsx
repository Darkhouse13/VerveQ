import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { ANTHEM_SCENES } from "./scenes";

// Promo #6 — "ANTHEM": the kinetic-typography brand manifesto. One word per
// beat at 150 BPM, full-ground colour flips, then a dead-silent cream frame
// ("there's a website for this now.") before the payoff — the pattern
// interrupt is the whole trick.
export const Anthem: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/anthem.wav")} />
    {SCENES.map((s) => {
      const Comp = ANTHEM_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
