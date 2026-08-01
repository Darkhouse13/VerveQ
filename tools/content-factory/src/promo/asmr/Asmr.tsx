import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { ASMR_SCENES } from "./scenes";

// Promo #15 — "ASMR": the sound-on satisfier. The quietest promo in the set
// on purpose: streak thocks, letter clicks, the double-ding of being right.
// Drums hold back until the CTA — texture contrast is the whole identity.
export const Asmr: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.cream }}>
    <Audio src={staticFile("promo/asmr.wav")} />
    {SCENES.map((s) => {
      const Comp = ASMR_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
