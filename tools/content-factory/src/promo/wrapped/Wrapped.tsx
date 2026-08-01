import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { COLORS } from "../kit";
import { SCENES, START } from "./timeline";
import { WRAPPED_SCENES } from "./scenes";

// Promo #8 — "WRAPPED": your season in football arguments as absurd personal
// stats. The brightest, fastest promo in the set (~164 BPM pop-major) — the
// year-in-review format everyone already knows how to share.
export const Wrapped: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wrapped.wav")} />
    {SCENES.map((s) => {
      const Comp = WRAPPED_SCENES[s.key];
      return (
        <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
          <Comp dur={s.dur} />
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
